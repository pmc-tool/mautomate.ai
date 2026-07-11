import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { isKnownTheme } from "../../admin/cms/themes/_catalog"

/** PUT /merchant/theme { active_theme } — the merchant activates a theme for their store. */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const active_theme = String((req.body as { active_theme?: string })?.active_theme ?? "").trim()
  if (!active_theme || !isKnownTheme(active_theme)) {
    return res.status(400).json({ message: "unknown theme" })
  }
  const allowed: string[] | null = Array.isArray(ctx.tenant.meta?.allowed_themes)
    ? ctx.tenant.meta.allowed_themes
    : null
  if (allowed && !allowed.includes(active_theme)) {
    return res.status(403).json({ message: "this theme is not available on your plan" })
  }
  await ctx.svc.updateTenants({ id: ctx.tenant.id, meta: { ...(ctx.tenant.meta ?? {}), active_theme } })
  res.json({ active_theme })
}
