# Ad Creator — Phase 2: Canva-Style Editor + Background Removal Fix

Read HANDOFF.md and CLAUDE-CODE-FIXES.md first for context. This prompt adds two major features on top of (or alongside) the Phase 1 fixes.

**Rules:**
- Run `npm run build` after each major change.
- Do NOT touch API routes or Gemini prompts unless specified.
- Do NOT add dependencies beyond what's absolutely needed.
- Preserve all existing 7-step pipeline behavior.

---

## FEATURE A — Canva-Style Resize Handles on All Canvas Elements

### What It Is

Right now the compose canvas (`src/app/create/compose/page.tsx`) only supports click-to-select and drag-to-move for the text block and product image. There are NO resize handles. The user wants to click any element and see Canva-style transform handles: corner handles to resize, edge handles to stretch, and a visual bounding box.

### What To Build

Create a reusable `TransformBox` component at `src/components/TransformBox.tsx` that wraps any canvas element and provides:

1. **Selection border** — thin blue/accent border when selected (already partially exists via `selectionRing`)
2. **8 resize handles** — small circles (8×8px) at 4 corners + 4 edge midpoints
3. **Corner drag = proportional resize** (maintains aspect ratio)
4. **Edge drag = stretch** in one dimension only
5. **The existing drag-to-move** still works when grabbing the body (not a handle)

### TransformBox Component API

```tsx
interface TransformBoxProps {
  /** Whether this element is currently selected */
  selected: boolean
  /** Position in canvas coordinates (not screen pixels) */
  position: { x: number; y: number }
  /** Size in canvas coordinates */
  size: { width: number; height: number }
  /** The preview scale factor (canvas coords → screen pixels) */
  scale: number
  /** Called when the user drags the body to move */
  onMove: (pos: { x: number; y: number }) => void
  /** Called when the user drags a handle to resize */
  onResize: (rect: { x: number; y: number; width: number; height: number }) => void
  /** Called when user clicks this element */
  onSelect: () => void
  /** Minimum size in canvas coords */
  minSize?: { width: number; height: number }
  /** Whether to lock aspect ratio on corner drag (default: true) */
  lockAspectRatio?: boolean
  /** The child element to render inside the box */
  children: React.ReactNode
}
```

### Implementation Details

**Handle positions** (relative to the bounding box):
- `nw` (top-left corner), `ne` (top-right), `sw` (bottom-left), `se` (bottom-right)
- `n` (top center), `s` (bottom center), `w` (left center), `e` (right center)

**Handle appearance:**
- 8×8px white circles with 1px dark border
- On hover: scale up slightly and show cursor appropriate to direction (`nwse-resize`, `nesw-resize`, `ew-resize`, `ns-resize`)
- Selected border: 2px `var(--accent)` (blue/purple) with dashed pattern

**Drag logic:**
- All drag handling should use pointer events (mousedown/mousemove/mouseup + touchstart/touchmove/touchend)
- Convert screen coordinates to canvas coordinates by dividing by `scale`
- Corner handles: calculate new width/height while maintaining aspect ratio. The opposite corner stays fixed.
- Edge handles: only change one dimension. The opposite edge stays fixed.
- Clamp to minimum size (default 40×20 canvas pixels)
- Clamp to canvas bounds (0,0 to canvas width,height)

**Move logic:**
- When user mousedowns on the body (not a handle), start a move drag
- Same as current behavior but integrated into TransformBox

### Integration Into Compose Page

In `src/app/create/compose/page.tsx`:

**For the text block:**
- Wrap the text overlay `<div>` in `<TransformBox>`.
- The text block's size needs to be tracked. Add `textSize: { width: number; height: number }` to the composition state in `src/types/ad.ts` and the store. Default to `{ width: width * 0.8, height: 200 }`.
- Add `UPDATE_COMPOSITION` support for `textSize`.
- On resize, update `textSize`. The font size should NOT auto-scale on resize — the text block is a container, and text reflows within it. But `maxWidth` of the text should follow the box width.
- On move, dispatch `SET_TEXT_POSITION` as before.

