import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createServiceZonesWorkflow } from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../../_helpers"
import { getQuery, setOwner } from "../../../_shipping"

const Schema = z.object({
  name: z.string().min(1).max(200),
  country_codes: z.array(z.string().min(2).max(2)).default([]),
})

/**
 * POST /merchant/fulfillment-sets/:id/service-zones
 * Create a service zone under a fulfillment set. country_codes become geo zones
 * of type "country". Tenant-scoped via the set's owning location.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const { tenantId } = await setOwner(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "fulfillment set not found" })
  }

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const geo_zones = parsed.data.country_codes.map((c) => ({
    type: "country" as const,
    country_code: c.toLowerCase(),
  }))

  try {
    await createServiceZonesWorkflow(req.scope).run({
      input: {
        data: [{ fulfillment_set_id: id, name: parsed.data.name, geo_zones }],
      },
    })
    res.status(201).json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to create service zone" })
  }
}
