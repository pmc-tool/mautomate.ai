import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/segments/:id/evaluate
 *
 * Re-materialize a dynamic segment now: runs the evaluator, rewrites the
 * member set and refreshes member_count / last_evaluated_at.
 * Response: { count }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: any = req.scope.resolve(MARKETING_MODULE)

    const existing = await svc.retrieveMarketingSegment(req.params.id)
    if (!existing || existing.tenant_id !== TENANT_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Segment ${req.params.id} was not found.`
      )
    }

    // Load the evaluator lazily so this route compiles even if the segment
    // service lands slightly later.
    let segmentService: any
    try {
      segmentService = require("../../../../../../modules/marketing/segments/segment-service")
    } catch {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Segment evaluation is not available yet."
      )
    }

    const result = await segmentService.evaluateSegment(req.scope, {
      tenantId: TENANT_ID,
      segmentId: req.params.id,
    })

    const count =
      typeof result === "number" ? result : Number(result?.count ?? 0)

    res.json({ count })
  } catch (e: any) {
    const status =
      e?.type === MedusaError.Types.NOT_FOUND
        ? 404
        : e?.type === MedusaError.Types.NOT_ALLOWED
          ? 400
          : 500
    res.status(status).json({
      message: e?.message ?? "Failed to evaluate segment",
    })
  }
}
