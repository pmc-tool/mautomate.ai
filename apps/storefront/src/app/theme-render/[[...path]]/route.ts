import { NextRequest, NextResponse } from "next/server"
import { headers as nextHeaders } from "next/headers"

import { listProducts } from "@lib/data/products"
import { listCategories } from "@lib/data/categories"
import { getCmsPage } from "@lib/data/cms"
import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getCmsSettings } from "@lib/data/cms"
import { renderUploadedTheme, loadThemeBundle } from "@modules/theme-runtime/loader"
import {
  baseContext,
  homeContext,
  productContext,
  collectionContext,
} from "@modules/theme-runtime/build-context"

/* ------------------------------------------------------------------ */
/* GET /theme-render/*  — render a page through an UPLOADED Liquid theme.*/
/*                                                                     */
/* Middleware rewrites a storefront request here ONLY when the store's  */
/* active theme is an uploaded theme (not one of the compiled React     */
/* themes). Being a Route Handler, this bypasses every React layout —   */
/* so the theme owns the whole HTML document (its own <html>, head,     */
/* header and footer), exactly like a Shopify theme, with no chrome     */
/* conflict.                                                            */
/*                                                                     */
/* The React themes are never rewritten, so nothing about live stores   */
/* on them changes.                                                    */
/* ------------------------------------------------------------------ */

/** Which theme + template + data does this path map to? */
function classify(path: string): { template: string; countryCode: string; handle?: string } {
  // path arrives WITHOUT the leading /theme-render, e.g. "bd/products/watch".
  const segs = path.split("/").filter(Boolean)
  const cc = segs[0] && /^[a-z]{2,3}$/.test(segs[0]) ? segs[0] : "us"
  const rest = /^[a-z]{2,3}$/.test(segs[0] ?? "") ? segs.slice(1) : segs

  if (rest.length === 0) return { template: "index", countryCode: cc }
  if (rest[0] === "products" && rest[1]) return { template: "product", countryCode: cc, handle: rest[1] }
  if (rest[0] === "collections" && rest[1]) return { template: "collection", countryCode: cc, handle: rest[1] }
  if (rest[0] === "store") return { template: "list-collections", countryCode: cc }
  if (rest[0] === "cart") return { template: "cart", countryCode: cc }
  if (rest[0] === "search") return { template: "search", countryCode: cc }
  // Unknown storefront path → let the theme's index handle it (never 404 after
  // a rewrite; a blank page is worse than the home page).
  return { template: "index", countryCode: cc }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const pathStr = (path ?? []).join("/")
  const { template, countryCode, handle } = classify(pathStr)

  const h = await nextHeaders()
  // The theme to render: a preview override (merchant previewing before apply)
  // wins; otherwise the store's active theme, injected by middleware.
  const previewTheme = req.nextUrl.searchParams.get("preview_theme") || ""
  const themeHandle = previewTheme || h.get("x-tenant-theme") || ""

  const bundle = await loadThemeBundle(themeHandle)
  if (!bundle) {
    // Not an uploaded theme after all (or fetch failed). 404 so the caller can
    // recover — but middleware only rewrites known-uploaded themes, so this is
    // the rare race, not the norm.
    return new NextResponse("Theme not found", { status: 404 })
  }

  // ---- gather the tenant + shared context ----
  const [settings, customer, cart, categories] = await Promise.all([
    getCmsSettings().catch(() => null),
    retrieveCustomer().catch(() => null),
    retrieveCart().catch(() => null),
    listCategories().catch(() => []),
  ])

  const shopName = h.get("x-tenant-name") || settings?.brand_name || "Store"
  const region = h.get("x-tenant-region-id") || ""

  const base = baseContext({
    shop: {
      name: shopName,
      domain: h.get("x-forwarded-host") || h.get("host") || "",
      currency: (settings as any)?.currency_code || "USD",
      locale: "en",
      logo: (settings as any)?.theme?.header?.logo ?? null,
    },
    template,
    countryCode,
    cart,
    customer,
    chrome: {
      topbar: (settings as any)?.topbar ?? {},
      header: (settings as any)?.header ?? {},
      footer: (settings as any)?.footer ?? {},
    },
    settings: (settings as any)?.theme_settings?.[themeHandle] ?? {},
  })

  // ---- page-specific data ----
  let data: Record<string, unknown> = base

  try {
    if (template === "index") {
      const cmsHome = await getCmsPage("home").catch(() => null)
      const sections = cmsHome?.sections?.length
        ? cmsHome.sections
        : (bundle.manifest?.defaultSections ?? [])
      data = homeContext(base, sections)
      ;(data as any).categories = categories
    } else if (template === "product" && handle) {
      const { response } = await listProducts({
        countryCode,
        queryParams: {
          handle,
          fields:
            "*variants.calculated_price,*variants.options,*images,images.variants.id,variants.thumbnail,*options,*options.values,thumbnail,title,handle,description",
        } as any,
      })
      const product = response.products[0]
      if (!product) return new NextResponse("Not found", { status: 404 })
      data = productContext(base, product)
    } else if (template === "collection" && handle) {
      const { response } = await listProducts({
        countryCode,
        queryParams: {
          collection_id: [handle],
          limit: 24,
          fields: "*variants.calculated_price,*images,thumbnail,title,handle",
        } as any,
      }).catch(() => ({ response: { products: [] } }))
      data = collectionContext(base, { handle, title: handle }, response.products)
    } else if (template === "list-collections") {
      const { response } = await listProducts({
        countryCode,
        queryParams: { limit: 24, fields: "*variants.calculated_price,*images,thumbnail,title,handle" } as any,
      }).catch(() => ({ response: { products: [] } }))
      ;(data as any).products = (response.products ?? []).map((p: any) => ({
        title: p.title,
        handle: p.handle,
        featured_image: p.images?.[0] ?? (p.thumbnail ? { url: p.thumbnail } : null),
        price: p.variants?.[0]?.calculated_price?.calculated_amount ?? 0,
      }))
    }
    // cart/search render from `base` (cart is already in context).
  } catch {
    // A data fetch failing must not 500 a whole storefront — render what we have.
  }

  const html = await renderUploadedTheme({
    handle: bundle.handle,
    version: bundle.version,
    template,
    data,
    contentForHeader: buildHead(shopName),
    currency: (settings as any)?.currency_code || "USD",
    locale: "en",
  })

  if (html == null) {
    return new NextResponse("Theme render failed", { status: 500 })
  }

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

/** The platform's own head content — SEO + charset the theme can't opt out of. */
function buildHead(shopName: string): string {
  return [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(shopName)}</title>`,
  ].join("")
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  )
}
