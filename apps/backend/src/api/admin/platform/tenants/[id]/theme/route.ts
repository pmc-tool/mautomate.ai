import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"
import { isKnownTheme, THEME_CATALOG } from "../../../../cms/themes/_catalog"

/**
 * PUT /admin/platform/tenants/:id/theme  { active_theme }
 *
 * Activate a storefront theme for a tenant (the switcher). Sets
 * tenant.meta.active_theme to a REAL theme id; the multi-tenant storefront reads
 * it via /tenant-config and renders that theme. Validated against the catalog
 * AND the tenant's entitlement (allowed_themes) — you cannot activate a theme
 * the tenant is not entitled to.
 */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(req.params.id).catch(() => null)
  if (!tenant) return res.status(404).json({ message: "tenant not found" })

  const active_theme = String(
    (req.body as { active_theme?: string })?.active_theme ?? ""
  ).trim()
  if (!active_theme) return res.status(400).json({ message: "active_theme required" })
  if (!isKnownTheme(active_theme)) {
    return res.status(400).json({
      message: `Unknown theme "${active_theme}". Choose one of: ${THEME_CATALOG.map(
        (t) => t.id
      ).join(", ")}`,
    })
  }

  const allowed: string[] | null = Array.isArray(tenant.meta?.allowed_themes)
    ? tenant.meta.allowed_themes
    : null
  if (allowed && !allowed.includes(active_theme)) {
    return res.status(403).json({
      message: `Theme "${active_theme}" is not enabled for this store. Enable it first.`,
    })
  }

  await svc.updateTenants({
    id: req.params.id,
    meta: { ...(tenant.meta ?? {}), active_theme },
  })
  res.json({ id: req.params.id, active_theme })
}
