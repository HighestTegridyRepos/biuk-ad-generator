import { ensureFontConfig, escapeXml } from "./font-config"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function renderTextPng(
  sharp: any,
  text: string,
  opts: { fontSize?: number; bold?: boolean; color?: string; maxWidth?: number; align?: string }
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const sz = opts.fontSize ?? 32
  const bold = opts.bold !== false ? "bold" : "normal"
  const color = opts.color ?? "white"
  const align = opts.align ?? "center"
  const escaped = escapeXml(text)
  ensureFontConfig()
  const pango = `<span foreground="${color}" font_weight="${bold}" font="Inter ${sz}">${escaped}</span>`
  const img = sharp({
    text: {
      text: pango,
      rgba: true,
      dpi: 150,
      width: opts.maxWidth ?? 900,
      align: align as string,
    },
  })
  const buf = await img.png().toBuffer()
  const meta = await sharp(buf).metadata()
  return { buffer: buf, width: meta.width ?? 0, height: meta.height ?? 0 }
}
