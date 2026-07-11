import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../modules/platform"
import { HostResolver } from "../../modules/platform/host-resolver"
import { themeAccent } from "../admin/platform/_themes"
import { getOrCreateTenantWebsite, umamiConfigured } from "../../lib/umami"

/**
 * GET /tenant-config?host=<host> — the pooled storefront's entry point.
 *
 * A single stateless storefront fleet serves every tenant. On each request it
 * asks this endpoint "who owns this Host?" and gets back the tenant's PUBLIC
 * storefront credential (publishable key) + display info, then renders that
 * tenant's store. Publishable keys are public by design, so this route is open
 * (no key required — it is what hands out the key).
 *
 * Returns 404 for an unknown/unroutable host so the storefront can show a
 * "store not found" page instead of leaking another tenant's data.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const host = String(
    (req.query.host as string) ?? req.headers["x-forwarded-host"] ?? req.headers.host ?? ""
  )
  if (!host) {
    res.status(400).json({ message: "host required" })
    return
  }

  const resolver = new HostResolver(req.scope)
  const resolved = await resolver.resolve(host)
  // A store is routable if it is pooled (has a publishable key) OR runs a
  // dedicated instance (has a backend_url). Dedicated instances get their
  // publishable key from their own Medusa, not the control plane.
  if (!resolved || (!resolved.publishable_key && !resolved.backend_url)) {
    res.status(404).json({ message: "no store for this host" })
    return
  }

  // include the tenant display name for the storefront header
  const svc = req.scope.resolve(PLATFORM_MODULE) as any
  const [tenant] = await svc.listTenants({ id: resolved.tenant_id }, { take: 1 })

  const accent = await themeAccent(req.scope, tenant?.meta?.theme_key)
  let umamiWebsiteId: string | null = null
  if (umamiConfigured() && tenant) {
    umamiWebsiteId = await getOrCreateTenantWebsite(svc, tenant).catch(() => null)
  }
  res.json({
    tenant_id: resolved.tenant_id,
    name: tenant?.name ?? null,
    publishable_key: resolved.publishable_key,
    umami_website_id: umamiWebsiteId,
    status: resolved.status,
    domain: resolved.domain,
    theme_accent: accent,
    // Per-tenant active storefront theme id (the real compiled-in Next.js theme,
    // e.g. "learts" / "aurora"). Lives in tenant.meta so it is per-tenant without
    // tenant-scoping the whole CMS module. The multi-tenant storefront reads this
    // to pick which theme package renders. Null => storefront falls back to default.
    active_theme:
      typeof tenant?.meta?.active_theme === "string"
        ? tenant.meta.active_theme
        : null,
    // Dedicated-instance backend (instance-per-tenant). When set, this tenant
    // runs its OWN Medusa instance/admin at this URL; the edge routes the store
    // admin + store API there. Null => pooled tenant on the shared backend.
    backend_url: tenant?.backend_url ?? null,
    // Per-tenant region id — the region that carries THIS tenant's currency
    // (and its supported currencies). In a pooled backend /store/regions returns
    // every tenant's region, so the storefront cannot pick the right currency by
    // country code alone; it resolves this region_id directly. Lives in
    // tenant.meta (set by the merchant/currency flow). Null => storefront falls
    // back to its country-code region lookup (single-region / legacy behavior).
    region_id:
      typeof tenant?.meta?.region_id === "string"
        ? tenant.meta.region_id
        : null,
    // The tenant's currency code (informational — the authoritative currency is
    // the region_id region's currency_code, which prices are denominated in).
    currency_code:
      typeof tenant?.meta?.currency_code === "string"
        ? tenant.meta.currency_code
        : null,
  })
}
