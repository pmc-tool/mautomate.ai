import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

/* Template library proxy. GET list · POST save · DELETE ?id= */
async function be(req: NextRequest) {
  const { backend, pubKey } = await resolveEditorTenant(req)
  return { backend, headers: { "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "", "x-tenant-pak": pubKey } }
}
export async function GET(req: NextRequest) {
  if (!isValidEditorRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { backend, headers } = await be(req)
  const r = await fetch(`${backend}/cms/templates`, { headers, cache: "no-store" }).catch(() => null)
  return NextResponse.json(r ? await r.json().catch(() => ({})) : {}, { status: r?.status || 502 })
}
export async function POST(req: NextRequest) {
  if (!isValidEditorRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { backend, headers } = await be(req)
  const r = await fetch(`${backend}/cms/templates`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).catch(() => null)
  return NextResponse.json(r ? await r.json().catch(() => ({})) : {}, { status: r?.status || 502 })
}
export async function DELETE(req: NextRequest) {
  if (!isValidEditorRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const id = new URL(req.url).searchParams.get("id") || ""
  const { backend, headers } = await be(req)
  const r = await fetch(`${backend}/cms/templates?id=${encodeURIComponent(id)}`, { method: "DELETE", headers }).catch(() => null)
  return NextResponse.json(r ? await r.json().catch(() => ({})) : {}, { status: r?.status || 502 })
}
