
import { NextRequest, NextResponse } from "next/server"
import { analyzeProduct, selectScene, buildPhotographyPrompt, ProductIntelligence } from "@/lib/product-intelligence"
import { getGeminiClient, GEMINI_PRO, GEMINI_FLASH, generateText, describeImageWithVision } from "@/lib/gemini"
import {
  CONCEPT_SYSTEM_PROMPT,
  buildConceptUserPrompt,
  IMAGE_PROMPT_SYSTEM_PROMPT,
  buildImagePromptUserPrompt,
  COPY_SYSTEM_PROMPT,
  buildCopyUserPrompt,
} from "@/lib/prompts"
import { platformSpecs } from "@/lib/platforms"
import { layoutTemplates, getMessageZonePosition } from "@/lib/layout-templates"
import { extractJSON } from "@/lib/parse-json"
import { logInfo, logWarn } from "@/lib/logger"
import { renderOverlayPng } from "@/lib/render/text-render"
import { renderBeforeAfterQuad } from "@/lib/render/before-after"
import { renderChecklist } from "@/lib/render/checklist"
import { getFormatRenderer, isValidFormat, type FormatName, type FormatConfig } from "@/lib/render/formats"
import { generateFormatImages } from "@/lib/format-image-gen"
import {
  checkExistingTransparency,
  removeWhiteBackground,
  removeBackground,
  cleanCheckerboardArtifacts,
  removeBackgroundFromUrl,
} from "@/lib/image-ops"
import type { ConceptAngle, Platform } from "@/types/ad"
import { v4 as uuid } from "uuid"
const ROUTE_NAME = "pipeline/create"

// ── Auth ──────────────────────────────────────────────────────────

function checkApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-Pipeline-Key")
  return apiKey === process.env.PIPELINE_API_KEY || apiKey === "specter-2026"
}

// ── Types ─────────────────────────────────────────────────────────

interface CalloutInput {
  text: string
  anchorX?: number  // optional anchor override as fraction 0-1 of canvas width
  anchorY?: number  // optional anchor override as fraction 0-1 of canvas height
}

interface PipelineRequest {
  brief: string
  platform?: Platform
  layout?: string
  contrast?: string
  callouts?: CalloutInput[]
  imageModel?: string
  count?: number
  productUrl?: string
  bannerColor?: string
  bannerText?: string
  headlineOverride?: string
  subheadOverride?: string
  imagePromptOverride?: string
  sceneId?: string
  backgroundImageDataUrl?: string
  beforeAfterScenes?: Array<{ dirtyImageDataUrl: string; cleanImageDataUrl: string }>
  checklistImages?: Array<{ imageDataUrl:string; label: string }>
  checklistItems?: string[]
  bannerStyle?: "trustpilot" | "gold"
  socialProofText?: string
  accentColor?: string
  productImageUrl?: string  // Direct product image URL — bypasses scraping
  // ── Format system (6 new layout formats) ──
  format?: string
  problemPhotos?: string[]
  beforePhoto?: string
  afterPhoto?: string
  backgroundPhoto?: string
  accentText?: { line1: string; line2: string }
  badgeText?: string
  productCategory?: string  // Scene DNA category key (e.g., "mould-remover", "kitchen-degreaser")
}

interface HeadlineVariation {
  id: string
  headline: string
  subhead?: string | null
  cta: string
  hookMechanism?: string
}

interface PipelineResponse {
  concepts: ConceptAngle[]
  selectedConcept: ConceptAngle
  imagePrompt: string
  generatedImageUrl: string
  imageDescription: string
  headlines: HeadlineVariation[]
  selectedHeadline: HeadlineVariation
  finalAds: Array<{
    imageDataUrl: string
    label: string
    headline: string
    subhead?: string | null
    cta: string
    callouts: Array<{ text: string; position: { x: number; y: number }; anchorPoint: { x: number; y: number } }>
  }>
}


// ── Auto-position callouts on the image ──────────────────────────

