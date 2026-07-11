/**
 * GET /admin/marketing/analytics
 *
 * The marketing performance dashboard. Aggregates REAL data over a time window
 * into a single object: publishing throughput, content pipeline, inbox activity,
 * engagement (from captured stats), content->sales attribution, and daily
 * timeseries for charts.
 *
 * Query: ?since=<ISO>&until=<ISO> — both optional; defaults to the last 30 days.
 *
 * Response: the `getDashboard` object (see analytics/stats-service). Sections
 * degrade to zero-shapes with honest `has_data`/`note` flags rather than
 * fabricating numbers, so the call itself never fails on a data gap.
 */

import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { getDashboard } from "../../../../modules/marketing/analytics/stats-service"

const asString = (v: any): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const since = asString(req.query.since)
    const until = asString(req.query.until)

    const dashboard = await getDashboard(req.scope, { since, until })

    res.json(dashboard)
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to build analytics dashboard",
    })
  }
}
