/* ------------------------------------------------------------------ */
/* Visual editor — Media Library bridge (list + upload)                 */
/*                                                                     */
/* Key-gated storefront proxy to the secret-gated backend /cms/media    */
/* bridge. GET lists image media; POST uploads a single file (JSON      */
/* { filename, mimeType, contentBase64 }). The editor key is validated  */
/* here; the backend is reached with the server-to-server x-cms-secret. */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  if (!isValidEditorRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const qs = new URLSearchParams()
  const q = url.searchParams.get("q")
  const limit = url.searchParams.get("limit")
  const offset = url.searchParams.get("offset")
  if (q) qs.set("q", q)
  if (limit) qs.set("limit", limit)
  if (offset) qs.set("offset", offset)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  try {
    const r = await fetch(`${backend}/cms/media${suffix}`, {
      headers: {
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      cache: "no-store",
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "list failed" },
      { status: 502 }
    )
  }
}

export async function POST(req: NextRequest) {
  if (!isValidEditorRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const body = await req.json().catch(() => ({}))
  try {
    const r = await fetch(`${backend}/cms/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      body: JSON.stringify({
        filename: body?.filename,
        mimeType: body?.mimeType,
        contentBase64: body?.contentBase64,
      }),
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "upload failed" },
      { status: 502 }
    )
  }
}
