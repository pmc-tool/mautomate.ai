import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../_helpers"

async function getTenantOrderIds(req: MedusaRequest, scId: string): Promise<string[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    filters: { sales_channel_id: scId } as any,
    fields: ["id"],
    pagination: { take: 1000, skip: 0 } as any,
  })
  return (data || []).map((o: any) => o.id)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.json({ returns: [], count: 0 })

  const orderIds = await getTenantOrderIds(req, scId)
  if (!orderIds.length) return res.json({ returns: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "return",
    filters: { order_id: orderIds } as any,
    fields: [
      "id",
      "display_id",
      "status",
      "refund_amount",
      "created_at",
      "order.id",
      "order.display_id",
      "items.id",
      "items.quantity",
      "items.reason_id",
    ],
    pagination: { take: 200, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const returns = (data || []).map((r: any) => ({
    id: r.id,
    display_id: r.display_id,
    status: r.status,
    refund_amount: r.refund_amount ? Number(r.refund_amount) : undefined,
    created_at: r.created_at,
    order_id: r.order?.id,
    order_display_id: r.order?.display_id,
    item_count: (r.items || []).reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0),
  }))

  res.json({ returns, count: returns.length })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const body = req.body as {
    order_id?: string
    items?: { id?: string; quantity?: number }[]
    refund_amount?: number
  }

  if (!body.order_id) return res.status(400).json({ message: "order_id is required" })

  const orderIds = await getTenantOrderIds(req, scId)
  if (!orderIds.includes(body.order_id)) {
    return res.status(404).json({ message: "order not found" })
  }

  const items = (body.items || [])
    .filter((i) => i.id && (i.quantity ?? 0) > 0)
    .map((i) => ({ id: i.id!, quantity: i.quantity! }))

  if (!items.length) {
    return res.status(400).json({ message: "at least one item is required" })
  }

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const created = await orderModule.createReturns({
    order_id: body.order_id,
    items,
    refund_amount: body.refund_amount,
  })

  const ret = Array.isArray(created) ? created[0] : created

  res.status(201).json({
    return: {
      id: ret.id,
      display_id: ret.display_id,
      status: ret.status,
      refund_amount: ret.refund_amount ? Number(ret.refund_amount) : undefined,
      created_at: ret.created_at,
      order_id: body.order_id,
      item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    },
  })
}
