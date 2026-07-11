import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"

const PLATFORM_MANAGED_MESSAGE =
  "Tax regions are managed by the platform operator and cannot be changed from the merchant dashboard."

/**
 * PUT /merchant/tax-regions/:id
 *
 * Disabled. Tax regions are platform-scoped (shared across all pooled tenants
 * on this instance), so a merchant must not be able to mutate a shared row.
 * Updates are reserved for the platform operator (super-admin console — future
 * phase).
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  return res.status(403).json({ message: PLATFORM_MANAGED_MESSAGE })
}

/**
 * DELETE /merchant/tax-regions/:id
 *
 * Disabled. A tax region is a shared, platform-scoped row; letting one pooled
 * merchant delete it would break tax/compliance for every other tenant that
 * relies on that jurisdiction. Deletion is reserved for the platform operator.
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  return res.status(403).json({ message: PLATFORM_MANAGED_MESSAGE })
}
