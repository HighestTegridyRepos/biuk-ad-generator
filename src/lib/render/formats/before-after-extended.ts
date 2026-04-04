/**
 * before-after-extended renderer
 * Tall cream header (#F5F0E6, 290px): black headline, bannerColor accent text, black subhead.
 * Split before/after photo below (splitX=350).
 * Product centered tall (y: 380–870).
 * Bottom banner: bannerColor, stars + italic CTA.
 */
import React from "react"
import { FormatConfig, FormatRenderer, fetchBuf, renderToPng } from "./satori-helpers"

export const renderBeforeAfterExtended: FormatRenderer = async (cfg: FormatConfig): Promise<Buffer> => {
  const {
    width, height, productImageBuffer, headline, bannerColor, bannerText,
    beforePhoto, afterPhoto, accentText, subheadline,
  } = cfg
  const s = width / 1080

  const { default: sharp } = await import("sharp")

  // Layout
  const headerH = Math.round(290 * s)
  const bannerH = Math.round(85 * s)
  const bannerY = height - bannerH
  const splitX = Math.round(350 * s)

  // Product zone
  const prodZoneY1 = Math.round(320 * s)
  const prodZoneY2 = Math.round(890 * s)
  const prodZoneH = prodZoneY2 - prodZoneY1
  const prodMaxW = Math.round(width * 0.45)

  // 1. Build backgrounds: cream header + split photo
  const headerBuf = await sharp({
    create: { width, height: headerH, channels: 4, background: { r: 245, g: 240, b: 230, alpha: 1 } },
  }).png().toBuffer()

  const photoAreaH = bannerY - headerH
  const leftW = splitX
  const rightW = width - splitX

  let leftPhBuf: Buffer | null = null
  let rightPhBuf: Buffer | null = null
  if (beforePhoto) {
    try {
      const raw = await fetchBuf(beforePhoto)
      leftPhBuf = await sharp(raw).resize(leftW, photoAreaH, { fit: "cover" }).png().toBuffer()
    } catch { leftPhBuf = null }
  }
  if (afterPhoto) {
    try {
      const raw = await fetchBuf(afterPhoto)
      rightPhBuf = await sharp(raw).resize(rightW, photoAreaH, { fit: "cover" }).png().toBuffer()
    } catch { rightPhBuf = null }
  }

  // Base canvas
  const base = await sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } },
  }).png().toBuffer()

  const bgLayers: Array<{ input: Buffer; left: number; top: number }> = [
    { input: headerBuf, left: 0, top: 0 },
  ]
  if (leftPhBuf) bgLayers.push({ input: leftPhBuf, left: 0, top: headerH })
  if (rightPhBuf) bgLayers.push({ input: rightPhBuf, left: splitX, top: headerH })
  const bgBuffer = await sharp(base).composite(bgLayers).png().toBuffer()

  // 2. Product
  const prodMeta = await sharp(productImageBuffer).metadata()
  const prodAspect = (prodMeta.height ?? 1) / (prodMeta.width ?? 1)
  let prodH = prodZoneH
  let prodW = Math.round(prodH / prodAspect)
  if (prodW > prodMaxW) { prodW = prodMaxW; prodH = Math.round(prodW * prodAspect) }

  const productResized = await sharp(productImageBuffer)
    .resize(prodW, prodH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const prodX = Math.round((width - prodW) / 2)
  const prodY = prodZoneY1 + Math.round((prodZoneH - prodH) / 2)

  // 3. Text overlay
  const headlineFontSize = Math.round(68 * s)
  const accentFontSize = Math.round(55 * s)
  const subheadFontSize = Math.round(36 * s)
  const bannerFontSize = Math.round(42 * s)
  const starSize = Math.round(30 * s)

  const accentLine1 = accentText?.line1 ?? ""
  const accentLine2 = accentText?.line2 ?? ""
  const subhead = subheadline ?? ""

  const overlayEl = React.createElement(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        position: "relative",
        fontFamily: "Inter",
      },
    },
    // Header text block — single flex column so items flow without overlap
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: Math.round(15 * s),
          left: Math.round(40 * s),
          right: Math.round(40 * s),
          height: Math.round(260 * s),
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(10 * s),
        },
      },
      // Headline
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#020202",
            fontSize: headlineFontSize,
            fontWeight: 700,
            textTransform: "uppercase" as const,
            textAlign: "center" as const,
            lineHeight: 1.05,
          },
        },
        headline
      ),
      // Accent line 1
      accentLine1 ? React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: bannerColor,
            fontSize: accentFontSize,
            fontWeight: 700,
            textTransform: "uppercase" as const,
            lineHeight: 1.0,
          },
        },
        accentLine1
      ) : null,
      // Accent line 2
      accentLine2 ? React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: bannerColor,
            fontSize: accentFontSize,
            fontWeight: 700,
            textTransform: "uppercase" as const,
            lineHeight: 1.0,
          },
        },
        accentLine2
      ) : null,
      // Subheadline
      subhead ? React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#040404",
            fontSize: subheadFontSize,
            fontWeight: 700,
            maxWidth: Math.round(800 * s),
            textAlign: "center" as const,
          },
        },
        subhead
      ) : null
    ),
    // Bottom banner
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          height: bannerH,
          backgroundColor: bannerColor,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: Math.round(50 * s),
          gap: Math.round(20 * s),
        },
      },
      React.createElement("div", { style: { display: "flex", color: "#FFFFFF", fontSize: Math.round(38 * s), fontWeight: 700, fontStyle: "italic" as const } },
        bannerText || "Trusted by Thousands of Happy Customers"
      )
    )
  )

  const overlayBuf = await renderToPng(overlayEl, width, height)

  return sharp(bgBuffer)
    .composite([
      { input: productResized, left: prodX, top: prodY },
      { input: overlayBuf, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
