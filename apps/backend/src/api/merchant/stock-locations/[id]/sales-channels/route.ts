import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { linkSalesChannelsToStockLocationWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { getQuery, locationTenantId } from "../../../_shipping"

const Schema = z.object({
  add: z.array(z.string()).optional().default([]),
  remove: z.array(z.string()).optional().default([]),
})

/**
 * POST /merchant/stock-locations/:id/sales-channels
 * Connect / disconnect the tenant's sales channel to a location. The `add` list
 * is restricted to the tenant's OWN sales channel so a merchant can never link
 * another tenant's channel.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const tenantId = await locationTenantId(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "stock location not found" })
  }

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const ownChannel = ctx.tenant.meta?.sales_channel_id
  const add = parsed.data.add.filter((sc) => sc === ownChannel)
  const remove = parsed.data.remove

  try {
    await linkSalesChannelsToStockLocationWorkflow(req.scope).run({
      input: { id, add, remove },
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to update sales channels" })
  }
}
