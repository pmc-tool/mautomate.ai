import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"
import { paymentStatusFrom, fulfillmentStatusFrom, orderMoneyFor } from "../_status"

/**
 * GET /merchant/orders/:id — full order detail, tenant-scoped.
 *
 * Field set mirrors Medusa admin's order-detail DEFAULT_FIELDS so the merchant
 * dashboard can render the same elaborate UX (item breakdown with SKU/options,
 * per-line tax/discount, shipping methods, promotions, payment + refund history,
 * fulfillment items/location, and the totals needed for outstanding balance).
 *
 * Isolation: the order is filtered by the tenant's sales_channel_id, resolved
 * from the AUTHENTICATED merchant — never a client parameter.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
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
      "display_id",
      "status",
      "payment_status",
      "fulfillment_status",
      "email",
      "currency_code",
      "metadata",
      "created_at",
      "updated_at",
      "canceled_at",
      // totals
      "total",
      "subtotal",
      "item_subtotal",
      "item_total",
      "item_tax_total",
      "shipping_total",
      "shipping_subtotal",
      "shipping_tax_total",
      "tax_total",
      "discount_total",
      "discount_subtotal",
      "original_total",
      // relations
      "customer_id",
      "customer.id",
      "customer.email",
      "customer.first_name",
      "customer.last_name",
      "customer.phone",
      "customer.company_name",
      "customer.has_account",
      "customer.created_at",
      "shipping_address.*",
      "billing_address.*",
      "sales_channel.id",
      "sales_channel.name",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.amount",
      "shipping_methods.total",
      "shipping_methods.subtotal",
      "shipping_methods.tax_total",
      "promotions.id",
      "promotions.code",
      "items.id",
      "items.title",
      "items.subtitle",
      "items.product_title",
      "items.variant_title",
      "items.variant_sku",
      "items.product_id",
      "items.variant_id",
      "items.quantity",
      "items.unit_price",
      "items.subtotal",
      "items.total",
      "items.tax_total",
      "items.discount_total",
      "items.original_total",
      "items.thumbnail",
      "items.metadata",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.authorized_amount",
      "payment_collections.captured_amount",
      "payment_collections.refunded_amount",
      "payment_collections.payments.id",
      "payment_collections.payments.amount",
      "payment_collections.payments.currency_code",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.created_at",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
      "payment_collections.payments.captures.id",
      "payment_collections.payments.captures.amount",
      "payment_collections.payments.refunds.id",
      "payment_collections.payments.refunds.amount",
      "payment_collections.payments.refunds.created_at",
      "payment_collections.payments.refunds.note",
      "payment_collections.payments.refunds.refund_reason.label",
      "fulfillments.id",
      "fulfillments.created_at",
      "fulfillments.packed_at",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.provider_id",
      "fulfillments.location_id",
      "fulfillments.shipping_option.name",
      "fulfillments.items.title",
      "fulfillments.items.quantity",
      "fulfillments.items.line_item_id",
      "fulfillments.labels.tracking_number",
      "fulfillments.labels.tracking_url",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order: any = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  const num = (v: any) => Number(v ?? 0)

  const payments = (order.payment_collections || [])
    .flatMap((pc: any) => pc.payments || [])
    .map((p: any) => {
      const capturesTotal = (p.captures || []).reduce(
        (s: number, c: any) => s + num(c.amount),
        0
      )
      const captured = capturesTotal || (p.captured_at ? num(p.amount) : 0)
      const refundsList = (p.refunds || []).map((r: any) => ({
        id: r.id,
        amount: num(r.amount),
        created_at: r.created_at,
        note: r.note ?? null,
        reason: r.refund_reason?.label ?? null,
      }))
      const refunded = refundsList.reduce((s: number, r: any) => s + r.amount, 0)
      return {
        id: p.id,
        amount: num(p.amount),
        currency_code: p.currency_code || order.currency_code,
        provider_id: p.provider_id ?? null,
        created_at: p.created_at,
        captured_at: p.captured_at ?? null,
        canceled_at: p.canceled_at ?? null,
        captured_amount: captured,
        refunded_amount: refunded,
        captures: (p.captures || []).map((c: any) => ({
          id: c.id,
          amount: num(c.amount),
        })),
        refunds: refundsList,
      }
    })

  const paidTotal = payments.reduce(
    (s: number, p: any) => s + p.captured_amount - p.refunded_amount,
    0
  )
  const refundedTotal = payments.reduce(
    (s: number, p: any) => s + p.refunded_amount,
    0
  )
  const outstanding = num(order.total) - paidTotal

  const fulfillments = (order.fulfillments || []).map((f: any) => ({
    id: f.id,
    created_at: f.created_at,
    packed_at: f.packed_at ?? null,
    shipped_at: f.shipped_at ?? null,
    delivered_at: f.delivered_at ?? null,
    canceled_at: f.canceled_at ?? null,
    provider_id: f.provider_id ?? null,
    location_id: f.location_id ?? null,
    shipping_option_name: f.shipping_option?.name ?? null,
    items: (f.items || []).map((it: any) => ({
      title: it.title,
      quantity: it.quantity,
      line_item_id: it.line_item_id,
    })),
    labels: (f.labels || []).map((l: any) => ({
      tracking_number: l.tracking_number,
      tracking_url: l.tracking_url,
    })),
  }))

  // Lifetime order count for this customer within the tenant's sales channel —
  // shown in the Customer section like Medusa does.
  let customer_order_count = 0
  if (order.customer_id) {
    try {
      const { data: co } = await query.graph({
        entity: "order",
        filters: { customer_id: order.customer_id, sales_channel_id: scId } as any,
        fields: ["id"],
        pagination: { take: 500, skip: 0 } as any,
      })
      customer_order_count = (co || []).length
    } catch {
      customer_order_count = 0
    }
  }

  // Per-item fulfilled/shipped/delivered quantities derived from fulfillments,
  // NOT items.detail (which triggers "Item version is required to load
  // adjustments" -> 500 on orders that have line-item discounts).
  const fulByItem: Record<string, { fulfilled: number; shipped: number; delivered: number }> = {}
  for (const f of order.fulfillments || []) {
    if (f.canceled_at) continue
    for (const fi of f.items || []) {
      const id = fi.line_item_id
      if (!id) continue
      if (!fulByItem[id]) fulByItem[id] = { fulfilled: 0, shipped: 0, delivered: 0 }
      const q = Number(fi.quantity ?? 0)
      fulByItem[id].fulfilled += q
      if (f.shipped_at) fulByItem[id].shipped += q
      if (f.delivered_at) fulByItem[id].delivered += q
    }
  }

  // The graph computes item_total off quantities it reads as 0, so `total` comes
  // back as shipping alone (a 4 x $1,000 order reported as $500) and every line
  // renders "0 x". Read the real quantities and total from the order's latest
  // version, and rebuild the item money from them.
  const money = await orderMoneyFor(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    [order.id]
  )
  const facts = money.get(order.id) ?? null
  const qtyOf = (i: any): number =>
    facts?.quantities.get(i.id) ?? Number(i.quantity ?? 0)
  const lineTotalOf = (i: any): number => {
    const q = qtyOf(i)
    const graphTotal = num(i.total)
    // Trust the graph's line total only when it is consistent with a real
    // quantity; otherwise recompute it from unit price x quantity.
    return graphTotal > 0 ? graphTotal : q * num(i.unit_price)
  }
  const itemsTotal = (order.items || []).reduce(
    (s: number, i: any) => s + lineTotalOf(i),
    0
  )
  const orderTotal =
    facts?.total ?? (num(order.total) || itemsTotal + num(order.shipping_total))

  res.json({
    order: {
      id: order.id,
      display_id: order.metadata?.store_order_no ?? order.display_id,
      status: order.status,
      payment_status: paymentStatusFrom(order.payment_collections || []),
      fulfillment_status: fulfillmentStatusFrom(order.fulfillments || []),
      email: order.email,
      currency_code: order.currency_code,
      metadata: order.metadata ?? null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      canceled_at: order.canceled_at ?? null,
      // totals
      total: orderTotal,
      subtotal: num(order.subtotal) || itemsTotal,
      item_subtotal: num(order.item_subtotal) || itemsTotal,
      item_total: num(order.item_total) || itemsTotal,
      item_tax_total: num(order.item_tax_total),
      shipping_total: num(order.shipping_total),
      shipping_subtotal: num(order.shipping_subtotal),
      shipping_tax_total: num(order.shipping_tax_total),
      tax_total: num(order.tax_total),
      discount_total: num(order.discount_total),
      discount_subtotal: num(order.discount_subtotal),
      original_total: num(order.original_total),
      paid_total: paidTotal,
      refunded_total: refundedTotal,
      outstanding,
      sales_channel: order.sales_channel
        ? { id: order.sales_channel.id, name: order.sales_channel.name }
        : null,
      customer: order.customer
        ? {
            id: order.customer.id,
            email: order.customer.email,
            first_name: order.customer.first_name,
            last_name: order.customer.last_name,
            phone: order.customer.phone,
            company_name: order.customer.company_name ?? null,
            has_account: !!order.customer.has_account,
            created_at: order.customer.created_at,
            order_count: customer_order_count,
          }
        : null,
      shipping_address: order.shipping_address || null,
      billing_address: order.billing_address || null,
      shipping_methods: (order.shipping_methods || []).map((sm: any) => ({
        id: sm.id,
        name: sm.name,
        amount: num(sm.amount),
        total: num(sm.total),
        subtotal: num(sm.subtotal),
        tax_total: num(sm.tax_total),
      })),
      promotions: (order.promotions || []).map((p: any) => ({
        id: p.id,
        code: p.code,
      })),
      items: (order.items || []).map((i: any) => ({
        id: i.id,
        title: i.title ?? i.product_title ?? "Product",
        subtitle: i.subtitle ?? null,
        product_title: i.product_title ?? null,
        variant_title: i.variant_title ?? null,
        sku: i.variant_sku ?? null,
        product_id: i.product_id ?? null,
        quantity: qtyOf(i),
        unit_price: num(i.unit_price),
        subtotal: num(i.subtotal) || lineTotalOf(i),
        total: lineTotalOf(i),
        tax_total: num(i.tax_total),
        discount_total: num(i.discount_total),
        original_total: num(i.original_total),
        thumbnail: i.thumbnail ?? null,
        metadata: i.metadata ?? null,
        detail: {
          quantity: i.quantity,
          fulfilled_quantity: fulByItem[i.id]?.fulfilled ?? 0,
          shipped_quantity: fulByItem[i.id]?.shipped ?? 0,
          delivered_quantity: fulByItem[i.id]?.delivered ?? 0,
          return_requested_quantity: 0,
          return_received_quantity: 0,
        },
      })),
      payments,
      fulfillments,
    },
  })
}
