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

import type { FieldDef } from "./types"

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
        type: "url",
        label: "Video URL",
        required: true,
        group: "Content",
        help: "YouTube / Vimeo URL or a direct .mp4 file. Other hosts are not embedded.",
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
        type: "text",
        label: "Icon class",
        default: "fa-star",
        required: true,
        group: "Content",
        help: "Font Awesome class, e.g. fa-star or fa-heart.",
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
    defaults: { icon: "fa-star", size: { value: 24, unit: "px" } },
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
}

export function getWidgetSchema(type: string): WidgetDef | undefined {
  return WIDGET_SCHEMAS[type]
}

/** All widget schemas, for the "Add widget" picker. */
export function listWidgetSchemas(): WidgetDef[] {
  return Object.values(WIDGET_SCHEMAS)
}
