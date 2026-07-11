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
  if (!scId) return res.json({ claims: [], count: 0 })

  const orderIds = await getTenantOrderIds(req, scId)
  if (!orderIds.length) return res.json({ claims: [], count: 0 })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order_claim",
    filters: { order_id: orderIds } as any,
    fields: [
      "id",
      "display_id",
      "status",
      "type",
      "refund_amount",
      "created_at",
      "order.id",
      "order.display_id",
    ],
    pagination: { take: 200, skip: 0, order: { created_at: "DESC" } } as any,
  })

  const claims = (data || []).map((c: any) => ({
    id: c.id,
    display_id: c.display_id,
    status: c.status,
    type: c.type,
    refund_amount: c.refund_amount ? Number(c.refund_amount) : undefined,
    created_at: c.created_at,
    order_id: c.order?.id,
    order_display_id: c.order?.display_id,
  }))

  res.json({ claims, count: claims.length })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(400).json({ message: "tenant sales channel not configured" })

  const body = req.body as {
    order_id?: string
    type?: "refund" | "replace"
    items?: { id?: string; quantity?: number }[]
  }

  if (!body.order_id) return res.status(400).json({ message: "order_id is required" })
  if (!body.type || !["refund", "replace"].includes(body.type)) {
    return res.status(400).json({ message: "type must be refund or replace" })
  }

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
  const created = await orderModule.createOrderClaims({
    order_id: body.order_id,
    type: body.type,
    claim_items: items,
  })

  const claim = Array.isArray(created) ? created[0] : created

  res.status(201).json({
    claim: {
      id: claim.id,
      display_id: claim.display_id,
      status: claim.status,
      type: claim.type,
      refund_amount: claim.refund_amount ? Number(claim.refund_amount) : undefined,
      created_at: claim.created_at,
      order_id: body.order_id,
    },
  })
}
