import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { THEME_CATALOG } from "../../admin/cms/themes/_catalog"
import { resolveBrandAccent } from "../../../modules/marketing/brand"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { merchant, tenant, svc } = ctx
  // All themes are uploaded (Liquid) now — the compiled catalog is empty, so
  // pass the tenant's real active theme through (default: the platform theme).
  const allowed = Array.isArray(tenant.meta?.allowed_themes)
    ? tenant.meta.allowed_themes
    : THEME_CATALOG.map((t) => t.id)
  const active = tenant.meta?.active_theme || "learts-liquid"

  // Subscription entitlements the UI needs (e.g. custom-domain gating).
  const plan = (
    await svc
      .listPlatformPackages({ key: tenant.package }, { take: 1 })
      .catch(() => [])
  )[0]

  // White-label branding for the merchant apps (additive): the uploaded
  // logo (tenant.meta.logo_url) and the optional per-tenant brand accent.
  // Both are fail-safe and degrade to null so unbranded stores are
  // unaffected.
  const logoUrl =
    (tenant.meta?.logo_url as string | undefined) || null
  const brandAccent =
    (await resolveBrandAccent(req.scope, tenant.id).catch(() => "")) || null

  res.json({
    merchant: { id: merchant.id, email: merchant.email, name: merchant.name },
    store: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      domain: `${tenant.slug}.mautomate.ai`,
      credit_balance: Number(tenant.credit_balance ?? 0),
      package: tenant.package,
      plan: {
        key: plan?.key ?? tenant.package,
        name: plan?.name ?? tenant.package,
        domains_limit: Number(plan?.domains_limit ?? 0),
      },
      active_theme: active,
      allowed_themes: allowed,
      logo_url: logoUrl,
      brand_accent: brandAccent,
    },
  })
}
