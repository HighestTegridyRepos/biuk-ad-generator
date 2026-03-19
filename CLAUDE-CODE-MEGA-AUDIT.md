# Ad Creator — MEGA AUDIT & UPGRADE Sprint

You are doing a comprehensive audit and upgrade of the BIUK Ad Creator app. This is a Next.js 15 + React 19 + Tailwind + Supabase app that generates social media ads in a 7-step pipeline. Read HANDOFF.md and CLAUDE.md first for full context.

The app WORKS end-to-end. Your job is to make it PRODUCTION-GRADE. Fix every rough edge, upgrade every half-baked feature, harden every API route, and polish every UI interaction. When you're done, this should feel like a real SaaS product, not a prototype.

**Rules:**
- `npm run build` must pass after every major section of work.
- Do NOT break the existing 7-step flow. Every step must work end-to-end.
- Do NOT change the Gemini model constants or Supabase schema.
- You CAN add dependencies if they meaningfully improve the product.
- Be aggressive about improving things. If something is mediocre, make it great.

---

## SECTION 1 — SECURITY HARDENING

### 1.1 SSRF Protection on scrape-product

`src/app/api/scrape-product/route.ts` fetches arbitrary user-provided URLs with ZERO IP blocking. The `remove-background/route.ts` already has proper SSRF guards (blocking localhost, 127.0.0.1, 10.x, 172.x, 192.168.x, 169.254.x, .internal, .local).

**Fix:** Extract the SSRF validation from `remove-background/route.ts` into a shared utility at `src/lib/url-validation.ts`:
```ts
export function validateExternalUrl(url: string): { valid: boolean; error?: string }
```
Apply it in both `scrape-product/route.ts` AND `remove-background/route.ts` (replace the inline version). Also add:
- Block `file://` and `ftp://` protocols
- Block IPv6 loopback (`::1`, `[::1]`)
- Block `metadata.google.internal` and AWS metadata (`169.254.169.254`)

### 1.2 Rate Limiting

