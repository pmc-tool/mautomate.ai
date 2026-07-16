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
}

/** Thrown detail marker for expired/revoked platform tokens so the sync layer
 *  can flip the connection status instead of retrying forever. */
export class AdsAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdsAuthError"
  }
}
