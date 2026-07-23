import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  logUnresolvedTenant,
  tenantForProduct,
} from "../lib/marketing-event-tenant"
import { notifyLowStock } from "../modules/platform/push/push-notifier"

/**
 * inventory-level.updated -> push a "Low stock" nudge to the merchant's phone.
 *
 * ============================ INERT BY DEFAULT ============================
 * Gated by PUSH_ENABLED=1 (checked FIRST, so a store that never turns push on
 * pays ZERO cost here — we return before any query). The notifier itself is
 * additionally gated on the FCM creds, so even with the flag on it no-ops
 * cleanly until the credentials land. Purely additive: a brand-new subscriber
 * file that touches no existing handler — it runs ALONGSIDE
 * marketing-inventory-low.ts (which drafts a post) without altering it.
 * =========================================================================
 *
 * EVENT-NAME + SHAPE ASSUMPTIONS: mirrors marketing-inventory-low.ts. Stock in
 * Medusa v2 lives on `inventory_level` (`stocked_quantity` / `reserved_quantity`),
 * so the change fires `inventory-level.updated`. Every field is optional-chained;
 * any unrecognized payload shape is a silent no-op.
 *
 * TENANT ATTRIBUTION: derived PER EVENT from the linked product's sales channel
 * (lib/marketing-event-tenant.ts), FAIL-CLOSED — an unattributable product
 * notifies nobody rather than the wrong store. We notify every device in the
 * tenant (all of that store's merchant users).
 *
 * NEVER throws: an inventory update must never be failed by a push, nor may this
 * poison the event-bus retry loop.
 */

const lowStockThreshold = (): number => {
  const raw = Number(process.env.MARKETING_LOW_STOCK_THRESHOLD)
  return Number.isFinite(raw) && raw >= 0 ? raw : 5
}

/**
 * Best-effort resolution of the linked product id + available quantity from an
 * inventory level id, traversing inventory_level -> inventory_item -> variants ->
 * product. Returns null on any missing hop so the caller can no-op cleanly.
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

export default async function pushInventoryLow({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Cost-zero kill switch — bail before any work when push is off.
  if (process.env.PUSH_ENABLED !== "1") {
    return
  }

  const levelId = data?.id
  if (!levelId) {
    return
  }

  try {
    const resolved = await resolveLowStock(container, levelId)
    if (!resolved) {
      // Unrecognized/unlinked shape — nothing actionable. Silent no-op.
      return
    }

    const threshold = lowStockThreshold()
    // Only nudge when stock has actually crossed into the low band (and is not a
    // negative anomaly we can't sell against).
    if (resolved.available < 0 || resolved.available > threshold) {
      return
    }

    // Owning tenant, derived from the product's sales channel. FAIL-CLOSED.
    const tenantId = await tenantForProduct(container, resolved.productId)
    if (!tenantId) {
      logUnresolvedTenant(
        container,
        "inventory-level.updated (push)",
        "product",
        resolved.productId
      )
      return
    }

    // Best-effort title enrichment for a friendlier notification body.
    let productTitle: string | undefined
    try {
      const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: rows } = await query.graph({
        entity: "product",
        fields: ["title"],
        filters: { id: resolved.productId },
      })
      const t = rows?.[0]?.title
      if (t) {
        productTitle = String(t)
      }
    } catch {
      // Enrichment is optional — a generic "A product is low on stock" works.
    }

    await notifyLowStock(container, tenantId, {
      productTitle,
      available: resolved.available,
    })
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[push] inventory-level.updated handler error (swallowed) for level ${levelId}: ${
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
