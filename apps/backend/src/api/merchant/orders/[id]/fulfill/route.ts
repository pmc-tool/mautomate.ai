import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderFulfillmentWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const FulfillSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
  tracking_number: z.string().optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = FulfillSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: ["id", "status", "items.id", "items.quantity"],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  if (order.status === "canceled") {
    return res.status(400).json({ message: "cannot fulfill a canceled order" })
  }

  const items =
    parsed.data.items && parsed.data.items.length
      ? parsed.data.items
      : (order.items || []).map((i: any) => ({ id: i.id, quantity: i.quantity }))

  const labels = parsed.data.tracking_number
    ? [{ tracking_number: parsed.data.tracking_number, tracking_url: "", label_url: "" }]
    : undefined

  const { result: fulfillment } = await createOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: id,
      items,
      labels,
      metadata: parsed.data.tracking_number
        ? { tracking_number: parsed.data.tracking_number }
        : undefined,
    },
  })

  res.status(201).json({ fulfillment })
}
