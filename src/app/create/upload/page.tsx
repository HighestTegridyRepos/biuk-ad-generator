"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useProject, useDispatch } from "@/lib/store"

export default function UploadPage() {
  const project = useProject()
  const dispatch = useDispatch()
  const router = useRouter()

  const [dragging, setDragging] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [mode, setMode] = useState<"generate" | "upload">("generate")

  const selectedPrompt = project.imagePrompts.prompts.find(
    (p) => p.id === project.imagePrompts.selectedPromptId
  )

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      dispatch({
        type: "SET_UPLOADED_IMAGE",
        payload: { url },
      })
      setGenError(null)
    },
    [dispatch]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("image/")) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleGenerate = async () => {
    if (!selectedPrompt) return

    setGenerating(true)
    setGenError(null)

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: selectedPrompt.text }),
      })

      const data = await res.json()

      if (!res.ok) {
        setGenError(data.error || "Image generation failed")
        return
      }

      dispatch({
        type: "SET_UPLOADED_IMAGE",
        payload: { url: data.imageUrl },
      })
    } catch (err) {
      setGenError(
        err instanceof Error ? err.message : "Network error — try again"
      )
    } finally {
      setGenerating(false)
    }
  }

  const proceed = () => {
    dispatch({ type: "SET_STEP", payload: 5 })
    router.push("/create/copy")
  }

  const scale = Math.min(
    500 / project.format.width,
    500 / project.format.height
  )

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Step 4: Generate or Upload Image</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Generate an image with AI using your prompt, or upload one you made
        externally.
      </p>

      {/* Selected prompt reminder */}
      {selectedPrompt && (
        <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div className="text-xs font-medium uppercase text-zinc-500">
            Your Selected Prompt
          </div>
          <p className="mt-1 text-sm text-zinc-300">{selectedPrompt.text}</p>
        </div>
      )}

      {/* Mode toggle */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setMode("generate")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "generate"
              ? "bg-white text-black"
              : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          AI Generate
        </button>
        <button
          onClick={() => setMode("upload")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "upload"
              ? "bg-white text-black"
              : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Upload File
        </button>
      </div>

      {/* Content area */}
      <div className="mt-6">
        {!project.uploadedImage.url ? (
          <>
            {mode === "generate" ? (
              <div className="space-y-4">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !selectedPrompt}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 py-16 text-sm font-medium transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generating ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                      <span className="text-zinc-300">
                        Generating with NanoBanana Pro…
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-300">
                      Click to Generate Image
                    </span>
                  )}
                </button>

                {genError && (
                  <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
                    {genError}
                  </div>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                  dragging
                    ? "border-white bg-zinc-800"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="text-4xl text-zinc-600">+</div>
                <p className="mt-2 text-sm text-zinc-400">
                  Drag &amp; drop your image here, or click to browse
                </p>
                <p className="mt-1 text-xs text-zinc-500">PNG, JPG, WebP</p>
                <label className="mt-4 cursor-pointer rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800">
                  Browse Files
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div
                className="relative overflow-hidden rounded-lg border border-zinc-700"
                style={{
                  width: project.format.width * scale,
                  height: project.format.height * scale,
                }}
              >
                <img
                  src={project.uploadedImage.url}
                  alt="Generated ad image"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedPrompt}
                className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
              <label className="cursor-pointer rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800">
                Replace with File
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-10 flex justify-between">
        <button
          onClick={() => router.push("/create/image-prompts")}
          className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          &larr; Back
        </button>
        <button
          onClick={proceed}
          disabled={!project.uploadedImage.url}
          className="rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next: Generate Copy &rarr;
        </button>
      </div>
    </div>
  )
}
