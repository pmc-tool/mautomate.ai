import { resolveTenantId } from "../lib/tenant-context"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { CALL_CENTER_MODULE } from "../modules/call-center"
import { MedusaCommerceGateway } from "../modules/call-center/gateway/medusa-adapter"

/**
 * order.placed -> schedule a COD-confirmation call task (call-center layer).
 *
 * This is a Cash-on-Delivery store using the "Manual Payment" provider: an order
 * is placed BEFORE money is collected. Before we ship such an order we want a
 * confirmation call. On every `order.placed` this subscriber:
 *   1. Reads the normalized order via the commerce gateway.
 *   2. Decides whether the order is COD-confirmable (see `isCodConfirmable`):
 *      payment not yet captured AND nothing fulfilled yet.
 *   3. If it qualifies AND has a dialable phone, creates a `scheduled` outbound
 *      CallTask (playbook `cod_confirmation`) and puts the order on a
 *      fulfillment HOLD so nothing ships until the call resolves.
 *
 * MASTER SAFETY FLAG: the whole handler is a no-op unless
 * CALL_CENTER_ENABLED === "true". This keeps the module completely inert in
 * production until it is explicitly switched on.
 *
 * Guarantees (mirrors cms-published.ts):
 *   - NEVER throws. A call-center hiccup must not fail order placement nor poison
 *     the event-bus retry loop. All IO is wrapped and failures are logged.
 */

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * COD-confirmable = payment is NOT captured (still pending collection) AND the
 * order has not started fulfillment. On this Manual-Payment store the placed
 * payment status is one of not_paid / awaiting / authorized.
 */
function isCodConfirmable(
  paymentStatus: string | null,
  fulfillmentStatus: string | null
): boolean {
  const confirmablePayment =
    paymentStatus === "not_paid" ||
    paymentStatus === "awaiting" ||
    paymentStatus === "authorized"

  return confirmablePayment && fulfillmentStatus === "not_fulfilled"
}

export default async function callCenterOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>): Promise<void> {
  // Master kill-switch: inert unless explicitly enabled.
  if (process.env.CALL_CENTER_ENABLED !== "true") {
    return
  }

  const orderId = data?.id
  if (!orderId) {
    return
  }

  try {
    const gateway = new MedusaCommerceGateway(container)

    const order = await gateway.getOrder(TENANT_ID, orderId)
    if (!order) {
      // eslint-disable-next-line no-console
      console.warn(
        `[call-center] order.placed: order ${orderId} not found — skipping.`
      )
      return
    }

    // Only schedule a confirmation call for COD-confirmable orders.
    if (
      !isCodConfirmable(order.payment_status, order.fulfillment_status)
    ) {
      return
    }

    // No dialable number -> nothing to call. Do not create a dead task.
    const toNumber = order.shipping_address?.phone
    if (!toNumber) {
      // eslint-disable-next-line no-console
      console.warn(
        `[call-center] order.placed: order ${orderId} has no shipping phone — skipping call task.`
      )
      return
    }

    const cc: any = container.resolve(CALL_CENTER_MODULE)

    // Schedule the outbound COD-confirmation task (dialer sweep picks it up).
    await cc.createCallTasks({
      tenant_id: TENANT_ID,
      order_id: orderId,
      customer_id: order.customer_id,
      direction: "outbound",
      status: "scheduled",
      scheduled_at: new Date(),
      playbook_id: "cod_confirmation",
      locale: "bn",
      max_attempts: 3,
    })

    // Hold fulfillment until the confirmation call resolves. This is a
    // call-center-only flag — our own fulfillment path must honor it.
    await gateway.markFulfillmentHold(TENANT_ID, orderId, true)

    // eslint-disable-next-line no-console
    console.log(
      `[call-center] order.placed: scheduled COD confirmation call for order ${orderId}`
    )
  } catch (e) {
    // Absolute backstop — a subscriber must never throw past this point.
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] order.placed handler error (swallowed) for order ${orderId}:`,
      e
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
