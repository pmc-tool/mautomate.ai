import { resolveTenantId } from "../../../../lib/tenant-context"
/**
 * GET /admin/marketing/brain-analytics?days=30
 *
 * The Marketing Brain analytics dashboard. Aggregates REAL data over a rolling
 * window into a single object: email engagement, cart recovery, journeys,
 * audience, revenue attribution, and daily timeseries for charts.
 *
 * Query: ?days=7|30|90 — optional, defaults to 30 (clamped to [1, 365]).
 *
 * HONEST BY CONSTRUCTION: every section is self-contained and defensive — a
 * failure in one section yields that section's zero-shape (never throws the
 * whole call), and sections that need signals we do not yet capture expose a
 * `has_data` flag so the UI renders an honest empty state instead of fabricated
 * zeros. Everything is tenant-scoped.
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../modules/marketing"
import { getCommerceGateway } from "../../../../modules/marketing/gateway"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

// A generous per-section cap. This backend is single-store; bounded reads keep
// the aggregation honest without paging machinery.
const MAX_ROWS = 5000

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const asArray = <T>(v: any): T[] => (Array.isArray(v) ? v : v ? [v] : [])

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v)
  return isFinite(n) ? n : 0
}

const toDate = (v: unknown): Date | null => {
  if (!v) {
    return null
  }
  const d = v instanceof Date ? v : new Date(v as any)
  return isNaN(d.getTime()) ? null : d
}

const inWindow = (v: unknown, since: Date, until: Date): boolean => {
  const d = toDate(v)
  if (!d) {
    return false
  }
  const t = d.getTime()
  return t >= since.getTime() && t <= until.getTime()
}

const dayKey = (v: unknown): string | null => {
  const d = toDate(v)
  return d ? d.toISOString().slice(0, 10) : null
}

const ratio = (a: number, b: number): number => (b > 0 ? a / b : 0)

/** Build a continuous list of YYYY-MM-DD keys spanning [since, until]. */
const dayRange = (since: Date, until: Date): string[] => {
  const out: string[] = []
  const cur = new Date(
    Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate())
  )
  const end = new Date(
    Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate())
  )
  let guard = 0
  while (cur.getTime() <= end.getTime() && guard < 400) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
    guard++
  }
  return out
}

type DayPoint = { date: string; count: number }

/** Turn a { key -> count } map into a continuous, gap-filled day series. */
const toSeries = (
  counts: Record<string, number>,
  since: Date,
  until: Date
): DayPoint[] =>
  dayRange(since, until).map((date) => ({ date, count: counts[date] ?? 0 }))

const clampDays = (v: unknown): number => {
  const n = Math.round(num(v))
  if (!isFinite(n) || n <= 0) {
    return 30
  }
  return Math.max(1, Math.min(365, n))
}

// ---------------------------------------------------------------------------
// Sections (each self-contained + defensive: a throw -> that section's zeros)
// ---------------------------------------------------------------------------

/**
 * Email engagement. Delivery/engagement is derived from ground-truth timestamps
 * + counters (sent_at / delivered_at / opened_at / open_count / …) rather than
 * the terminal status enum, since a "clicked" row is also sent/delivered/opened.
 */
