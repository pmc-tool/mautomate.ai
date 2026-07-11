import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../_helpers"
import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import CallCenterModuleService from "../../../modules/call-center/service"

/**
 * GET /merchant/call-center
 *
 * Merchant-scoped call-center dashboard. Reads the merchant's tenant_id from
 * resolveMerchant and queries the call-center module directly. Returns today's
 * call counts by status, total minutes/cost, scheduled tasks, and running
 * campaigns.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const tenant_id = ctx.merchant.tenant_id
  if (!tenant_id) {
    return res.status(401).json({ message: "merchant tenant not resolved" })
  }

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [callsToday, callsTodayCount] = await cc.listAndCountCalls(
      { tenant_id, created_at: { $gte: startOfToday } },
      { take: 1000, order: { created_at: "DESC" } }
    )

    const callsByStatus = (callsToday ?? []).reduce(
      (acc: Record<string, number>, call: any) => {
        const status = call?.status ?? "unknown"
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    let totalMinutes = 0
    let totalCost = 0
    for (const call of callsToday ?? []) {
      const c = call as any
      totalCost += c.cost_total ?? 0
      if (c.started_at && c.ended_at) {
        const start = new Date(c.started_at).getTime()
        const end = new Date(c.ended_at).getTime()
        const seconds = (end - start) / 1000
        if (seconds > 0) totalMinutes += seconds / 60
      }
    }

    const [, tasksScheduled] = await cc.listAndCountCallTasks(
      { tenant_id, status: "scheduled" },
      { take: 1 }
    )

    const [, campaignsRunning] = await cc.listAndCountCampaigns(
      { tenant_id, status: "running" },
      { take: 1 }
    )

    res.json({
      tenant_id,
      calls_today: {
        total: callsTodayCount,
        by_status: callsByStatus,
      },
      total_minutes: Math.round(totalMinutes),
      total_cost: totalCost,
      tasks_scheduled: tasksScheduled,
      campaigns_running: campaignsRunning,
    })
  } catch (e: any) {
    res.status(e?.type === "not_found" ? 404 : 500).json({
      message: e?.message ?? "Failed to load call-center summary",
    })
  }
}
