import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant, listOwnedStores } from "../_helpers"
import {
  resolveEntitlements,
  trialInfo,
} from "../../../modules/platform/entitlements"
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

  // Multi-store (M1): every store this login owns, for the dashboard
  // switcher. Single-store merchants get a one-item list.
  let stores: Array<{ id: string; name: string; slug: string; is_active: boolean }> = []
  try {
    const grants = await listOwnedStores(svc, merchant.id)
    const rows = await Promise.all(
      grants.map((g) => svc.retrieveTenant(g.tenant_id).catch(() => null))
    )
    stores = rows
      .filter(Boolean)
      .filter((t: any) => !["purged", "failed"].includes(t.status))
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        is_active: t.id === tenant.id,
      }))
  } catch {
    stores = [{ id: tenant.id, name: tenant.name, slug: tenant.slug, is_active: true }]
  }

  res.json({
    merchant: { id: merchant.id, email: merchant.email, name: merchant.name },
    stores,
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
      // Full entitlement set (matrix + package-row overrides): the dashboard
      // mirrors these to hide/upsell; the server independently enforces them.
      entitlements: resolveEntitlements(tenant, plan ?? null),
      // Trial clock (state trial/grace/paused, or paid) for banners/prompts.
      trial: trialInfo(tenant),
      active_theme: active,
      allowed_themes: allowed,
      logo_url: logoUrl,
      brand_accent: brandAccent,
    },
  })
}
