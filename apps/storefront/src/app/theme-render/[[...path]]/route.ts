import { NextRequest, NextResponse } from "next/server"
import { headers as nextHeaders } from "next/headers"

import { listProducts } from "@lib/data/products"
import { listCategories, getCategoryByHandle } from "@lib/data/categories"
import { getBlogPosts, getBlogPost } from "@lib/data/blog"
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
function classify(path: string): { template: string; countryCode: string; handle?: string; kind?: string } {
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
  if (rest[0] === "categories" && rest[1]) return { template: "collection", countryCode: cc, handle: rest.slice(1).join("/"), kind: "category" }
  if (rest[0] === "blog" && rest[1]) return { template: "article", countryCode: cc, handle: rest[1] }
  if (rest[0] === "blog") return { template: "blog", countryCode: cc }
  if (rest[0] === "contact") return { template: "contact", countryCode: cc }
  // Any other non-empty path is a CMS page slug (about-us, faq, privacy, …) —
  // the same block documents the React app served from its [...slug] route.
  return { template: "page", countryCode: cc, handle: rest.join("/") }
}


/* Resolve commerce-bound home sections. The theme contract promises that a
   section like product_tabs arrives with its products already resolved, so a
   theme never fetches — this is where that promise is kept for product_tabs:
   each tab gets a `products` array shaped for the theme card contract. */
async function resolveProductTabs(
  data: Record<string, unknown>,
  countryCode: string
): Promise<void> {
  const page = (data as any).page
  const sections = page?.sections
  if (!Array.isArray(sections)) return
  const mapCard = (pr: any) => {
    const cp = pr?.variants?.[0]?.calculated_price
    const price = cp?.calculated_amount ?? 0
    const orig = cp?.original_amount ?? null
    return {
      title: pr.title,
      handle: pr.handle,
      featured_image: pr.images?.[0] ?? (pr.thumbnail ? { url: pr.thumbnail } : null),
      price,
      compare_at_price: orig && orig > price ? orig : null,
      available: true,
    }
  }
  await Promise.all(
    sections
      .filter((sec: any) => sec?.type === "product_tabs" && Array.isArray(sec?.settings?.tabs))
      .flatMap((sec: any) =>
        sec.settings.tabs.map(async (tab: any) => {
          const limit = Math.min(Number(tab?.limit) || 8, 12)
          try {
            const { response } = await listProducts({
              countryCode,
              queryParams: {
                limit,
                fields:
                  "*variants.calculated_price,*images,thumbnail,title,handle",
              } as any,
            })
            tab.products = (response.products ?? []).map(mapCard)
          } catch {
            tab.products = []
          }
        })
      )
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const pathStr = (path ?? []).join("/")
  const { template, countryCode, handle, kind } = classify(pathStr)

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
      currency: h.get("x-tenant-currency") || (settings as any)?.currency_code || "USD",
      locale: "en",
      logo: h.get("x-tenant-logo") || (settings as any)?.header?.logo || null,
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
  ;(base as any).categories = categories
  let data: Record<string, unknown> = base

  try {
    if (template === "index" || template === "page") {
      const slug = template === "page" ? (handle ?? "") : "home"
      const cmsPage = await getCmsPage(slug).catch(() => null)
      if (
        template === "page" &&
        (!cmsPage || !Array.isArray(cmsPage.sections) || cmsPage.sections.length === 0)
      ) {
        // Unknown slug / unpublished page — 404 like the React catch-all did.
        return new NextResponse("Not found", { status: 404 })
      }
      const sections = cmsPage?.sections?.length
        ? cmsPage.sections
        : (bundle.manifest?.defaultSections ?? [])
      data = homeContext(base, sections)
      ;(data as any).categories = categories
      await resolveProductTabs(data, countryCode)
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
    } else if (template === "collection" && handle && kind === "category") {
      // A product category page (linked from the header nav). Resolve the
      // category by its handle, then fetch its products WITH prices so cards
      // render exactly like a collection — same template, one Learts.
      const cat = await getCategoryByHandle([handle]).catch(() => null)
      let catProducts: any[] = []
      if ((cat as any)?.id) {
        const { response } = await listProducts({
          countryCode,
          queryParams: {
            category_id: [(cat as any).id],
            limit: 24,
            fields: "*variants.calculated_price,*images,thumbnail,title,handle",
          } as any,
        }).catch(() => ({ response: { products: [] } }))
        catProducts = response.products ?? []
      }
      data = collectionContext(
        base,
        { handle, title: (cat as any)?.name ?? handle, description: (cat as any)?.description ?? "" },
        catProducts
      )
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
    } else if (template === "blog") {
      const result = await getBlogPosts({ limit: 12 }).catch(() => ({ posts: [] } as any))
      ;(data as any).blog = {
        posts: (result.posts ?? []).map((b: any) => ({
          slug: b.slug, title: b.title, excerpt: b.excerpt, cover_image: b.cover_image,
          published_at: b.published_at, reading_time: b.reading_time,
          author: b.author?.name ?? "",
        })),
      }
    } else if (template === "article" && handle) {
      const result = await getBlogPost(handle).catch(() => null)
      if (!result?.post) return new NextResponse("Not found", { status: 404 })
      const post: any = result.post
      ;(data as any).article = {
        title: post.title, content: post.content, excerpt: post.excerpt,
        cover_image: post.cover_image, published_at: post.published_at,
        reading_time: post.reading_time, author: post.author?.name ?? "",
      }
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
    currency: h.get("x-tenant-currency") || (settings as any)?.currency_code || "USD",
    locale: "en",
  })

  if (html == null) {
    return new NextResponse("Theme render failed", { status: 500 })
  }

  // Meta base pixel for Liquid-rendered stores. The theme owns the whole HTML
  // document (no React root layout wraps this response), so the pixel is
  // injected here — same rules as app/layout.tsx: PageView only (Purchase is
  // server-side via the Conversions API subscriber), id digits-only enforced,
  // tenant-resolved via the x-tenant-metapixel header middleware forwards.
  const pixelId = (h.get("x-tenant-metapixel") || "").replace(/[^0-9]/g, "")
  let out = html
  if (pixelId) {
    const pixelTag =
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');</script>` +
      `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>`
    out = out.includes("</head>")
      ? out.replace("</head>", `${pixelTag}</head>`)
      : pixelTag + out
  }

  return new NextResponse(out, {
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
