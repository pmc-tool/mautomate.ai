import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

// Middleware runs server-side, so prefer the internal loopback backend URL when
// set (more robust + skips a CDN round-trip); falls back to the public URL.
const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "dk"

// MULTI-TENANCY (Phase 1) — see src/lib/tenant.ts. When ON, the Host resolves to
// a tenant via the control-plane /tenant-config; that tenant's publishable key +
// active theme are forwarded to server code as x-tenant-* request headers. When
// OFF (Forever Finds), none of this runs and behavior is unchanged.
const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"
// Edge runtime only inlines NEXT_PUBLIC_* variables at build time. The control-
// plane /tenant-config endpoint is public (it hands out publishable keys), so we
// use a NEXT_PUBLIC_ URL to make sure middleware can always reach it internally
// even when MEDUSA_BACKEND_URL_INTERNAL is not available in the Edge bundle.
const TENANT_CONFIG_URL =
  process.env.NEXT_PUBLIC_TENANT_CONFIG_URL ||
  process.env.TENANT_CONFIG_URL ||
  ""

type TenantConfig = {
  tenant_id: string
  name: string | null
  publishable_key: string
  status: string
  active_theme: string | null
  /** Dedicated-instance backend (instance-per-tenant). Null => pooled tenant. */
  backend_url: string | null
  /**
   * The region that carries THIS tenant's currency. In a pooled backend
   * /store/regions returns every tenant's region, so the storefront resolves
   * this id directly to display the right currency. Null => country-code lookup.
   */
  region_id: string | null
  umami_website_id: string | null
}

// Per-host tenant resolution cache (module-scoped, short TTL). Keyed by Host so
// one tenant's config is never served for another's Host.
const tenantCache = new Map<
  string,
  { config: TenantConfig | null; ts: number }
>()
const TENANT_TTL_MS = 60 * 1000

async function resolveTenant(host: string): Promise<TenantConfig | null> {
  const key = host.toLowerCase()
  const hit = tenantCache.get(key)
  if (hit && Date.now() - hit.ts < TENANT_TTL_MS) return hit.config
  let config: TenantConfig | null = null
  try {
    const base = TENANT_CONFIG_URL || `${BACKEND_URL}/tenant-config`
    const res = await fetch(`${base}?host=${encodeURIComponent(host)}`, {
      cache: "no-store",
    })
    if (res.ok) {
      const d = (await res.json()) as TenantConfig
      if (d?.publishable_key || d?.backend_url) config = d
    }
  } catch {
    config = null
  }
  tenantCache.set(key, { config, ts: Date.now() })
  return config
}

// Region map is cached PER TENANT (or "default" in single-tenant mode) so one
// tenant's regions/currencies are never served to another Host.
const regionMapCaches = new Map<
  string,
  { regionMap: Map<string, HttpTypes.StoreRegion>; updated: number }
>()

async function getRegionMap(
  tenantKey: string,
  publishableKey: string,
  backendUrl?: string
) {
  // Dedicated-instance tenants read regions from their OWN backend; pooled
  // tenants (and the single-tenant deployment) use the shared backend.
  const backend = backendUrl || BACKEND_URL
  if (!backend) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable."
    )
  }

  let entry = regionMapCaches.get(tenantKey)
  if (!entry) {
    entry = { regionMap: new Map(), updated: 0 }
    regionMapCaches.set(tenantKey, entry)
  }

  if (
    !entry.regionMap.keys().next().value ||
    entry.updated < Date.now() - 3600 * 1000
  ) {
    const response = await fetch(`${backend}/store/regions`, {
      method: "GET",
      headers: { "x-publishable-api-key": publishableKey },
      next: { revalidate: 3600, tags: [`regions-${tenantKey}`] },
      cache: "force-cache",
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    const { regions } = await response.json()
    if (!regions?.length) {
      return new Map<string, HttpTypes.StoreRegion>()
    }

    const fresh = new Map<string, HttpTypes.StoreRegion>()
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => fresh.set(c.iso_2 ?? "", region))
    })
    entry.regionMap = fresh
    entry.updated = Date.now()
  }

  return entry.regionMap
}

