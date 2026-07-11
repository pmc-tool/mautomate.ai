import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import {
  getOrCreateTenantWebsite,
  rangeFor,
  umamiConfigured,
  websiteActive,
  websiteMetric,
  websitePageviews,
  websiteStats,
} from "../../../lib/umami"

/**
 * GET /merchant/analytics — this store's FULL web analytics (traffic).
 *
 * TENANT ISOLATION: the Umami website id is resolved from the AUTHENTICATED
 * tenant, never from a request parameter. Surfaces everything Umami exposes:
 * KPIs, the pageviews time-series, realtime active visitors, and every metric
 * breakdown (pages, entry/exit, referrers, geo, browsers, OS, devices,
 * languages, screens, campaigns, events).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  if (!umamiConfigured()) return res.json({ enabled: false })

  const rangeKey = typeof req.query.range === "string" ? req.query.range : "7d"
  const range = rangeFor(rangeKey)

  const websiteId = await getOrCreateTenantWebsite(ctx.svc, ctx.tenant)
  if (!websiteId) return res.json({ enabled: true, website_id: null, stats: null })

  const m = (t: any) => websiteMetric(websiteId, t, range, 12).catch(() => [])

  try {
    const [
      stats, series, active,
      pages, entry, exit, referrers, countries, regions, cities,
      browsers, os, devices, languages, screens, campaigns, events,
    ] = await Promise.all([
      websiteStats(websiteId, range).catch(() => null),
      websitePageviews(websiteId, range).catch(() => null),
      websiteActive(websiteId).catch(() => ({ visitors: 0 })),
      m("path"), m("entry"), m("exit"), m("referrer"),
      m("country"), m("region"), m("city"),
      m("browser"), m("os"), m("device"),
      m("language"), m("screen"), m("query"), m("event"),
    ])

    res.json({
      enabled: true,
      website_id: websiteId,
      range: rangeKey,
      stats,
      series,
      realtime: (active as any)?.visitors ?? 0,
      top: {
        pages, entry, exit, referrers,
        countries, regions, cities,
        browsers, os, devices,
        languages, screens, campaigns, events,
      },
    })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to load analytics" })
  }
}
