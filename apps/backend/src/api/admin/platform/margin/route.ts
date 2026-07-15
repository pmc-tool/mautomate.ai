import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PLATFORM_MODULE } from "../../../../modules/platform"
import { CREDIT_USD, PRICE_BOOK } from "../../../../modules/platform/pricing/price-book"

/**
 * GET /admin/platform/margin — the P&L, computed from what actually happened.
 *
 * Every billed action writes a usage row carrying BOTH what we charged (credits)
 * and what it cost us (vendor_cost_usd). So this is not a model or a forecast:
 * it is the real gross margin, per action, from real traffic.
 *
 * Query: ?days=30 (default), ?tenant_id= (drill into one merchant)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const platform: any = req.scope.resolve(PLATFORM_MODULE)

  const days = Math.min(365, Math.max(1, Number((req.query as any).days) || 30))
  const tenantId = (req.query as any).tenant_id as string | undefined
  const since = new Date(Date.now() - days * 86400_000)

  const where = tenantId
    ? `where u.deleted_at is null and u.created_at >= ? and u.tenant_id = ?`
    : `where u.deleted_at is null and u.created_at >= ?`
  const params = tenantId ? [since, tenantId] : [since]

  // --- usage → revenue (credits spent) vs cost (what the vendor billed us) ---
  const usage = await pg.raw(
    `select u.action,
            count(*)::int                         as events,
            coalesce(sum(u.units), 0)::float      as units,
            coalesce(sum(u.credits), 0)::float    as credits,
            coalesce(sum(u.vendor_cost_usd), 0)::float as cost_usd
       from usage_event u
       ${where}
      group by u.action
      order by credits desc`,
    params
  )

  const rows = (usage.rows ?? usage).map((r: any) => {
    const credits = Number(r.credits)
    const cost = Number(r.cost_usd)
    const revenue = credits * CREDIT_USD // what those credits are worth to us
    const profit = revenue - cost
    return {
      action: r.action,
      events: Number(r.events),
      units: Number(r.units),
      credits,
      revenue_usd: Number(revenue.toFixed(4)),
      cost_usd: Number(cost.toFixed(4)),
      profit_usd: Number(profit.toFixed(4)),
      margin_pct: revenue > 0 ? Number((((revenue - cost) / revenue) * 100).toFixed(1)) : null,
      multiple: cost > 0 ? Number((revenue / cost).toFixed(1)) : null,
      list_credits: (PRICE_BOOK as any)[r.action]?.credits ?? null,
    }
  })

  // --- subscription revenue (the base) ---
  const tenants = await platform.listTenants({}, { take: 10000 })
  const pkgs = await platform.listPlatformPackages({}, { take: 50 })
  const priceOf = new Map(pkgs.map((p: any) => [p.key, Number(p.price_usd)]))
  const byPlan: Record<string, { count: number; mrr: number }> = {}
  let mrr = 0
  for (const t of tenants) {
    const key = t.package ?? "free_trial"
    const price = Number(priceOf.get(key) ?? 0)
    byPlan[key] = byPlan[key] ?? { count: 0, mrr: 0 }
    byPlan[key].count++
    byPlan[key].mrr += price
    mrr += price
  }

  // --- top-up revenue in the window (credits people BOUGHT) ---
  const topups = await pg.raw(
    `select coalesce(sum(t.amount), 0)::float as credits
       from credit_transaction t
      where t.deleted_at is null
        and t.type = 'topup'
        and t.created_at >= ?`,
    [since]
  )
  const topupCredits = Number((topups.rows ?? topups)[0]?.credits ?? 0)

  const usageRevenue = rows.reduce((a: number, r: any) => a + r.revenue_usd, 0)
  const usageCost = rows.reduce((a: number, r: any) => a + r.cost_usd, 0)

  res.json({
    window_days: days,
    tenant_id: tenantId ?? null,

    // Where the money comes from
    revenue: {
      mrr_usd: Number(mrr.toFixed(2)),
      topup_credits_sold: topupCredits,
      topup_usd_est: Number((topupCredits * CREDIT_USD).toFixed(2)),
      // Credits consumed in the window, valued at list — this is the revenue
      // those subscriptions/top-ups are actually delivering against.
      usage_delivered_usd: Number(usageRevenue.toFixed(2)),
    },

    // What it cost us to deliver
    cogs: {
      vendor_usd: Number(usageCost.toFixed(2)),
    },

    // The number that matters
    gross: {
      profit_usd: Number((usageRevenue - usageCost).toFixed(2)),
      margin_pct:
        usageRevenue > 0
          ? Number((((usageRevenue - usageCost) / usageRevenue) * 100).toFixed(1))
          : null,
    },

    by_action: rows,
    by_plan: Object.entries(byPlan)
      .map(([plan, v]) => ({ plan, tenants: v.count, mrr_usd: Number(v.mrr.toFixed(2)) }))
      .sort((a, b) => b.mrr_usd - a.mrr_usd),
  })
}