const buildEmail = async (mk: any, since: Date, until: Date) => {
  const out = {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    suppressed_total: 0,
    open_rate: 0,
    click_rate: 0,
    click_to_open: 0,
    has_data: false,
    _sentSeries: {} as Record<string, number>,
  }
  try {
    const rows = asArray<any>(
      await mk.listMarketingEmailSends(
        { tenant_id: TENANT_ID } as any,
        { take: MAX_ROWS, order: { created_at: "DESC" } }
      )
    )
    const inWin = rows.filter((r) => inWindow(r.created_at, since, until))
    for (const r of inWin) {
      const status = r.status
      const wasSent =
        !!toDate(r.sent_at) ||
        ["sent", "delivered", "opened", "clicked"].includes(status)
      if (wasSent) {
        out.sent++
        const k = dayKey(r.sent_at ?? r.created_at)
        if (k) {
          out._sentSeries[k] = (out._sentSeries[k] ?? 0) + 1
        }
      }
      if (
        !!toDate(r.delivered_at) ||
        ["delivered", "opened", "clicked"].includes(status)
      ) {
        out.delivered++
      }
      if (
        !!toDate(r.opened_at) ||
        num(r.open_count) > 0 ||
        ["opened", "clicked"].includes(status)
      ) {
        out.opened++
      }
      if (
        !!toDate(r.clicked_at) ||
        num(r.click_count) > 0 ||
        status === "clicked"
      ) {
        out.clicked++
      }
      if (status === "bounced") {
        out.bounced++
      }
    }
    out.open_rate = ratio(out.opened, out.sent)
    out.click_rate = ratio(out.clicked, out.sent)
    out.click_to_open = ratio(out.clicked, out.opened)
    out.has_data = out.sent > 0
  } catch {
    // keep zero-shape
  }
  try {
    const [, count] = await mk.listAndCountMarketingSuppressions(
      { tenant_id: TENANT_ID } as any,
      { take: 1 }
    )
    out.suppressed_total = num(count)
  } catch {
    // keep zero-shape
  }
  return out
}

/** Abandoned-cart recovery funnel + recovered revenue. */
const buildRecovery = async (mk: any, since: Date, until: Date) => {
  const out = {
    carts_detected: 0,
    emailed: 0,
    recovered: 0,
    recovered_revenue: 0,
    recovery_rate: 0,
    has_data: false,
    _recoveredSeries: {} as Record<string, number>,
  }
  try {
    const rows = asArray<any>(
      await mk.listMarketingCartRecoveries(
        { tenant_id: TENANT_ID } as any,
        { take: MAX_ROWS, order: { created_at: "DESC" } }
      )
    )
    const detected = rows.filter((r) => inWindow(r.created_at, since, until))
    out.carts_detected = detected.length
    out.emailed = detected.filter((r) => num(r.step) >= 1).length

    // Recovered is keyed off the recovery event time in the window, not the
    // detection time — a cart detected earlier can be recovered inside it.
    const recovered = rows.filter(
      (r) =>
        r.status === "recovered" &&
        inWindow(r.recovered_at ?? r.created_at, since, until)
    )
    out.recovered = recovered.length
    out.recovered_revenue = recovered.reduce(
      (s, r) => s + num(r.cart_total),
      0
    )
    out.recovery_rate = ratio(out.recovered, out.carts_detected)
    for (const r of recovered) {
      const k = dayKey(r.recovered_at ?? r.created_at)
      if (k) {
        out._recoveredSeries[k] = (out._recoveredSeries[k] ?? 0) + 1
      }
    }
    out.has_data = out.carts_detected > 0 || out.recovered > 0
  } catch {
    // keep zero-shape
  }
  return out
}

/** Journeys + enrollment outcomes over the window. */
const buildJourneys = async (mk: any, since: Date, until: Date) => {
  const out = {
    total: 0,
    active_journeys: 0,
    enrollments: { active: 0, completed: 0, failed: 0, total: 0 },
    completion_rate: 0,
    has_data: false,
  }
  try {
    const journeys = asArray<any>(
      await mk.listMarketingJourneys(
        { tenant_id: TENANT_ID } as any,
        { take: MAX_ROWS }
      )
    )
    out.total = journeys.length
    out.active_journeys = journeys.filter((j) => j.status === "active").length
  } catch {
    // keep zero-shape
  }
  try {
    const enr = asArray<any>(
      await mk.listMarketingJourneyEnrollments(
        { tenant_id: TENANT_ID } as any,
        { take: MAX_ROWS, order: { created_at: "DESC" } }
      )
    )
    const inWin = enr.filter((r) => inWindow(r.created_at, since, until))
    out.enrollments.total = inWin.length
    for (const r of inWin) {
      if (["active", "waiting", "processing"].includes(r.status)) {
        out.enrollments.active++
      } else if (r.status === "completed") {
        out.enrollments.completed++
      } else if (r.status === "failed") {
        out.enrollments.failed++
      }
    }
    out.completion_rate = ratio(
      out.enrollments.completed,
      out.enrollments.total
    )
  } catch {
    // keep zero-shape
  }
  out.has_data = out.total > 0 || out.enrollments.total > 0
  return out
}

