import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { findOwnedDomain, normalizeDomain } from "../../_shared"
import { getTransferOut } from "../../../../../modules/domains/domain-service"

/**
 * POST /merchant/domains/:domain/transfer-out
 *
 * Prepare a transfer OUT for a domain owned by this tenant: unlock it at the
 * registrar if needed and return the EPP/auth code the merchant hands to their
 * new registrar. Fail-closed: 404 if the domain is not one of the merchant's own.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const domain = normalizeDomain(req.params.domain)
  const owned = await findOwnedDomain(req, ctx, domain)
  if (!owned) {
    return res.status(404).json({ message: "domain not found" })
  }

  const result = await getTransferOut(req.scope, {
    tenantId: ctx.tenant.id,
    domainName: domain,
  })
  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "transfer-out preparation failed" })
  }

  const data = (result.data ?? {}) as any
  res.json({
    domain,
    locked: data.locked ?? false,
    auth_code: data.authCode ?? null,
  })
}
