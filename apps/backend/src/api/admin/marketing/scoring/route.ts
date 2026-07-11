import { resolveTenantId } from "../../../../lib/tenant-context"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SettingsService } from "../../../../modules/marketing/settings/settings-service"

const TENANT_ID = resolveTenantId("MARKETING_DEFAULT_TENANT")

const SCORING_ENABLED_KEY = "scoring_enabled"
const SCORING_POINTS_KEY = "scoring_points"

/** The engagement events whose point values are editable. */
const EVENTS = [
  "email_open",
  "email_click",
  "purchase",
  "page_visit",
  "unsubscribe",
] as const

/** Resolve the effective points map, defaults merged with any override. */
const readPoints = async (
  container: any,
  fallback: Record<string, number>
): Promise<Record<string, number>> => {
  try {
    const scoringService = require("../../../../modules/marketing/scoring/scoring-service")
    const points = await scoringService.getPoints(container, TENANT_ID)
    if (points && typeof points === "object") {
      return points
    }
  } catch {
    // Fall back to the built-in defaults below.
  }
  return { ...fallback }
}

/** Built-in defaults mirrored here so the route stands alone if needed. */
const DEFAULT_POINTS: Record<string, number> = {
  email_open: 1,
  email_click: 3,
  purchase: 10,
  page_visit: 1,
  unsubscribe: -5,
}

/**
 * GET /admin/marketing/scoring
 *
 * Read the scoring configuration: the enable flag + effective points map.
 * Response: { enabled, points }
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const settings = new SettingsService(req.scope)
    const enabled =
      (await settings.get<boolean>(TENANT_ID, SCORING_ENABLED_KEY, false)) ===
      true
    const points = await readPoints(req.scope, DEFAULT_POINTS)

    res.json({ enabled, points })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to load scoring config",
    })
  }
}

/**
 * POST /admin/marketing/scoring
 *
 * Persist the enable flag and/or per-event point values.
 * Body: { enabled?, points? }
 * Response: { enabled, points }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const b = (req.body ?? {}) as {
    enabled?: boolean
    points?: Record<string, unknown>
  }

  try {
    const settings = new SettingsService(req.scope)

    if (typeof b.enabled === "boolean") {
      await settings.set(TENANT_ID, SCORING_ENABLED_KEY, b.enabled)
    }

    if (b.points && typeof b.points === "object") {
      // Sanitize: keep only known events with finite integer values.
      const clean: Record<string, number> = {}
      for (const event of EVENTS) {
        const raw = (b.points as Record<string, unknown>)[event]
        if (raw !== undefined && raw !== null && raw !== "") {
          const n = Math.round(Number(raw))
          if (Number.isFinite(n)) {
            clean[event] = Math.min(Math.max(n, -1000), 1000)
          }
        }
      }
      if (Object.keys(clean).length) {
        await settings.set(TENANT_ID, SCORING_POINTS_KEY, clean)
      }
    }

    const enabled =
      (await settings.get<boolean>(TENANT_ID, SCORING_ENABLED_KEY, false)) ===
      true
    const points = await readPoints(req.scope, DEFAULT_POINTS)

    res.json({ enabled, points })
  } catch (e: any) {
    res.status(500).json({
      message: e?.message ?? "Failed to update scoring config",
    })
  }
}
