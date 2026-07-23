/* ------------------------------------------------------------------ */
/* Fixtures for normalizeDocument / facadeOf — every legacy shape the   */
/* editor can load. Kept as plain data (no factories) so a fixture is    */
/* exactly what /api/puck/load hands the shell.                          */
/* ------------------------------------------------------------------ */

import type { SectionNode } from "../normalize"

/* 1. Flat commerce block — the classic pre-normalization page entry.   */
export const flatHeroSlider: SectionNode = {
  block_type: "hero_slider",
  autoplaySpeed: 5000,
  slides: [
    {
      image: "/uploads/hero-1.jpg",
      heading: "Making & crafting",
      subheading: "Handmade goods",
      buttonLabel: "Shop now",
      buttonHref: "/store",
    },
    { image: "/uploads/hero-2.jpg", heading: "New arrivals" },
  ],
}

/* 2. Flat commerce block WITH all three style bags + id +              */
/*    schema_version — the styled legacy shape. Bags must end up at     */
/*    SECTION level on the wrapper, id preserved on the wrapper,        */
/*    schema_version dropped.                                           */
export const flatStyledRichText: SectionNode = {
  block_type: "rich_text",
  id: "sec-rich-1",
  schema_version: 1,
  heading: "Our story",
  html: "<p>We make things by hand.</p>",
  style: {
    background: { color: "#faf6f0" },
    padding: { top: { value: 64, unit: "px" }, bottom: { value: 64, unit: "px" } },
  },
  advanced: { cssClasses: "story-band", margin: { top: { value: 0, unit: "px" } } },
  elementStyles: {
    heading: { typography: { size: { value: 32, unit: "px" } } },
  },
}

/* 3. Existing 1-column container (no ids anywhere) — structure must be */
/*    UNTOUCHED except id stamping. Not flush → never a facade.         */
export const oneColContainer: SectionNode = {
  block_type: "container",
  layout: "1",
  gap: { value: 20, unit: "px" },
  verticalAlign: "top",
  columns: [
    {
      widgets: [
        { widget_type: "heading", text: "Welcome", level: "h2" },
        { widget_type: "text", html: "<p>Hello.</p>" },
      ],
    },
  ],
}

/* 4. Multi-column container with ids EVERYWHERE — the fully-normalized */
/*    shape. Must pass through with the exact same reference.           */
export const multiColContainer: SectionNode = {
  block_type: "container",
  id: "cnt-1",
  layout: "2",
  gap: { value: 24, unit: "px" },
  verticalAlign: "center",
  columns: [
    {
      id: "col-1",
      widgets: [{ id: "w-1", widget_type: "image", src: "/uploads/a.jpg", alt: "A" }],
    },
    {
      id: "col-2",
      widgets: [
        { id: "w-2", widget_type: "heading", text: "Side", level: "h3" },
        { id: "w-3", widget_type: "button", label: "Go", href: "/store" },
      ],
    },
  ],
  style: { background: { color: "#ffffff" } },
}

/* 5. Container holding COMMERCE widgets (the commerce-as-widgets       */
/*    session shape: 2 columns, product_tabs beside a heading).         */
/*    Container → passthrough (+ id stamps); multi-column → no facade.  */
export const containerWithCommerceWidgets: SectionNode = {
  block_type: "container",
  layout: "2",
  gap: { value: 32, unit: "px" },
  columns: [
    { widgets: [{ widget_type: "product_tabs", tabs: [{ title: "Best sellers", source: "best_sellers" }] }] },
    { widgets: [{ widget_type: "heading", text: "Shop the edit", level: "h2" }] },
  ],
}

/* 6. Container with an inner_section widget — ids must be stamped      */
/*    recursively into the inner columns/widgets.                       */
export const innerSectionContainer: SectionNode = {
  block_type: "container",
  layout: "1",
  columns: [
    {
      widgets: [
        {
          widget_type: "inner_section",
          layout: "2",
          columns: [
            { widgets: [{ widget_type: "heading", text: "Inner left", level: "h4" }] },
            { widgets: [{ widget_type: "button", label: "Inner right", href: "/x" }] },
          ],
        },
      ],
    },
  ],
}

/* 7. Unknown block type — conservative passthrough, byte-untouched.    */
export const unknownBlock: SectionNode = {
  block_type: "mystery_widget_x",
  foo: 1,
  bar: { nested: true },
  style: { background: { color: "#000000" } },
}

/* 8. The already-normalized flush wrapper (what wrapFlatSection emits) */
/*    — second pass must be a no-op; facadeOf must present the widget.  */
export const normalizedFlushHero: SectionNode = {
  block_type: "container",
  id: "sec-hero-1",
  layout: "1",
  flush: true,
  gap: { value: 0, unit: "px" },
  columns: [
    {
      id: "col-hero-1",
      widgets: [
        {
          id: "w-hero-1",
          widget_type: "hero_slider",
          autoplaySpeed: 4000,
          slides: [{ image: "/uploads/h.jpg", heading: "Hi" }],
        },
      ],
    },
  ],
  style: { padding: { top: { value: 0, unit: "px" } } },
}

/* 9. Empty page. */
export const emptyPage: SectionNode[] = []

/* 10. A realistic mixed page — what the owner's home page looks like.  */
export const mixedPage: SectionNode[] = [
  flatHeroSlider,
  flatStyledRichText,
  oneColContainer,
  multiColContainer,
  containerWithCommerceWidgets,
  innerSectionContainer,
  unknownBlock,
  normalizedFlushHero,
]
