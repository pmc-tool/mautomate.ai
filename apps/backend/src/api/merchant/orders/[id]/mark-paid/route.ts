import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  capturePaymentWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/core-flows"
import { resolveMerchant } from "../../../_helpers"

/**
 * POST /merchant/orders/:id/mark-paid
 *
 * Make the order's outstanding balance paid — the same two ways Medusa does:
 *   1. If the order has an AUTHORIZED (uncaptured) payment — the normal case for
 *      an order placed with a provider authorization (card, bank transfer, the
 *      "system default" manual provider, etc.) — CAPTURE it, up to the amount
 *      still outstanding. Capturing an authorized payment is what actually
 *      collects the money; "mark as paid" on such an order previously did
 *      nothing because it only looked for not_paid/awaiting collections.
 *   2. Otherwise, if there's a not_paid / awaiting payment collection (a manual
 *      or offline order with no provider authorization), mark that collection
 *      as paid.
 *
 * Tenant-scoped via sales channel. Always returns a clear error when there is
 * genuinely nothing to collect.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: [
      "id",
      "total",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.payments.id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
      "payment_collections.payments.captures.amount",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order: any = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  const num = (v: any) => Number(v ?? 0)
  const collections = order.payment_collections || []
  const payments = collections.flatMap((pc: any) => pc.payments || [])

  // Amount already captured on a payment (captures win; fall back to captured_at).
  const capturedOf = (p: any) =>
    (p.captures || []).reduce((s: number, c: any) => s + num(c.amount), 0) ||
    (p.captured_at ? num(p.amount) : 0)

  const paidTotal = payments.reduce((s: number, p: any) => s + capturedOf(p), 0)
  const outstanding = num(order.total) - paidTotal
  if (outstanding <= 0.001) {
    return res.status(400).json({ message: "order is already fully paid" })
  }

  // 1) Capture any authorized, uncaptured, non-canceled payments — up to what's
  //    still outstanding (handles orders edited down after authorization).
  const authorized = payments.filter(
    (p: any) => !p.canceled_at && capturedOf(p) < num(p.amount)
  )
  if (authorized.length) {
    let remaining = Math.round(outstanding)
    for (const p of authorized) {
      if (remaining <= 0) break
      const capturable = Math.round(num(p.amount) - capturedOf(p))
      // Full capture when the outstanding covers the whole payment; otherwise
      // capture just the remaining outstanding amount.
      const partial = remaining < capturable ? remaining : undefined
      await capturePaymentWorkflow(req.scope).run({
        input: {
          payment_id: p.id,
          ...(partial != null ? { amount: partial } : {}),
        },
      })
      remaining -= partial ?? capturable
    }
    return res.json({ success: true, action: "captured" })
  }

  // 2) No authorized payment — mark a manual (not_paid / awaiting) collection paid.
  const collection = collections.find(
    (pc: any) => pc.status === "not_paid" || pc.status === "awaiting"
  )
  if (!collection) {
    return res
      .status(400)
      .json({ message: "no outstanding payment to collect on this order" })
  }

  try {
    await markPaymentCollectionAsPaid(req.scope).run({
      input: {
        payment_collection_id: collection.id,
        order_id: id,
        captured_by: ctx.merchant?.id,
      },
    })
    res.json({ success: true, action: "marked_paid" })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to mark as paid" })
  }
}
