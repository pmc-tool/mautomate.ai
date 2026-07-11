import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * Marketing analytics — stats ingestion + dashboard aggregation.
 *
 * This module owns two things:
 *
 *  1. `recordStat` — the single ingestion point for captured metric datapoints
 *     (impressions / reach / clicks / conversions / revenue / ...). A future
 *     platform-insights puller or the publish runner calls this to persist a
 *     reading into `marketing_stat`. It is no-throw: a failed metric write must
 *     never break the caller's primary flow.
 *
 *  2. `getDashboard` — an HONEST performance dashboard computed from REAL data
 *     over a time window. Every section aggregates only what is actually stored;
 *     where a metric needs external signals we do not yet capture, the section
 *     reports zeros plus a `has_data`/`note` flag so the UI can render an honest
 *     empty state instead of fabricating numbers.
 *
 * Defensive by construction: each dashboard section is wrapped so that a failure
 * in one section yields that section's zero-shape and never throws the whole
 * call. Everything is tenant-scoped.
 */

import { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

// A generous per-section cap. This backend is single-store; these bounded reads
// keep the aggregation honest without paging machinery.
const MAX_ROWS = 5000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatMetric =
  | "impressions"
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "clicks"
  | "replies"
  | "conversions"
  | "revenue"

export type StatSubjectType =
  | "post_target"
  | "conversation"
  | "campaign"
  | "agent"
  | "post"

export type RecordStatInput = {
  tenantId?: string
  subjectType: StatSubjectType
  subjectId: string
  platform?: string | null
  metric: StatMetric
  value: number
  capturedAt?: string | Date | null
}

export type DashboardInput = {
  tenantId?: string
  since?: string | Date | null
  until?: string | Date | null
}

type DayPoint = { date: string; count: number }

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

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
  if (!d) {
    return null
  }
  return d.toISOString().slice(0, 10)
}

const asArray = <T>(v: any): T[] => (Array.isArray(v) ? v : v ? [v] : [])

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v)
  return isFinite(n) ? n : 0
}

/** Build a continuous list of YYYY-MM-DD keys spanning [since, until]. */
const dayRange = (since: Date, until: Date): string[] => {
  const out: string[] = []
  const cur = new Date(
    Date.UTC(
      since.getUTCFullYear(),
      since.getUTCMonth(),
      since.getUTCDate()
    )
  )
  const end = new Date(
    Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate())
  )
  // Cap to a sane number of days so a bad window can't explode the payload.
  let guard = 0
  while (cur.getTime() <= end.getTime() && guard < 400) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
    guard++
  }
  return out
}

/** Turn a { key -> count } map into a continuous, gap-filled day series. */
const toSeries = (
  counts: Record<string, number>,
  since: Date,
  until: Date
): DayPoint[] =>
  dayRange(since, until).map((date) => ({ date, count: counts[date] ?? 0 }))

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

/**
 * Persist a single captured metric datapoint into `marketing_stat`.
 *
 * "Upsert-ish": if an identical reading already exists for the same
 * (tenant, subject, platform, metric, captured_at) we update its value rather
 * than duplicating; otherwise we create. No-throw — returns the row on success
 * or `null` on any failure.
 */
