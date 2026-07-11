import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  updateShippingOptionsWorkflow,
  deleteShippingOptionsWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { getQuery, optionOwner, tenantCurrency } from "../../_shipping"

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price_type: z.enum(["flat", "calculated"]).optional(),
  enabled_in_store: z.boolean().optional(),
  amount: z.number().nonnegative().optional(),
})

/**
 * POST /merchant/shipping-options/:id
 * Update a shipping option's name, price type, flat price and store visibility.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const { tenantId } = await optionOwner(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "shipping option not found" })
  }

  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const body = parsed.data

  const update: any = { id }
  if (body.name !== undefined) update.name = body.name
  if (body.price_type !== undefined) update.price_type = body.price_type

  // Flat price update: setShippingOptionsPricesStep replaces the price set.
  if (body.amount !== undefined && body.price_type !== "calculated") {
    const currency = await tenantCurrency(query, ctx.tenant)
    update.prices = [{ currency_code: currency, amount: Math.round(body.amount) }]
  }

  // enabled_in_store is a rule — update the existing rule row if present.
  if (body.enabled_in_store !== undefined) {
    const { data } = await query.graph({
      entity: "shipping_option",
      filters: { id },
      fields: ["id", "rules.id", "rules.attribute"],
      pagination: { take: 1, skip: 0 },
    })
    const rule = (data?.[0]?.rules || []).find((r: any) => r.attribute === "enabled_in_store")
    const value = body.enabled_in_store ? "true" : "false"
    update.rules = rule
      ? [{ id: rule.id, attribute: "enabled_in_store", operator: "eq", value }]
      : [{ attribute: "enabled_in_store", operator: "eq", value }]
  }

  try {
    await updateShippingOptionsWorkflow(req.scope).run({ input: [update] })
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to update shipping option" })
  }
}

/**
 * DELETE /merchant/shipping-options/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const { tenantId } = await optionOwner(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "shipping option not found" })
  }

  try {
    await deleteShippingOptionsWorkflow(req.scope).run({ input: { ids: [id] } })
    res.json({ id, object: "shipping_option", deleted: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to delete shipping option" })
  }
}
