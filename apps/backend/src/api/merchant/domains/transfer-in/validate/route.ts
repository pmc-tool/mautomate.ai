import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { normalizeDomain } from "../../_shared"
import { validateTransferIn } from "../../../../../modules/domains/domain-service"
import { isResellerConfigured } from "../../../../../modules/domains/provider"

/**
 * POST /merchant/domains/transfer-in/validate { domain, auth_code? }
 *
 * Check whether a domain is eligible to transfer IN (unlocked, past the 60-day
 * lock, etc) without committing. Degrades cleanly when the registrar is not
 * configured: returns configured:false so the UI can still show a "we'll process
 * this manually" path.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const domain = normalizeDomain(body.domain ?? body.domain_name)
  const authCode = body.auth_code ?? body.authCode ?? ""

  if (!domain || !/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(domain)) {
    return res.status(400).json({ message: "enter a valid domain, e.g. example.com" })
  }

  if (!isResellerConfigured()) {
    return res.json({
      domain,
      configured: false,
      valid: false,
      eligible: false,
      message:
        "Registrar is not configured. Transfers are handled as manual approvals.",
    })
  }

  const result = await validateTransferIn(req.scope, {
    tenantId: ctx.tenant.id,
    domainName: domain,
    authCode: String(authCode),
  })

  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "transfer validation failed" })
  }

  const data = (result.data ?? {}) as any
  res.json({
    domain,
    configured: true,
    valid: data.valid ?? false,
    eligible: data.eligible ?? false,
    message: data.message ?? null,
  })
}
