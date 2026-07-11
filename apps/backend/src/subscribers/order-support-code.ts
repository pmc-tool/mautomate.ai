import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

/**
 * Stamp a spoken-friendly SUPPORT CODE on every new order.
 *
 * A random 6-digit numeric code (100000-999999) stored at
 * `order.metadata.support_code`. Numeric because, over a phone call, DIGITS
 * transcribe far more reliably than letters or emails — so this is the id a
 * caller reads out and the AI matches on. Random (not sequential like
 * display_id) so it is not enumerable. Uniqueness is best-effort within the
 * order's sales channel; a rare collision is harmless (lookup also confirms a
 * second identifier).
 *
 * Always-on (NOT gated by CALL_CENTER_ENABLED) so codes exist regardless of
 * whether calling is switched on. Idempotent: never overwrites an existing code.
 */
export default async function orderSupportCode({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event?.data?.id
  if (!orderId) return

  try {
    const orderModule: any = container.resolve(Modules.ORDER)
    const order = await orderModule.retrieveOrder(orderId).catch(() => null)
    if (!order) return
    if ((order.metadata as any)?.support_code) return // already stamped

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await orderModule.updateOrders(orderId, {
      metadata: { ...(order.metadata || {}), support_code: code },
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[order-support-code] failed to stamp code (non-blocking):", e)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
