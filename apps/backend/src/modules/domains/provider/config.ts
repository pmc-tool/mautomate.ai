import { resolveTenantId } from "../../../lib/tenant-context"
/**
 * ResellerClub HTTP API config, sourced entirely from env so the integration is
 * dormant until credentials are provided.
 *
 *   RESELLERCLUB_AUTH_USERID   the reseller id (auth-userid)
 *   RESELLERCLUB_API_KEY       the reseller API key
 *   RESELLERCLUB_TEST_MODE     "1" → test API (test.httpapi.com), else live
 *   RESELLERCLUB_DEFAULT_NS    comma-separated default nameservers
 *   DOMAINS_DEFAULT_TENANT     default tenant id (single-tenant run)
 */

export type ResellerConfig = {
  authUserId: string
  apiKey: string
  baseUrl: string
  testMode: boolean
  defaultNameservers: string[]
}

export const isResellerConfigured = (): boolean =>
  !!process.env.RESELLERCLUB_AUTH_USERID && !!process.env.RESELLERCLUB_API_KEY

export const getResellerConfig = (): ResellerConfig => {
  const testMode = process.env.RESELLERCLUB_TEST_MODE === "1"
  return {
    authUserId: process.env.RESELLERCLUB_AUTH_USERID ?? "",
    apiKey: process.env.RESELLERCLUB_API_KEY ?? "",
    baseUrl: testMode
      ? "https://test.httpapi.com/api"
      : "https://httpapi.com/api",
    testMode,
    defaultNameservers: (
      process.env.RESELLERCLUB_DEFAULT_NS ??
      "ns1.foreverfinds.shop,ns2.foreverfinds.shop"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

export const DOMAINS_DEFAULT_TENANT =
  resolveTenantId("DOMAINS_DEFAULT_TENANT")
