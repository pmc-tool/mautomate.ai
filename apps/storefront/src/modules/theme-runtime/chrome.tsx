import { headers } from "next/headers"

import { getCmsSettings } from "@lib/data/cms"
import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { listCategories } from "@lib/data/categories"

import { loadThemeBundle } from "./loader"
import { renderThemeChrome } from "./engine"
import { baseContext } from "./build-context"

/* ------------------------------------------------------------------ */
/* Theme chrome + branding for the React-rendered surfaces.            */
/*                                                                     */
/* Checkout/payment/order-confirmation (and the account fallback for   */
/* themes without customer templates) still render through React — the */
/* payment boundary. This module lets those pages carry the STORE'S    */
/* theme anyway, the Shopify way:                                      */
/*   - getLiquidChrome(): the theme's own header/footer sections       */
/*     server-rendered to HTML + the theme stylesheet/font links. NO   */
/*     theme.js is ever loaded on these surfaces, so script-driven     */
/*     controls (mobile burger) are hidden via CSS.                    */
/*   - getThemeBranding(): the theme's design tokens compiled to a     */
/*     scoped stylesheet that reskins the React checkout UI (fonts,    */
/*     button color, links) without touching its DOM.                  */
/* Both fail SOFT (null) — any problem falls back to the base React    */
/* chrome that always works.                                           */
/* ------------------------------------------------------------------ */

export type LiquidChrome = {
  handle: string
  version: string
  header: string
  footer: string
  /** <link> hrefs from the theme layout's head (fonts, icon fonts, vendor css). */
  headLinks: string[]
  /** The theme stylesheet asset URL. */
  cssHref: string
  /** The theme layout's body class(es) — descendant selectors depend on it. */
  bodyClass: string
}

/** All external stylesheet/preconnect links from the theme layout's head —
 * fonts and icon fonts the chrome markup depends on. Liquid-generated links
 * (asset_url) are excluded; the theme stylesheet is added explicitly. */
function extractHeadLinks(layoutSrc: string): string[] {
  const links: string[] = []
  const re = /<link\b[^>]*>/gi
  for (const tag of layoutSrc.match(re) ?? []) {
    if (tag.includes("{{") || tag.includes("{%")) continue
    const hrefMatch = tag.match(/href="([^"]+)"/i)
    if (!hrefMatch) continue
    const isStylesheet = /rel="(stylesheet|preconnect)"/i.test(tag)
    if (isStylesheet) links.push(tag)
  }
  return links
}

function extractBodyClass(layoutSrc: string): string {
  const m = layoutSrc.match(/<body\b[^>]*class="([^"]*)"/i)
  return m?.[1]?.replace(/\{\{[^}]*\}\}/g, "").trim() ?? ""
}