function autoPositionCallouts(
  calloutInputs: CalloutInput[],
  width: number,
  height: number,
  productBounds?: { x: number; y: number; w: number; h: number } | null
): Array<{ text: string; position: { x: number; y: number }; anchorPoint: { x: number; y: number } }> {
  // Final callout placement — RED-approved zigzag (L-R-L-R)
  // All values stored as proportions, reference is 1080×1080

  // Bubble size: 190×76px at 1080
  const s = width / 1080
  const bubbleW = Math.round(190 * s)
  const bubbleH = Math.round(76 * s)
  const halfW = Math.round(bubbleW / 2)
  const halfH = Math.round(bubbleH / 2)

  // Column centers
  const leftCenterX = Math.round(160 * s)
  const rightCenterX = Math.round(920 * s)

  // Vertical zones — relative to headline zone bottom and banner top
  const headlineZoneBottom = Math.round(height * 0.194)  // ~210px at 1080
  const bannerTop = height - Math.round(height * 0.09)   // ~85px banner
  const zoneEnd = bannerTop - Math.round(60 * s)

  const leftZoneTop = headlineZoneBottom + Math.round(130 * s)
  const rightZoneTop = headlineZoneBottom + Math.round(80 * s)
  const leftZoneH = zoneEnd - leftZoneTop
  const rightZoneH = zoneEnd - rightZoneTop

  // Bubble center Y positions within their zones
  const topLeftY = Math.round(leftZoneTop + leftZoneH * 0.22)
  const topRightY = Math.round(rightZoneTop + rightZoneH * 0.30)
  const bottomLeftY = Math.round(leftZoneTop + leftZoneH * 0.68)
  const bottomRightY = Math.round(rightZoneTop + rightZoneH * 0.75)

  // Product anchor zone — the visible bottle body (not cutout with transparent padding)
  // Product is always horizontally centered. Visible body is ~20-25% of canvas width.
  // Use a tighter zone than the full cutout bounds.
  const productCenterX = Math.round(width / 2)
  const visibleProductHalfW = productBounds
    ? Math.round(productBounds.w * 0.35)  // ~35% of cutout width = visible bottle body
    : Math.round(width * 0.12)            // ~12% from center
  const productLeftEdge = productCenterX - visibleProductHalfW + Math.round(15 * s)
  const productRightEdge = productCenterX + visibleProductHalfW - Math.round(15 * s)
  const productTop = productBounds ? productBounds.y : headlineZoneBottom + Math.round(20 * s)
  const productBottom = productBounds ? productBounds.y + productBounds.h : bannerTop - Math.round(50 * s)
  const productH = productBottom - productTop
  // Connector anchors land directly ON the product edge (no inset)
  const positions = [
    // top-left bubble → product left edge, 18% down product height
    { cx: leftCenterX, cy: topLeftY,
      ax: productLeftEdge, ay: productTop + Math.round(productH * 0.18) },
    // top-right bubble → product right edge, 35% down product height
    { cx: rightCenterX, cy: topRightY,
      ax: productRightEdge, ay: productTop + Math.round(productH * 0.35) },
    // bottom-left bubble → product left edge, 62% down product height
    { cx: leftCenterX, cy: bottomLeftY,
      ax: productLeftEdge, ay: productTop + Math.round(productH * 0.62) },
    // bottom-right bubble → product right edge, 82% down product height
    { cx: rightCenterX, cy: bottomRightY,
      ax: productRightEdge, ay: productTop + Math.round(productH * 0.82) },
  ]

  return calloutInputs.map((callout, i) => {
    const pos = positions[i % positions.length]
    return {
      text: callout.text,
      // position = top-left corner of bubble
      position: {
        x: pos.cx - halfW,
        y: pos.cy - halfH,
      },
      anchorPoint: {
        x: callout.anchorX !== undefined ? callout.anchorX * width : pos.ax,
        y: callout.anchorY !== undefined ? callout.anchorY * height : pos.ay,
      },
    }
  })
}


// ── Product image helpers ─────────────────────────────────────────

