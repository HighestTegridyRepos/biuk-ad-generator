"use client"

import { useMemo } from "react"
import { useProject } from "@/lib/store"

export default function BatchPreviewGrid() {
  const project = useProject()

  const { width, height } = project.format
  const productLayer = project.composition.productImage

  const gradientCSS = project.composition.overlayGradient
    ? `linear-gradient(${project.composition.overlayGradient.direction}, ${project.composition.overlayGradient.from}, ${project.composition.overlayGradient.to})`
    : undefined

  const contrastStyles = useMemo(() => {
    const cm = project.format.contrastMethod
    return {
      textShadow: cm === "text-shadow" ? "0 2px 8px rgba(0,0,0,0.6)" : undefined,
      WebkitTextStroke: cm === "outlined-text" ? "2px rgba(0,0,0,0.5)" : undefined,
    }
  }, [project.format.contrastMethod])

  if (project.batch.images.length !== 2 || project.batch.copies.length !== 2) return null

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">Your 2x2 Batch Preview</h2>
      <p className="mt-1 text-sm text-zinc-400">
        2 images &times; 2 headlines = 4 ads. Your edits above apply to all 4.
      </p>
      <div className="mt-4 grid max-w-2xl mx-auto grid-cols-2 gap-4">
        {project.batch.images.map((batchImg, imgIdx) =>
          project.batch.copies.map((batchCopy, copyIdx) => {
            const comboIdx = imgIdx * 2 + copyIdx
            const isEditing = imgIdx === 0 && copyIdx === 0
            const miniScale = Math.min(200 / width, 200 / height)
            return (
              <div key={`${imgIdx}-${copyIdx}`} className={`relative w-full overflow-hidden rounded-lg border-2 ${isEditing ? "border-[var(--accent)]" : "border-zinc-700"}`}
                style={{ aspectRatio: `${width}/${height}`, maxWidth: width * miniScale, maxHeight: height * miniScale }}>
                {/* Background */}
                {batchImg.url && (
                  <img src={batchImg.url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                )}
                {/* Gradient */}
                {gradientCSS && <div className="absolute inset-0" style={{ background: gradientCSS }} />}
                {/* Product image */}
                {productLayer?.visible && productLayer.url && (
                  <div className="absolute" style={{
                    left: productLayer.position.x * miniScale,
                    top: productLayer.position.y * miniScale,
                    width: `${productLayer.scale * 30}%`,
                    transform: `rotate(${productLayer.rotation || 0}deg)`,
                    opacity: productLayer.opacity,
                  }}>
                    <img src={productLayer.url} alt="" className="h-auto w-full object-contain" />
                  </div>
                )}
                {/* Text overlay */}
                <div className="absolute" style={{
                  left: project.composition.textPosition.x * miniScale,
                  top: project.composition.textPosition.y * miniScale,
                  maxWidth: (project.composition.textSize?.width || width * 0.8) * miniScale,
                }}>
                  {project.format.contrastMethod === "solid-block" && (
                    <div className="pointer-events-none absolute rounded" style={{
                      background: "rgba(0,0,0,0.7)",
                      inset: `${-4 * miniScale}px ${-6 * miniScale}px`,
                    }} />
                  )}
                  <div className="relative">
                    <p style={{
                      fontSize: project.composition.headlineFontSize * miniScale,
                      fontFamily: project.composition.headlineFontFamily,
                      fontWeight: project.composition.headlineFontWeight,
                      color: project.composition.headlineColor,
                      textAlign: project.composition.headlineAlign,
                      lineHeight: 1.1,
                      ...contrastStyles,
                    }}>
                      {batchCopy.headline}
                    </p>
                    {batchCopy.subhead && (
                      <p style={{
                        fontSize: (project.composition.subheadFontSize || 28) * miniScale,
                        color: project.composition.subheadColor || "#cccccc",
                        fontFamily: project.composition.headlineFontFamily,
                        marginTop: 2 * miniScale,
                      }}>
                        {batchCopy.subhead}
                      </p>
                    )}
                    <div style={{
                      marginTop: 4 * miniScale,
                      display: "inline-block",
                      backgroundColor: project.composition.ctaStyle.backgroundColor,
                      color: project.composition.ctaStyle.textColor,
                      borderRadius: project.composition.ctaStyle.borderRadius * miniScale,
                      paddingLeft: project.composition.ctaStyle.padding.x * miniScale,
                      paddingRight: project.composition.ctaStyle.padding.x * miniScale,
                      paddingTop: project.composition.ctaStyle.padding.y * miniScale,
                      paddingBottom: project.composition.ctaStyle.padding.y * miniScale,
                      fontSize: project.composition.ctaStyle.fontSize * miniScale,
                      fontWeight: 700,
                    }}>
                      {batchCopy.cta}
                    </div>
                  </div>
                </div>
                {/* Label */}
                <div className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${isEditing ? "bg-[var(--accent)] text-white" : "bg-zinc-800/80 text-zinc-400"}`}>
                  {isEditing ? "Editing" : `#${comboIdx + 1}`}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
