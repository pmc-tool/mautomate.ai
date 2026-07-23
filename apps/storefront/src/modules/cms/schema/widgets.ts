/* ------------------------------------------------------------------ */
/* Widget schema registry — atomic widgets for the `container` block    */
/*                                                                     */
/* Composer W1. A widget is the atomic unit placed inside a container   */
/* column: { widget_type, style?, advanced?, ...contentProps }. This     */
/* file declares the CONTENT fields only — the Style / Advanced tabs     */
/* reuse the universal schemas (UNIVERSAL_STYLE / UNIVERSAL_ADVANCED),   */
/* exactly like sections, and serialize through the same style engine    */
/* (`buildWidgetCss`). Mirrors BlockSchema but is deliberately smaller:  */
/* no categories, presets or instance caps — widgets are always free to  */
/* add anywhere inside a column.                                         */
/*                                                                       */
/* SECURITY: the `text` and `html` widgets carry user HTML — renderers    */
/* MUST pass it through @lib/util/sanitize-html before output. The        */
/* `video` widget renders ONLY whitelisted youtube/vimeo iframe embeds    */
/* or a <video> tag for direct .mp4 files — never an arbitrary iframe.    */
/* ------------------------------------------------------------------ */

import type { BlockSchema, FieldDef } from "./types"

import heroSliderSchema from "./blocks/hero-slider"
import promoBannerGridSchema from "./blocks/promo-banner-grid"
import productTabsSchema from "./blocks/product-tabs"
import dealOfDaySchema from "./blocks/deal-of-day"
import categoryShowcaseSchema from "./blocks/category-showcase"
import brandStripSchema from "./blocks/brand-strip"
import richTextSchema from "./blocks/rich-text"
import imageWithTextSchema from "./blocks/image-with-text"
import newsletterSchema from "./blocks/newsletter"
import instagramGridSchema from "./blocks/instagram-grid"
import testimonialsSchema from "./blocks/testimonials"
import imageGallerySchema from "./blocks/image-gallery"

export interface WidgetDef {
  /** stable key (snake-less, lowercase) — matches `widget_type` everywhere. */
  type: string
  label: string
  /** lucide icon name (rendered in the widget picker). */
  icon?: string
  /** CONTENT fields only — style/advanced come from the universal schemas. */
  fields: FieldDef[]
  /** default content props for a freshly added widget (no style/advanced). */
  defaults: Record<string, unknown>
}

