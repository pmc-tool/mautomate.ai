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
  if (!scId) return res.json({ exchanges: [], count: 0 })

  const orderIds = await getTenantOrderIds(req, scId)
  if (!orderIds.length) return res.json({ exchanges: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order_exchange",
    filters: { order_id: orderIds } as any,
    fields: [
      "id",
      "display_id",
      "status",
      "difference_due",
      "created_at",
      "order.id",
      "order.display_id",
    ],
    pagination: { take: 200, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const exchanges = (data || []).map((e: any) => ({
    id: e.id,
    display_id: e.display_id,
    status: e.status,
    difference_due: e.difference_due ? Number(e.difference_due) : undefined,
    created_at: e.created_at,
    order_id: e.order?.id,
    order_display_id: e.order?.display_id,
  }))

  res.json({ exchanges, count: exchanges.length })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const body = req.body as {
    order_id?: string
    items?: { id?: string; quantity?: number }[]
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
  const created = await orderModule.createOrderExchanges({
    order_id: body.order_id,
    items,
  })

  const exchange = Array.isArray(created) ? created[0] : created

  res.status(201).json({
    exchange: {
      id: exchange.id,
      display_id: exchange.display_id,
      status: exchange.status,
      difference_due: exchange.difference_due ? Number(exchange.difference_due) : undefined,
      created_at: exchange.created_at,
      order_id: body.order_id,
    },
  })
}
