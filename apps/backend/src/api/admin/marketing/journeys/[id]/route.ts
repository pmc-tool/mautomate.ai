import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import { JOURNEY_TRIGGERS } from "../../../../../modules/marketing/journey/types"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const JOURNEY_STATUSES = ["draft", "active", "paused", "archived"] as const

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/**
 * GET /admin/marketing/journeys/:id
 *
 * Retrieve a single journey plus a breakdown of its enrollment counts by
 * status. Tenant-scoped (404 on cross-tenant).
 * Response: { journey, enrollment_counts }
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

    const [enrollments] = await svc.listAndCountMarketingJourneyEnrollments(
      { tenant_id: TENANT_ID, journey_id: id },
      { take: 100000, select: ["status"] }
    )

    const enrollment_counts: Record<string, number> = {}
    for (const e of enrollments as any[]) {
      const s = e.status as string
      enrollment_counts[s] = (enrollment_counts[s] ?? 0) + 1
    }

    res.json({ journey, enrollment_counts })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve journey",
    })
  }
}

/**
 * POST /admin/marketing/journeys/:id
 *
 * Partially update a journey. Tenant-scoped.
 * Body: { name?, description?, trigger_event?, steps?, segment_filter?,
 *         allow_reenroll?, status?, brand_voice_id? }
 * Response: { journey }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const b = (req.body ?? {}) as {
    name?: string
    description?: string | null
    trigger_event?: string
    steps?: unknown[]
    segment_filter?: Record<string, unknown> | null
    allow_reenroll?: boolean
    status?: string
    brand_voice_id?: string | null
  }

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingJourney(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Journey ${id} was not found` })
      return
    }

    const data: Record<string, unknown> = {}

    if (b.name !== undefined) {
      const name = b.name?.trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.description !== undefined) {
      data.description = b.description?.trim() || null
    }
    if (b.trigger_event !== undefined) {
      const trigger_event = b.trigger_event?.trim()
      if (
        !trigger_event ||
        !(JOURNEY_TRIGGERS as readonly string[]).includes(trigger_event)
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid \`trigger_event\`. Must be one of: ${JOURNEY_TRIGGERS.join(", ")}.`
        )
      }
      data.trigger_event = trigger_event
    }
    if (b.steps !== undefined) {
      if (!Array.isArray(b.steps)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`steps` must be an array."
        )
      }
      data.steps = b.steps
    }
    if (b.segment_filter !== undefined) {
      data.segment_filter = b.segment_filter ?? null
    }
    if (b.allow_reenroll !== undefined) {
      data.allow_reenroll = b.allow_reenroll === true
    }
    if (b.status !== undefined) {
      if (!(JOURNEY_STATUSES as readonly string[]).includes(b.status)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid \`status\`. Must be one of: ${JOURNEY_STATUSES.join(", ")}.`
        )
      }
      data.status = b.status
    }
    if (b.brand_voice_id !== undefined) {
      data.brand_voice_id = b.brand_voice_id?.trim() || null
    }

    await svc.updateMarketingJourneys({ id, ...data } as any)
    const journey = await svc.retrieveMarketingJourney(id)

    res.json({ journey })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(isNotFound(e) ? 404 : status).json({
      message: e?.message ?? "Failed to update journey",
    })
  }
}

/**
 * DELETE /admin/marketing/journeys/:id
 *
 * Delete a journey (tenant-scoped). Verifies ownership before deleting.
 * Response: { id, deleted: true }
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const current = await svc.retrieveMarketingJourney(id)
    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Journey ${id} was not found` })
      return
    }

    await svc.deleteMarketingJourneys(id)

    res.json({ id, deleted: true })
  } catch (e: any) {
    res.status(isNotFound(e) ? 404 : 500).json({
      message: e?.message ?? "Failed to delete journey",
    })
  }
}
