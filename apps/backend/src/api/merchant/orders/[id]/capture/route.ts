import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const CaptureSchema = z.object({
  amount: z.number().int().min(1).optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = CaptureSchema.safeParse(req.body)
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
      "payment_collections.payments.id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
      "payment_collections.payments.captures.amount",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  if (order.status === "canceled") {
    return res.status(400).json({ message: "cannot capture a canceled order" })
  }

  // Find an authorized (not fully captured, not canceled) payment on the order.
  const payments = (order.payment_collections || []).flatMap(
    (pc: any) => pc.payments || []
  )
  const payment = payments.find((p: any) => {
    if (p.canceled_at) return false
    const capturedTotal = (p.captures || []).reduce(
      (sum: number, c: any) => sum + Number(c.amount ?? 0),
      0
    )
    return capturedTotal < Number(p.amount ?? 0)
  })

  if (!payment) {
    return res.status(400).json({ message: "no authorized payment to capture" })
  }

  const { result: captured } = await capturePaymentWorkflow(req.scope).run({
    input: {
      payment_id: payment.id,
      amount: parsed.data.amount,
    },
  })

  res.status(200).json({ payment: captured })
}
