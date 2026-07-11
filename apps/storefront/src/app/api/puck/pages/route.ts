/* Visual editor — list CMS pages for the page switcher. */
import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

export async function GET(req: NextRequest) {
  if (!isValidEditorRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  try {
    const r = await fetch(`${backend}/cms/pages`, {
      headers: {
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      cache: "no-store",
    })
    const data = await r.json().catch(() => ({ pages: [] }))
    return NextResponse.json(data, { status: r.ok ? 200 : r.status })
  } catch {
    return NextResponse.json({ pages: [] })
  }
}
