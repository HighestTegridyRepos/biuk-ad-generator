"use client"

import { memo } from "react"
import { useProject, useDispatch } from "@/lib/store"

export default memo(function TextStylePanel() {
  const project = useProject()
  const dispatch = useDispatch()

  return (
    <>
      {/* Inline text editing fields */}
      {project.copy.selected && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">Text Content</h3>
          <div className="mt-2 space-y-2">
            <div>
              <label className="text-xs text-zinc-500">Headline</label>
              <input
                type="text"
                value={project.copy.selected.headline}
                onChange={(e) =>
                  dispatch({
                    type: "SELECT_COPY",
                    payload: { ...project.copy.selected!, headline: e.target.value },
                  })
                }
                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Subhead</label>
              <input
                type="text"
                value={project.copy.selected.subhead || ""}
                onChange={(e) =>
                  dispatch({
                    type: "SELECT_COPY",
                    payload: { ...project.copy.selected!, subhead: e.target.value || undefined },
                  })
                }
                placeholder="Optional subhead"
                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">CTA</label>
              <input
                type="text"
                value={project.copy.selected.cta}
                onChange={(e) =>
                  dispatch({
                    type: "SELECT_COPY",
                    payload: { ...project.copy.selected!, cta: e.target.value },
                  })
                }
                className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-300">Headline Style</h3>
        <div className="mt-2 space-y-3">
          <div>
            <label className="text-xs text-zinc-500">Font Size</label>
            <input
              type="range" min={24} max={120}
              value={project.composition.headlineFontSize}
              onChange={(e) => dispatch({ type: "UPDATE_COMPOSITION", payload: { headlineFontSize: Number(e.target.value) } })}
              className="w-full"
            />
            <span className="text-xs text-zinc-500">{project.composition.headlineFontSize}px</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500">Weight</label>
              <select
                value={project.composition.headlineFontWeight}
                onChange={(e) => dispatch({ type: "UPDATE_COMPOSITION", payload: { headlineFontWeight: Number(e.target.value) } })}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              >
                {[400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Color</label>
              <input
                type="color"
                value={project.composition.headlineColor}
                onChange={(e) => dispatch({ type: "UPDATE_COMPOSITION", payload: { headlineColor: e.target.value } })}
                className="mt-0.5 h-8 w-full cursor-pointer rounded border border-zinc-700"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500">Font Family</label>
            <select
              value={project.composition.headlineFontFamily}
              onChange={(e) => dispatch({ type: "UPDATE_COMPOSITION", payload: { headlineFontFamily: e.target.value } })}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            >
              <option value="Inter, sans-serif">Inter</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
              <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
              <option value="'Montserrat', sans-serif">Montserrat</option>
              <option value="'Oswald', sans-serif">Oswald</option>
              <option value="'Raleway', sans-serif">Raleway</option>
              <option value="'Roboto Condensed', sans-serif">Roboto Condensed</option>
              <option value="'DM Serif Display', serif">DM Serif Display</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500">Alignment</label>
            <div className="mt-1 flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => dispatch({ type: "UPDATE_COMPOSITION", payload: { headlineAlign: align } })}
                  className={`flex-1 rounded border px-2 py-1 text-xs font-medium capitalize transition-colors ${
                    project.composition.headlineAlign === align
                      ? "border-white bg-zinc-800 text-white"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-300">CTA Button</h3>
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500">Background</label>
              <input type="color" value={project.composition.ctaStyle.backgroundColor}
                onChange={(e) => dispatch({ type: "SET_CTA_STYLE", payload: { backgroundColor: e.target.value } })}
                className="mt-0.5 h-8 w-full cursor-pointer rounded border border-zinc-700" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Text Color</label>
              <input type="color" value={project.composition.ctaStyle.textColor}
                onChange={(e) => dispatch({ type: "SET_CTA_STYLE", payload: { textColor: e.target.value } })}
                className="mt-0.5 h-8 w-full cursor-pointer rounded border border-zinc-700" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Font Size</label>
            <input type="range" min={14} max={48} value={project.composition.ctaStyle.fontSize}
              onChange={(e) => dispatch({ type: "SET_CTA_STYLE", payload: { fontSize: Number(e.target.value) } })}
              className="w-full" />
            <span className="text-xs text-zinc-500">{project.composition.ctaStyle.fontSize}px</span>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Border Radius</label>
            <input type="range" min={0} max={32} value={project.composition.ctaStyle.borderRadius}
              onChange={(e) => dispatch({ type: "SET_CTA_STYLE", payload: { borderRadius: Number(e.target.value) } })}
              className="w-full" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-300">Overlay</h3>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={!!project.composition.overlayGradient}
              onChange={(e) => dispatch({ type: "SET_OVERLAY_GRADIENT", payload: e.target.checked
                ? { direction: "to top", from: "rgba(0,0,0,0.8)", to: "transparent", coverage: 50 }
                : undefined })}
              className="rounded" />
            Gradient overlay
          </label>
          {project.composition.overlayGradient && (
            <select value={project.composition.overlayGradient.direction}
              onChange={(e) => dispatch({ type: "SET_OVERLAY_GRADIENT", payload: { ...project.composition.overlayGradient!, direction: e.target.value } })}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100">
              <option value="to top">Bottom to Top</option>
              <option value="to bottom">Top to Bottom</option>
              <option value="to right">Left to Right</option>
              <option value="to left">Right to Left</option>
            </select>
          )}
        </div>
      </div>
    </>
  )
})
