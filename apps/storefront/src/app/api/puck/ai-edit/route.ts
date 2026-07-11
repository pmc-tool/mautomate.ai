import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

/* AI page-edit proxy — forwards to the backend gateway with the server-only
 * secret + tenant pak. The Novita key never exists on this side at all. */
export async function POST(req: NextRequest) {
  if (!isValidEditorRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const body = await req.json().catch(() => ({}))
  try {
    const r = await fetch(`${backend}/cms/ai-edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "AI request failed" }, { status: 502 })
  }
}
