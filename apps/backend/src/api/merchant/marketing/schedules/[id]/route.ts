import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import MarketingModuleService from "../../../../../modules/marketing/service"
import {
  validateAgentPlatforms,
  validateSlots,
  validateTimezone,
} from "../../../../../modules/marketing/agents/playbook"
import { resolveMerchant } from "../../../_helpers"

const isNotFound = (e: any): boolean =>
  e?.type === "not_found" || /was not found|not found/i.test(e?.message ?? "")

/** Load a schedule and assert tenant ownership. Fail-closed: 404 otherwise. */
const loadOwned = async (
  svc: MarketingModuleService,
  id: string,
  tenantId: string,
  res: MedusaResponse
): Promise<any | null> => {
  const schedule = await (svc as any)
    .retrieveMarketingSchedule(id)
    .catch(() => null)
  if (!schedule || schedule.tenant_id !== tenantId) {
    res.status(404).json({ message: `Schedule ${id} was not found` })
    return null
  }
  return schedule
}

/**
 * GET /merchant/marketing/schedules/:id
 * Tenant-scoped. Response: { schedule }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const schedule = await loadOwned(svc, req.params.id, ctx.tenant.id, res)
    if (!schedule) return
    res.json({ schedule })
  } catch (e: any) {
    res
      .status(isNotFound(e) ? 404 : 500)
      .json({ message: e?.message ?? "Failed to retrieve schedule" })
  }
}

/**
 * PUT /merchant/marketing/schedules/:id
 *
 * Update a schedule (tenant-scoped). Only provided fields change.
 * Body: { name?, timezone?, slots?, platform_filter?, active? }
 * Response: { schedule }
 */
export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params
  const b = (req.body ?? {}) as Record<string, any>

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const current = await loadOwned(svc, id, ctx.tenant.id, res)
    if (!current) return

    const data: Record<string, any> = {}
    if (b.name !== undefined) {
      const name = String(b.name).trim()
      if (!name) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "`name` cannot be empty."
        )
      }
      data.name = name
    }
    if (b.timezone !== undefined) {
      data.timezone = validateTimezone(b.timezone)
    }
    if (b.slots !== undefined) {
      data.slots = validateSlots(b.slots)
    }
    if (b.platform_filter !== undefined) {
      data.platform_filter =
        b.platform_filter === null
          ? null
          : validateAgentPlatforms(b.platform_filter, "platform_filter")
    }
    if (b.active !== undefined) {
      data.active = b.active === true
    }

    const updated = await (svc as any).updateMarketingSchedules({ id, ...data })
    const schedule = Array.isArray(updated) ? updated[0] : updated

    res.json({ schedule })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res
      .status(isNotFound(e) ? 404 : status)
      .json({ message: e?.message ?? "Failed to update schedule" })
  }
}

/**
 * DELETE /merchant/marketing/schedules/:id
 * Tenant-scoped. Response: { id, object, deleted }
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const { id } = req.params

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const current = await loadOwned(svc, id, ctx.tenant.id, res)
    if (!current) return

    await (svc as any).deleteMarketingSchedules(id)

    res.json({ id, object: "marketing_schedule", deleted: true })
  } catch (e: any) {
    res
      .status(isNotFound(e) ? 404 : 500)
      .json({ message: e?.message ?? "Failed to delete schedule" })
  }
}
