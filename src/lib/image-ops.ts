/**
 * Image processing operations using sharp only (no @napi-rs/canvas)
 */
import { logWarn } from "./logger"
import { getGeminiClient, NANO_BANANA_2 } from "./gemini"

const ROUTE_NAME = "image-ops"

export async function checkExistingTransparency(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp")
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const totalPixels = info.width * info.height
    let transparentPixels = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 128) transparentPixels++
    }
    if (transparentPixels / totalPixels >= 0.15) return imageBuffer
    return null
  } catch {
    return null
  }
}

export async function removeWhiteBackground(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp")
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const w = info.width
    const h = info.height
    const totalPixels = w * h
    const pixels = new Uint8Array(data.buffer)

    let whitePixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] > 230) whitePixels++
    }
    if (whitePixels / totalPixels < 0.20) return null

    const visited = new Uint8Array(totalPixels)
    const queue: number[] = []
    for (let x = 0; x < w; x++) { queue.push(x); queue.push((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { queue.push(y * w); queue.push(y * w + (w - 1)) }

    while (queue.length > 0) {
      const idx = queue.pop()!
      if (idx < 0 || idx >= totalPixels || visited[idx]) continue
      const pi = idx * 4
      const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2]
      if (r > 210 && g > 210 && b > 210) {
        visited[idx] = 1
        const x = idx % w, y = Math.floor(idx / w)
        if (x > 0) queue.push(idx - 1)
        if (x < w - 1) queue.push(idx + 1)
        if (y > 0) queue.push(idx - w)
        if (y < h - 1) queue.push(idx + w)
      }
    }

    let removedCount = 0
    for (let i = 0; i < totalPixels; i++) {
      if (visited[i]) {
        pixels[i * 4 + 3] = 0
        removedCount++
      }
    }

    if (removedCount / totalPixels < 0.15 || removedCount / totalPixels > 0.95) return null

    return await sharp(Buffer.from(pixels.buffer), {
      raw: { width: w, height: h, channels: 4 },
    }).png().toBuffer()
  } catch {
    return null
  }
}

async function chromaKeyGreen(greenBase64: string): Promise<Buffer | null> {
  try {
    const { default: sharp } = await import("sharp")
    const greenBuf = Buffer.from(greenBase64, "base64")
    const { data, info } = await sharp(greenBuf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const pixels = new Uint8Array(data.buffer)

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
      if (g > 150 && r < 120 && b < 120) {
        pixels[i + 3] = 0
      } else if (g > 130 && r < 140 && b < 140 && g > r && g > b) {
        const greenness = (g - Math.max(r, b)) / g
        if (greenness > 0.2) {
          pixels[i + 3] = Math.round(255 * (1 - greenness))
        }
      }
    }

    return await sharp(Buffer.from(pixels.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toBuffer()
  } catch {
    return null
  }
}

export async function removeBackground(imageBuffer: Buffer): Promise<Buffer | null> {
  const removeBgKey = process.env.REMOVE_BG_API_KEY
  if (removeBgKey) {
    try {
      const formData = new FormData()
      formData.append("image_file", new Blob([imageBuffer as unknown as ArrayBuffer]), "product.png")
      formData.append("size", "auto")
      const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": removeBgKey },
        body: formData,
      })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      console.warn("remove.bg failed:", err)
    }
  }

  try {
    const ai = getGeminiClient()
    const base64 = imageBuffer.toString("base64")
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64 } },
          { text: "Place this exact product on a solid bright green (#00FF00) background. Keep the product exactly as it is — same angle, same lighting, same details. Only change the background to pure solid green (#00FF00). Do NOT add any text, labels, watermarks, words, or artifacts to the product image. Do NOT modify the product in any way — no added text, no 'undo' or any other words. Nothing else in the image, just the unmodified product on green." }
        ]
      }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { responseModalities: ["IMAGE"] as any },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const greenBase64 = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data
    if (!greenBase64) return null

    return await chromaKeyGreen(greenBase64)
  } catch (err) {
    console.warn("Green screen bg removal failed:", err)
  }

  return null
}

