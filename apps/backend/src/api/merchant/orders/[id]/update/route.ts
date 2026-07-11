import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateOrderWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const AddressSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  address_1: z.string().optional(),
  address_2: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
})

const Schema = z.object({
  email: z.string().email().optional(),
  shipping_address: AddressSchema.optional(),
  billing_address: AddressSchema.optional(),
})

/**
 * POST /merchant/orders/:id/update
 * Update an order's email and/or shipping/billing address. Tenant-scoped via the
 * order's sales channel. Country code cannot be changed (Medusa restriction), so
 * it is intentionally not accepted here.
 */
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
  if (!(data || [])[0]) return res.status(404).json({ message: "order not found" })

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  if (!parsed.data.email && !parsed.data.shipping_address && !parsed.data.billing_address) {
    return res.status(400).json({ message: "nothing to update" })
  }

  const input: any = { id, user_id: ctx.merchant?.id || "merchant" }
  if (parsed.data.email) input.email = parsed.data.email
  if (parsed.data.shipping_address) input.shipping_address = parsed.data.shipping_address
  if (parsed.data.billing_address) input.billing_address = parsed.data.billing_address

  try {
    await updateOrderWorkflow(req.scope).run({ input })
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to update order" })
  }
}