/** Current audience state (contacts + segments). Not window-scoped. */
const buildAudience = async (mk: any) => {
  const out = {
    total_contacts: 0,
    subscribed: 0,
    segments: 0,
    segment_members: 0,
    has_data: false,
  }
  try {
    const [contacts, count] = await mk.listAndCountMarketingContacts(
      { tenant_id: TENANT_ID } as any,
      { take: MAX_ROWS }
    )
    const rows = asArray<any>(contacts)
    out.total_contacts = num(count) || rows.length
    out.subscribed = rows.filter((c) => !c.unsubscribed_at).length
  } catch {
    // keep zero-shape
  }
  try {
    const segs = asArray<any>(
      await mk.listMarketingSegments(
        { tenant_id: TENANT_ID } as any,
        { take: MAX_ROWS }
      )
    )
    out.segments = segs.length
    out.segment_members = segs.reduce((s, r) => s + num(r.member_count), 0)
  } catch {
    // keep zero-shape
  }
  out.has_data = out.total_contacts > 0 || out.segments > 0
  return out
}

/**
 * Revenue attribution from marketing-tagged orders. An order counts as
 * attributed when its metadata carries `utm_source === "marketing"` or a
 * `marketing_campaign_id`. Total store revenue in the window is included for
 * context. `has_data` is false when nothing is tagged yet.
 */
const buildAttribution = async (
  container: any,
  since: Date,
  until: Date
) => {
  const out = {
    attributed_orders: 0,
    attributed_revenue: 0,
    total_orders: 0,
    total_revenue: 0,
    has_data: false,
  }
  try {
    const gateway = getCommerceGateway(container)
    const orders = asArray<any>(
      await gateway.queryOrders(TENANT_ID, {
        created_after: since.toISOString(),
        limit: MAX_ROWS,
      })
    )
    const inWin = orders.filter((o) => inWindow(o.created_at, since, until))
    out.total_orders = inWin.length
    out.total_revenue = inWin.reduce((s, o) => s + num(o.total), 0)

    const tagged = inWin.filter((o) => {
      const m = (o.metadata ?? {}) as Record<string, unknown>
      return m.utm_source === "marketing" || Boolean(m.marketing_campaign_id)
    })
    out.attributed_orders = tagged.length
    out.attributed_revenue = tagged.reduce((s, o) => s + num(o.total), 0)
    out.has_data = out.attributed_orders > 0
  } catch {
    // keep zero-shape
  }
  return out
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const days = clampDays(req.query.days)
    const until = new Date()
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000)

    const [email, recovery, journeys, audience, attribution] =
      await Promise.all([
        buildEmail(mk, since, until),
        buildRecovery(mk, since, until),
        buildJourneys(mk, since, until),
        buildAudience(mk),
        buildAttribution(req.scope, since, until),
      ])

    const timeseries = {
      emails_sent_per_day: toSeries(email._sentSeries, since, until),
      recovered_per_day: toSeries(recovery._recoveredSeries, since, until),
    }

    const { _sentSeries, ...emailOut } = email
    const { _recoveredSeries, ...recoveryOut } = recovery

    res.json({
      window: {
        days,
        since: since.toISOString(),
        until: until.toISOString(),
      },
      generated_at: new Date().toISOString(),
      email: emailOut,
      recovery: recoveryOut,
      journeys,
      audience,
      attribution,
      timeseries,
    })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to build brain analytics",
    })
  }
}
