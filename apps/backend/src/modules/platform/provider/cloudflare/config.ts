/**
 * Cloudflare config (env-gated).
 *
 *   CLOUDFLARE_API_TOKEN     scoped token: Zone Write + DNS Write + SSL and
 *                            Certificates Write on all zones in the account
 *                            (zone create requires the account-level resource)
 *   CLOUDFLARE_SAAS_ZONE_ID  the zone that owns the fallback origin (mautomate.ai)
 *   CLOUDFLARE_ACCOUNT_ID    the account customer zones are created under
 *   PLATFORM_TUNNEL_TARGET   the cfargotunnel.com hostname customer zones CNAME to
 *   PLATFORM_FALLBACK_ORIGIN the CNAME target customers point a SUBDOMAIN at
 *   PLATFORM_ROOT_DOMAIN     wildcard root for free subdomains
 *
 * When the token/zone are unset, the client reports not-configured and the
 * routing service degrades gracefully (custom-hostname registration is skipped,
 * free subdomains still work), so the platform stays inert until enabled.
 */
export type CloudflareConfig = {
  apiToken: string
  zoneId: string
  accountId: string
  tunnelTarget: string
  fallbackOrigin: string
  rootDomain: string
  maxHostnames: number
}

export const isCloudflareConfigured = (): boolean =>
  !!process.env.CLOUDFLARE_API_TOKEN && !!process.env.CLOUDFLARE_SAAS_ZONE_ID

export const getCloudflareConfig = (): CloudflareConfig | null => {
  if (!isCloudflareConfigured()) return null
  return {
    apiToken: process.env.CLOUDFLARE_API_TOKEN as string,
    zoneId: process.env.CLOUDFLARE_SAAS_ZONE_ID as string,
    // Zone-per-customer-domain (the nameserver-change flow) needs the account
    // id; empty string means "zone flow unavailable" and connect falls back to
    // the custom-hostname (CNAME) flow.
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    tunnelTarget:
      process.env.PLATFORM_TUNNEL_TARGET ??
      "cd5f4ed0-f26c-4628-86c5-b051b154d3f6.cfargotunnel.com",
    fallbackOrigin:
      process.env.PLATFORM_FALLBACK_ORIGIN ?? "origin.mautomate.ai",
    rootDomain: process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai",
    // Hard cost cap: refuse new custom hostnames past this many so testing
    // never approaches Cloudflare's 100-hostname free tier (per-hostname
    // billing beyond it). Default 25; raise via CF_SAAS_MAX_HOSTNAMES.
    maxHostnames: (() => {
      const n = Number(process.env.CF_SAAS_MAX_HOSTNAMES)
      return Number.isFinite(n) && n >= 0 ? n : 25
    })(),
  }
}
