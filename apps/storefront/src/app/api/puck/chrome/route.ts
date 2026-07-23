/* ------------------------------------------------------------------ */
/* Visual editor — load/save the chrome (header/topbar/footer) settings */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from "next/server"
import { isValidEditorRequest } from "@lib/util/secret"
import {
  resolveEditorTenant,
  resolveEditorThemeId,
} from "@lib/util/editor-tenant"
import { applyTenantBranding } from "@lib/data/cms"
import { normalizeThemeTokenOverrides } from "@modules/cms/render/theme-vars"
import { getThemeById } from "@themes/registry"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey, activeTheme, name } = await resolveEditorTenant(req)
  const lang = url.searchParams.get("lang") || "en"
  // Resolve the store's ACTIVE theme (same priority as the live storefront) so
  // the canvas can render the theme's OWN chrome + block renderers + base color
  // tokens — not always Learts. Never throws; falls back to the registry default.
  const themeId = await resolveEditorThemeId(backend, pubKey, activeTheme)
  const theme = getThemeById(themeId)
  try {
    const [sRes, cRes] = await Promise.all([
      fetch(`${backend}/store/cms/settings?lang=${lang}`, {
        headers: { "x-publishable-api-key": pubKey },
        cache: "no-store",
      }),
      fetch(`${backend}/store/product-categories?limit=50&fields=id,name,handle`, {
        headers: { "x-publishable-api-key": pubKey },
        cache: "no-store",
      }).catch(() => null),
    ])
    const sBody = sRes.ok ? await sRes.json() : { settings: {} }
    let sample_products: any[] = []
    try {
      const rRes = await fetch(`${backend}/store/regions`, { headers: { "x-publishable-api-key": pubKey }, cache: "no-store" })
      const regionId = rRes.ok ? (await rRes.json())?.regions?.[0]?.id : null
      if (regionId) {
        const pRes = await fetch(`${backend}/store/products?limit=8&region_id=${regionId}&fields=title,handle,thumbnail,*images,*variants.calculated_price`, { headers: { "x-publishable-api-key": pubKey }, cache: "no-store" })
        const pBody = pRes.ok ? await pRes.json() : { products: [] }
        sample_products = (pBody?.products ?? []).map((pr: any) => ({
          title: pr.title, handle: pr.handle,
          featured_image: pr.images?.[0] ?? (pr.thumbnail ? { url: pr.thumbnail } : null),
          price: pr.variants?.[0]?.calculated_price?.calculated_amount ?? 0,
          compare_at_price: null, available: true,
        }))
      }
    } catch {}
    const cBody = cRes && cRes.ok ? await cRes.json() : { product_categories: [] }
    // Rebrand the chrome to the tenant's own identity (scrub Forever Finds
    // logo/copy) EXACTLY like the live storefront, so the editor is WYSIWYG.
    // Owner-customized values are preserved (FF-default guard inside).
    const s = name
      ? (applyTenantBranding((sBody?.settings ?? {}) as any, name) as any)
      : sBody?.settings ?? {}
    return NextResponse.json({
      header: s.header ?? null,
      topbar: s.topbar ?? null,
      footer: s.footer ?? null,
      // U7 lazy per-tenant migration, in memory only: convert the resolver's
      // legacy sentinel shape to the explicit null-inherit shape at editor
      // load. Render-identical by construction (pick() lands in the same
      // branch either way); PERSISTED only when this tenant next explicitly
      // saves its settings (the shell normalizes again on publish). Tenants
      // that never edit are never rewritten.
      theme: s.theme ? normalizeThemeTokenOverrides(s.theme) : null,
      categories: cBody?.product_categories ?? [],
      sample_products,
      // Active theme identity for the canvas (FIX 1/3): which theme's chrome +
      // block renderers to use, its body className, and its base color/font
      // tokens (CMS `theme` overrides layer on top of these in buildThemeVars).
      active_theme: theme.id,
      platform_theme: activeTheme,
      theme_tokens: theme.tokens ?? null,
      body_class: theme.bodyClassName ?? null,
      // Brand name for the theme footer views (mirrors getBrandName: the
      // tenant's own name in multi-tenant, else the Forever Finds default).
      brand_name: name || "Forever Finds",
    })
  } catch {
    return NextResponse.json({
      header: null,
      topbar: null,
      footer: null,
      theme: null,
      categories: [],
      active_theme: theme.id,
      platform_theme: activeTheme,
      theme_tokens: theme.tokens ?? null,
      body_class: theme.bodyClassName ?? null,
      brand_name: name || "Forever Finds",
    })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isValidEditorRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { backend, pubKey } = await resolveEditorTenant(req)
  const body = await req.json().catch(() => ({}))
  try {
    const r = await fetch(`${backend}/cms/visual-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
        "x-tenant-pak": pubKey,
      },
      body: JSON.stringify({ key: body?.key, data: body?.data }),
    })
    const data = await r.json().catch(() => ({}))
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "save failed" }, { status: 502 })
  }
}
