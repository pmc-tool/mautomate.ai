import { resolveTenantId } from "../lib/tenant-context"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { getCommerceGateway } from "../modules/marketing/gateway"
import { markRecoveredByEmail } from "../modules/marketing/recovery/recovery-service"
import { SettingsService } from "../modules/marketing/settings/settings-service"

/**
 * order.placed -> mark the customer's abandoned-cart recovery as recovered.
 *
 * When an order is placed we stop any in-flight recovery sequence for that
 * shopper: resolve the order's email via the commerce gateway and flip any
 * active/processing recovery rows for that email to "recovered". This is the
 * conversion signal that ends the 3-email escalation immediately.
 *
 * DOUBLE GATE (inert by default — this deploys to a LIVE store):
 *   1. Master flag: no-op unless MARKETING_ENABLED === "1".
 *   2. Per-automation toggle: no-op unless the durable setting
 *      `automation_abandoned_cart` is explicitly enabled (defaults OFF).
 *
 * Guarantees (mirrors marketing-product-created.ts):
 *   - NEVER throws. A marketing hiccup must not fail order placement nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged.
 */

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")
const AUTOMATION_KEY = "automation_abandoned_cart"

export default async function marketingCartRecoveredHandler({
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
    const logger: any = container.resolve("logger")

    // Gate 2 — per-automation toggle (durable setting, defaults OFF).
    const settings = new SettingsService(container)
    const enabled = await settings.get<boolean>(TENANT_ID, AUTOMATION_KEY, false)
    if (enabled !== true) {
      return
    }

    const gateway = getCommerceGateway(container)
    const order = await gateway.getOrder(TENANT_ID, orderId)
    const email = order?.email
    if (!email) {
      return
    }

    await markRecoveredByEmail(container, TENANT_ID, email)

    logger?.info?.(
      `[marketing] order.placed: closed cart recovery for ${email}`
    )
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    try {
      const logger: any = container.resolve("logger")
      logger?.error?.(
        `[marketing] order.placed recovery handler error (swallowed) for order ${orderId}: ${
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
