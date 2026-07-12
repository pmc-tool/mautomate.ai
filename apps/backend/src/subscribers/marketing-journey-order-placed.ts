import {
  logUnresolvedTenant,
  tenantForOrder,
} from "../lib/marketing-event-tenant"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { getCommerceGateway } from "../modules/marketing/gateway"
import { enrollForTrigger } from "../modules/marketing/journey/enrollment-service"

/**
 * order.placed -> enroll the buyer into any active "order.placed" journey.
 *
 * Resolves the order via the commerce gateway to obtain the buyer's email and
 * customer id, then hands them to the journey enrollment engine, which finds the
 * active journeys wired to this trigger and drops an enrollment row per journey.
 *
 * MASTER GATE (inert by default — this deploys to a LIVE store):
 *   - no-op unless MARKETING_ENABLED === "1".
 *
 * Guarantees (mirrors marketing-cart-recovered.ts):
 *   - NEVER throws. A marketing hiccup must not fail order placement nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged.
 *
 * TENANT ATTRIBUTION (A-6): the owning tenant is derived PER EVENT from the
 * entity's sales channel (lib/marketing-event-tenant.ts), never pinned at module
 * load. In the pooled backend a module-load `resolveTenantId()` has no request
 * context and collapses to the shared "default" tenant, which would attribute
 * every store's events to one tenant. FAIL-CLOSED: if the tenant cannot be
 * proven, the handler does nothing and says so in the log.
 */

export default async function marketingJourneyOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Master kill-switch: inert unless explicitly enabled.
  if (process.env.MARKETING_ENABLED !== "1") {
    return
  }

  const orderId = data?.id
  if (!orderId) {
    return
  }

  try {
    // The owning tenant, derived from the order's sales channel (fail-closed).
    const tenantId = await tenantForOrder(container, orderId)
    if (!tenantId) {
      logUnresolvedTenant(container, "order.placed (journey)", "order", orderId)
      return
    }

    const gateway = getCommerceGateway(container)
    const order = await gateway.getOrder(tenantId, orderId)
    if (!order) {
      return
    }

    await enrollForTrigger(container, {
      tenantId,
      event: "order.placed",
      contactRef: {
        email: order.email,
        customerId: order.customer_id,
      },
      context: { data: { order_id: orderId } },
    })
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] order.placed journey handler error (swallowed) for order ${orderId}: ${
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
