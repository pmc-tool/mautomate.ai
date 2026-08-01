import { NextRequest, NextResponse } from "next/server"

/**
 * Per-tenant robots.txt. The old metadata route pointed every store's
 * Sitemap line at one build-time domain (brandtodoor.com) — the sitemap link
 * search engines followed belonged to a different site. The Sitemap now
 * always points at the REQUESTING host.
 */
export function GET(req: NextRequest) {
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim()

  const body = [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /editor",
    "Disallow: /editor-canvas",
    "Disallow: /api/",
    "Disallow: /*/account",
    "Disallow: /*/cart",
    "Disallow: /*/checkout",
    "Disallow: /*/order",
    "Disallow: /*/wishlist",
    "",
    `Sitemap: https://${host}/sitemap.xml`,
    "",
  ].join("\n")

  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  })
}
