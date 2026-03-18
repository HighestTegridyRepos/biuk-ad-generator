import { NextRequest, NextResponse } from "next/server"
import { getSupabase, normalizeUrl } from "@/lib/supabase"
import { getAnthropicClient, MODEL } from "@/lib/anthropic"
import { extractJSON } from "@/lib/parse-json"

/**
 * POST /api/scrape-product
 * Takes a product URL, scrapes it, analyzes with Claude, caches in Supabase.
 * Returns cached data if the URL has been seen before.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "A product URL is required" }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const normalized = normalizeUrl(parsedUrl.href)
    const supabase = getSupabase()

    // ── Check cache first ──────────────────────────────────────────
    const { data: cached } = await supabase
      .from("products")
      .select("*, research(*)")
      .eq("normalized_url", normalized)
      .single()

    if (cached) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cachedAny = cached as any
      return NextResponse.json({
        product: cached,
        research: cachedAny.research?.[0] ?? null,
        fromCache: true,
      })
    }

    // ── Scrape the product page ────────────────────────────────────
    const pageContent = await scrapeProductPage(parsedUrl.href)

    if (!pageContent.html && !pageContent.text) {
      return NextResponse.json(
        { error: "Could not fetch the product page. Check the URL and try again." },
        { status: 422 }
      )
    }

    // ── Extract product data + images from HTML ────────────────────
    const extracted = extractProductData(pageContent.html, parsedUrl.href)

    // ── Run Claude analysis on the scraped content ─────────────────
    const client = getAnthropicClient()

    const analysisPrompt = buildAnalysisPrompt(
      pageContent.text,
      extracted,
      parsedUrl.href
    )

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: PRODUCT_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: analysisPrompt }],
    })

    const firstBlock = message.content?.[0]
    const analysisText = firstBlock && firstBlock.type === "text" ? firstBlock.text : ""

    let aiAnalysis = null
    try {
      aiAnalysis = extractJSON(analysisText)
    } catch {
      // If Claude didn't return valid JSON, create a basic analysis
      aiAnalysis = {
        targetAudience: "General consumers",
        keySellingPoints: [extracted.name || "Product"],
        emotionalHooks: ["Quality", "Value"],
        competitivePositioning: "Standard market positioning",
        productCategory: extracted.category || "General",
        suggestedBrief: `Ad for ${extracted.name || "this product"} — ${extracted.description?.slice(0, 200) || "a quality product"}`
      }
    }

    // ── Save to Supabase ───────────────────────────────────────────
    const productData = {
      url: parsedUrl.href,
      normalized_url: normalized,
      name: extracted.name || (aiAnalysis as Record<string, unknown>)?.productName || null,
      brand: extracted.brand || null,
      description: extracted.description || null,
      price: extracted.price || null,
      currency: extracted.currency || null,
      category: extracted.category || (aiAnalysis as Record<string, unknown>)?.productCategory || null,
      hero_image_url: extracted.heroImage || null,
      product_images: extracted.images || [],
      ai_analysis: aiAnalysis,
      raw_page_content: pageContent.text?.slice(0, 50000) || null, // Cap at 50KB
    }

    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert(productData)
      .select()
      .single()

    if (insertError) {
      console.error("Supabase insert error:", insertError)
      // Still return the data even if caching failed
      return NextResponse.json({
        product: { ...productData, id: null },
        research: null,
        fromCache: false,
      })
    }

    // ── Generate research / positioning ────────────────────────────
    const researchPrompt = buildResearchPrompt(
      pageContent.text,
      extracted,
      aiAnalysis
    )

    const researchMessage = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: RESEARCH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: researchPrompt }],
    })

    const researchBlock = researchMessage.content?.[0]
    const researchText = researchBlock && researchBlock.type === "text" ? researchBlock.text : ""

    let researchData = null
    try {
      researchData = extractJSON(researchText)
    } catch {
      researchData = null
    }

    if (researchData && product) {
      await supabase.from("research").insert({
        product_id: product.id,
        market_positioning: (researchData as Record<string, unknown>)?.marketPositioning || null,
        visual_direction: (researchData as Record<string, unknown>)?.visualDirection || null,
        copy_direction: (researchData as Record<string, unknown>)?.copyDirection || null,
        competitor_brands: (researchData as Record<string, unknown>)?.competitorBrands || [],
      })
    }

    return NextResponse.json({
      product: product || productData,
      research: researchData,
      fromCache: false,
    })
  } catch (error) {
    console.error("Product scrape error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze product" },
      { status: 500 }
    )
  }
}

// ── Scraping ──────────────────────────────────────────────────────

async function scrapeProductPage(url: string): Promise<{ html: string; text: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status}`)
    }

    const html = await res.text()

    // Extract text content (strip HTML tags for Claude analysis)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30000) // Cap for Claude context

    return { html, text }
  } catch (err) {
    console.error("Scrape failed:", err)
    return { html: "", text: "" }
  }
}

// ── Product data extraction from HTML ─────────────────────────────

interface ExtractedProduct {
  name: string | null
  brand: string | null
  description: string | null
  price: string | null
  currency: string | null
  category: string | null
  heroImage: string | null
  images: string[]
}

function extractProductData(html: string, baseUrl: string): ExtractedProduct {
  const result: ExtractedProduct = {
    name: null, brand: null, description: null,
    price: null, currency: null, category: null,
    heroImage: null, images: [],
  }

  if (!html) return result

  // Try JSON-LD structured data first (most reliable)
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const jsonStr = match.replace(/<script[^>]*>/, "").replace(/<\/script>/, "")
        const data = JSON.parse(jsonStr)
        const product = data["@type"] === "Product" ? data : data["@graph"]?.find((item: Record<string, string>) => item["@type"] === "Product")

        if (product) {
          result.name = product.name || null
          result.brand = product.brand?.name || product.brand || null
          result.description = product.description || null

          if (product.offers) {
            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
            result.price = offer?.price?.toString() || null
            result.currency = offer?.priceCurrency || null
          }

          result.category = product.category || null

          if (product.image) {
            const images = Array.isArray(product.image) ? product.image : [product.image]
            result.images = images.filter((img: unknown): img is string => typeof img === "string").map((img: string) => resolveUrl(img, baseUrl))
            result.heroImage = result.images[0] || null
          }
        }
      } catch {
        // Invalid JSON-LD, continue
      }
    }
  }

  // Fallback: Open Graph tags
  if (!result.name) {
    result.name = extractMeta(html, "og:title") || extractMeta(html, "title") || extractTag(html, "title")
  }
  if (!result.description) {
    result.description = extractMeta(html, "og:description") || extractMeta(html, "description")
  }
  if (!result.heroImage) {
    const ogImage = extractMeta(html, "og:image")
    if (ogImage) {
      result.heroImage = resolveUrl(ogImage, baseUrl)
    }
  }

  // Fallback: find large product images
  if (result.images.length === 0) {
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*/gi)
    for (const m of imgMatches) {
      const src = m[1]
      // Filter for likely product images (skip icons, tracking pixels, etc.)
      if (src && !src.includes("favicon") && !src.includes("logo") && !src.includes("pixel") && !src.includes("track") && (src.includes("product") || src.includes("cdn") || src.match(/\.(jpg|jpeg|png|webp)/i))) {
        const resolved = resolveUrl(src, baseUrl)
        if (!result.images.includes(resolved)) {
          result.images.push(resolved)
        }
      }
    }
    if (!result.heroImage && result.images.length > 0) {
      result.heroImage = result.images[0]
    }
  }

  // Price fallback: look for common price patterns
  if (!result.price) {
    const priceMatch = html.match(/\$[\d,]+\.?\d{0,2}/)
    if (priceMatch) {
      result.price = priceMatch[0].replace("$", "")
      result.currency = "USD"
    }
  }

  return result
}

