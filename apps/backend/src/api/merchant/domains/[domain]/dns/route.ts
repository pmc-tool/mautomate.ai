import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../../_helpers"
import { findOwnedDomain, normalizeDomain } from "../../_shared"
import {
  getDnsRecords,
  mutateDnsRecord,
} from "../../../../../modules/domains/domain-service"

/**
 * DNS record management for a domain owned by the authenticated merchant.
 * Every method verifies the domain belongs to ctx.tenant → 404 otherwise.
 *
 *   GET    /merchant/domains/:domain/dns            list records
 *   POST   /merchant/domains/:domain/dns { record } add a record
 *   PUT    /merchant/domains/:domain/dns { record } update a record
 *   DELETE /merchant/domains/:domain/dns { record } delete a record
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

  const result = await getDnsRecords(req.scope, {
    tenantId: g.ctx.tenant.id,
    domainName: g.domain,
  })
  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "failed to load DNS records" })
  }
  const data = result.data as any
  res.json({ records: data?.records ?? data ?? [] })
}

async function mutate(
  req: MedusaRequest,
  res: MedusaResponse,
  op: "add" | "update" | "delete"
) {
  const g = await guard(req, res)
  if (!g) return

  const body = (req.body ?? {}) as any
  const record = body.record
  if (!record || typeof record !== "object") {
    return res.status(400).json({ message: "record is required" })
  }

  const result = await mutateDnsRecord(req.scope, {
    tenantId: g.ctx.tenant.id,
    domainName: g.domain,
    op,
    record,
  })
  if (!result.ok) {
    return res.status(502).json({ message: result.error ?? "DNS mutation failed" })
  }
  res.json({ ok: true, ...((result.data as any) ?? {}) })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) =>
  mutate(req, res, "add")

export const PUT = async (req: MedusaRequest, res: MedusaResponse) =>
  mutate(req, res, "update")

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) =>
  mutate(req, res, "delete")
