import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { receiveAndCompleteReturnOrderWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../../_helpers"

const ReceiveSchema = z.object({
  return_id: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      quantity: z.number().int().min(1),
    })
  ),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = ReceiveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Tenant ownership guard: the order must belong to this tenant's sales channel,
  // AND the return must belong to that order.
  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: ["id", "returns.id", "returns.canceled_at", "returns.received_at"],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  const orderReturn = (order.returns || []).find(
    (r: any) => r.id === parsed.data.return_id
  )
  if (!orderReturn) {
    return res.status(404).json({ message: "return not found on this order" })
  }
  if (orderReturn.canceled_at) {
    return res.status(400).json({ message: "cannot receive a canceled return" })
  }
  if (orderReturn.received_at) {
    return res.status(400).json({ message: "return already received" })
  }

  const { result: received } = await receiveAndCompleteReturnOrderWorkflow(req.scope).run({
    input: {
      return_id: parsed.data.return_id,
      items: parsed.data.items,
    },
  })

  res.status(200).json({ return: received })
}
