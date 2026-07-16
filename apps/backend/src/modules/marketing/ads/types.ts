/**
 * The Advertising provider contract. One adapter per ad platform (meta now,
 * google/tiktok in later phases, mock for development) — the panel's routes,
 * sync sweep, and (later) campaign wizard speak ONLY this interface, so adding
 * a platform is a new adapter + a registry import, exactly like the organic
 * publish providers.
 *
 * Phase 1 is read-side (list ad accounts, mirror campaigns, pull insights).
 * Write methods arrive with the campaign lifecycle phase; keeping the contract
 * read-only until then means no code path can mutate a merchant's ad spend yet.
 *
 * Adapters are STATELESS: per-connection tokens are decrypted by the caller
 * (ads/connection.ts) and passed in as `AdsCredentials`. Money crossing this
 * boundary is always MAJOR currency units — adapters convert platform
 * minor-unit amounts before returning.
 */

export type AdsPlatform = "meta" | "google" | "tiktok" | "mock"

export type AdsConnectMechanism = "oauth" | "direct"

export type AdsProviderCapabilities = {
  connect: AdsConnectMechanism
  /** Human label for the Connect screen. */
  label: string
}

export type AdsCredentials = {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
  meta?: Record<string, any> | null
}

export type ExternalAdAccount = {
  external_id: string
  name: string | null
  currency: string | null
  timezone: string | null
  status: "active" | "disabled"
  meta?: Record<string, any> | null
}

export type ExternalCampaign = {
  external_id: string
  name: string
  objective: string | null
  /** Normalized lifecycle value: active | paused | archived | draft | error | other */
  status: string
  external_status: string | null
  daily_budget: number | null
  lifetime_budget: number | null
  currency: string | null
  start_at: Date | null
  end_at: Date | null
  meta?: Record<string, any> | null
}

export type ExternalInsightRow = {
  level: "account" | "campaign" | "adset" | "ad"
  external_id: string
  /** Day the row covers, YYYY-MM-DD (platform account timezone). */
  date: string
  currency: string | null
  spend: number
  impressions: number
  clicks: number
  ctr: number | null
  conversions: number
  conversion_value: number
}

export type InsightsQuery = {
  /** Inclusive day bounds, YYYY-MM-DD. */
  since: string
  until: string
}

/** The panel's platform-agnostic campaign description. Adapters translate it
 *  into their native object tree; money is MAJOR units throughout. */
export type UnifiedCampaignSpec = {
  name: string
  goal: "sales" | "traffic" | "awareness"
  daily_budget: number
  currency: string | null
  /** ISO-2 country codes the ads target. */
  countries: string[]
  /** The destination the ad clicks through to. */
  link_url: string
  headline: string
  primary_text: string
  image_url: string | null
  /** Platform page/identity the ad publishes as (Meta: Facebook Page id). */
  page_id: string | null
  /** Pixel/dataset backing conversion optimization (required for `sales`). */
  pixel_external_id: string | null
  start_at: string | null
}

export type CreatedCampaign = {
  campaign_external_id: string
  adset_external_id: string
  creative_external_id: string | null
  ad_external_id: string
  external_status: string
}

export type ExternalPage = { id: string; name: string | null }

export interface AdsProvider {
  platform: AdsPlatform
  capabilities: AdsProviderCapabilities
  /** Whether the platform-level app credentials are present (env/vault). */
  isConfigured(): boolean
  listAdAccounts(creds: AdsCredentials): Promise<ExternalAdAccount[]>
  listCampaigns(
    creds: AdsCredentials,
    externalAccountId: string
  ): Promise<ExternalCampaign[]>
  getInsights(
    creds: AdsCredentials,
    externalAccountId: string,
    query: InsightsQuery
  ): Promise<ExternalInsightRow[]>
  /** Pages/identities ads can publish as (wizard picker). */
  listPages(creds: AdsCredentials): Promise<ExternalPage[]>
  /**
   * Create the full campaign tree from a unified spec. MUST create everything
   * in PAUSED state — going live is always a separate, explicit merchant
   * action (the panel's core safety rule).
   */
  createCampaign(
    creds: AdsCredentials,
    externalAccountId: string,
    spec: UnifiedCampaignSpec
  ): Promise<CreatedCampaign>
  /** Flip a campaign between active and paused. */
  setCampaignStatus(
    creds: AdsCredentials,
    campaignExternalId: string,
    status: "active" | "paused"
  ): Promise<void>
  /** Change the daily budget (MAJOR units); Meta budgets live on the ad set. */
  setCampaignBudget(
    creds: AdsCredentials,
    ids: { campaign_external_id: string; adset_external_id: string | null },
    dailyBudget: number
  ): Promise<void>
}

/** Thrown detail marker for expired/revoked platform tokens so the sync layer
 *  can flip the connection status instead of retrying forever. */
export class AdsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdsAuthError"
  }
}
