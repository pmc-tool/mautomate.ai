import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const STATUSES = [
  "active",
  "processing",
  "recovered",
  "completed",
  "canceled",
  "failed",
] as const
type Status = (typeof STATUSES)[number]

/**
 * GET /admin/marketing/recovery
 *
 * The abandoned-cart recovery queue — one row per enrolled cart, newest first.
 * Optional `status` filter, paginated.
 * Response: { recoveries, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) ?? "20") || 20, 1),
      200
    )
    const offset = Math.max(parseInt((req.query.offset as string) ?? "0") || 0, 0)

    const filters: Record<string, any> = { tenant_id: TENANT_ID }
    if (req.query.status && STATUSES.includes(req.query.status as Status)) {
      filters.status = req.query.status
    }

    const [recoveries, count] = await svc.listAndCountMarketingCartRecoveries(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ recoveries, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list cart recoveries",
    })
  }
}
