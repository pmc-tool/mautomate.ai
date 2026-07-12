import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../modules/platform"

/**
 * marketing-event-tenant — derive the OWNING TENANT of a commerce event.
 *
 * WHY THIS EXISTS (A-6)
 * The marketing subscribers used to pin their tenant at MODULE LOAD:
 *
 *     const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")   // WRONG
 *
 * In the pooled backend one Node process serves every store, and a subscriber
 * runs OUTSIDE any request, so `resolveTenantId()` has no AsyncLocalStorage
 * context and always collapses to the shared "default" tenant. Every store's
 * order/cart/product/customer event was therefore attributed to one tenant:
 * a cross-tenant data hazard (store B's order enrolling store A's journeys).
 *
 * THE RULE (identical to the one the /merchant API enforces, see
 * api/merchant/orders/route.ts, products/route.ts, _customer-helpers.ts):
 *   a tenant owns exactly one sales channel — `tenant.meta.sales_channel_id`.
 *   - order    -> order.sales_channel_id
 *   - cart     -> cart.sales_channel_id
 *   - product  -> product_sales_channel.sales_channel_id
 *   - customer -> metadata.tenant_id, else the sales channel of any of its orders
 *
 * FAIL-CLOSED: every helper returns `null` when the tenant cannot be proven.
 * A null MUST make the caller do nothing. Writing marketing data under a
 * guessed tenant is strictly worse than skipping the automation.
 *
 * NO-THROW: these run on the event-bus path; any failure degrades to null.
 */

/** Tenant lifecycle states whose stores are serving and may run automations. */
const SERVING_STATUSES = ["live", "grace", "past_due"]

const CACHE_TTL_MS = 60_000

let cachedMap: Map<string, string> | null = null
let cachedAt = 0

/**
 * sales_channel_id -> tenant_id for every serving tenant, cached for 60s.
 *
 * Suspended / retained / purged / failed / provisioning stores are deliberately
 * absent: their events resolve to null and their automations stay inert.
 */
const salesChannelTenantMap = async (
  container: MedusaContainer
): Promise<Map<string, string>> => {
  const now = Date.now()
  if (cachedMap && now - cachedAt < CACHE_TTL_MS) {
    return cachedMap
  }

  const map = new Map<string, string>()
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const tenants: any[] = await svc.listTenants(
      { status: SERVING_STATUSES },
      { take: 10000 }
    )
    for (const tenant of tenants ?? []) {
      const scId = tenant?.meta?.sales_channel_id
      if (typeof scId === "string" && scId.length > 0) {
        map.set(scId, tenant.id)
      }
    }
  } catch {
    // Control plane unreachable: return whatever we last knew (or an empty map,
    // which fails every lookup closed).
    return cachedMap ?? map
  }

  cachedMap = map
  cachedAt = now
  return map
}

/** The tenant that owns `salesChannelId`, or null. */
export const tenantForSalesChannel = async (
  container: MedusaContainer,
  salesChannelId: string | null | undefined
): Promise<string | null> => {
  if (!salesChannelId) {
    return null
  }
  const map = await salesChannelTenantMap(container)
  return map.get(salesChannelId) ?? null
}

/** The tenant that owns order `orderId`, or null. */
export const tenantForOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<string | null> => {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      filters: { id: orderId },
      fields: ["id", "sales_channel_id"],
      pagination: { take: 1, skip: 0 },
    })
    return await tenantForSalesChannel(container, data?.[0]?.sales_channel_id)
  } catch {
    return null
  }
}

/** The tenant that owns cart `cartId`, or null. */
export const tenantForCart = async (
  container: MedusaContainer,
  cartId: string
): Promise<string | null> => {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      filters: { id: cartId },
      fields: ["id", "sales_channel_id"],
      pagination: { take: 1, skip: 0 },
    })
    return await tenantForSalesChannel(container, data?.[0]?.sales_channel_id)
  } catch {
    return null
  }
}

/**
 * The tenant that owns product `productId`, or null.
 *
 * A product is linked to its tenant through product_sales_channel. A product in
 * more than one serving tenant's channel is AMBIGUOUS and resolves to null
 * (fail-closed) rather than picking one arbitrarily.
 */
export const tenantForProduct = async (
  container: MedusaContainer,
  productId: string
): Promise<string | null> => {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product_sales_channel",
      filters: { product_id: productId },
      fields: ["sales_channel_id"],
      pagination: { take: 20, skip: 0 },
    })

    const owners = new Set<string>()
    for (const row of data ?? []) {
      const tenantId = await tenantForSalesChannel(
        container,
        (row as any)?.sales_channel_id
      )
      if (tenantId) {
        owners.add(tenantId)
      }
    }
    if (owners.size !== 1) {
      return null
    }
    return [...owners][0]
  } catch {
    return null
  }
}

/**
 * The tenant that owns customer `customerId`, or null.
 *
 * Mirrors customerBelongsToTenant(): the customer's own `metadata.tenant_id`
 * first (set when the storefront/dashboard creates it), then the sales channel
 * of any order it placed. A brand-new customer with neither marker is genuinely
 * un-attributable and resolves to null.
 */
export const tenantForCustomer = async (
  container: MedusaContainer,
  customerId: string
): Promise<string | null> => {
  try {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: customers } = await query.graph({
      entity: "customer",
      filters: { id: customerId },
      fields: ["id", "metadata"],
      pagination: { take: 1, skip: 0 },
    })
    const tagged = (customers?.[0] as any)?.metadata?.tenant_id
    if (typeof tagged === "string" && tagged.length > 0) {
      return tagged
    }

    const { data: orders } = await query.graph({
      entity: "order",
      filters: { customer_id: customerId },
      fields: ["id", "sales_channel_id"],
      pagination: { take: 1, skip: 0 },
    })
    return await tenantForSalesChannel(container, orders?.[0]?.sales_channel_id)
  } catch {
    return null
  }
}

/**
 * Log the fail-closed skip once, in one voice, so an unattributable event is
 * loud in the logs instead of silently landing on the wrong tenant.
 */
export const logUnresolvedTenant = (
  container: MedusaContainer,
  subscriber: string,
  entity: string,
  id: string
): void => {
  try {
    const logger: any = container.resolve("logger")
    logger?.warn?.(
      `[marketing] ${subscriber}: could not resolve the owning tenant for ${entity} ${id} ` +
        `(no serving tenant owns its sales channel) - skipping, fail-closed. ` +
        `Nothing was written.`
    )
  } catch {
    // logging must never throw
  }
}
