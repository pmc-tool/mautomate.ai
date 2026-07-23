import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { computeSetupStatus } from "../../_setup"

/**
 * GET /merchant/setup/status
 *
 * The full, structured setup-completeness picture for the shop setup wizard and
 * the persistent progress widget: every task with its label, why-it-matters, the
 * exact blocker when unfinished, a CTA, plus overall percent and `ready_to_sell`.
 *
 * Backed by the same verified checks as GET /merchant/onboarding (one source of
 * truth), so the two surfaces can never show different numbers.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const status = await computeSetupStatus(req, ctx)
  res.json(status)
}
