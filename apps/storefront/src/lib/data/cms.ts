import "server-only"

import { cache } from "react"
import { cookies, draftMode } from "next/headers"
import { sdk } from "@lib/config"
import { getLocale } from "./locale-actions"
import type {
  AdvancedBag,
  ElementStyles,
  StyleBag,
} from "@modules/cms/render/style-engine"

/**
 * F1 CHROME STYLING — the Elementor-grade Style/Advanced + element-level bags a
 * chrome region (topbar/header/footer) may carry. Optional and diff-only: absent
 * on legacy settings, so this is fully backward compatible and yields no visual
 * change when unset. Serialized to scoped CSS by `buildChromeCss` in both the
 * editor canvas and production. Shape mirrors a section's `style` / `advanced` /
 * `elementStyles`.
 */
export interface ChromeStyleFields {
  /** Whole-bar style bag (padding/background/border …). */
  style?: StyleBag
  /** Whole-bar advanced bag (custom css/classes/anchor …). */
  advanced?: AdvancedBag
  /** Per-element overrides keyed by the element's `data-el` key. */
  elementStyles?: ElementStyles
}

/* ------------------------------------------------------------------ */
/* Settings contract (mirrors backend src/modules/cms/types.ts —       */
/* ONE RESOLVED locale slice, flat. The store API resolves the         */
/* { en, bn? } locale-map down to this shape before returning it.)     */
/* ------------------------------------------------------------------ */

export const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

/* ------------------------------------------------------------------ */
/* Active-locale resolution                                            */
/* ------------------------------------------------------------------ */

/** Content locales the CMS supports. Mirrors backend LOCALES. */
export const CMS_LOCALES = ["en", "bn"] as const
export type CmsLocale = (typeof CMS_LOCALES)[number]
/** Mirrors backend DEFAULT_LOCALE. */
export const DEFAULT_CMS_LOCALE: CmsLocale = "en"

/**
 * Normalize an arbitrary cookie/locale value to a supported CMS locale.
 * Anything that is not a known content locale collapses to the default ("en").
 * NOTE: this is DECOUPLED from countryCode/currency — it only affects which
 * locale slice of CMS content is requested, never the region or BDT pricing.
 */
export const normalizeCmsLocale = (value?: string | null): CmsLocale =>
  CMS_LOCALES.includes(value as CmsLocale)
    ? (value as CmsLocale)
    : DEFAULT_CMS_LOCALE

/**
 * Resolve the active CMS locale: use the explicit value when provided,
 * otherwise read the app locale cookie via getLocale(). Always normalized to
 * a supported content locale ("en" | "bn"), defaulting to "en".
 */
export const resolveActiveCmsLocale = async (
  explicit?: string
): Promise<CmsLocale> => {
  if (explicit) {
    return normalizeCmsLocale(explicit)
  }
  try {
    return normalizeCmsLocale(await getLocale())
  } catch {
    return DEFAULT_CMS_LOCALE
  }
}

export interface TopbarSettings extends ChromeStyleFields {
  message: string
  enabled: boolean
  language_label: string
  currency_label: string
  links: { icon: string; label: string; href: string }[]
}

export interface HeaderMenuItem {
  label: string
  href?: string
  /** manual item that ALSO renders a dynamic-category submenu */
  children_dynamic?: { source: "categories"; limit: number }
  /** present on the `__dynamic_categories__` sentinel item */
  source?: "categories"
  limit?: number
}

/** A 4-side box value emitted by the editor's DimensionsControl. */
export interface DimensionsValue {
  top?: number
  right?: number
  bottom?: number
  left?: number
  unit?: string
}

export interface HeaderSettings extends ChromeStyleFields {
  logo: string
  logo_alt: string
  /** Optional logo styling (from the Header panel). */
  logo_max_height?: { value: number; unit: string }
  logo_padding?: DimensionsValue
  logo_margin?: DimensionsValue
  search: { enabled: boolean; placeholder: string; action: string }
  icons: { account: string; wishlist: string; cart: string }
  menu: HeaderMenuItem[]
  mobile_menu_categories: { source: "categories"; limit: number | null }
}

