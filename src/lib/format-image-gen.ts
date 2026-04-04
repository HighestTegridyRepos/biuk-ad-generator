/**
 * Format-aware background image generation.
 * Builds prompts appropriate for each ad format and generates via Gemini.
 * 
 * Key features:
 * - Before/after: generates dirty scene first, then feeds that image BACK to Gemini
 *   as a reference to generate the clean version of the SAME scene
 * - Product intelligence integration: accepts product category for Scene DNA matching
 * - Headline-based scene derivation as fallback
 */
import { getGeminiClient } from "@/lib/gemini"
import { SCENE_DNA } from "@/lib/product-intelligence"
import { logInfo, logWarn } from "@/lib/logger"

const MODULE = "format-image-gen"

/** Photography spec suffix — no products, no text */
const PHOTO_SPEC = "Ultra photorealistic photograph. Shot on Canon EOS R5 with 35mm f/1.4 lens. Natural dramatic lighting. 4K resolution, razor sharp textures. Professional commercial photography. No text, no logos, no watermarks, no borders, no artifacts, no products, no bottles, no cleaning products, no people, no hands."

/** Generate an image from a text-only prompt */
async function generateImage(prompt: string, model: string): Promise<Buffer | null> {
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
 * Generate an image using a reference image + text prompt (image-to-image).
 * Used for before→after: feed the dirty image and ask for the clean version.
 */
async function generateImageFromReference(
  referenceImage: Buffer,
  prompt: string,
  model: string,
): Promise<Buffer | null> {
  try {
    const ai = getGeminiClient()
    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: referenceImage.toString("base64"),
            },
          },
          { text: prompt },
        ],
      }],
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
    logWarn(MODULE, `Image-to-image generation failed: ${(err as Error).message}`)
    return null
  }
}

/**
 * Pick a scene description from Scene DNA library if product category is known,
 * otherwise derive from headline text.
 */
function buildScene(headline: string, productCategory?: string): string {
  // Try Scene DNA first (random selection from category)
  if (productCategory && SCENE_DNA[productCategory]) {
    const scenes = SCENE_DNA[productCategory]
    const pick = scenes[Math.floor(Math.random() * scenes.length)]
    return pick
  }

  // Fallback: derive from headline keywords
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
 * 
 * @param format - The ad format name
 * @param headline - Used for scene derivation if no productCategory
 * @param imageModel - Gemini model to use
 * @param productCategory - Product category key for Scene DNA lookup (e.g., "mould-remover", "kitchen-degreaser")
 */
export async function generateFormatImages(
  format: string,
  headline: string,
  imageModel?: string,
  productCategory?: string,
): Promise<FormatImageResult> {
  const model = imageModel || "gemini-3-pro-image-preview"
  const scene = buildScene(headline, productCategory)
  const result: FormatImageResult = {}

  logInfo(MODULE, `Generating images for format: ${format}, category: ${productCategory || "none"}, scene: "${scene.slice(0, 80)}..."`)

  switch (format) {
    case "pain-hero":
    case "subscription-hero":
    case "features-checklist": {
      // Single full-bleed problem scene
      const prompt = `${scene}. ${PHOTO_SPEC}. Square 1:1 aspect ratio composition. Fill the entire frame with the problem — no clean areas, no solutions visible.`
      const buf = await generateImage(prompt, model)
      if (buf) result.backgroundPhoto = buf
      break
    }

    case "pain-split": {
      // Two different problem close-ups for left column
      const prompt1 = `${scene}. Extreme close-up filling the entire frame. ${PHOTO_SPEC}. Portrait 2:3 aspect ratio.`
      // Second image: different angle/manifestation of same problem
      const prompt2 = `A different angle showing the same type of problem: ${scene}. Wider shot showing the full extent of the damage. ${PHOTO_SPEC}. Portrait 2:3 aspect ratio.`
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
      // Step 1: Generate the dirty "before" scene
      const beforePrompt = `${scene}. The surface is at its absolute worst — heavily soiled, stained, neglected, years of buildup. ${PHOTO_SPEC}. Portrait 9:16 aspect ratio.`
      logInfo(MODULE, "Generating BEFORE (dirty) scene...")
      const beforeBuf = await generateImage(beforePrompt, model)
      
      if (beforeBuf) {
        result.beforePhoto = beforeBuf
        
        // Step 2: Feed the dirty image BACK to Gemini and ask for clean version
        logInfo(MODULE, "Generating AFTER (clean) scene from reference image...")
        const afterPrompt = `This is a photo of a dirty, grimy surface. Generate the EXACT SAME photo — same camera angle, same lighting, same surface material, same composition — but now the surface is PERFECTLY CLEAN. Spotless, restored, gleaming like new. The transformation should be dramatic and obvious. Keep everything identical except remove all dirt, grime, stains, mould, and discoloration. ${PHOTO_SPEC}`
        const afterBuf = await generateImageFromReference(beforeBuf, afterPrompt, model)
        if (afterBuf) {
          result.afterPhoto = afterBuf
        } else {
          // Fallback: generate independently if image-to-image fails
          logWarn(MODULE, "Image-to-image failed for AFTER scene, generating independently")
          const fallbackPrompt = `The exact same type of surface as: ${scene}. But now perfectly clean, restored, and gleaming. Spotless condition. ${PHOTO_SPEC}. Portrait 9:16 aspect ratio.`
          const fallbackBuf = await generateImage(fallbackPrompt, model)
          if (fallbackBuf) result.afterPhoto = fallbackBuf
        }
      }
      break
    }
  }

  const generated = Object.keys(result).length
  logInfo(MODULE, `Generated ${generated} image type(s) for ${format}`)
  return result
}
