/**
 * Project history — saves completed project snapshots to localStorage.
 * Shown on the landing page as "Recent Projects".
 */

const HISTORY_KEY = "ad-creator-history"
const MAX_HISTORY = 5

export interface ProjectSnapshot {
  id: string
  name: string
  productName: string
  platform: string
  thumbnailUrl: string | null
  createdAt: string
  completedAt: string
}

export function getProjectHistory(): ProjectSnapshot[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ProjectSnapshot[]
  } catch {
    return []
  }
}

export function saveToHistory(snapshot: ProjectSnapshot) {
  try {
    const history = getProjectHistory()
    // Remove existing entry with same ID
    const filtered = history.filter((p) => p.id !== snapshot.id)
    // Add to front
    filtered.unshift(snapshot)
    // Trim to max
    const trimmed = filtered.slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
  } catch {
    // Non-critical
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // Non-critical
  }
}
