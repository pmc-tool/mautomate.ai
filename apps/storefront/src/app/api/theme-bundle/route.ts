import { NextRequest, NextResponse } from "next/server"

/* Same-origin proxy for an uploaded theme's bundle, so the visual editor's
   canvas can fetch it client-side without a cross-origin (CORS) request to the
   backend. Themes are platform-owned (not tenant-scoped), so the public bundle
   endpoint needs no publishable key. */
const BACKEND =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle") || ""
  const version = req.nextUrl.searchParams.get("version") || ""
  if (!handle) {
    return NextResponse.json({ error: "handle required" }, { status: 400 })
  }
  try {
    const url = `${BACKEND}/themes-cdn/bundle?handle=${encodeURIComponent(handle)}${
      version ? `&version=${encodeURIComponent(version)}` : ""
    }`
    const r = await fetch(url, { cache: "no-store" })
    if (!r.ok) return new NextResponse("not found", { status: r.status })
    const bundle = await r.json()
    return NextResponse.json(bundle)
  } catch {
    return new NextResponse("fetch failed", { status: 502 })
  }
}
