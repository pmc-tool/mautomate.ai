import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import {
  getAutopilotSettings,
  setAdsSetting,
} from "../../../../modules/marketing/ads"
import { resolveMerchant } from "../../_helpers"
import { adsStatusFor } from "../_helpers"

const ruleDto = (r: any) => ({
  id: r.id,
  name: r.name,
  enabled: Boolean(r.enabled),
  campaign_id: r.campaign_id ?? null,
  metric: r.metric,
  op: r.op,
  value: Number(r.value),
  window_days: Number(r.window_days),
  min_spend: Number(r.min_spend),
  action: r.action,
  cooldown_hours: Number(r.cooldown_hours),
  last_fired_at: r.last_fired_at,
})

/**
 * GET /merchant/ads/autopilot — settings, rules, and the recent autopilot
 * activity (what it did and why, straight from the audit log).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const [settings, rules, activity] = await Promise.all([
      getAutopilotSettings(mk, ctx.tenant.id),
      mk.listAdsRules(
        { tenant_id: ctx.tenant.id },
        { take: 100, order: { created_at: "DESC" } }
      ),
      mk.listAdsActionLogs(
        { tenant_id: ctx.tenant.id, actor: "autopilot" },
        { take: 30, order: { created_at: "DESC" } }
      ),
    ])
    res.json({
      settings,
      rules: (rules ?? []).map(ruleDto),
      activity: (activity ?? []).map((l: any) => ({
        id: l.id,
        action: l.action,
        reason: l.reason,
        at: l.created_at,
      })),
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to load autopilot" })
  }
}

/**
 * POST /merchant/ads/autopilot — update settings.
 * Body: { enabled?, monthly_cap? (MAJOR units, null clears) }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    if (b.enabled !== undefined) {
      await setAdsSetting(
        mk,
        ctx.tenant.id,
        "ads_autopilot_enabled",
        b.enabled ? "1" : "0"
      )
    }
    if (b.monthly_cap !== undefined) {
      const cap = b.monthly_cap == null ? null : Number(b.monthly_cap)
      if (cap != null && !(cap > 0)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "The monthly cap must be a positive amount (or empty for no cap)."
        )
      }
      await setAdsSetting(mk, ctx.tenant.id, "ads_monthly_cap", cap)
    }
    res.json({ settings: await getAutopilotSettings(mk, ctx.tenant.id) })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to update autopilot" })
  }
}
