import type { MedusaContainer } from "@medusajs/framework/types"
import { setCampaignStatus } from "./launch"
import { meterAction } from "../../platform/integration/metering-guard"

/**
 * Autopilot — the automated media buyer, with the panel's guardrails baked in:
 *
 *  - It can PAUSE and it can ALERT. It cannot raise budgets, cannot create,
 *    cannot delete. The destructive direction is not implemented on purpose.
 *  - THE HARD CAP: when a store's month-to-date spend crosses the merchant's
 *    monthly cap, every active campaign is paused — the one action that runs
 *    even before any rule.
 *  - Every decision lands in ads_action_log with actor "autopilot" and the
 *    actual numbers that triggered it — the campaign timeline shows it.
 *  - It judges only stored ads_insight rows (what the platform actually
 *    reported); a campaign below a rule's `min_spend` is not judged at all.
 *
 * Settings live in marketing_setting: ads_autopilot_enabled ("1"/"0"),
 * ads_monthly_cap (number, MAJOR units), ads_autopilot_last_charged
 * (YYYY-MM-DD — the 3cr/day charge is idempotent per day and skipped for
 * manual "run now" checks).
 */

const first = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const today = (): string => new Date().toISOString().slice(0, 10)

const getSetting = async (mk: any, tenantId: string, key: string): Promise<any> => {
  const row = first(await mk.listMarketingSettings({ tenant_id: tenantId, key }))
  return row?.value ?? null
}

export const setSetting = async (
  mk: any,
  tenantId: string,
  key: string,
  value: any
): Promise<void> => {
  const row = first(await mk.listMarketingSettings({ tenant_id: tenantId, key }))
  if (row?.id) {
    await mk.updateMarketingSettings({ id: row.id, value } as any)
  } else {
    await mk.createMarketingSettings({ tenant_id: tenantId, key, value } as any)
  }
}

export type AutopilotSettings = {
  enabled: boolean
  monthly_cap: number | null
}

export const getAutopilotSettings = async (
  mk: any,
  tenantId: string
): Promise<AutopilotSettings> => {
  const [enabled, cap] = await Promise.all([
    getSetting(mk, tenantId, "ads_autopilot_enabled"),
    getSetting(mk, tenantId, "ads_monthly_cap"),
  ])
  return {
    enabled: enabled === "1" || enabled === 1 || enabled === true,
    monthly_cap: Number(cap) > 0 ? Number(cap) : null,
  }
}

type CampaignAgg = {
  campaign: any
  spend: number
  clicks: number
  impressions: number
  conversions: number
  cpa: number | null
  ctr: number | null
}

const aggregate = async (
  mk: any,
  tenantId: string,
  campaign: any,
  windowDays: number
): Promise<CampaignAgg> => {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - Math.max(1, Math.round(windowDays)))
  const rows = campaign.external_id
    ? await mk.listAdsInsights(
        {
          tenant_id: tenantId,
          level: "campaign",
          external_id: campaign.external_id,
          date: { $gte: since },
        },
        { take: 400 }
      )
    : []
  let spend = 0, clicks = 0, impressions = 0, conversions = 0
  for (const r of rows ?? []) {
    spend += Number(r.spend) || 0
    clicks += Number(r.clicks) || 0
    impressions += Number(r.impressions) || 0
    conversions += Number(r.conversions) || 0
  }
  return {
    campaign,
    spend,
    clicks,
    impressions,
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
  }
}

/** Month-to-date spend across the whole tenant. */
export const monthSpend = async (mk: any, tenantId: string): Promise<number> => {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const rows = await mk.listAdsInsights(
    { tenant_id: tenantId, date: { $gte: monthStart } },
    { take: 20000 }
  )
  return (rows ?? []).reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0)
}

/** Did this exact autopilot event already log today? (dedupes cap alerts) */
const loggedToday = async (
  mk: any,
  tenantId: string,
  action: string
): Promise<boolean> => {
  const dayStart = new Date(`${today()}T00:00:00Z`)
  const rows = await mk.listAdsActionLogs(
    { tenant_id: tenantId, action, created_at: { $gte: dayStart } },
    { take: 1 }
  )
  return (rows ?? []).length > 0
}

export type AutopilotRunSummary = {
  enabled: boolean
  checked: number
  fired: { rule: string; campaign: string; action: string; reason: string }[]
  cap_hit: boolean
  month_spend: number
  charged: boolean
}

/**
 * One autopilot pass for one tenant. `manual` runs are free and work even
 * while the global schedule is off — they are how the merchant (and the demo)
 * exercises autopilot on demand.
 */
