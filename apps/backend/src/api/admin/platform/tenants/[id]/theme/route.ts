import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"
import { isKnownTheme } from "../../../../cms/themes/_catalog"
import { THEME_MODULE } from "../../../../../../modules/theme"

/** Is this handle a published uploaded (Liquid) theme? */
async function isUploadedTheme(req: AuthenticatedMedusaRequest, handle: string) {
  try {
    const svc: any = req.scope.resolve(THEME_MODULE)
    const rows = await svc.listThemes({ handle, status: "published" })
    return (rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

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
  const known =
    isKnownTheme(active_theme) || (await isUploadedTheme(req, active_theme))
  if (!known) {
    return res.status(400).json({
      message: `Unknown theme "${active_theme}". Use a published theme handle (e.g. "learts-liquid").`,
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