export interface FooterSettings extends ChromeStyleFields {
  contact: {
    email: string
    phone: string
    app_buttons: { img: string; alt: string; href: string }[]
  }
  column_categories: {
    source: "categories"
    limit: number
    extra: { label: string; href: string }[]
  }
  column_links: { label: string; href: string }[]
  social: { icon: string; href: string }[]
  newsletter: { title: string; placeholder: string; button: string }
  bottom_logo: string
  payment_image: string
  copyright: string
}

export interface ThemeSettings {
  colors: {
    primary: string
    dark: string
    border: string
    text: string
    heading: string
    bg: string
  }
  fonts: { body: string; heading: string }
  /** Owner-defined color tokens (F2a). Emitted as --ff-c-<slug>. */
  custom_colors?: { name: string; value: string }[]
  /** Owner-defined font tokens (F2a). Emitted as --ff-font-c-<slug>. */
  custom_fonts?: { name: string; value: string }[]
  /** Site-wide button defaults (F2b). Compiled by buildThemeDefaultsCss. */
  button?: Record<string, unknown>
  /** Site-wide heading defaults (F2b). Compiled by buildThemeDefaultsCss. */
  headings?: Record<string, unknown>
  logo: string
}

export interface SeoDefaults {
  title: string
  title_template: string
  description: string
  og_image: string
  twitter_card: string
}

export interface ResolvedSettings {
  header: HeaderSettings
  topbar: TopbarSettings
  footer: FooterSettings
  theme: ThemeSettings
  seo_defaults: SeoDefaults
  /** Active storefront theme id (selects which compiled theme renders). */
  active_theme?: string
}

type CmsSettingsResponse = {
  settings: ResolvedSettings
  locale: string
  resolved_locale: string
}

/* ------------------------------------------------------------------ */
/* Inline fallback defaults (the CURRENT hardcoded Learts values).     */
/* Used when the store API is unreachable so the chrome never breaks.  */
/* Kept in sync with backend DEFAULT_SETTINGS / phase-0 doc §11.1.     */
/* ------------------------------------------------------------------ */

