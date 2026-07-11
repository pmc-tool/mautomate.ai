import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const JOURNEY_STATUSES = ["draft", "active", "paused", "archived"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/journeys/:id/activate
 *
 * Convenience toggle to set a journey's lifecycle status. Tenant-scoped.
 * Body: { status: "active" | "paused" | "draft" | "archived" }
 * Response: { journey }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as { status?: string }

  try {
    const status = b.status
    if (
      !status ||
      !(JOURNEY_STATUSES as readonly string[]).includes(status)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid \`status\`. Must be one of: ${JOURNEY_STATUSES.join(", ")}.`
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingJourney(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Journey ${id} was not found` })
      return
    }

    await svc.updateMarketingJourneys({ id, status } as any)
    const journey = await svc.retrieveMarketingJourney(id)

    res.json({ journey })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update journey status",
    })
  }
}
