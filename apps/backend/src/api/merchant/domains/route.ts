import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant, domainEntitlement } from "../_helpers"
import { DomainRoutingService } from "../../../modules/platform/domain-routing"

const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"

const shape = (d: any) => ({
  id: d.id,
  domain: d.domain,
  type: d.type,
  is_primary: !!d.is_primary,
  ssl_status: d.ssl_status,
  verification_status: d.verification_status,
  instructions: d.verification?.dcv ?? [],
})

/** GET /merchant/domains — the authenticated merchant's domains. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const domains = await ctx.svc.listTenantDomains({ tenant_id: ctx.tenant.id })
  res.json({ domains: (domains || []).map(shape) })
}

/** POST /merchant/domains { domain } — connect a custom domain to this store. */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const raw = String((req.body as any)?.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "")
  if (!/^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(raw)) {
    return res.status(400).json({ message: "enter a valid domain, e.g. shop.yourbrand.com" })
  }
  if (raw.endsWith(`.${ROOT}`) || raw === ROOT) {
    return res.status(400).json({ message: "that is a mAutomate address — enter your OWN domain" })
  }
  // de-dup: a domain can belong to only one store
  const existing = await ctx.svc.listTenantDomains({ domain: raw }, { take: 1 })
  if (existing?.length) {
    return res.status(409).json({ message: `${raw} is already connected to a store` })
  }

  const ent = await domainEntitlement(ctx)
  if (!ent.ok) {
    return res.status(403).json({ message: ent.message, upgrade_required: true })
  }

  const routing = new DomainRoutingService(req.scope as any)
  const r = await routing.connectCustomDomain(ctx.tenant.id, raw)
  if (!r.ok) {
    const err = r.error ?? ""
    // Cost-cap ceiling reached (platform-wide custom-hostname limit).
    if (/capacity_reached|capacity/i.test(err)) {
      return res.status(503).json({
        message:
          "We've reached the maximum number of custom domains for now. Please contact support to raise the limit.",
      })
    }
    // Cloudflare for SaaS not yet provisioned on the zone (a one-time dashboard
    // enablement). Surface a clean message rather than the raw API/quota text.
    if (/quota|SSL for SaaS|not been granted|not_configured|provision|allocat/i.test(err)) {
      return res.status(503).json({
        message:
          "Custom domains aren't available on this store yet - our team is enabling them. Please try again shortly or contact support.",
      })
    }
    return res.status(502).json({ message: err || "could not connect domain" })
  }

  res.status(201).json({
    domain_id: r.domain_id,
    domain: raw,
    instructions: r.instructions,
    message: "Add these DNS records at your domain provider, then click 'Check status'.",
  })
}

/** DELETE /merchant/domains { domain_id } — disconnect a custom domain. */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const domainId = String((req.body as any)?.domain_id ?? "")
  const row = await ctx.svc.retrieveTenantDomain(domainId).catch(() => null)
  if (!row || row.tenant_id !== ctx.tenant.id) {
    return res.status(404).json({ message: "domain not found" })
  }
  if (row.type === "free") {
    return res.status(400).json({ message: "your free mautomate.ai address cannot be removed" })
  }
  const routing = new DomainRoutingService(req.scope as any)
  await routing.disconnectCustomDomain(domainId)
  res.json({ id: domainId, deleted: true })
}
