import { PLATFORM_MODULE } from "../index"
import { MOBILE_APP_PUBLISH_PRICES, isPublishTier } from "./prices"

/**
 * Fulfil a PAID mobile-app publish order from the Stripe webhook.
 *
 * Called ONLY from the verified `checkout.session.completed` handler after
 * Stripe's signature check. It is the one place a publish order turns from
 * `awaiting_payment` into `paid` (queued for ops).
 *
 * SECURITY INVARIANT (mirrors the credit top-up underpayment fix):
 *   - The expected charge is re-derived from the tier's SERVER-SIDE price
 *     constant, never from client metadata and never even from the stored
 *     order amount. If the amount Stripe actually charged is short, we grant
 *     NOTHING (mark `payment_mismatch` for review) — fail-closed.
 *   - Idempotent on the order status + Stripe event id: a retried webhook can
 *     never double-record a paid order.
 */
export async function fulfillMobileAppPublish(
  scope: any,
  input: { ref?: string; amountPaidUsd?: number; eventId: string; tenantId?: string }
): Promise<{ ok: boolean; already?: boolean; order_id?: string; tier?: string; error?: string }> {
  const platform: any = scope.resolve(PLATFORM_MODULE)
  const ref = input.ref
  if (!ref) return { ok: false, error: "missing_order_ref" }

  const [order] = await platform.listMobileAppOrders({ id: ref }, { take: 1 })
  if (!order) return { ok: false, error: "order_not_found" }

  // Idempotency: already fulfilled (or terminal) → no-op success.
  const terminal = ["paid", "in_progress", "published"]
  if (terminal.includes(order.status) || order.stripe_event_id) {
    return { ok: true, already: true, order_id: order.id, tier: order.tier }
  }

  if (!isPublishTier(order.tier)) {
    return { ok: false, error: "unknown_tier" }
  }

  // SERVER-SIDE amount verification. Re-derive from the tier constant.
  const expectedUsd = MOBILE_APP_PUBLISH_PRICES[order.tier].launch_usd
  const paidUsd = Number(input.amountPaidUsd ?? 0)
  // Allow overpay, never underpay (tiny epsilon for float safety).
  if (!(paidUsd + 0.001 >= expectedUsd)) {
    await platform.updateMobileAppOrders({
      id: order.id,
      status: "payment_mismatch",
      amount_paid_usd: paidUsd,
      stripe_event_id: input.eventId,
      meta: {
        ...(order.meta ?? {}),
        expected_usd: expectedUsd,
        paid_usd: paidUsd,
        mismatch_at: new Date().toISOString(),
      },
    })
    return { ok: false, error: "amount_mismatch", order_id: order.id }
  }

  await platform.updateMobileAppOrders({
    id: order.id,
    status: "paid",
    amount_paid_usd: paidUsd,
    stripe_event_id: input.eventId,
    meta: {
      ...(order.meta ?? {}),
      paid_at: new Date().toISOString(),
    },
  })

  // Notify ops / super-admin for fulfilment via the audit trail. No support
  // ticket: the mobile_app_order (surfaced by /admin/platform/mobile-app-orders)
  // is the source of truth for the pipeline.
  await platform
    .createAuditLogs([
      {
        actor: "system",
        action: "mobile_app.publish.paid",
        tenant_id: order.tenant_id,
        outcome: "success",
        meta: { order_id: order.id, tier: order.tier, amount_paid_usd: paidUsd },
      },
    ])
    .catch(() => undefined)


  return { ok: true, order_id: order.id, tier: order.tier }
}
