import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteShippingProfileWorkflow } from "@medusajs/core-flows"
import { resolveMerchant } from "../../_helpers"

/**
 * DELETE /merchant/shipping-profiles/:id
 * Only a profile this tenant created (metadata.tenant_id) can be deleted — never
 * the shared default.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_profile",
    filters: { id },
    fields: ["id", "type", "metadata"],
    pagination: { take: 1, skip: 0 } as any,
  })
  const profile = (data || [])[0]
  if (!profile || profile.metadata?.tenant_id !== ctx.tenant.id) {
    return res.status(404).json({ message: "shipping profile not found" })
  }
  if (profile.type === "default") {
    return res.status(400).json({ message: "the default profile cannot be deleted" })
  }

  try {
    await deleteShippingProfileWorkflow(req.scope).run({ input: { ids: [id] } })
    res.json({ id, object: "shipping_profile", deleted: true })
  } catch (err: any) {
    res.status(400).json({ message: err?.message || "failed to delete shipping profile" })
  }
}
