import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { DomainRoutingService } from "../../../../modules/platform/domain-routing"

/**
 * POST /merchant/domains/verify { domain_id } — merchant-triggered "Check status":
 * poll Cloudflare and reconcile SSL / verification status onto the domain row.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const domainId = String((req.body as any)?.domain_id ?? "")
  const row = await ctx.svc.retrieveTenantDomain(domainId).catch(() => null)
  if (!row || row.tenant_id !== ctx.tenant.id) {
    return res.status(404).json({ message: "domain not found" })
  }

  const routing = new DomainRoutingService(req.scope as any)
  const status = await routing.syncCustomHostname(domainId)
  res.json({
    domain_id: domainId,
    ssl_status: status?.ssl_status ?? row.ssl_status,
    verification_status: status?.verification_status ?? row.verification_status,
    pending: !status || status.verification_status !== "verified" || status.ssl_status !== "active",
  })
}
