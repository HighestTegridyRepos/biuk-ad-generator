import { NextRequest, NextResponse } from "next/server"
import { getAnthropicClient, MODEL } from "@/lib/anthropic"
import { CONCEPT_SYSTEM_PROMPT, buildConceptUserPrompt } from "@/lib/prompts"
import { ConceptRequest, ConceptResponse } from "@/types/ad"
import { extractJSON } from "@/lib/parse-json"
import { hashKey, getCachedConcepts, setCachedConcepts } from "@/lib/cache"

export async function POST(req: NextRequest) {
  try {
    const body: ConceptRequest = await req.json()

    // ── Check cache first ────────────────────────────────────────
    const briefHash = hashKey(body.brief, body.targetAudience, body.campaignGoal)
    const cacheKey = hashKey(
      briefHash,
      body.productAnalysis?.productName,
      body.productAnalysis?.targetAudience
    )

    if (!body.skipCache) {
      const cached = await getCachedConcepts(cacheKey)
      if (cached) {
        return NextResponse.json({ angles: cached, fromCache: true })
      }
    }

    // ── Generate fresh concepts ──────────────────────────────────
    const client = getAnthropicClient()
    const userPrompt = buildConceptUserPrompt(
      body.brief,
      body.referenceAnalysis,
      body.targetAudience,
      body.campaignGoal,
      body.brandVoice,
      body.productAnalysis,
      body.creativeResearch
    )

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: CONCEPT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    const firstBlock = message.content?.[0]
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : ""
    if (!text) {
      return NextResponse.json({ error: "AI returned an empty response. Try again." }, { status: 502 })
    }
    const parsed: ConceptResponse = extractJSON(text)

    // ── Cache the result ─────────────────────────────────────────
    await setCachedConcepts(cacheKey, briefHash, parsed.angles).catch(console.warn)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error("Concept generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate concepts" },
      { status: 500 }
    )
  }
}
