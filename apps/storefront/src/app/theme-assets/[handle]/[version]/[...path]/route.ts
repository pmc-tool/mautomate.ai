import { NextRequest, NextResponse } from "next/server"

/* GET /theme-assets/:handle/:version/*path
   The clean URL a theme's {{ 'x' | asset_url }} produces. Proxies to the
   backend's query-based asset endpoint (multi-segment paths need no route
   wildcard on the backend). Immutable, so a browser caches it for a year. */

const BACKEND =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string; version: string; path: string[] }> }
) {
  const { handle, version, path } = await params
  const rel = (path ?? []).join("/")
  if (!handle || !version || !rel) {
    return new NextResponse("Not found", { status: 404 })
  }

  const url =
    `${BACKEND}/themes-cdn/asset?handle=${encodeURIComponent(handle)}` +
    `&version=${encodeURIComponent(version)}&path=${encodeURIComponent(rel)}`

  const upstream = await fetch(url, { cache: "no-store" })
  if (!upstream.ok) return new NextResponse("Not found", { status: 404 })

  const body = await upstream.arrayBuffer()
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
