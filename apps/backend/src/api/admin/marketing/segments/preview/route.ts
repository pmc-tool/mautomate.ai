import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * POST /admin/marketing/segments/preview
 *
 * Live audience count for the rule builder: runs the evaluator against the
 * supplied filter WITHOUT persisting anything, returning the match count plus
 * a small contact sample.
 * Body: { filter, limit? }
 * Response: { count, sample }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    filter?: Record<string, unknown> | null
    limit?: number
  }

  try {
    const rawLimit = Number(b.limit ?? 10)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.round(rawLimit), 1), 50)
      : 10

    // Load the evaluator lazily so this route compiles even if the segment
    // service lands slightly later.
    let segmentService: any
    try {
      segmentService = require("../../../../../modules/marketing/segments/segment-service")
    } catch {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Segment preview is not available yet."
      )
    }

    const result = await segmentService.previewSegment(req.scope, {
      tenantId: TENANT_ID,
      filter: b.filter ?? { match: "all", rules: [] },
      limit,
    })

    const count = Number(result?.count ?? 0)
    const sample = Array.isArray(result?.sample) ? result.sample : []

    res.json({ count, sample })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.NOT_ALLOWED ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to preview segment",
    })
  }
}