function extractMeta(html: string, name: string): string | null {
  // Match both name="" and property="" attributes
  const match = html.match(new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"))
  return match?.[1] || null
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"))
  return match?.[1]?.trim() || null
}

function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href
  } catch {
    return url
  }
}

// ── Claude prompts ────────────────────────────────────────────────

const PRODUCT_ANALYSIS_SYSTEM_PROMPT = `You are a senior advertising strategist analyzing a product page to prepare for ad creation. Your analysis will be used to generate high-converting social media ads.

Return your analysis as JSON with this exact structure:
{
  "productName": "string",
  "targetAudience": "Specific audience description — demographics, psychographics, pain points",
  "keySellingPoints": ["3-5 concrete selling points, not generic"],
  "emotionalHooks": ["3-4 emotional triggers this product activates — desires, fears, aspirations"],
  "competitivePositioning": "How this product differentiates — what's the angle that makes it stand out",
  "productCategory": "string",
  "pricePoint": "budget | mid-range | premium | luxury",
  "suggestedBrief": "A 2-3 sentence ad brief that a creative director could run with. Include the core promise and emotional angle."
}`

function buildAnalysisPrompt(
  pageText: string,
  extracted: ExtractedProduct,
  url: string
): string {
  let prompt = `Analyze this product page for ad creation.\n\nURL: ${url}\n`

  if (extracted.name) prompt += `Product: ${extracted.name}\n`
  if (extracted.brand) prompt += `Brand: ${extracted.brand}\n`
  if (extracted.price) prompt += `Price: ${extracted.currency || "$"}${extracted.price}\n`
  if (extracted.description) prompt += `Description: ${extracted.description}\n`

  prompt += `\nFull page content:\n${pageText?.slice(0, 20000) || "Could not extract page text"}`
  prompt += `\n\nAnalyze this product and return your assessment as JSON.`

  return prompt
}

