import { MedusaRequest } from "@medusajs/framework/http"
import type { AiToolDefinition } from "../../../modules/marketing/ai/ai-provider"
import { MARKETING_MODULE } from "../../../modules/marketing"
import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import { getAdsOverview } from "../../../modules/marketing/ads"
import {
  umamiConfigured,
  getOrCreateTenantWebsite,
  rangeFor,
  websiteStats,
  websiteActive,
  websiteMetric,
} from "../../../lib/umami"

/**
 * Pixi — insight read tools: web traffic (Umami), what callers asked today
 * (call center), and ad performance. Tenant-scoped through `ctx`, never-throwing;
 * each returns `{available:false, note}` when its subsystem isn't set up rather
 * than failing the run.
 */

type Ctx = { tenant: any; merchant: any; svc: any }

const num = (v: any): number => {
  const n = Number(v?.value ?? v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/* ------------------------------ visitors --------------------------------- */

async function visitorReport(req: MedusaRequest, ctx: Ctx, days = 7) {
  try {
    if (!umamiConfigured()) {
      return { available: false, note: "Traffic analytics aren't set up for this store yet." }
    }
    const key = days <= 1 ? "24h" : days <= 7 ? "7d" : days <= 31 ? "30d" : "90d"
    const range = rangeFor(key)
    const websiteId = await getOrCreateTenantWebsite(ctx.svc, ctx.tenant)
    if (!websiteId) {
      return { available: false, note: "Traffic analytics aren't ready for this store yet." }
    }
    const [stats, active, pages, sources] = await Promise.all([
      websiteStats(websiteId, range).catch(() => null),
      websiteActive(websiteId).catch(() => ({ visitors: 0 })),
      websiteMetric(websiteId, "path", range, 5).catch(() => []),
      websiteMetric(websiteId, "referrer", range, 5).catch(() => []),
    ])
    const s: any = stats || {}
    return {
      available: true,
      days,
      visitors: num(s.visitors),
      pageviews: num(s.pageviews),
      visits: num(s.visits),
      bounce_rate: s.bounces != null && s.visits != null ? undefined : undefined,
      active_now: (active as any)?.visitors ?? 0,
      top_pages: (Array.isArray(pages) ? pages : []).slice(0, 5).map((p: any) => ({
        page: p.x ?? p.name ?? p.path,
        views: p.y ?? p.count ?? 0,
      })),
      top_sources: (Array.isArray(sources) ? sources : [])
        .slice(0, 5)
        .map((r: any) => ({ source: r.x || "direct", visits: r.y ?? r.count ?? 0 })),
    }
  } catch (e: any) {
    return { available: false, note: "Couldn't load traffic just now." }
  }
}

/* ---------------------------- call topics -------------------------------- */

async function callTopics(req: MedusaRequest, ctx: Ctx) {
  try {
    const cc: any = req.scope.resolve(CALL_CENTER_MODULE)
    const tenant_id = ctx.merchant?.tenant_id ?? ctx.tenant.id
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const [calls, count] = await cc.listAndCountCalls(
      { tenant_id, created_at: { $gte: start } },
      { take: 1000, order: { created_at: "DESC" } }
    )
    const list = Array.isArray(calls) ? calls : []
    if (!count) return { calls_today: 0, top_topics: [], by_status: {} }

    const byStatus: Record<string, number> = {}
    const topicCount: Record<string, number> = {}
    for (const c of list) {
      const st = c?.status ?? "unknown"
      byStatus[st] = (byStatus[st] ?? 0) + 1
      // Prefer a structured disposition; fall back to the first words of the
      // AI summary so "what did people ask" still has signal.
      const label =
        (c?.disposition && String(c.disposition).trim()) ||
        (c?.summary && String(c.summary).trim().split(/[.!?\n]/)[0].slice(0, 60)) ||
        null
      if (label) topicCount[label] = (topicCount[label] ?? 0) + 1
    }
    const top_topics = Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([topic, n]) => ({ topic, count: n }))
    return { calls_today: count, by_status: byStatus, top_topics }
  } catch (e: any) {
    return { available: false, note: "The call center isn't enabled on this store." }
  }
}

/* ------------------------------ ad report -------------------------------- */

async function adReport(req: MedusaRequest, ctx: Ctx, days = 30) {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const ov: any = await getAdsOverview(mk, ctx.tenant.id, { days })
    if (!ov) {
      return { available: false, note: "No ad account connected yet — connect one in the Advertising panel." }
    }
    const totals = ov.totals ?? ov
    const campaigns = ov.campaigns ?? ov.per_campaign ?? []
    return {
      available: true,
      days,
      mock: !!ov.mock,
      spend: num(totals.spend),
      impressions: num(totals.impressions),
      clicks: num(totals.clicks),
      conversions: num(totals.conversions),
      roas: totals.roas ?? null,
      currency: totals.currency ?? ov.currency ?? null,
      connected: ov.connected ?? ov.status ?? (Array.isArray(ov.accounts) ? ov.accounts.length > 0 : undefined),
      per_campaign: (Array.isArray(campaigns) ? campaigns : []).slice(0, 10).map((c: any) => ({
        name: c.name ?? c.campaign_name,
        status: c.status,
        spend: num(c.spend),
        conversions: num(c.conversions),
        roas: c.roas ?? null,
      })),
    }
  } catch (e: any) {
    return { available: false, note: "No ad account connected yet — connect one in the Advertising panel." }
  }
}

