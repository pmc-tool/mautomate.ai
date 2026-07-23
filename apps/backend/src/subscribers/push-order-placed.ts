import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  logUnresolvedTenant,
  tenantForOrder,
} from "../lib/marketing-event-tenant"
import { notifyNewOrder } from "../modules/platform/push/push-notifier"

/**
 * order.placed -> push a "New order" notification to the merchant's phone.
 *
 * ============================ INERT BY DEFAULT ============================
 * Gated by PUSH_ENABLED=1 (checked FIRST, so a store that never turns push on
 * pays ZERO cost here — we return before any query). The notifier itself is
 * additionally gated on the FCM creds, so even with the flag on it no-ops
 * cleanly until the credentials land. Purely additive: a brand-new subscriber
 * file that touches no existing handler.
 * =========================================================================
 *
 * TENANT ATTRIBUTION: derived per event from the order's sales channel
 * (lib/marketing-event-tenant.ts), FAIL-CLOSED — an unattributable order
 * notifies nobody rather than the wrong store. We notify every device in the
 * tenant (all of that store's merchant users).
 *
 * NEVER throws: an order must never be failed by a push, nor may this poison
 * the event-bus retry loop.
 */
export default async function pushOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Cost-zero kill switch — bail before any work when push is off.
  if (process.env.PUSH_ENABLED !== "1") {
    return
  }

  const orderId = data?.id
  if (!orderId) {
    return
  }

  try {
    const tenantId = await tenantForOrder(container, orderId)
    if (!tenantId) {
      logUnresolvedTenant(container, "order.placed (push)", "order", orderId)
      return
    }

    // Best-effort enrichment for a friendlier notification body.
    let orderDisplay: string | undefined
    let total: string | undefined
    try {
      const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: rows } = await query.graph({
        entity: "order",
        fields: ["display_id", "total", "currency_code"],
        filters: { id: orderId },
      })
      const o = rows?.[0]
      if (o?.display_id != null) {
        orderDisplay = `#${o.display_id}`
      }
      if (o?.total != null && o?.currency_code) {
        total = `${String(o.currency_code).toUpperCase()} ${o.total}`
      }
    } catch {
      // Enrichment is optional — a bare "New order just came in." still works.
    }

    await notifyNewOrder(container, tenantId, { orderDisplay, total })
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[push] order.placed handler error (swallowed) for order ${orderId}: ${
          (e as any)?.message ?? e
        }`
      )
    } catch {
      // logging must never throw either
    }
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
