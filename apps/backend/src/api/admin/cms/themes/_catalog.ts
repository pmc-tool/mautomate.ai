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

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    id: "learts",
    name: "Learts",
    description:
      "The original Forever Finds design — a warm, handcrafted gift-shop look.",
    preview: "/themes/learts/preview.png",
  },
  {
    id: "aurora",
    name: "Aurora",
    description:
      "A modern, minimalist editorial design — generous whitespace, clean type, monochrome palette.",
    preview: "/themes/aurora/preview.png",
  },
  {
    id: "cignet",
    name: "Cignet",
    description:
      "Elegant jewellery-store design - deep green and ivory, Playfair Display serifs, editorial product layouts.",
    preview: "/themes/cignet/preview.png",
  },
  {
    id: "shofy",
    name: "Shofy",
    description:
      "Bright multipurpose electronics-store design - vivid blue accents, Jost type, dense product grids.",
    preview: "/themes/shofy/preview.png",
  },
  {
    id: "ekka",
    name: "Ekka",
    description:
      "Modern multipurpose ecommerce design - crisp white layout, Poppins type, blue accents, dense card-based product grids.",
    preview: "/themes/ekka/preview.png",
  },
  {
    id: "helendo",
    name: "Helendo",
    description:
      "Minimalist furniture-store design - airy white layouts, black type with gold accents, editorial featured-product sections.",
    preview: "/themes/helendo/preview.png",
  },
  {
    id: "bazaro",
    name: "Bazaro",
    description:
      "Refined fashion-store design - black on white with red accents, Satoshi type, airy editorial layouts.",
    preview: "/themes/bazaro/preview.png",
  },
  {
    id: "exzo",
    name: "Exzo",
    description:
      "Energetic electronics-store design - lime green on white, bold uppercase Raleway headlines, pill buttons and full-height product heroes.",
    preview: "/themes/exzo/preview.png",
  },
  {
    id: "rokon",
    name: "Rokon",
    description:
      "Bold product-led design - red accent on near-black ink, Rubik and Work Sans type, tech-store energy.",
    preview: "/themes/rokon/preview.png",
  },
]

export const DEFAULT_THEME_ID = "learts"

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
