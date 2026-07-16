import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  tenantForOrder,
  logUnresolvedTenant,
} from "../lib/marketing-event-tenant"
import { sendPurchaseEvent } from "../modules/marketing/ads"

/**
 * order.placed -> Meta Conversions API Purchase event (server-side).
 *
 * Gated by MARKETING_ADS_ENABLED=1 (the advertising kill switch), then by the
 * tenant actually having an active pixel + connected Meta account — a store
 * that never touched the Advertising panel costs zero work here.
 *
 * TENANT ATTRIBUTION: derived per event from the order's sales channel
 * (lib/marketing-event-tenant.ts), FAIL-CLOSED — an unattributable order sends
 * nothing rather than firing on the wrong store's pixel.
 *
 * NEVER throws: sendPurchaseEvent returns a summary and logs failures to
 * ads_action_log where the merchant can see them.
 */
export default async function adsOrderPlaced({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (process.env.MARKETING_ADS_ENABLED !== "1") {
    return
  }
  const orderId = data?.id
  if (!orderId) {
    return
  }

  try {
    const tenantId = await tenantForOrder(container, orderId)
    if (!tenantId) {
      logUnresolvedTenant(container, "order.placed (ads capi)", "order", orderId)
      return
    }
    await sendPurchaseEvent(container, tenantId, orderId)
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.("[ads] capi purchase subscriber failed:", e as any)
    } catch {
      /* logging must never throw */
    }
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
