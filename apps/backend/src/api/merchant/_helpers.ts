import { MedusaRequest } from "@medusajs/framework/http"
import { PLATFORM_MODULE } from "../../modules/platform"
import {
  Entitlements,
  resolveEntitlements,
} from "../../modules/platform/entitlements"

export type MerchantCtx = { merchant: any; tenant: any; svc: any }

/**
 * Resolve the authenticated merchant + their ACTIVE tenant from the request's
 * auth context (actor_type "merchant"). Returns null if not a merchant, the
 * merchant is disabled, or the tenant is missing — every /merchant route is
 * scoped to EXACTLY this tenant, so cross-tenant access is impossible.
 *
 * MULTI-STORE (M1): the dashboard may send `x-store-id: <tenant_id>` to act
 * on another store the SAME login owns. The header is honored ONLY when a
 * live merchant_store row grants it — the sole source of store context, per
 * the iron rule (never from body/query). A store id without a grant is a
 * hard null (401 at the route), logged for the audit trail. No header =
 * merchant.tenant_id, byte-identical to the single-store world.
 */
export async function resolveMerchant(req: MedusaRequest): Promise<MerchantCtx | null> {
  const auth = (req as any).auth_context ?? {}
  if (auth.actor_type !== "merchant" || !auth.actor_id) return null
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const merchant = await svc.retrieveMerchant(auth.actor_id).catch(() => null)
  if (!merchant || merchant.status !== "active") return null

  let tenantId: string = merchant.tenant_id
  const requested = String(req.headers["x-store-id"] ?? "").trim()
  if (requested && requested !== merchant.tenant_id) {
    const grants = await svc
      .listMerchantStores(
        { merchant_id: merchant.id, tenant_id: requested },
        { take: 1 }
      )
      .catch(() => [])
    const grant = (Array.isArray(grants) ? grants : [grants]).filter(Boolean)[0]
    if (!grant) {
      console.warn(
        `[store-context] DENIED merchant=${merchant.id} requested=${requested}`
      )
      return null
    }
    tenantId = requested
  }

  const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
  if (!tenant) return null
  return { merchant, tenant, svc }
}

/**
 * The stores this login may act on (owner grants), for the switcher UI.
 */
export async function listOwnedStores(
  svc: any,
  merchantId: string
): Promise<Array<{ tenant_id: string }>> {
  const rows = await svc
    .listMerchantStores({ merchant_id: merchantId }, { take: 50 })
    .catch(() => [])
  return (Array.isArray(rows) ? rows : [rows]).filter(Boolean)
}


/**
 * The tenant's full entitlement set (plan matrix + package-row overrides).
 * Cheap enough to call per request; the package row is a single-row lookup.
 */
export async function tenantEntitlements(ctx: MerchantCtx): Promise<Entitlements> {
  const pkg =
    (
      await ctx.svc
        .listPlatformPackages({ key: ctx.tenant.package }, { take: 1 })
        .catch(() => [])
    )[0] ?? null
  let hasPurchased = false
  if (ctx.tenant.package === "free_trial") {
    const lots = await ctx.svc
      .listCreditLots({ tenant_id: ctx.tenant.id, source: "topup" }, { take: 1 })
      .catch(() => [])
    hasPurchased =
      (Array.isArray(lots) ? lots : [lots]).filter(Boolean).length > 0
  }
  return resolveEntitlements(ctx.tenant, pkg, {
    hasPurchasedCredits: hasPurchased,
  })
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
