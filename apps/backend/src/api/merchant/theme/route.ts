import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { isKnownTheme } from "../../admin/cms/themes/_catalog"
import { THEME_MODULE } from "../../../modules/theme"

/** Is this handle a published uploaded (Liquid) theme? */
async function isUploadedTheme(req: MedusaRequest, handle: string): Promise<boolean> {
  try {
    const svc: any = req.scope.resolve(THEME_MODULE)
    const rows = await svc.listThemes({ handle, status: "published" })
    return (rows?.length ?? 0) > 0
  } catch {
    return false
  }
}

/** PUT /merchant/theme { active_theme } — activate a theme (compiled OR uploaded). */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const active_theme = String((req.body as { active_theme?: string })?.active_theme ?? "").trim()

  const known =
    isKnownTheme(active_theme) || (await isUploadedTheme(req, active_theme))
  if (!active_theme || !known) {
    return res.status(400).json({ message: "unknown theme" })
  }

  // Entitlement applies only to the compiled catalog; uploaded public themes are
  // available to every store.
  if (isKnownTheme(active_theme)) {
    const allowed: string[] | null = Array.isArray(ctx.tenant.meta?.allowed_themes)
      ? ctx.tenant.meta.allowed_themes
      : null
    if (allowed && !allowed.includes(active_theme)) {
      return res.status(403).json({ message: "this theme is not available on your plan" })
    }
  }

  await ctx.svc.updateTenants({
    id: ctx.tenant.id,
    meta: { ...(ctx.tenant.meta ?? {}), active_theme },
  })
  res.json({ active_theme })
}
