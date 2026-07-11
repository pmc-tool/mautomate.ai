import { resolveTenantId } from "../lib/tenant-context"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { getCommerceGateway } from "../modules/marketing/gateway"
import { enrollForTrigger } from "../modules/marketing/journey/enrollment-service"

/**
 * cart.updated -> enroll the shopper into any active "cart.updated" journey
 * (e.g. a browse/abandon nurture that starts the moment an email is on the cart).
 *
 * Resolves the cart via the commerce gateway and only proceeds once the cart has
 * a reachable email (present after the customer reaches the email/address step).
 *
 * IDEMPOTENCY: cart.updated fires often (every line/address change), but journeys
 * created with allow_reenroll = false enroll a given contact at most once — the
 * enrollment engine's "already_enrolled" guard makes the repeated firing a no-op,
 * so we do not need to debounce here.
 *
 * MASTER GATE (inert by default — this deploys to a LIVE store):
 *   - no-op unless MARKETING_ENABLED === "1".
 *
 * Guarantees (mirrors marketing-cart-recovered.ts):
 *   - NEVER throws. A marketing hiccup must not fail the cart update nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged.
 */

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

export default async function marketingJourneyCartUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Master kill-switch: inert unless explicitly enabled.
  if (process.env.MARKETING_ENABLED !== "1") {
    return
  }

  const cartId = data?.id
  if (!cartId) {
    return
  }

  try {
    const gateway = getCommerceGateway(container)
    const cart = await gateway.getCart(TENANT_ID, cartId)

    // Only enroll once the cart is reachable — no email, nothing to nurture.
    const email = cart?.email
    if (!email) {
      return
    }

    await enrollForTrigger(container, {
      tenantId: TENANT_ID,
      event: "cart.updated",
      contactRef: { email },
      context: { data: { cart_id: cartId } },
    })
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] cart.updated journey handler error (swallowed) for cart ${cartId}: ${
          (e as any)?.message ?? e
        }`
      )
    } catch {
      // ignore — logging must not throw either.
    }
  }
}

export const config: SubscriberConfig = {
  event: "cart.updated",
}