export const WIDGET_SCHEMAS: Record<string, WidgetDef> = {
  heading: {
    type: "heading",
    label: "Heading",
    icon: "Heading",
    fields: [
      {
        name: "text",
        type: "text",
        label: "Text",
        default: "Heading",
        required: true,
        group: "Content",
      },
      {
        name: "level",
        type: "select",
        label: "HTML tag",
        default: "h2",
        group: "Content",
        help: "Semantic heading level — pick for document outline, style with the Style tab.",
        options: [
          { label: "H1", value: "h1" },
          { label: "H2", value: "h2" },
          { label: "H3", value: "h3" },
          { label: "H4", value: "h4" },
          { label: "H5", value: "h5" },
          { label: "H6", value: "h6" },
        ],
      },
    ],
    defaults: { text: "Heading", level: "h2" },
  },

  text: {
    type: "text",
    label: "Text",
    icon: "Type",
    fields: [
      {
        name: "html",
        type: "richText",
        label: "Content",
        required: true,
        group: "Content",
        help: "Paragraphs, lists, links and emphasis. Scripts and inline event handlers are stripped on render.",
      },
    ],
    defaults: { html: "<p>Type your text here…</p>" },
  },

  image: {
    type: "image",
    label: "Image",
    icon: "Image",
    fields: [
      {
        name: "src",
        type: "image",
        label: "Image",
        required: true,
        group: "Content",
      },
      {
        name: "alt",
        type: "text",
        label: "Alt text",
        group: "Content",
        help: "Describes the image for screen readers and SEO.",
      },
      {
        name: "href",
        type: "url",
        label: "Link",
        group: "Content",
        help: "Optional — wraps the image in a link.",
      },
    ],
    defaults: { src: "", alt: "" },
  },

  button: {
    type: "button",
    label: "Button",
    icon: "MousePointerClick",
    fields: [
      {
        name: "label",
        type: "text",
        label: "Label",
        default: "Click here",
        required: true,
        group: "Content",
      },
      {
        name: "href",
        type: "url",
        label: "Link",
        default: "#",
        group: "Content",
      },
      {
        name: "variant",
        type: "choose",
        label: "Style",
        default: "primary",
        group: "Content",
        options: [
          { label: "Primary", value: "primary", icon: "Square" },
          { label: "Outline", value: "outline", icon: "SquareDashed" },
        ],
      },
    ],
    defaults: { label: "Click here", href: "#", variant: "primary" },
  },

  spacer: {
    type: "spacer",
    label: "Spacer",
    icon: "MoveVertical",
    fields: [
      {
        name: "height",
        type: "unitNumber",
        label: "Height",
        default: { value: 50, unit: "px" },
        group: "Content",
        units: ["px", "vh", "rem"],
        min: 0,
        max: 500,
        step: 1,
        help: "Empty vertical space.",
      },
    ],
    defaults: { height: { value: 50, unit: "px" } },
  },

  divider: {
    type: "divider",
    label: "Divider",
    icon: "Minus",
    fields: [],
    defaults: {},
  },

  video: {
    type: "video",
    label: "Video",
    icon: "Video",
    fields: [
      {
        name: "url",
        type: "video",
        label: "Video",
        required: true,
        group: "Content",
        help: "Paste a YouTube / Vimeo / .mp4 URL, or generate a clip with AI.",
      },
    ],
    defaults: { url: "" },
  },

  icon: {
    type: "icon",
    label: "Icon",
    icon: "Star",
    fields: [
      {
        name: "icon",
        // 3E: the icon picker. Same stored value shape (the FA5 class
        // string) — legacy bare classes ("fa-star") keep rendering and are
        // never rewritten until the merchant picks.
        type: "icon",
        label: "Icon class",
        default: "fas fa-star",
        required: true,
        group: "Content",
        help: "Font Awesome class, e.g. fas fa-star or fas fa-heart.",
      },
      {
        name: "size",
        type: "unitNumber",
        label: "Size",
        default: { value: 24, unit: "px" },
        group: "Content",
        units: ["px", "em", "rem"],
        min: 8,
        max: 200,
        step: 1,
      },
    ],
    defaults: { icon: "fas fa-star", size: { value: 24, unit: "px" } },
  },

  html: {
    type: "html",
    label: "HTML",
    icon: "Code",
    fields: [
      {
        name: "html",
        type: "code",
        label: "HTML",
        group: "Content",
        rows: 8,
        help: "Raw HTML. Scripts, iframes and inline event handlers are stripped on render.",
      },
    ],
    defaults: { html: "" },
  },

  /**
   * A container INSIDE a column (Elementor's Inner Section).
   *
   * Its `columns` have exactly the same shape as the section-level container's,
   * so the renderer, the columns manager and every widget op recurse into it
   * unchanged. Nesting is capped at ONE level (an inner section cannot hold
   * another): two levels covers real layouts, and unbounded nesting is a
   * performance and UX trap that Elementor itself resists.
   */
  inner_section: {
    type: "inner_section",
    label: "Inner Section",
    icon: "Columns",
    fields: [
      {
        name: "layout",
        type: "select",
        label: "Columns",
        default: "2",
        group: "Content",
        options: [
          { label: "1 column", value: "1" },
          { label: "2 columns", value: "2" },
          { label: "3 columns", value: "3" },
          { label: "4 columns", value: "4" },
        ],
      },
      {
        name: "gap",
        type: "unitNumber",
        label: "Gap",
        default: { value: 20, unit: "px" },
        group: "Content",
        units: ["px", "rem", "em"],
        min: 0,
        max: 120,
        step: 1,
      },
      {
        name: "verticalAlign",
        type: "select",
        label: "Vertical align",
        default: "top",
        group: "Content",
        options: [
          { label: "Top", value: "top" },
          { label: "Middle", value: "center" },
          { label: "Bottom", value: "bottom" },
        ],
      },
    ],
    defaults: {
      layout: "2",
      gap: { value: 20, unit: "px" },
      verticalAlign: "top",
      columns: [{ widgets: [] }, { widgets: [] }],
    },
  },
}

