/**
 * Cloudflare for SaaS config (env-gated).
 *
 *   CLOUDFLARE_API_TOKEN     scoped token with SSL:Custom Hostnames edit
 *   CLOUDFLARE_SAAS_ZONE_ID  the zone that owns the fallback origin (mautomate.ai)
 *   PLATFORM_FALLBACK_ORIGIN the CNAME target customers point at
 *   PLATFORM_ROOT_DOMAIN     wildcard root for free subdomains
 *
 * When the token/zone are unset, the client reports not-configured and the
 * routing service degrades gracefully (custom-hostname registration is skipped,
 * free subdomains still work), so the platform stays inert until enabled.
 */
export type CloudflareConfig = {
  apiToken: string
  zoneId: string
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