export const CMS_DEFAULTS: ResolvedSettings = {
  topbar: {
    message: "Free shipping for orders over $59 !",
    enabled: true,
    language_label: "English",
    currency_label: "BDT",
    links: [
      { icon: "fa-map-marker-alt", label: "Store Location", href: "#" },
      { icon: "fa-truck", label: "Order Status", href: "/account" },
    ],
  },
  header: {
    logo: "/learts/assets/images/logo/forever-finds.png",
    logo_alt: "Forever Finds",
    search: {
      enabled: true,
      placeholder: "Search products…",
      action: "/store?q=",
    },
    icons: { account: "/account", wishlist: "/wishlist", cart: "/cart" },
    menu: [
      { label: "Home", href: "/" },
      {
        label: "Shop",
        href: "/store",
        children_dynamic: { source: "categories", limit: 8 },
      },
      { label: DYNAMIC_CATEGORIES_TOKEN, source: "categories", limit: 3 },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
    mobile_menu_categories: { source: "categories", limit: null },
  },
  footer: {
    contact: {
      email: "contact@foreverfinds.com",
      phone: "(+88) 123 4566 6868",
      app_buttons: [
        {
          img: "/learts/assets/images/others/android.webp",
          alt: "Android app",
          href: "#",
        },
        {
          img: "/learts/assets/images/others/ios.webp",
          alt: "iOS app",
          href: "#",
        },
      ],
    },
    column_categories: {
      source: "categories",
      limit: 5,
      extra: [{ label: "Flash sale", href: "/store" }],
    },
    column_links: [
      { label: "About us", href: "#" },
      { label: "Store location", href: "#" },
      { label: "Contact", href: "/contact" },
      { label: "Support Policy", href: "#" },
      { label: "FAQs", href: "#" },
    ],
    social: [
      { icon: "fa-twitter", href: "https://www.twitter.com/" },
      { icon: "fa-facebook-f", href: "https://www.facebook.com/" },
      { icon: "fa-instagram", href: "https://www.instagram.com/" },
      { icon: "fa-youtube", href: "https://www.youtube.com/" },
    ],
    newsletter: {
      title: "Newsletter",
      placeholder: "Enter your e-mail address",
      button: "subscibe",
    },
    bottom_logo: "/learts/assets/images/logo/forever-finds.png",
    payment_image: "/learts/assets/images/others/pay.webp",
    copyright: "© {year} Forever Finds. All Rights Reserved",
  },
  theme: {
    colors: {
      primary: "#72a499",
      dark: "#1f1f1f",
      border: "#e5e5e5",
      text: "#333",
      heading: "#1f1f1f",
      bg: "#fff",
    },
    fonts: { body: "Jost, sans-serif", heading: "Marcellus, serif" },
    logo: "/learts/assets/images/logo/forever-finds.png",
  },
  seo_defaults: {
    title: "Forever Finds",
    title_template: "%s | Forever Finds",
    description: "Online shop for handicrafts and arts' works based in the US.",
    og_image: "/learts/assets/images/logo/forever-finds.png",
    twitter_card: "summary_large_image",
  },
  active_theme: "learts",
}

/* ------------------------------------------------------------------ */
/* Fetcher                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetch the resolved global CMS settings from the store API.
 *
 * - Uses a GLOBAL cache tag ["cms-settings"] (single tag for all chrome).
 * - Does NOT use getCacheOptions / the per-browser cacheId suffix — that would
 *   break server-side on-demand revalidation (see src/lib/data/cookies.ts).
 * - Phase 6: TAG-BASED on-demand revalidation. The response is cached under the
 *   GLOBAL tag ["cms-settings"] (no `no-store`); a settings publish emits
 *   `cms.published` on the backend, whose subscriber POSTs /api/cms/revalidate
 *   here, which calls revalidateTag("cms-settings") to purge exactly this entry.
 *
 * Wrapped in React `cache()` so the header, footer and root layout share a
 * single request-scoped fetch instead of hitting the API three times.
 *
 * Never throws: on any failure it returns the inline CMS_DEFAULTS so the
 * storefront chrome renders identically to its previous hardcoded state.
 */
const MULTI_TENANT =
  process.env.MULTI_TENANT === "1" || process.env.MULTI_TENANT === "true"

/**
 * Resolve the current request's tenant id from the middleware-injected
 * `x-tenant-id` header (same source as getCacheOptions / maybeBrandForTenant).
 * Fail-safe: returns "" when unknown or outside a request scope, so callers
 * fall back to the legacy GLOBAL tag/behavior instead of crashing.
 */
export async function currentTenantId(): Promise<string> {
  if (!MULTI_TENANT) return ""
  try {
    const { headers } = await import("next/headers")
    return (await headers()).get("x-tenant-id") || ""
  } catch {
    return ""
  }
}

/**
 * Multi-tenant cache options for a GLOBAL CMS fetch on the pooled storefront.
 *
 * Two problems this fixes on a shared Next server:
 *  1. SERVE: the tenant is only a request HEADER (publishable key), which Next
 *     does NOT include in the Data Cache key — so a cached `/store/cms/...`
 *     response could be served across tenants. In MT we therefore render these
 *     fetches dynamically (`revalidate: 0`), exactly as getCacheOptions does.
 *  2. REVALIDATE: the caller tags each fetch per-tenant so one store's publish
 *     only purges its own entry (see /api/cms/revalidate + cms.published sub).
 *
 * Single-tenant: unchanged — the original GLOBAL tags, cached until a publish
 * revalidates them.
 */
export function cmsCacheOptions(
  tags: string[]
): { tags: string[] } | { revalidate: number; tags: string[] } {
  return MULTI_TENANT ? { revalidate: 0, tags } : { tags }
}

/** GLOBAL settings tag, tenant-suffixed on the pooled server. */
function cmsSettingsTag(tenantId: string): string {
  return tenantId ? `cms-settings-${tenantId}` : "cms-settings"
}

/**
 * Per-page cache tags, tenant-prefixed on the pooled server. Must match EXACTLY
 * the tags the backend cms.published subscriber purges (buildTags).
 */
function cmsPageTags(tenantId: string, slug: string, locale: string): string[] {
  return tenantId
    ? [`cms-page-${tenantId}-${slug}`, `cms-page-${tenantId}-${slug}-${locale}`]
    : [`cms-page-${slug}`, `cms-page-${slug}-${locale}`]
}

/**
 * A tenant has no uploaded logo image, so render its NAME as a lightweight
 * inline-SVG "text logo" data URI. Drops straight into the existing
 * `<img src={header.logo}>` in every theme — no theme-component changes.
 */
function textLogoDataUri(name: string): string {
  const label = (name || "Store").replace(/[<>&"]/g, "").slice(0, 40) || "Store"
  const w = Math.max(90, Math.min(380, label.length * 15 + 24))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40"><text x="4" y="28" font-family="Marcellus, Georgia, serif" font-size="24" fill="#1f1f1f">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * A logo value that is still the Forever Finds default (or empty) — i.e. the
 * store owner has NOT uploaded their own logo. These must never render on a
 * tenant store; they get replaced with the tenant's own text logo.
 */
const isDefaultLogo = (v?: string): boolean =>
  !v || v.trim() === "" || v.includes("forever-finds")

/**
 * True when a text field is empty OR still equals the known Forever Finds
 * default (the value the CMS ships out of the box). Used to decide whether a
 * field is safe to blank/rebrand: a value the store owner actually customized
 * (anything NOT equal to the FF default) is always preserved.
 */
const isFFDefault = (v: string | undefined, def: string): boolean =>
  !v || v.trim() === "" || v.trim() === def

/**
 * Replace the (Forever Finds) branding fields with the tenant's own identity.
 * A store-customized logo (anything the owner uploaded, i.e. NOT the FF default)
 * is preserved untouched; only the FF-default/empty logos are swapped for the
 * tenant's text logo so a pooled store never shows "Forever Finds". Likewise the
 * FF default topbar/footer COPY (promo message, currency/language labels,
 * contact email/phone) is blanked so a tenant never shows Forever Finds' own
 * strings — while any value the owner customized is kept verbatim.
 */
export function applyTenantBranding(
  s: ResolvedSettings,
  name: string
): ResolvedSettings {
  const textLogo = textLogoDataUri(name)
  // Per-region logo: keep the owner's custom image, else use the text logo.
  const headerLogo = isDefaultLogo(s.header?.logo) ? textLogo : s.header.logo
  const themeLogo = isDefaultLogo(s.theme?.logo) ? textLogo : s.theme.logo
  const bottomLogo = isDefaultLogo(s.footer?.bottom_logo)
    ? textLogo
    : s.footer.bottom_logo

  // Scrub FF default topbar copy: blank the promo message (never invent a
  // shipping promise) and the currency/language labels (a wrong hardcoded label
  // is worse than none). Owner customizations are preserved.
  const topbar: TopbarSettings = {
    ...s.topbar,
    message: isFFDefault(s.topbar?.message, CMS_DEFAULTS.topbar.message)
      ? ""
      : s.topbar.message,
    currency_label: isFFDefault(
      s.topbar?.currency_label,
      CMS_DEFAULTS.topbar.currency_label
    )
      ? ""
      : s.topbar.currency_label,
    language_label: isFFDefault(
      s.topbar?.language_label,
      CMS_DEFAULTS.topbar.language_label
    )
      ? ""
      : s.topbar.language_label,
  }

  // Scrub FF default footer contact info (a tenant must not show FF's email /
  // phone). Owner-set contact details are preserved.
  const footerContact: FooterSettings["contact"] = {
    ...s.footer.contact,
    email: isFFDefault(
      s.footer?.contact?.email,
      CMS_DEFAULTS.footer.contact.email
    )
      ? ""
      : s.footer.contact.email,
    phone: isFFDefault(
      s.footer?.contact?.phone,
      CMS_DEFAULTS.footer.contact.phone
    )
      ? ""
      : s.footer.contact.phone,
  }

  return {
    ...s,
    topbar,
    header: { ...s.header, logo: headerLogo, logo_alt: name },
    theme: { ...s.theme, logo: themeLogo },
    footer: {
      ...s.footer,
      contact: footerContact,
      bottom_logo: bottomLogo,
      copyright: `© {year} ${name}. All Rights Reserved`,
    },
    seo_defaults: {
      ...s.seo_defaults,
      title: name,
      title_template: `%s | ${name}`,
      og_image: isDefaultLogo(s.seo_defaults?.og_image)
        ? textLogo
        : s.seo_defaults.og_image,
      description: `${name} — shop online.`,
    },
  }
}

/** Multi-tenant: rebrand resolved settings to the current request's tenant. */
async function maybeBrandForTenant(
  s: ResolvedSettings
): Promise<ResolvedSettings> {
  if (!MULTI_TENANT) return s
  try {
    const { headers } = await import("next/headers")
    const name = (await headers()).get("x-tenant-name")
    if (name && name.trim()) return applyTenantBranding(s, name.trim())
  } catch {}
  return s
}

export const getCmsSettings = cache(
  async (locale?: string): Promise<ResolvedSettings> => {
    const resolvedLocale = await resolveActiveCmsLocale(locale)

    let base: ResolvedSettings
    try {
      // Pooled multi-tenant: tag per tenant ("cms-settings-<tenantId>") and
      // render dynamically so one store's cached chrome is never served to
      // another. Single-tenant: the legacy GLOBAL "cms-settings" tag, cached
      // until a publish revalidates it via /api/cms/revalidate (Phase 6).
      const tenantId = await currentTenantId()
      const { settings } = await sdk.client.fetch<CmsSettingsResponse>(
        "/store/cms/settings",
        {
          method: "GET",
          // `lang` (not `locale` — Medusa reserves/strips that query param).
          query: { lang: resolvedLocale },
          next: cmsCacheOptions([cmsSettingsTag(tenantId)]),
        }
      )

      base = settings ?? CMS_DEFAULTS
    } catch {
      base = CMS_DEFAULTS
    }
    // Multi-tenant: stamp the tenant's own name/logo over the defaults so a
    // pooled store never shows "Forever Finds". No-op in single-tenant mode.
    return maybeBrandForTenant(base)
  }
)

/* ------------------------------------------------------------------ */
/* CMS Pages (publish-snapshot read model)                             */
/* ------------------------------------------------------------------ */

/**
 * One compiled block as stored in a published snapshot. `block_type` selects the
 * storefront component (see modules/cms/section-renderer); the rest of the keys
 * are the RESOLVED block data spread inline. Kept intentionally open so new
 * Phase 4 block types need no change here.
 */
export interface CmsBlock {
  block_type: string
  schema_version: number
  [key: string]: unknown
}

export interface CmsPageSeo {
  title: string | null
  description: string | null
  keywords: string | null
  og_image: string | null
  canonical_url: string | null
}

/** The compiled page payload returned by GET /store/cms/pages/:slug. */
export interface CmsPageData {
  slug: string
  /** The locale that was requested. */
  locale: string
  /** The locale actually served (differs from `locale` on fallback to en). */
  resolved_locale: string
  version: number
  sections: CmsBlock[]
  seo: CmsPageSeo
  meta?: {
    entity_type: string
    entity_id: string
    title?: string
    is_home?: boolean
    compiled_at?: string
  }
}

type CmsPageResponse = { page: CmsPageData }

/** Global cache tag for a CMS page (NO per-browser cacheId — see getCmsSettings). */
export const getCmsPageCacheTag = (slug: string) => `cms-page-${slug}`

/* ------------------------------------------------------------------ */
/* Preview / draft mode (Next 15 draftMode)                            */
/* ------------------------------------------------------------------ */

/** Cookie names stashed by /api/cms/preview when entering preview mode. */
const PREVIEW_TOKEN_COOKIE = "_cms_preview_token"
const PREVIEW_SLUG_COOKIE = "_cms_preview_slug"
const PREVIEW_LOCALE_COOKIE = "_cms_preview_locale"

/**
 * When Next draftMode is enabled AND this `slug` is the page being previewed,
 * fetch the freshly-compiled DRAFT from the token-gated backend endpoint
 * (GET /store/cms/pages/:slug/draft?token=...&lang=...) forced fresh (no cache),
 * so editors see unpublished changes without writing a snapshot.
 *
 * Return contract (lets getCmsPage stay a thin wrapper):
 *  - `undefined` → not in preview for this slug; caller fetches the live snapshot
 *  - `null`      → in preview but the draft fetch failed (token invalid / 404)
 *  - CmsPageData → compiled draft content (shape mirrors the live read)
 */
const getDraftCmsPage = async (
  slug: string
): Promise<CmsPageData | null | undefined> => {
  let enabled = false
  try {
    enabled = (await draftMode()).isEnabled
  } catch {
    return undefined
  }
  if (!enabled) {
    return undefined
  }

  let token: string | undefined
  let previewSlug: string | undefined
  let previewLocale: string | undefined
  try {
    const store = await cookies()
    token = store.get(PREVIEW_TOKEN_COOKIE)?.value
    previewSlug = store.get(PREVIEW_SLUG_COOKIE)?.value
    previewLocale = store.get(PREVIEW_LOCALE_COOKIE)?.value
  } catch {
    return undefined
  }

  // Only intercept the page that is actually being previewed; any other slug
  // rendered in the same request falls through to its live snapshot.
  if (!token || previewSlug !== slug) {
    return undefined
  }

  // The token is signed for a specific locale — fetch that exact locale so the
  // backend's verifyPreviewToken claim check (claims.locale === expected) passes.
  const draftLocale = normalizeCmsLocale(previewLocale)

  try {
    const { page } = await sdk.client.fetch<CmsPageResponse>(
      `/store/cms/pages/${slug}/draft`,
      {
        method: "GET",
        // `token` authorizes the draft read; `lang` (not the reserved `locale`).
        query: { token, lang: draftLocale },
        // Pass locale via the header too (header > lang on the backend).
        headers: { "x-medusa-locale": draftLocale },
        // Never cache draft reads — always reflect the current draft.
        cache: "no-store",
      }
    )

    return page ?? null
  } catch {
    // Bad/expired token (401), no page (404) or transport error.
    return null
  }
}

/**
 * Fetch the live published snapshot for a CMS page (with en fallback handled by
 * the store API). Returns `null` when no snapshot exists (404) or on any error,
 * so callers can fall back to hardcoded content with NO regression.
 *
 * - Preview: when Next draftMode is enabled and this slug is being previewed,
 *   serves the freshly-compiled DRAFT (token-authed, uncached) instead.
 * - GLOBAL cache tags (`cms-page-<slug>`, `cms-page-<slug>-<locale>`) — never
 *   routed through getCacheOptions / the per-browser cacheId suffix, so a
 *   server-side `revalidateTag` on publish actually purges them.
 * - Phase 6: TAG-BASED on-demand revalidation (no `no-store`). A publish emits
 *   `cms.published`; the subscriber POSTs /api/cms/revalidate which purges the
 *   matching tag(s).
 *
 * Wrapped in React `cache()` for request-scoped de-duplication.
 */
export const getCmsPage = cache(
  async (slug: string, locale?: string): Promise<CmsPageData | null> => {
    // Preview short-circuit (only for the slug currently under preview).
    const draft = await getDraftCmsPage(slug)
    if (draft !== undefined) {
      return draft
    }

    const resolvedLocale = await resolveActiveCmsLocale(locale)

    try {
      // Pooled multi-tenant: tenant-prefixed tags ("cms-page-<tenantId>-<slug>")
      // and dynamic rendering so a cached page is never served across tenants;
      // a publish purges only this tenant's tags. Single-tenant: legacy GLOBAL
      // tags, cached until a publish revalidates them.
      const tenantId = await currentTenantId()
      const { page } = await sdk.client.fetch<CmsPageResponse>(
        `/store/cms/pages/${slug}`,
        {
          method: "GET",
          // `lang` (not `locale` — Medusa reserves/strips that query param).
          query: { lang: resolvedLocale },
          next: cmsCacheOptions(cmsPageTags(tenantId, slug, resolvedLocale)),
        }
      )

      return page ?? null
    } catch {
      // 404 (no live snapshot) or transport error → caller falls back.
      return null
    }
  }
)
