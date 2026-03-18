import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { v4 as uuid } from "uuid"

// Background removal is heavy (downloads ~40MB ONNX model on first call).
// Allow up to 60s on Vercel.
export const maxDuration = 60

/**
 * POST /api/remove-background
 * Accepts an image URL, downloads it, removes the background using
 * @imgly/background-removal (ONNX, no API key), uploads the cutout
 * PNG to Supabase Storage, and optionally updates the products table.
 *
 * Body: { imageUrl: string, productId?: string }
 * Returns: { cutoutUrl: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrl, productId } = await req.json()

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "An imageUrl is required" },
        { status: 400 }
      )
    }

    // SSRF protection: block internal/private network URLs
    try {
      const parsed = new URL(imageUrl)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 })
      }
      const hostname = parsed.hostname.toLowerCase()
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("169.254.") ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".local")
      ) {
        return NextResponse.json({ error: "Internal URLs are not allowed" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    // Download the source image
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!imageRes.ok) {
      return NextResponse.json(
        { error: "Could not download the source image" },
        { status: 422 }
      )
    }

    const imageBlob = await imageRes.blob()

    // Run background removal (dynamic import — heavy ONNX module)
    const { removeBackground } = await import("@imgly/background-removal")
    const cutoutBlob = await removeBackground(imageBlob, {
      output: { format: "image/png" },
    })

    // Convert to buffer for Supabase upload
    const arrayBuffer = await cutoutBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const supabase = getSupabase()
    const fileName = `cutouts/${uuid()}.png`

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload cutout image" },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName)

    const cutoutUrl = publicUrlData.publicUrl

    // Update the products table if productId provided
    if (productId) {
      await supabase
        .from("products")
        .update({ cutout_image_url: cutoutUrl })
        .eq("id", productId)
    }

    return NextResponse.json({ cutoutUrl })
  } catch (error) {
    console.error("Background removal error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Background removal failed",
      },
      { status: 500 }
    )
  }
}
