# Ad Creator — 18-Fix Sprint

You are fixing the BIUK Ad Creator app (Next.js 15 + Tailwind + Supabase). The repo is at the current working directory. Read HANDOFF.md first for full context.

**Rules:**
- Run `npm run build` after ALL changes to verify nothing breaks.
- Do NOT touch API routes, Gemini prompts, or Supabase schema — this is frontend/UX only.
- Do NOT add new dependencies unless absolutely necessary.
- Preserve all existing functionality. Every step must still work end-to-end.
- Test your changes by reading back the files you edited and verifying logic.

---

## FIX 1 — Resume flow should navigate to saved step, not dump user on Step 1

**Problem:** When the app resumes, the `ResumeBanner` in `src/app/create/layout.tsx` says "Resuming — Step 6 of 7" but the user lands on `/create` (Step 1) with a blank page. The banner is purely informational and never navigates.

**Fix:** In `ResumeBanner` inside `src/app/create/layout.tsx`:
- Import `useRouter` from `next/navigation` and `usePathname`.
- Add a "Resume → Step N" button that calls `router.push(stepPaths[project.currentStep])` where `stepPaths` maps step numbers to paths: `{1: "/create", 2: "/create/format", 3: "/create/image-prompts", 4: "/create/upload", 5: "/create/copy", 6: "/create/compose", 7: "/create/export"}`.
- Make that button purple (accent colored), prominent. Keep "Dismiss" and "Start Fresh" as secondary actions.
- If the user is ALREADY on their current step's path, hide the resume button (just show Dismiss/Start Fresh).

---

## FIX 2 — Step 1 should re-display saved product data on revisit

**Problem:** `src/app/create/page.tsx` uses local `useState` for `product`, `research`, etc. When you navigate back to Step 1, these are null so nothing renders — even though `project.brief.productAnalysis` and `project.brief.creativeResearch` exist in the global store.

**Fix:** In `src/app/create/page.tsx`:
- In the component body, after the hooks, add initialization logic: if `project.brief.productAnalysis` exists and `product` is null, call `setProduct(...)` to reconstruct the product card data from the store. Build the `ProductData` object from `project.brief.productAnalysis`, `project.brief.productHeroUrl`, `project.brief.productImages`, etc.
- Similarly, if `project.brief.creativeResearch` exists and `research` is null, call `setResearch(project.brief.creativeResearch)`.
- Set `sessionStarted` to `true` if `project.concept.angles.length > 0` (so the concept cards show).
- This should be a `useEffect` that runs once on mount, checking if stored data exists.
- Also populate `productUrl` from `project.brief.productUrl` if it exists. You may need to add `productUrl` to the brief in the store — add it to the `SET_BRIEF` dispatch in the `analyzeProduct` function: `dispatch({ type: "SET_BRIEF", payload: { productUrl: productUrl.trim() } })`, and to the `AdProject["brief"]` type in `src/types/ad.ts`.

---

## FIX 3 — Batch image hydration from IndexedDB on Step 4 revisit

**Problem:** `src/app/create/upload/page.tsx` uses local `useState<GeneratedImage[]>([])` for `images`. On revisit, this is empty. The global store has `project.batch.images` with URLs hydrated from IndexedDB, but the local `images` state isn't populated from it.

**Fix:** In `src/app/create/upload/page.tsx`:
- Add a `useEffect` that runs on mount. If `project.batch.images.length > 0` and `images.length === 0`, reconstruct the `images` array from the batch:
  ```ts
  const restored: GeneratedImage[] = project.batch.images.map(img => ({
    url: img.url,
    status: "done" as const,
  }))
  setImages(restored)
  // Also restore selection indices
  setSelectedIdxs(new Set(restored.map((_, i) => i)))
  ```
- Guard this so it only fires once (use a ref flag `restoredRef`).
- Also need to check `useHydrated()` — only restore AFTER hydration is complete, since batch image URLs come from IndexedDB via `_HYDRATE_IMAGES`. Import `useHydrated` from `@/lib/store` and check `hydrated && project.batch.images[0]?.url && !project.batch.images[0].url.includes("__IDB")`.

