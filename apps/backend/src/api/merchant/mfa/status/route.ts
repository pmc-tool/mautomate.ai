import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"

/**
 * GET /merchant/mfa/status
 *
 * Returns the merchant's MFA enrollment state so the settings UI can decide
 * whether to show "Set up", "Confirm setup", or "Disable" flows.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "Unauthorized" })

  res.json({
    mfa_enabled: ctx.merchant.mfa_enabled === true,
    setup_pending: !!ctx.merchant.mfa_secret_encrypted && !ctx.merchant.mfa_enabled,
  })
}
