"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useProject, useDispatch, useUndo } from "@/lib/store"
import { getPreviewScale } from "@/lib/preview-scale"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import TextStylePanel from "./TextStylePanel"
import ProductImageControls from "./ProductImageControls"
import BatchPreviewGrid from "./BatchPreviewGrid"
import TransformBox from "@/components/TransformBox"

type EditingField = "headline" | "subhead" | "cta" | null

export default function ComposePage() {
  const project = useProject()
  const dispatch = useDispatch()
  const router = useRouter()
  const { undo, redo } = useUndo()
  const previewRef = useRef<HTMLDivElement>(null)

  const { width, height } = project.format
  const scale = getPreviewScale(width, height)

  const [editing, setEditing] = useState<EditingField>(null)
  const [selectedElement, setSelectedElement] = useState<"text" | "product" | null>("text")
  const editRef = useRef<HTMLDivElement>(null)

  // Text block size (defaults from store or fallback)
  const textSize = project.composition.textSize || { width: width * 0.8, height: 200 }

  // Product image from scraped data
  const productImageUrl = project.brief.productCutoutUrl || project.brief.productHeroUrl
  const productLayer = project.composition.productImage

  // Auto-enable product layer when compose loads if a product image exists but layer isn't initialized
  useEffect(() => {
    if (productImageUrl && !productLayer) {
      dispatch({
        type: "SET_PRODUCT_IMAGE",
        payload: {
          url: productImageUrl,
          position: { x: width * 0.35, y: height * 0.35 },
          scale: 0.8,
          rotation: 0,
          opacity: 1,
          visible: true,
        },
      })
    }
  }, [productImageUrl, productLayer, dispatch, width, height])

  // Auto-upgrade product layer to cutout when it becomes available
  // (e.g., async cutout generation finishes after compose already loaded with hero)
  const prevCutoutUrl = useRef(project.brief.productCutoutUrl)
  useEffect(() => {
    if (
      project.brief.productCutoutUrl &&
      project.brief.productCutoutUrl !== prevCutoutUrl.current &&
      productLayer?.visible &&
      productLayer.url === project.brief.productHeroUrl
    ) {
      dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { url: project.brief.productCutoutUrl } })
    }
    prevCutoutUrl.current = project.brief.productCutoutUrl
  }, [project.brief.productCutoutUrl, project.brief.productHeroUrl, productLayer, dispatch])

  // ── Safe zone violation detection ────────────────────────────────
  const safeZoneWarning = useMemo(() => {
    const pos = project.composition.textPosition
    const sz = project.format.safeZones
    const violations: string[] = []
    if (pos.x < sz.left) violations.push("left")
    if (pos.y < sz.top) violations.push("top")
    if (pos.x > width - sz.right - 100) violations.push("right")
    if (pos.y > height - sz.bottom - 50) violations.push("bottom")
    return violations.length > 0 ? `Text is outside safe zone (${violations.join(", ")})` : null
  }, [project.composition.textPosition, project.format.safeZones, width, height])

  // ── Inline editing ─────────────────────────────────────────────
  const startEditing = (field: EditingField) => {
    setEditing(field)
    setSelectedElement("text")
    // Focus the contentEditable after React re-renders
    setTimeout(() => editRef.current?.focus(), 0)
  }

  const finishEditing = useCallback(() => {
    if (!editing || !editRef.current) {
      setEditing(null)
      return
    }
    const newText = editRef.current.innerText.trim()
    if (!newText || !project.copy.selected) {
      setEditing(null)
      return
    }

    const updated = { ...project.copy.selected }
    if (editing === "headline") updated.headline = newText
    else if (editing === "subhead") updated.subhead = newText
    else if (editing === "cta") updated.cta = newText

    dispatch({ type: "SELECT_COPY", payload: updated })
    setEditing(null)
  }, [editing, project.copy.selected, dispatch])

  // Finish editing on Escape or Enter
  useEffect(() => {
    if (!editing) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault()
        finishEditing()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [editing, finishEditing])

  // Click outside to deselect / finish editing
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (previewRef.current && !previewRef.current.contains(e.target as Node)) {
        if (editing) finishEditing()
        setSelectedElement(null)
      }
    }
    window.addEventListener("mousedown", handleClickOutside)
    return () => window.removeEventListener("mousedown", handleClickOutside)
  }, [editing, finishEditing])

  // ── TransformBox callbacks ──────────────────────────────────────
  const handleTextMove = useCallback((pos: { x: number; y: number }) => {
    dispatch({ type: "SET_TEXT_POSITION", payload: pos })
  }, [dispatch])

  const handleTextResize = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    dispatch({ type: "SET_TEXT_POSITION", payload: { x: rect.x, y: rect.y } })
    dispatch({ type: "UPDATE_COMPOSITION", payload: { textSize: { width: rect.width, height: rect.height } } })
  }, [dispatch])

  const handleProductMove = useCallback((pos: { x: number; y: number }) => {
    dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { position: pos } })
  }, [dispatch])

  const handleProductResize = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { position: { x: rect.x, y: rect.y } } })
    // Convert width back to scale: product renders at width * 0.3 * scale
    const baseWidth = width * 0.3
    if (baseWidth > 0) {
      dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { scale: rect.width / baseWidth } })
    }
  }, [dispatch, width])

  const gradientCSS = project.composition.overlayGradient
    ? `linear-gradient(${project.composition.overlayGradient.direction}, ${project.composition.overlayGradient.from}, ${project.composition.overlayGradient.to})`
    : undefined

  const proceed = () => {
    if (editing) finishEditing()
    dispatch({ type: "SET_STEP", payload: 7 })
    router.push("/create/export")
  }

  useKeyboardShortcuts({
    onNext: project.uploadedImage.url && project.copy.selected && !editing ? proceed : undefined,
    onBack: !editing ? () => router.push("/create/copy") : undefined,
    onUndo: !editing ? undo : undefined,
    onRedo: !editing ? redo : undefined,
  })

  // Common text style helper for contrast methods
  const contrastStyles = useMemo(() => {
    const cm = project.format.contrastMethod
    return {
      textShadow: cm === "text-shadow" ? "0 2px 8px rgba(0,0,0,0.6)" : undefined,
      WebkitTextStroke: cm === "outlined-text" ? "2px rgba(0,0,0,0.5)" : undefined,
    }
  }, [project.format.contrastMethod])

  return (
    <div className="step-transition mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Step 6: Compose</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Drag to move. Double-click text to edit. Style with the panel on the right.
          </p>
        </div>
        {selectedElement && (
          <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)]">
            {selectedElement === "text" ? "Text selected" : "Product selected"}
          </span>
        )}
      </div>

      {/* Safe zone warning */}
      {safeZoneWarning && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          {safeZoneWarning} — some platforms may crop this area
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* ── Canvas Preview ──────────────────────────────────────── */}
        <div className="flex justify-center">
          <div
            ref={previewRef}
            className="relative overflow-hidden rounded-lg border border-zinc-700"
            style={{ width: width * scale, height: height * scale }}
            onClick={() => {
              if (editing) finishEditing()
              setSelectedElement(null)
            }}
          >
            {/* Background Image */}
            {project.uploadedImage.url && (
              <img
                src={project.uploadedImage.url}
                alt="Ad background"
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            )}

            {/* Gradient Overlay */}
            {gradientCSS && (
              <div className="absolute inset-0" style={{ background: gradientCSS }} />
            )}

            {/* Product Image Layer */}
            {productLayer?.visible && productLayer.url && (() => {
              const prodW = width * 0.3 * productLayer.scale
              const prodH = prodW // approximate square; actual aspect handled by object-contain
              return (
                <TransformBox
                  selected={selectedElement === "product"}
                  position={productLayer.position}
                  size={{ width: prodW, height: prodH }}
                  scale={scale}
                  onMove={handleProductMove}
                  onResize={handleProductResize}
                  onSelect={() => { setSelectedElement("product"); if (editing) finishEditing() }}
                  lockAspectRatio
                  canvasSize={{ width, height }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: `rotate(${productLayer.rotation || 0}deg)`,
                      transformOrigin: "center center",
                      opacity: productLayer.opacity,
                    }}
                  >
                    <img
                      src={productLayer.url}
                      alt="Product"
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </TransformBox>
              )
            })()}

            {/* Safe Zones Indicator */}
            <div
              className="pointer-events-none absolute border border-dashed border-red-500/40 bg-red-500/5"
              style={{
                top: project.format.safeZones.top * scale,
                left: project.format.safeZones.left * scale,
                width: (width - project.format.safeZones.left - project.format.safeZones.right) * scale,
                height: (height - project.format.safeZones.top - project.format.safeZones.bottom) * scale,
              }}
            />

            {/* Empty state */}
            {!project.copy.selected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-lg bg-zinc-900/80 px-4 py-2 text-sm text-zinc-400">
                  No copy selected — go back to Step 5
                </p>
              </div>
            )}

            {/* ── Text Overlay (TransformBox + inline-editable) ──── */}
            {project.copy.selected && (
              <TransformBox
                selected={selectedElement === "text"}
                position={project.composition.textPosition}
                size={textSize}
                scale={scale}
                onMove={handleTextMove}
                onResize={handleTextResize}
                onSelect={() => setSelectedElement("text")}
                canvasSize={{ width, height }}
                minSize={{ width: 80, height: 40 }}
              >
              <div className={`${editing ? "" : ""}`} style={{ width: textSize.width * scale }}>
                {/* Solid block contrast */}
                {project.format.contrastMethod === "solid-block" && (
                  <div
                    className="pointer-events-none absolute rounded-lg"
                    style={{
                      background: "rgba(0,0,0,0.7)",
                      inset: `${-12 * scale}px ${-16 * scale}px`,
                    }}
                  />
                )}

                <div className="relative">
                  {/* ── Headline (double-click to edit) ── */}
                  {editing === "headline" ? (
                    <div
                      ref={editRef}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={finishEditing}
                      className="cursor-text outline-none ring-1 ring-[var(--accent)]"
                      style={{
                        fontSize: project.composition.headlineFontSize * scale,
                        fontFamily: project.composition.headlineFontFamily,
                        fontWeight: project.composition.headlineFontWeight,
                        color: project.composition.headlineColor,
                        textAlign: project.composition.headlineAlign,
                        lineHeight: 1.1,
                        ...contrastStyles,
                        minWidth: 40,
                      }}
                      dangerouslySetInnerHTML={{ __html: project.copy.selected.headline }}
                    />
                  ) : (
                    <p
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startEditing("headline")
                      }}
                      className="cursor-text"
                      title="Double-click to edit"
                      style={{
                        fontSize: project.composition.headlineFontSize * scale,
                        fontFamily: project.composition.headlineFontFamily,
                        fontWeight: project.composition.headlineFontWeight,
                        color: project.composition.headlineColor,
                        textAlign: project.composition.headlineAlign,
                        lineHeight: 1.1,
                        ...contrastStyles,
                      }}
                    >
                      {project.copy.selected.headline}
                    </p>
                  )}

                  {/* ── Subhead (double-click to edit) ── */}
                  {project.copy.selected.subhead != null && (
                    editing === "subhead" ? (
                      <div
                        ref={editRef}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={finishEditing}
                        className="cursor-text outline-none ring-1 ring-[var(--accent)]"
                        style={{
                          fontSize: (project.composition.subheadFontSize || 28) * scale,
                          color: project.composition.subheadColor || "#cccccc",
                          fontFamily: project.composition.headlineFontFamily,
                          fontWeight: 400,
                          textAlign: project.composition.headlineAlign,
                          marginTop: 4 * scale,
                          ...contrastStyles,
                          minWidth: 40,
                        }}
                        dangerouslySetInnerHTML={{ __html: project.copy.selected.subhead || "" }}
                      />
                    ) : (
                      <p
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          startEditing("subhead")
                        }}
                        className="cursor-text"
                        title="Double-click to edit"
                        style={{
                          fontSize: (project.composition.subheadFontSize || 28) * scale,
                          color: project.composition.subheadColor || "#cccccc",
                          fontFamily: project.composition.headlineFontFamily,
                          fontWeight: 400,
                          textAlign: project.composition.headlineAlign,
                          marginTop: 4 * scale,
                          textShadow: contrastStyles.textShadow,
                        }}
                      >
                        {project.copy.selected.subhead}
                      </p>
                    )
                  )}

                  {/* ── CTA Button (double-click to edit) ── */}
                  {editing === "cta" ? (
                    <div
                      ref={editRef}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={finishEditing}
                      className="cursor-text outline-none ring-1 ring-[var(--accent)]"
                      style={{
                        marginTop: 12 * scale,
                        display: "inline-block",
                        backgroundColor: project.composition.ctaStyle.backgroundColor,
                        color: project.composition.ctaStyle.textColor,
                        borderRadius: project.composition.ctaStyle.borderRadius * scale,
                        paddingLeft: project.composition.ctaStyle.padding.x * scale,
                        paddingRight: project.composition.ctaStyle.padding.x * scale,
                        paddingTop: project.composition.ctaStyle.padding.y * scale,
                        paddingBottom: project.composition.ctaStyle.padding.y * scale,
                        fontSize: project.composition.ctaStyle.fontSize * scale,
                        fontWeight: 700,
                        minWidth: 40,
                      }}
                      dangerouslySetInnerHTML={{ __html: project.copy.selected.cta }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startEditing("cta")
                      }}
                      className="cursor-text"
                      title="Double-click to edit"
                      style={{
                        marginTop: 12 * scale,
                        display: "inline-block",
                        backgroundColor: project.composition.ctaStyle.backgroundColor,
                        color: project.composition.ctaStyle.textColor,
                        borderRadius: project.composition.ctaStyle.borderRadius * scale,
                        paddingLeft: project.composition.ctaStyle.padding.x * scale,
                        paddingRight: project.composition.ctaStyle.padding.x * scale,
                        paddingTop: project.composition.ctaStyle.padding.y * scale,
                        paddingBottom: project.composition.ctaStyle.padding.y * scale,
                        fontSize: project.composition.ctaStyle.fontSize * scale,
                        fontWeight: 700,
                      }}
                    >
                      {project.copy.selected.cta}
                    </div>
                  )}
                </div>
              </div>
              </TransformBox>
            )}
          </div>
        </div>

        {/* ── Controls Panel ──────────────────────────────────────── */}
        <div className="space-y-5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          <TextStylePanel />
          <ProductImageControls />

          <div className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-500">
            <p>Position: {project.composition.textPosition.x}, {project.composition.textPosition.y}</p>
            <p>Canvas: {width}x{height}</p>
            <p className="mt-1 text-zinc-600">Tip: Double-click text on canvas to edit inline</p>
          </div>
        </div>
      </div>

      <BatchPreviewGrid />

      {/* Navigation */}
      <div className="mt-10 flex justify-between">
        <button onClick={() => router.push("/create/copy")}
          className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800">
          &larr; Back
        </button>
        <button onClick={proceed}
          disabled={!project.uploadedImage.url || !project.copy.selected}
          className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40">
          Next: Export &rarr;
        </button>
      </div>
    </div>
  )
}
