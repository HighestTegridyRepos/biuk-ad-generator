import { renderTextPng } from "./text-render"

export async function renderChecklist(
  width: number,
  height: number,
  headline: string,
  checklistItems: string[],
  productCutoutBase64: string | null,
  socialProofText: string = "SUBSCRIBE & SAVE 20%",
  bannerStyle: "trustpilot" | "gold" = "trustpilot",
  accentColor: string = "#3BB8E8",
): Promise<string> {
  const { default: sharp } = await import("sharp")

  const headlineH = Math.round(height * 0.15)
  const bannerH = Math.round(height * 0.09)
  const bannerY = height - bannerH
  const contentTop = headlineH
  const contentH = bannerY - headlineH

  const layers: Array<{ input: Buffer; left: number; top: number }> = []

  // Headline gradient
  const headlineFontSize = Math.round(width * 0.065)
  const headlineUpper = headline.toUpperCase()
  const gradH = headlineH + Math.round(height * 0.03)
  const gradSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${gradH}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="black" stop-opacity="0.75"/>
          <stop offset="80%" stop-color="black" stop-opacity="0.50"/>
          <stop offset="100%" stop-color="black" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${gradH}" fill="url(#g)"/>
    </svg>`
  )
  const gradBuf = await sharp(gradSvg).png().toBuffer()
  layers.push({ input: gradBuf, left: 0, top: 0 })

  const headTxt = await renderTextPng(sharp, headlineUpper, {
    fontSize: headlineFontSize,
    bold: true,
    color: "white",
    maxWidth: Math.round(width * 0.90),
    align: "center",
  })
  const hLineH = headlineFontSize * 1.15
  const hTotalH = 2 * hLineH
  const hStartY = Math.max(0, Math.round((headlineH - hTotalH) / 2))
  layers.push({
    input: headTxt.buffer,
    left: Math.max(0, Math.round((width - headTxt.width) / 2)),
    top: hStartY,
  })

  // Checklist items
  const itemCount = Math.min(checklistItems.length, 4)
  const leftX = Math.round(width * 0.06)
  const bubbleRadius = Math.round(width * 0.028)
  const itemFontSize = Math.round(width * 0.038)
  const rowHeight = Math.round(contentH / (itemCount + 1))

  for (let i = 0; i < itemCount; i++) {
    const rowCenterY = contentTop + rowHeight * (i + 0.75)
    const bubbleTop = Math.round(rowCenterY - bubbleRadius)
    const bubbleDiameter = bubbleRadius * 2

    const checkSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${bubbleDiameter}" height="${bubbleDiameter}">
        <circle cx="${bubbleRadius}" cy="${bubbleRadius}" r="${bubbleRadius}" fill="${accentColor}"/>
        <text x="${bubbleRadius}" y="${Math.round(bubbleRadius * 1.35)}" 
              font-size="${Math.round(bubbleRadius * 1.2)}" 
              fill="white" text-anchor="middle" font-weight="bold">&#10003;</text>
      </svg>`
    )
    const checkBuf = await sharp(checkSvg).png().toBuffer()
    layers.push({ input: checkBuf, left: leftX, top: Math.max(0, bubbleTop) })

    const textX = leftX + bubbleDiameter + Math.round(width * 0.025)
    const itemTxt = await renderTextPng(sharp, checklistItems[i], {
      fontSize: itemFontSize,
      bold: true,
      color: "#2A2A2A",
      maxWidth: Math.round(width * 0.45),
      align: "left",
    })
    layers.push({
      input: itemTxt.buffer,
      left: textX,
      top: Math.max(0, Math.round(rowCenterY - itemTxt.height / 2)),
    })
  }

  // Product image
  if (productCutoutBase64) {
    try {
      const rawCutout = Buffer.from(productCutoutBase64, "base64")
      const meta = await sharp(rawCutout).metadata()
      const cutW = meta.width ?? 200
      const cutH = meta.height ?? 200
      const targetH = Math.round(height * 0.65)
      const scale = targetH / cutH
      const targetW = Math.round(cutW * scale)
      const px = Math.round(width * 0.70 - targetW / 2)
      const py = contentTop + Math.round((contentH - targetH) / 2)
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
  const bannerFontSize = Math.round(width * 0.042)
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
    create: { width, height, channels: 4, background: { r: 248, g: 248, b: 248, alpha: 1 } },
  }).composite(layers).png().toBuffer()

  return `data:image/png;base64,${base.toString("base64")}`
}
