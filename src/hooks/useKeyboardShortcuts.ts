"use client"

import { useEffect } from "react"

/**
 * Keyboard shortcuts for step navigation and quick actions.
 * - Enter / →: proceed to next step
 * - Escape / ←: go back
 * - 1-9: select concept/prompt/copy by index
 * - Ctrl+Z / Cmd+Z: undo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: redo
 */
export function useKeyboardShortcuts({
  onNext,
  onBack,
  onSelect,
  onUndo,
  onRedo,
}: {
  onNext?: () => void
  onBack?: () => void
  onSelect?: (index: number) => void
  onUndo?: () => void
  onRedo?: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      // Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          onRedo?.()
        } else {
          onUndo?.()
        }
        return
      }

      switch (e.key) {
        case "Enter":
        case "ArrowRight":
          if (!e.ctrlKey && !e.metaKey) onNext?.()
          break
        case "Escape":
        case "ArrowLeft":
          onBack?.()
          break
        default:
          // Number keys 1-9 for selecting items
          if (e.key >= "1" && e.key <= "9") {
            onSelect?.(parseInt(e.key) - 1)
          }
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onNext, onBack, onSelect, onUndo, onRedo])
}
