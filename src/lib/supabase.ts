import { createClient } from "@supabase/supabase-js"

let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }
  _client = createClient(url, key)
  return _client
}

/**
 * Normalize a product URL for cache lookups.
 * Strips protocol, www, trailing slashes, query params, and fragments.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    let normalized = parsed.hostname.replace(/^www\./, "") + parsed.pathname
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, "")
    return normalized.toLowerCase()
  } catch {
    return url.toLowerCase().trim()
  }
}
