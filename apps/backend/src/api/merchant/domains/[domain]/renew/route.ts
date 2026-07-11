import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { findOwnedDomain, normalizeDomain } from "../../_shared"
import { renewDomain } from "../../../../../modules/domains/domain-service"

/**
 * POST /merchant/domains/:domain/renew { years? }
 *
 * Renew a domain owned by this tenant. 404s (fail-closed) if the domain is not
 * one of the merchant's own.
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
  const years = Math.min(Math.max(Number(body.years ?? 1), 1), 10)

  const result = await renewDomain(req.scope, {
    tenantId: ctx.tenant.id,
    domainName: domain,
    years,
    isRestore: !!body.is_restore,
    userId: ctx.merchant.id,
  })

  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "domain renewal failed" })
  }

  res.json({ ok: true, ...((result.data as any) ?? {}) })
}
