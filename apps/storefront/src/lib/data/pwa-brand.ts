import "server-only"

import { headers } from "next/headers"

/**
 * Per-tenant branding for the PWA manifest + icons.
 *
 * These routes live at the origin root (/manifest.webmanifest, /pwa-icon) and
 * are served through a middleware `next()` bypass that skips the country
 * redirect. That bypass does NOT reliably forward the `x-tenant-*` request
 * headers to a same-origin route handler, so rather than depend on them we
 * resolve the tenant the SAME way the middleware does: from the request Host via
 * the public tenant-config endpoint. Falls back to nulls so callers can layer
 * their own defaults (single-tenant / Forever Finds resolves via getCmsSettings).
 */

const TENANT_CONFIG_URL =
  process.env.NEXT_PUBLIC_TENANT_CONFIG_URL ||
  process.env.TENANT_CONFIG_URL ||
  ""
const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

export interface PwaBrand {
  name: string | null
  accent: string | null
  logo: string | null
}

export async function resolvePwaBrand(): Promise<PwaBrand> {
  const empty: PwaBrand = { name: null, accent: null, logo: null }
  try {
    const h = await headers()

    // If the tenant headers happen to be present (e.g. a future rewrite path),
    // use them directly — no network round-trip.
    const hdrName = h.get("x-tenant-name")
    const hdrAccent = h.get("x-tenant-accent")
    const hdrLogo = h.get("x-tenant-logo")
    if (hdrName && hdrName.trim()) {
      return {
        name: hdrName.trim(),
        accent: hdrAccent || null,
        logo: hdrLogo || null,
      }
    }

    if (!MULTI_TENANT || !TENANT_CONFIG_URL) return empty

    const host = (
      h.get("x-forwarded-host") ||
      h.get("host") ||
      ""
    ).split(":")[0]
    if (!host) return empty

    const res = await fetch(
      `${TENANT_CONFIG_URL}?host=${encodeURIComponent(host)}`,
      { cache: "no-store", signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return empty
    const d = (await res.json()) as {
      name?: string | null
      theme_accent?: string | null
      logo_url?: string | null
    }
    return {
      name: d?.name?.trim() || null,
      accent: d?.theme_accent || null,
      logo: d?.logo_url || null,
    }
  } catch {
    return empty
  }
}
