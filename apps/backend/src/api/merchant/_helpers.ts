import { MedusaRequest } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"

export type MerchantCtx = { merchant: any; tenant: any; svc: any }

/**
 * Resolve the authenticated merchant + their tenant from the request's auth
 * context (actor_type "merchant"). Returns null if not a merchant, the merchant
 * is disabled, or the tenant is missing — every /merchant route is scoped to
 * EXACTLY this tenant, so cross-tenant access is impossible.
 */
export async function resolveMerchant(req: MedusaRequest): Promise<MerchantCtx | null> {
  const auth = (req as any).auth_context ?? {}
  if (auth.actor_type !== "merchant" || !auth.actor_id) return null
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const merchant = await svc.retrieveMerchant(auth.actor_id).catch(() => null)
  if (!merchant || merchant.status !== "active") return null
  const tenant = await svc.retrieveTenant(merchant.tenant_id).catch(() => null)
  if (!tenant) return null
  return { merchant, tenant, svc }
}


/**
 * Custom-domain entitlement for a store. Connecting your own domain (or buying
 * one and routing it to the store) is a paid feature: the tenant's
 * package.domains_limit caps how many custom domains it may serve (0 = none,
 * free mautomate.ai subdomain only). Enforced on EVERY path that connects a
 * custom hostname (connect + buy) so a lower tier cannot bypass it.
 */
export async function domainEntitlement(
  ctx: MerchantCtx
): Promise<{ ok: true; limit: number; used: number } | { ok: false; message: string }> {
  const plan = (
    await ctx.svc
      .listPlatformPackages({ key: ctx.tenant.package }, { take: 1 })
      .catch(() => [])
  )[0]
  const limit = Number(plan?.domains_limit ?? 0)
  const used = (
    await ctx.svc.listTenantDomains({ tenant_id: ctx.tenant.id }).catch(() => [])
  ).filter((d: any) => d.type !== "free").length
  if (limit <= 0) {
    return {
      ok: false,
      message:
        "Connecting your own domain is a paid feature \u2014 upgrade to the Growth plan or above to add a custom domain. Your store stays live on its free mautomate.ai address in the meantime.",
    }
  }
  if (used >= limit) {
    return {
      ok: false,
      message: `Your plan includes ${limit} custom domain${
        limit > 1 ? "s" : ""
      }. Upgrade for more, or remove one first.`,
    }
  }
  return { ok: true, limit, used }
}
