import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolvePartner } from "../_helpers"

/**
 * GET /partner/commissions — the partner's earnings ledger, newest first.
 * Query: status?, limit, offset. Response: { commissions, count }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolvePartner(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })
  const { partner, svc } = ctx

  const status = req.query.status as string | undefined
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500)
  const offset = Number(req.query.offset ?? 0) || 0

  const filters: Record<string, unknown> = { partner_id: partner.id }
  if (status) filters.status = status

  const [commissions, count] = await svc.listAndCountPartnerCommissions(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  // Attach store names for display.
  const tenantIds = Array.from(new Set((commissions || []).map((c: any) => c.tenant_id)))
  const tenants = tenantIds.length
    ? await svc.listTenants({ id: tenantIds }, { take: 500 }).catch(() => [])
    : []
  const nameById = new Map((tenants || []).map((t: any) => [t.id, t.name || t.slug]))

  res.json({
    commissions: (commissions || []).map((c: any) => ({
      id: c.id,
      store: nameById.get(c.tenant_id) ?? c.tenant_id,
      source: c.source,
      base_cents: c.base_cents,
      pct: c.pct,
      amount_cents: c.amount_cents,
      status: c.status,
      payout_id: c.payout_id,
      created_at: c.created_at,
    })),
    count,
  })
}
