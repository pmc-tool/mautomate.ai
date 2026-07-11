import { resolveTenantId } from "../lib/tenant-context"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { getCommerceGateway } from "../modules/marketing/gateway"
import { applyScore } from "../modules/marketing/scoring/scoring-service"

/**
 * order.placed -> award the buyer engagement points for the purchase.
 *
 * Resolves the order's email via the commerce gateway and applies the
 * `purchase` scoring event to that contact. The score bump feeds dynamic
 * segments and the engagement leaderboard.
 *
 * GATES (inert by default — this deploys to a LIVE store):
 *   1. Master flag: no-op unless MARKETING_ENABLED === "1".
 *   2. `applyScore` is itself dormant unless the durable setting
 *      `scoring_enabled` is explicitly true (defaults OFF).
 *
 * Guarantees (mirrors marketing-cart-recovered.ts):
 *   - NEVER throws. A scoring hiccup must not fail order placement nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged.
 */

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

export default async function marketingScoringOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Gate 1 — master kill-switch: inert unless explicitly enabled.
  if (process.env.MARKETING_ENABLED !== "1") {
    return
  }

  const orderId = data?.id
  if (!orderId) {
    return
  }

  try {
    const gateway = getCommerceGateway(container)
    const order = await gateway.getOrder(TENANT_ID, orderId)
    const email = order?.email
    if (!email) {
      return
    }

    await applyScore(container, {
      tenantId: TENANT_ID,
      email,
      event: "purchase",
    })
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] order.placed scoring handler error (swallowed) for order ${orderId}: ${
          (e as any)?.message ?? e
        }`
      )
    } catch {
      // ignore — logging must not throw either.
    }
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
