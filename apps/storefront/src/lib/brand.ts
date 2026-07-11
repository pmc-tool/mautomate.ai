import "server-only"

import { cache } from "react"

/** The single-tenant brand name (Forever Finds' historical default). */
export const DEFAULT_BRAND = "Forever Finds"

const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

/**
 * The current store's brand name. Multi-tenant: the tenant's own name (injected
 * by middleware as x-tenant-name). Single-tenant: the Forever Finds default, so
 * nothing changes for that store. Memoized per request.
 */
export const getBrandName = cache(async (): Promise<string> => {
  if (MULTI_TENANT) {
    try {
      const { headers } = await import("next/headers")
      const n = (await headers()).get("x-tenant-name")
      if (n && n.trim()) return n.trim()
    } catch {}
  }
  return DEFAULT_BRAND
})

/** A social-handle form of the brand, e.g. "Demo Store" -> "@demo_store". */
export const brandHandle = (brand: string): string =>
  "@" + brand.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
