import type { MetadataRoute } from "next"

const BASE = process.env.STOREFRONT_URL || "http://localhost:8000"
// Server-only: sitemap is generated on the server, so prefer the internal
// loopback backend URL when set (avoids a build-time fetch to a domain whose
// DNS may not be live yet, and skips a CDN round-trip).
const BACKEND =
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
const CC = process.env.NEXT_PUBLIC_DEFAULT_REGION || "bd"
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

/**
 * sitemap.xml (Next metadata route). Lists the storefront's public URLs for
 * the default region: core pages, published CMS pages, products and
 * categories. Every remote lookup is best-effort — a failed fetch simply
 * omits that group rather than breaking the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const urls: MetadataRoute.Sitemap = []
  const add = (path: string, priority: number) =>
    urls.push({ url: `${BASE}/${CC}${path}`, lastModified: now, priority })

  // Core pages.
  add("", 1)
  add("/store", 0.9)
  add("/blog", 0.6)
  add("/contact", 0.5)

  // Multi-tenant: a single build has no tenant context, so we cannot enumerate a
  // specific store's products/pages here. Emit only the core pages; per-tenant
  // sitemaps are a later phase.
  if (
    process.env.MULTI_TENANT === "1" ||
    process.env.MULTI_TENANT === "true"
  ) {
    return urls
  }

  // Published CMS pages (server-side, secret-gated backend list).
  try {
    const r = await fetch(`${BACKEND}/cms/pages`, {
      headers: { "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "" },
      next: { revalidate: 3600 },
    })
    if (r.ok) {
      const d = await r.json()
      for (const p of (d?.pages ?? []) as { slug?: string }[]) {
        if (p?.slug && p.slug !== "home") {
          add(`/${p.slug}`, 0.5)
        }
      }
    }
  } catch {
    // best-effort
  }

  // Products.
  try {
    const r = await fetch(
      `${BACKEND}/store/products?limit=200&fields=handle`,
      {
        headers: { "x-publishable-api-key": PUB_KEY },
        next: { revalidate: 3600 },
      }
    )
    if (r.ok) {
      const d = await r.json()
      for (const p of (d?.products ?? []) as { handle?: string }[]) {
        if (p?.handle) {
          add(`/products/${p.handle}`, 0.7)
        }
      }
    }
  } catch {
    // best-effort
  }

  // Categories.
  try {
    const r = await fetch(
      `${BACKEND}/store/product-categories?limit=100&fields=handle`,
      {
        headers: { "x-publishable-api-key": PUB_KEY },
        next: { revalidate: 3600 },
      }
    )
    if (r.ok) {
      const d = await r.json()
      for (const c of (d?.product_categories ?? []) as { handle?: string }[]) {
        if (c?.handle) {
          add(`/categories/${c.handle}`, 0.6)
        }
      }
    }
  } catch {
    // best-effort
  }

  return urls
}
