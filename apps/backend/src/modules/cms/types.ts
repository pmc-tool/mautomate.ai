/**
 * Forever Finds CMS — shared types & const unions.
 *
 * Phase 1 scope: global settings singletons only (header / topbar / footer /
 * theme / seo_defaults). BLOCK_TYPES is defined here now for forward-compat
 * (pages/sections land in a later phase) but is NOT used yet.
 *
 * LOCALIZATION CONTRACT (the settings exception — see phase-0-architecture.md §2.6, §6):
 *   cms_setting.data is stored as a TOP-LEVEL LOCALE MAP:
 *       { en: <FullSettings>, bn?: <Partial<FullSettings>> }
 *   - `en` always holds the complete default-locale object.
 *   - `bn` (and any future non-default locale) holds a SPARSE override.
 *   - Resolve at read time:  deepMerge(defaults, data.en, data[locale])
 *     so any key missing from `bn` falls back to `en`, and any key missing from
 *     `en` falls back to the inline DEFAULT_SETTINGS (store API never 500s).
 *
 * The per-setting interfaces below (HeaderSettings, TopbarSettings, …) describe
 * ONE RESOLVED locale slice (flat). The store API returns this resolved flat
 * shape; the admin API reads/writes the raw locale-map wrapper.
 */

/* ------------------------------------------------------------------ */
/* Const unions (app-side validation — not DB enums)                   */
/* ------------------------------------------------------------------ */

