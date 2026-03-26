import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import path from "path"
import fs from "fs"
import React from "react"

let fontBuffer: ArrayBuffer | null = null

function loadFont(): ArrayBuffer {
  if (fontBuffer) return fontBuffer
  const candidates = [
    path.join(process.cwd(), "src", "fonts", "Inter-Bold.ttf"),
    path.join(process.cwd(), "fonts", "Inter-Bold.ttf"),
    path.join(process.cwd(), "public", "Inter-Bold.ttf"),
    "/tmp/fonts/Inter-Bold.ttf",
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p)
      fontBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      return fontBuffer
    }
  }
  throw new Error("Inter-Bold.ttf not found in any candidate path")
}

export async function renderTextPng(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sharp: any,
  text: string,
  opts: { fontSize?: number; bold?: boolean; color?: string; maxWidth?: number; align?: string }
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const sz = opts.fontSize ?? 32
  const color = opts.color ?? "white"
  const align = (opts.align ?? "center") as "center" | "left" | "right"
  const maxWidth = opts.maxWidth ?? 900
  const font = loadFont()

  const justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"

  const element = (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent,
      textAlign: align,
      fontSize: sz,
      fontFamily: "Inter",
      fontWeight: opts.bold !== false ? 700 : 400,
      color,
      width: "100%",
      padding: "4px 8px",
      lineHeight: 1.2,
    }}>
      {text}
    </div>
  )

  const svg = await satori(element, {
    width: maxWidth,
    fonts: [
      {
        name: "Inter",
        data: font,
        weight: 700,
        style: "normal" as const,
      },
    ],
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: maxWidth },
    background: "rgba(0,0,0,0)",
  })
  const rendered = resvg.render()
  const pngBuffer = rendered.asPng()

  return { buffer: Buffer.from(pngBuffer), width: rendered.width, height: rendered.height }
}