async function gatherChromeData(countryCode: string, themeHandle: string) {
  const h = await headers()
  const [settings, customer, cart, categories] = await Promise.all([
    getCmsSettings().catch(() => null),
    retrieveCustomer().catch(() => null),
    retrieveCart().catch(() => null),
    listCategories().catch(() => []),
  ])
  const data = baseContext({
    shop: {
      name: h.get("x-tenant-name") || (settings as any)?.brand_name || "Store",
      domain: h.get("x-forwarded-host") || h.get("host") || "",
      currency:
        h.get("x-tenant-currency") || (settings as any)?.currency_code || "USD",
      locale: "en",
      logo: h.get("x-tenant-logo") || (settings as any)?.header?.logo || null,
    },
    template: "chrome",
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
  ;(data as any).categories = categories
  const currency =
    h.get("x-tenant-currency") || (settings as any)?.currency_code || "USD"
  return { data, currency }
}

/** The store's active uploaded theme, or null. */
async function activeBundle() {
  const h = await headers()
  const handle = h.get("x-tenant-theme") || ""
  if (!handle) return null
  return await loadThemeBundle(handle).catch(() => null)
}

/**
 * The theme's header + footer rendered to static HTML for a React page.
 * Null when the store has no uploaded theme (base React chrome applies).
 */
export async function getLiquidChrome(
  countryCode: string
): Promise<LiquidChrome | null> {
  try {
    const bundle = await activeBundle()
    if (!bundle) return null
    const layoutSrc = bundle.files["layout/theme.liquid"] ?? ""
    const { data, currency } = await gatherChromeData(
      countryCode || "us",
      bundle.handle
    )
    const common = {
      themeId: bundle.handle,
      version: bundle.version,
      data,
      currency,
      locale: "en",
    }
    const [header, footer] = await Promise.all([
      renderThemeChrome(bundle.files, { ...common, part: "header" }),
      renderThemeChrome(bundle.files, { ...common, part: "footer" }),
    ])
    if (!header && !footer) return null
    return {
      handle: bundle.handle,
      version: bundle.version,
      header,
      footer,
      headLinks: extractHeadLinks(layoutSrc),
      cssHref: `/theme-assets/${bundle.handle}/${bundle.version}/theme.css`,
      bodyClass: extractBodyClass(layoutSrc),
    }
  } catch {
    return null
  }
}

export type ThemeBranding = {
  handle: string
  headingFont: string | null
  bodyFont: string | null
  accent: string | null
  ink: string | null
  headLinks: string[]
}

/** The active theme's design tokens for reskinning React surfaces. */
export async function getThemeBranding(): Promise<ThemeBranding | null> {
  try {
    const bundle = await activeBundle()
    if (!bundle) return null
    const tokens = (bundle.manifest as any)?.tokens ?? {}
    const colors = tokens.colors ?? {}
    const fonts = tokens.fonts ?? {}
    return {
      handle: bundle.handle,
      headingFont: typeof fonts.heading === "string" ? fonts.heading : null,
      bodyFont: typeof fonts.body === "string" ? fonts.body : null,
      accent: typeof colors.primary === "string" ? colors.primary : null,
      ink: typeof colors.dark === "string" ? colors.dark : null,
      headLinks: extractHeadLinks(bundle.files["layout/theme.liquid"] ?? ""),
    }
  } catch {
    return null
  }
}

/** Scoped stylesheet that reskins the React checkout UI with theme tokens.
 * Selectors target the storefront's own utility classes inside the branded
 * wrapper only — the checkout DOM is untouched. */
export function brandingCss(b: ThemeBranding): string {
  const safe = (v: string | null) =>
    v && /^[#a-zA-Z0-9 (),.'"%\/-]+$/.test(v) ? v : null
  const heading = safe(b.headingFont)
  const body = safe(b.bodyFont)
  const accent = safe(b.accent)
  const ink = safe(b.ink)
  const rules: string[] = []
  if (body) rules.push(`[data-theme-branded]{font-family:${body};}`)
  if (heading)
    rules.push(
      `[data-theme-branded] h1,[data-theme-branded] h2,[data-theme-branded] h3{font-family:${heading};}`
    )
  if (ink || accent) {
    const btn = ink || accent
    rules.push(
      `[data-theme-branded] .bg-black{background-color:${btn} !important;}`,
      `[data-theme-branded] .hover\\:bg-gray-800:hover{background-color:${btn} !important;filter:brightness(1.15);}`
    )
  }
  if (accent) {
    rules.push(
      `[data-theme-branded] .text-ui-fg-interactive,[data-theme-branded] .text-blue-600{color:${accent} !important;}`,
      `[data-theme-branded] .focus-visible\\:ring-2:focus-visible{--tw-ring-color:${accent};}`
    )
  }
  return rules.join("\n")
}

/** CSS that neutralizes script-driven chrome controls — no theme.js runs on
 * these surfaces, so a dead burger/menu toggle must not render at all. */
export const CHROME_STATIC_CSS =
  "[data-liquid-chrome] [data-nav-toggle]{display:none !important;}" +
  "[data-liquid-chrome] [data-mobile-nav]{display:none !important;}"

/** Parse an extracted <link ...> tag string into renderable props. */
function linkProps(tag: string): {
  rel: string
  href: string
  crossOrigin?: "anonymous"
} | null {
  const rel = tag.match(/rel="([^"]+)"/i)?.[1]
  const href = tag.match(/href="([^"]+)"/i)?.[1]
  if (!rel || !href) return null
  return {
    rel,
    href,
    crossOrigin: /crossorigin/i.test(tag) ? "anonymous" : undefined,
  }
}

/** The theme stylesheet + font/icon links + static-chrome CSS for a React
 * page that renders Liquid chrome. Browsers apply body-rendered stylesheet
 * links, so this can live inside the layout markup. */
export function LiquidChromeHead({ chrome }: { chrome: LiquidChrome }) {
  return (
    <>
      {chrome.headLinks.map((tag, i) => {
        const p = linkProps(tag)
        return p ? <link key={i} {...p} /> : null
      })}
      <link rel="stylesheet" href={chrome.cssHref} />
      <style dangerouslySetInnerHTML={{ __html: CHROME_STATIC_CSS }} />
    </>
  )
}