async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  let countryCode

  const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()
  const cloudflareCountryCode = (
    request as { cf?: { country?: string } }
  ).cf?.country?.toLowerCase()
  const vercelCountryCode = request.headers
    .get("x-vercel-ip-country")
    ?.toLowerCase()

  if (urlCountryCode && regionMap.has(urlCountryCode)) {
    countryCode = urlCountryCode
  } else if (cloudflareCountryCode && regionMap.has(cloudflareCountryCode)) {
    countryCode = cloudflareCountryCode
  } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
    countryCode = vercelCountryCode
  } else if (regionMap.has(DEFAULT_REGION)) {
    countryCode = DEFAULT_REGION
  } else if (regionMap.keys().next().value) {
    countryCode = regionMap.keys().next().value
  }

  return countryCode
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  )

function htmlResponse(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

function notFoundPage(host: string) {
  return htmlResponse(
    `<!doctype html><meta charset="utf-8"><title>Store not found</title>
<div style="font-family:sans-serif;max-width:520px;margin:12vh auto;text-align:center;color:#333">
<h1 style="font-size:26px">Store not found</h1>
<p style="color:#777">No store is connected to <b>${esc(host)}</b> yet.</p>
<p><a href="https://mautomate.ai" style="color:#0e7490">Create your store on mAutomate &rarr;</a></p></div>`,
    404
  )
}

function unavailablePage(name: string | null) {
  return htmlResponse(
    `<!doctype html><meta charset="utf-8"><title>Store unavailable</title>
<div style="font-family:sans-serif;max-width:520px;margin:12vh auto;text-align:center;color:#333">
<h1 style="font-size:26px">${esc(
      name || "This store"
    )} is temporarily unavailable</h1>
<p style="color:#777">This store has been suspended. If you're the owner, check your mAutomate account.</p></div>`,
    503
  )
}

// Shown while a freshly-provisioned store's backend is still finishing setup
// (its region/store data isn't ready yet). Auto-refreshes so the storefront
// appears the moment provisioning completes — never a raw 500.
function settingUpPage(name: string | null) {
  return htmlResponse(
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Setting up your store</title>
<div style="font-family:sans-serif;max-width:520px;margin:12vh auto;text-align:center;color:#333">
<h1 style="font-size:26px">${esc(name || "Your store")} is getting ready</h1>
<p style="color:#777">We're finishing the final setup — this usually takes under a minute. This page refreshes automatically.</p></div>`,
    503
  )
}

/**
 * Middleware to handle tenant resolution (multi-tenant), region selection and
 * onboarding status.
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  // Analytics tracker + event collector: proxied to internal Umami via the
  // next.config /umami/* rewrite. Must bypass tenant resolution AND the
  // country-code redirect (else POST /umami/api/send -> /us/umami/api/send 404s).
  if (request.nextUrl.pathname.startsWith("/umami")) {
    return NextResponse.next()
  }

  // The visual editor (and its canvas iframe) is region-agnostic — it must NOT
  // be region-redirected. But it STILL needs the tenant context injected below
  // (x-tenant-theme / x-tenant-backend / x-tenant-name), otherwise the server
  // root layout's getActiveTheme() can't resolve THIS store's theme and loads
  // the fallback (Learts) stylesheets — while the canvas renders the store's
  // real theme header, producing an unstyled "old+new" mixture. So we resolve
  // the tenant + forward its headers exactly like a normal request, and only
  // skip the region-redirect step (see the `isEditor` early-return below).
  const isEditor = request.nextUrl.pathname.startsWith("/editor")
  const isMerchantAdmin = request.nextUrl.pathname.startsWith("/dashboard")

  // Merchant admin is served on a dedicated host (e.g. merchant.mautomate.ai)
  // and handles its own authentication and tenant resolution. It does not need
  // a storefront tenant mapping, so bypass multi-tenant resolution entirely.
  if (MULTI_TENANT && isMerchantAdmin) {
    return NextResponse.next()
  }

  // --- MULTI-TENANT: resolve the Host to a tenant (or bail with a clean page) ---
  let tenant: TenantConfig | null = null
  if (MULTI_TENANT) {
    const host = (
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      ""
    ).split(":")[0]
    tenant = await resolveTenant(host)
    if (!tenant) return notFoundPage(host)
    if (tenant.status !== "live") return unavailablePage(tenant.name)
  }

  const publishableKey = tenant?.publishable_key || PUBLISHABLE_API_KEY || ""
  const tenantKey = tenant?.tenant_id || "default"
  const tenantBackend = tenant?.backend_url || undefined

  const cacheIdCookie = request.cookies.get("_medusa_cache_id")
  const cacheId = cacheIdCookie?.value || crypto.randomUUID()

  // Build the forwarded request headers, injecting tenant context for server code.
  const forwardHeaders = new Headers(request.headers)
  if (tenant) {
    forwardHeaders.set("x-tenant-id", tenant.tenant_id)
    forwardHeaders.set("x-tenant-pak", tenant.publishable_key)
    forwardHeaders.set("x-tenant-theme", tenant.active_theme || "")
    forwardHeaders.set("x-tenant-name", tenant.name || "")
    forwardHeaders.set("x-tenant-status", tenant.status || "")
    forwardHeaders.set("x-tenant-umami", tenant.umami_website_id || "")
    // Dedicated-instance backend, so server data fetches hit the store's own Medusa.
    if (tenant.backend_url) forwardHeaders.set("x-tenant-backend", tenant.backend_url)
    // Tenant's region id (carries its currency) — the storefront resolves this
    // directly so prices show in the tenant's own currency (see lib/data/regions).
    if (tenant.region_id) forwardHeaders.set("x-tenant-region-id", tenant.region_id)
  }

  const finalize = (res: NextResponse) => {
    if (!cacheIdCookie) {
      res.cookies.set("_medusa_cache_id", cacheId, { maxAge: 60 * 60 * 24 })
    }
    // Non-httpOnly so the browser SDK can attach the tenant's publishable key.
    if (tenant) {
      res.cookies.set("_tenant_pak", tenant.publishable_key, {
        maxAge: 60 * 60 * 24,
        sameSite: "lax",
      })
      if (tenant.backend_url) {
        res.cookies.set("_tenant_backend", tenant.backend_url, {
          maxAge: 60 * 60 * 24,
          sameSite: "lax",
        })
      }
      // Non-httpOnly so the browser SDK can resolve the tenant's region/currency.
      // Short maxAge so a merchant's currency change reflects on the client too.
      if (tenant.region_id) {
        res.cookies.set("_tenant_region", tenant.region_id, {
          maxAge: 60,
          sameSite: "lax",
        })
      }
    }
    return res
  }

  // Visual editor: tenant context is now forwarded (so the root layout loads
  // THIS store's theme stylesheets), but the editor is region-agnostic — return
  // here so it's never redirected into a /:country path.
  if (isEditor) {
    return finalize(NextResponse.next({ request: { headers: forwardHeaders } }))
  }

  // A freshly-provisioned store can be reachable a beat before its backend has
  // seeded its region (the ~1-minute setup window). Rather than letting the
  // region fetch throw a raw 500, show a friendly auto-refreshing setup page.
  let regionMap: Awaited<ReturnType<typeof getRegionMap>>
  let countryCode: string | undefined
  try {
    regionMap = await getRegionMap(tenantKey, publishableKey, tenantBackend)
    countryCode = await getCountryCode(request, regionMap)
  } catch {
    return settingUpPage(tenant?.name ?? null)
  }
  const hasRegions =
    !!regionMap &&
    (regionMap instanceof Map
      ? regionMap.size > 0
      : Object.keys(regionMap as Record<string, unknown>).length > 0)
  // A pooled tenant's region is intentionally COUNTRY-LESS: Medusa binds a
  // country to exactly one region, so countries cannot be shared across tenants.
  // An empty region map is therefore NORMAL for a provisioned store (it has a
  // region_id) — routing falls back to DEFAULT_REGION for the URL segment while
  // pricing uses the forwarded x-tenant-region-id. Only show the setup page when
  // the store genuinely has no region yet.
  if (!hasRegions && !tenant?.region_id) {
    return settingUpPage(tenant?.name ?? null)
  }

  const country = countryCode || DEFAULT_REGION
  const firstPathSegment = request.nextUrl.pathname.split("/")[1]?.toLowerCase()
  const urlHasCountry = firstPathSegment === country.toLowerCase()

  if (urlHasCountry) {
    return finalize(NextResponse.next({ request: { headers: forwardHeaders } }))
  }

  // if the url doesn't have the country, redirect to it
  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname
  const queryString = request.nextUrl.search || ""
  const redirectUrl = `${request.nextUrl.origin}/${country}${redirectPath}${queryString}`

  return finalize(NextResponse.redirect(redirectUrl, 307))
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
