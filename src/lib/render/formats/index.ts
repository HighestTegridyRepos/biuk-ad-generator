/**
 * Format renderer registry
 * Maps format name → renderer function
 */
export type FormatName =
  | "pain-split"
  | "pain-hero"
  | "before-after"
  | "before-after-extended"
  | "subscription-hero"
  | "features-checklist"

export const FORMAT_NAMES: FormatName[] = [
  "pain-split",
  "pain-hero",
  "before-after",
  "before-after-extended",
  "subscription-hero",
  "features-checklist",
]

export function isValidFormat(f: string): f is FormatName {
  return FORMAT_NAMES.includes(f as FormatName)
}

export type { FormatConfig, FormatRenderer } from "./satori-helpers"

import { renderPainSplit } from "./pain-split"
import { renderPainHero } from "./pain-hero"
import { renderBeforeAfter } from "./before-after"
import { renderBeforeAfterExtended } from "./before-after-extended"
import { renderSubscriptionHero } from "./subscription-hero"
import { renderFeaturesChecklist } from "./features-checklist"
import type { FormatRenderer } from "./satori-helpers"

const REGISTRY: Record<FormatName, FormatRenderer> = {
  "pain-split": renderPainSplit,
  "pain-hero": renderPainHero,
  "before-after": renderBeforeAfter,
  "before-after-extended": renderBeforeAfterExtended,
  "subscription-hero": renderSubscriptionHero,
  "features-checklist": renderFeaturesChecklist,
}

export function getFormatRenderer(format: FormatName): FormatRenderer {
  const renderer = REGISTRY[format]
  if (!renderer) throw new Error(`Unknown format: ${format}`)
  return renderer
}
