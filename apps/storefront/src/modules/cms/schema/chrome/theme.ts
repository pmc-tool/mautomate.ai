import type { BlockSchema } from "../types"

/* ------------------------------------------------------------------ */
/* Custom tokens (F2a) — owner-defined colors/fonts beyond the 8       */
/* built-ins. Stored as theme.custom_colors / theme.custom_fonts and   */
/* emitted as prefixed CSS vars so they can never collide with the     */
/* built-in --ff-* names:                                              */
/*   color "Sale Red" → slug "sale-red" → --ff-c-sale-red              */
/*   font  "Display"  → slug "display"  → --ff-font-c-display          */
/* A linked value stores { ref: "c-<slug>" }; the style engine maps it */
/* to var(--ff-c-<slug>) / var(--ff-font-c-<slug>).                    */
/* ------------------------------------------------------------------ */

/** One owner-defined token as stored in theme.custom_colors / custom_fonts. */
export type CustomTokenItem = { name?: string; value?: string }

/** A normalized custom token, ready to emit as a CSS var / token picker row. */
export type ResolvedCustomToken = { slug: string; name: string; value: string }

/**
 * Stable slug for a custom token name: lowercase, runs of non-alphanumerics
 * collapse to "-", leading/trailing dashes trimmed ("Sale Red" → "sale-red").
 */
export function slugifyTokenName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Normalize a raw custom-token list into emit-ready tokens. Skips items
 * without a usable name/value and dedupes by slug (first wins), so every
 * emitter (root layout, editor canvas, token pickers) stays identical.
 * Defensive by contract: any non-array / malformed input yields [].
 */
export function resolveCustomTokens(items: unknown): ResolvedCustomToken[] {
  if (!Array.isArray(items)) {
    return []
  }
  const out: ResolvedCustomToken[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue
    }
    const { name, value } = item as CustomTokenItem
    if (typeof name !== "string" || typeof value !== "string") {
      continue
    }
    const slug = slugifyTokenName(name)
    const v = value.trim()
    if (!slug || !v || seen.has(slug)) {
      continue
    }
    seen.add(slug)
    out.push({ slug, name: name.trim(), value: v })
  }
  return out
}

/**
 * Theme design tokens — global colors/fonts. Editing these updates CSS custom
 * properties (--ff-*) live in the canvas, cascading across the whole page with
 * no re-render. Persisted as the `theme` CMS setting.
 */
export const themeSchema: BlockSchema = {
  type: "theme",
  label: "Colors & fonts",
  category: "content",
  maxInstances: 1,
  fields: [
    {
      name: "colors",
      type: "object",
      label: "Colors",
      group: "Colors",
      fields: [
        { name: "primary", type: "color", label: "Primary / accent", default: "#72a499" },
        { name: "heading", type: "color", label: "Headings", default: "#1f1f1f" },
        { name: "text", type: "color", label: "Body text", default: "#333333" },
        { name: "dark", type: "color", label: "Dark / buttons", default: "#1f1f1f" },
        { name: "border", type: "color", label: "Borders", default: "#e5e5e5" },
        { name: "bg", type: "color", label: "Background", default: "#ffffff" },
      ],
    },
    {
      name: "custom_colors",
      type: "list",
      label: "Custom colors",
      itemLabel: "Color",
      group: "Colors",
      help: "Extra brand colors. Each becomes a reusable token in every color picker.",
      fields: [
        { name: "name", type: "text", label: "Name", required: true },
        { name: "value", type: "color", label: "Color", default: "#72a499" },
      ],
    },
    {
      name: "fonts",
      type: "object",
      label: "Fonts",
      group: "Typography",
      fields: [
        { name: "heading", type: "text", label: "Heading font", default: "Marcellus, serif" },
        { name: "body", type: "text", label: "Body font", default: "Jost, sans-serif" },
      ],
    },
    {
      name: "custom_fonts",
      type: "list",
      label: "Custom fonts",
      itemLabel: "Font",
      group: "Typography",
      help: "Extra font stacks. Each becomes a reusable token in every font picker.",
      fields: [
        { name: "name", type: "text", label: "Name", required: true },
        {
          name: "value",
          type: "text",
          label: "Font stack",
          help: 'CSS font-family value, e.g. "Georgia, serif".',
        },
      ],
    },
    {
      name: "button",
      type: "object",
      label: "Buttons",
      group: "Component defaults",
      help: "Site-wide button defaults. Leave a field blank to keep the theme's built-in style.",
      fields: [
        { name: "background", type: "color", label: "Background" },
        { name: "textColor", type: "color", label: "Text color" },
        {
          name: "radius",
          type: "unitNumber",
          label: "Corner radius",
          units: ["px", "rem", "%"],
          min: 0,
        },
        { name: "padding", type: "dimensions", label: "Padding" },
      ],
    },
    {
      name: "headings",
      type: "object",
      label: "Headings",
      group: "Component defaults",
      help: "Site-wide heading (h1-h6) defaults. Leave a field blank to keep the theme's built-in style.",
      fields: [
        { name: "color", type: "color", label: "Color" },
        {
          name: "fontFamily",
          type: "text",
          label: "Font family",
          help: 'CSS font-family value, e.g. "Georgia, serif".',
        },
        {
          name: "letterSpacing",
          type: "unitNumber",
          label: "Letter spacing",
          units: ["px", "em"],
        },
      ],
    },
    { name: "logo", type: "image", label: "Logo", group: "Branding" },
  ],
  defaultProps: {
    colors: {
      primary: "#72a499",
      dark: "#1f1f1f",
      border: "#e5e5e5",
      text: "#333333",
      heading: "#1f1f1f",
      bg: "#ffffff",
    },
    custom_colors: [],
    fonts: { body: "Jost, sans-serif", heading: "Marcellus, serif" },
    custom_fonts: [],
    // Component defaults are diff-only: empty by default so an untouched
    // theme emits no base-layer CSS (buildThemeDefaultsCss → "").
    button: {},
    headings: {},
    logo: "/learts/assets/images/logo/forever-finds.png",
  },
}

export default themeSchema
