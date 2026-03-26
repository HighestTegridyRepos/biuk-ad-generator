import { renderTextPng } from "./text-render"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildOverlayLayers(
  sharp: any,
  width: number,
  height: number,
  headline: string,
  subhead: string | null | undefined,
  callouts: Array<{ text: string; position: { x: number; y: number } }>,
  bannerColor: string,
  bannerText: string
): Promise<Array<{ input: Buffer; left: number; top: number }>> {
  const layers: Array<{ input: Buffer; left: number; top: number }> = []
  const bannerH = Math.round(height * 0.09)
  const bannerY = height - bannerH

  const bannerBar = await sharp({
    create: { width, height: bannerH, channels: 4, background: bannerColor },
  }).png().toBuffer()
  layers.push({ input: bannerBar, left: 0, top: bannerY })

  const bannerTxt = await renderTextPng(sharp, bannerText, { fontSize: 22, bold: true, color: "white", maxWidth: width - 40 })
  layers.push({
    input: bannerTxt.buffer,
    left: Math.max(0, Math.round((width - bannerTxt.width) / 2)),
    top: Math.max(bannerY, Math.round(bannerY + (bannerH - bannerTxt.height) / 2)),
  })

  const headlineTxt = await renderTextPng(sharp, headline, { fontSize: 48, bold: true, color: "white", maxWidth: width - 80 })
  const headlineY = Math.round(height * 0.05)
  layers.push({
    input: headlineTxt.buffer,
    left: Math.max(0, Math.round((width - headlineTxt.width) / 2)),
    top: headlineY,
  })

  if (subhead) {
    const subTxt = await renderTextPng(sharp, subhead, { fontSize: 26, bold: false, color: "white", maxWidth: width - 100 })
    layers.push({
      input: subTxt.buffer,
      left: Math.max(0, Math.round((width - subTxt.width) / 2)),
      top: headlineY + headlineTxt.height + 8,
    })
  }

  for (const callout of callouts) {
    const bubbleW = 200
    const bubbleH = 80
    const cx = callout.position.x
    const cy = callout.position.y

    const bubbleBuf = await sharp({
      create: {
        width: bubbleW,
        height: bubbleH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.9 },
      },
    }).png().toBuffer()

    const bx = Math.max(0, Math.min(width - bubbleW, Math.round(cx - bubbleW / 2)))
    const by = Math.max(0, Math.min(height - bubbleH, Math.round(cy - bubbleH / 2)))
    layers.push({ input: bubbleBuf, left: bx, top: by })

    const cTxt = await renderTextPng(sharp, callout.text, { fontSize: 16, bold: true, color: "white", maxWidth: bubbleW - 20 })
    layers.push({
      input: cTxt.buffer,
      left: Math.max(0, Math.round(bx + (bubbleW - cTxt.width) / 2)),
      top: Math.max(0, Math.round(by + (bubbleH - cTxt.height) / 2)),
    })
  }

  return layers
}
