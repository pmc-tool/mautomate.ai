import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  updateServiceZonesWorkflow,
  deleteServiceZonesWorkflow,
} from "@medusajs/core-flows"
import { z } from "zod"
import { resolveMerchant } from "../../_helpers"
import { getQuery, zoneOwner } from "../../_shipping"

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  country_codes: z.array(z.string().min(2).max(2)).optional(),
})

/**
 * POST /merchant/service-zones/:id
 * Rename a service zone and/or replace its countries (geo zones).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const { tenantId } = await zoneOwner(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "service zone not found" })
  }

  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "invalid input", issues: parsed.error.issues })
  }

  const update: any = {}
  if (parsed.data.name !== undefined) update.name = parsed.data.name
  if (parsed.data.country_codes !== undefined) {
    update.geo_zones = parsed.data.country_codes.map((c) => ({
      type: "country" as const,
      country_code: c.toLowerCase(),
    }))
  }

  try {
    await updateServiceZonesWorkflow(req.scope).run({
      input: { selector: { id }, update },
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to update service zone" })
  }
}

/**
 * DELETE /merchant/service-zones/:id
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const { tenantId } = await zoneOwner(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "service zone not found" })
  }

  try {
    await deleteServiceZonesWorkflow(req.scope).run({ input: { ids: [id] } })
    res.json({ id, object: "service_zone", deleted: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to delete service zone" })
  }
}
