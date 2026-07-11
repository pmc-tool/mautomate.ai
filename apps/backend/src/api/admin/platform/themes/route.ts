import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { catalogWithPreviewUrls } from "../../cms/themes/_catalog"

/**
 * GET /admin/platform/themes — the UNIFIED theme catalog + per-tenant state.
 *
 * The catalog is the REAL compiled-in storefront theme registry (Learts,
 * Aurora, ... — mirror of apps/storefront/src/themes/registry.ts). Themes are
 * CODE, added by developers; they are never created here. The super-admin uses
 * this to (a) see the catalog, (b) control which themes each tenant may use
 * (allowed_themes entitlement), and (c) see each tenant's active theme.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const tenants = await svc.listTenants({})

  const storefrontUrl =
    process.env.STOREFRONT_PREVIEW_URL ||
    process.env.STOREFRONT_URL ||
    "https://storefront.mautomate.ai"
  const catalog = catalogWithPreviewUrls(storefrontUrl).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    preview: t.preview_url,
  }))
  const allIds = catalog.map((t) => t.id)

  const rows = (tenants || []).map((t: any) => {
    const allowed: string[] = Array.isArray(t.meta?.allowed_themes)
      ? t.meta.allowed_themes.filter((id: string) => allIds.includes(id))
      : allIds // no restriction set -> every catalog theme is available
    let active: string = t.meta?.active_theme
    if (!active || !allIds.includes(active)) active = catalog[0]?.id
    return { id: t.id, name: t.name, active_theme: active, allowed_themes: allowed }
  })

  // usage count per theme (how many tenants have it active)
  const usage: Record<string, number> = {}
  for (const r of rows) usage[r.active_theme] = (usage[r.active_theme] || 0) + 1

  res.json({
    catalog: catalog.map((t) => ({ ...t, active_on: usage[t.id] || 0 })),
    tenants: rows,
  })
}
