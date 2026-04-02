/**
 * before-after renderer
 * Split photo bg (dirty left / clean right, split at x=540).
 * White top bar 120px with bold italic black headline.
 * Product centered over split line.
 * Orange circle badge upper-right (~230px diameter).
 * Bottom banner: bannerColor, italic social proof text.
 */
import React from "react"
import { FormatConfig, FormatRenderer, fetchBuf, renderToPng } from "./satori-helpers"

export const renderBeforeAfter: FormatRenderer = async (cfg: FormatConfig): Promise<Buffer> => {
  const {
    width, height, productImageBuffer, headline, bannerColor, bannerText,
    beforePhoto, afterPhoto, badgeText,
  } = cfg
  const s = width / 1080

  const { default: sharp } = await import("sharp")

  // Layout constants
  const topBarH = Math.round(120 * s)
  const bannerH = Math.round(100 * s)
  const bannerY = height - bannerH
  const splitX = Math.round(540 * s)

  // Product zone: center, y 200–880
  const prodZoneY1 = Math.round(200 * s)
  const prodZoneY2 = Math.round(880 * s)
  const prodZoneH = prodZoneY2 - prodZoneY1
  const prodMaxW = Math.round(width * 0.38)

  // Badge: 230px circle at (875, 325)
  const badgeDiam = Math.round(230 * s)
  const badgeX = Math.round(875 * s)
  const badgeY = Math.round(325 * s)

  // 1. Build split background
  let leftBuf: Buffer | null = null
  let rightBuf: Buffer | null = null
  const halfW = splitX
  const rightW = width - splitX
  const photoH = height

  if (beforePhoto) {
    try {
      const raw = await fetchBuf(beforePhoto)
      leftBuf = await sharp(raw).resize(halfW, photoH, { fit: "cover" }).png().toBuffer()
    } catch { leftBuf = null }
  }
  if (afterPhoto) {
    try {
      const raw = await fetchBuf(afterPhoto)
      rightBuf = await sharp(raw).resize(rightW, photoH, { fit: "cover" }).png().toBuffer()
    } catch { rightBuf = null }
  }

  // Build composite background canvas
  const bgBase = await sharp({
    create: { width, height, channels: 4, background: { r: 180, g: 180, b: 180, alpha: 1 } },
  }).png().toBuffer()

  const bgLayers: Array<{ input: Buffer; left: number; top: number }> = []
  if (leftBuf) bgLayers.push({ input: leftBuf, left: 0, top: 0 })
  if (rightBuf) bgLayers.push({ input: rightBuf, left: splitX, top: 0 })
  const bgBuffer = bgLayers.length > 0
    ? await sharp(bgBase).composite(bgLayers).png().toBuffer()
    : bgBase

  // 2. Product sizing
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

  // 3. Text overlay: top bar headline + badge + bottom banner
  const headlineFontSize = Math.round(48 * s)
  const bannerFontSize = Math.round(45 * s)
  const badgeL1Size = Math.round(28 * s)
  const badgeL2Size = Math.round(56 * s)
  const badgeR = badgeDiam / 2

  const badgeLines = (badgeText || "Subscribe & Save\n20%").split("\n")
  const badgeLine1 = badgeLines[0] ?? "Subscribe & Save"
  const badgeLine2 = badgeLines[1] ?? "20%"

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
    // White top bar
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: topBarH,
          backgroundColor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#000000",
            fontSize: headlineFontSize,
            fontWeight: 700,
            fontStyle: "italic" as const,
            textTransform: "uppercase" as const,
          },
        },
        headline
      )
    ),
    // Badge (div-based circle — satori doesn't support SVG <text>)
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          left: badgeX - badgeR - Math.round(5 * s),
          top: badgeY - badgeR - Math.round(5 * s),
          width: badgeDiam + Math.round(10 * s),
          height: badgeDiam + Math.round(10 * s),
          borderRadius: Math.round((badgeDiam + Math.round(10 * s)) / 2),
          backgroundColor: bannerColor,
          border: `${Math.round(4 * s)}px solid #FFFFFF`,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: badgeL1Size,
            fontWeight: 700,
            fontFamily: "Inter",
          },
        },
        badgeLine1
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: badgeL2Size,
            fontWeight: 700,
            fontFamily: "Inter",
          },
        },
        badgeLine2
      )
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
          alignItems: "center",
          justifyContent: "center",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: bannerFontSize,
            fontWeight: 700,
            fontStyle: "italic" as const,
          },
        },
        bannerText || "Subscribe and Save 20%"
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
