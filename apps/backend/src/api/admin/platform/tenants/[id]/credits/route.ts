import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { SuperAdminService } from "../../../../../../modules/platform/super-admin"
import { actorFromReq } from "../../../_actor"
import { getLedger } from "../../../../../../modules/platform/credits/metering"

/** GET /admin/platform/tenants/:id/credits — balance split by lot (expiring vs purchased). */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const ledger = getLedger(req.scope)
  const breakdown = await ledger.balanceBreakdown(id)
  res.json({ tenant_id: id, ...breakdown })
}

/**
 * POST /admin/platform/tenants/:id/credits
 * { amount, source?: "grant"|"topup"|"plan"|"trial", expires_in_days?: number }
 *
 * Operators grant credits for real reasons: goodwill (never expires), a comped
 * plan allowance (expires with the period), or a manual top-up. The source
 * decides expiry — a "topup" can never be given an expiry date.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = (req.body ?? {}) as {
    amount?: number
    source?: string
    expires_in_days?: number
    reason?: string
  }
  const amount = Number(body.amount ?? 0)
  const source =
    body.source === "topup" || body.source === "plan" || body.source === "trial"
      ? body.source
      : "grant"

  const days = Number(body.expires_in_days ?? 0)
  const expiresAt =
    source === "topup" || !days || days <= 0
      ? null
      : new Date(Date.now() + days * 86400_000)

  const admin = new SuperAdminService(req.scope)
  const out = await admin.grantCredits(actorFromReq(req), id, amount, {
    source,
    expiresAt,
    reason: body.reason,
  })
  res.json(out)
}
