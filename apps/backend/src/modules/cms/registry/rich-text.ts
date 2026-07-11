import {
  isNonEmptyStr,
  isObj,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * rich_text — a free-form WYSIWYG / HTML content block (NEW in Phase 4; it is
 * NOT part of the current Learts home tail — it ships with a sensible generic
 * default so an editor can drop a paragraph-style section onto any page).
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     html: string        ·i18n        // sanitized HTML body (required)
 *     width?: "narrow" | "normal" | "wide" | "full"
 *                                       // locale-invariant container width
 *                                       // (default "normal")
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). `html` holds an authored,
 * sanitized HTML fragment (headings, paragraphs, lists, links, emphasis — no
 * <script>/<style>/inline event handlers; the storefront renderer strips those
 * defensively). `width` is locale-invariant layout structure:
 *   - "narrow"  centered reading column (~66% on wide screens)
 *   - "normal"  standard centered container (default)
 *   - "wide"    full-bleed container with gutters
 *   - "full"    edge-to-edge, no max width
 */

export const RICH_TEXT_WIDTHS = ["narrow", "normal", "wide", "full"] as const
export type RichTextWidth = (typeof RICH_TEXT_WIDTHS)[number]

export interface RichTextData {
  html: string
  width?: RichTextWidth
}

export const RICH_TEXT_SCHEMA_VERSION = 1

const DEFAULT_HTML =
  "<h2>Our Story</h2>\n" +
  "<p>Forever Finds is an online shop for handicrafts and arts' works. We craft beautiful pieces by hand, pairing useful tools with creativity to bring you unique vases, wall art, home accessories and furniture.</p>\n" +
  '<p>Have a question? <a href="/contact">Get in touch</a> — we would love to hear from you.</p>'

export const richTextBlock: BlockDefinition<RichTextData> = {
  type: "rich_text",
  label: "Rich Text",
  schemaVersion: RICH_TEXT_SCHEMA_VERSION,
  defaultData: (): RichTextData => ({
    html: DEFAULT_HTML,
    width: "normal",
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["rich_text: data must be an object"])
    }

    if (!isNonEmptyStr(data.html)) {
      errors.push("rich_text: html is required (non-empty string)")
    }

    if (
      data.width !== undefined &&
      !(RICH_TEXT_WIDTHS as readonly string[]).includes(data.width as string)
    ) {
      errors.push(
        `rich_text: width must be one of ${RICH_TEXT_WIDTHS.join(", ")}`
      )
    }

    return ok(errors)
  },
}

export default richTextBlock
