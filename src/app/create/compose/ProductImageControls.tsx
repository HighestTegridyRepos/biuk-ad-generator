"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useProject, useDispatch } from "@/lib/store"

export default function ProductImageControls() {
  const project = useProject()
  const dispatch = useDispatch()
  const [removingBg, setRemovingBg] = useState(false)
  const [bgRemovalFailed, setBgRemovalFailed] = useState(false)
  const autoTriedRef = useRef(false)

  const { width, height } = project.format
  const productImageUrl = project.brief.productCutoutUrl || project.brief.productHeroUrl
  const productLayer = project.composition.productImage

  const handleRemoveBg = useCallback(async () => {
    if (removingBg || !project.brief.productHeroUrl) return
    setRemovingBg(true)
    setBgRemovalFailed(false)
    try {
      const res = await fetch("/api/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: project.brief.productHeroUrl,
          productId: project.brief.productId,
        }),
      })
      const data = await res.json()
      if (res.ok && data.cutoutUrl) {
        dispatch({ type: "SET_BRIEF", payload: { productCutoutUrl: data.cutoutUrl } })
        dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { url: data.cutoutUrl } })
      } else {
        setBgRemovalFailed(true)
      }
    } catch {
      setBgRemovalFailed(true)
    } finally {
      setRemovingBg(false)
    }
  }, [removingBg, project.brief.productHeroUrl, project.brief.productId, dispatch])

  // Auto-trigger background removal on mount if cutout is missing
  useEffect(() => {
    if (
      !autoTriedRef.current &&
      project.brief.productHeroUrl &&
      !project.brief.productCutoutUrl &&
      !removingBg
    ) {
      autoTriedRef.current = true
      handleRemoveBg()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!productImageUrl) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300">Product Image</h3>
      <div className="mt-2 space-y-3">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={!!productLayer?.visible}
            onChange={(e) => {
              if (e.target.checked && !productLayer) {
                dispatch({ type: "SET_PRODUCT_IMAGE", payload: {
                  url: productImageUrl, position: { x: width * 0.3, y: height * 0.3 },
                  scale: 1, rotation: 0, opacity: 1, visible: true,
                }})
              } else {
                dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { visible: e.target.checked } })
              }
            }}
            className="rounded" />
          Show product image
        </label>

        {/* Background removal status */}
        {removingBg && (
          <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400">
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
            Removing background…
          </div>
        )}

        {productLayer?.visible && (
          <>
            <div>
              <label className="text-xs text-zinc-500">Scale</label>
              <input type="range" min={10} max={200} value={Math.round((productLayer.scale || 1) * 100)}
                onChange={(e) => dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { scale: Number(e.target.value) / 100 } })}
                className="w-full" />
              <span className="text-xs text-zinc-500">{Math.round((productLayer.scale || 1) * 100)}%</span>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Opacity</label>
              <input type="range" min={10} max={100} value={Math.round((productLayer.opacity || 1) * 100)}
                onChange={(e) => dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { opacity: Number(e.target.value) / 100 } })}
                className="w-full" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">Rotation</label>
                {(productLayer.rotation || 0) !== 0 && (
                  <button onClick={() => dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { rotation: 0 } })}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300">Reset</button>
                )}
              </div>
              <input type="range" min={-180} max={180} value={productLayer.rotation || 0}
                onChange={(e) => dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { rotation: Number(e.target.value) } })}
                className="w-full" />
              <span className="text-xs text-zinc-500">{productLayer.rotation || 0}&deg;</span>
            </div>
            {project.brief.productCutoutUrl && project.brief.productHeroUrl ? (
              <div className="flex gap-1">
                <button onClick={() => dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { url: project.brief.productCutoutUrl! } })}
                  className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${productLayer.url === project.brief.productCutoutUrl ? "border-white bg-zinc-800 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                  Cutout
                </button>
                <button onClick={() => dispatch({ type: "UPDATE_PRODUCT_IMAGE", payload: { url: project.brief.productHeroUrl! } })}
                  className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${productLayer.url === project.brief.productHeroUrl ? "border-white bg-zinc-800 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                  Original
                </button>
              </div>
            ) : !project.brief.productCutoutUrl && project.brief.productHeroUrl ? (
              <div className="space-y-1">
                <button
                  disabled={removingBg}
                  onClick={handleRemoveBg}
                  className="w-full rounded border border-zinc-700 px-2 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                >
                  {removingBg ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                      Removing background…
                    </span>
                  ) : bgRemovalFailed ? (
                    "Retry Background Removal"
                  ) : (
                    "Remove Background"
                  )}
                </button>
                {bgRemovalFailed && (
                  <p className="text-[10px] text-amber-400/70">Background removal failed. Click to retry or continue with the original image.</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
