/**
 * Shared satori + resvg helpers for format renderers.
 * All text on Vercel serverless MUST go through this — no other approach works.
 */
import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import path from "path"
import fs from "fs"
import React from "react"

let _fontBuffer: ArrayBuffer | null = null

export function loadFont(): ArrayBuffer {
  if (_fontBuffer) return _fontBuffer
  const fontPath = path.join(process.cwd(), "src", "fonts", "Inter-Bold.ttf")
  if (!fs.existsSync(fontPath)) throw new Error(`Inter-Bold.ttf not found at ${fontPath}`)
  const buf = fs.readFileSync(fontPath)
  _fontBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return _fontBuffer
}

/** Render a React element to a PNG buffer via satori+resvg */
export async function renderToPng(
  element: React.ReactElement,
  width: number,
  height: number
): Promise<Buffer> {
  const font = loadFont()
  const svg = await satori(element, {
    width,
    height,
    fonts: [
      { name: "Inter", data: font, weight: 700, style: "normal" as const },
      { name: "Inter", data: font, weight: 400, style: "normal" as const },
    ],
  })
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: width },
    background: "rgba(0,0,0,0)",
  })
  const rendered = resvg.render()
  return Buffer.from(rendered.asPng())
}

/** Standard config passed to every format renderer */
export interface FormatConfig {
  width: number
  height: number
  productImageBuffer: Buffer   // transparent PNG cutout
  headline: string
  bannerColor: string
  bannerText: string
  // format-specific optional fields
  problemPhotos?: string[]         // pain-split: 2 photo URLs
  beforePhoto?: string             // before-after formats
  afterPhoto?: string              // before-after formats
  backgroundPhoto?: string         // pain-hero, subscription-hero, features-checklist
  accentText?: { line1: string; line2: string }  // before-after-extended
  subheadline?: string             // before-after-extended, subscription-hero
  checklistItems?: string[]        // features-checklist
  badgeText?: string               // before-after: circle badge text
}

/** Each format renderer returns a final 1080×1080 PNG buffer */
export type FormatRenderer = (config: FormatConfig) => Promise<Buffer>

/** Fetch a URL to a Buffer */
export async function fetchBuf(url: string): Promise<Buffer> {
  // Handle data: URLs directly (from AI-generated images)
  if (url.startsWith("data:")) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/)
    if (match) return Buffer.from(match[1], "base64")
    throw new Error("Invalid data URL format")
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`fetchBuf ${url} → ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Stars string helper */
export function stars(n = 5): string {
  return "★".repeat(n)
}
