import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CALL_CENTER_MODULE } from "../../../../modules/call-center"
import CallCenterModuleService from "../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * GET /admin/call-center/campaigns
 *
 * Paginated list of campaigns, tenant-scoped. Optional filter: status.
 * Response: { campaigns, count, limit, offset }
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

    const [campaigns, count] = await cc.listAndCountCampaigns(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ campaigns, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to list campaigns",
    })
  }
}

/**
 * POST /admin/call-center/campaigns
 *
 * Create a campaign (always in `draft`). `name` and `playbook_id` are required;
 * everything else is optional pacing / targeting config.
 * Body: { name, playbook_id, audience_filter?, schedule?, cadence?,
 *         concurrency?, daily_cap?, from_number? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body ?? {}) as {
    name?: string
    playbook_id?: string
    audience_filter?: any
    schedule?: any
    cadence?: any
    concurrency?: number
    daily_cap?: number
    from_number?: string
  }

  try {
    const name = body.name?.trim()
    const playbook_id = body.playbook_id?.trim()

    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A campaign `name` is required."
      )
    }
    if (!playbook_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A `playbook_id` is required to create a campaign."
      )
    }

    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const created = await cc.createCampaigns({
      tenant_id: TENANT_ID,
      name,
      playbook_id,
      status: "draft",
      audience_filter: body.audience_filter ?? null,
      schedule: body.schedule ?? null,
      cadence: body.cadence ?? null,
      concurrency: body.concurrency ?? 5,
      daily_cap: body.daily_cap ?? null,
      from_number: body.from_number ?? null,
    })

    const campaign = Array.isArray(created) ? created[0] : created

    res.status(201).json({ campaign })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res.status(status).json({
      message: e?.message ?? "Failed to create campaign",
    })
  }
}
