import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { merchantMfaService } from "../../../../modules/platform/mfa/service"

/**
 * POST /merchant/mfa/disable  { code }
 *
 * Disable MFA for the authenticated merchant. Requires a current TOTP code or
 * a recovery code.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "Unauthorized" })

  const code = String((req.body as any)?.code ?? "").trim().toUpperCase()
  if (!code) return res.status(400).json({ message: "code required" })

  if (!ctx.merchant.mfa_enabled) {
    return res.status(400).json({ message: "MFA is not enabled" })
  }

  if (!merchantMfaService.verify(ctx.merchant.mfa_secret_encrypted, ctx.merchant.mfa_backup_codes_hash, code)) {
    return res.status(400).json({ message: "Invalid code" })
  }

  await ctx.svc.updateMerchants({
    id: ctx.merchant.id,
    mfa_enabled: false,
    mfa_secret_encrypted: null,
    mfa_backup_codes_hash: null,
  })

  res.status(200).json({ message: "MFA disabled" })
}
