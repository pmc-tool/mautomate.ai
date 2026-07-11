import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"
import {
  avgHandleTime,
  byDay,
  byStatus,
  connectRate,
  containmentRate,
  outcomeBreakdown,
  sentimentBreakdown,
  totalCost,
  type AggregatableCall,
} from "../../../../modules/call-center/analytics/aggregate"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * How many calls we page through per DB round-trip, and the overall cap so a
 * wide date range can never load an unbounded result set into memory. At
 * 1000/page × 50 pages we aggregate up to 50k calls, which comfortably covers a
 * single tenant's history for any reasonable window.
 */
const PAGE_SIZE = 1000
const MAX_CALLS = 50_000

type AnalyticsResponse = {
  summary: {
    total: number
    connect_rate: number
    containment_rate: number
    avg_handle_time: number
    total_cost: number
  }
  outcomes: Record<string, number>
  by_status: Record<string, number>
  by_day: Array<{ date: string; count: number; cost: number }>
  sentiment: Record<string, number>
  kpis_note: string
}

/**
 * GET /admin/call-center/analytics
 *
 * Aggregated, tenant-scoped call KPIs over a date range.
 *
 * Query:
 *   from         ISO date/datetime (inclusive lower bound on started_at)
 *   to           ISO date/datetime (inclusive upper bound on started_at)
 *   campaign_id  optional filter
 *   direction    optional filter ("inbound" | "outbound")
 *
 * Loads matching calls (paginated internally up to MAX_CALLS), runs the pure
 * aggregate helpers, and returns the summary + breakdowns. Only Medusa-observable
 * v1 KPIs are computed — RTO/NDR/first-attempt delivery come with the Phase-2
 * courier feed (see `kpis_note`).
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<AnalyticsResponse | { message: string }>
) => {
  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const from = typeof req.query.from === "string" ? req.query.from : undefined
    const to = typeof req.query.to === "string" ? req.query.to : undefined

    const startedAt: Record<string, Date> = {}
    if (from) {
      const d = new Date(from)
      if (!Number.isNaN(d.getTime())) {
        startedAt.$gte = d
      }
    }
    if (to) {
      const d = new Date(to)
      if (!Number.isNaN(d.getTime())) {
        startedAt.$lte = d
      }
    }

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    if (Object.keys(startedAt).length) {
      filters.started_at = startedAt
    }
    if (typeof req.query.campaign_id === "string") {
      filters.campaign_id = req.query.campaign_id
    }
    if (typeof req.query.direction === "string") {
      filters.direction = req.query.direction
    }

    // Page through the calls up to the safety cap so a wide window never loads
    // an unbounded set into memory.
    const calls: AggregatableCall[] = []
    let offset = 0
    while (offset < MAX_CALLS) {
      const [page, count] = await cc.listAndCountCalls(filters, {
        take: PAGE_SIZE,
        skip: offset,
        order: { started_at: "ASC" },
      })
      calls.push(...(page as AggregatableCall[]))
      offset += PAGE_SIZE
      if (offset >= count || page.length < PAGE_SIZE) {
        break
      }
    }

    const response: AnalyticsResponse = {
      summary: {
        total: calls.length,
        connect_rate: connectRate(calls),
        containment_rate: containmentRate(calls),
        avg_handle_time: avgHandleTime(calls),
        total_cost: totalCost(calls),
      },
      outcomes: outcomeBreakdown(calls),
      by_status: byStatus(calls),
      by_day: byDay(calls),
      sentiment: sentimentBreakdown(calls),
      kpis_note: "RTO/NDR/first-attempt require the Phase-2 courier feed",
    }

    res.json(response)
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to compute call-center analytics",
    })
  }
}
