import { resolveTenantId } from "../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../modules/call-center"
import CallCenterModuleService from "../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * GET /admin/call-center
 *
 * Dashboard summary for the agent console: counts of today's calls grouped by
 * status, tasks currently scheduled, and campaigns running. Every query is
 * scoped to the default tenant.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    // Start of the current day (server local time) for "today" buckets.
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [callsToday, callsTodayCount] = await cc.listAndCountCalls(
      { tenant_id: TENANT_ID, created_at: { $gte: startOfToday } },
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

    const [, tasksScheduled] = await cc.listAndCountCallTasks(
      { tenant_id: TENANT_ID, status: "scheduled" },
      { take: 1 }
    )

    const [, campaignsRunning] = await cc.listAndCountCampaigns(
      { tenant_id: TENANT_ID, status: "running" },
      { take: 1 }
    )

    res.json({
      tenant_id: TENANT_ID,
      calls_today: {
        total: callsTodayCount,
        by_status: callsByStatus,
      },
      tasks_scheduled: tasksScheduled,
      campaigns_running: campaignsRunning,
    })
  } catch (e: any) {
    res.status(e?.type === "not_found" ? 404 : 500).json({
      message: e?.message ?? "Failed to load call-center summary",
    })
  }
}
