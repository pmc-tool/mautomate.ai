import { resolveTenantId } from "../../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import MarketingModuleService from "../../../../../../modules/marketing/service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * POST /admin/marketing/journeys/:id/enroll
 *
 * Manually enroll one contact into this journey. Tenant-scoped (404 on
 * cross-tenant or missing journey). Requires at least one of `contact_id` or
 * `email`.
 * Body: { contact_id?, email?, customer_id? }
 * Response: { enrolled, enrollmentId?, reason? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    contact_id?: string
    email?: string
    customer_id?: string
  }

  try {
    const contactId = b.contact_id?.trim()
    const email = b.email?.trim()
    if (!contactId && !email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "One of `contact_id` or `email` is required."
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const journey = await svc.retrieveMarketingJourney(id)
    if (
      (journey as any)?.tenant_id &&
      (journey as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Journey ${id} was not found` })
      return
    }

    // Lazy require so this route compiles even if the enrollment service lands
    // slightly later (built by a parallel agent).
    const { enrollContact } = require("../../../../../../modules/marketing/journey/enrollment-service")

    const result = await enrollContact(req.scope, {
      tenantId: TENANT_ID,
      journeyId: id,
      contactId,
      email,
    })

    const enrolled = result?.enrolled === true
    res.status(enrolled ? 201 : 200).json({
      enrolled,
      enrollmentId: result?.enrollmentId,
      reason: result?.reason,
    })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to enroll contact",
    })
  }
}
