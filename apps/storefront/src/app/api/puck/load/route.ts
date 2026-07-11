/* ------------------------------------------------------------------ */
/* Visual editor — load a real page's current blocks as Puck Data       */
/*                                                                     */
/* Server-side: reads the live published snapshot for (slug, locale)    */
/* from the store API and converts it to Puck Data. Gated by a key      */
/* (CMS_PREVIEW_SECRET) so the editor bridge is not openly callable.    */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { toPuckData } from "../../../../puck/convert"
import { isValidEditorRequest } from "@lib/util/secret"
import {
  resolveEditorTenant,
  resolveEditorThemeId,
} from "@lib/util/editor-tenant"
import { getThemeById } from "@themes/registry"

const EMPTY = { root: {}, content: [] }

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  if (!isValidEditorRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { backend, pubKey, activeTheme } = await resolveEditorTenant(req)
  const slug = url.searchParams.get("slug") || "home"
  const lang = url.searchParams.get("lang") || "en"

  // 0) DRAFT-FIRST: an autosaved (unpublished) draft always wins over the live
  //    snapshot, so reopening the editor restores in-progress work exactly.
  try {
    const dr = await fetch(
      `${backend}/cms/visual-autosave?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(lang)}`,
      {
        headers: {
          "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
          "x-tenant-pak": pubKey,
        },
        cache: "no-store",
      }
    )
    if (dr.ok) {
      const b = await dr.json()
      if (b?.draft?.data && Array.isArray(b.draft.data.content)) {
        return NextResponse.json({
          data: b.draft.data,
          draft: true,
          draftAt: b.draft.updated_at,
        })
      }
    }
  } catch {
    // fall through to the published snapshot below
  }

  // 1) Read the store's current sections for (slug, locale).
  let sections: unknown[] | undefined
  try {
    const r = await fetch(`${backend}/store/cms/pages/${slug}?lang=${lang}`, {
      headers: { "x-publishable-api-key": pubKey },
      cache: "no-store",
    })
    if (r.ok) {
      const body = await r.json()
      sections = body?.page?.sections
    }
  } catch {
    // Fall through to the theme-default seed below.
  }

  if (Array.isArray(sections) && sections.length) {
    return NextResponse.json({
      data: toPuckData(sections as { block_type: string }[]),
    })
  }

  // 2) No published sections yet. For the HOME page, seed the editor with the
  //    ACTIVE theme's default sections so the canvas is not blank (fresh-store
  //    fallback). Other slugs stay empty — defaultSections is a home-only
  //    layout. Themes with no defaultSections (e.g. learts) return EMPTY, which
  //    is correct (their home is hardcoded, nothing CMS-editable yet).
  if (slug === "home") {
    const themeId = await resolveEditorThemeId(backend, pubKey, activeTheme)
    const theme = getThemeById(themeId)
    const defaults = theme.defaultSections
    if (defaults && defaults.length) {
      return NextResponse.json({ data: toPuckData(defaults) })
    }
  }

  return NextResponse.json({ data: EMPTY })
}
