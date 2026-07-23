import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { THEME_CATALOG, catalogWithPreviewUrls } from "../../admin/cms/themes/_catalog"
import { THEME_MODULE } from "../../../modules/theme"

/* GET /merchant/themes — the storefront theme gallery a merchant applies from.
   Returns BOTH the compiled React themes (entitlement-filtered) AND the
   uploaded (Liquid) themes in the library. To the merchant they are one gallery
   — they never need to know a theme's engine. `engine` distinguishes them so
   the UI can show the right preview URL (a Liquid theme previews via
   ?preview_theme=). */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const catalogIds = THEME_CATALOG.map((t) => t.id)
  const allowed: string[] = Array.isArray(ctx.tenant.meta?.allowed_themes)
    ? ctx.tenant.meta.allowed_themes.filter((i: string) => catalogIds.includes(i))
    : catalogIds

  const storefrontUrl =
    process.env.STOREFRONT_PREVIEW_URL ||
    process.env.STOREFRONT_URL ||
    "https://storefront.mautomate.ai"

  const compiled = catalogWithPreviewUrls(storefrontUrl)
    .filter((t) => allowed.includes(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      preview: t.preview_url,
      engine: "react" as const,
    }))

  // Uploaded themes: published, public ones are available to every store.
  let uploaded: any[] = []
  try {
    const svc: any = req.scope.resolve(THEME_MODULE)
    const themes = await svc.listThemes({ status: "published", visibility: "public" })
    const versions = await svc.listThemeVersions({})
    const previewByTheme = new Map<string, string | null>()
    for (const t of themes) {
      const current =
        versions.find((v: any) => v.theme_id === t.id && v.version === t.current_version) ??
        versions.filter((v: any) => v.theme_id === t.id)[0]
      previewByTheme.set(t.id, current?.preview ?? null)
    }
    uploaded = themes.map((t: any) => ({
      id: t.handle,
      name: t.name,
      description: t.description ?? "",
      preview: previewByTheme.get(t.id) ?? null,
      engine: "liquid" as const,
    }))
  } catch {
    // Theme module unavailable — show the compiled catalog alone.
  }

  const all = [...compiled, ...uploaded]
  const ids = all.map((t) => t.id)
  let active = ctx.tenant.meta?.active_theme
  if (!active || !ids.includes(active))
    active = ids.includes("learts-liquid")
      ? "learts-liquid"
      : uploaded[0]?.id ?? compiled[0]?.id ?? ids[0]

  res.json({ themes: all, active_theme: active })
}
