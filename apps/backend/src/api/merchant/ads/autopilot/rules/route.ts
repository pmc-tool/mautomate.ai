import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

/**
 * POST /merchant/ads/autopilot/rules — create a rule.
 * Body: { name, metric, op, value, window_days?, min_spend?, action,
 *         campaign_id?, cooldown_hours? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const b = (req.body ?? {}) as Record<string, any>
  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const bad = (m: string) => {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, m)
    }
    if (!String(b.name ?? "").trim()) bad("The rule needs a name.")
    if (!["spend", "cpa", "ctr", "clicks", "conversions"].includes(b.metric))
      bad("Pick a metric.")
    if (!["gt", "lt"].includes(b.op)) bad("Pick above/below.")
    if (!Number.isFinite(Number(b.value))) bad("The threshold must be a number.")
    if (!["pause_campaign", "notify"].includes(b.action)) bad("Pick an action.")

    const created = await mk.createAdsRules({
      tenant_id: ctx.tenant.id,
      name: String(b.name).trim(),
      enabled: true,
      campaign_id: b.campaign_id ?? null,
      metric: b.metric,
      op: b.op,
      value: Number(b.value),
      window_days: Math.max(1, Math.min(30, Number(b.window_days) || 3)),
      min_spend: Math.max(0, Number(b.min_spend) || 0),
      action: b.action,
      cooldown_hours: Math.max(1, Math.min(168, Number(b.cooldown_hours) || 24)),
    } as any)
    const rule = Array.isArray(created) ? created[0] : created
    res.status(201).json({ rule: { id: rule.id, name: rule.name } })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to create the rule" })
  }
}
