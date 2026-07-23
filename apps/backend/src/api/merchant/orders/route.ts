import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"
import { paymentStatusFrom, fulfillmentStatusFrom, orderMoneyFor } from "./_status"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ orders: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const status = req.query.status as string | undefined
  const from = req.query.from as string | undefined
  const to = req.query.to as string | undefined
  const q = req.query.q as string | undefined

  const filters: any = { sales_channel_id: scId }
  if (status) filters.status = status
  if (from || to) {
    filters.created_at = {}
    if (from) filters.created_at.$gte = new Date(from).toISOString()
    if (to) filters.created_at.$lte = new Date(to).toISOString()
  }

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "metadata",
      "status",
      "email",
      "currency_code",
      "total",
      "created_at",
      "customer_id",
      "customer.first_name",
      "customer.last_name",
      "shipping_address.country_code",
      "items.quantity",
      "payment_collections.status",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
    ],
    filters,
    pagination: { take: 200, skip: 0, order: { created_at: "DESC" } } as any,
  })

  // The graph's `total` is computed off line-item quantities it reads as 0, so it
  // reports shipping-only totals. Read the real figures from the order's latest
  // version before anything is shown to a merchant.
  const money = await orderMoneyFor(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    (data || []).map((o: any) => o.id)
  )

  let orders = (data || []).map((o: any) => ({
    id: o.id,
    // Per-store order number (order.metadata.store_order_no, assigned by the
    // order.placed subscriber). Falls back to the global display_id for
    // legacy/unattributable orders.
    display_id: o.metadata?.store_order_no ?? o.display_id,
    status: o.status,
    payment_status: paymentStatusFrom(o.payment_collections),
    fulfillment_status: fulfillmentStatusFrom(o.fulfillments),
    email: o.email,
    customer_name: o.customer
      ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || undefined
      : undefined,
    currency_code: o.currency_code,
    total: money.get(o.id)?.total ?? Number(o.total ?? 0),
    created_at: o.created_at,
    country_code: o.shipping_address?.country_code ?? null,
    item_count: (o.items || []).reduce((s: number, i: any) => {
      const q = money.get(o.id)?.quantities.get(i.id)
      return s + (q ?? Number(i.quantity ?? 0))
    }, 0),
  }))

  if (q) {
    const term = q.toLowerCase()
    orders = orders.filter(
      (o: any) =>
        String(o.display_id).includes(term) ||
        (o.email && o.email.toLowerCase().includes(term)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(term))
    )
  }

  res.json({ orders, count: orders.length })
}
