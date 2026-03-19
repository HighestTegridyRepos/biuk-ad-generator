import { getSupabase } from "@/lib/supabase"

/**
 * Delete a cache entry by table and key.
 */
export async function deleteCache(table: "concept_cache" | "prompt_cache" | "copy_cache", cacheKey: string) {
  const supabase = getSupabase()
  await supabase.from(table).delete().eq("cache_key", cacheKey)
}

/**
 * Simple hash for cache keys — deterministic, fast, good enough for dedup.
 * Not cryptographic. Uses djb2 algorithm.
 */
export function hashKey(...parts: (string | undefined | null)[]): string {
  const input = parts.filter(Boolean).join("|")
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff
  }
  return (hash >>> 0).toString(36)
}

/**
 * Check concept cache. Returns cached angles or null.
 */
export async function getCachedConcepts(cacheKey: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("concept_cache")
    .select("angles")
    .eq("cache_key", cacheKey)
    .single()
  return data?.angles ?? null
}

export async function setCachedConcepts(
  cacheKey: string,
  briefHash: string,
  angles: unknown,
  productId?: string
) {
  const supabase = getSupabase()
  await supabase.from("concept_cache").upsert({
    cache_key: cacheKey,
    product_id: productId || null,
    brief_hash: briefHash,
    angles,
  })
}

/**
 * Check prompt cache. Returns cached prompts or null.
 */
export async function getCachedPrompts(cacheKey: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("prompt_cache")
    .select("prompts")
    .eq("cache_key", cacheKey)
    .single()
  return data?.prompts ?? null
}

export async function setCachedPrompts(
  cacheKey: string,
  conceptHash: string,
  platform: string,
  prompts: unknown
) {
  const supabase = getSupabase()
  await supabase.from("prompt_cache").upsert({
    cache_key: cacheKey,
    concept_hash: conceptHash,
    platform,
    prompts,
  })
}

/**
 * Check copy cache. Returns cached variations or null.
 */
export async function getCachedCopy(cacheKey: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from("copy_cache")
    .select("variations")
    .eq("cache_key", cacheKey)
    .single()
  return data?.variations ?? null
}

export async function setCachedCopy(
  cacheKey: string,
  conceptHash: string,
  imageDescHash: string,
  variations: unknown
) {
  const supabase = getSupabase()
  await supabase.from("copy_cache").upsert({
    cache_key: cacheKey,
    concept_hash: conceptHash,
    image_desc_hash: imageDescHash,
    variations,
  })
}
