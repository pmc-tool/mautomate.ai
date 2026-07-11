import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Hard cap on the number of rows scanned for the aggregate. */
const SCAN_CAP = 5000

/** Statuses that represent a successfully dispatched message. */
const SENT_STATUSES = new Set(["sent", "delivered", "opened", "clicked"])

type Stats = {
  sent: number
  opened: number
  clicked: number
  bounced: number
  suppressed: number
  open_rate: number
  click_rate: number
  contacts: number
  window_days: number
}

const empty = (windowDays: number): Stats => ({
  sent: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  suppressed: 0,
  open_rate: 0,
  click_rate: 0,
  contacts: 0,
  window_days: windowDays,
})

/**
 * GET /admin/marketing/email/stats?days=30
 *
 * Aggregate email KPIs from the send rows over a rolling window. Defensive:
 * never throws — degrades to zeros on any failure. `contacts` is the count of
 * eligible (not-unsubscribed) contacts, used by the broadcast confirm.
 * Response: { sent, opened, clicked, bounced, suppressed, open_rate,
 *             click_rate, contacts, window_days }
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
      rows = await svc.listMarketingEmailSends(
        { tenant_id: TENANT_ID, created_at: { $gte: since } },
        { take: SCAN_CAP, order: { created_at: "DESC" } }
      )
    } catch {
      // Fall back to an unfiltered recent scan if the operator filter is
      // unsupported; still window the tally in memory below.
      rows = await svc
        .listMarketingEmailSends(
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

      const status = String(r?.status ?? "")
      const opens = Number(r?.open_count ?? 0)
      const clicks = Number(r?.click_count ?? 0)

      if (SENT_STATUSES.has(status)) {
        stats.sent++
      }
      if (opens > 0 || status === "opened" || status === "clicked") {
        stats.opened++
      }
      if (clicks > 0 || status === "clicked") {
        stats.clicked++
      }
      if (status === "bounced") {
        stats.bounced++
      }
      if (status === "suppressed") {
        stats.suppressed++
      }
    }

    stats.open_rate = stats.sent ? stats.opened / stats.sent : 0
    stats.click_rate = stats.sent ? stats.clicked / stats.sent : 0

    try {
      const eligible = await svc.listAndCountMarketingContacts(
        { tenant_id: TENANT_ID, unsubscribed_at: null },
        { take: 1 }
      )
      stats.contacts = Array.isArray(eligible) ? Number(eligible[1] ?? 0) : 0
    } catch {
      stats.contacts = 0
    }

    res.json(stats)
  } catch {
    // Never throw — the dashboard should still render.
    res.json(empty(days))
  }
}