---

## FIX 4 — Replace `confirm()` with custom modal for "Start Fresh"

**Problem:** `src/app/create/layout.tsx` line 35 uses `window.confirm()` which freezes the browser tab.

**Fix:** In `src/app/create/layout.tsx`:
- Add a `showResetModal` state to `ResumeBanner`.
- Replace the `confirm()` call with `setShowResetModal(true)`.
- Render a modal when `showResetModal` is true:
  ```tsx
  {showResetModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">Start fresh?</h3>
        <p className="mt-2 text-sm text-zinc-400">This will erase all progress, images, and settings. This can't be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setShowResetModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button onClick={() => { dispatch({ type: "RESET" }); setShowResetModal(false); setDismissed(true) }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">Erase & Start Fresh</button>
        </div>
      </div>
    </div>
  )}
  ```

---

## FIX 5 — Add cancel button to loading overlays

**Problem:** `src/components/LoadingOverlay.tsx` has no way to cancel. If an API call hangs, the user is stuck.

**Fix:** In `src/components/LoadingOverlay.tsx`:
- Add an optional `onCancel?: () => void` prop.
- If `onCancel` is provided AND `elapsed > 8000` (8 seconds), show a "Cancel" button below the spinner.
- Style it as a subtle text button: `text-sm text-zinc-500 hover:text-zinc-300`.
- In `src/hooks/useApiCall.ts`, add an `abort` method:
  - Add an `AbortController` ref.
  - Create a new controller at the start of `execute`.
  - Expose `abort` in the return value that calls `controller.abort()`.
  - In the `catch`, detect `AbortError` and don't set it as a user-facing error — just silently stop.
- In the pages that use `useApiCall` (`page.tsx` Step 1, `image-prompts/page.tsx`, `copy/page.tsx`), pass `onCancel={() => abortScrape()}` (or whatever the abort function is named) to `LoadingOverlay`.

---

## FIX 6 — Cutout polling should show feedback on failure

**Problem:** In `src/app/create/page.tsx`, `pollForCutout` silently gives up after 12 attempts.

**Fix:**
- Add a `cutoutStatus` state: `"idle" | "polling" | "done" | "failed"`.
- Set `"polling"` when polling starts, `"done"` when cutout URL arrives, `"failed"` after 12 attempts.
- In the product card section, show a small status indicator:
  - polling: `"Generating product cutout…"` with a tiny spinner
  - done: `"✓ Cutout ready"` in green
  - failed: `"Cutout generation timed out"` in amber/yellow with a "Retry" link
- The retry link should call `pollForCutout(productUrl)` again and reset the counter.

---

## FIX 7 — Tighten the 2×2 batch preview grid

**Problem:** In `src/app/create/compose/page.tsx`, the 2×2 batch preview grid has huge gaps between cards. They're in a `grid` but likely using `grid-cols-2` with wide column gaps or the cards aren't filling their cells.

**Fix:** Find the batch preview grid section in `compose/page.tsx` (search for "Batch Preview" or "2×2"). It should be using a CSS grid. Fix it to:
- Use `grid grid-cols-2 gap-4` (not gap-8 or larger).
- Each preview card should be `w-full` to fill its grid cell.
- The grid container should have `max-w-2xl mx-auto` to keep it reasonably sized.
- Preview thumbnails inside each card should maintain aspect ratio with `aspect-square` or explicit aspect ratio matching the platform format.

---

## FIX 8 — Fix export page layout: download buttons under images

**Problem:** On the export page (`src/app/create/export/page.tsx`), the "Download" button floats to the right of the label. It should be directly under each image.

