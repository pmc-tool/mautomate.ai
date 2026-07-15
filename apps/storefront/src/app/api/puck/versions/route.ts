import { NextRequest, NextResponse } from "next/server"
import { toPuckData } from "../../../../puck/convert"
import { isValidEditorRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"

/* Revision history for the visual editor.
 *   GET  ?slug=&lang=[&version=N]  -> list versions, or one version as Puck data (Preview)
 *   POST { slug, locale, version } -> RESTORE that version into the draft, return Puck data
 */
async function be(req: NextRequest) {
  const { backend, pubKey } = await resolveEditorTenant(req)
  return { backend, pubKey, headers: { "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "", "x-tenant-pak": pubKey } }
}

export async function GET(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const slug = url.searchParams.get("slug") || "home"
  const lang = url.searchParams.get("lang") || "en"
  const version = url.searchParams.get("version")
  const { backend, headers } = await be(req)
  const qs = `slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(lang)}${version ? `&version=${version}` : ""}`
  const r = await fetch(`${backend}/cms/visual-versions?${qs}`, { headers, cache: "no-store" }).catch(() => null)
  const body = r ? await r.json().catch(() => ({})) : {}
  if (version && Array.isArray(body?.sections)) {
    // Preview: return the version as Puck data (read-only load in the editor).
    return NextResponse.json({ data: toPuckData(body.sections), version: body.version })
  }
  return NextResponse.json(body, { status: r?.status || 502 })
}

export async function POST(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const slug = body?.slug || "home"
  const lang = body?.locale || "en"
  const version = body?.version
  const { backend, headers } = await be(req)
  // 1) fetch the version's sections.
  const vr = await fetch(
    `${backend}/cms/visual-versions?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(lang)}&version=${version}`,
    { headers, cache: "no-store" }
  ).catch(() => null)
  const vb = vr ? await vr.json().catch(() => ({})) : {}
  if (!Array.isArray(vb?.sections)) {
    return NextResponse.json({ error: "version not found" }, { status: 404 })
  }
  const data = toPuckData(vb.sections)
  // 2) write it into the draft buffer so the editor loads it as the working copy.
  await fetch(`${backend}/cms/visual-autosave`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ slug, locale: lang, data }),
  }).catch(() => null)
  return NextResponse.json({ ok: true, data, version })
}
