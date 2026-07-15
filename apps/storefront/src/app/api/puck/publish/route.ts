/* ------------------------------------------------------------------ */
/* Visual editor — publish a page's blocks live                         */
/*                                                                     */
/* Server-side: converts Puck Data -> snapshot sections and forwards to */
/* the backend's secret-gated /cms/visual-publish, which validates,     */
/* syncs the draft sections and republishes through the real pipeline   */
/* (revisions + on-demand revalidation included). Gated by the editor   */
/* key; the backend secret never reaches the browser.                   */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { fromPuckContent } from "../../../../puck/convert"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

export async function POST(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Resolve the store SERVER-SIDE from the request Host (control-plane
  // /tenant-config) and forward it as `x-tenant-pak`. The backend scopes the
  // write to THIS tenant off that header (trusted because it also holds the
  // server-only x-cms-secret) — never off a browser-supplied pak.
  const { backend, pubKey } = await resolveEditorTenant(req)
  const body = await req.json().catch(() => ({}))
  const slug = body?.slug || "home"
  const locale = body?.locale || "en"
  const sections = fromPuckContent(body?.data)

  try {
    const r = await fetch(`${backend}/cms/visual-publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      body: JSON.stringify({ slug, locale, sections }),
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "publish failed" },
      { status: 502 }
    )
  }
}