async function scrapeProductHeroImage(productUrl: string): Promise<string | null> {
  try {
    const res = await fetch(productUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`Failed to fetch product page: ${res.status}`)
    const html = await res.text()

    // Helper: upgrade Shopify thumbnail URLs to full-res
    function upgradeShopifyImageUrl(url: string): string {
      return url.replace(/_(200x|300x|400x|500x|600x|700x|800x)(\.[a-z]+)(\?|$)/i, "_1200x$2$3")
    }

    // Try JSON-LD first
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, "").replace(/<\/script>/, "")
          const data = JSON.parse(jsonStr)
          const product = data["@type"] === "Product" ? data : data["@graph"]?.find((item: Record<string, string>) => item["@type"] === "Product")
          if (product?.image) {
            const images = Array.isArray(product.image) ? product.image : [product.image]
            const first = images.find((img: unknown): img is string => typeof img === "string")
            if (first) return upgradeShopifyImageUrl(new URL(first, productUrl).href)
          }
        } catch { /* continue */ }
      }
    }

    // Try Open Graph
    const ogMatch = html.match(/<meta[^>]*(?:property)=["']og:image["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*(?:property)=["']og:image["']/i)
    if (ogMatch?.[1]) return upgradeShopifyImageUrl(new URL(ogMatch[1], productUrl).href)

    // Try twitter image
    const twMatch = html.match(/<meta[^>]*(?:name)=["']twitter:image["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*(?:name)=["']twitter:image["']/i)
    if (twMatch?.[1]) return upgradeShopifyImageUrl(new URL(twMatch[1], productUrl).href)

    return null
  } catch (err) {
    logWarn(ROUTE_NAME, `Product scrape failed: ${(err as Error).message}`)
    return null
  }
}


async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`fetchBuffer: HTTP ${res.status} for ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(request: NextRequest) {
  logInfo(ROUTE_NAME, "Pipeline request received")

  if (!checkApiKey(request)) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  let body: PipelineRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { brief, platform = "ig-feed-square", layout = "center-overlay", contrast = "gradient", callouts = [], imageModel, bannerColor: reqBannerColor, bannerText: reqBannerText, productUrl = null } = body as PipelineRequest
  const bannerColor = reqBannerColor || "#D4C96B"
  const bannerText = reqBannerText || "SUBSCRIBE & SAVE 20%"
  const headlineOverride = body.headlineOverride || null
  const subheadOverride = body.subheadOverride || null
  const imagePromptOverride = body.imagePromptOverride || null
  const backgroundImageDataUrl = body.backgroundImageDataUrl || null
  const sceneId = body.sceneId || null
  const beforeAfterScenes = body.beforeAfterScenes || null
  const checklistImages = body.checklistImages || null
  const checklistItems = body.checklistItems || null
  const bannerStyle = body.bannerStyle || (layout === "before-after-quad" ? "trustpilot" : "gold")
  const socialProofText = body.socialProofText || "SUBSCRIBE & SAVE 20%"
  const accentColor = body.accentColor || "#4AADE0"
  const productImageUrl = body.productImageUrl || null  // Direct product image URL — bypasses scraping
  const format = (body.format && isValidFormat(body.format)) ? body.format as FormatName : null

  // Format requests only need productImageUrl + headline + bannerColor (no brief required)
  if (!format && layout !== "before-after-quad" && layout !== "checklist" && (!brief || typeof brief !== "string" || brief.trim().length < 10)) {
    return NextResponse.json({ error: "A brief (string, min 10 chars) is required" }, { status: 400 })
  }

  // Get platform spec
  const platformSpec = platformSpecs[platform as Platform]
  if (!platformSpec) {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }
  const { width, height, safeZones } = platformSpec

  // Get layout template
  const template = layoutTemplates.find((t) => t.id === layout) ?? layoutTemplates.find((t) => t.id === "center-overlay")!
  const { messageZone } = template.getZones(width, height, safeZones)
  const messageZonePosition = getMessageZonePosition(messageZone, width, height)

  try {
    // Before-After-Quad early return path
    if (layout === "before-after-quad") {
      return NextResponse.json({ error: "Layout 'before-after-quad' is temporarily disabled." }, { status: 501 });
    }

    // ── CHECKLIST: separate pipeline path ───────────────────────────
    if (layout === "checklist") {
      return NextResponse.json({ error: "Layout 'checklist' is temporarily disabled." }, { status: 501 });
    }

    // ── FORMAT FAST PATH: skip Gemini if format + productImageUrl + headlineOverride ──
    if (format && productImageUrl && headlineOverride) {
      logInfo(ROUTE_NAME, `Format path: ${format}`)
      const renderer = getFormatRenderer(format)
      try {
        // Fetch product image
        const res = await fetch(productImageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible)" },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) throw new Error(`fetch ${res.status}`)
        const productImageBuffer = Buffer.from(await res.arrayBuffer())

        // Generate background images if not provided
        const bufToDataUrl = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`
        let bgPhoto = body.backgroundPhoto
        let beforePh = body.beforePhoto
        let afterPh = body.afterPhoto
        let problemPh = body.problemPhotos

        const needsBg = !bgPhoto && !beforePh && !afterPh && (!problemPh || problemPh.length === 0)
        if (needsBg) {
          logInfo(ROUTE_NAME, `Generating AI background images for format: ${format}`)
          const genImages = await generateFormatImages(format, headlineOverride, body.imageModel as string | undefined, body.productCategory || undefined)
          if (genImages.backgroundPhoto) bgPhoto = bufToDataUrl(genImages.backgroundPhoto)
          if (genImages.beforePhoto) beforePh = bufToDataUrl(genImages.beforePhoto)
          if (genImages.afterPhoto) afterPh = bufToDataUrl(genImages.afterPhoto)
          if (genImages.problemPhotos && genImages.problemPhotos.length > 0) {
            problemPh = genImages.problemPhotos.map(bufToDataUrl)
          }
        }

        const formatConfig: FormatConfig = {
          width, height, productImageBuffer,
          headline: headlineOverride,
          bannerColor, bannerText,
          problemPhotos: problemPh,
          beforePhoto: beforePh,
          afterPhoto: afterPh,
          backgroundPhoto: bgPhoto,
          accentText: body.accentText,
          subheadline: body.subheadOverride || undefined,
          checklistItems: body.checklistItems,
          badgeText: body.badgeText,
        }
        const finalBuffer = await renderer(formatConfig)
        const imageDataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`
        return NextResponse.json({
          format, imageDataUrl, headline: headlineOverride, bannerColor,
          finalAds: [{ imageDataUrl, label: format, headline: headlineOverride, subhead: null, cta: "SHOP NOW", callouts: [] }],
          _debug: { format, rendered: true, aiBackgroundGenerated: needsBg }
        })
      } catch (e: any) {
        logWarn(ROUTE_NAME, `Format path failed: ${e.message}`)
        return NextResponse.json({ error: `Format render failed: ${e.message}` }, { status: 500 })
      }
    }

    // ── STEP 1: Generate concepts ─────────────────────────────────
    logInfo(ROUTE_NAME, "Step 1: Generating concepts")
    const conceptUserPrompt = buildConceptUserPrompt(brief)
    const conceptRaw = await generateText(GEMINI_PRO, CONCEPT_SYSTEM_PROMPT, conceptUserPrompt, 60_000)
    const conceptData = extractJSON<{ angles: ConceptAngle[] }>(conceptRaw)
    const concepts = conceptData.angles ?? []
    if (concepts.length === 0) {
      return NextResponse.json({ error: "Failed to generate concepts" }, { status: 502 })
    }
    const selectedConcept = concepts[0]
    logInfo(ROUTE_NAME, `Step 1 done: selected concept "${selectedConcept.hook}"`)

    // ── STEP 0.5: Product Intelligence ───────────────────────────
    let productIntel: ProductIntelligence | null = null
    if (productUrl) {
      logInfo(ROUTE_NAME, "Step 0.5: Analyzing product")
      try {
        productIntel = await analyzeProduct(productUrl, generateText, extractJSON)
        logInfo(ROUTE_NAME, `Step 0.5 done: ${productIntel.name} → ${productIntel.category}`)
      } catch (err) {
        logWarn(ROUTE_NAME, `Product intelligence failed: ${(err as Error).message}`)
      }
    }

    // ── STEP 2: Generate image prompt ────────────────────────────
    logInfo(ROUTE_NAME, "Step 2: Building image prompt")
    let imagePromptText: string

    if (imagePromptOverride) {
      // Direct image prompt override — highest priority
      const aspectRatio = width === height ? "1:1" : `${width}:${height}`
      imagePromptText = buildPhotographyPrompt(imagePromptOverride, aspectRatio)
      logInfo(ROUTE_NAME, `Step 2: Using image prompt override`)
    } else if (productIntel) {
      // Product Intelligence path: Scene DNA + Photography Spec
      const scene = selectScene(productIntel)
      const aspectRatio = width === height ? "1:1" : `${width}:${height}`
      imagePromptText = buildPhotographyPrompt(scene, aspectRatio)
      logInfo(ROUTE_NAME, `Step 2: Using Scene DNA — category: ${productIntel.category}, scene: "${scene.slice(0, 60)}..."`)
    } else {
      // Fallback: generic image prompt generation (existing flow)
      const imgPromptUserPrompt = buildImagePromptUserPrompt(
        selectedConcept,
        messageZonePosition,
        width,
        height,
        contrast
      )
      const imgPromptRaw = await generateText(GEMINI_FLASH, IMAGE_PROMPT_SYSTEM_PROMPT, imgPromptUserPrompt, 30_000)
      const imgPromptData = extractJSON<{ prompts: Array<{ id: string; text: string; rank: number }> }>(imgPromptRaw)
      const imagePrompts = imgPromptData.prompts ?? []
      if (imagePrompts.length === 0) {
        return NextResponse.json({ error: "Failed to generate image prompts" }, { status: 502 })
      }
      const bestPrompt = imagePrompts.find((p) => p.rank === 1) ?? imagePrompts[0]
      imagePromptText = bestPrompt.text
      imagePromptText += ". Ultra photorealistic photograph. Shot on Canon EOS R5 with 35mm f/1.4 lens. Shallow depth of field. Natural dramatic lighting. 4K resolution, razor sharp textures. Professional commercial photography. No text, no logos, no watermarks, no borders, no artifacts, no empty spaces."
    }
    logInfo(ROUTE_NAME, "Step 2 done")
    const imagePrompt = imagePromptText  // Alias for response

    // ── STEP 3: Generate image ────────────────────────────────────
    let imageBase64: string | null = null
    let imageMimeType = "image/png"

    if (backgroundImageDataUrl) {
      // Pre-generated background — skip Gemini image generation
      const match = backgroundImageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({ error: "Invalid backgroundImageDataUrl format" }, { status: 400 })
      }
      imageMimeType = match[1]
      imageBase64 = match[2]
      if (sceneId) logInfo(ROUTE_NAME, `Step 3: Using pre-generated background (sceneId: ${sceneId})`)
      else logInfo(ROUTE_NAME, "Step 3: Using pre-generated background image")
    } else {
      logInfo(ROUTE_NAME, "Step 3: Generating image")
      const activeImageModel = imageModel ?? "gemini-3-pro-image-preview"
      const ai = getGeminiClient()

      const imageResponse = await ai.models.generateContent({
        model: activeImageModel,
        contents: [{ role: "user", parts: [{ text: imagePromptText }] }],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      })

      const imageParts = imageResponse.candidates?.[0]?.content?.parts
      if (!imageParts) {
        return NextResponse.json({ error: "Image generation returned no response" }, { status: 502 })
      }

      for (const part of imageParts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data ?? null
          imageMimeType = part.inlineData.mimeType ?? "image/png"
          break
        }
      }

      if (!imageBase64) {
        return NextResponse.json({ error: "Image model did not return an image" }, { status: 422 })
      }
    }
    const generatedImageUrl = `data:${imageMimeType};base64,${imageBase64}`
    logInfo(ROUTE_NAME, "Step 3 done")

    // ── STEP 4: Describe image ────────────────────────────────────
    logInfo(ROUTE_NAME, "Step 4: Describing image")
    const DESCRIBE_SYSTEM = `You are describing an ad image for a copywriter. Your description will be used to write headlines that COMPLEMENT the image — not repeat it. Describe the scene, mood, colors, subjects, composition, and emotional tone in 2-3 sentences. Do NOT describe text, logos, or UI elements.`
    const imageDescription = await describeImageWithVision(
      GEMINI_FLASH,
      imageBase64,
      imageMimeType,
      DESCRIBE_SYSTEM,
      "Describe this ad image for a copywriter. Return only the description, no JSON.",
      30_000
    )
    logInfo(ROUTE_NAME, "Step 4 done")

    // ── STEP 5: Generate headlines (skip if override provided) ────
    let headlines: HeadlineVariation[]
    let selectedHeadline: HeadlineVariation

    if (headlineOverride) {
      logInfo(ROUTE_NAME, "Step 5: Using headline override — skipping copy generation")
      const overrideVariation: HeadlineVariation = {
        id: uuid(),
        headline: headlineOverride,
        subhead: subheadOverride ?? null,
        cta: "SHOP NOW",
        hookMechanism: "override",
      }
      headlines = [overrideVariation]
      selectedHeadline = overrideVariation
    } else {
      logInfo(ROUTE_NAME, "Step 5: Generating headlines")
      const copyUserPrompt = buildCopyUserPrompt(
        selectedConcept,
        imageDescription,
        messageZonePosition,
        contrast
      )
      const copyRaw = await generateText(GEMINI_PRO, COPY_SYSTEM_PROMPT, copyUserPrompt, 30_000)
      const copyData = extractJSON<{ variations: HeadlineVariation[] }>(copyRaw)
      headlines = copyData.variations ?? []
      if (headlines.length === 0) {
        return NextResponse.json({ error: "Failed to generate headlines" }, { status: 502 })
      }
      selectedHeadline = headlines[0]
    }
    logInfo(ROUTE_NAME, "Step 5 done")

    // ── STEP 5.5 PREP: Build finalAds array from selected headline ──
    const finalAds: Array<{
      imageDataUrl: string
      label: string
      headline: string
      subhead?: string | null
      cta: string
      callouts: Array<{ text: string; position: { x: number; y: number }; anchorPoint: { x: number; y: number } }>
    }> = [
      {
        imageDataUrl: "",
        label: "Ad",
        headline: selectedHeadline.headline,
        subhead: selectedHeadline.subhead ?? null,
        cta: selectedHeadline.cta,
        callouts: [],
      },
    ]

    // ── STEP 5.5: Get product image + background removal ────
    let productCutoutBase64: string | null = null
    
    // Priority 1: Direct product image URL (bypasses scraping entirely)
    if (productImageUrl) {
      logInfo(ROUTE_NAME, `Step 5.5: Using direct product image URL: ${productImageUrl}`)
      try {
        const imgRes = await fetch(productImageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(15000),
        })
        if (imgRes.ok) {
          const imgBuf = Buffer.from(await imgRes.arrayBuffer())
          const alreadyTransparent = await checkExistingTransparency(imgBuf)
          if (alreadyTransparent) {
            productCutoutBase64 = alreadyTransparent.toString("base64")
            logInfo(ROUTE_NAME, "Step 5.5: Direct image already has transparency")
          } else {
            const whiteBgCutout = await removeWhiteBackground(imgBuf)
            if (whiteBgCutout) {
              productCutoutBase64 = whiteBgCutout.toString("base64")
              logInfo(ROUTE_NAME, "Step 5.5: Direct image white-bg removal succeeded")
            } else {
              productCutoutBase64 = imgBuf.toString("base64")
              logInfo(ROUTE_NAME, "Step 5.5: Using direct image as-is")
            }
          }
        }
      } catch (e) {
        logWarn(ROUTE_NAME, `Step 5.5: Failed to fetch direct product image: ${(e as Error).message}`)
      }
    }
    
    // Priority 2: Scrape from product URL
    if (!productCutoutBase64 && productUrl) {
      logInfo(ROUTE_NAME, "Step 5.5: Scraping product image")
      try {
        const heroImageUrl = await scrapeProductHeroImage(productUrl)
        if (heroImageUrl) {
          logInfo(ROUTE_NAME, `Step 5.5: Found hero image ${heroImageUrl}`)

          // Step 1: Fetch the image
          const imgRes = await fetch(heroImageUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(15000),
          })
          if (imgRes.ok) {
            const imgBuf = Buffer.from(await imgRes.arrayBuffer())

            // Check if image already has transparency (Shopify PNGs often do)
            logInfo(ROUTE_NAME, "Step 5.5: Checking for existing transparency")
            const alreadyTransparent = await checkExistingTransparency(imgBuf)
            if (alreadyTransparent) {
              productCutoutBase64 = alreadyTransparent.toString("base64")
              logInfo(ROUTE_NAME, "Step 5.5: Image already has transparency — using directly (no AI)")
            } else {
            // Try non-AI white-bg removal (fastest, zero artifacts)
            logInfo(ROUTE_NAME, "Step 5.5: Trying white-bg removal (no AI)")
            const whiteBgCutout = await removeWhiteBackground(imgBuf)
            if (whiteBgCutout) {
              productCutoutBase64 = whiteBgCutout.toString("base64")
              logInfo(ROUTE_NAME, "Step 5.5: White-bg removal succeeded (no AI needed)")
            } else {
              // Fallback: Gemini native bg removal
              logInfo(ROUTE_NAME, "Step 5.5: White-bg failed, trying Gemini native bg removal")
              const nativeCutout = await removeBackgroundFromUrl(heroImageUrl)
              if (nativeCutout) {
                // Gemini outputs checkerboard pixels instead of alpha — clean them
                productCutoutBase64 = await cleanCheckerboardArtifacts(nativeCutout)
                logInfo(ROUTE_NAME, "Step 5.5: Gemini native bg removal succeeded + checkerboard cleaned")
              } else {
                // Last resort: green-screen method
                logInfo(ROUTE_NAME, "Step 5.5: Native failed, trying green-screen fallback")
                const cleanCutout = await removeBackground(imgBuf)
                if (cleanCutout) {
                  productCutoutBase64 = cleanCutout.toString("base64")
                  logInfo(ROUTE_NAME, "Step 5.5: Green-screen bg removal succeeded")
                } else {
                  productCutoutBase64 = imgBuf.toString("base64")
                  logInfo(ROUTE_NAME, "Step 5.5: All bg removal failed — using original image")
                }
              }
            }
            } // close alreadyTransparent else
          }
        } else {
          logWarn(ROUTE_NAME, "Step 5.5: Could not find hero image — skipping product image")
        }
      } catch (productErr) {
        logWarn(ROUTE_NAME, `Step 5.5: Product image failed (${(productErr as Error).message}) — continuing without it`)
      }
    }


    // ── STEP 6: Compose final ad ──────────────────────────────────
    logInfo(ROUTE_NAME, "Step 6: Composing ad")

    const ad = finalAds[0]
    let compositionError: string | null = null
    const debugLogs: string[] = []

    // Compute actual product bounds for accurate callout anchor placement
    let productBounds: { x: number; y: number; w: number; h: number } | null = null
    if (productImageUrl) {
      try {
        const { default: sharpMod } = await import("sharp")
        const productCutoutBuffer = await fetchBuffer(productImageUrl)
        const tmpMeta = await sharpMod(productCutoutBuffer).metadata()
        const tmpImgW = tmpMeta.width ?? 200
        const tmpImgH = tmpMeta.height ?? 200
        const productAspect = tmpImgH / tmpImgW
        // Product fills space between headline zone and banner minus padding
        const bannerTopY = height - Math.round(height * 0.09)
        const headlineZoneBot = Math.round(height * 0.22)
        const verticalPad = 40  // 20px top + 20px bottom clearance
        const availH = bannerTopY - headlineZoneBot - verticalPad
        let tH = availH  // fill available space
        const tW = Math.round(tmpImgW * (tH / tmpImgH))
        const px = Math.round((width - tW) / 2)
        const py = headlineZoneBot + Math.round((availH - tH) / 2) + Math.round(verticalPad / 2)
        productBounds = { x: px, y: py, w: tW, h: tH }
      } catch(e) { 
        debugLogs.push(`Could not calculate product bounds: ${(e as Error).message}`)
      }
    }

    const positionedCallouts = autoPositionCallouts(callouts, width, height, productBounds)
    ad.callouts = positionedCallouts;
    
    try {
      const sharpModule = await import("sharp")
      const sharp = sharpModule.default
      const bgResponse = await fetch(generatedImageUrl)
      if (!bgResponse.ok) throw new Error("Failed to fetch generated background")
      const rawBgBuffer = Buffer.from(await bgResponse.arrayBuffer())
      const bgBuffer = await sharp(rawBgBuffer).resize(width, height, { fit: "cover" }).png().toBuffer()
      debugLogs.push(`Background buffer created, size: ${bgBuffer.length} bytes`)

      // Product layer FIRST (behind overlay so connector lines + text render on top)
      let layers: Array<{ input: Buffer; left: number; top: number }> = [];

      if (productImageUrl) {
        let productCutoutBuffer = await fetchBuffer(productImageUrl);
        // Safety net: clean checkerboard artifacts before compositing (catches any source)
        const cleanedB64 = await cleanCheckerboardArtifacts(productCutoutBuffer.toString("base64"))
        productCutoutBuffer = Buffer.from(cleanedB64, "base64")
        debugLogs.push(`Product cutout fetched + checkerboard cleaned, size: ${productCutoutBuffer.length} bytes`)
        const prodW = productBounds?.w ?? Math.round(width * 0.5)
        const prodH = productBounds?.h ?? Math.round(height * 0.5)
        const prodX = productBounds?.x ?? Math.round((width - prodW) / 2)
        const prodY = productBounds?.y ?? Math.round((height - prodH) / 2)
        // Resize product, trim transparent padding, then re-center on canvas
        const resizedProduct = await sharp(productCutoutBuffer)
          .resize(prodW, prodH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
        // Trim transparent edges so centering is based on visible pixels
        const trimmed = await sharp(resizedProduct).trim().toBuffer()
        const trimMeta = await sharp(trimmed).metadata()
        const finalW = trimMeta.width ?? prodW
        const finalH = trimMeta.height ?? prodH
        // Dead center: canvasWidth/2 - productWidth/2
        const centerX = Math.round((width - finalW) / 2)
        const centerY = prodY + Math.round((prodH - finalH) / 2)
        debugLogs.push(`Product resized to ${prodW}×${prodH}, trimmed to ${finalW}×${finalH}, placed at (${centerX},${centerY})`)
        layers.push({ input: trimmed, left: centerX, top: centerY })
      }

      // Overlay layer SECOND (on top of product — text, bubbles, lines visible)
      const { buffer: overlayBuffer, logs: renderLogs } = await renderOverlayPng(
        width, height,
        ad.headline, ad.subhead,
        positionedCallouts,
        bannerColor, bannerText
      );
      debugLogs.push(...renderLogs)
      layers.push({ input: overlayBuffer, left: 0, top: 0 });
      
      const finalImageBuffer = await sharp(bgBuffer).composite(layers).png().toBuffer();
      debugLogs.push(`Composition complete, final size: ${finalImageBuffer.length} bytes`)
      ad.imageDataUrl = `data:image/png;base64,${finalImageBuffer.toString('base64')}`;
      ad.label = "Ad"

    } catch (e: any) {
      console.error("Composition error:", e);
      compositionError = e.message;
      debugLogs.push(`COMPOSITION FAILED: ${e.message}`)
      ad.label = "Ad (composition failed)";
      const bgResponse = await fetch(generatedImageUrl)
      const rawBgBuffer = Buffer.from(await bgResponse.arrayBuffer())
      ad.imageDataUrl = `data:image/png;base64,${rawBgBuffer.toString('base64')}`;
    }

    // Step 7: Final assembly
    return NextResponse.json({
      concepts,
      selectedConcept,
      imagePrompt,
      generatedImageUrl,
      imageDescription,
      headlines,
      selectedHeadline,
      finalAds,
      _debug: {
        compositionError,
        logs: debugLogs,
        productBounds,
      },
      productIntelligence: productIntel
    });
} catch (err: unknown) {
    console.error("Pipeline error:", err)
    const msg = err instanceof Error ? err.message : "Pipeline failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
