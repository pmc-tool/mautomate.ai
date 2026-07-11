import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createLocationFulfillmentSetWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { getQuery, locationTenantId, ensureProviderLinked } from "../../../_shipping"

const Schema = z.object({ type: z.enum(["shipping", "pickup"]) })

/**
 * POST /merchant/stock-locations/:id/fulfillment-sets
 * Enable a Shipping or Pickup fulfillment set on the location. Also links the
 * manual fulfillment provider so shipping options can be created immediately.
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
  const { type } = parsed.data

  try {
    await ensureProviderLinked(req, query, id)
    await createLocationFulfillmentSetWorkflow(req.scope).run({
      input: {
        location_id: id,
        fulfillment_set_data: {
          name: `${ctx.tenant.name || "Store"} ${type}`,
          type,
        },
      },
    })
    res.status(201).json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to enable fulfillment set" })
  }
}
