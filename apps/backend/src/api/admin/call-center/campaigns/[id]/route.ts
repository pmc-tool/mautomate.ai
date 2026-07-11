import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CALL_CENTER_MODULE } from "../../../../../modules/call-center"
import CallCenterModuleService from "../../../../../modules/call-center/service"

const TENANT_ID = resolveTenantId("CALL_CENTER_DEFAULT_TENANT")

/**
 * Allowed campaign status transitions. Forward path is
 * draft -> scheduled -> running -> paused; paused can resume to running, and a
 * running/paused campaign can complete or cancel. Terminal states have no exits.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "canceled"],
  scheduled: ["running", "paused", "canceled"],
  running: ["paused", "completed", "canceled"],
  paused: ["running", "completed", "canceled"],
  completed: [],
  canceled: [],
}

/**
 * GET /admin/call-center/campaigns/:id
 *
 * Retrieve a single campaign, tenant-scoped.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const campaign = await cc.retrieveCampaign(id)

    if (
      (campaign as any)?.tenant_id &&
      (campaign as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Campaign ${id} was not found` })
      return
    }

    res.json({ campaign })
  } catch (e: any) {
    const notFound =
      e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")
    res.status(notFound ? 404 : 500).json({
      message: e?.message ?? "Failed to retrieve campaign",
    })
  }
}

/**
 * POST /admin/call-center/campaigns/:id
 *
 * Update a campaign. When `status` changes, the transition is validated against
 * ALLOWED_TRANSITIONS. Other editable fields (name, pacing, targeting) may be
 * updated in the same call.
 * Body: { status?, name?, audience_filter?, schedule?, cadence?,
 *         concurrency?, daily_cap?, from_number? }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const body = (req.body ?? {}) as {
    status?: string
    name?: string
    audience_filter?: any
    schedule?: any
    cadence?: any
    concurrency?: number
    daily_cap?: number
    from_number?: string
  }

  try {
    const cc: CallCenterModuleService = req.scope.resolve(CALL_CENTER_MODULE)

    const current = await cc.retrieveCampaign(id)

    if (
      (current as any)?.tenant_id &&
      (current as any).tenant_id !== TENANT_ID
    ) {
      res.status(404).json({ message: `Campaign ${id} was not found` })
      return
    }

    const data: Record<string, any> = {}

    if (body.status !== undefined) {
      const from = (current as any).status as string
      const to = body.status
      const allowed = ALLOWED_TRANSITIONS[from] ?? []
      if (from !== to && !allowed.includes(to)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid status transition: "${from}" -> "${to}". Allowed: ${
            allowed.length ? allowed.join(", ") : "(none, terminal state)"
          }`
        )
      }
      data.status = to
    }

    if (body.name !== undefined) {
      data.name = body.name
    }
    if (body.audience_filter !== undefined) {
      data.audience_filter = body.audience_filter
    }
    if (body.schedule !== undefined) {
      data.schedule = body.schedule
    }
    if (body.cadence !== undefined) {
      data.cadence = body.cadence
    }
    if (body.concurrency !== undefined) {
      data.concurrency = body.concurrency
    }
    if (body.daily_cap !== undefined) {
      data.daily_cap = body.daily_cap
    }
    if (body.from_number !== undefined) {
      data.from_number = body.from_number
    }

    const updated = await cc.updateCampaigns({ id, ...data })
    const campaign = Array.isArray(updated) ? updated[0] : updated

    res.json({ campaign })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    const notFound =
      e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")
    res.status(notFound ? 404 : status).json({
      message: e?.message ?? "Failed to update campaign",
    })
  }
}
