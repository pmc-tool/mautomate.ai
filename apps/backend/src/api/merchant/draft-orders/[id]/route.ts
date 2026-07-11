import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveMerchant } from "../../_helpers"

async function draftOrderInSalesChannel(
  req: MedusaRequest,
  orderId: string,
  scId: string
): Promise<any | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId, sales_channel_id: scId, is_draft_order: true } as any,
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
  })
  return (data || [])[0] || null
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "draft order not found" })

  const { id } = req.params
  const order = await draftOrderInSalesChannel(req, id, scId)
  if (!order) return res.status(404).json({ message: "draft order not found" })

  res.json({
    draft_order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      email: order.email,
      customer_name: order.customer
        ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ") || undefined
        : undefined,
      currency_code: order.currency_code,
      total: Number(order.total ?? 0),
      created_at: order.created_at,
    },
  })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "draft order not found" })

  const { id } = req.params
  const order = await draftOrderInSalesChannel(req, id, scId)
  if (!order) return res.status(404).json({ message: "draft order not found" })

  const orderModule: any = req.scope.resolve(Modules.ORDER)
  await orderModule.softDeleteOrders([id])
  res.status(204).send()
}
