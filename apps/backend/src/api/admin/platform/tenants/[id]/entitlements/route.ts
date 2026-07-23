import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"
import { THEME_CATALOG } from "../../../../cms/themes/_catalog"
import { THEME_MODULE } from "../../../../../../modules/theme"

/**
 * PUT /admin/platform/tenants/:id/entitlements  { allowed_themes: string[] }
 *
 * Super-admin curation: set which catalog themes a tenant is allowed to use.
 * Stored as tenant.meta.allowed_themes. If the tenant's currently active theme
 * is removed from the allow-list, it is reset to the first allowed theme so the
 * store never renders a theme it is no longer entitled to.
 */
export const PUT = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const tenant = await svc.retrieveTenant(req.params.id).catch(() => null)
  if (!tenant) return res.status(404).json({ message: "tenant not found" })

  // Valid ids = the (possibly empty) compiled catalog + every published
  // uploaded (Liquid) theme handle — all themes are uploaded since 2026-07-18.
  const catalogIds = THEME_CATALOG.map((t) => t.id)
  let uploadedIds: string[] = []
  try {
    const themeSvc: any = req.scope.resolve(THEME_MODULE)
    const rows = await themeSvc.listThemes({ status: "published" })
    uploadedIds = (rows ?? []).map((t: any) => String(t.handle))
  } catch {
    // Theme module unavailable — catalog ids stand alone.
  }
  const validIds = new Set([...catalogIds, ...uploadedIds])
  const raw = (req.body as { allowed_themes?: unknown })?.allowed_themes
  if (!Array.isArray(raw)) {
    return res.status(400).json({ message: "allowed_themes must be an array" })
  }
  const allowed = [...new Set(raw.map(String))].filter((id) => validIds.has(id))
  if (!allowed.length) {
    return res.status(400).json({ message: "at least one valid theme is required" })
  }

  const meta = { ...(tenant.meta ?? {}), allowed_themes: allowed }
  // Keep the active theme valid against the new entitlement.
  if (meta.active_theme && !allowed.includes(meta.active_theme)) {
    meta.active_theme = allowed[0]
  }

  await svc.updateTenants({ id: req.params.id, meta })
  res.json({ id: req.params.id, allowed_themes: allowed, active_theme: meta.active_theme })
}
