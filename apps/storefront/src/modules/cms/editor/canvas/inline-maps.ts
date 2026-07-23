/* ------------------------------------------------------------------ */
/* Inline-edit field maps (CANVAS P6 / seat 3B — ARCH-CANVAS §6).       */
/*                                                                     */
/* THEMED sections render markup the platform does not author — the     */
/* theme's own Liquid (or its React fallback twin). The only stable     */
/* addresses in that markup are the `data-el="<key>"` styling markers    */
/* the element registry already standardizes across every theme, plus   */
/* the `data-el-item="<field>:<i>"` repeated-item markers. This module  */
/* declares, per block type, WHICH of those elements carry a directly   */
/* type-where-you-see-it text field, and the settings path it commits   */
/* to. The keys mirror ELEMENT_REGISTRY (render/element-registry.ts);   */
/* the paths mirror the block schemas (schema/blocks/*).                */
/*                                                                     */
/* A block or element with NO entry here simply has no inline           */
/* affordance — it stays panel-edited, exactly as today. That is the    */
/* deliberate v1 contract: maps are added block-by-block, the theme     */
/* package format does not change, and no theme is re-uploaded          */
/* (ARCH-CANVAS §6 mechanic 1 — the marker contract is already in the   */
/* themes' data-el audit surface, Phase 6A).                            */
/*                                                                     */
/* Entry semantics:                                                     */
/*   path       settings path on the HOST (the facade's inner widget,   */
/*              a commerce widget in a column, or a flat legacy         */
/*              section). For itemField entries it is the path WITHIN   */
/*              one item; inline.ts prefixes `<itemField>.<i>.`.        */
/*   mode       "plain" — the DOM node's visible text is the value      */
/*              (markup cannot enter the document at all);              */
/*              "rich"  — innerHTML through the shared                  */
/*              @lib/util/sanitize-html before dispatch (the shell/     */
/*              server sanitize again downstream — layered defense).    */
/*   multiline  plain entries backed by a textarea field (rendered      */
/*              with real line breaks): Enter inserts a newline.        */
/*              Single-line entries commit on Enter instead.            */
/*   itemField  the repeated-array prop whose `data-el-item` index      */
/*              addresses the item ("slides:2" → slides.2.<path>).      */
/*              Activation REQUIRES the marker: no index, no editing.   */
/*   within     CSS selector refining the editable node INSIDE the      */
/*              data-el element, for composite elements whose marker    */
/*              wraps more than the one field (the promo sale banner    */
/*              carries kicker + title + link under ONE data-el).       */
/*              Resolution: the element itself if it matches, else its  */
/*              first matching descendant; no match → no affordance.    */
/*                                                                     */
/* SAFETY NET (inline.ts, not here): a "plain" target must be a         */
/* text-only node — children may be text and <br> only. A theme that    */
/* nests icons/avatars/extra spans inside a mapped element fails that   */
/* guard and falls back to panel editing rather than letting a          */
/* textContent write clobber structure it does not own.                 */
/* ------------------------------------------------------------------ */

export type InlineMode = "plain" | "rich"

/** One inline-editable text field of a themed block. */
export type InlineMapEntry = {
  /** Settings path on the host (within one item when `itemField` set). */
  path: string
  mode: InlineMode
  /** Plain entries only: textarea-backed fields keep their newlines. */
  multiline?: boolean
  /** Repeated-array prop; the data-el-item index completes the path. */
  itemField?: string
  /** Selector refining the editable node inside the data-el element. */
  within?: string
}

/**
 * block_type → data-el key → entry. v1 ships the six blocks whose text
 * fields are unambiguous one-node targets across every theme's markup
 * (verified against the katan-liquid marker audit and the React
 * fallback blocks). Everything else waits for its block's audit.
 */
export const INLINE_MAPS: Record<string, Record<string, InlineMapEntry>> = {
  hero_slider: {
    // Slide fields — data-el-item="slides:<i>" supplies the index.
    kicker: { path: "subtitle", mode: "plain", itemField: "slides" },
    title: { path: "title", mode: "plain", multiline: true, itemField: "slides" },
    button: { path: "cta.label", mode: "plain", itemField: "slides" },
  },
  rich_text: {
    // The one rich body. NOTE: themes may pipe s.html through a token
    // resolver ({{ shop.name }}-style); committing from the DOM bakes
    // the RESOLVED text in. Same trade Elementor makes — the panel's
    // TipTap editor remains the token-preserving path.
    content: { path: "html", mode: "rich" },
  },
  image_with_text: {
    heading: { path: "title", mode: "plain", multiline: true },
    text: { path: "body", mode: "plain", multiline: true },
    button: { path: "cta.label", mode: "plain" },
  },
  newsletter: {
    heading: { path: "title", mode: "plain" },
    text: { path: "subtitle", mode: "plain", multiline: true },
  },
  testimonials: {
    quote: { path: "quote", mode: "plain", multiline: true, itemField: "items" },
    // Some themes mark the bare name span as data-el="author" (learts
    // React); others mark the whole figcaption (avatar + name + role —
    // katan). `within` lands on the name node in both: the element
    // itself when it IS the name, else the descendant that carries it.
    author: {
      path: "author",
      mode: "plain",
      itemField: "items",
      within: '[class*="name"]',
    },
  },
  category_showcase: {
    title: { path: "title", mode: "plain", multiline: true },
    // Rendered only when the theme supports it (learts 1.0.17+); themes
    // without the data-el node simply never offer the inline target.
    description: { path: "description", mode: "plain", multiline: true },
  },
  promo_banner_grid: {
    // Intro blockquote (the box's own data-el="intro" is NOT mapped —
    // it is a composite; its three text children are, individually).
    title: { path: "intro.title", mode: "plain", multiline: true },
    body: { path: "intro.body", mode: "plain", multiline: true },
    button: { path: "intro.link_label", mode: "plain" },
    // The sale banner is ONE data-el wrapping kicker + title + link;
    // the title universally renders as the banner's only heading.
    sale: { path: "sale.title", mode: "plain", within: "h1,h2,h3,h4,h5,h6" },
  },
}

/** The inline entry for a block's element, or null (panel-edited). */
export function inlineEntryOf(
  blockType: string | undefined | null,
  elKey: string | undefined | null
): InlineMapEntry | null {
  if (!blockType || !elKey) return null
  return INLINE_MAPS[blockType]?.[elKey] ?? null
}
