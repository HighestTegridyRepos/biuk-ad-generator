export interface GuideLine {
  axis: "x" | "y"
  position: number
}

/**
 * Calculate snap guides for alignment when dragging elements.
 * Returns adjusted positions if snapping occurred, plus guide lines to render.
 */
export function getSnapGuides(
  elementRect: { x: number; y: number; width: number; height: number },
  canvasSize: { width: number; height: number },
  safeZones: { top: number; bottom: number; left: number; right: number },
  threshold = 5
): { snappedX?: number; snappedY?: number; guides: GuideLine[] } {
  const guides: GuideLine[] = []
  let snappedX: number | undefined
  let snappedY: number | undefined

  const elCenterX = elementRect.x + elementRect.width / 2
  const elCenterY = elementRect.y + elementRect.height / 2
  const canvasCenterX = canvasSize.width / 2
  const canvasCenterY = canvasSize.height / 2

  // Vertical center (element center aligns with canvas center)
  if (Math.abs(elCenterX - canvasCenterX) < threshold) {
    snappedX = canvasCenterX - elementRect.width / 2
    guides.push({ axis: "x", position: canvasCenterX })
  }

  // Horizontal center
  if (Math.abs(elCenterY - canvasCenterY) < threshold) {
    snappedY = canvasCenterY - elementRect.height / 2
    guides.push({ axis: "y", position: canvasCenterY })
  }

  // Safe zone edges
  // Left edge
  if (Math.abs(elementRect.x - safeZones.left) < threshold) {
    snappedX = safeZones.left
    guides.push({ axis: "x", position: safeZones.left })
  }
  // Right edge
  const safeRight = canvasSize.width - safeZones.right
  if (Math.abs(elementRect.x + elementRect.width - safeRight) < threshold) {
    snappedX = safeRight - elementRect.width
    guides.push({ axis: "x", position: safeRight })
  }
  // Top edge
  if (Math.abs(elementRect.y - safeZones.top) < threshold) {
    snappedY = safeZones.top
    guides.push({ axis: "y", position: safeZones.top })
  }
  // Bottom edge
  const safeBottom = canvasSize.height - safeZones.bottom
  if (Math.abs(elementRect.y + elementRect.height - safeBottom) < threshold) {
    snappedY = safeBottom - elementRect.height
    guides.push({ axis: "y", position: safeBottom })
  }

  return { snappedX, snappedY, guides }
}
