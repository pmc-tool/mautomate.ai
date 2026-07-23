import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { publishTiersForDisplay } from "../../../../modules/platform/mobile-app/prices"

/**
 * GET /merchant/mobile-app/service
 *
 * The tenant's publish-service state plus the tier prices for display. The
 * prices here (regular + 50%-off launch) are the exact server-side constants the
 * checkout will charge, so the UI never invents an amount.
 *
 * Tenant-scoped + fail-closed.
 */

const PUBLISH_STATES = [
  "awaiting_payment",
  "paid",
  "in_progress",
  "published",
  "payment_mismatch",
]

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const platform: any = req.scope.resolve(PLATFORM_MODULE)
  const orders = await platform
    .listMobileAppOrders(
      { tenant_id: ctx.tenant.id, kind: "publish" },
      { take: 20, order: { created_at: "DESC" } }
    )
    .catch(() => [])

  // The most advanced order is the store's effective service state.
  const rank: Record<string, number> = {
    published: 5,
    in_progress: 4,
    paid: 3,
    awaiting_payment: 2,
    payment_mismatch: 1,
    cancelled: 0,
  }
  let current: any = null
  for (const o of orders) {
    if (!PUBLISH_STATES.includes(o.status)) continue
    if (!current || (rank[o.status] ?? 0) > (rank[current.status] ?? 0)) current = o
  }

  const service = current
    ? {
        state: current.status, // none | awaiting_payment | paid | in_progress | published | payment_mismatch
        tier: current.tier ?? null,
        amount_paid_usd: current.amount_paid_usd ?? null,
        order_id: current.id,
        updated_at: current.updated_at,
      }
    : { state: "none", tier: null, amount_paid_usd: null, order_id: null }

  res.json({
    service,
    tiers: publishTiersForDisplay(),
  })
}
