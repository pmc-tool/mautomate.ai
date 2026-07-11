import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  orderEditUpdateItemQuantityWorkflow,
  orderEditAddNewItemWorkflow,
  requestOrderEditRequestWorkflow,
  confirmOrderEditRequestWorkflow,
  cancelBeginOrderEditWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"

const Schema = z.object({
  updates: z
    .array(z.object({ id: z.string(), quantity: z.number().int().min(0) }))
    .optional()
    .default([]),
  adds: z
    .array(z.object({ variant_id: z.string(), quantity: z.number().int().min(1) }))
    .optional()
    .default([]),
})

/**
 * POST /merchant/orders/:id/edit
 * One-shot order edit: change existing line quantities (0 removes) and/or add
 * new items, committed atomically (begin -> apply -> request -> confirm). If any
 * step fails the in-progress edit is canceled so no dangling change is left.
 * Tenant-scoped via the order's sales channel; added variants must belong to
 * this tenant's sales channel.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const scId = ctx.tenant.meta?.sales_channel_id
  if (!scId) return res.status(404).json({ message: "order not found" })

  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Ownership: order must be in this tenant's sales channel, and be editable.
  const { data: ord } = await query.graph({
    entity: "order",
    filters: { id, sales_channel_id: scId } as any,
    fields: ["id", "status", "items.id"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const order = (ord || [])[0]
  if (!order) return res.status(404).json({ message: "order not found" })
  if (order.status === "canceled") {
    return res.status(400).json({ message: "cannot edit a canceled order" })
  }

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }
  const { updates, adds } = parsed.data
  if (updates.length === 0 && adds.length === 0) {
    return res.status(400).json({ message: "nothing to change" })
  }

  // Updates must reference items on this order.
  const orderItemIds = new Set((order.items || []).map((i: any) => i.id))
  for (const u of updates) {
    if (!orderItemIds.has(u.id)) {
      return res.status(400).json({ message: "unknown order item" })
    }
  }

  // Added variants must belong to this tenant's sales channel.
  if (adds.length) {
    const { data: variants } = await query.graph({
      entity: "product_variant",
      filters: { id: adds.map((a) => a.variant_id) } as any,
      fields: ["id", "product.sales_channels.id"],
      pagination: { take: adds.length, skip: 0 } as any,
    })
    const okVariants = new Set(
      (variants || [])
        .filter((v: any) => (v.product?.sales_channels || []).some((sc: any) => sc.id === scId))
        .map((v: any) => v.id)
    )
    for (const a of adds) {
      if (!okVariants.has(a.variant_id)) {
        return res.status(400).json({ message: "a product is not part of your store" })
      }
    }
  }

  try {
    await beginOrderEditOrderWorkflow(req.scope).run({ input: { order_id: id } })

    if (updates.length) {
      await orderEditUpdateItemQuantityWorkflow(req.scope).run({
        input: { order_id: id, items: updates.map((u) => ({ id: u.id, quantity: u.quantity })) },
      })
    }
    if (adds.length) {
      await orderEditAddNewItemWorkflow(req.scope).run({
        input: { order_id: id, items: adds.map((a) => ({ variant_id: a.variant_id, quantity: a.quantity })) },
      })
    }

    await requestOrderEditRequestWorkflow(req.scope).run({
      input: { order_id: id, requested_by: ctx.merchant?.id },
    })
    await confirmOrderEditRequestWorkflow(req.scope).run({
      input: { order_id: id, confirmed_by: ctx.merchant?.id },
    })

    res.json({ success: true })
  } catch (err: any) {
    try {
      await cancelBeginOrderEditWorkflow(req.scope).run({ input: { order_id: id } })
    } catch {
      /* nothing to cancel */
    }
    res.status(400).json({ message: err?.message || "failed to edit order" })
  }
}