export const runAutopilotForTenant = async (
  mk: any,
  container: MedusaContainer,
  tenantId: string,
  opts: { manual?: boolean } = {}
): Promise<AutopilotRunSummary> => {
  const settings = await getAutopilotSettings(mk, tenantId)
  const summary: AutopilotRunSummary = {
    enabled: settings.enabled,
    checked: 0,
    fired: [],
    cap_hit: false,
    month_spend: 0,
    charged: false,
  }
  if (!settings.enabled) return summary

  // Daily metering (scheduled runs only): 3cr per active autopilot day.
  if (!opts.manual) {
    const lastCharged = await getSetting(mk, tenantId, "ads_autopilot_last_charged")
    if (lastCharged !== today()) {
      const metered = await meterAction(
        container,
        tenantId,
        "ads_autopilot_day",
        1,
        async () => ({ result: true, actualUnits: 1 })
      )
      if (!metered.ok) {
        // Out of credits: autopilot does NOT silently keep working for free —
        // log it once and stand down for the day.
        if (!(await loggedToday(mk, tenantId, "autopilot.unpaid"))) {
          await mk.createAdsActionLogs({
            tenant_id: tenantId,
            actor: "autopilot",
            action: "autopilot.unpaid",
            level: "tenant",
            reason:
              "Autopilot is enabled but the credit wallet could not cover today's 3-credit charge — no checks ran. Top up in Billing.",
          } as any)
        }
        return summary
      }
      await setSetting(mk, tenantId, "ads_autopilot_last_charged", today())
      summary.charged = true
    }
  }

  const activeCampaigns = await mk.listAdsCampaigns(
    { tenant_id: tenantId, status: "active" },
    { take: 200 }
  )

  // ---- THE HARD CAP: before any rule, month spend vs the merchant's cap.
  summary.month_spend = await monthSpend(mk, tenantId)
  if (
    settings.monthly_cap != null &&
    summary.month_spend >= settings.monthly_cap
  ) {
    summary.cap_hit = true
    for (const campaign of activeCampaigns ?? []) {
      try {
        await setCampaignStatus(
          mk,
          tenantId,
          campaign.id,
          "paused",
          "autopilot",
          `Monthly cap reached: ${summary.month_spend.toFixed(2)} spent of the ${settings.monthly_cap} cap — "${campaign.name}" paused`
        )
        summary.fired.push({
          rule: "monthly_cap",
          campaign: campaign.name,
          action: "pause_campaign",
          reason: "monthly cap reached",
        })
      } catch {
        /* per-campaign failure must not stop the sweep */
      }
    }
    if (!(await loggedToday(mk, tenantId, "autopilot.cap_hit"))) {
      await mk.createAdsActionLogs({
        tenant_id: tenantId,
        actor: "autopilot",
        action: "autopilot.cap_hit",
        level: "tenant",
        reason: `Monthly spend cap reached (${summary.month_spend.toFixed(2)} / ${settings.monthly_cap}) — all active campaigns paused. Raise the cap on the Autopilot page to resume.`,
      } as any)
    }
    return summary
  }

  // ---- Rules.
  const rules = await mk.listAdsRules(
    { tenant_id: tenantId, enabled: true },
    { take: 100 }
  )
  const now = Date.now()

  for (const rule of rules ?? []) {
    const cooldownMs = (Number(rule.cooldown_hours) || 24) * 3600_000
    if (rule.last_fired_at && now - new Date(rule.last_fired_at).getTime() < cooldownMs) {
      continue
    }
    const targets = rule.campaign_id
      ? (activeCampaigns ?? []).filter((c: any) => c.id === rule.campaign_id)
      : (activeCampaigns ?? [])

    for (const campaign of targets) {
      const agg = await aggregate(mk, tenantId, campaign, rule.window_days)
      summary.checked += 1
      if (agg.spend < Number(rule.min_spend || 0)) continue

      const metricValue =
        rule.metric === "spend" ? agg.spend
        : rule.metric === "clicks" ? agg.clicks
        : rule.metric === "conversions" ? agg.conversions
        : rule.metric === "ctr" ? agg.ctr
        : agg.cpa // cpa

      // A CPA with zero conversions is "worse than any threshold" for gt.
      const effective =
        rule.metric === "cpa" && metricValue == null
          ? Number.POSITIVE_INFINITY
          : metricValue
      if (effective == null) continue

      const hit =
        rule.op === "gt" ? effective > Number(rule.value) : effective < Number(rule.value)
      if (!hit) continue

      const shown =
        effective === Number.POSITIVE_INFINITY
          ? `no purchases on ${agg.spend.toFixed(2)} spend`
          : `${rule.metric}=${Number(effective).toFixed(2)}`
      const reason = `Rule "${rule.name}": ${shown} over ${rule.window_days}d ${
        rule.op === "gt" ? "exceeded" : "fell below"
      } ${rule.value} — ${
        rule.action === "pause_campaign" ? `"${campaign.name}" paused` : `alert on "${campaign.name}"`
      }`

      try {
        if (rule.action === "pause_campaign") {
          await setCampaignStatus(mk, tenantId, campaign.id, "paused", "autopilot", reason)
        } else {
          await mk.createAdsActionLogs({
            tenant_id: tenantId,
            actor: "autopilot",
            action: "autopilot.alert",
            level: "campaign",
            object_id: campaign.id,
            external_id: campaign.external_id,
            reason,
          } as any)
        }
        await mk.updateAdsRules({ id: rule.id, last_fired_at: new Date() } as any)
        summary.fired.push({
          rule: rule.name,
          campaign: campaign.name,
          action: rule.action,
          reason,
        })
      } catch {
        /* per-campaign failure must not stop the sweep */
      }
    }
  }

  return summary
}
