/**
 * Shared SSRF protection — validates that a URL is safe to fetch server-side.
 * Blocks internal networks, metadata endpoints, and non-HTTP protocols.
 */
export function validateExternalUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, error: "Invalid URL" }
  }

  // Block non-HTTP protocols
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "Only http/https URLs are allowed" }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost and loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return { valid: false, error: "Loopback addresses are not allowed" }
  }

  // Block private IP ranges
  if (
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc00:") ||
    hostname.startsWith("fd")
  ) {
    return { valid: false, error: "Private network addresses are not allowed" }
  }

  // Block internal/local domains
  if (
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal"
  ) {
    return { valid: false, error: "Internal domains are not allowed" }
  }

  // Block cloud metadata endpoints
  if (hostname === "169.254.169.254") {
    return { valid: false, error: "Cloud metadata endpoints are not allowed" }
  }

  return { valid: true }
}