**For the product image:**
- Wrap the product image `<div>` in `<TransformBox>`.
- The product image already has `position` and `scale`. On resize from TransformBox, convert the new width back to a `scale` value relative to the original image dimensions.
- On move, dispatch `UPDATE_PRODUCT_IMAGE` with new position.
- Set `lockAspectRatio: true` for the product image (don't let it stretch non-proportionally).

**For the CTA button:**
- The CTA is currently part of the text block group. For Phase 2, keep it grouped with the text block (both move together). But the CTA DOES get its own resize handles when it's double-clicked/selected separately.
- This is a stretch goal — if it's too complex to separate the CTA, skip it and leave it grouped with the headline.

### State Changes

In `src/types/ad.ts`, add to `AdProject["composition"]`:
```ts
textSize?: { width: number; height: number }
```

In `src/lib/store.tsx`, handle `textSize` in `UPDATE_COMPOSITION` (already handled generically via spread).

### What NOT To Build
- No rotation handles (rotation is already handled by the slider for product image, and text doesn't need rotation)
- No multi-select (selecting multiple elements at once)
- No snap-to-grid or smart guides (nice to have later)
- No z-order controls (text is always above product image)

### Export Compatibility

The export page (`src/app/create/export/page.tsx`) renders to a `<canvas>`. Make sure the `textSize` is used there too — the headline text should be rendered within the `textSize.width` constraint using `ctx.measureText` and manual word wrapping. Check the existing export canvas rendering logic and update it to respect `textSize.width` for text wrapping.

### Batch Preview Compatibility

The 2×2 batch mini-previews also need to reflect the `textSize` — scale the `maxWidth` on the text overlay div by `miniScale` the same way other dimensions are scaled.

---

## FEATURE B — Fix Background Removal (Product Image Cutout)

### The Problem

The product image in the compose canvas shows with its original background (white box behind the ProFoam can). The background removal either:
1. Never ran (async cutout generation during scrape failed silently)
2. Ran but the result wasn't saved properly
3. The cutout URL exists but the product layer is using the hero URL instead

### Debugging Steps

First, check the current state of affairs:

1. Look at `src/app/api/scrape-product/route.ts` — find where it triggers async background removal. The scrape route likely fires a background removal request and saves the result to Supabase, but if it fails there's no retry.

2. In `src/app/create/compose/page.tsx` line 31: `const productImageUrl = project.brief.productCutoutUrl || project.brief.productHeroUrl`. This falls back to the hero URL if no cutout exists. Check if `productCutoutUrl` is ever getting set.

3. The "Remove Background" button in the compose sidebar (around line 768-785) calls `/api/remove-background` directly. This should work as a manual fallback. But it only shows when `productHeroUrl` exists and `productCutoutUrl` does NOT exist.

### Fixes To Apply

**Fix B1 — Auto-trigger background removal if cutout is missing when compose loads:**

In `compose/page.tsx`, add a `useEffect` that checks on mount:
```ts
useEffect(() => {
  // If we have a hero image but no cutout, automatically try to remove the background
  if (project.brief.productHeroUrl && !project.brief.productCutoutUrl && !removingBg) {
    const autoRemoveBg = async () => {
      setRemovingBg(true)
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
        }
      } catch {
        // Silent fail — user can use manual button
      } finally {
        setRemovingBg(false)
      }
    }
    autoRemoveBg()
  }
}, []) // Only on mount — don't re-trigger on state changes
```

**Fix B2 — Show clear status indicator for background removal:**

Near the product image controls in the compose sidebar, add a status indicator:
```tsx
{removingBg && (
  <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400">
    <div className="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
    Removing background…
  </div>
)}
```

**Fix B3 — When cutout arrives, auto-switch the product layer to use it:**

This logic already exists (lines 51-64 in compose/page.tsx) via the `prevCutoutUrl` ref. Verify it works by checking:
- Does `project.brief.productCutoutUrl` actually update when the background removal finishes?
- Is `productLayer.url` still pointing to `productHeroUrl`? If so, the auto-upgrade effect should fire.

The existing code checks `productLayer.url === project.brief.productHeroUrl` before upgrading. This should work. If the cutout is being saved but not applied, the issue might be a timing race where `productLayer` gets set before the cutout URL propagates.

**Fix B4 — Retry button with better UX:**

Update the "Remove Background" button to handle failure states:
```tsx
{!project.brief.productCutoutUrl && project.brief.productHeroUrl && (
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
)}
```

Add `bgRemovalFailed` state that gets set to `true` in the catch block.

---

## Final Checklist

After all changes:
1. `npm run build` must pass with zero errors.
2. TransformBox handles must be visible and interactive on both text and product image.
3. Resizing text block changes its width constraint, NOT the font size.
4. Resizing product image changes its scale proportionally.
5. Background removal auto-triggers on compose mount when no cutout exists.
6. Background removal has clear loading/error states.
7. The export page still renders correctly (canvas rendering respects textSize).
8. The 2×2 batch preview still renders correctly (mini-previews respect textSize).
9. Drag-to-move still works exactly as before (just now via TransformBox instead of raw event handlers).
