import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../../_helpers"

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
    fields: ["id"],
    pagination: { take: 1, skip: 0 } as any,
  })

  if (!(data || []).length) return res.status(404).json({ message: "order not found" })

  await cancelOrderWorkflow(req.scope).run({
    input: { order_id: id },
  })

  res.json({ success: true })
}
