import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { THEME_CATALOG, catalogWithPreviewUrls } from "../../admin/cms/themes/_catalog"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const ids = THEME_CATALOG.map((t) => t.id)
  const allowed: string[] = Array.isArray(ctx.tenant.meta?.allowed_themes)
    ? ctx.tenant.meta.allowed_themes.filter((i: string) => ids.includes(i))
    : ids
  let active = ctx.tenant.meta?.active_theme
  if (!active || !ids.includes(active)) active = ids[0]

  const storefrontUrl =
    process.env.STOREFRONT_PREVIEW_URL ||
    process.env.STOREFRONT_URL ||
    "https://storefront.mautomate.ai"

  // A merchant only sees the themes their plan is entitled to.
  const themes = catalogWithPreviewUrls(storefrontUrl)
    .filter((t) => allowed.includes(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      preview: t.preview_url,
    }))
  res.json({ themes, active_theme: active })
}
