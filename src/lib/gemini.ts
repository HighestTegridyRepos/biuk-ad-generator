import { GoogleGenAI } from "@google/genai"

let _client: GoogleGenAI | null = null

export function getGeminiClient() {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required")
  }
  _client = new GoogleGenAI({ apiKey })
  return _client
}

// ── Text models ───────────────────────────────────────────────────
// Used for all AI text generation (concept, copy, prompts, analysis, research)

/** Best quality. Use for concept generation, copy writing, product analysis. */
export const GEMINI_PRO = "gemini-2.5-pro"

/** Fast + cheap. Use for image description, reference analysis, image prompts. */
export const GEMINI_FLASH = "gemini-2.5-flash"

// ── Image models (Nano Banana family) ─────────────────────────────
// "Nano Banana" is Google's marketing name. API strings use gemini-*.

/** Best image quality, uses Thinking mode. Default for ad images. */
export const NANO_BANANA_PRO = "gemini-3-pro-image-preview"

/** Pro quality at Flash speed. Good fallback. */
export const NANO_BANANA_2 = "gemini-3.1-flash-image-preview"

/** Fastest, cheapest. Bulk generation. */
export const NANO_BANANA = "gemini-2.5-flash-image"

/** Active image model */
export const IMAGE_MODEL = NANO_BANANA_PRO

// ── Timeout helper ────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000 // 30 seconds

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`AI request timed out after ${ms / 1000}s. Please try again.`)),
      ms
    )

    // Support external abort signals
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      }, { once: true })
    }

    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

// ── Retry logic for transient Gemini errors ──────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable = err instanceof Error &&
        (err.message.includes("503") ||
         err.message.includes("429") ||
         err.message.includes("RESOURCE_EXHAUSTED") ||
         err.message.includes("overloaded"))
      if (!isRetryable || attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)))
    }
  }
  throw new Error("Retry exhausted")
}

// ── Helper: text generation ───────────────────────────────────────

/**
 * Generate text content from Gemini. Replaces Claude's messages.create().
 * Returns the text response as a string.
 */
export async function generateText(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getGeminiClient()

    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
        },
      }),
      timeoutMs,
      signal
    )

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error("AI returned an empty response")
    }
    return text
  })
}

/**
 * Describe an image using Gemini vision. Replaces Claude Vision.
 * Accepts base64 image data and returns a text description.
 */
export async function describeImageWithVision(
  model: string,
  base64: string,
  mediaType: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<string> {
  return withRetry(async () => {
    const ai = getGeminiClient()

    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: mediaType, data: base64 } },
              { text: userPrompt },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
        },
      }),
      timeoutMs,
      signal
    )

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      throw new Error("AI returned an empty response")
    }
    return text
  })
}
