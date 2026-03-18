import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

export function getAnthropicClient() {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required")
  }
  _client = new Anthropic({ apiKey })
  return _client
}

/**
 * Model constants — use HAIKU for everything by default (cheapest).
 * Swap to SONNET only for calls where quality noticeably suffers.
 *
 * Haiku 4.5: ~$0.001/1K input, $0.005/1K output (~10x cheaper than Sonnet)
 * Sonnet 4.6: ~$0.015/1K input, $0.075/1K output
 */
export const HAIKU = "claude-haiku-4-5-20251001"
export const SONNET = "claude-sonnet-4-6"

// Default model for all calls — start with Haiku, upgrade specific routes if needed
export const MODEL = HAIKU
