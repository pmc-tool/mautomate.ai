import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { merchantMfaService } from "../../../../modules/platform/mfa/service"

/**
 * POST /merchant/mfa/enable  { code }
 *
 * Confirm MFA enrollment by verifying a TOTP code generated from the secret
 * saved by /merchant/mfa/setup. Once enabled, /merchant/* routes require the
 * token to carry mfa_verified=true.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "Unauthorized" })

  const code = String((req.body as any)?.code ?? "").trim()
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "A 6-digit TOTP code is required" })
  }

  if (!ctx.merchant.mfa_secret_encrypted) {
    return res.status(400).json({ message: "MFA setup has not been started" })
  }

  if (!merchantMfaService.verifyTotp(ctx.merchant.mfa_secret_encrypted, code)) {
    return res.status(400).json({ message: "Invalid TOTP code" })
  }

  await ctx.svc.updateMerchants({
    id: ctx.merchant.id,
    mfa_enabled: true,
  })

  res.status(200).json({ message: "MFA enabled" })
}