/* ------------------------------ compare ads ------------------------------ */

async function compareAds(req: MedusaRequest, ctx: Ctx, days = 7) {
  try {
    const mk: any = req.scope.resolve(MARKETING_MODULE)
    const [now, wide] = await Promise.all([
      getAdsOverview(mk, ctx.tenant.id, { days }).catch(() => null),
      getAdsOverview(mk, ctx.tenant.id, { days: days * 2 }).catch(() => null),
    ])
    if (!now) {
      return { available: false, note: "No ad account connected yet — connect one in the Advertising panel." }
    }
    const tNow: any = now.totals ?? now
    const tWide: any = (wide && (wide.totals ?? wide)) || {}
    // Previous window = the wider (2x) window minus the current one.
    const prev = (k: string) => Math.max(0, num(tWide[k]) - num(tNow[k]))
    const delta = (cur: number, was: number) => ({
      now: cur,
      last: was,
      change: cur - was,
      pct: was > 0 ? Math.round(((cur - was) / was) * 100) : null,
    })
    return {
      available: true,
      window_days: days,
      spend: delta(num(tNow.spend), prev("spend")),
      conversions: delta(num(tNow.conversions), prev("conversions")),
      clicks: delta(num(tNow.clicks), prev("clicks")),
      impressions: delta(num(tNow.impressions), prev("impressions")),
      note: `Comparing the last ${days} days to the ${days} days before.`,
    }
  } catch {
    return { available: false, note: "Couldn't compare ad periods just now." }
  }
}

/* ------------------------------- registry -------------------------------- */

export const INSIGHTS_TOOL_DEFS: AiToolDefinition[] = [
  {
    name: "visitor_report",
    description:
      "Web traffic for the store: visitors, pageviews, top pages and traffic sources. Use for 'visitor report', 'how much traffic', 'how many visitors', 'where's my traffic coming from'.",
    parameters: {
      type: "object",
      properties: { days: { type: "number", description: "Days to look back (1-90, default 7)" } },
      additionalProperties: false,
    },
  },
  {
    name: "call_topics",
    description:
      "What callers asked about today on the AI call center, with counts, plus call volume and status breakdown. Use for 'what did people ask on calls today', 'top call questions', 'today's calls'.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "ad_report",
    description:
      "Advertising performance: spend, impressions, clicks, conversions, ROAS and per-campaign results. Use for 'ad report', 'how are my ads doing', 'ad spend', 'ad performance'.",
    parameters: {
      type: "object",
      properties: { days: { type: "number", description: "Days to look back (default 30)" } },
      additionalProperties: false,
    },
  },
  {
    name: "compare_ads",
    description:
      "Compare ad performance this period vs the previous period of the same length. Use for 'how do my ads compare to last time', 'what changed since last week's ads', 'are my ads doing better or worse'.",
    parameters: {
      type: "object",
      properties: { days: { type: "number", description: "Length of each period in days (default 7)" } },
      additionalProperties: false,
    },
  },
]

export const INSIGHTS_TOOL_LABELS: Record<string, string> = {
  visitor_report: "Pulling your traffic numbers",
  call_topics: "Reviewing today's calls",
  ad_report: "Checking your ad performance",
  compare_ads: "Comparing your ad periods",
}

export async function runInsightsTool(
  req: MedusaRequest,
  ctx: Ctx,
  name: string,
  args: Record<string, any>
): Promise<unknown> {
  switch (name) {
    case "visitor_report":
      return await visitorReport(req, ctx, Number(args?.days) || 7)
    case "call_topics":
      return await callTopics(req, ctx)
    case "ad_report":
      return await adReport(req, ctx, Number(args?.days) || 30)
    case "compare_ads":
      return await compareAds(req, ctx, Number(args?.days) || 7)
    default:
      return { error: `unknown insights tool: ${name}` }
  }
}
