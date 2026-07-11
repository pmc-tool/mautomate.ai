import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Hard cap on the number of rows scanned for the aggregate. */
const SCAN_CAP = 5000

type Stats = {
  detected: number
  active: number
  emailed: number
  recovered: number
  recovered_revenue: number
  recovery_rate: number
  window_days: number
}

const empty = (windowDays: number): Stats => ({
  detected: 0,
  active: 0,
  emailed: 0,
  recovered: 0,
  recovered_revenue: 0,
  recovery_rate: 0,
  window_days: windowDays,
})

/**
 * GET /admin/marketing/recovery/stats?days=30
 *
 * Aggregate abandoned-cart recovery KPIs over a rolling window. Defensive:
 * never throws — degrades to zeros on any failure.
 *   detected          = rows created in the window
 *   active            = rows currently in status "active"
 *   emailed           = rows that have sent at least one email (step >= 1)
 *   recovered         = rows flipped to status "recovered" in the window
 *   recovered_revenue = sum(cart_total) of recovered rows
 *   recovery_rate     = recovered / detected
 * Response: { detected, active, emailed, recovered, recovered_revenue,
 *             recovery_rate, window_days }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const days = Math.min(
    Math.max(parseInt((req.query.days as string) ?? "30") || 30, 1),
    365
  )

  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    let rows: any[] = []
    try {
      rows = await svc.listMarketingCartRecoveries(
        { tenant_id: TENANT_ID, created_at: { $gte: since } },
        { take: SCAN_CAP, order: { created_at: "DESC" } }
      )
    } catch {
      // Fall back to an unfiltered recent scan if the operator filter is
      // unsupported; still window the tally in memory below.
      rows = await svc
        .listMarketingCartRecoveries(
          { tenant_id: TENANT_ID },
          { take: SCAN_CAP, order: { created_at: "DESC" } }
        )
        .catch(() => [])
    }

    const stats = empty(days)
    const sinceMs = since.getTime()

    for (const r of Array.isArray(rows) ? rows : []) {
      const created = r?.created_at ? new Date(r.created_at).getTime() : 0
      if (created && created < sinceMs) {
        continue
      }

      stats.detected++

      const status = String(r?.status ?? "")
      const step = Number(r?.step ?? 0)

      if (status === "active") {
        stats.active++
      }
      if (step >= 1) {
        stats.emailed++
      }
      if (status === "recovered") {
        stats.recovered++
        const total = Number(r?.cart_total ?? 0)
        if (Number.isFinite(total)) {
          stats.recovered_revenue += total
        }
      }
    }

    stats.recovery_rate = stats.detected
      ? stats.recovered / stats.detected
      : 0

    res.json(stats)
  } catch {
    // Never throw — the dashboard should still render.
    res.json(empty(days))
  }
}
