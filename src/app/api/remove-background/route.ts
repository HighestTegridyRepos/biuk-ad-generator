import { NextRequest, NextResponse } from "next/server"
import { getGeminiClient, NANO_BANANA_PRO } from "@/lib/gemini"
import { getSupabase } from "@/lib/supabase"
import { v4 as uuid } from "uuid"

// Allow up to 60s — image generation can be slow
export const maxDuration = 60

/**
 * POST /api/remove-background
 * Uses Gemini (Nano Banana Pro) to remove the background from a product image.
 * Uploads the cutout PNG to Supabase Storage.
 *
 * No extra API key needed — uses the existing GEMINI_API_KEY.
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

    // ── SSRF protection: block internal/private network URLs ──────
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

    // ── Download the source image ────────────────────────────────
    const imageRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
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
    const imageBuffer = await imageBlob.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString("base64")
    const mimeType = imageBlob.type || "image/jpeg"

    // ── Send to Gemini for background removal ────────────────────
    const ai = getGeminiClient()

    const response = await ai.models.generateContent({
      model: NANO_BANANA_PRO,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: "Remove the background from this product image completely. Return ONLY the product on a fully transparent background with clean, precise edges. No shadow, no reflection, no background elements whatsoever. The cutout should look professional and ready to composite onto any background.",
            },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
      },
    })

    // ── Extract the cutout image from the response ───────────────
    const parts = response.candidates?.[0]?.content?.parts
    if (!parts) {
      return NextResponse.json(
        { error: "Gemini did not return a response" },
        { status: 502 }
      )
    }

    let cutoutBase64: string | null = null
    let cutoutMime = "image/png"

    for (const part of parts) {
      if (part.inlineData) {
        cutoutBase64 = part.inlineData.data ?? null
        cutoutMime = part.inlineData.mimeType ?? "image/png"
        break
      }
    }

    if (!cutoutBase64) {
      return NextResponse.json(
        { error: "Gemini did not return an image. The model may have refused this image." },
        { status: 422 }
      )
    }

    // ── Upload to Supabase Storage ───────────────────────────────
    const supabase = getSupabase()
    const ext = cutoutMime.includes("png") ? "png" : "webp"
    const fileName = `cutouts/${uuid()}.${ext}`
    const buffer = Buffer.from(cutoutBase64, "base64")

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, buffer, {
        contentType: cutoutMime,
        upsert: false,
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      // Return the data URL as fallback even if storage fails
      const dataUrl = `data:${cutoutMime};base64,${cutoutBase64}`
      return NextResponse.json({ cutoutUrl: dataUrl })
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
