import { Rect, SafeZones } from "@/types/ad"

export interface LayoutTemplate {
  id: string
  name: string
  description: string
  getZones: (w: number, h: number, sz: SafeZones) => {
    anchorZone: Rect
    messageZone: Rect
  }
}

export const layoutTemplates: LayoutTemplate[] = [
  {
    id: "top-text",
    name: "Top Text",
    description: "Message top 1/3, Anchor bottom 2/3",
    getZones: (w, h, sz) => ({
      anchorZone: { x: 0, y: h * 0.33, width: w, height: h * 0.67 },
      messageZone: { x: sz.left, y: sz.top, width: w - sz.left - sz.right, height: h * 0.28 },
    }),
  },
  {
    id: "bottom-text",
    name: "Bottom Text",
    description: "Anchor top 2/3, Message bottom 1/3",
    getZones: (w, h, sz) => ({
      anchorZone: { x: 0, y: 0, width: w, height: h * 0.67 },
      messageZone: { x: sz.left, y: h * 0.67, width: w - sz.left - sz.right, height: h * 0.28 },
    }),
  },
  {
    id: "left-column",
    name: "Left Column",
    description: "Message left 1/3, Anchor right 2/3",
    getZones: (w, h, sz) => ({
      anchorZone: { x: w * 0.35, y: 0, width: w * 0.65, height: h },
      messageZone: { x: sz.left, y: sz.top, width: w * 0.3, height: h - sz.top - sz.bottom },
    }),
  },
  {
    id: "right-column",
    name: "Right Column",
    description: "Anchor left 2/3, Message right 1/3",
    getZones: (w, h, sz) => ({
      anchorZone: { x: 0, y: 0, width: w * 0.65, height: h },
      messageZone: { x: w * 0.65 + sz.left, y: sz.top, width: w * 0.3, height: h - sz.top - sz.bottom },
    }),
  },
  {
    id: "center-overlay",
    name: "Center Overlay",
    description: "Anchor full bleed, Message centered with backdrop",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getZones: (w, h, _sz) => ({
      anchorZone: { x: 0, y: 0, width: w, height: h },
      messageZone: { x: w * 0.15, y: h * 0.35, width: w * 0.7, height: h * 0.3 },
    }),
  },
  {
    id: "before-after-quad",
    name: "Before/After Quad",
    description: "Header text, 2x2 before/after image grid with centered product overlay, social proof banner",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getZones: (w, h, _sz) => ({
      anchorZone: { x: 0, y: Math.round(h * 0.22), width: w, height: Math.round(h * 0.65) },
      messageZone: { x: Math.round(w * 0.05), y: Math.round(h * 0.02), width: Math.round(w * 0.90), height: Math.round(h * 0.18) },
    }),
  },
  {
    id: "checklist",
    name: "Checklist",
    description: "Product showcase with circular scene thumbnails, checkmarks, and accent banner",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getZones: (w, h, _sz) => ({
      anchorZone: { x: Math.round(w * 0.45), y: Math.round(h * 0.15), width: Math.round(w * 0.55), height: Math.round(h * 0.76) },
      messageZone: { x: Math.round(w * 0.05), y: 0, width: Math.round(w * 0.90), height: Math.round(h * 0.15) },
    }),
  },
  {
    id: "corner-badge",
    name: "Corner Badge",
    description: "Anchor full bleed, Message bottom-left corner",
    getZones: (w, h, sz) => ({
      anchorZone: { x: 0, y: 0, width: w, height: h },
      messageZone: { x: sz.left, y: h * 0.7, width: w * 0.5, height: h * 0.2 },
    }),
  },
]

export function getMessageZonePosition(messageZone: Rect, width: number, height: number): string {
  const centerX = messageZone.x + messageZone.width / 2
  const centerY = messageZone.y + messageZone.height / 2

  const vertical = centerY < height / 3 ? "top" : centerY > (height * 2) / 3 ? "bottom" : "middle"
  const horizontal = centerX < width / 3 ? "left" : centerX > (width * 2) / 3 ? "right" : "center"

  if (vertical === "top") return "top third"
  if (vertical === "bottom") return "bottom third"
  if (horizontal === "left") return "left column"
  if (horizontal === "right") return "right column"
  return "center"
}
