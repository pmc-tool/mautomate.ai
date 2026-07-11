import type { NextRequest } from "next/server"

/**
 * The PUBLIC origin the request actually arrived on (the store's own domain),
 * read from the proxy's forwarded headers. Behind the edge/CDN, Next's
 * `req.nextUrl.origin` / `req.url` resolve to the internal bind address
 * (e.g. https://localhost:8601), which then leaks into redirects. Always build
 * editor/preview redirects from this instead.
 */
export function requestOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || "https"
    return `${proto}://${host.split(",")[0].trim()}`
  }
  return req.nextUrl.origin
}
