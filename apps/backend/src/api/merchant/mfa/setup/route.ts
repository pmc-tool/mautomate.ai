import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { merchantMfaService } from "../../../../modules/platform/mfa/service"

/**
 * POST /merchant/mfa/setup
 *
 * Begin MFA enrollment for the authenticated merchant. Returns a fresh TOTP
 * secret (plaintext for one-time display), an otpauth:// QR URI, and recovery
 * codes. MFA is NOT enabled until /merchant/mfa/enable verifies a code.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "Unauthorized" })

  const setup = merchantMfaService.generateSetup(
    ctx.merchant.id,
    ctx.merchant.email,
    ctx.tenant.name
  )

  // Store the encrypted secret + backup hashes in a pending state (mfa_enabled stays false).
  await ctx.svc.updateMerchants({
    id: ctx.merchant.id,
    mfa_secret_encrypted: setup.secret_encrypted,
    mfa_backup_codes_hash: JSON.stringify(setup.backup_codes_hash),
  })

  res.status(200).json({
    secret: setup.secret_plaintext_for_display,
    qr_uri: setup.qr_uri,
    backup_codes: setup.backup_codes_plaintext,
  })
}