const RESEARCH_SYSTEM_PROMPT = `You are a creative strategist doing landscape research for an ad campaign. Based on the product analysis, provide actionable creative direction.

Return your research as JSON:
{
  "marketPositioning": {
    "gap": "The unmet need or underserved angle in this market",
    "opportunity": "The specific creative opportunity for this ad",
    "differentiators": ["What makes this product's story unique for ads"],
    "audienceInsights": "Deep insight about what motivates this audience to buy"
  },
  "visualDirection": {
    "suggestedStyles": ["3 visual styles that would work — e.g. 'lifestyle flat-lay', 'hero product on gradient', 'UGC-style testimonial'"],
    "colorPalettes": [["primary", "secondary", "accent"]],
    "moodKeywords": ["5 mood words for the visual direction"],
    "avoidPatterns": ["Visual cliches to avoid for this category"]
  },
  "copyDirection": {
    "hooks": ["5 specific headline hooks tailored to this product — not generic, these should reference the actual product/benefit"],
    "avoidCliches": ["Category-specific cliches to avoid"],
    "toneGuidance": "Specific tone direction based on brand and audience"
  },
  "competitorBrands": ["List of likely competitor brands in this space"]
}`

function buildResearchPrompt(
  pageText: string,
  extracted: ExtractedProduct,
  aiAnalysis: unknown
): string {
  let prompt = `Based on this product analysis, provide creative direction for an ad campaign.\n\n`
  prompt += `Product: ${extracted.name || "Unknown"}\n`
  prompt += `Brand: ${extracted.brand || "Unknown"}\n`
  prompt += `Category: ${extracted.category || "Unknown"}\n`

  if (aiAnalysis && typeof aiAnalysis === "object") {
    prompt += `\nAI Analysis:\n${JSON.stringify(aiAnalysis, null, 2)}\n`
  }

  prompt += `\nPage content excerpt:\n${pageText?.slice(0, 10000) || "N/A"}`
  prompt += `\n\nProvide your creative research as JSON.`

  return prompt
}
