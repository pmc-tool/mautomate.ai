import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrderShipmentWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const ShipmentSchema = z.object({
  fulfillment_id: z.string(),
  tracking_numbers: z.array(z.string()).optional(),
  labels: z
    .array(
      z.object({
        tracking_number: z.string(),
        tracking_url: z.string().optional(),
        label_url: z.string().optional(),
      })
    )
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().int().min(1),
      })
    )
    .optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = ShipmentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Tenant ownership guard: order must belong to this tenant's sales channel.
  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: [
      "id",
      "status",
      "fulfillments.id",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.items.line_item_id",
      "fulfillments.items.quantity",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  if (order.status === "canceled") {
    return res.status(400).json({ message: "cannot ship a canceled order" })
  }

  const fulfillment = (order.fulfillments || []).find(
    (f: any) => f.id === parsed.data.fulfillment_id
  )
  if (!fulfillment) {
    return res.status(404).json({ message: "fulfillment not found on this order" })
  }
  if (fulfillment.canceled_at) {
    return res.status(400).json({ message: "cannot ship a canceled fulfillment" })
  }

  const items =
    parsed.data.items && parsed.data.items.length
      ? parsed.data.items
      : (fulfillment.items || []).map((fi: any) => ({
          id: fi.line_item_id,
          quantity: Number(fi.quantity ?? 0),
        }))

  const labels =
    parsed.data.labels && parsed.data.labels.length
      ? parsed.data.labels.map((l: any) => ({
          tracking_number: l.tracking_number,
          tracking_url: l.tracking_url ?? "",
          label_url: l.label_url ?? "",
        }))
      : parsed.data.tracking_numbers && parsed.data.tracking_numbers.length
        ? parsed.data.tracking_numbers.map((tn: string) => ({
            tracking_number: tn,
            tracking_url: "",
            label_url: "",
          }))
        : undefined

  const { result: shipment } = await createOrderShipmentWorkflow(req.scope).run({
    input: {
      order_id: id,
      fulfillment_id: parsed.data.fulfillment_id,
      items,
      labels,
    },
  })

  res.status(201).json({ shipment })
}
