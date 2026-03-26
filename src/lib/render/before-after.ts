import { renderTextPng } from "./text-render"

export async function renderBeforeAfterQuad(
  width: number,
  height: number,
  headline: string,
  beforeAfterScenes: Array<{ dirtyImageDataUrl: string; cleanImageDataUrl: string }>,
  productCutoutBase64: string | null,
  socialProofText: string = "SUBSCRIBE & SAVE 20%",
  bannerStyle: "trustpilot" | "gold" = "trustpilot",
  accentColor: string = "#4AADE0",
): Promise<string> {
  const { default: sharp } = await import("sharp")

  const bannerH = Math.round(height * 0.09)
  const bannerY = height - bannerH
  const gridH = height - bannerH
  const gridGap = Math.round(width * 0.005)
  const cellW = Math.round((width - gridGap) / 2)
  const cellH = Math.round((gridH - gridGap) / 2)

  async function resizeCoverCell(dataUrl: string, targetW: number, targetH: number): Promise<Buffer> {
    const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
    if (!match) {
      return await sharp({ create: { width: targetW, height: targetH, channels: 4, background: { r: 50, g: 50, b: 50, alpha: 1 } } }).png().toBuffer()
    }
    const buf = Buffer.from(match[1], "base64")
    return await sharp(buf).resize(targetW, targetH, { fit: "cover", position: "centre" }).png().toBuffer()
  }

  const scene1 = beforeAfterScenes[0]
  const scene2 = beforeAfterScenes.length > 1 ? beforeAfterScenes[1] : beforeAfterScenes[0]

  const [cell00, cell10, cell01, cell11] = await Promise.all([
    resizeCoverCell(scene1.dirtyImageDataUrl, cellW, cellH),
    resizeCoverCell(scene1.cleanImageDataUrl, cellW, cellH),
    resizeCoverCell(scene2.dirtyImageDataUrl, cellW, cellH),
    resizeCoverCell(scene2.cleanImageDataUrl, cellW, cellH),
  ])

  const layers: Array<{ input: Buffer; left: number; top: number }> = [
    { input: cell00, left: 0, top: 0 },
    { input: cell10, left: cellW + gridGap, top: 0 },
    { input: cell01, left: 0, top: cellH + gridGap },
    { input: cell11, left: cellW + gridGap, top: cellH + gridGap },
  ]

  // Gradient overlay at top
  const headFontSize = Math.round(width * 0.095)
  const textPadTop = Math.round(height * 0.03)
  const gradHeight = Math.round(textPadTop + 2 * headFontSize * 1.15 + height * 0.05)

  const gradSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${gradHeight}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="black" stop-opacity="0.70"/>
          <stop offset="70%" stop-color="black" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="black" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${gradHeight}" fill="url(#g)"/>
    </svg>`
  )
  const gradBuf = await sharp(gradSvg).png().toBuffer()
  layers.push({ input: gradBuf, left: 0, top: 0 })

  const headTxt = await renderTextPng(sharp, headline.toUpperCase(), {
    fontSize: headFontSize,
    bold: true,
    color: "white",
    maxWidth: Math.round(width * 0.90),
    align: "center",
  })
  layers.push({
    input: headTxt.buffer,
    left: Math.max(0, Math.round((width - headTxt.width) / 2)),
    top: textPadTop,
  })

  if (productCutoutBase64) {
    try {
      const rawCutout = Buffer.from(productCutoutBase64, "base64")
      const meta = await sharp(rawCutout).metadata()
      const cutW = meta.width ?? 200
      const cutH = meta.height ?? 200
      const targetH = Math.round(height * 0.50)
      const scale = targetH / cutH
      const targetW = Math.round(cutW * scale)
      const px = Math.round((width - targetW) / 2)
      const py = Math.round((gridH - targetH) / 2) + Math.round(height * 0.03)
      const resized = await sharp(rawCutout)
        .resize(targetW, targetH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer()
      layers.push({ input: resized, left: Math.max(0, px), top: Math.max(0, py) })
    } catch { /* skip */ }
  }

  // Banner
  const bannerColor = bannerStyle === "trustpilot" ? accentColor : "#D4C96B"
  const bannerBuf = await sharp({
    create: { width, height: bannerH, channels: 4, background: bannerColor },
  }).png().toBuffer()
  layers.push({ input: bannerBuf, left: 0, top: bannerY })

  const starsFontSize = Math.round(bannerH * 0.45)
  const bannerFontSize = Math.round(bannerH * 0.40)
  const bannerTextColor = bannerStyle === "trustpilot" ? "white" : "#1a1a1a"

  const starsTxt = await renderTextPng(sharp, "★★★★★", { fontSize: starsFontSize, bold: true, color: bannerTextColor, maxWidth: width, align: "left" })
  const socialTxt = await renderTextPng(sharp, socialProofText, { fontSize: bannerFontSize, bold: true, color: bannerTextColor, maxWidth: Math.max(10, width - 40 - starsTxt.width) })

  const gap = Math.round(width * 0.025)
  const totalBannerW = starsTxt.width + gap + socialTxt.width
  const bannerStartX = Math.round((width - totalBannerW) / 2)
  const bannerCenterY = bannerY + Math.round((bannerH - Math.max(starsTxt.height, socialTxt.height)) / 2)

  layers.push({ input: starsTxt.buffer, left: Math.max(0, bannerStartX), top: Math.max(bannerY, bannerCenterY) })
  layers.push({
    input: socialTxt.buffer,
    left: Math.max(0, bannerStartX + starsTxt.width + gap),
    top: Math.max(bannerY, bannerCenterY + Math.round((starsTxt.height - socialTxt.height) / 2)),
  })

  const base = await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).composite(layers).png().toBuffer()

  return `data:image/png;base64,${base.toString("base64")}`
}
