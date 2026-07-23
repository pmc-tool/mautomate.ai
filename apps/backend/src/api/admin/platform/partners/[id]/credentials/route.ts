import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import crypto from "crypto"
import { PLATFORM_MODULE } from "../../../../../../modules/platform"

/** Guaranteed-valid strong password: upper + lower + digit, 20 chars. */
const genPassword = () => "Aa1" + crypto.randomBytes(12).toString("hex").slice(0, 17)

/**
 * POST /admin/platform/partners/:id/credentials — give a partner their login.
 *
 * Creates the emailpass auth identity for the partner's email (actor_type
 * "partner" via app_metadata.partner_id) so they can sign into the partner
 * panel at /partners. Body: { password? } — generated when omitted. The
 * password is returned ONCE to the operator; it is not stored anywhere else.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<{ password?: string }>,
  res: MedusaResponse
) => {
  const svc: any = req.scope.resolve(PLATFORM_MODULE)
  const partner = await svc.retrievePartner(req.params.id).catch(() => null)
  if (!partner) return res.status(404).json({ message: "partner not found" })

  const email = String(partner.email ?? "").trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ message: "set an email on the partner first" })
  }

  const password = String(req.body?.password ?? "") || genPassword()
  if (password.length < 8) {
    return res.status(400).json({ message: "password must be at least 8 characters" })
  }

  const authService: any = req.scope.resolve(Modules.AUTH)
  const { authIdentity, error } = await authService.register("emailpass", {
    body: { email, password },
  })
  if (error || !authIdentity) {
    return res.status(409).json({
      message:
        typeof error === "string"
          ? `could not create login: ${error}`
          : "could not create login (an account with this email may already exist)",
    })
  }

  await authService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { partner_id: partner.id, email },
  })

  res.status(201).json({ email, password, panel_url: "https://mautomate.ai/partners" })
}
