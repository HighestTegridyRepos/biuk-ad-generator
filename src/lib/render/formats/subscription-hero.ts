/**
 * subscription-hero renderer
 * bannerColor top bar (~200px) with bold italic 2-line headline.
 * Full-bleed photo below bar.
 * Optional subheadline over photo left.
 * Product right side (x: 620–980).
 * Bottom banner: same color, stars + CTA.
 */
import React from "react"
import { FormatConfig, FormatRenderer, fetchBuf, renderToPng } from "./satori-helpers"

export const renderSubscriptionHero: FormatRenderer = async (cfg: FormatConfig): Promise<Buffer> => {
  const {
    width, height, productImageBuffer, headline, bannerColor, bannerText,
    backgroundPhoto, subheadline,
  } = cfg
  const s = width / 1080

  const { default: sharp } = await import("sharp")

  // Layout
  const topBarH = Math.round(200 * s)
  const bannerH = Math.round(100 * s)
  const bannerY = height - bannerH

  // Product zone: right side x:620–980, y:280–920
  const prodZoneX1 = Math.round(600 * s)
  const prodZoneX2 = Math.round(1000 * s)
  const prodZoneY1 = Math.round(100 * s)
  const prodZoneY2 = Math.round(980 * s)
  const prodZoneW = prodZoneX2 - prodZoneX1
  const prodZoneH = prodZoneY2 - prodZoneY1

  // 1. Background
  let photoBuf: Buffer | null = null
  if (backgroundPhoto) {
    try {
      const raw = await fetchBuf(backgroundPhoto)
      photoBuf = await sharp(raw).resize(width, height, { fit: "cover" }).png().toBuffer()
    } catch { photoBuf = null }
  }

  const bgBase = photoBuf ?? await sharp({
    create: { width, height, channels: 4, background: { r: 50, g: 50, b: 50, alpha: 1 } },
  }).png().toBuffer()

  // Top bar overlay strip
  const [tr, tg, tb] = hexToRgb(bannerColor)
  const topBarBuf = await sharp({
    create: { width, height: topBarH, channels: 4, background: { r: tr, g: tg, b: tb, alpha: 1 } },
  }).png().toBuffer()

  const bgBuffer = await sharp(bgBase)
    .composite([{ input: topBarBuf, left: 0, top: 0 }])
    .png()
    .toBuffer()

  // 2. Product
  const prodMeta = await sharp(productImageBuffer).metadata()
  const prodAspect = (prodMeta.height ?? 1) / (prodMeta.width ?? 1)
  let prodW = prodZoneW
  let prodH = Math.round(prodW * prodAspect)
  if (prodH > prodZoneH) { prodH = prodZoneH; prodW = Math.round(prodH / prodAspect) }

  const productResized = await sharp(productImageBuffer)
    .resize(prodW, prodH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const prodX = prodZoneX1 + Math.round((prodZoneW - prodW) / 2)
  const prodY = prodZoneY1 + Math.round((prodZoneH - prodH) / 2)

  // 3. Text overlay
  const subheadFontSize = Math.round(58 * s)
  const bannerFontSize = Math.round(45 * s)
  const starSize = Math.round(40 * s)

  // Use \n for explicit line breaks, otherwise let satori wrap naturally
  const hasExplicitBreaks = headline.includes("\n")

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
    // Headline inside top bar — single text block, satori handles wrapping
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: Math.round(15 * s),
          left: Math.round(45 * s),
          width: Math.round(600 * s),
          height: Math.round(170 * s),
          display: "flex",
          alignItems: "center",
        },
      },
      hasExplicitBreaks
        ? React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column" as const,
                gap: Math.round(2 * s),
              },
            },
            ...headline.split("\n").map((line: string, i: number) =>
              React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    display: "flex",
                    color: "#FFFFFF",
                    fontSize: Math.round(68 * s),
                    fontWeight: 700,
                    fontStyle: "italic" as const,
                    lineHeight: 1.0,
                    textTransform: "uppercase" as const,
                  },
                },
                line.trim()
              )
            )
          )
        : React.createElement(
            "div",
            {
              style: {
                display: "flex",
                color: "#FFFFFF",
                fontSize: Math.round(56 * s),
                fontWeight: 700,
                fontStyle: "italic" as const,
                lineHeight: 1.1,
                textTransform: "uppercase" as const,
              },
            },
            headline
          )
    ),
    // Subheadline over photo
    subheadline ? React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: Math.round(280 * s),
          left: Math.round(45 * s),
          display: "flex",
          maxWidth: Math.round(500 * s),
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#FFFFFF",
            fontSize: subheadFontSize,
            fontWeight: 700,
            fontStyle: "italic" as const,
            textShadow: `0 ${Math.round(3 * s)}px ${Math.round(6 * s)}px rgba(0,0,0,0.6)`,
          },
        },
        subheadline
      )
    ) : null,
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
          paddingLeft: Math.round(45 * s),
          gap: Math.round(20 * s),
        },
      },
      // If bannerText includes stars, render as single element. Otherwise add stars separately.
      ...(bannerText
        ? [React.createElement("div", { style: { display: "flex", color: "#FFFFFF", fontSize: Math.round(36 * s), fontWeight: 700 } }, bannerText)]
        : [
            React.createElement("div", { style: { display: "flex", color: "#FFFFFF", fontSize: starSize, fontWeight: 700 } }, "★★★★★"),
            React.createElement("div", { style: { display: "flex", color: "#FFFFFF", fontSize: bannerFontSize, fontWeight: 700 } }, "Subscribe and Save 20%")
          ]
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}
