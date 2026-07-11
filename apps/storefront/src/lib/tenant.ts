import "server-only"

import { cache } from "react"
import { headers } from "next/headers"

/**
 * MULTI-TENANCY (Phase 1)
 * -----------------------
 * The SAME storefront codebase serves either ONE store (Forever Finds — flag
 * OFF, the historical behavior, nothing changes) or MANY stores resolved by
 * Host (flag ON — the pooled mAutomate deployment). Everything tenant-aware is
 * gated on MULTI_TENANT so the single-tenant path is byte-for-byte unchanged.
 *
 * When ON, middleware resolves the Host to a tenant via the control-plane
 * `/tenant-config` endpoint and forwards the result to server code as request
 * headers (x-tenant-*). This module is the single reader of that context.
 */
export const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

/** Control-plane endpoint that maps a Host to a tenant (publishable key + theme). */
export const TENANT_CONFIG_URL = process.env.TENANT_CONFIG_URL || ""

/** Request headers middleware injects for downstream server code. */
export const TENANT_HEADER = {
  id: "x-tenant-id",
  pak: "x-tenant-pak",
  theme: "x-tenant-theme",
  name: "x-tenant-name",
  status: "x-tenant-status",
  umami: "x-tenant-umami",
} as const

/** Non-httpOnly cookie carrying the publishable key for client-side SDK calls. */
export const TENANT_PAK_COOKIE = "_tenant_pak"

export type TenantContext = {
  id: string
  publishableKey: string
  theme: string | null
  name: string | null
  status: string | null
  umamiWebsiteId: string | null
}

/**
 * The current request's tenant, or null (single-tenant mode, or the header is
 * absent — e.g. during a static build). Memoized per request with React cache().
 */
export const getTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    if (!MULTI_TENANT) return null
    try {
      const h = await headers()
      const id = h.get(TENANT_HEADER.id)
      const pak = h.get(TENANT_HEADER.pak)
      if (!id || !pak) return null
      return {
        id,
        publishableKey: pak,
        theme: h.get(TENANT_HEADER.theme) || null,
        name: h.get(TENANT_HEADER.name) || null,
        status: h.get(TENANT_HEADER.status) || null,
        umamiWebsiteId: h.get(TENANT_HEADER.umami) || null,
      }
    } catch {
      return null
    }
  }
)
