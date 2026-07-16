import {
  AdsAuthError,
  AdsCredentials,
  AdsProvider,
  ExternalAdAccount,
  ExternalCampaign,
  ExternalInsightRow,
  InsightsQuery,
} from "../types"

/**
 * Meta (Facebook + Instagram) ads adapter — Marketing API over plain Graph
 * HTTP, read-side for Phase 1: ad accounts, campaign mirror, daily
 * campaign-level insights.
 *
 * Version note: pinned to v25.0 (Feb 2026). Meta expires versions ~2 years
 * out and blocked legacy Advantage+ Shopping creation on ALL versions in May
 * 2026, so campaign WRITES (Phase 3) must target the unified campaign type on
 * v25+ — do not lower this pin.
 *
 * App credentials are the same Meta app as social publishing
 * (MARKETING_FACEBOOK_APP_ID/SECRET, env or vault via ensurePlatformEnv);
 * the ads consent adds the ads_* scopes at connect time.
 *
 * Money: Meta returns budgets in MINOR units (cents) and insight spend in
 * MAJOR units. Budgets are divided by 100 here so everything past this
 * boundary is MAJOR units, per the repo-wide money rule.
 */

const GRAPH = "https://graph.facebook.com/v25.0"
const MAX_PAGES = 10

type GraphErrorBody = {
  error?: { message?: string; code?: number; type?: string }
}

const graphGet = async (path: string, params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString()
  let res: Response
  try {
    res = await fetch(`${GRAPH}${path}?${qs}`)
  } catch (e: any) {
    throw new Error(`Could not reach Meta: ${e?.message ?? "network error"}`)
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = (data as GraphErrorBody)?.error
    // 190 = invalid/expired token; 10/200-299 = permission errors — both mean
    // the CONNECTION is unusable, not that the request was malformed.
    if (err?.code === 190 || err?.type === "OAuthException") {
      throw new AdsAuthError(err?.message ?? "Meta session expired")
    }
    throw new Error(err?.message ?? `Meta request failed (${res.status})`)
  }
  return data
}

/** Follow Graph cursor pagination, bounded. */
const graphGetAll = async (
  path: string,
  params: Record<string, string>
): Promise<any[]> => {
  const rows: any[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await graphGet(path, {
      ...params,
      ...(after ? { after } : {}),
    })
    rows.push(...(Array.isArray(data?.data) ? data.data : []))
    after = data?.paging?.cursors?.after ?? null
    if (!after || !data?.paging?.next) break
  }
  return rows
}

const normalizeStatus = (effective: string | null | undefined): string => {
  const s = (effective ?? "").toUpperCase()
  if (s === "ACTIVE") return "active"
  if (s === "PAUSED" || s === "CAMPAIGN_PAUSED" || s === "ADSET_PAUSED")
    return "paused"
  if (s === "ARCHIVED") return "archived"
  if (s === "DELETED") return "archived"
  if (s === "WITH_ISSUES" || s === "DISAPPROVED") return "error"
  if (s === "IN_PROCESS" || s === "PENDING_REVIEW") return "draft"
  return s ? "other" : "other"
}

const minorToMajor = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n / 100 : null
}

/** Pull purchase conversions out of Meta's polymorphic actions array. */
const purchaseMetric = (
  rows: Array<{ action_type?: string; value?: string }> | undefined
): number => {
  if (!Array.isArray(rows)) return 0
  const wanted = new Set([
    "omni_purchase",
    "purchase",
    "offsite_conversion.fb_pixel_purchase",
  ])
  // omni_purchase already aggregates the channel-specific rows; prefer it and
  // only fall back to summing the specific types when it is absent.
  const omni = rows.find((r) => r.action_type === "omni_purchase")
  if (omni) return Number(omni.value) || 0
  return rows
    .filter((r) => wanted.has(r.action_type ?? ""))
    .reduce((sum, r) => sum + (Number(r.value) || 0), 0)
}

export const metaAdsProvider: AdsProvider = {
  platform: "meta",
  capabilities: { connect: "oauth", label: "Meta (Facebook & Instagram)" },

  isConfigured(): boolean {
    return Boolean(
      process.env.MARKETING_FACEBOOK_APP_ID &&
        process.env.MARKETING_FACEBOOK_APP_SECRET
    )
  },

  async listAdAccounts(creds: AdsCredentials): Promise<ExternalAdAccount[]> {
    const rows = await graphGetAll("/me/adaccounts", {
      fields: "id,account_id,name,currency,timezone_name,account_status",
      limit: "100",
      access_token: creds.accessToken,
    })
    return rows.map((r: any) => ({
      // `id` is already "act_<account_id>" — the form every ads edge expects.
      external_id: String(r.id),
      name: r.name ?? null,
      currency: r.currency ?? null,
      timezone: r.timezone_name ?? null,
      status: Number(r.account_status) === 1 ? "active" : "disabled",
      meta: { account_status: r.account_status ?? null },
    }))
  },

  async listCampaigns(
    creds: AdsCredentials,
    externalAccountId: string
  ): Promise<ExternalCampaign[]> {
    const rows = await graphGetAll(`/${externalAccountId}/campaigns`, {
      fields:
        "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time",
      limit: "100",
      access_token: creds.accessToken,
    })
    return rows.map((r: any) => ({
      external_id: String(r.id),
      name: r.name ?? "(unnamed campaign)",
      objective: r.objective ?? null,
      status: normalizeStatus(r.effective_status ?? r.status),
      external_status: r.effective_status ?? r.status ?? null,
      daily_budget: minorToMajor(r.daily_budget),
      lifetime_budget: minorToMajor(r.lifetime_budget),
      currency: null,
      start_at: r.start_time ? new Date(r.start_time) : null,
      end_at: r.stop_time ? new Date(r.stop_time) : null,
    }))
  },

  async getInsights(
    creds: AdsCredentials,
    externalAccountId: string,
    query: InsightsQuery
  ): Promise<ExternalInsightRow[]> {
    const rows = await graphGetAll(`/${externalAccountId}/insights`, {
      level: "campaign",
      fields:
        "campaign_id,spend,impressions,clicks,ctr,actions,action_values,account_currency,date_start",
      time_increment: "1",
      time_range: JSON.stringify({ since: query.since, until: query.until }),
      limit: "500",
      access_token: creds.accessToken,
    })
    return rows
      .filter((r: any) => r.campaign_id && r.date_start)
      .map((r: any) => ({
        level: "campaign" as const,
        external_id: String(r.campaign_id),
        date: String(r.date_start),
        currency: r.account_currency ?? null,
        spend: Number(r.spend) || 0,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        ctr: r.ctr != null ? Number(r.ctr) : null,
        conversions: purchaseMetric(r.actions),
        conversion_value: purchaseMetric(r.action_values),
      }))
  },
}
