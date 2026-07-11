import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { findOwnedDomain, normalizeDomain } from "../../_shared"
import {
  getNameservers,
  setNameservers,
} from "../../../../../modules/domains/domain-service"

/**
 * Nameserver management for a domain owned by the authenticated merchant.
 * Both methods verify the domain belongs to ctx.tenant → 404 otherwise.
 *
 *   GET /merchant/domains/:domain/nameservers                current NS
 *   PUT /merchant/domains/:domain/nameservers { nameservers } replace NS
 */

async function guard(req: MedusaRequest, res: MedusaResponse) {
  const ctx = await resolveMerchant(req)
  if (!ctx) {
    res.status(401).json({ message: "not authorized" })
    return null
  }
  const domain = normalizeDomain(req.params.domain)
  const owned = await findOwnedDomain(req, ctx, domain)
  if (!owned) {
    res.status(404).json({ message: "domain not found" })
    return null
  }
  return { ctx, domain }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const g = await guard(req, res)
  if (!g) return

  const result = await getNameservers(req.scope, {
    tenantId: g.ctx.tenant.id,
    domainName: g.domain,
  })
  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "failed to load nameservers" })
  }
  res.json({ nameservers: (result.data as any)?.nameservers ?? [] })
}

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const g = await guard(req, res)
  if (!g) return

  const body = (req.body ?? {}) as any
  const nameservers = body.nameservers
  if (!Array.isArray(nameservers) || nameservers.length === 0) {
    return res
      .status(400)
      .json({ message: "nameservers (non-empty array) is required" })
  }

  const result = await setNameservers(req.scope, {
    tenantId: g.ctx.tenant.id,
    domainName: g.domain,
    nameservers: nameservers.map(String),
  })
  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "failed to set nameservers" })
  }
  res.json({ ok: true, ...((result.data as any) ?? {}) })
}
