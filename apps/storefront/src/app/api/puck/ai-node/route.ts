import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

/* Selection-scoped AI tiers (ARCH-AI): Tier 1 micro + Tier 2 node. Same
 * tenant-bound chain as the other ai-* proxies (editor token -> tenant ->
 * x-cms-secret + x-tenant-pak); STREAM-CAPABLE — a text/event-stream backend
 * response is piped through untouched so Tier 1 chips stream tokens live. */

const headersFor = (pubKey: string) => ({
  "Content-Type": "application/json",
  "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
  "x-tenant-pak": pubKey,
})

export async function POST(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const body = await req.text()
  try {
    const r = await fetch(`${backend}/cms/ai-node`, {
      method: "POST",
      headers: headersFor(pubKey),
      body,
      signal: AbortSignal.timeout(90000),
    })
    const ct = r.headers.get("content-type") || ""
    if (ct.includes("text/event-stream") && r.body) {
      return new Response(r.body, {
        status: r.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      })
    }
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "AI request failed" }, { status: 502 })
  }
}

/* Price map + digest version (the shell's pre-flight credit prices, §3.8). */
export async function GET(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  try {
    const r = await fetch(`${backend}/cms/ai-node`, {
      method: "GET",
      headers: headersFor(pubKey),
      signal: AbortSignal.timeout(15000),
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "AI request failed" }, { status: 502 })
  }
}
