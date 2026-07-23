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
import { isValidEditorKeyForRequest } from "@lib/util/secret"
import { resolveEditorTenant } from "@lib/util/editor-tenant"
import { fromPuckContent } from "../../../puck/convert"
import {
  buildDocumentHeadCss,
  collectProductTabBags,
} from "@modules/cms/render/document"
import { legacyThemeColor } from "@modules/cms/render/theme-vars"
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

/* Default content for the legal pages every store links from signup. A
   merchant-published CMS page with the same slug replaces these entirely. */
const POLICY_PAGE_FALLBACKS: Record<string, string> = {
  "privacy-policy":
    "<h1>Privacy Policy</h1>" +
    "<p>This policy explains what information this store collects when you shop with us, how it is used, and the choices you have.</p>" +
    "<h2>Information we collect</h2><p>When you create an account, place an order or contact us, we collect the information you provide: your name, email address, phone number, shipping and billing addresses, and details of the products you purchase. Payment card details are processed by our payment providers and are never stored on our servers.</p>" +
    "<h2>How we use your information</h2><p>We use your information to process and deliver your orders, manage your account, respond to your questions, and — where you have agreed — send you updates about products and offers. We do not sell your personal information to third parties.</p>" +
    "<h2>Sharing</h2><p>We share information only with service providers who need it to operate this store: payment processors, shipping carriers and the platform that hosts this store. Each is bound to use your information solely to provide their service.</p>" +
    "<h2>Cookies</h2><p>This store uses cookies that are necessary for the shopping experience to work — keeping you signed in and remembering your cart. You can control cookies in your browser settings; disabling them may prevent parts of the store from working.</p>" +
    "<h2>Data retention and your rights</h2><p>We keep your information for as long as your account is active or as needed to comply with legal obligations. You may request access to, correction of, or deletion of your personal information at any time by contacting us.</p>" +
    '<h2>Contact</h2><p>If you have any questions about this policy or how your information is handled, please reach out through our <a href="/contact">contact page</a>.</p>',
  "terms-of-use":
    "<h1>Terms of Use</h1>" +
    "<p>By using this store and placing orders you agree to the terms below. Please read them before you shop.</p>" +
    "<h2>Your account</h2><p>You are responsible for keeping your account credentials confidential and for all activity under your account. Provide accurate, current information when you register and keep it up to date.</p>" +
    "<h2>Orders and payment</h2><p>All orders are subject to acceptance and availability. Prices, promotions and product availability may change at any time before an order is accepted. If we cannot fulfill your order, we will notify you and refund any amount already paid.</p>" +
    "<h2>Shipping and returns</h2><p>Delivery estimates are provided in good faith but are not guaranteed. If something arrives damaged or is not what you ordered, contact us and we will make it right in line with our returns process.</p>" +
    "<h2>Acceptable use</h2><p>You agree not to misuse this store: no attempts to interfere with its operation, access other customers' data, or use its content for unlawful purposes.</p>" +
    "<h2>Intellectual property</h2><p>All content on this store — product images, text, logos and design — belongs to the store or its licensors and may not be reproduced without permission.</p>" +
    '<h2>Changes to these terms</h2><p>We may update these terms from time to time. The version published on this page applies to every order at the time it is placed. Continued use of the store after changes means you accept the updated terms. Questions? <a href="/contact">Contact us</a>.</p>',
}

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
      id: pr.id,
      title: pr.title,
      handle: pr.handle,
      featured_image: pr.images?.[0] ?? (pr.thumbnail ? { url: pr.thumbnail } : null),
      price,
      compare_at_price: orig && orig > price ? orig : null,
      available: true,
    }
  }
  // Collect every product_tabs settings bag on the page — top-level sections
  // AND product_tabs used as a WIDGET inside a container column (including one
  // level of inner_section). The walk is the document composer's (shared with
  // the section-composition seam); the FETCHING stays here — the route owns
  // the data layer, the composer owns the walk.
  const tabBags = collectProductTabBags(sections)

  await Promise.all(
    tabBags
      .filter((bag: any) => Array.isArray(bag?.tabs))
      .flatMap((sec: any) =>
        sec.tabs.map(async (tab: any) => {
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

  /* ---- Draft preview (Phase 4D — ARCH-UX §5.5 publish confidence) ----
   * ?preview_draft=<editor key>: render the visual editor's DRAFT buffer
   * for CMS-page templates through this SAME production path — the only
   * honest answer to "will it look like this?", because it IS the
   * production renderer. DEFAULT CLOSED: without the param, nothing about
   * this route changes. The gate is the tenant-bound, expiring EDITOR
   * token (the post-leak-fix model): it must verify AND be bound to the
   * tenant that owns THIS host, so a merchant's preview link can never
   * open another store's draft, and an expired link stops working. */
  const previewDraftKey =
    req.nextUrl.searchParams.get("preview_draft") || ""
  let draftSections: unknown[] | null = null
  if (previewDraftKey && (template === "index" || template === "page")) {
    if (!(await isValidEditorKeyForRequest(previewDraftKey, req))) {
      return new NextResponse(
        "Draft preview link is invalid or has expired — reopen Preview from the editor.",
        { status: 401 }
      )
    }
    const draftSlug = template === "page" ? (handle ?? "") : "home"
    const rawLang = req.nextUrl.searchParams.get("lang") || ""
    const draftLang = rawLang === "bn" ? "bn" : "en"
    try {
      const { backend, pubKey } = await resolveEditorTenant(req)
      const dr = await fetch(
        `${backend}/cms/visual-autosave?slug=${encodeURIComponent(draftSlug)}&lang=${draftLang}`,
        {
          headers: {
            "x-cms-secret": process.env.CMS_REVALIDATE_SECRET || "",
            "x-tenant-pak": pubKey,
          },
          cache: "no-store",
        }
      )
      if (dr.ok) {
        const b = await dr.json()
        if (b?.draft?.data && Array.isArray(b.draft.data.content)) {
          // Puck draft {content:[{type,props}]} -> editor sections
          // {block_type, ...settings} — the exact shape homeContext already
          // consumes (it reads s.block_type ?? s.type), so everything
          // downstream (style engine, product resolution, Liquid render)
          // is the untouched production path.
          draftSections = fromPuckContent(b.draft.data)
        }
      }
    } catch {
      // No reachable draft buffer: fall through to the published page —
      // with no unsaved draft, the draft IS the published state.
    }
  }

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
      // Draft preview (validated above) replaces ONLY the section source —
      // an authorized preview of a not-yet-published page renders instead
      // of 404ing, which is the point of previewing before first publish.
      const cmsPage =
        draftSections !== null ? null : await getCmsPage(slug).catch(() => null)
      // Built-in policy pages: signup links to /privacy-policy and
      // /terms-of-use on every store, but a fresh store has no CMS page for
      // them. Serve sensible default content through the theme instead of a
      // 404; a merchant-published CMS page with the same slug still wins.
      const policyFallback =
        template === "page" ? POLICY_PAGE_FALLBACKS[slug] : undefined
      if (
        draftSections === null &&
        template === "page" &&
        !policyFallback &&
        (!cmsPage || !Array.isArray(cmsPage.sections) || cmsPage.sections.length === 0)
      ) {
        // Unknown slug / unpublished page — 404 like the React catch-all did.
        return new NextResponse("Not found", { status: 404 })
      }
      const sections =
        draftSections !== null
          ? draftSections
          : cmsPage?.sections?.length
            ? cmsPage.sections
            : policyFallback
              ? [
                  {
                    id: `policy-${slug}`,
                    type: "rich_text",
                    html: policyFallback,
                    width: "narrow",
                  },
                ]
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
        id: p.id,
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

  // PWA head: the store's accent drives the browser-chrome theme color; the
  // manifest/icons/SW are served per-tenant from the origin root. Prefer the
  // tenant's brand accent (forwarded header), then the CMS primary, then neutral.
  // U7 dual-read: null token (explicit-inherit shape) maps back to the exact
  // bytes the legacy sentinel wire carried — output unchanged for all tenants.
  /* Live-chat widget. The bubble used to mount in the React root layout
     (chat-widget-mount), but Liquid pages own the whole document now and never
     pass through it — so every all-Liquid store silently lost its chatbot even
     though the bot exists and is bound to the web widget. Re-add it here, the
     SAME data-driven way: the middleware forwards the tenant's ACTIVE chatbot
     public key as x-tenant-chatbot (empty when there is no bot), and the
     backend's own /marketing-chat/widget.js loader renders nothing on a 404.
     No key -> no tag, so a store without a bot (or another tenant) shows
     nothing. */
  const chatbotEmbed = buildChatbotEmbed(h.get("x-tenant-chatbot"))

  const pwaThemeColor =
    h.get("x-tenant-accent") ||
    legacyThemeColor((settings as any)?.theme, "primary") ||
    "#111111"

  const html = await renderUploadedTheme({
    handle: bundle.handle,
    version: bundle.version,
    template,
    data,
    contentForHeader:
      buildHead(
        shopName,
        pwaThemeColor,
        // Brand-token head CSS comes from the document composer — the ONE
        // token-emission seam shared with the editor canvas and previews.
        buildDocumentHeadCss(
          (settings as any)?.theme,
          (bundle.manifest as any)?.tokens ?? null
        )
      ) + chatbotEmbed,
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

  // Umami analytics for Liquid-rendered stores — the React root layout's
  // injection never wraps this response, so without this the DEFAULT render
  // path was analytics-blind. Same same-origin /umami proxy as the layout;
  // the website id is tenant-resolved and sanitized to a UUID shape.
  const umamiId = (h.get("x-tenant-umami") || "").replace(/[^0-9a-fA-F-]/g, "")
  if (umamiId) {
    const umamiTag = `<script defer src="/umami/script.js" data-website-id="${umamiId}" data-host-url="/umami"></script>`
    out = out.includes("</head>")
      ? out.replace("</head>", `${umamiTag}</head>`)
      : umamiTag + out
  }

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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The storefront is per-tenant and rendered fresh on every request
      // (theme, CMS home, prices all change live). Tell the browser NOT to cache
      // the HTML document, so a theme switch / design reset / content edit is
      // seen immediately on the next visit instead of a stale cached page.
      // (Static assets — /learts/assets, Next chunks — keep their own long cache
      // headers; only this HTML document is no-store.)
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })
}

/** The platform's own head content — SEO + charset the theme can't opt out of.
 * Also carries the PWA install tags (per-tenant manifest, theme color, apple
 * touch icon) and the service-worker registration, so Liquid-rendered stores
 * (which own the whole HTML document, bypassing the React root layout) are just
 * as installable as the React pages. */
/** The public backend origin the BROWSER talks to (same var the React chat
 *  widget uses). The loader also infers its own origin from its src, so this
 *  only needs to be a reachable public backend. */
const PUBLIC_BACKEND_URL = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
).replace(/\/$/, "")

/** One deferred <script> tag for the tenant's active chatbot, or "" when the
 *  forwarded key is absent/empty. The key is a public, per-bot identifier
 *  (safe to embed); it is attribute-escaped defensively. */
function buildChatbotEmbed(chatbotKey: string | null): string {
  const key = (chatbotKey ?? "").trim()
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return ""
  return (
    `<script src="${PUBLIC_BACKEND_URL}/marketing-chat/widget.js"` +
    ` data-public-key="${key}" defer></script>`
  )
}

function buildHead(
  shopName: string,
  themeColor: string,
  themeVars: string
): string {
  const color = /^#[0-9a-fA-F]{3,8}$/.test(themeColor) ? themeColor : "#111111"
  return [
    `<meta charset="utf-8">`,
    // Brand design tokens (--ff-*). The style engine compiles a "link to global
    // token" style value to var(--ff-<id>), so without these every tokenized
    // style silently drops on a Liquid store — which is now every store, since
    // Liquid pages own the whole document and never pass through the React root
    // layout that used to emit them.
    themeVars ? `<style>${themeVars.replace(/<\s*\/\s*style/gi, "")}</style>` : "",
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(shopName)}</title>`,
    `<link rel="manifest" href="/manifest.webmanifest">`,
    `<meta name="theme-color" content="${color}">`,
    `<link rel="apple-touch-icon" href="/pwa-icon?size=180">`,
    `<meta name="mobile-web-app-capable" content="yes">`,
    `<meta name="apple-mobile-web-app-capable" content="yes">`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
    `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>`,
  ].join("")
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  )
}
