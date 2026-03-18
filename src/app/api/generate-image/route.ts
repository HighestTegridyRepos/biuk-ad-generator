import { NextRequest, NextResponse } from "next/server"
import { getGeminiClient, IMAGE_MODEL } from "@/lib/gemini"

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A prompt string is required" },
        { status: 400 }
      )
    }

    const ai = getGeminiClient()

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    })

    // Extract the image from the response
    const parts = response.candidates?.[0]?.content?.parts
    if (!parts) {
      return NextResponse.json(
        { error: "No response from image model" },
        { status: 502 }
      )
    }

    let imageBase64: string | null = null
    let mimeType = "image/png"

    for (const part of parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data ?? null
        mimeType = part.inlineData.mimeType ?? "image/png"
        break
      }
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Model did not return an image. Try rephrasing the prompt." },
        { status: 422 }
      )
    }

    const dataUrl = `data:${mimeType};base64,${imageBase64}`

    return NextResponse.json({ imageUrl: dataUrl })
  } catch (err: unknown) {
    console.error("Image generation error:", err)
    const message =
      err instanceof Error ? err.message : "Image generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
