/* ------------------------------------------------------------------ */
/* CMS Element Registry — per-block list of stylable elements           */
/*                                                                     */
/* Element-level editing (phase E1) lets the user click a specific       */
/* element INSIDE a section (e.g. the hero heading / button / image) and  */
/* style it as a per-element override. This registry declares, per block   */
/* type, WHICH elements are stylable and how to label them in the panel.    */
/*                                                                        */
/* The block's renderer must tag each declared element with the matching   */
/* `data-el="<key>"` attribute; the style-engine then emits rules scoped    */
/* to `.cms-sec-<id> [data-el="<key>"]` from `section.elementStyles[key]`.  */
/*                                                                        */
/* E1 ships the hero (`hero_slider`) only; other blocks are added in E2.    */
/* Backward compatible: a block with no entry has NO stylable elements, so   */
/* nothing changes for it.                                                   */
/* ------------------------------------------------------------------ */

/** One stylable element within a block: its `data-el` key + panel label. */
export type ElementDef = { key: string; label: string }

/**
 * Map of `block_type` → the elements a user may style inside it. The `key`
 * matches the `data-el="<key>"` attribute the renderer puts on the element and
 * the key used in `section.elementStyles`. `label` is shown in the editor's
 * element picker / panel header.
 */
export const ELEMENT_REGISTRY: Record<string, ElementDef[]> = {
  hero_slider: [
    { key: "image", label: "Slide (background)" },
    { key: "content", label: "Slide Content Box" },
    { key: "kicker", label: "Kicker" },
    { key: "title", label: "Heading" },
    { key: "button", label: "Button" },
  ],
  promo_banner_grid: [
    // The intro BOX itself, not just the words in it. A merchant who says "change
    // the background of the intro" means this element — and until it was
    // registered (and given a data-el hook) the editor had nothing to select, so
    // the background simply could not be changed at all.
    { key: "intro", label: "Intro Box" },
    { key: "title", label: "Intro Title" },
    { key: "body", label: "Intro Text" },
    { key: "button", label: "Intro Link" },
    { key: "sale", label: "Sale Banner" },
    { key: "item", label: "Category Tile" },
    { key: "instagram", label: "Instagram Tile" },
  ],
  deal_of_day: [
    // The product photo is the biggest thing in this section and was not
    // selectable at all — the merchant could not touch it.
    { key: "image", label: "Product Image" },
    { key: "content", label: "Content Box" },
    { key: "title", label: "Title" },
    { key: "text", label: "Description" },
    { key: "countdown", label: "Countdown" },
    { key: "button", label: "Button" },
  ],
  brand_strip: [
    { key: "title", label: "Title" },
    { key: "logo", label: "Brand Logo" },
  ],
  rich_text: [
    { key: "content", label: "Content" },
  ],
  image_with_text: [
    { key: "image", label: "Image" },
    { key: "heading", label: "Heading" },
    { key: "text", label: "Text" },
    { key: "button", label: "Button" },
  ],
  newsletter: [
    { key: "heading", label: "Heading" },
    { key: "text", label: "Text" },
    { key: "form", label: "Signup Form" },
    { key: "input", label: "Email Input" },
    { key: "button", label: "Button" },
  ],
  instagram_grid: [
    { key: "title", label: "Title" },
    { key: "item", label: "Photo" },
  ],
  testimonials: [
    { key: "item", label: "Testimonial" },
    { key: "quote", label: "Quote" },
    { key: "author", label: "Author" },
  ],
  product_tabs: [
    { key: "tab", label: "Tab" },
    { key: "card", label: "Product Card" },
    { key: "image", label: "Product Image" },
    { key: "card_title", label: "Product Name" },
    { key: "price", label: "Price" },
  ],
  category_showcase: [
    { key: "title", label: "Title" },
    { key: "tile", label: "Category Tile" },
    { key: "image", label: "Tile Image" },
    { key: "label", label: "Tile Label" },
  ],
  image_gallery: [
    { key: "heading", label: "Heading" },
    { key: "subheading", label: "Sub-heading" },
    { key: "item", label: "Image" },
    { key: "caption", label: "Caption" },
  ],
}

/**
 * Return the stylable elements declared for a block type, or `[]` when the
 * block has none registered. Never throws.
 */
export function getElementDefs(blockType: string | undefined | null): ElementDef[] {
  if (!blockType) {
    return []
  }
  return ELEMENT_REGISTRY[blockType] ?? []
}

/* ------------------------------------------------------------------ */
/* Chrome element registry (header / top bar / footer)                  */
/*                                                                     */
/* Chrome regions are the fixed set "topbar" | "header" | "footer".      */
/* Each declares the inner elements a user may style at the element      */
/* level; the region renderer tags each with `data-el="<key>"` and the   */
/* style-engine emits rules scoped to                                    */
/* `.cms-chrome-<region> [data-el="<key>"]` from                         */
/* `chrome[region].elementStyles[key]`.                                  */
/* ------------------------------------------------------------------ */

/** The three chrome regions. Mirrors `ChromeRegion` in the style-engine. */
export type ChromeRegion = "topbar" | "header" | "footer"

/**
 * Map of chrome `region` → the elements a user may style inside it. Keys match
 * the `data-el="<key>"` attribute the region renderer applies and the key used
 * in `chrome[region].elementStyles`. Element-level styling is COMPLEMENTARY to
 * any existing targeted content fields (e.g. the header logo).
 */
export const CHROME_ELEMENT_REGISTRY: Record<ChromeRegion, ElementDef[]> = {
  topbar: [
    { key: "message", label: "Message" },
    { key: "links", label: "Links" },
  ],
  header: [
    { key: "logo", label: "Logo" },
    { key: "search", label: "Search" },
    { key: "icons", label: "Icons" },
    { key: "menu", label: "Menu" },
  ],
  footer: [
    { key: "heading", label: "Column Heading" },
    { key: "columns", label: "Columns" },
    { key: "newsletter", label: "Newsletter" },
    { key: "social", label: "Social Icons" },
    { key: "copyright", label: "Copyright" },
  ],
}

/**
 * Return the stylable elements declared for a chrome region, or `[]` when the
 * region is unknown. Never throws.
 */
export function getChromeElementDefs(
  region: ChromeRegion | string | undefined | null
): ElementDef[] {
  if (!region) {
    return []
  }
  return CHROME_ELEMENT_REGISTRY[region as ChromeRegion] ?? []
}

export default ELEMENT_REGISTRY
