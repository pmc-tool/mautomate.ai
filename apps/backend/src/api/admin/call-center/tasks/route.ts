import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * GET /admin/call-center/tasks
 *
 * Paginated list of call tasks, tenant-scoped. Optional filter: status.
 * Response: { tasks, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    if (req.query.status) {
      filters.status = req.query.status
    }

    const [tasks, count] = await cc.listAndCountCallTasks(filters, {
      take: limit,
      skip: offset,
      order: { scheduled_at: "ASC" },
    })

    res.json({ tasks, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list call tasks",
    })
  }
}