export async function cleanCheckerboardArtifacts(pngBase64: string): Promise<string> {
  try {
    const { default: sharp } = await import("sharp")
    const buf = Buffer.from(pngBase64, "base64")
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const pixels = new Uint8Array(data.buffer)
    const w = info.width, h = info.height
    const totalPixels = w * h
    const toRemove = new Uint8Array(totalPixels)

    function isNeutral(idx: number): boolean {
      const pi = idx * 4
      const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2], a = pixels[pi + 3]
      if (a < 50) return true
      if (r > 220 && g > 220 && b > 220) return true
      if (r > 140 && r < 230 && Math.abs(r - g) < 20 && Math.abs(r - b) < 20) return true
      return false
    }

    const visited = new Uint8Array(totalPixels)
    const queue: number[] = []
    for (let x = 0; x < w; x++) { queue.push(x); queue.push((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { queue.push(y * w); queue.push(y * w + (w - 1)) }

    while (queue.length > 0) {
      const idx = queue.pop()!
      if (idx < 0 || idx >= totalPixels || visited[idx]) continue
      if (!isNeutral(idx)) continue
      visited[idx] = 1
      toRemove[idx] = 1
      const x = idx % w, y = Math.floor(idx / w)
      if (x > 0) queue.push(idx - 1)
      if (x < w - 1) queue.push(idx + 1)
      if (y > 0) queue.push(idx - w)
      if (y < h - 1) queue.push(idx + w)
    }

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (toRemove[idx] || !isNeutral(idx)) continue
        let neutralNeighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const ni = (y + dy) * w + (x + dx)
            if (isNeutral(ni) || toRemove[ni]) neutralNeighbors++
          }
        }
        if (neutralNeighbors >= 4) toRemove[idx] = 1
      }
    }

    const expanded = new Uint8Array(totalPixels)
    for (let i = 0; i < totalPixels; i++) expanded[i] = toRemove[i]
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (expanded[idx] || !isNeutral(idx)) continue
        let adjacentRemoved = 0
        if (toRemove[idx - 1]) adjacentRemoved++
        if (toRemove[idx + 1]) adjacentRemoved++
        if (toRemove[idx - w]) adjacentRemoved++
        if (toRemove[idx + w]) adjacentRemoved++
        if (adjacentRemoved >= 2) expanded[idx] = 1
      }
    }

    let cleaned = 0
    for (let i = 0; i < totalPixels; i++) {
      if (expanded[i]) {
        pixels[i * 4 + 3] = 0
        cleaned++
      }
    }

    if (cleaned / totalPixels > 0.90) return pngBase64

    for (let i = 0; i < totalPixels; i++) {
      if (!expanded[i] && pixels[i * 4 + 3] > 0) {
        const x = i % w, y = Math.floor(i / w)
        let transparentNeighbors = 0
        if (x > 0 && expanded[i - 1]) transparentNeighbors++
        if (x < w - 1 && expanded[i + 1]) transparentNeighbors++
        if (y > 0 && expanded[i - w]) transparentNeighbors++
        if (y < h - 1 && expanded[i + w]) transparentNeighbors++
        if (transparentNeighbors >= 2) pixels[i * 4 + 3] = Math.round(pixels[i * 4 + 3] * 0.5)
        else if (transparentNeighbors === 1) pixels[i * 4 + 3] = Math.round(pixels[i * 4 + 3] * 0.8)
      }
    }

    const result = await sharp(Buffer.from(pixels.buffer), {
      raw: { width: w, height: h, channels: 4 },
    }).png().toBuffer()
    return result.toString("base64")
  } catch {
    return pngBase64
  }
}

export async function removeBackgroundFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const imageRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    })
    if (!imageRes.ok) return null

    const blob = await imageRes.blob()
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64")
    const mimeType = blob.type || "image/jpeg"

    const ai = getGeminiClient()
    const response = await ai.models.generateContent({
      model: NANO_BANANA_2,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          {
            text: "Remove the background completely from this product image. Return ONLY the product on a transparent background. The background should be completely transparent/removed. No checkerboard, no white fill, no shadow — pure transparency everywhere that is not the product itself. Clean, precise edges. CRITICAL: Do NOT modify the product in any way. Do NOT add, change, or overlay ANY text on the product. Do NOT add words like 'undo' or any other labels. The product must look exactly as it does in the original photo — only the background changes.",
          },
        ],
      }],
      config: { responseModalities: ["IMAGE"] },
    })

    const cutoutBase64 = response.candidates?.[0]?.content?.parts
      ?.find((p: { inlineData?: { data?: string } }) => p.inlineData)?.inlineData?.data
    if (!cutoutBase64) return null

    return await cleanCheckerboardArtifacts(cutoutBase64)
  } catch (err) {
    logWarn(ROUTE_NAME, `Background removal failed: ${(err as Error).message}`)
    return null
  }
}
