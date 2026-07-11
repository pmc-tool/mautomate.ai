import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import { JOURNEY_TRIGGERS } from "../../../../modules/marketing/journey/types"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/**
 * GET /admin/marketing/journeys
 *
 * Paginated list of marketing journeys, tenant-scoped. Optional filters:
 * `status` and `trigger_event`.
 * Response: { journeys, count, limit, offset }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, unknown> = { tenant_id: TENANT_ID }
    if (req.query.status) {
      filters.status = req.query.status as string
    }
    if (req.query.trigger_event) {
      filters.trigger_event = req.query.trigger_event as string
    }

    const [journeys, count] = await svc.listAndCountMarketingJourneys(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ journeys, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list journeys",
    })
  }
}

/**
 * POST /admin/marketing/journeys
 *
 * Create a marketing journey. `name` and a valid `trigger_event` are required.
 * Body: { name, description?, trigger_event, steps?, segment_filter?,
 *         allow_reenroll?, brand_voice_id? }
 * Response: { journey }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    name?: string
    description?: string
    trigger_event?: string
    steps?: unknown[]
    segment_filter?: Record<string, unknown>
    allow_reenroll?: boolean
    brand_voice_id?: string
  }

  try {
    const name = b.name?.trim()
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A journey `name` is required."
      )
    }

    const trigger_event = b.trigger_event?.trim()
    if (!trigger_event) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `trigger_event` is required."
      )
    }
    if (!(JOURNEY_TRIGGERS as readonly string[]).includes(trigger_event)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid \`trigger_event\`. Must be one of: ${JOURNEY_TRIGGERS.join(", ")}.`
      )
    }

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingJourneys({
      tenant_id: TENANT_ID,
      name,
      description: b.description?.trim() || null,
      trigger_event,
      steps: Array.isArray(b.steps) ? b.steps : [],
      segment_filter: b.segment_filter ?? null,
      allow_reenroll: b.allow_reenroll === true,
      brand_voice_id: b.brand_voice_id?.trim() || null,
      status: "draft",
    } as any)

    const journey = Array.isArray(created) ? created[0] : created

    res.status(201).json({ journey })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create journey",
    })
  }
}
