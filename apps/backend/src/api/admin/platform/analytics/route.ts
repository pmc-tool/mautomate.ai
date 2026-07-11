import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listWebsites,
  rangeFor,
  umamiConfigured,
  websiteStats,
} from "../../../../lib/umami"

/**
 * GET /admin/platform/analytics — PLATFORM-WIDE web analytics (all tenants).
 *
 * Super-admin only (gated by the /admin/platform/* middleware). Aggregates every
 * tenant's Umami website into a platform total plus a per-site breakdown.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!umamiConfigured()) {
    return res.json({ enabled: false, totals: null, websites: [] })
  }

  const rangeKey = typeof req.query.range === "string" ? req.query.range : "7d"
  const range = rangeFor(rangeKey)

  try {
    const sites = await listWebsites()
    const withStats = await Promise.all(
      sites.slice(0, 500).map(async (w: any) => {
        const s: any = await websiteStats(w.id, range).catch(() => null)
        return {
          id: w.id,
          name: w.name,
          domain: w.domain,
          pageviews: Number(s?.pageviews ?? 0),
          visitors: Number(s?.visitors ?? 0),
          visits: Number(s?.visits ?? 0),
        }
      })
    )
    withStats.sort((a, b) => b.pageviews - a.pageviews)

    const totals = withStats.reduce(
      (acc, w) => ({
        pageviews: acc.pageviews + w.pageviews,
        visitors: acc.visitors + w.visitors,
        visits: acc.visits + w.visits,
      }),
      { pageviews: 0, visitors: 0, visits: 0 }
    )

    res.json({
      enabled: true,
      range: rangeKey,
      site_count: withStats.length,
      totals,
      websites: withStats,
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load analytics" })
  }
}