**Fix:** In the export page's combo rendering loop:
- Restructure each combo card to be a vertical stack: image on top, then label + download button below.
- Use `flex flex-col items-center` for each card.
- The grid should be `grid grid-cols-2 gap-6 max-w-3xl mx-auto`.
- Put the label and download button in a `flex items-center justify-between w-full mt-2` row below the image.

---

## FIX 9 — Step 1 shows saved data (duplicate of Fix 2, ensure brief textarea is populated)

This is covered by Fix 2. Make sure the brief textarea, target audience, campaign goal, and brand voice inputs all show their saved values from the store on revisit. The brief textarea already reads from `project.brief.description` so that should work — the issue is the `product` card and `research` card not rendering. Fix 2 handles this.

**Skip this — already covered by Fix 2.**

---

## FIX 10 — Collapse long prompt text in Step 4

**Problem:** `src/app/create/upload/page.tsx` shows the full selected prompt text (300+ words) in a big textarea, taking up most of the viewport.

**Fix:** In the "YOUR SELECTED PROMPT" section of `upload/page.tsx`:
- Add a `showFullPrompt` state, defaulting to `false`.
- When collapsed, show only the first 120 characters + "..." with a "Show full prompt ▾" toggle button.
- When expanded, show the full text with a "Collapse ▴" toggle.
- Use `text-sm text-zinc-400` for the prompt text, not a full textarea (it's read-only at this point anyway — editing happens in Step 3).
- Keep the existing textarea if the prompt was already editable; if it's read-only, switch to a `<p>` or `<div>` with truncation.

---

## FIX 11 — Extract compose page sub-components

**Problem:** `src/app/create/compose/page.tsx` is 900+ lines.

**Fix:** Extract into sub-components. Create these files:
- `src/app/create/compose/TextStylePanel.tsx` — the right sidebar with headline/CTA font controls
- `src/app/create/compose/BatchPreviewGrid.tsx` — the 2×2 batch preview section
- `src/app/create/compose/ProductImageControls.tsx` — product image scale/position/opacity controls

Each component receives the relevant state and dispatch via props or by calling `useProject()`/`useDispatch()` directly.

The main `compose/page.tsx` should import these and be reduced to ~400 lines handling the canvas preview and drag logic.

**Important:** Do NOT change any behavior. This is a pure refactor. The compose step must work identically after extraction.

---

## FIX 12 — Add batch mode explainer

**Problem:** The copy page says "Pick 2 for your 2×2 batch" with no explanation.

**Fix:** In `src/app/create/copy/page.tsx`, above the "Pick Your Copy" heading (or just below it), add a small info note:
```tsx
{hasBatch && (
  <p className="text-xs text-zinc-500 mt-1">
    You have 2 images selected — pick 2 headlines to create a 2×2 test grid (4 ad variations).
  </p>
)}
```
Similarly in `src/app/create/upload/page.tsx`, near the multi-select UI, add:
```tsx
<p className="text-xs text-zinc-500">Pick 2 images to create a 2×2 batch with your headlines — or pick 1 for a single ad.</p>
```

---

## FIX 13 — Stable batch numbering for copy selection

**Problem:** In `src/app/create/copy/page.tsx`, when you toggle batch copies, the badge numbers shift because they renumber from the current `batch.copies` array index.

**Fix:** The badges should use the copy variation's index in the `project.copy.variations` array, NOT its index in `batch.copies`. Find where batch badge numbers are rendered — it's likely doing something like:
```tsx
const batchIdx = project.batch.copies.findIndex(c => c.id === variation.id)
```
Change the badge display to show which "slot" (A or B) it fills:
- First selected → shows "1" badge
- Second selected → shows "2" badge
- The badge number should be `batchIdx + 1` where `batchIdx` is its position in `batch.copies` — this part is fine. The issue is that when you deselect #1, #2 doesn't become #1. Instead of renumbering, keep the original assignment stable. Actually, the current FIFO replacement logic in the reducer is fine. The visual "1" and "2" represent position in the batch, not a permanent ID. Document this with a tooltip: `title="This headline will be used as Headline ${batchIdx === 0 ? 'A' : 'B'} in your 2×2 grid"`.

---

## FIX 14 — Scale product layer position on platform change

**Problem:** `src/lib/store.tsx` reducer `SET_PLATFORM` resets the layout zones but doesn't scale the `composition.productImage` position.

**Fix:** In the `SET_PLATFORM` case of the reducer in `src/lib/store.tsx`:
- After updating format dimensions, check if `updated.composition.productImage` exists.
- If so, scale its position proportionally:
  ```ts
  const oldW = state.format.width
  const oldH = state.format.height
  const newW = spec.width
  const newH = spec.height
  if (updated.composition.productImage) {
    updated.composition.productImage = {
      ...updated.composition.productImage,
      position: {
        x: (updated.composition.productImage.position.x / oldW) * newW,
        y: (updated.composition.productImage.position.y / oldH) * newH,
      },
    }
  }
  ```
- Also scale `composition.textPosition` the same way.

---

## FIX 15 — Allow customizing image generation variations

**Problem:** In `src/app/create/upload/page.tsx`, the 3 image generations append hardcoded variation suffixes.

**Fix:** Find where the prompt variations are built (search for "variation" or "camera angle" in `upload/page.tsx`). There should be strings like `" — variation with slightly different camera angle"` appended.
- Make these configurable: define a `const VARIATION_SUFFIXES = [...]` at the top of the file.
- Add a small "Variation style" dropdown below the prompt with options:
  - "Camera angle + Color grade" (default, current behavior)
  - "Identical (A/A test)" — all 3 use the exact same prompt
  - "Lighting variations" — append lighting-specific suffixes
- Store the choice in local state only (doesn't need to persist).

---

## FIX 16 — Adjust word count warning threshold

**Problem:** The copy page flags headlines over 6 words in red, but the AI regularly generates 6-8 word headlines.

**Fix:** In `src/app/create/copy/page.tsx`, find where word count is displayed/compared (search for word count or "words"). Change the warning threshold from 6 to 8. Headlines up to 8 words should show as neutral/green, 9+ as amber warning, 12+ as red.

---

## FIX 17 — Persist feedback text in session

**Problem:** The "Not quite right?" feedback textarea in Steps 1, 3, and 5 loses its content on navigation.

**Fix:** This is minor. In each page, the feedback is in local `useState`. Since the user typically types feedback and immediately regenerates (which clears it), this is low-priority. Just add `sessionStorage` persistence:
- In each page with a `feedback` state, add:
  ```ts
  const feedbackKey = `ad-feedback-step-${stepNumber}`
  const [feedback, setFeedback] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(feedbackKey) || "" : ""
  )
  useEffect(() => { sessionStorage.setItem(feedbackKey, feedback) }, [feedback, feedbackKey])
  ```

---

## FIX 18 — Font fallback for export canvas

**Problem:** The compose preview uses Google Fonts loaded via CSS, but the export canvas (`export/page.tsx`) uses `ctx.font` which requires the font to be loaded. If the font isn't cached, the export uses system fallback and looks different.

**Fix:** In `src/app/create/export/page.tsx`, before rendering to canvas, ensure the selected font is loaded:
```ts
// At the top of the render function, before any canvas drawing:
const fontFamily = project.composition.headlineFontFamily.split(',')[0].trim()
try {
  await document.fonts.load(`${project.composition.headlineFontWeight} ${project.composition.headlineFontSize}px "${fontFamily}"`)
} catch {
  // Font load failed — canvas will use fallback, which is acceptable
  console.warn(`Font "${fontFamily}" not available for export, using fallback`)
}
```

---

## Final checklist

After all fixes:
1. `npm run build` must pass with zero errors.
2. `npm run lint` should have no new warnings.
3. Every file you created or edited should be syntactically valid TypeScript/TSX.
4. The app should work end-to-end: paste URL → scrape → concepts → format → prompts → upload → copy → compose → export.
