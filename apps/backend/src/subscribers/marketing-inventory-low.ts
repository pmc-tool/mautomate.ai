import {
  logUnresolvedTenant,
  tenantForProduct,
} from "../lib/marketing-event-tenant"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../modules/marketing"
import { getCommerceGateway } from "../modules/marketing/gateway"
import { SettingsService } from "../modules/marketing/settings/settings-service"

/**
 * inventory-level.updated -> auto-draft a "last chance / low stock" post.
 *
 * ------------------------------------------------------------------------
 * EVENT-NAME ASSUMPTION (documented on purpose):
 *   Stock quantity in Medusa v2 lives on the `inventory_level` (fields
 *   `stocked_quantity` / `reserved_quantity`), so the event that fires when
 *   stock actually changes is the inventory module's `inventory-level.updated`
 *   (InventoryEvents.INVENTORY_LEVEL_UPDATED = "inventory.inventory-level.updated";
 *   the module also emits the un-namespaced short form). Because auto CRUD-event
 *   emission depends on the inventory module's runtime config and may not fire
 *   in every deployment, this subscriber is wired DEFENSIVELY: every field is
 *   optional-chained and any unrecognized payload shape is a silent no-op. It is
 *   ready to work the moment the event fires; until then it costs nothing.
 * ------------------------------------------------------------------------
 *
 * On a qualifying update we compute available = stocked - reserved. When that
 * crosses at/under the low-stock threshold (env MARKETING_LOW_STOCK_THRESHOLD,
 * default 5) we resolve the linked product and create a DRAFT "last chance"
 * marketing post (source "automation") for a human to review in the Post Hub.
 *
 * DOUBLE GATE (inert by default — this deploys to a LIVE store):
 *   1. Master flag: no-op unless MARKETING_ENABLED === "1".
 *   2. Per-automation toggle: no-op unless the durable setting
 *      `automation_low_stock` is explicitly enabled (defaults OFF).
 *
 * Guarantees (mirrors call-center-order-placed.ts / cms-published.ts):
 *   - NEVER throws. An inventory update must never be failed by this handler,
 *     nor may it poison the event-bus retry loop. All IO is wrapped and failures
 *     are logged via the container logger.
 *
 * TENANT ATTRIBUTION (A-6): the owning tenant is derived PER EVENT from the
 * entity's sales channel (lib/marketing-event-tenant.ts), never pinned at module
 * load. In the pooled backend a module-load `resolveTenantId()` has no request
 * context and collapses to the shared "default" tenant, which would attribute
 * every store's events to one tenant. FAIL-CLOSED: if the tenant cannot be
 * proven, the handler does nothing and says so in the log.
 */
const AUTOMATION_KEY = "automation_low_stock"

const lowStockThreshold = (): number => {
  const raw = Number(process.env.MARKETING_LOW_STOCK_THRESHOLD)
  return Number.isFinite(raw) && raw >= 0 ? raw : 5
}

/**
 * Best-effort resolution of the linked product id + title from an inventory
 * level id, traversing inventory_level -> inventory_item -> variants -> product.
 * Returns null on any missing hop so the caller can no-op cleanly.
 */
const resolveLowStock = async (
  container: SubscriberArgs["container"],
  levelId: string
): Promise<{ productId: string; available: number } | null> => {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "inventory_level",
    fields: [
      "id",
      "stocked_quantity",
      "reserved_quantity",
      "inventory_item_id",
      "inventory_item.variants.product_id",
    ],
    filters: { id: levelId },
  })

  const level = data?.[0]
  if (!level) {
    return null
  }

  const stocked = Number(level?.stocked_quantity)
  const reserved = Number(level?.reserved_quantity ?? 0)
  if (!Number.isFinite(stocked)) {
    return null
  }
  const available = stocked - (Number.isFinite(reserved) ? reserved : 0)

  // Pull the first linked product id from the variant graph (optional-chained).
  const variants = level?.inventory_item?.variants
  const productId =
    (Array.isArray(variants)
      ? variants.find((v: any) => v?.product_id)?.product_id
      : undefined) ?? null

  if (!productId) {
    return null
  }

  return { productId, available }
}

export default async function marketingInventoryLowHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Gate 1 — master kill-switch: inert unless explicitly enabled.
  if (process.env.MARKETING_ENABLED !== "1") {
    return
  }

  const levelId = data?.id
  if (!levelId) {
    return
  }

  try {
    const logger: any = container.resolve("logger")

    const resolved = await resolveLowStock(container, levelId)
    if (!resolved) {
      // Unrecognized/unlinked shape — nothing actionable. Silent no-op.
      return
    }

    // Gate 2 — the owning tenant, derived from the product's sales channel.
    const tenantId = await tenantForProduct(container, resolved.productId)
    if (!tenantId) {
      logUnresolvedTenant(
        container,
        "inventory-level.updated",
        "product",
        resolved.productId
      )
      return
    }

    // Gate 3 — per-automation toggle (durable setting, defaults OFF, per tenant).
    const settings = new SettingsService(container)
    const enabled = await settings.get<boolean>(tenantId, AUTOMATION_KEY, false)
    if (enabled !== true) {
      return
    }

    const threshold = lowStockThreshold()
    // Only draft when stock has actually crossed into the low band (and is not
    // a fully out-of-stock/negative anomaly we can't sell against).
    if (resolved.available < 0 || resolved.available > threshold) {
      return
    }

    const gateway = getCommerceGateway(container)
    const product = await gateway.getProduct(tenantId, resolved.productId)
    if (!product) {
      logger?.warn?.(
        `[marketing] inventory-level.updated: product ${resolved.productId} not found — skipping draft.`
      )
      return
    }

    const title = (product.title ?? "").trim() || "This item"
    const body =
      resolved.available <= 0
        ? `Almost gone: ${title} is selling out fast. Last chance to grab it.`
        : `Only ${resolved.available} left of ${title}. Last chance — grab it before it's gone.`

    const svc: any = container.resolve(MARKETING_MODULE)
    await svc.createMarketingPosts({
      tenant_id: tenantId,
      status: "draft",
      source: "automation",
      title: `Last chance: ${title}`,
      body,
      product_ids: [resolved.productId],
    })

    logger?.info?.(
      `[marketing] inventory-level.updated: drafted low-stock post for product ${resolved.productId} (available ${resolved.available})`
    )
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] inventory-level.updated handler error (swallowed) for level ${levelId}: ${
          (e as any)?.message ?? e
        }`
      )
    } catch {
      // ignore — logging must not throw either.
    }
  }
}

export const config: SubscriberConfig = {
  event: "inventory-level.updated",
}
