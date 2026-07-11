import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { findOwnedDomain, normalizeDomain } from "../../_shared"
import { setDomainToggle } from "../../../../../modules/domains/domain-service"

/**
 * POST /merchant/domains/:domain/lock { enabled }
 *
 * Toggle the registrar transfer-lock on a domain owned by this tenant.
 * Fail-closed: 404 if the domain is not one of the merchant's own.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const domain = normalizeDomain(req.params.domain)
  const owned = await findOwnedDomain(req, ctx, domain)
  if (!owned) {
    return res.status(404).json({ message: "domain not found" })
  }

  const body = (req.body ?? {}) as any
  const enabled = body.enabled
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled (boolean) is required" })
  }

  const result = await setDomainToggle(req.scope, {
    tenantId: ctx.tenant.id,
    domainName: domain,
    field: "locked",
    enabled,
  })
  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "could not update transfer lock" })
  }
  res.json({ ok: true, ...((result.data as any) ?? {}) })
}
