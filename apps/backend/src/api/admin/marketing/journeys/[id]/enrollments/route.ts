import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * GET /admin/marketing/journeys/:id/enrollments
 *
 * Paginated list of enrollments for this journey (per-journey activity view).
 * Tenant-scoped (404 on cross-tenant journey). Optional `status` filter.
 * Response: { enrollments, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const journey = await svc.retrieveMarketingJourney(id)
    if (
      (journey as any)?.tenant_id &&
      (journey as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Journey ${id} was not found` })
      return
    }

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, unknown> = {
      tenant_id: TENANT_ID,
      journey_id: id,
    }
    if (req.query.status) {
      filters.status = req.query.status as string
    }

    const [enrollments, count] =
      await svc.listAndCountMarketingJourneyEnrollments(filters, {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      })

    res.json({ enrollments, count, limit, offset })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to list enrollments",
    })
  }
}
