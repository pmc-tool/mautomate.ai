import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
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
 * GET /merchant/call-center/analytics
 *
 * Tenant-scoped call-center analytics. Aggregates calls over an optional
 * date range (from/to on started_at) and optional campaign_id/direction
 * filters, then returns connect rate, containment, AHT, cost, and breakdowns.
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse<AnalyticsResponse | { message: string }>
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const from = typeof req.query.from === "string" ? req.query.from : undefined
    const to = typeof req.query.to === "string" ? req.query.to : undefined

    const startedAt: Record<string, Date> = {}
    if (from) {
      const d = new Date(from)
      if (!Number.isNaN(d.getTime())) startedAt.$gte = d
    }
    if (to) {
      const d = new Date(to)
      if (!Number.isNaN(d.getTime())) startedAt.$lte = d
    }

    const filters: Record<string, any> = { tenant_id }
    if (Object.keys(startedAt).length) filters.started_at = startedAt
    if (typeof req.query.campaign_id === "string") filters.campaign_id = req.query.campaign_id
    if (typeof req.query.direction === "string") filters.direction = req.query.direction

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
      if (offset >= count || page.length < PAGE_SIZE) break
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
