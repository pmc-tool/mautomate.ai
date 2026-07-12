import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import MarketingModuleService from "../../../../modules/marketing/service"
import {
  validateAgentPlatforms,
  validateSlots,
  validateTimezone,
} from "../../../../modules/marketing/agents/playbook"
import { resolveMerchant } from "../../_helpers"

/**
 * Merchant posting schedules (marketing_schedule) — the reusable cadence an
 * autonomous agent runs on (referenced by `playbook.schedule_id`).
 *
 * SLOTS SHAPE (json column):
 *   [{ "day": "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"|"daily",
 *      "time": "HH:MM",              // 24h wall clock in `timezone`
 *      "platforms": string[]? }]     // optional per-slot narrowing
 *
 * `timezone` is an IANA zone ("Europe/London"); slot times are interpreted as
 * local wall-clock in it, DST included. `platform_filter` (string[] | null)
 * narrows which of an agent's platforms this schedule posts to.
 *
 * CAPABILITY GATE: platforms whose publish adapter requires media (instagram)
 * are rejected — agent posts are text-only and could never publish there.
 */

/**
 * GET /merchant/marketing/schedules
 * Query: active, limit, offset. Response: { schedules, count, limit, offset }
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  try {
    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
    const limit = parseInt((req.query.limit as string) ?? "50")
    const offset = parseInt((req.query.offset as string) ?? "0")

    const filters: Record<string, any> = { tenant_id: ctx.tenant.id }
    if (req.query.active !== undefined) {
      filters.active = req.query.active === "true" || req.query.active === "1"
    }

    const [schedules, count] = await svc.listAndCountMarketingSchedules(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )

    res.json({ schedules, count, limit, offset })
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "Failed to list schedules" })
  }
}

/**
 * POST /merchant/marketing/schedules
 *
 * Create a posting schedule. Body:
 *   { name, timezone?, slots, platform_filter?, active? }
 * Response: { schedule }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>

  try {
    const name = typeof b.name === "string" ? b.name.trim() : ""
    if (!name) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A schedule requires a `name`."
      )
    }

    const timezone = validateTimezone(b.timezone)
    const slots = validateSlots(b.slots)
    const platform_filter =
      b.platform_filter === undefined || b.platform_filter === null
        ? null
        : validateAgentPlatforms(b.platform_filter, "platform_filter")

    const svc: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)

    const created = await svc.createMarketingSchedules({
      tenant_id: ctx.tenant.id,
      name,
      timezone,
      slots,
      platform_filter,
      active: b.active === undefined ? true : b.active === true,
    } as any)

    const schedule = Array.isArray(created) ? created[0] : created

    res.status(201).json({ schedule })
  } catch (e: any) {
    const status = e?.type === MedusaError.Types.INVALID_DATA ? 400 : 500
    res
      .status(status)
      .json({ message: e?.message ?? "Failed to create schedule" })
  }
}
