import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { THEME_CATALOG } from "../../admin/cms/themes/_catalog"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { merchant, tenant, svc } = ctx
  const ids = THEME_CATALOG.map((t) => t.id)
  const allowed = Array.isArray(tenant.meta?.allowed_themes)
    ? tenant.meta.allowed_themes.filter((i: string) => ids.includes(i))
    : ids
  let active = tenant.meta?.active_theme
  if (!active || !ids.includes(active)) active = ids[0]

  // Subscription entitlements the UI needs (e.g. custom-domain gating).
  const plan = (
    await svc
      .listPlatformPackages({ key: tenant.package }, { take: 1 })
      .catch(() => [])
  )[0]

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
    },
  })
}