Add basic rate limiting to ALL API routes. Use an in-memory sliding window (no external dependencies needed for Austin's single-user scale):

Create `src/lib/rate-limit.ts`:
```ts
const windows = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = windows.get(key)
  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  entry.count++
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) }
}
```

Apply in each API route at the top of the POST handler:
- scrape-product: 10 req/min
- concept: 20 req/min
- image-prompts: 20 req/min
- copy: 20 req/min
- generate-image: 15 req/min (most expensive)
- describe-image: 30 req/min
- remove-background: 10 req/min
- analyze-reference: 20 req/min

Return 429 with `{ error: "Too many requests. Please wait a moment." }` when exceeded.

### 1.3 Input Sanitization

Audit every API route for input validation. Most already have basic checks. Add:
- URL length limit (2048 chars) on scrape-product
- Brief text length limit (5000 chars) on concept route
- Image base64 size limit check on all image routes (already on describe-image, add to others)
- Reject requests with unexpected fields (don't parse blindly)

---

## SECTION 2 — ERROR HANDLING & RESILIENCE

### 2.1 Server-Side Abort Signals

`src/lib/gemini.ts` uses `withTimeout()` but the underlying fetch to Gemini's API cannot be cancelled. Add AbortSignal support:

In `gemini.ts`, modify `generateText()` and `describeImageWithVision()` to accept an optional `signal?: AbortSignal` parameter. Pass it through to the `ai.models.generateContent()` call via the config. If the Gemini SDK doesn't support abort natively, wrap the call in a `Promise.race` with the abort signal.

### 2.2 Structured Error Responses

Create `src/lib/api-error.ts`:
```ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }
  console.error("Unhandled error:", error)
  return NextResponse.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  )
}
```

Refactor all API route catch blocks to use this consistently.

### 2.3 Retry Logic for Gemini Calls

Gemini occasionally returns 503 or rate-limit errors. Add automatic retry with exponential backoff:

In `src/lib/gemini.ts`, create a wrapper:
```ts
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable = err instanceof Error &&
        (err.message.includes("503") || err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED"))
      if (!isRetryable || attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)))
    }
  }
  throw new Error("Retry exhausted")
}
```

Wrap all `generateText()` and `describeImageWithVision()` internals with this.

---

## SECTION 3 — UI/UX POLISH

### 3.1 Loading States Everywhere

Audit every page for missing loading states. Every button that triggers an API call should:
- Show a spinner inside the button while loading
- Disable the button to prevent double-clicks
- Show elapsed time if the call takes >3 seconds
- Current `LoadingOverlay` is good for full-page loads; add inline spinners for secondary actions

Specific gaps to fix:
- Step 3: "Select & Generate" button in image-prompts page — when clicked, show inline spinner
- Step 5: "Generate Headlines" button — add inline spinner state
- Compose page: "Remove Background" button — already has loading state, verify it works

### 3.2 Empty States

Every step should have a clear empty state when there's no data:
- Step 4 (Upload): If no prompt is selected, show "Go back to Step 3 to select an image prompt" instead of the current minimal message
- Step 5 (Copy): If no image is uploaded, show "Go back to Step 4 to upload or generate an image"
- Step 6 (Compose): Already has empty state for no copy selected — good
- Step 7 (Export): If no ads to render, show clear message with link back to compose

### 3.3 Transition Animations

Add subtle transitions for better perceived performance:
- Step transitions: fade in content when navigating between steps (the `step-transition` class exists but may not have CSS). Add to `globals.css`:
  ```css
  .step-transition {
    animation: fadeSlideIn 0.25s ease-out;
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```
- Concept angle selection: add a subtle scale/border animation
- Batch badge toggle: add a pop animation when badges appear/disappear
- Loading overlay: add a fade-in instead of instant appearance

### 3.4 Mobile Responsiveness

Check every page for mobile breakpoints. Key fixes:
- Step nav: already hides labels on mobile, verify step circles don't overflow
- Format page: layout preview should stack below the template picker on mobile
- Compose page: controls panel should stack below the canvas on mobile (currently side-by-side)
- Export page: download buttons should be full-width on mobile

Add `@media (max-width: 768px)` or Tailwind responsive classes where needed.

### 3.5 Keyboard Accessibility

The `useKeyboardShortcuts` hook handles basic navigation. Add:
- **Escape to deselect** on compose page (partially exists)
- **Tab navigation** through concept angles, image prompts, and copy variations
- **Space to toggle** batch selections
- **Focus rings** on all interactive elements (Tailwind's `focus-visible:ring-2 focus-visible:ring-[var(--accent)]`)

### 3.6 Toast Notifications

Replace inline success messages with a lightweight toast system. Create `src/components/Toast.tsx`:
- Fixed position bottom-right
- Auto-dismiss after 3 seconds
- Supports success/error/info variants
- Use for: "Copied to clipboard", "Image generated", "Background removed", "Export downloaded"

Create a `ToastProvider` context in `src/lib/toast.tsx` and add it to the root layout.

---

## SECTION 4 — COMPOSE EDITOR UPGRADES

### 4.1 Free-Form Text Editing

Austin wants to be able to delete the subhead, remove the CTA entirely, or add free text. Currently the compose canvas has a locked structure: headline + optional subhead + CTA button.

**Upgrade the compose editor to support:**

1. **Delete subhead**: Add an "×" button next to the subhead on the canvas (appears on hover). Clicking it sets `subhead: undefined` in the copy.
2. **Delete CTA**: Same "×" button on the CTA. Clicking it sets `cta: ""` and hides the CTA button.
3. **Toggle CTA visibility**: Add a "Show CTA" checkbox in the TextStylePanel controls.
4. **Add subhead back**: If subhead is deleted, show an "+ Add subhead" button in the controls panel.

Do NOT build a full free-form text editor with arbitrary text boxes (too complex for this sprint). Just make the existing structure flexible.

### 4.2 Snap-to-Grid Guides

When dragging elements on the compose canvas, show alignment guides:
- Horizontal center line (appears when element center aligns with canvas center)
- Vertical center line
- Edge alignment to safe zones

Implementation: In the TransformBox `onMove` callback (or a wrapper), calculate proximity to guide lines. When within 5px (canvas coords), snap to the guide and show a thin colored line.

Create `src/lib/snap-guides.ts`:
```ts
interface GuideLine { axis: "x" | "y"; position: number }

export function getSnapGuides(
  elementRect: { x: number; y: number; width: number; height: number },
  canvasSize: { width: number; height: number },
  safeZones: { top: number; bottom: number; left: number; right: number },
  threshold: number = 5
): { snappedX?: number; snappedY?: number; guides: GuideLine[] }
```

Render the guides as thin purple lines overlaid on the canvas.

### 4.3 Undo/Redo UI Indicator

The undo/redo system exists in the store but there's no visual indicator. Add undo/redo buttons to the compose page header:
```tsx
<div className="flex gap-1">
  <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="...">
    <UndoIcon />
  </button>
  <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className="...">
    <RedoIcon />
  </button>
</div>
```
Use simple SVG icons (don't add a library). Show them only on the compose page.

### 4.4 Canvas Zoom Controls

The compose canvas uses a fixed scale from `getPreviewScale()`. Add zoom controls:
- "−" and "+" buttons to zoom in/out (0.5x to 2x range)
- "Fit" button to reset to auto-fit
- Display current zoom level as percentage
- Store zoom in local component state (doesn't need to persist)

Modify the preview container to use the user's zoom level instead of the auto-calculated scale.

---

## SECTION 5 — EXPORT IMPROVEMENTS

### 5.1 Image Proxy for CORS

External CDN images (from product pages) can fail `canvas.toDataURL()` due to CORS. Create a server-side image proxy:

`src/app/api/proxy-image/route.ts`:
```ts
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  // Validate URL (use the shared SSRF validator)
  const validation = validateExternalUrl(url)
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 })

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })

  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
```

In the export page, when loading images onto the canvas, check if the image URL is external and route through the proxy: `/api/proxy-image?url=${encodeURIComponent(externalUrl)}`.

### 5.2 Export Quality Options

Add a quality selector on the export page:
- **Standard (1x)** — current 1080×1080 (or platform dimensions)
- **High (2x)** — 2160×2160 (doubles canvas resolution, better for print/zoom)

When 2x is selected, create the canvas at double resolution and scale all drawing operations by 2x. The downloaded file should be labeled with the resolution.

### 5.3 Export Filename Convention

Currently downloads are probably named generically. Use a structured filename:
```
{product-name}_{headline-slug}_{platform}_{date}.png
```
e.g. `ProFoam_stop-scrubbing-your-oven_ig-feed-square_2026-03-20.png`

For the 2×2 grid download:
```
{product-name}_2x2-grid_{platform}_{date}.png
```

Derive `product-name` from `project.brief.productAnalysis?.productName` or fall back to "ad".

### 5.4 Copy-to-Clipboard for Ads

Add a "Copy to Clipboard" button alongside each Download button on the export page. Uses `navigator.clipboard.write()` with a PNG blob. Show a toast notification on success.

---

## SECTION 6 — DATA & CACHING IMPROVEMENTS

### 6.1 Cache Hit Indicators

When the user triggers concept/prompt/copy generation and the result comes from Supabase cache, show a small "⚡ Cached" badge next to the results. The API routes already return a way to detect this (check if the response includes a `fromCache` field or add one).

For routes that DON'T currently return `fromCache`:
- concept/route.ts: Add `fromCache: true` to the response when serving from cache
- image-prompts/route.ts: Same
- copy/route.ts: Same

On the frontend, show the badge with: `"Loaded instantly from cache"` tooltip.

### 6.2 Clear Cache Button

Add a "Clear cache & regenerate" option to the guided regeneration UI. When the user clicks "Regenerate", they currently get a fresh result that bypasses cache. But the OLD cached result still exists and will be served again if the user navigates away and comes back.

In the regeneration flow, add an option to DELETE the old cache entry:
- Add a `deleteCache(table, hashKey)` function to `src/lib/cache.ts`
- Wire it up so "Regenerate" with the "clear old cache" checkbox deletes the previous entry

### 6.3 Project History

Save completed projects to localStorage (a separate key from the active project):
```ts
const HISTORY_KEY = "ad-creator-history"
```

When the user exports (completes Step 7), save a snapshot to history:
```ts
{ id, name, productName, thumbnailUrl, createdAt, completedAt, platform }
```

Show a "Recent Projects" section on the landing page (`src/app/page.tsx`) with thumbnails and "Continue" links. Limit to last 5 projects.

---

## SECTION 7 — CODE QUALITY

### 7.1 Extract Shared Constants

Create `src/lib/constants.ts` for values used across multiple files:
```ts
export const MAX_BATCH_IMAGES = 2
export const MAX_BATCH_COPIES = 2
export const MAX_REFERENCE_IMAGES = 5
export const IMAGE_GENERATION_COUNT = 3
export const HEADLINE_MAX_WORDS = 8
export const HEADLINE_WARN_WORDS = 9
export const MAX_URL_LENGTH = 2048
export const MAX_BRIEF_LENGTH = 5000
```

Replace all hardcoded magic numbers across the codebase with these constants.

### 7.2 Type-Safe API Responses

The API routes return raw JSON. Create typed response helpers:
```ts
// src/lib/api-response.ts
export function success<T>(data: T) {
  return NextResponse.json(data)
}
export function error(message: string, status = 500, code?: string) {
  return NextResponse.json({ error: message, code }, { status })
}
```

Refactor all routes to use these.

### 7.3 Remove Dead Code

Search the entire codebase for:
- Unused imports (run `npm run lint` and fix all warnings)
- `src/lib/anthropic.ts` — this file references Anthropic SDK which was removed. **Delete this file entirely**.
- Any commented-out code blocks
- Console.log statements (except in catch blocks where they serve as error logging)

### 7.4 Consolidate the Double Reducer Call

In `src/lib/store.tsx`, the `TOGGLE_BATCH_IMAGE` handler (around line 530) calls `reducer(stateRef.current, action)` manually to compute the new state for IndexedDB save. This is inelegant. Refactor to use a `useEffect` that watches `state.batch.images` and saves to IndexedDB when it changes, eliminating the manual reducer call.

---

## SECTION 8 — PERFORMANCE

### 8.1 Image Optimization

Large data URLs are stored in state and passed as `src` attributes. This causes re-renders to be expensive. Optimize:
- Use `URL.createObjectURL()` for generated images instead of data URLs where possible
- Add `loading="lazy"` to images in the batch preview grid
- Add `decoding="async"` to all `<img>` tags in the compose canvas

### 8.2 Memoize Expensive Components

The compose page re-renders on every drag event. Memoize:
- `BatchPreviewGrid` with `React.memo`
- `TextStylePanel` with `React.memo`
- `ProductImageControls` with `React.memo`
- The batch preview thumbnails in compose

### 8.3 Debounce Slider Inputs

The font size, scale, opacity, and rotation sliders dispatch on every `onChange` event. This fires 60+ dispatches during a single slider drag. The store already debounces history snapshots, but the actual renders still fire.

Add a `useDebouncedDispatch` hook that batches rapid dispatches:
```ts
function useDebouncedDispatch(dispatch: Dispatch, delay = 16) {
  const pending = useRef<Action | null>(null)
  const timer = useRef<number>()
  return useCallback((action: Action) => {
    pending.current = action
    if (!timer.current) {
      timer.current = requestAnimationFrame(() => {
        if (pending.current) dispatch(pending.current)
        timer.current = undefined
      })
    }
  }, [dispatch, delay])
}
```

Apply to all slider-driven dispatches in the compose controls.

---

## SECTION 9 — LANDING PAGE UPGRADE

The landing page (`src/app/page.tsx`) is minimal. Upgrade it:

### 9.1 Visual Improvements
- Add a subtle gradient or animated background (CSS only, no JS)
- Make the step overview cards more visually distinct with icons
- Add a "Powered by Gemini + Nano Banana Pro" footer badge (already exists, verify styling)

### 9.2 Recent Projects
- If project history exists (Section 6.3), show thumbnails below the hero
- "Continue where you left off" card if an active project exists in localStorage

### 9.3 Example Output
- Add a static example ad image in the `public/` folder showing what the tool produces
- Show it on the landing page as social proof: "Here's what you can create"

---

## FINAL VERIFICATION

After ALL changes:

1. Run `npm run build` — must compile with ZERO errors.
2. Run `npm run lint` — fix all warnings.
3. Verify every step works:
   - Step 1: Paste URL → scrape → product card + research → concepts
   - Step 2: Pick platform + layout + contrast
   - Step 3: Generate prompts → pick one
   - Step 4: Generate 3 images → pick 2
   - Step 5: Generate headlines → pick 2
   - Step 6: Compose with TransformBox handles, drag, resize, edit text
   - Step 7: Export all 4 combos, download individually + grid
4. Verify resume flow: reload page → banner shows → click Resume → lands on correct step
5. Verify Start Fresh: click Start Fresh → modal appears → confirm → clean slate
6. Read back every new file you created and verify it's complete and correct.
