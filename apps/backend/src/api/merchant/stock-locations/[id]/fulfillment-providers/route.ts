import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { batchLinksWorkflow } from "@medusajs/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { getQuery, locationTenantId, MANUAL_PROVIDER } from "../../../_shipping"

const Schema = z.object({
  add: z.array(z.string()).optional().default([]),
  remove: z.array(z.string()).optional().default([]),
})

const ALLOWED = new Set([MANUAL_PROVIDER])

/**
 * POST /merchant/stock-locations/:id/fulfillment-providers
 * Enable / disable fulfillment providers on a location. Restricted to the known
 * provider set.
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

  const buildLinks = (ids: string[]) =>
    ids
      .filter((p) => ALLOWED.has(p))
      .map((fulfillment_provider_id) => ({
        [Modules.STOCK_LOCATION]: { stock_location_id: id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id },
      }))

  try {
    await batchLinksWorkflow(req.scope).run({
      input: {
        create: buildLinks(parsed.data.add),
        delete: buildLinks(parsed.data.remove),
      },
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to update fulfillment providers" })
  }
}
