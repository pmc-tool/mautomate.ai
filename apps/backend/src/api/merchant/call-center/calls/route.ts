import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveMerchant } from "../../_helpers"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

/**
 * GET /merchant/call-center/calls
 *
 * Tenant-scoped, paginated call list. Optional query filters: status,
 * direction, order_id, campaign_id.
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

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id }
    if (req.query.status) filters.status = req.query.status
    if (req.query.direction) filters.direction = req.query.direction
    if (req.query.order_id) filters.order_id = req.query.order_id
    if (req.query.campaign_id) filters.campaign_id = req.query.campaign_id

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
