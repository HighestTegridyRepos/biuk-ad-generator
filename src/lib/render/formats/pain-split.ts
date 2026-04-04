/**
 * pain-split renderer
 * Dark (#1A1A1A) bg, 2-column: left=2 stacked problem photos, right=product.
 * Top: 2-line headline (cream + bannerColor).
 * Bottom: bannerColor banner, black stars + "SUBSCRIBE & SAVE 20%".
 */
import React from "react"
import { FormatConfig, FormatRenderer, fetchBuf, renderToPng } from "./satori-helpers"

export const renderPainSplit: FormatRenderer = async (cfg: FormatConfig): Promise<Buffer> => {
  const { width, height, productImageBuffer, headline, bannerColor, bannerText, problemPhotos } = cfg
  const s = width / 1080

  // Layout constants (all at 1080 base)
  const headlineH = 175
  const bannerH = 85
  const bannerY = height - bannerH
  const contentTop = Math.round(headlineH * s)
  const contentH = bannerY - contentTop
  const leftW = Math.round(595 * s)      // 55% of 1080
  const photoGap = Math.round(15 * s)
  const photoRadius = Math.round(15 * s)
  const photoPadLeft = Math.round(25 * s)
  const photoPadTop = Math.round(10 * s)
  const photoW = leftW - photoPadLeft - Math.round(15 * s)
  const photoH1 = Math.round((contentH - photoGap - photoPadTop * 2) * 0.51)
  const photoH2 = contentH - photoGap - photoPadTop * 2 - photoH1

  // Import sharp for compositing
  const { default: sharp } = await import("sharp")

  // 1. Build background: solid dark
  const bgBuffer = await sharp({
    create: { width, height, channels: 4, background: { r: 26, g: 26, b: 26, alpha: 1 } },
  }).png().toBuffer()

  // 2. Fetch and resize problem photos
  const photo1Url = problemPhotos?.[0] ?? ""
  const photo2Url = problemPhotos?.[1] ?? photo1Url

  let photo1Buf: Buffer | null = null
  let photo2Buf: Buffer | null = null
  if (photo1Url) {
    try {
      const raw = await fetchBuf(photo1Url)
      photo1Buf = await sharp(raw)
        .resize(photoW, photoH1, { fit: "cover" })
        .png()
        .toBuffer()
    } catch { photo1Buf = null }
  }
  if (photo2Url) {
    try {
      const raw = photo2Url === photo1Url ? (photo1Buf ?? await fetchBuf(photo2Url)) : await fetchBuf(photo2Url)
      photo2Buf = await sharp(raw instanceof Buffer ? raw : raw)
        .resize(photoW, photoH2, { fit: "cover" })
        .png()
        .toBuffer()
    } catch { photo2Buf = null }
  }

  // 3. Resize product for right column
  const rightColX = leftW
  const rightColW = width - leftW
  // Product: ~30%W × 69%H per ground truth, centered in right column
  const productMaxH = Math.round(contentH * 0.90)
  const productMaxW = Math.round(rightColW * 0.75)

  const prodMeta = await sharp(productImageBuffer).metadata()
  const prodAspect = (prodMeta.height ?? 1) / (prodMeta.width ?? 1)
  let prodFitW = productMaxW
  let prodFitH = Math.round(prodFitW * prodAspect)
  if (prodFitH > productMaxH) { prodFitH = productMaxH; prodFitW = Math.round(prodFitH / prodAspect) }

  const productResized = await sharp(productImageBuffer)
    .resize(prodFitW, prodFitH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const productX = rightColX + Math.round((rightColW - prodFitW) / 2)
  const productY = contentTop + Math.round((contentH - prodFitH) / 2)

  // 4. Build text overlay: headline + banner
  // Split headline into 2 lines on word boundary
  const words = headline.trim().split(/\s+/)
  const mid = Math.ceil(words.length / 2)
  const line1 = words.slice(0, mid).join(" ")
  const line2 = words.slice(mid).join(" ") || line1

  const headlineFontSize = Math.round(72 * s)
  const bannerFontSize = Math.round(40 * s)
  const bannerStarSize = Math.round(28 * s)

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
    // Headline zone
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: contentTop,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: Math.round(10 * s),
          paddingBottom: Math.round(5 * s),
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            color: "#F5E6C8",
            fontSize: headlineFontSize,
            fontWeight: 700,
            lineHeight: 1.1,
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
            color: bannerColor,
            fontSize: headlineFontSize,
            fontWeight: 700,
            lineHeight: 1.1,
            textTransform: "uppercase" as const,
            textAlign: "center" as const,
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
          justifyContent: "center",
          gap: Math.round(12 * s),
        },
      },
      ...(bannerText
        ? [React.createElement("div", { style: { display: "flex", color: "#000000", fontSize: Math.round(30 * s), fontWeight: 700, textTransform: "uppercase" as const } }, bannerText)]
        : [
            React.createElement("div", { style: { display: "flex", color: "#000000", fontSize: bannerStarSize, fontWeight: 700 } }, "★★★★★"),
            React.createElement("div", { style: { display: "flex", color: "#000000", fontSize: bannerFontSize, fontWeight: 700, letterSpacing: Math.round(1 * s), textTransform: "uppercase" as const } }, "SUBSCRIBE & SAVE 20%")
          ]
      )
    )
  )

  const overlayBuf = await renderToPng(overlayEl, width, height)

  // 5. Composite: bg + photos + product + overlay
  const layers: Array<{ input: Buffer; left: number; top: number }> = []

  if (photo1Buf) {
    layers.push({ input: photo1Buf, left: photoPadLeft, top: contentTop + photoPadTop })
  }
  if (photo2Buf) {
    layers.push({ input: photo2Buf, left: photoPadLeft, top: contentTop + photoPadTop + photoH1 + photoGap })
  }
  layers.push({ input: productResized, left: productX, top: productY })
  layers.push({ input: overlayBuf, left: 0, top: 0 })

  return sharp(bgBuffer).composite(layers).png().toBuffer()
}
