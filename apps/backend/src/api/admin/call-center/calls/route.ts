import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * GET /admin/call-center/calls
 *
 * Paginated list of calls, tenant-scoped. Optional filters (via query string):
 * status, direction, order_id, campaign_id.
 * Response: { calls, count, limit, offset }
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
    if (req.query.direction) {
      filters.direction = req.query.direction
    }
    if (req.query.order_id) {
      filters.order_id = req.query.order_id
    }
    if (req.query.campaign_id) {
      filters.campaign_id = req.query.campaign_id
    }

    const [calls, count] = await cc.listAndCountCalls(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ calls, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list calls",
    })
  }
}