/* -------------------- commerce widgets (Elementor structure) -------------------- */
/*                                                                                  */
/* Elementor has ONE world: everything is a widget you drop into a column, which is  */
/* why a "+" is always available. We had two disjoint worlds — 12 fixed commerce     */
/* SECTIONS rendered by each theme's `sections/<type>.liquid`, and one free-form     */
/* `container` block holding widgets. This makes the structure Elementor's WITHOUT   */
/* losing the thing Elementor lacks (commerce sections that automatically match the  */
/* merchant's theme): each commerce block is ALSO a widget type, and its renderer    */
/* DELEGATES to the theme's own Liquid section (see render/container-html.ts).       */
/*                                                                                  */
/* There is exactly ONE source of truth for their fields and defaults: the block     */
/* schemas in ./blocks/*. They are DERIVED here, never forked — edit the block file  */
/* and both the section form and the widget form change together.                    */
/*                                                                                  */
/* No backend deploy is needed: apps/backend/src/modules/cms/registry/container.ts   */
/* validates widgets PERMISSIVELY ("any object with a string widget_type passes;     */
/* all other keys are passthrough … so new widget types never require a backend      */
/* deploy") — verified against that file.                                            */
/* -------------------------------------------------------------------------------- */

/** The widget types that existed before commerce delegation — the palette's
 *  "Basic elements" grid, kept separate so it does not become a wall of 21 cards. */
export const BASIC_WIDGET_TYPES: ReadonlySet<string> = new Set(
  Object.keys(WIDGET_SCHEMAS)
)

/** The 12 commerce blocks, in the order the section palette lists them. */
const COMMERCE_BLOCK_SCHEMAS: BlockSchema[] = [
  heroSliderSchema,
  promoBannerGridSchema,
  productTabsSchema,
  dealOfDaySchema,
  categoryShowcaseSchema,
  brandStripSchema,
  richTextSchema,
  imageWithTextSchema,
  newsletterSchema,
  instagramGridSchema,
  testimonialsSchema,
  imageGallerySchema,
]

/**
 * Deep-clone a block's `defaultProps` so a freshly added widget never shares a
 * nested array (a slider's `slides`, a testimonial list) with the schema itself
 * — editing one widget must not mutate the defaults for the next one.
 */
function cloneDefaults(
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!props) {
    return {}
  }
  try {
    return JSON.parse(JSON.stringify(props)) as Record<string, unknown>
  } catch {
    return { ...props }
  }
}

/** Derive a WidgetDef from a BlockSchema — same fields, same defaults, no fork. */
function widgetFromBlockSchema(schema: BlockSchema): WidgetDef {
  return {
    type: schema.type,
    label: schema.label,
    icon: schema.icon,
    fields: schema.fields,
    defaults: cloneDefaults(
      schema.defaultProps as Record<string, unknown> | undefined
    ),
  }
}

/** Widget types whose markup comes from the THEME's `sections/<type>.liquid`. */
export const COMMERCE_WIDGET_TYPES: ReadonlySet<string> = new Set(
  COMMERCE_BLOCK_SCHEMAS.map((s) => s.type)
)

export function isCommerceWidget(type: unknown): boolean {
  return typeof type === "string" && COMMERCE_WIDGET_TYPES.has(type)
}

for (const schema of COMMERCE_BLOCK_SCHEMAS) {
  WIDGET_SCHEMAS[schema.type] = widgetFromBlockSchema(schema)
}

/** Widget types that hold their own columns of widgets (recursive render). */
export const NESTED_WIDGET_TYPES = new Set(["inner_section"])

export function isNestedWidget(type: unknown): boolean {
  return typeof type === "string" && NESTED_WIDGET_TYPES.has(type)
}

export function getWidgetSchema(type: string): WidgetDef | undefined {
  return WIDGET_SCHEMAS[type]
}

/** All widget schemas, for the "Add widget" picker. */
export function listWidgetSchemas(): WidgetDef[] {
  return Object.values(WIDGET_SCHEMAS)
}

/** Only the atomic widgets — the palette's "Basic elements" grid. */
export function listBasicWidgetSchemas(): WidgetDef[] {
  return Object.values(WIDGET_SCHEMAS).filter((w) =>
    BASIC_WIDGET_TYPES.has(w.type)
  )
}

/** Only the theme-delegating commerce widgets. */
export function listCommerceWidgetSchemas(): WidgetDef[] {
  return COMMERCE_BLOCK_SCHEMAS.map((s) => WIDGET_SCHEMAS[s.type]).filter(
    Boolean
  )
}
