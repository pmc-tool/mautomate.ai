import { resolveTenantId } from "../../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SettingsService } from "../../../../../modules/marketing/settings/settings-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Durable setting keys backing the recovery config panel. */
const KEY_ENABLED = "automation_abandoned_cart"
const KEY_IDLE = "recovery_idle_minutes"
const KEY_STEP = "recovery_step_hours"
const KEY_DISCOUNT = "recovery_discount_pct"

/** Defaults when a key has never been written. */
const DEFAULT_IDLE = 60
const DEFAULT_STEP = 24
const DEFAULT_DISCOUNT = 10

type Config = {
  enabled: boolean
  idle_minutes: number
  step_hours: number
  discount_pct: number
}

const clampInt = (value: unknown, min: number, max: number): number | null => {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) {
    return null
  }
  return Math.min(Math.max(n, min), max)
}

const readConfig = async (settings: SettingsService): Promise<Config> => ({
  enabled:
    (await settings.get<boolean>(TENANT_ID, KEY_ENABLED, false)) === true,
  idle_minutes: Number(
    (await settings.get<number>(TENANT_ID, KEY_IDLE, DEFAULT_IDLE)) ??
      DEFAULT_IDLE
  ),
  step_hours: Number(
    (await settings.get<number>(TENANT_ID, KEY_STEP, DEFAULT_STEP)) ??
      DEFAULT_STEP
  ),
  discount_pct: Number(
    (await settings.get<number>(TENANT_ID, KEY_DISCOUNT, DEFAULT_DISCOUNT)) ??
      DEFAULT_DISCOUNT
  ),
})

/**
 * GET /admin/marketing/recovery/config
 *
 * Read the abandoned-cart recovery configuration.
 * Response: { enabled, idle_minutes, step_hours, discount_pct }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const settings = new SettingsService(req.scope)
    res.json(await readConfig(settings))
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load recovery config.",
    })
  }
}

/**
 * POST /admin/marketing/recovery/config
 *
 * Body: { enabled?, idle_minutes?, step_hours?, discount_pct? }. Persist each
 * provided key via SettingsService, then return the updated config.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const b = (req.body ?? {}) as Record<string, any>
    const settings = new SettingsService(req.scope)

    if (typeof b.enabled === "boolean") {
      await settings.set(TENANT_ID, KEY_ENABLED, b.enabled)
    }
    if (b.idle_minutes !== undefined) {
      const v = clampInt(b.idle_minutes, 1, 100000)
      if (v !== null) {
        await settings.set(TENANT_ID, KEY_IDLE, v)
      }
    }
    if (b.step_hours !== undefined) {
      const v = clampInt(b.step_hours, 1, 10000)
      if (v !== null) {
        await settings.set(TENANT_ID, KEY_STEP, v)
      }
    }
    if (b.discount_pct !== undefined) {
      const v = clampInt(b.discount_pct, 0, 100)
      if (v !== null) {
        await settings.set(TENANT_ID, KEY_DISCOUNT, v)
      }
    }

    res.json(await readConfig(settings))
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to update recovery config.",
    })
  }
}
