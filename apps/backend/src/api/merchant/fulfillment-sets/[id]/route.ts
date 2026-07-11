import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteFulfillmentSetsWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../_helpers"
import { getQuery, setOwner } from "../../_shipping"

/**
 * DELETE /merchant/fulfillment-sets/:id
 * Disable (delete) a fulfillment set. Tenant-scoped: the set must belong to a
 * location owned by this tenant.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = getQuery(req)
  const { tenantId } = await setOwner(query, id)
  if (tenantId !== ctx.tenant.id) {
    return res.status(404).json({ message: "fulfillment set not found" })
  }

  try {
    await deleteFulfillmentSetsWorkflow(req.scope).run({ input: { ids: [id] } })
    res.json({ id, object: "fulfillment_set", deleted: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to delete fulfillment set" })
  }
}