// Forward-compat only — no block models exist in Phase 1.
export const BLOCK_TYPES = [
  "announcement_bar",
  "hero_slider",
  "promo_banner_grid",
  "product_tabs",
  "deal_of_day",
  "category_showcase",
  "brand_strip",
  "rich_text",
  "image_with_text",
  "newsletter",
  "instagram_grid",
  "testimonials",
  "container",
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const LOCALES = ["en", "bn"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

// The 5 global singleton keys (these ARE a DB enum on cms_setting.key).
export const SETTING_KEYS = [
  "header",
  "topbar",
  "footer",
  "theme",
  "seo_defaults",
] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v)

export const isSettingKey = (v: unknown): v is SettingKey =>
  typeof v === "string" && (SETTING_KEYS as readonly string[]).includes(v)

/* ------------------------------------------------------------------ */
/* Locale-map wrapper (how data is STORED in cms_setting.data)         */
/* ------------------------------------------------------------------ */

export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T

/**
 * The stored shape of cms_setting.data. `en` is the full object; non-default
 * locales are sparse overrides merged over `en` at read time.
 */
export type LocaleMap<T> = { en: T } & {
  [L in Exclude<Locale, "en">]?: DeepPartial<T>
}

/* ------------------------------------------------------------------ */
/* Per-setting RESOLVED (flat, single-locale) data shapes              */
/* ------------------------------------------------------------------ */

/** topbar / announcement_bar singleton */
export interface TopbarSettings {
  message: string
  enabled: boolean
  language_label: string
  currency_label: string
  links: { icon: string; label: string; href: string }[]
}

/**
 * Header menu item — HYBRID navigation (see §11.1).
 * Three independent live-category limits are preserved:
 *   - a manual item with `children_dynamic` (e.g. Shop submenu, limit 8)
 *   - a sentinel item `label:"__dynamic_categories__"` that expands to top-level
 *     category links (limit 3)
 *   - `header.mobile_menu_categories` for the mobile offcanvas (all categories)
 */
export interface HeaderMenuItem {
  label: string
  href?: string
  /** manual item that also renders a dynamic-category submenu */
  children_dynamic?: { source: "categories"; limit: number }
  /** present on the `__dynamic_categories__` sentinel item */
  source?: "categories"
  limit?: number
}

export const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

export interface HeaderSettings {
  logo: string
  logo_alt: string
  search: { enabled: boolean; placeholder: string; action: string }
  icons: { account: string; wishlist: string; cart: string }
  menu: HeaderMenuItem[]
  mobile_menu_categories: { source: "categories"; limit: number | null }
}

export interface FooterSettings {
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
  /**
   * Brand tokens (U7 — explicit null-inherit): `null` = inherit the active
   * theme's manifest token; a string is a merchant override. Tenants still on
   * the legacy shape store the concrete FF-default strings (sentinels), which
   * the storefront's dual-reader treats as inherit. The resolver deep-merges
   * DEFAULT_SETTINGS under the stored slice, so absent keys surface as the
   * legacy defaults while stored `null`s survive to the wire.
   */
  colors: {
    primary: string | null
    dark: string | null
    border: string | null
    text: string | null
    heading: string | null
    bg: string | null
  }
  fonts: { body: string | null; heading: string | null }
  logo: string
}

export interface SeoDefaults {
  title: string
  title_template: string
  description: string
  og_image: string
  twitter_card: string
}

/** Maps each setting key to its resolved (flat) data shape. */
export interface SettingDataMap {
  header: HeaderSettings
  topbar: TopbarSettings
  footer: FooterSettings
  theme: ThemeSettings
  seo_defaults: SeoDefaults
}

/** The resolved bundle returned by the store API. */
export type ResolvedSettings = {
  [K in SettingKey]: SettingDataMap[K]
}

/* ------------------------------------------------------------------ */
/* Inline defaults — store API falls back to these so it never 500s.   */
/* Values are the `en` seed verbatim from phase-0-architecture.md §11.1 */
/* ------------------------------------------------------------------ */

export const DEFAULT_SETTINGS: ResolvedSettings = {
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
    icons: { account: "/account", wishlist: "/account", cart: "/cart" },
    menu: [
      { label: "Home", href: "/" },
      {
        label: "Shop",
        href: "/store",
        children_dynamic: { source: "categories", limit: 8 },
      },
      { label: DYNAMIC_CATEGORIES_TOKEN, source: "categories", limit: 3 },
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
    description:
      "Online shop for handicrafts and arts' works based in the US.",
    og_image: "/learts/assets/images/logo/forever-finds.png",
    twitter_card: "summary_large_image",
  },
}

/* ------------------------------------------------------------------ */
/* Resolution helper (used by the store API)                           */
/* ------------------------------------------------------------------ */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/**
 * Deep-merge `source` over `target` (arrays are replaced wholesale, not merged —
 * a localized `menu`/`links` override fully supersedes the base array).
 */
export function deepMerge<T>(target: T, source: DeepPartial<T> | undefined): T {
  if (source === undefined || source === null) {
    return target
  }
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return (source as unknown as T) ?? target
  }
  const out: Record<string, unknown> = { ...target }
  for (const key of Object.keys(source)) {
    const sVal = (source as Record<string, unknown>)[key]
    const tVal = out[key]
    if (isPlainObject(tVal) && isPlainObject(sVal)) {
      out[key] = deepMerge(tVal, sVal as DeepPartial<typeof tVal>)
    } else if (sVal !== undefined) {
      out[key] = sVal
    }
  }
  return out as T
}

/**
 * Resolve a stored locale-map for one setting key down to a flat object for
 * `locale`, with per-field fallback: DEFAULT_SETTINGS → data.en → data[locale].
 */
export function resolveSetting<K extends SettingKey>(
  key: K,
  data: Partial<LocaleMap<SettingDataMap[K]>> | null | undefined,
  locale: Locale
): SettingDataMap[K] {
  let resolved = DEFAULT_SETTINGS[key]
  if (data && isPlainObject(data)) {
    if (data.en) {
      resolved = deepMerge(resolved, data.en as DeepPartial<SettingDataMap[K]>)
    }
    if (locale !== DEFAULT_LOCALE && data[locale]) {
      resolved = deepMerge(
        resolved,
        data[locale] as DeepPartial<SettingDataMap[K]>
      )
    }
  }
  return resolved
}
