/**
 * Format-aware background image generation.
 * Builds prompts appropriate for each ad format and generates via Gemini.
 */
import { getGeminiClient } from "@/lib/gemini"
import { logInfo, logWarn } from "@/lib/logger"

const MODULE = "format-image-gen"

/** Photography spec suffix appended to all scene prompts */
const PHOTO_SPEC = "Ultra photorealistic photograph. Shot on Canon EOS R5 with 35mm f/1.4 lens. Shallow depth of field. Natural dramatic lighting. 4K resolution, razor sharp textures. Professional commercial photography. No text, no logos, no watermarks, no borders, no artifacts, no products, no bottles, no cleaning products."

/** Generate a single image from a text prompt via Gemini */
async function generateImage(prompt: string, model = "gemini-3-pro-image-preview"): Promise<Buffer | null> {
  try {
    const ai = getGeminiClient()
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseModalities: ["IMAGE", "TEXT"] },
    })

    const parts = response.candidates?.[0]?.content?.parts
    if (!parts) return null

    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64")
      }
    }
    return null
  } catch (err) {
    logWarn(MODULE, `Image generation failed: ${(err as Error).message}`)
    return null
  }
}

/**
 * Derive a scene description from the headline text.
 * Extracts the "problem" being described and turns it into a visual prompt.
 */
function buildSceneFromHeadline(headline: string): string {
  const h = headline.toLowerCase()
  if (h.includes("mould") || h.includes("mold")) {
    return "Close-up of black mould spots spreading across white bathroom grout and tiles. Damp, humid atmosphere. Macro photography showing the texture of the mould colonies"
  }
  if (h.includes("grease") || h.includes("kitchen") || h.includes("oven")) {
    return "Thick grease buildup and burnt oil residue on a stainless steel stovetop, with baked-on food splatters on the surrounding surfaces. Harsh overhead kitchen light"
  }
  if (h.includes("patio") || h.includes("path") || h.includes("driveway") || h.includes("black spot")) {
    return "Green algae and black spots covering grey stone patio slabs, with moss growing between the joints. Overhead angle looking down at the dirty paving"
  }
  if (h.includes("stain") || h.includes("fabric") || h.includes("carpet")) {
    return "A fresh dark liquid spill soaking into a light cream fabric sofa cushion. Close-up showing the stain spreading into the fabric fibers"
  }
  if (h.includes("limescale") || h.includes("bathroom")) {
    return "Heavy white limescale buildup around a chrome shower head and glass shower door. Hard water mineral deposits visible in detail"
  }
  if (h.includes("grime") || h.includes("dirt")) {
    return "Years of accumulated grime and dirt on outdoor stone surfaces. Layers of grey-green discoloration with visible texture. Natural overcast lighting"
  }
  // Generic problem scene
  return "A dirty, grimy surface in a UK home — stained, discolored, and in need of cleaning. Close-up macro photography showing the texture and buildup of dirt and residue"
}

export interface FormatImageResult {
  backgroundPhoto?: Buffer
  problemPhotos?: Buffer[]
  beforePhoto?: Buffer
  afterPhoto?: Buffer
}

/**
 * Generate format-appropriate background images.
 * Returns buffers ready to pass to format renderers.
 */
export async function generateFormatImages(
  format: string,
  headline: string,
  imageModel?: string,
): Promise<FormatImageResult> {
  const model = imageModel || "gemini-3-pro-image-preview"
  const scene = buildSceneFromHeadline(headline)
  const result: FormatImageResult = {}

  logInfo(MODULE, `Generating images for format: ${format}, scene: "${scene.slice(0, 60)}..."`)

  switch (format) {
    case "pain-hero":
    case "subscription-hero":
    case "features-checklist": {
      // Single full-bleed problem scene
      const prompt = `${scene}. ${PHOTO_SPEC}. Square 1:1 aspect ratio composition.`
      const buf = await generateImage(prompt, model)
      if (buf) result.backgroundPhoto = buf
      break
    }

    case "pain-split": {
      // Two different problem close-ups for left column
      const prompt1 = `${scene}. Extreme close-up, filling the entire frame. ${PHOTO_SPEC}. Portrait 2:3 aspect ratio.`
      const prompt2 = `A different angle of the same type of problem: ${scene}. Wider shot showing the extent of the problem. ${PHOTO_SPEC}. Portrait 2:3 aspect ratio.`
      const [buf1, buf2] = await Promise.all([
        generateImage(prompt1, model),
        generateImage(prompt2, model),
      ])
      const photos: Buffer[] = []
      if (buf1) photos.push(buf1)
      if (buf2) photos.push(buf2)
      if (photos.length > 0) result.problemPhotos = photos
      break
    }

    case "before-after":
    case "before-after-extended": {
      // Dirty scene (before) and clean scene (after)
      const beforePrompt = `${scene}. The surface is at its worst — heavily soiled, stained, and neglected. ${PHOTO_SPEC}. Portrait 9:16 aspect ratio.`
      const afterPrompt = `The exact same surface and angle, but now perfectly clean, restored, and gleaming. Spotless, like-new condition. The transformation is dramatic and obvious. ${PHOTO_SPEC}. Portrait 9:16 aspect ratio.`
      const [beforeBuf, afterBuf] = await Promise.all([
        generateImage(beforePrompt, model),
        generateImage(afterPrompt, model),
      ])
      if (beforeBuf) result.beforePhoto = beforeBuf
      if (afterBuf) result.afterPhoto = afterBuf
      break
    }
  }

  const generated = Object.keys(result).length
  logInfo(MODULE, `Generated ${generated} image(s) for ${format}`)
  return result
}
