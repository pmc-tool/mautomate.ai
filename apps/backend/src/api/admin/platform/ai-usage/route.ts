import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "../../../../modules/platform"
import {
  CREDIT_USD,
  PRICE_BOOK,
} from "../../../../modules/platform/pricing/price-book"

/**
 * GET /admin/platform/ai-usage — PLATFORM-WIDE AI spend + P&L (all tenants).
 *
 * Super-admin only (gated by the fail-closed /admin/platform/* middleware). Reads
 * the self-hosted Langfuse (env keys, server-side only — the secret NEVER leaves
 * the backend) via its public HTTP-Basic API and returns a single aggregated view
 * for a ?range=24h|7d|30d window:
 *   - headline totals (cost / traces / tokens + REVENUE / MARGIN)
 *   - cost + REVENUE + MARGIN by merchant (tenant_id resolved to a store name)
 *   - cost by feature and by model
 *   - the most recent AI activity
 *
 * Revenue/margin come from the SAME trusted usage_event ledger the Margin page
 * uses (so the numbers tie out): each billed AI action writes a row carrying
 * `credits` (what we charged) — revenue = credits * CREDIT_USD — and Langfuse
 * gives us `cost` (what the vendor billed us). margin = revenue − cost. The two
 * tenant sets are UNIONed so a merchant with cost-but-no-revenue (negative
 * margin) and a merchant with revenue-but-no-traces are both shown.
 *
 * Data sources (Langfuse v3 public API):
 *   - /api/public/metrics/daily  → authoritative totals + per-model breakdown
 *     (cap-free: one row per day, so it is never truncated).
 *   - /api/public/traces         → per-merchant + per-feature attribution
 *     (metadata.tenant_id / userId + metadata.feature / tags) and recent list.
 *   - /api/public/observations   → per-trace model + token usage, joined to the
 *     trace's tenant/feature via traceId (traces carry no token totals).
 * Traces + observations are paginated with a SANE CAP; if the cap is hit the
 * response sets `truncated: true` (totals from metrics/daily stay accurate).
 *
 * Langfuse unreachable / unconfigured → a clean { available: false, reason } —
 * BUT revenue is still computed from usage_event, so the page degrades to a
 * revenue-only view rather than nothing. This route NEVER 500s the page.
 */

// --- config -----------------------------------------------------------------

const HOST = (process.env.LANGFUSE_HOST || "http://127.0.0.1:3010").replace(
  /\/$/,
  ""
)
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY || ""
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY || ""

const langfuseConfigured = (): boolean => !!PUBLIC_KEY && !!SECRET_KEY

/** Pagination guardrails — 20 pages * 100 = 2000 rows before we mark truncated. */
const PAGE_SIZE = 100
const MAX_PAGES = 20
const FETCH_TIMEOUT_MS = 8000

/**
 * The AI-family billable actions whose credits count as AI REVENUE. Derived from
 * the price book so it stays correct as new AI meters are added: every `ai_*`
 * action (text/content/page-edit/image/logo/video/basic-image/ad-campaign AND
 * the voice/agent meters ai_call_minute + ai_call_phone_minute) plus the
 * AI-driven ads_autopilot_day. Non-AI meters (sms_segment, phone_number_month,
 * social_publish, email/email_batch, domain_purchase_usd) are excluded.
 */
const AI_ACTIONS: string[] = Object.keys(PRICE_BOOK).filter(
  (a) => a.startsWith("ai_") || a === "ads_autopilot_day"
)

// --- Langfuse client (server-side only) -------------------------------------

const authHeader = (): string =>
  "Basic " + Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString("base64")

