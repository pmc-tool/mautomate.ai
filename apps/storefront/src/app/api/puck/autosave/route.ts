import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

/* Visual editor autosave proxy — forwards the editor's current Puck data to the
 * backend draft buffer (/cms/visual-autosave). Server-only secret + tenant pak. */
export async function POST(req: NextRequest) {
  if (!isValidEditorRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const body = await req.json().catch(() => ({}))
  try {
    const r = await fetch(`${backend}/cms/visual-autosave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      body: JSON.stringify({
        slug: body?.slug || "home",
        locale: body?.locale || "en",
        data: body?.data,
      }),
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "autosave failed" }, { status: 502 })
  }
}
