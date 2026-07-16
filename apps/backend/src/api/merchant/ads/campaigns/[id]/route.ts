import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import { resolveMerchant } from "../../../_helpers"
import { adsStatusFor } from "../../_helpers"

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const dayString = (d: Date): string => d.toISOString().slice(0, 10)

/**
 * GET /merchant/ads/campaigns/:id — the campaign detail page payload: the
 * campaign, its ads (creative previews), a 30-day daily metric series with
 * totals, and the action timeline (who did what, when, and why — merchant,
 * AI, or autopilot).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const mk: any = req.scope.resolve(MARKETING_MODULE)
  try {
    const campaign = first(
      await mk.listAdsCampaigns({ id: req.params.id, tenant_id: ctx.tenant.id })
    )
    if (!campaign) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "This campaign was not found."
      )
    }

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 30)

    const [ads, insights, log] = await Promise.all([
      mk.listAdsAds(
        { tenant_id: ctx.tenant.id, campaign_id: campaign.id },
        { take: 50 }
      ),
      campaign.external_id
        ? mk.listAdsInsights(
            {
              tenant_id: ctx.tenant.id,
              level: "campaign",
              external_id: campaign.external_id,
              date: { $gte: since },
            },
            { take: 100 }
          )
        : Promise.resolve([]),
      mk.listAdsActionLogs(
        { tenant_id: ctx.tenant.id, object_id: campaign.id },
        { take: 50, order: { created_at: "DESC" } }
      ),
    ])

    const totals = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversion_value: 0,
      roas: null as number | null,
    }
    const daily = (insights ?? [])
      .map((r: any) => {
        totals.spend += Number(r.spend) || 0
        totals.impressions += Number(r.impressions) || 0
        totals.clicks += Number(r.clicks) || 0
        totals.conversions += Number(r.conversions) || 0
        totals.conversion_value += Number(r.conversion_value) || 0
        return {
          date: dayString(new Date(r.date)),
          spend: Math.round((Number(r.spend) || 0) * 100) / 100,
          clicks: Number(r.clicks) || 0,
          conversions: Number(r.conversions) || 0,
        }
      })
      .sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
    if (totals.spend > 0 && totals.conversion_value > 0) {
      totals.roas =
        Math.round((totals.conversion_value / totals.spend) * 100) / 100
    }
    totals.spend = Math.round(totals.spend * 100) / 100
    totals.conversion_value = Math.round(totals.conversion_value * 100) / 100

    res.json({
      campaign: {
        id: campaign.id,
        external_id: campaign.external_id,
        platform: campaign.platform,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        external_status: campaign.external_status,
        source: campaign.source,
        daily_budget: campaign.daily_budget,
        lifetime_budget: campaign.lifetime_budget,
        currency: campaign.currency,
        spec: campaign.spec ?? null,
        created_at: campaign.created_at,
        last_synced_at: campaign.last_synced_at,
        error: campaign.meta?.error ?? null,
      },
      ads: (ads ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        creative: a.creative ?? null,
      })),
      totals,
      daily,
      timeline: (log ?? []).map((l: any) => ({
        id: l.id,
        actor: l.actor,
        action: l.action,
        reason: l.reason,
        before: l.before ?? null,
        after: l.after ?? null,
        at: l.created_at,
      })),
    })
  } catch (e: any) {
    res
      .status(adsStatusFor(e))
      .json({ message: e?.message ?? "Failed to load the campaign" })
  }
}
