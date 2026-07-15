import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"
import { stringify as qsStringify } from "qs"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

// Server-side only (build-time SSG + SSR): when set, route backend calls over
// an internal/loopback host (e.g. http://127.0.0.1:9400) instead of the public
// domain. This var is NOT prefixed with NEXT_PUBLIC_, so it is never inlined
// into the browser bundle — clients still use NEXT_PUBLIC_MEDUSA_BACKEND_URL.
// Avoids the chicken-and-egg where a build fetches a domain whose DNS isn't
// live yet, and skips a needless round-trip through the CDN for SSR.
if (typeof window === "undefined" && process.env.MEDUSA_BACKEND_URL_INTERNAL) {
  MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL_INTERNAL
}

// Multi-tenant mode: the publishable key is NOT baked into the client — it is
// resolved per request (from a middleware-injected header on the server, or a
// cookie on the client) in the fetch wrapper below. Single-tenant mode keeps the
// historical build-time key, so nothing changes for Forever Finds.
const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: MULTI_TENANT
    ? undefined
    : process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

/* ------------------------------------------------------------------ *
 * API-route fallback for tenant resolution.
 *
 * The middleware injects x-tenant-pak / x-tenant-backend / x-tenant-region-id
 * on every PAGE request — but its matcher EXCLUDES /api/*. So a route handler
 * (the visual-editor bridges, /api/shipping-countries, …) saw none of those
 * headers, every store query ran key-less, and e.g. the editor canvas showed
 * zero products while the live page showed plenty. When a header is missing
 * server-side, resolve the tenant from the request's own Host against the
 * SAME control-plane /tenant-config the middleware uses (cached, 60s).
 * ------------------------------------------------------------------ */
type HostTenantCfg = {
  publishable_key?: string | null
  backend_url?: string | null
  region_id?: string | null
}
const hostCfgCache = new Map<
  string,
  { cfg: HostTenantCfg | null; ts: number }
>()
const HOST_CFG_TTL_MS = 60_000

async function tenantCfgByHost(): Promise<HostTenantCfg | null> {
  try {
    const { headers: nextHeaders } = await import("next/headers")
    const h = await nextHeaders()
    // Behind the edge proxy the Host header is rewritten to the internal
    // listener (127.0.0.1:8601); the tenant's real domain travels in
    // x-forwarded-host. Prefer it.
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
      .split(",")[0]
      .trim()
      .split(":")[0]
      .toLowerCase()
    if (!host || host === "127.0.0.1" || host === "localhost") return null
    const hit = hostCfgCache.get(host)
    if (hit && Date.now() - hit.ts < HOST_CFG_TTL_MS) return hit.cfg
    const base =
      process.env.TENANT_CONFIG_URL || `${MEDUSA_BACKEND_URL}/tenant-config`
    const res = await fetch(`${base}?host=${encodeURIComponent(host)}`, {
      cache: "no-store",
    })
    const d = res.ok ? await res.json().catch(() => null) : null
    const cfg: HostTenantCfg | null =
      d?.publishable_key || d?.backend_url ? (d as HostTenantCfg) : null
    hostCfgCache.set(host, { cfg, ts: Date.now() })
    return cfg
  } catch {
    return null
  }
}

/** Resolve the current request's publishable key (multi-tenant only). */
async function resolveTenantPublishableKey(): Promise<string | undefined> {
  if (!MULTI_TENANT) return undefined
  if (typeof window === "undefined") {
    try {
      const { headers: nextHeaders } = await import("next/headers")
      const fromMw = (await nextHeaders()).get("x-tenant-pak")
      if (fromMw) return fromMw
      return (await tenantCfgByHost())?.publishable_key ?? undefined
    } catch {
      return undefined
    }
  }
  const m = document.cookie.match(/(?:^|; )_tenant_pak=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

/**
 * Resolve the current request's DEDICATED-instance backend (instance-per-tenant).
 * When set, this tenant runs its own Medusa; the request must hit THAT backend
 * instead of the shared/default one.
 */
export async function resolveTenantBackend(): Promise<string | undefined> {
  if (!MULTI_TENANT) return undefined
  if (typeof window === "undefined") {
    try {
      const { headers: nextHeaders } = await import("next/headers")
      const fromMw = (await nextHeaders()).get("x-tenant-backend")
      if (fromMw) return fromMw
      return (await tenantCfgByHost())?.backend_url ?? undefined
    } catch {
      return undefined
    }
  }
  const m = document.cookie.match(/(?:^|; )_tenant_backend=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

/**
 * Resolve the current request's tenant region id (multi-tenant only). This is
 * the region that carries the tenant's currency (from the control-plane
 * /tenant-config, forwarded by middleware as x-tenant-region-id / _tenant_region
 * cookie). The storefront resolves THIS region directly so the displayed
 * currency is always the tenant's own — never another pooled tenant's region
 * that happens to share a country code. Undefined => fall back to the
 * country-code region lookup (single-tenant / legacy behavior).
 */
export async function resolveTenantRegionId(): Promise<string | undefined> {
  if (!MULTI_TENANT) return undefined
  if (typeof window === "undefined") {
    try {
      const { headers: nextHeaders } = await import("next/headers")
      const fromMw = (await nextHeaders()).get("x-tenant-region-id")
      if (fromMw) return fromMw
      return (await tenantCfgByHost())?.region_id ?? undefined
    } catch {
      return undefined
    }
  }
  const m = document.cookie.match(/(?:^|; )_tenant_region=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = (init?.headers ?? {}) as Record<string, string | null>
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
  } catch {}

  // Inject the per-request tenant key (the SDK carries none in multi-tenant mode).
  if (MULTI_TENANT && !headers["x-publishable-api-key"]) {
    const pak = await resolveTenantPublishableKey()
    if (pak) headers["x-publishable-api-key"] = pak
  }

  const newHeaders = {
    ...localeHeader,
    ...headers,
  }
  init = {
    ...init,
    headers: newHeaders,
  }

  // Dedicated-instance tenant: the SDK's baseUrl is fixed, so route this request
  // directly to the store's OWN Medusa backend. Mirrors the SDK's URL/query/JSON
  // handling. Pooled/single-tenant requests fall through to the normal client.
  if (MULTI_TENANT && (typeof input === "string" || input instanceof URL)) {
    const backend = await resolveTenantBackend()
    if (backend) {
      const base = new URL(backend)
      const path = input.toString().replace(/^\//, "")
      const url = new URL(
        `${base.pathname.replace(/\/$/, "")}/${path}`,
        base.origin
      )
      if ((init as any)?.query) {
        const merged = {
          ...Object.fromEntries(url.searchParams.entries()),
          ...((init as any).query as Record<string, unknown>),
        }
        url.search = qsStringify(merged, { skipNulls: true })
      }
      const method = ((init?.method as string) ?? "GET").toUpperCase()
      const hdrs: Record<string, string> = {}
      for (const [k, v] of Object.entries(newHeaders)) {
        if (v != null) hdrs[k] = String(v)
      }
      let body: any = (init as any)?.body
      if (body && typeof body === "object" && !(body instanceof FormData)) {
        body = JSON.stringify(body)
        hdrs["content-type"] = hdrs["content-type"] ?? "application/json"
      }
      const resp = await fetch(url.toString(), {
        method,
        headers: hdrs,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        credentials: (init as any)?.credentials,
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => "")
        throw Object.assign(new Error(t || `Request failed (${resp.status})`), {
          status: resp.status,
        })
      }
      const ct = resp.headers.get("content-type") || ""
      return (ct.includes("application/json") ? await resp.json() : await resp.text()) as T
    }
  }

  return originalFetch(input, init)
}
