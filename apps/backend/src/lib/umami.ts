/**
 * Umami analytics client — the ONLY module that talks to the internal Umami
 * service. Merchants never reach Umami directly: our routes call these helpers
 * with a server-side admin token and a website id derived from the AUTHENTICATED
 * tenant, so one merchant can never read another's analytics.
 *
 * Umami is internal-only (UMAMI_URL, default http://127.0.0.1:8770). Auth is a
 * JWT from admin login, cached here and refreshed on expiry / 401.
 */

const UMAMI_URL = (process.env.UMAMI_URL || "http://127.0.0.1:8770").replace(/\/$/, "")
const ADMIN_USER = process.env.UMAMI_ADMIN_USER || "admin"
const ADMIN_PASS = process.env.UMAMI_ADMIN_PASS || ""

let cached: { token: string; exp: number } | null = null

export const umamiConfigured = (): boolean => !!ADMIN_PASS

async function login(force = false): Promise<string> {
  if (!force && cached && cached.exp > Date.now()) return cached.token
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  })
  if (!res.ok) throw new Error(`umami login failed (${res.status})`)
  const j = (await res.json()) as { token: string }
  cached = { token: j.token, exp: Date.now() + 6 * 60 * 60 * 1000 } // 6h
  return j.token
}

async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const call = async (token: string) =>
    fetch(`${UMAMI_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
  let res = await call(await login())
  if (res.status === 401) {
    // token expired mid-flight — refresh once
    res = await call(await login(true))
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`umami ${path} failed (${res.status}) ${t.slice(0, 120)}`)
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// website management
// ---------------------------------------------------------------------------

export async function createWebsite(
  name: string,
  domain: string
): Promise<{ id: string }> {
  return api("/api/websites", { method: "POST", body: { name, domain } })
}

export async function listWebsites(): Promise<any[]> {
  const r = await api<any>("/api/websites")
  return Array.isArray(r) ? r : r?.data ?? []
}

/**
 * Resolve the Umami website id for a tenant, creating it on first use and
 * persisting it on `tenant.meta.umami_website_id`. `svc` is the platform module
 * service. Returns null only if Umami is unreachable (caller degrades).
 */
export async function getOrCreateTenantWebsite(
  svc: any,
  tenant: any
): Promise<string | null> {
  const existing = tenant?.meta?.umami_website_id
  if (existing) return existing
  try {
    const name = tenant?.name || tenant?.slug || tenant?.id
    const domain = tenant?.slug ? `${tenant.slug}.store` : "store.local"
    const w = await createWebsite(String(name), domain)
    await svc.updateTenants({
      id: tenant.id,
      meta: { ...(tenant.meta ?? {}), umami_website_id: w.id },
    })
    return w.id
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[umami] website create failed:", e)
    return null
  }
}

// ---------------------------------------------------------------------------
// analytics reads (all take a websiteId the CALLER resolved from the tenant)
// ---------------------------------------------------------------------------

export type Range = { startAt: number; endAt: number; unit: "hour" | "day" }

export function rangeFor(key: string): Range {
  const end = Date.now()
  const day = 86400000
  const map: Record<string, number> = {
    "24h": 1, "7d": 7, "30d": 30, "90d": 90,
  }
  const days = map[key] ?? 7
  return {
    startAt: end - days * day,
    endAt: end,
    unit: days <= 1 ? "hour" : "day",
  }
}

export async function websiteStats(id: string, r: Range) {
  return api(`/api/websites/${id}/stats?startAt=${r.startAt}&endAt=${r.endAt}`)
}

export async function websitePageviews(id: string, r: Range, tz = "UTC") {
  return api(
    `/api/websites/${id}/pageviews?startAt=${r.startAt}&endAt=${r.endAt}&unit=${r.unit}&timezone=${encodeURIComponent(tz)}`
  )
}

export async function websiteMetric(
  id: string,
  type:
    | "path"
    | "referrer"
    | "browser"
    | "os"
    | "device"
    | "country"
    | "region"
    | "city"
    | "language"
    | "screen"
    | "entry"
    | "exit"
    | "query"
    | "event",
  r: Range,
  limit = 10
) {
  const rows = await api<any[]>(
    `/api/websites/${id}/metrics?type=${type}&startAt=${r.startAt}&endAt=${r.endAt}`
  )
  return (Array.isArray(rows) ? rows : []).slice(0, limit)
}

export async function websiteActive(id: string): Promise<{ visitors: number }> {
  return api(`/api/websites/${id}/active`)
}