export const recordStat = async (
  container: MedusaContainer,
  input: RecordStatInput
): Promise<any | null> => {
  try {
    const mk: any = container.resolve(MARKETING_MODULE)
    const tenant_id = input.tenantId ?? currentTenantId()
    const captured_at = toDate(input.capturedAt) ?? new Date()

    const payload = {
      tenant_id,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      platform: input.platform ?? null,
      metric: input.metric,
      value: num(input.value),
      captured_at,
    } as any

    // Try to find an identical existing reading to update in place.
    try {
      const existing = await mk.listMarketingStats(
        {
          tenant_id,
          subject_type: input.subjectType,
          subject_id: input.subjectId,
          metric: input.metric,
          captured_at,
        } as any,
        { take: 1 }
      )
      const found = asArray<any>(existing).find(
        (r) => (r.platform ?? null) === (input.platform ?? null)
      )
      if (found) {
        const updated = await mk.updateMarketingStats({
          id: found.id,
          value: num(input.value),
        } as any)
        return asArray<any>(updated)[0] ?? updated ?? null
      }
    } catch {
      // Fall through to create.
    }

    const created = await mk.createMarketingStats(payload)
    return asArray<any>(created)[0] ?? created ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Dashboard sections (each self-contained + defensive)
// ---------------------------------------------------------------------------

const emptyPublishing = () => ({
  published: 0,
  failed: 0,
  scheduled: 0,
  pending: 0,
  publishing: 0,
  success_rate: 0,
  recent_published: 0,
  by_platform: [] as Array<{
    platform: string
    published: number
    failed: number
    success_rate: number
  }>,
})

const buildPublishing = async (
  mk: any,
  since: Date,
  until: Date
): Promise<ReturnType<typeof emptyPublishing> & { _publishedRows: any[] }> => {
  const base = emptyPublishing()
  const publishedRows: any[] = []
  try {
    const listByStatus = async (status: string): Promise<any[]> => {
      const rows = await mk.listMarketingPostTargets(
        { tenant_id: currentTenantId(), status } as any,
        { take: MAX_ROWS }
      )
      return asArray<any>(rows)
    }

    const [pub, fail, scheduled, pending, publishing] = await Promise.all([
      listByStatus("published"),
      listByStatus("failed"),
      listByStatus("scheduled"),
      listByStatus("pending"),
      listByStatus("publishing"),
    ])

    const pubInWindow = pub.filter((r) =>
      inWindow(r.published_at, since, until)
    )
    const failInWindow = fail.filter((r) =>
      inWindow(r.updated_at ?? r.created_at, since, until)
    )

    publishedRows.push(...pubInWindow)

    base.published = pubInWindow.length
    base.failed = failInWindow.length
    base.scheduled = scheduled.length
    base.pending = pending.length
    base.publishing = publishing.length

    const denom = base.published + base.failed
    base.success_rate = denom > 0 ? base.published / denom : 0

    // "Recent" = published in the trailing 7 days of the window.
    const sevenAgo = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000)
    base.recent_published = pubInWindow.filter((r) =>
      inWindow(r.published_at, sevenAgo, until)
    ).length

    // Per-platform published/failed + success rate.
    const platforms: Record<string, { published: number; failed: number }> = {}
    for (const r of pubInWindow) {
      const p = r.platform ?? "unknown"
      ;(platforms[p] ??= { published: 0, failed: 0 }).published++
    }
    for (const r of failInWindow) {
      const p = r.platform ?? "unknown"
      ;(platforms[p] ??= { published: 0, failed: 0 }).failed++
    }
    base.by_platform = Object.entries(platforms)
      .map(([platform, v]) => {
        const d = v.published + v.failed
        return {
          platform,
          published: v.published,
          failed: v.failed,
          success_rate: d > 0 ? v.published / d : 0,
        }
      })
      .sort((a, b) => b.published - a.published)
  } catch {
    // keep zero-shape
  }
  return { ...base, _publishedRows: publishedRows }
}

const buildContent = async (mk: any) => {
  const out = {
    posts_total: 0,
    posts_by_status: {} as Record<string, number>,
    blog_articles_total: 0,
    blog_articles_by_status: {} as Record<string, number>,
    blog_articles_published: 0,
    campaigns_total: 0,
  }
  try {
    const posts = asArray<any>(
      await mk.listMarketingPosts({ tenant_id: currentTenantId() } as any, {
        take: MAX_ROWS,
      })
    )
    out.posts_total = posts.length
    for (const p of posts) {
      const s = p.status ?? "unknown"
      out.posts_by_status[s] = (out.posts_by_status[s] ?? 0) + 1
    }
  } catch {
    // keep zero-shape
  }
  try {
    const [articles, count] = await mk.listAndCountMarketingBlogArticles(
      { tenant_id: currentTenantId() } as any,
      { take: MAX_ROWS }
    )
    const rows = asArray<any>(articles)
    out.blog_articles_total = count ?? rows.length
    for (const a of rows) {
      const s = a.status ?? "unknown"
      out.blog_articles_by_status[s] = (out.blog_articles_by_status[s] ?? 0) + 1
    }
    out.blog_articles_published = out.blog_articles_by_status["published"] ?? 0
  } catch {
    // keep zero-shape
  }
  try {
    const [, count] = await mk.listAndCountMarketingCampaigns(
      { tenant_id: currentTenantId() } as any,
      { take: 1 }
    )
    out.campaigns_total = count ?? 0
  } catch {
    // keep zero-shape
  }
  return out
}

const buildInbox = async (mk: any, since: Date, until: Date) => {
  const out = {
    conversations_total: 0,
    by_status: { open: 0, snoozed: 0, closed: 0 } as Record<string, number>,
    by_channel: {} as Record<string, number>,
    messages_inbound: 0,
    messages_outbound: 0,
    avg_first_response_minutes: null as number | null,
    _messageSeries: {} as Record<string, number>,
  }
  try {
    const convs = asArray<any>(
      await mk.listMarketingConversations({ tenant_id: currentTenantId() } as any, {
        take: MAX_ROWS,
      })
    )
    out.conversations_total = convs.length
    for (const c of convs) {
      const s = c.status ?? "unknown"
      out.by_status[s] = (out.by_status[s] ?? 0) + 1
      const ch = c.channel ?? "unknown"
      out.by_channel[ch] = (out.by_channel[ch] ?? 0) + 1
    }
  } catch {
    // keep zero-shape
  }
  try {
    const messages = asArray<any>(
      await mk.listMarketingMessages({ tenant_id: currentTenantId() } as any, {
        take: MAX_ROWS,
        order: { sent_at: "ASC" },
      })
    )
    const inWin = messages.filter((m) => inWindow(m.sent_at, since, until))
    for (const m of inWin) {
      if (m.direction === "inbound") {
        out.messages_inbound++
      } else if (m.direction === "outbound") {
        out.messages_outbound++
      }
      const k = dayKey(m.sent_at)
      if (k) {
        out._messageSeries[k] = (out._messageSeries[k] ?? 0) + 1
      }
    }

    // First-response proxy: per conversation, delta between first inbound and
    // the first outbound that follows it. Averaged over conversations that have
    // such a pair within the window.
    const byConv: Record<string, any[]> = {}
    for (const m of inWin) {
      ;(byConv[m.conversation_id] ??= []).push(m)
    }
    const deltas: number[] = []
    for (const list of Object.values(byConv)) {
      const firstInbound = list.find((m) => m.direction === "inbound")
      if (!firstInbound) {
        continue
      }
      const inT = toDate(firstInbound.sent_at)?.getTime()
      if (!inT) {
        continue
      }
      const reply = list.find(
        (m) =>
          m.direction === "outbound" &&
          (toDate(m.sent_at)?.getTime() ?? 0) >= inT
      )
      const outT = reply ? toDate(reply.sent_at)?.getTime() : undefined
      if (outT && outT >= inT) {
        deltas.push((outT - inT) / 60000)
      }
    }
    if (deltas.length) {
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
      out.avg_first_response_minutes = Math.round(avg)
    }
  } catch {
    // keep zero-shape
  }
  return out
}

const buildEngagement = async (mk: any, since: Date, until: Date) => {
  const metrics: StatMetric[] = [
    "impressions",
    "reach",
    "likes",
    "comments",
    "shares",
    "clicks",
    "replies",
    "conversions",
    "revenue",
  ]
  const totals: Record<string, number> = {}
  for (const m of metrics) {
    totals[m] = 0
  }
  const out = { has_data: false, totals, rows: 0 }
  try {
    const stats = asArray<any>(
      await mk.listMarketingStats({ tenant_id: currentTenantId() } as any, {
        take: MAX_ROWS,
      })
    )
    const inWin = stats.filter((s) => inWindow(s.captured_at, since, until))
    out.rows = inWin.length
    for (const s of inWin) {
      if (s.metric in totals) {
        totals[s.metric] += num(s.value)
      }
    }
    out.has_data = inWin.length > 0
  } catch {
    // keep zero-shape
  }
  return out
}

const buildAttribution = async (
  container: MedusaContainer,
  since: Date,
  until: Date
) => {
  const out = {
    attributed_orders: 0,
    attributed_revenue: 0,
    total_orders: 0,
    total_revenue: 0,
    currency_code: null as string | null,
    has_data: false,
    note: "" as string,
  }
  try {
    const gateway = getCommerceGateway(container)
    const orders = await gateway.queryOrders(currentTenantId(), {
      created_after: since.toISOString(),
      limit: 1000,
    })
    const rows = asArray<any>(orders).filter((o) =>
      inWindow(o.created_at, since, until)
    )
    out.total_orders = rows.length
    for (const o of rows) {
      const t = num(o.total)
      out.total_revenue += t
      if (!out.currency_code && o.currency_code) {
        out.currency_code = o.currency_code
      }
      const md = (o.metadata ?? {}) as Record<string, unknown>
      const tagged =
        md.utm_source === "marketing" ||
        Boolean(md.marketing_campaign_id) ||
        md.utm_medium === "marketing"
      if (tagged) {
        out.attributed_orders++
        out.attributed_revenue += t
      }
    }
    out.has_data = out.attributed_orders > 0
    out.note = out.has_data
      ? ""
      : "No marketing-tagged orders in this window. Attribution populates once published posts carry UTM links (utm_source=marketing or marketing_campaign_id)."
  } catch {
    out.note =
      "Attribution unavailable — could not read orders for this window."
  }
  return out
}

// ---------------------------------------------------------------------------
// Public: dashboard
// ---------------------------------------------------------------------------

/**
 * Aggregate an honest performance dashboard over [since, until] (defaults to the
 * last 30 days). Sections: publishing, content, inbox, engagement, attribution,
 * timeseries. Never throws — a failing section degrades to its zero-shape.
 */
export const getDashboard = async (
  container: MedusaContainer,
  input: DashboardInput = {}
) => {
  const until = toDate(input.until) ?? new Date()
  const since =
    toDate(input.since) ??
    new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000)

  const mk: any = container.resolve(MARKETING_MODULE)

  const [publishingFull, content, inbox, engagement, attribution] =
    await Promise.all([
      buildPublishing(mk, since, until),
      buildContent(mk),
      buildInbox(mk, since, until),
      buildEngagement(mk, since, until),
      buildAttribution(container, since, until),
    ])

  const { _publishedRows, ...publishing } = publishingFull

  // Timeseries derived from the rows the sections already loaded.
  const publishedCounts: Record<string, number> = {}
  for (const r of _publishedRows) {
    const k = dayKey(r.published_at)
    if (k) {
      publishedCounts[k] = (publishedCounts[k] ?? 0) + 1
    }
  }
  const { _messageSeries, ...inboxClean } = inbox

  const timeseries = {
    published_per_day: toSeries(publishedCounts, since, until),
    messages_per_day: toSeries(_messageSeries, since, until),
  }

  const hasActivity =
    publishing.published > 0 ||
    publishing.scheduled > 0 ||
    publishing.pending > 0 ||
    publishing.publishing > 0 ||
    content.posts_total > 0 ||
    content.blog_articles_total > 0 ||
    content.campaigns_total > 0 ||
    inboxClean.conversations_total > 0

  return {
    window: { since: since.toISOString(), until: until.toISOString() },
    has_activity: hasActivity,
    publishing,
    content,
    inbox: inboxClean,
    engagement,
    attribution,
    timeseries,
  }
}

export type MarketingDashboard = Awaited<ReturnType<typeof getDashboard>>
