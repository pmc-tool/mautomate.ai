/**
 * Admin-side theme catalog — metadata mirror of the storefront theme registry
 * (apps/storefront/src/themes/registry.ts). The storefront owns the real theme
 * (components + tokens); the admin only needs id/name/description/preview to
 * render the gallery and persist the selected id as the `active_theme` setting.
 *
 * When a new theme is added to the storefront registry, add its metadata here
 * too (the two are kept in sync by hand — themes are code, added by developers).
 */
export type ThemeCatalogEntry = {
  id: string
  name: string
  description: string
  /** Preview image path served by the storefront (public/). */
  preview: string
}

/* EMPTY since 2026-07-18: every compiled React theme (aurora/cignet/shofy/
   ekka/helendo/bazaro/exzo/rokon) was ported to an UPLOADED Liquid theme
   (handle `<name>-liquid`) and its React code deleted. The merchant gallery
   (/merchant/themes) and Jarvis list uploaded themes from the theme module;
   this catalog remains only so a future compiled theme could be added. */
export const THEME_CATALOG: ThemeCatalogEntry[] = []

// The compiled React "learts" is RETIRED — its Liquid successor "learts-liquid"
// (an uploaded theme) is the platform default. Old learts is no longer a
// selectable compiled theme; it survives only as the internal React chrome
// fallback for checkout/account, never as an active theme a merchant can pick.
export const DEFAULT_THEME_ID = "learts-liquid"

export const isKnownTheme = (id: string): boolean =>
  THEME_CATALOG.some((t) => t.id === id)

/** Build a catalog with absolute preview URLs pointing at the storefront. */
export function catalogWithPreviewUrls(storefrontUrl: string) {
  const base = storefrontUrl.replace(/\/$/, "")
  return THEME_CATALOG.map((t) => ({
    ...t,
    preview_url: `${base}${t.preview}`,
  }))
}
