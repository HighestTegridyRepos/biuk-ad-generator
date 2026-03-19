"use client"

import { useRef, useCallback, useEffect, useState, ReactNode } from "react"

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

interface TransformBoxProps {
  selected: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  scale: number
  onMove: (pos: { x: number; y: number }) => void
  onMoveEnd?: () => void
  onResize: (rect: { x: number; y: number; width: number; height: number }) => void
  onSelect: () => void
  minSize?: { width: number; height: number }
  lockAspectRatio?: boolean
  canvasSize: { width: number; height: number }
  children: ReactNode
}

const HANDLE_SIZE = 8
const HALF = HANDLE_SIZE / 2

const CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", se: "nwse-resize",
  n: "ns-resize", s: "ns-resize", w: "ew-resize", e: "ew-resize",
}

function getHandlePositions(w: number, h: number): Record<HandleId, { left: number; top: number }> {
  return {
    nw: { left: -HALF, top: -HALF },
    n:  { left: w / 2 - HALF, top: -HALF },
    ne: { left: w - HALF, top: -HALF },
    e:  { left: w - HALF, top: h / 2 - HALF },
    se: { left: w - HALF, top: h - HALF },
    s:  { left: w / 2 - HALF, top: h - HALF },
    sw: { left: -HALF, top: h - HALF },
    w:  { left: -HALF, top: h / 2 - HALF },
  }
}

export default function TransformBox({
  selected,
  position,
  size,
  scale,
  onMove,
  onMoveEnd,
  onResize,
  onSelect,
  minSize = { width: 40, height: 20 },
  lockAspectRatio = false,
  canvasSize,
  children,
}: TransformBoxProps) {
  const [dragState, setDragState] = useState<{
    type: "move" | "resize"
    handle?: HandleId
    startMouse: { x: number; y: number }
    startRect: { x: number; y: number; width: number; height: number }
  } | null>(null)

  const boxRef = useRef<HTMLDivElement>(null)

  const screenW = size.width * scale
  const screenH = size.height * scale

  const getPointer = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    if ("clientX" in e) return { x: e.clientX, y: e.clientY }
    return { x: 0, y: 0 }
  }

  // Start move
  const handleBodyDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't start move if target is a handle
    const target = e.target as HTMLElement
    if (target.dataset.handle) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const pos = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY }
    setDragState({
      type: "move",
      startMouse: pos,
      startRect: { x: position.x, y: position.y, width: size.width, height: size.height },
    })
  }, [position, size, onSelect])

  // Start resize
  const handleHandleDown = useCallback((e: React.MouseEvent | React.TouchEvent, handle: HandleId) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const pos = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY }
    setDragState({
      type: "resize",
      handle,
      startMouse: pos,
      startRect: { x: position.x, y: position.y, width: size.width, height: size.height },
    })
  }, [position, size, onSelect])

  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      const pos = getPointer(e)
      const dx = (pos.x - dragState.startMouse.x) / scale
      const dy = (pos.y - dragState.startMouse.y) / scale
      const sr = dragState.startRect

      if (dragState.type === "move") {
        const newX = Math.max(0, Math.min(sr.x + dx, canvasSize.width - sr.width))
        const newY = Math.max(0, Math.min(sr.y + dy, canvasSize.height - sr.height))
        onMove({ x: Math.round(newX), y: Math.round(newY) })
        return
      }

      // Resize
      const h = dragState.handle!
      let newX = sr.x
      let newY = sr.y
      let newW = sr.width
      let newH = sr.height

      // Horizontal
      if (h.includes("w")) {
        newW = sr.width - dx
        newX = sr.x + dx
      } else if (h.includes("e")) {
        newW = sr.width + dx
      }

      // Vertical
      if (h.startsWith("n")) {
        newH = sr.height - dy
        newY = sr.y + dy
      } else if (h.startsWith("s")) {
        newH = sr.height + dy
      }

      // Lock aspect ratio for corners
      if (lockAspectRatio && (h === "nw" || h === "ne" || h === "sw" || h === "se")) {
        const aspect = sr.width / sr.height
        if (Math.abs(dx) > Math.abs(dy)) {
          newH = newW / aspect
          if (h.startsWith("n")) newY = sr.y + sr.height - newH
        } else {
          newW = newH * aspect
          if (h.includes("w")) newX = sr.x + sr.width - newW
        }
      }

      // Clamp to minimums
      if (newW < minSize.width) {
        if (h.includes("w")) newX = sr.x + sr.width - minSize.width
        newW = minSize.width
      }
      if (newH < minSize.height) {
        if (h.startsWith("n")) newY = sr.y + sr.height - minSize.height
        newH = minSize.height
      }

      // Clamp to canvas
      if (newX < 0) { newW += newX; newX = 0 }
      if (newY < 0) { newH += newY; newY = 0 }
      if (newX + newW > canvasSize.width) newW = canvasSize.width - newX
      if (newY + newH > canvasSize.height) newH = canvasSize.height - newY

      onResize({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(Math.max(newW, minSize.width)),
        height: Math.round(Math.max(newH, minSize.height)),
      })
    }

    const handlePointerUp = () => {
      if (dragState?.type === "move") onMoveEnd?.()
      setDragState(null)
    }

    window.addEventListener("mousemove", handlePointerMove)
    window.addEventListener("mouseup", handlePointerUp)
    window.addEventListener("touchmove", handlePointerMove, { passive: false })
    window.addEventListener("touchend", handlePointerUp)
    return () => {
      window.removeEventListener("mousemove", handlePointerMove)
      window.removeEventListener("mouseup", handlePointerUp)
      window.removeEventListener("touchmove", handlePointerMove)
      window.removeEventListener("touchend", handlePointerUp)
    }
  }, [dragState, scale, onMove, onMoveEnd, onResize, canvasSize, lockAspectRatio, minSize])

  const handles = getHandlePositions(screenW, screenH)

  return (
    <div
      ref={boxRef}
      onMouseDown={handleBodyDown}
      onTouchStart={handleBodyDown}
      className={`absolute touch-none ${dragState?.type === "move" ? "cursor-grabbing" : "cursor-move"}`}
      style={{
        left: position.x * scale,
        top: position.y * scale,
        width: screenW,
        height: screenH,
      }}
    >
      {/* Children (the actual element) */}
      <div className="h-full w-full overflow-hidden">
        {children}
      </div>

      {/* Selection border + handles */}
      {selected && (
        <>
          <div
            className="pointer-events-none absolute inset-0 border-2 border-dashed"
            style={{ borderColor: "var(--accent)" }}
          />
          {(Object.entries(handles) as [HandleId, { left: number; top: number }][]).map(
            ([id, pos]) => (
              <div
                key={id}
                data-handle={id}
                onMouseDown={(e) => handleHandleDown(e, id)}
                onTouchStart={(e) => handleHandleDown(e, id)}
                className="absolute z-10 rounded-full border border-zinc-800 bg-white hover:scale-125"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  cursor: CURSORS[id],
                }}
              />
            )
          )}
        </>
      )}
    </div>
  )
}
