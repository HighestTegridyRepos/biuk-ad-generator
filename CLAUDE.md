# BIUK Ad Generator

Next.js app that generates professional ad creatives from a product URL. Deployed on Vercel.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm test` (vitest)
- Lint: `npm run lint`

## Architecture
```
src/app/api/pipeline/
  create/route.ts        — Main pipeline (865+ lines): scrape → classify → image gen → composite
  preview-scenes/route.ts — Background preview generator
src/lib/
  product-intelligence.ts — Scene DNA library, product classification, Supabase cache
  gemini.ts              — Google AI client, model constants (Nano Banana Pro, Flash)
  prompts.ts             — Prompt engineering for concepts, copy, image prompts
  layout-templates.ts    — 8 layout templates (center-overlay, before-after-quad, checklist, etc.)
  supabase.ts            — Cache layer + URL normalization
  parse-json.ts          — Balanced-brace JSON extraction from AI responses
src/app/                 — Next.js pages (step-by-step UI, mostly unused — API is primary)
```

## Patterns
- `@napi-rs/canvas` for server-side rendering — NOT `canvas` (node-canvas). Ghost text bug on Vercel.
- Green screen chroma-key for product bg removal: Gemini puts product on #00FF00, we key it transparent.
- DejaVu Sans fonts bundled in `public/fonts/`, registered at render time.
- `imagePromptOverride` field bypasses Scene DNA for direct scene control.
- Three render functions: `renderAdServerSide` (standard), `renderBeforeAfterQuad`, `renderChecklist`.
- Pipeline auth: `X-Pipeline-Key` header checked against `PIPELINE_API_KEY` env or `"specter-2026"`.
- `GEMINI_API_KEY` env var (not GOOGLE_API_KEY).

## Gotchas
- `before-after-quad` and `checklist` layouts skip Steps 1-3 (concept/image gen) — separate pipeline paths with early return.
- `renderBeforeAfterQuad` accepts `accentColor` param for banner theming.
- Scene DNA `selectScene()` cycles through pool to avoid repetition — pass `usedScenes` array.
- Product intelligence is cached in Supabase — delete cache row if classification is wrong.
- Build takes ~15s. Canvas native bindings can fail on wrong Node version — use v22.
