import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ draft_orders: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    filters: { sales_channel_id: scId, is_draft_order: true } as any,
    fields: [
      "id",
      "display_id",
      "status",
      "email",
      "currency_code",
      "total",
      "created_at",
      "customer_id",
      "customer.first_name",
      "customer.last_name",
    ],
    pagination: { take: 200, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const draftOrders = (data || []).map((o: any) => ({
    id: o.id,
    display_id: o.display_id,
    status: o.status,
    email: o.email,
    customer_name: o.customer
      ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || undefined
      : undefined,
    currency_code: o.currency_code,
    total: Number(o.total ?? 0),
    created_at: o.created_at,
  }))

  res.json({ draft_orders: draftOrders, count: draftOrders.length })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  const regionId = ctx.tenant.meta?.region_id
  const currencyCode = ctx.tenant.meta?.currency_code || "usd"
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const body = req.body as {
    email?: string
    customer_id?: string
    items?: { title?: string; quantity?: number; unit_price?: number }[]
  }

  const items = (body.items || [])
    .filter((i) => i.title && (i.quantity ?? 0) > 0)
    .map((i) => ({
      title: i.title!,
      quantity: i.quantity!,
      unit_price: i.unit_price ?? 0,
      product_title: i.title!,
    }))

  if (!items.length) {
    return res.status(400).json({ message: "at least one item is required" })
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const order = await orderModule.createOrders({
    sales_channel_id: scId,
    region_id: regionId,
    email: body.email,
    customer_id: body.customer_id,
    currency_code: currencyCode,
    status: "pending",
    is_draft_order: true,
    items,
  } as any)

  res.status(201).json({
    draft_order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      email: order.email,
      customer_name: undefined,
      currency_code: order.currency_code,
      total: Number(order.total ?? subtotal),
      created_at: order.created_at,
    },
  })
}
