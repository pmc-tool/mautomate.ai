import { NextRequest, NextResponse } from "next/server"

/**
 * Per-tenant sitemap.xml (SEO setup, 2026-08-02).
 *
 * The old Next metadata route baked ONE build-time STOREFRONT_URL into every
 * store's sitemap — every tenant advertised brandtodoor.com and listed only
 * four URLs. This handler resolves the TENANT FROM THE REQUEST HOST (same
 * control-plane lookup the middleware uses) and emits that store's real
 * public surface: core pages, published CMS pages, products, categories and
 * blog posts, all on the requesting domain with the store's own country
 * prefix. Every remote lookup is best-effort — a failure omits its group,
 * never breaks the sitemap.
 */

const BACKEND = (
  process.env.MEDUSA_BACKEND_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
).replace(/\/+$/, "")
const TENANT_CONFIG_URL =
  process.env.TENANT_CONFIG_URL || `${BACKEND}/tenant-config`

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

type Entry = { loc: string; lastmod?: string; priority: number }

export async function GET(req: NextRequest) {
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim()
  const base = `https://${host}`

  // Resolve the tenant that owns this host.
  let pubKey = ""
  let cc = "us"
  try {
    const r = await fetch(
      `${TENANT_CONFIG_URL}?host=${encodeURIComponent(host)}`,
      { next: { revalidate: 300 } }
    )
    if (r.ok) {
      const d = await r.json()
      pubKey = d.publishable_key || ""
      cc = (d.default_country || "us").toLowerCase()
    }
  } catch {
    /* unknown host: emit the core pages only */
  }

  const now = new Date().toISOString()
  const entries: Entry[] = [
    { loc: `${base}/${cc}`, lastmod: now, priority: 1 },
    { loc: `${base}/${cc}/store`, lastmod: now, priority: 0.9 },
    { loc: `${base}/${cc}/blog`, lastmod: now, priority: 0.6 },
    { loc: `${base}/${cc}/contact`, lastmod: now, priority: 0.5 },
  ]

  if (pubKey) {
    // Products (public store API, tenant-scoped by the publishable key).
    try {
      const r = await fetch(
        `${BACKEND}/store/products?limit=1000&fields=handle,updated_at`,
        {
          headers: { "x-publishable-api-key": pubKey },
          next: { revalidate: 3600 },
        }
      )
      if (r.ok) {
        const d = await r.json()
        for (const p of (d?.products ?? []) as {
          handle?: string
          updated_at?: string
        }[]) {
          if (p?.handle) {
            entries.push({
              loc: `${base}/${cc}/products/${p.handle}`,
              lastmod: p.updated_at || now,
              priority: 0.8,
            })
          }
        }
      }
    } catch {
      /* omit products */
    }

    // Categories.
    try {
      const r = await fetch(
        `${BACKEND}/store/product-categories?limit=200&fields=handle,updated_at`,
        {
          headers: { "x-publishable-api-key": pubKey },
          next: { revalidate: 3600 },
        }
      )
      if (r.ok) {
        const d = await r.json()
        for (const c of (d?.product_categories ?? []) as {
          handle?: string
          updated_at?: string
        }[]) {
          if (c?.handle) {
            entries.push({
              loc: `${base}/${cc}/categories/${c.handle}`,
              lastmod: c.updated_at || now,
              priority: 0.7,
            })
          }
        }
      }
    } catch {
      /* omit categories */
    }

    // Published CMS pages + blog posts (tenant-scoped by pak).
    try {
      const r = await fetch(`${BACKEND}/cms/pages?status=published`, {
        headers: {
          "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
          "x-tenant-pak": pubKey,
        },
        next: { revalidate: 3600 },
      })
      if (r.ok) {
        const d = await r.json()
        for (const p of (d?.pages ?? []) as {
          slug?: string
          status?: string
        }[]) {
          if (p?.slug && p.slug !== "home" && (!p.status || p.status === "published")) {
            entries.push({
              loc: `${base}/${cc}/${p.slug}`,
              lastmod: now,
              priority: 0.5,
            })
          }
        }
      }
    } catch {
      /* omit cms pages */
    }

    try {
      const r = await fetch(`${BACKEND}/store/cms/blog/posts?limit=500`, {
        headers: { "x-publishable-api-key": pubKey },
        next: { revalidate: 3600 },
      })
      if (r.ok) {
        const d = await r.json()
        for (const p of (d?.posts ?? []) as {
          slug?: string
          updated_at?: string
        }[]) {
          if (p?.slug) {
            entries.push({
              loc: `${base}/${cc}/blog/${p.slug}`,
              lastmod: p.updated_at || now,
              priority: 0.6,
            })
          }
        }
      }
    } catch {
      /* omit blog */
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `<url><loc>${esc(e.loc)}</loc>` +
          (e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : "") +
          `<priority>${e.priority}</priority></url>`
      )
      .join("\n") +
    `\n</urlset>\n`

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  })
}
