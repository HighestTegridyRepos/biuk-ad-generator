/**
 * features-checklist renderer
 * bannerColor top bar (290px) with 2-line white headline.
 * Problem scene photo background below.
 * Left-side checklist: 4 items, colored circle + checkmark + text at y=485/593/700/808.
 * Product center-right (x:~650, y:400–870).
 * Dark bottom zone (y:890–1080) with green accent badge.
 */
import React from "react"
import { FormatConfig, FormatRenderer, fetchBuf, renderToPng } from "./satori-helpers"

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

export const renderFeaturesChecklist: FormatRenderer = async (cfg: FormatConfig): Promise<Buffer> => {
  const {
    width, height, productImageBuffer, headline, bannerColor, bannerText,
    backgroundPhoto, checklistItems,
  } = cfg
  const s = width / 1080

  const { default: sharp } = await import("sharp")

  // Layout
  const topBarH = Math.round(290 * s)
  const bottomZoneY = Math.round(890 * s)
  const bottomZoneH = height - bottomZoneY

  // Product zone: center-right
  const prodXCenter = Math.round(650 * s)
  // Product: 30%W × 45%H per ground truth — right side, between header and bottom zone
  const prodZoneY1 = Math.round(350 * s)
  const prodZoneY2 = Math.round(860 * s)
  const prodZoneH = prodZoneY2 - prodZoneY1
  const prodMaxW = Math.round(width * 0.35)

  // Checklist positions (at 1080 base, scaled)
  const itemYs = [485, 593, 700, 808].map(y => Math.round(y * s))
  const circleX = Math.round(50 * s)
  const circleR = Math.round(26 * s)
  const textX = Math.round(110 * s)

  // Items (default 4)
  const items = checklistItems ?? [
    "Kills 99.9% of Mould",
    "Works on All Surfaces",
    "Fast-Acting Formula",
    "Professional Strength",
  ]

  // 1. Background
  let photoBuf: Buffer | null = null
  if (backgroundPhoto) {
    try {
      const raw = await fetchBuf(backgroundPhoto)
      photoBuf = await sharp(raw).resize(width, height, { fit: "cover" }).png().toBuffer()
    } catch { photoBuf = null }
  }

  const bgBase = photoBuf ?? await sharp({
    create: { width, height, channels: 4, background: { r: 100, g: 100, b: 100, alpha: 1 } },
  }).png().toBuffer()

  // Top bar
  const [tr, tg, tb] = hexToRgb(bannerColor)
  const topBarBuf = await sharp({
    create: { width, height: topBarH, channels: 4, background: { r: tr, g: tg, b: tb, alpha: 1 } },
  }).png().toBuffer()

  // Bottom dark zone
  const bottomZoneBuf = await sharp({
    create: { width, height: bottomZoneH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 220 } },
  }).png().toBuffer()

  const bgBuffer = await sharp(bgBase)
    .composite([
      { input: topBarBuf, left: 0, top: 0 },
      { input: bottomZoneBuf, left: 0, top: bottomZoneY },
    ])
    .png()
    .toBuffer()

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
  const prodX = prodXCenter - Math.round(prodW / 2)
  const prodY = prodZoneY1 + Math.round((prodZoneH - prodH) / 2)

  // 3. Text overlay: headline + checklist text + bottom accent
  const headlineFontSize = Math.round(68 * s)
  const checkFontSize = Math.round(26 * s)
  const bottomFontSize = Math.round(30 * s)
  const starSize = Math.round(24 * s)

  const words = headline.trim().split(/\s+/)
  const mid = Math.ceil(words.length / 2)
  const line1 = words.slice(0, mid).join(" ")
  const line2 = words.slice(mid).join(" ") || line1

  // Build checklist item elements
  const checklistEls = items.slice(0, 4).map((item, i) =>
    React.createElement(
      "div",
      {
        key: i,
        style: {
          position: "absolute",
          top: itemYs[i] - Math.round(circleR),
          left: 0,
          width: Math.round(450 * s),
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: Math.round(16 * s),
          paddingLeft: Math.round(25 * s),
        },
      },
      // Circle checkmark (drawn as colored bg div with ✓)
      React.createElement(
        "div",
        {
          style: {
            width: circleR * 2,
            height: circleR * 2,
            borderRadius: circleR,
            backgroundColor: bannerColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              color: "#FFFFFF",
              fontSize: Math.round(22 * s),
              fontWeight: 700,
            },
          },
          "✓"
        )
      ),
      // Text
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: checkFontSize,
            fontWeight: 700,
            fontStyle: "italic" as const,
            textShadow: `${Math.round(2 * s)}px ${Math.round(2 * s)}px ${Math.round(4 * s)}px rgba(0,0,0,0.8)`,
            flexWrap: "wrap" as const,
            maxWidth: Math.round(340 * s),
          },
        },
        item
      )
    )
  )

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
    // Headline: 2 lines centered in top bar
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: Math.round(60 * s),
          left: Math.round(40 * s),
          right: Math.round(40 * s),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: Math.round(20 * s),
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: headlineFontSize,
            fontWeight: 700,
            textTransform: "uppercase" as const,
            textAlign: "center" as const,
          },
        },
        line1
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: headlineFontSize,
            fontWeight: 700,
            textTransform: "uppercase" as const,
            textAlign: "center" as const,
          },
        },
        line2
      )
    ),
    // Checklist items
    ...checklistEls,
    // Bottom zone accent text
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          bottom: Math.round(25 * s),
          left: Math.round(50 * s),
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: Math.round(12 * s),
        },
      },
      // Trustpilot-style green stars + white CTA text
      React.createElement("div", { style: { display: "flex", color: "#00B67A", fontSize: starSize, fontWeight: 700 } }, "★★★★★"),
      React.createElement("div", { style: { display: "flex", color: "#FFFFFF", fontSize: Math.round(28 * s), fontWeight: 700 } },
        bannerText || "Subscribe and Save 20%"
      )
    )
  )

  const overlayBuf = await renderToPng(overlayEl, width, height)

  return sharp(bgBuffer)
    .composite([
      { input: productResized, left: Math.max(0, prodX), top: Math.max(0, prodY) },
      { input: overlayBuf, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}
