import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const DeliverySchema = z.object({
  fulfillment_id: z.string(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = DeliverySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Tenant ownership guard: order must belong to this tenant's sales channel.
  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: ["id", "status", "fulfillments.id", "fulfillments.canceled_at"],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  const fulfillment = (order.fulfillments || []).find(
    (f: any) => f.id === parsed.data.fulfillment_id
  )
  if (!fulfillment) {
    return res.status(404).json({ message: "fulfillment not found on this order" })
  }
  if (fulfillment.canceled_at) {
    return res.status(400).json({ message: "cannot deliver a canceled fulfillment" })
  }

  await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
    input: {
      orderId: id,
      fulfillmentId: parsed.data.fulfillment_id,
    },
  })

  res.json({ success: true })
}
