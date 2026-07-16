import crypto from "crypto"
import {
  AdsCredentials,
  AdsProvider,
  CreatedCampaign,
  ExternalAdAccount,
  ExternalCampaign,
  ExternalInsightRow,
  ExternalPage,
  InsightsQuery,
  UnifiedCampaignSpec,
} from "../types"

/**
 * Mock ads adapter — development/demo only. Registered ONLY when
 * MARKETING_ADS_MOCK=1 (see ads/index.ts), so production merchants can never
 * connect a fake platform or see fabricated numbers. The data is deterministic
 * (seeded by date string) so repeated syncs are stable and upserts exercisable.
 */

const dayseed = (date: string, salt: number): number => {
  let h = salt
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 100000
  return h
}

const eachDay = (since: string, until: string): string[] => {
  const out: string[] = []
  const d = new Date(`${since}T00:00:00Z`)
  const end = new Date(`${until}T00:00:00Z`)
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

const CAMPAIGNS: ExternalCampaign[] = [
  {
    external_id: "mock-cmp-1",
    name: "Demo: Summer sale traffic",
    objective: "OUTCOME_TRAFFIC",
    status: "active",
    external_status: "ACTIVE",
    daily_budget: 10,
    lifetime_budget: null,
    currency: "USD",
    start_at: null,
    end_at: null,
  },
  {
    external_id: "mock-cmp-2",
    name: "Demo: Bestseller catalog sales",
    objective: "OUTCOME_SALES",
    status: "paused",
    external_status: "PAUSED",
    daily_budget: 25,
    lifetime_budget: null,
    currency: "USD",
    start_at: null,
    end_at: null,
  },
]

export const mockAdsProvider: AdsProvider = {
  platform: "mock",
  capabilities: { connect: "direct", label: "Demo platform" },

  isConfigured(): boolean {
    return process.env.MARKETING_ADS_MOCK === "1"
  },

  async listAdAccounts(_creds: AdsCredentials): Promise<ExternalAdAccount[]> {
    return [
      {
        external_id: "mock-act-1",
        name: "Demo ad account",
        currency: "USD",
        timezone: "UTC",
        status: "active",
      },
    ]
  },

  async listCampaigns(
    _creds: AdsCredentials,
    _externalAccountId: string
  ): Promise<ExternalCampaign[]> {
    return CAMPAIGNS
  },

  async listPages(_creds: AdsCredentials): Promise<ExternalPage[]> {
    return [{ id: "mock-page-1", name: "Demo store page" }]
  },

  async createCampaign(
    _creds: AdsCredentials,
    _externalAccountId: string,
    spec: UnifiedCampaignSpec
  ): Promise<CreatedCampaign> {
    // Real platforms mint a UNIQUE id per create (two campaigns may share a
    // name) — the demo must behave the same, so the id carries a random
    // suffix. A name-derived id collides on the second same-named campaign.
    const slug = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)
    const uniq = crypto.randomBytes(4).toString("hex")
    return {
      campaign_external_id: `mock-panel-${slug}-${uniq}`,
      adset_external_id: `mock-panel-${slug}-${uniq}-set`,
      creative_external_id: `mock-panel-${slug}-${uniq}-cr`,
      ad_external_id: `mock-panel-${slug}-${uniq}-ad`,
      external_status: "PAUSED",
    }
  },

  async setCampaignStatus(
    _creds: AdsCredentials,
    _campaignExternalId: string,
    _status: "active" | "paused"
  ): Promise<void> {
    /* the local mirror is the record for the demo platform */
  },

  async setCampaignBudget(
    _creds: AdsCredentials,
    _ids: { campaign_external_id: string; adset_external_id: string | null },
    _dailyBudget: number
  ): Promise<void> {
    /* the local mirror is the record for the demo platform */
  },

  async getInsights(
    _creds: AdsCredentials,
    _externalAccountId: string,
    query: InsightsQuery
  ): Promise<ExternalInsightRow[]> {
    const rows: ExternalInsightRow[] = []
    for (const date of eachDay(query.since, query.until)) {
      for (const [i, cmp] of CAMPAIGNS.entries()) {
        if (cmp.status !== "active" && dayseed(date, i) % 3 !== 0) continue
        const seed = dayseed(date, i + 7)
        const impressions = 400 + (seed % 900)
        const clicks = 8 + (seed % 30)
        const spend = Math.round((3 + (seed % 70) / 10) * 100) / 100
        const conversions = seed % 4
        rows.push({
          level: "campaign",
          external_id: cmp.external_id,
          date,
          currency: "USD",
          spend,
          impressions,
          clicks,
          ctr: Math.round((clicks / impressions) * 10000) / 100,
          conversions,
          conversion_value: conversions * (20 + (seed % 15)),
        })
      }
    }
    return rows
  },
}