async function lfGet<T = any>(path: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${HOST}${path}`, {
      headers: { authorization: authHeader(), accept: "application/json" },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Langfuse ${path} failed (${res.status})`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// --- window parsing ---------------------------------------------------------

function rangeFor(key: string): { from: Date; to: Date; label: string } {
  const to = new Date()
  const from = new Date(to)
  switch (key) {
    case "24h":
      from.setHours(from.getHours() - 24)
      return { from, to, label: "24h" }
    case "30d":
      from.setDate(from.getDate() - 30)
      return { from, to, label: "30d" }
    case "7d":
    default:
      from.setDate(from.getDate() - 7)
      return { from, to, label: "7d" }
  }
}

// --- feature / tenant helpers -----------------------------------------------

/** Bucket a trace into a feature label from metadata, then tags as a fallback. */
function classifyFeature(t: any): string {
  const meta = t?.metadata || {}
  if (typeof meta.feature === "string" && meta.feature.trim()) {
    return meta.feature.trim()
  }
  const tags: string[] = Array.isArray(t?.tags) ? t.tags : []
  if (tags.includes("voice")) {
    return "voice"
  }
  const pb = tags.find(
    (x) => typeof x === "string" && x.startsWith("playbook:")
  )
  if (pb) {
    return pb
  }
  return "unknown"
}

/** The tenant a trace belongs to (metadata.tenant_id, then userId/sessionId). */
function tenantOf(t: any): string | null {
  const meta = t?.metadata || {}
  return meta.tenant_id || t?.userId || t?.sessionId || null
}

// --- revenue (usage_event ledger) -------------------------------------------

/**
 * Per-tenant AI revenue in the window, from the SAME usage_event ledger the
 * Margin page reads. Best-effort: any failure (missing PG, bad query) returns an
 * empty map so the rest of the page still renders. Mirrors margin/route.ts:
 * raw SQL over usage_event via the PG_CONNECTION (knex) with ? placeholders.
 */
async function revenueByTenant(
  pg: any,
  from: Date,
  to: Date
): Promise<Map<string, { credits: number; revenue_usd: number }>> {
  const out = new Map<string, { credits: number; revenue_usd: number }>()
  if (!pg || AI_ACTIONS.length === 0) {
    return out
  }
  try {
    const placeholders = AI_ACTIONS.map(() => "?").join(",")
    const result = await pg.raw(
      `select u.tenant_id                        as tenant_id,
              coalesce(sum(u.credits), 0)::float as credits
         from usage_event u
        where u.deleted_at is null
          and u.created_at >= ?
          and u.created_at <= ?
          and u.action in (${placeholders})
        group by u.tenant_id`,
      [from, to, ...AI_ACTIONS]
    )
    const rows: any[] = result?.rows ?? result ?? []
    for (const r of rows) {
      const tid = r?.tenant_id || "__platform__"
      const credits = Number(r?.credits || 0)
      out.set(tid, {
        credits,
        revenue_usd: Number((credits * CREDIT_USD).toFixed(4)),
      })
    }
  } catch {
    /* revenue is best-effort — never fatal to the page */
  }
  return out
}

/**
 * Join Langfuse cost (per-tenant) with usage_event revenue (per-tenant) into the
 * final by_merchant rows. UNION of both tenant sets so nothing is hidden: a
 * merchant with cost-but-no-revenue keeps a negative margin, a merchant with
 * revenue-but-no-traces shows with cost 0.
 */
function assembleMerchants(
  costRows: Array<{
    tenant_id: string | null
    cost: number
    traces: number
    tokens: number
  }>,
  revenue: Map<string, { credits: number; revenue_usd: number }>,
  resolveName: (id: string | null) => string
) {
  type Row = {
    tenant_id: string | null
    cost: number
    traces: number
    tokens: number
    credits: number
    revenue_usd: number
  }
  const byKey = new Map<string, Row>()

  for (const c of costRows) {
    const key = c.tenant_id || "__platform__"
    byKey.set(key, {
      tenant_id: c.tenant_id,
      cost: c.cost,
      traces: c.traces,
      tokens: c.tokens,
      credits: 0,
      revenue_usd: 0,
    })
  }
  for (const [tid, rev] of revenue) {
    const key = tid || "__platform__"
    const cur = byKey.get(key)
    if (cur) {
      cur.credits = rev.credits
      cur.revenue_usd = rev.revenue_usd
    } else {
      byKey.set(key, {
        tenant_id: tid === "__platform__" ? null : tid,
        cost: 0,
        traces: 0,
        tokens: 0,
        credits: rev.credits,
        revenue_usd: rev.revenue_usd,
      })
    }
  }

  return Array.from(byKey.values())
    .map((m) => {
      const revenue_usd = Number(m.revenue_usd.toFixed(4))
      const cost = Number(m.cost.toFixed(4))
      const margin_usd = Number((revenue_usd - cost).toFixed(4))
      return {
        tenant_id: m.tenant_id,
        name: resolveName(m.tenant_id),
        cost: m.cost,
        traces: m.traces,
        tokens: m.tokens,
        credits: m.credits,
        revenue_usd,
        margin_usd,
        margin_pct:
          revenue_usd > 0 ? Number((margin_usd / revenue_usd).toFixed(4)) : null,
      }
    })
    .sort((a, b) => b.revenue_usd - a.revenue_usd || b.cost - a.cost)
}

/** Top-level revenue/margin totals across the assembled merchant rows. */
function totalsOf(
  merchants: Array<{ revenue_usd: number; margin_usd: number }>,
  totalCost: number
) {
  const total_revenue_usd = Number(
    merchants.reduce((a, m) => a + m.revenue_usd, 0).toFixed(4)
  )
  const total_margin_usd = Number((total_revenue_usd - totalCost).toFixed(4))
  return {
    total_revenue_usd,
    total_margin_usd,
    overall_margin_pct:
      total_revenue_usd > 0
        ? Number((total_margin_usd / total_revenue_usd).toFixed(4))
        : null,
  }
}

// --- route ------------------------------------------------------------------

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const rangeKey =
    typeof req.query.range === "string" ? req.query.range : "7d"
  const { from, to, label } = rangeFor(rangeKey)
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  // PG connection for the usage_event revenue query (best-effort).
  let pg: any = null
  try {
    pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  } catch {
    /* no pg — revenue simply comes back empty */
  }

  // Resolve tenant_id -> store name up front (best-effort; never fatal).
  const tenantNames = new Map<string, string>()
  try {
    const platform: any = req.scope.resolve(PLATFORM_MODULE)
    const tenants: any[] = (await platform.listTenants({})) || []
    for (const ten of tenants) {
      if (ten?.id && ten?.name) {
        tenantNames.set(ten.id, ten.name)
      }
      if (ten?.slug && ten?.name) {
        tenantNames.set(ten.slug, ten.name)
      }
    }
  } catch {
    /* tenant resolution is best-effort — fall back to raw ids */
  }

  const resolveName = (tenantId: string | null): string => {
    if (!tenantId) {
      return "Platform"
    }
    return tenantNames.get(tenantId) || tenantId
  }

  // Revenue from the usage_event ledger — computed regardless of Langfuse so the
  // page always has a P&L, even when observability is down.
  const revenue = await revenueByTenant(pg, from, to)

  // If Langfuse is not configured, degrade to a REVENUE-ONLY view (cost 0)
  // rather than nothing.
  if (!langfuseConfigured()) {
    const by_merchant = assembleMerchants([], revenue, resolveName)
    const totals = totalsOf(by_merchant, 0)
    return res.json({
      available: false,
      reason: "Langfuse is not configured (missing API keys).",
      range: label,
      window: { from: fromISO, to: toISO },
      total_cost: 0,
      total_traces: 0,
      total_tokens: 0,
      ...totals,
      by_merchant,
      by_feature: [],
      by_model: [],
      recent: [],
    })
  }

  try {
    let truncated = false

    // -- 1) Authoritative totals + per-model from metrics/daily --------------
    let totalCost = 0
    let totalTraces = 0
    let totalTokens = 0
    const modelAgg = new Map<
      string,
      { cost: number; tokens: number; traces: number }
    >()

    {
      let page = 1
      // metrics/daily returns one row per day, so this is effectively 1 page,
      // but we page defensively up to the cap.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const q = new URLSearchParams({
          fromTimestamp: fromISO,
          toTimestamp: toISO,
          page: String(page),
          limit: "50",
        })
        const body = await lfGet<any>(`/api/public/metrics/daily?${q}`)
        const days: any[] = body?.data || []
        for (const day of days) {
          totalCost += Number(day?.totalCost || 0)
          totalTraces += Number(day?.countTraces || 0)
          const usage: any[] = day?.usage || []
          for (const u of usage) {
            const model = u?.model || "unknown"
            const tokens = Number(u?.totalUsage || 0)
            totalTokens += tokens
            const cur = modelAgg.get(model) || {
              cost: 0,
              tokens: 0,
              traces: 0,
            }
            cur.cost += Number(u?.totalCost || 0)
            cur.tokens += tokens
            cur.traces += Number(u?.countTraces || 0)
            modelAgg.set(model, cur)
          }
        }
        const totalPages = Number(body?.meta?.totalPages || 1)
        if (page >= totalPages || page >= MAX_PAGES) {
          break
        }
        page++
      }
    }

    // -- 2) Per-merchant + per-feature + recent from traces ------------------
    type TraceLite = {
      tenantId: string | null
      feature: string
      name: string
      timestamp: string
      cost: number
    }
    const traceMap = new Map<string, TraceLite>()
    const merchantAgg = new Map<
      string,
      { tenant_id: string | null; cost: number; traces: number; tokens: number }
    >()
    const featureAgg = new Map<string, { cost: number; traces: number }>()
    const recentRaw: Array<{
      traceId: string
      time: string
      name: string
      feature: string
      tenantId: string | null
      cost: number
    }> = []

    {
      let page = 1
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const q = new URLSearchParams({
          fromTimestamp: fromISO,
          toTimestamp: toISO,
          page: String(page),
          limit: String(PAGE_SIZE),
          orderBy: "timestamp.desc",
        })
        const body = await lfGet<any>(`/api/public/traces?${q}`)
        const rows: any[] = body?.data || []
        for (const t of rows) {
          const tenantId = tenantOf(t)
          const feature = classifyFeature(t)
          const cost = Number(t?.totalCost || 0)
          traceMap.set(t.id, {
            tenantId,
            feature,
            name: t?.name || "ai",
            timestamp: t?.timestamp,
            cost,
          })

          const mKey = tenantId || "__platform__"
          const m = merchantAgg.get(mKey) || {
            tenant_id: tenantId,
            cost: 0,
            traces: 0,
            tokens: 0,
          }
          m.cost += cost
          m.traces += 1
          merchantAgg.set(mKey, m)

          const f = featureAgg.get(feature) || { cost: 0, traces: 0 }
          f.cost += cost
          f.traces += 1
          featureAgg.set(feature, f)

          if (recentRaw.length < 20) {
            recentRaw.push({
              traceId: t.id,
              time: t?.timestamp,
              name: t?.name || "ai",
              feature,
              tenantId,
              cost,
            })
          }
        }
        const totalPages = Number(body?.meta?.totalPages || 1)
        if (page >= totalPages) {
          break
        }
        if (page >= MAX_PAGES) {
          truncated = true
          break
        }
        page++
      }
    }

    // -- 3) Per-trace model + tokens from observations (joined via traceId) --
    const recentModel = new Map<string, string>()
    {
      let page = 1
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const q = new URLSearchParams({
          fromStartTime: fromISO,
          toStartTime: toISO,
          page: String(page),
          limit: String(PAGE_SIZE),
          type: "GENERATION",
        })
        const body = await lfGet<any>(`/api/public/observations?${q}`)
        const rows: any[] = body?.data || []
        for (const o of rows) {
          const traceId = o?.traceId
          const tokens = Number(
            o?.totalTokens ?? o?.usageDetails?.total ?? 0
          )
          if (traceId && !recentModel.has(traceId) && o?.model) {
            recentModel.set(traceId, o.model)
          }
          // Attribute tokens to the trace's merchant (traces carry no tokens).
          const tr = traceId ? traceMap.get(traceId) : undefined
          if (tr) {
            const mKey = tr.tenantId || "__platform__"
            const m = merchantAgg.get(mKey)
            if (m) {
              m.tokens += tokens
            }
          }
        }
        const totalPages = Number(body?.meta?.totalPages || 1)
        if (page >= totalPages) {
          break
        }
        if (page >= MAX_PAGES) {
          truncated = true
          break
        }
        page++
      }
    }

    // -- assemble ------------------------------------------------------------
    // Join Langfuse cost with usage_event revenue → per-merchant P&L.
    const by_merchant = assembleMerchants(
      Array.from(merchantAgg.values()),
      revenue,
      resolveName
    )
    const totals = totalsOf(by_merchant, totalCost)

    const by_feature = Array.from(featureAgg.entries())
      .map(([feature, v]) => ({
        feature,
        cost: v.cost,
        traces: v.traces,
      }))
      .sort((a, b) => b.cost - a.cost)

    const by_model = Array.from(modelAgg.entries())
      .map(([model, v]) => ({
        model,
        cost: v.cost,
        tokens: v.tokens,
        traces: v.traces,
      }))
      .sort((a, b) => b.cost - a.cost)

    const recent = recentRaw.map((r) => ({
      time: r.time,
      name: r.name,
      feature: r.feature,
      merchant: resolveName(r.tenantId),
      model: recentModel.get(r.traceId) || null,
      cost: r.cost,
    }))

    return res.json({
      available: true,
      range: label,
      window: { from: fromISO, to: toISO },
      // COST BASIS — this page's cost is MEASURED (actual per-token / per-vendor
      // spend from Langfuse), the counterpart to /admin/platform/margin's
      // price-book ESTIMATE. Labeled so the two super-admin views are never
      // conflated.
      cost_basis: "measured_langfuse",
      cost_is_estimate: false,
      total_cost: totalCost,
      total_traces: totalTraces,
      total_tokens: totalTokens,
      ...totals,
      by_merchant,
      by_feature,
      by_model,
      recent,
      truncated,
      ...(truncated
        ? {
            note: `Results capped at ${
              MAX_PAGES * PAGE_SIZE
            } traces/observations; totals are exact but per-merchant/feature breakdowns may be partial.`,
          }
        : {}),
    })
  } catch (e: any) {
    // Langfuse unreachable / API error — degrade to a REVENUE-ONLY view (cost 0)
    // instead of hiding the whole page. Revenue is already computed above.
    const by_merchant = assembleMerchants([], revenue, resolveName)
    const totals = totalsOf(by_merchant, 0)
    return res.json({
      available: false,
      reason: e?.message || "Could not reach Langfuse.",
      range: label,
      window: { from: fromISO, to: toISO },
      total_cost: 0,
      total_traces: 0,
      total_tokens: 0,
      ...totals,
      by_merchant,
      by_feature: [],
      by_model: [],
      recent: [],
    })
  }
}
