import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { refundPaymentWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const RefundSchema = z.object({
  amount: z.number().int().min(1).optional(),
  note: z.string().optional(),
  reason_id: z.string().optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const parsed = RefundSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: [
      "id",
      "payment_collections.payments.id",
      "payment_collections.payments.amount",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.captures.id",
      "payment_collections.payments.captures.amount",
    ],
    pagination: { take: 1, skip: 0 } as any,
  })

  const order = (data || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })

  const payments = (order.payment_collections || [])
    .flatMap((pc: any) => pc.payments || [])
    .filter((p: any) => p.captured_at && (p.captures || []).length > 0)

  if (!payments.length) {
    return res.status(400).json({ message: "no captured payment to refund" })
  }

  const payment = payments[0]
  const capturedTotal = (payment.captures || []).reduce(
    (sum: number, c: any) => sum + Number(c.amount ?? 0),
    0
  )

  if (parsed.data.amount && parsed.data.amount > capturedTotal) {
    return res.status(400).json({ message: "refund amount exceeds captured total" })
  }

  const { result: refund } = await refundPaymentWorkflow(req.scope).run({
    input: {
      payment_id: payment.id,
      amount: parsed.data.amount,
      note: parsed.data.note,
      refund_reason_id: parsed.data.reason_id,
    },
  })

  res.status(201).json({ refund })
}
