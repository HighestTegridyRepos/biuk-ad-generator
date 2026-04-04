/**
 * pain-hero renderer
 * Full-bleed problem-scene photo background.
 * Headline top-left: line1 white ~120px, line2 bannerColor ~130px.
 * Product center-right, large (~46% width × 59% height zone).
 * Bottom banner: bannerColor, stars left + CTA.
 */
import React from "react"
import { FormatConfig, FormatRenderer, fetchBuf, renderToPng } from "./satori-helpers"

export const renderPainHero: FormatRenderer = async (cfg: FormatConfig): Promise<Buffer> => {
  const { width, height, productImageBuffer, headline, bannerColor, bannerText, backgroundPhoto } = cfg
  const s = width / 1080

  const { default: sharp } = await import("sharp")

  // Layout
  const bannerH = Math.round(100 * s)
  const bannerY = height - bannerH
  const productZoneX1 = Math.round(480 * s)
  const productZoneX2 = Math.round(980 * s)
  const productZoneY1 = Math.round(200 * s)
  const productZoneY2 = Math.round(920 * s)
  const productZoneW = productZoneX2 - productZoneX1
  const productZoneH = productZoneY2 - productZoneY1

  // 1. Background: full-bleed photo or dark fallback
  let bgBuffer: Buffer
  if (backgroundPhoto) {
    try {
      const raw = await fetchBuf(backgroundPhoto)
      bgBuffer = await sharp(raw).resize(width, height, { fit: "cover" }).png().toBuffer()
    } catch {
      bgBuffer = await sharp({
        create: { width, height, channels: 4, background: { r: 40, g: 40, b: 40, alpha: 1 } },
      }).png().toBuffer()
    }
  } else {
    bgBuffer = await sharp({
      create: { width, height, channels: 4, background: { r: 40, g: 40, b: 40, alpha: 1 } },
    }).png().toBuffer()
  }

  // 2. Resize product to fit right zone
  const prodMeta = await sharp(productImageBuffer).metadata()
  const prodAspect = (prodMeta.height ?? 1) / (prodMeta.width ?? 1)
  let prodW = productZoneW
  let prodH = Math.round(prodW * prodAspect)
  if (prodH > productZoneH) { prodH = productZoneH; prodW = Math.round(prodH / prodAspect) }

  const productResized = await sharp(productImageBuffer)
    .resize(prodW, prodH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const prodX = productZoneX1 + Math.round((productZoneW - prodW) / 2)
  const prodY = productZoneY1 + Math.round((productZoneH - prodH) / 2)

  // 3. Headline: split on \n if present, otherwise split at midpoint
  let line1: string, line2: string
  if (headline.includes("\n")) {
    const parts = headline.split("\n")
    line1 = parts[0].trim()
    line2 = parts.slice(1).join(" ").trim()
  } else {
    const words = headline.trim().split(/\s+/)
    const mid = Math.ceil(words.length / 2)
    line1 = words.slice(0, mid).join(" ")
    line2 = words.slice(mid).join(" ") || line1
  }

  // Auto-scale: if either line is long, reduce font sizes to prevent wrapping
  // Scale down aggressively if lines are long to prevent wrapping within a single line element
  // At 120px Inter-Bold, ~8-9 chars fit in 980px maxWidth. Scale so longest line fits in one visual line.
  const charsPerLine = 12 // conservative estimate for bold uppercase at base size
  const maxLineLen = Math.max(line1.length, line2.length)
  const sizeFactor = maxLineLen > charsPerLine ? Math.max(0.5, charsPerLine / maxLineLen) : 1.0
  const line1Size = Math.round(120 * s * sizeFactor)
  const line2Size = Math.round(130 * s * sizeFactor)
  const bannerFontSize = Math.round(38 * s)
  const bannerStarSize = Math.round(30 * s)

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
    // Headline top-left with drop shadow via stacked text
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: Math.round(40 * s),
          left: Math.round(40 * s),
          display: "flex",
          flexDirection: "column",
          maxWidth: Math.round(980 * s),
        },
      },
      // Line 1: white
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: line1Size,
            fontWeight: 700,
            lineHeight: 1.15,
            textTransform: "uppercase" as const,
            textShadow: `${Math.round(3 * s)}px ${Math.round(3 * s)}px ${Math.round(6 * s)}px rgba(0,0,0,0.6)`,
          },
        },
        line1
      ),
      // Line 2: accent color
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: bannerColor,
            fontSize: line2Size,
            fontWeight: 700,
            lineHeight: 1.15,
            textTransform: "uppercase" as const,
            textShadow: `${Math.round(3 * s)}px ${Math.round(3 * s)}px ${Math.round(6 * s)}px rgba(0,0,0,0.6)`,
          },
        },
        line2
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
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: Math.round(40 * s),
          gap: Math.round(20 * s),
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: bannerStarSize,
            fontWeight: 700,
          },
        },
        "★★★★★"
      ),
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

  // 4. Composite
  return sharp(bgBuffer)
    .composite([
      { input: productResized, left: prodX, top: prodY },
      { input: overlayBuf, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
