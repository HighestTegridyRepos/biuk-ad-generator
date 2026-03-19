"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ProjectProvider, useProject, useDispatch, useHydrated } from "@/lib/store"
import StepNav from "@/components/StepNav"
import ErrorBoundary from "@/components/ErrorBoundary"

const stepPaths: Record<number, string> = {
  1: "/create",
  2: "/create/format",
  3: "/create/image-prompts",
  4: "/create/upload",
  5: "/create/copy",
  6: "/create/compose",
  7: "/create/export",
}

function ResumeBanner() {
  const project = useProject()
  const dispatch = useDispatch()
  const router = useRouter()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  // Only show if resuming a project with actual progress
  const hasProgress = project.currentStep > 1 || project.brief.description.length > 0
  if (!hasProgress || dismissed) return null

  const isOnCurrentStep = pathname === stepPaths[project.currentStep]

  return (
    <>
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-xs text-zinc-400">
            Resuming your ad project
            {project.currentStep > 1 && (
              <span className="text-zinc-500"> — Step {project.currentStep} of 7</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {project.currentStep > 1 && !isOnCurrentStep && (
              <button
                onClick={() => {
                  router.push(stepPaths[project.currentStep])
                  setDismissed(true)
                }}
                className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                Resume → Step {project.currentStep}
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Dismiss
            </button>
            <button
              onClick={() => setShowResetModal(true)}
              className="text-xs text-red-400/70 transition-colors hover:text-red-400"
            >
              Start Fresh
            </button>
          </div>
        </div>
      </div>
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Start fresh?</h3>
            <p className="mt-2 text-sm text-zinc-400">This will erase all progress, images, and settings. This can&apos;t be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowResetModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button onClick={() => { dispatch({ type: "RESET" }); setShowResetModal(false); setDismissed(true) }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">Erase &amp; Start Fresh</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CreateContent({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated()

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col">
        <StepNav />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            <p className="text-sm text-zinc-500">Loading project…</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ResumeBanner />
      <StepNav />
      <main className="flex-1">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectProvider>
      <CreateContent>{children}</CreateContent>
    </ProjectProvider>
  )
}
