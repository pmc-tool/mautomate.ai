/* ------------------------------------------------------------------ */
/* cms-contract — backend validation annotations (Phase 4B).            */
/*                                                                     */
/* The FieldDef catalog (apps/storefront .../cms/schema) is the single  */
/* source of field STRUCTURE: names, types, enum options, repeater and  */
/* group shapes. What it cannot carry is the backend's PUBLISH-TIME     */
/* semantics — which fields the publish validator treats as required,   */
/* which optional fields are type-checked, exact message hints, early-  */
/* return behavior, and the two conditional-binding rules of            */
/* product_tabs. Those semantics were previously encoded 12 times over  */
/* in hand-written validators; THIS file is their single declarative    */
/* home. The generator (generate.ts) combines catalog + annotations     */
/* into `contract.gen.ts`, whose interpreter output is proven           */
/* equivalent to the hand-written validators in shadow mode before any  */
/* cutover (ARCH-CORE §4 deprecation path).                             */
/*                                                                     */
/* PATH SYNTAX: dotted, with `[]` for repeater items —                  */
/*   "slides[].image", "cta.href", "tabs[].source".                     */
/*                                                                     */
/* NOTE on `required` vs the catalog's own `required` flags: the panel  */
/* flag drives editor UX; THIS list drives publish messages. They       */
/* deliberately differ in places (e.g. hero slide image is required at  */
/* publish but not flagged in the panel). The generator prints a drift  */
/* report of every mismatch; do not "fix" one side to match the other   */
/* without deciding which behavior is intended.                         */
/*                                                                     */
/* `container` has no annotation ON PURPOSE — it is excluded from       */
/* generation entirely (hand-written permissiveness is a forward-       */
/* compat guarantee, ARCH-CORE §4).                                     */
/* ------------------------------------------------------------------ */

import type { FieldCheck } from "./generated-types"

export interface BlockBackendAnnotation {
  /** Paths validated as required at publish ("<path> is required…"). For a
   *  string field → non-empty-string check; for an object field → required
   *  group; enums use `enumRequired` instead. */
  required?: string[]
  /** Paths type-checked with a bare isStr() and NO undefined guard (the
   *  hand-written validators' unconditional checks, e.g. promo intro.body). */
  alwaysString?: string[]
  /** Exact message suffixes, INCLUDING the leading space: " (media URL)". */
  hints?: Record<string, string>
  /** Enum (select/choose) paths whose check runs even when the key is absent. */
  enumRequired?: string[]
  /** Full replacement for the message tail after "<type>: <path> ". */
  enumMsgTail?: Record<string, string>
  /** Catalog fields the backend deliberately does NOT validate (unknown to
   *  the hand-written validators; passthrough at publish). */
  skip?: string[]
  /** Repeater paths that do NOT abort validation on "must be an array"
   *  (default is the hand-written early-return). */
  arrayNoStop?: string[]
  /** datetime paths validated with the required+ISO-parse chain. */
  iso?: string[]
  /** Checks that have no catalog FieldDef (or need conditional logic),
   *  inserted immediately AFTER the anchor path's own check. Verbatim
   *  FieldCheck JSON. */
  injectAfter?: Record<string, FieldCheck[]>
}

export const BACKEND_ANNOTATIONS: Record<string, BlockBackendAnnotation> = {
  hero_slider: {
    required: [
      "slides[].image",
      "slides[].title",
      "slides[].cta",
      "slides[].cta.href",
    ],
    hints: { "slides[].image": " (media URL)" },
  },

  promo_banner_grid: {
    required: [
      "intro.title",
      "intro.href",
      "sale.image",
      "sale.title",
      "sale.href",
      "categories[].image",
      "categories[].title",
      "categories[].href",
      "instagram.image",
      "instagram.handle",
      "instagram.href",
    ],
    alwaysString: [
      "intro.body",
      "intro.link_label",
      "sale.special_title",
      "sale.link_label",
      "instagram.sub_title",
    ],
    hints: {
      "sale.image": " (media URL)",
      "categories[].image": " (media URL)",
      "instagram.image": " (media URL)",
    },
    skip: ["categories[].height", "categories[].fit"],
    arrayNoStop: ["categories"],
  },

  product_tabs: {
    required: ["tabs[].label"],
    enumRequired: ["tabs[].source"],
    injectAfter: {
      "tabs[].source": [
        {
          kind: "condReqStr",
          name: "category_id",
          whenField: "source",
          whenEq: "category",
        },
        {
          kind: "condReqStr",
          name: "collection_id",
          whenField: "source",
          whenEq: "collection",
        },
        {
          kind: "condStrArray",
          name: "product_ids",
          whenField: "source",
          whenEq: "manual",
        },
      ],
    },
  },

  deal_of_day: {
    required: ["image", "title", "cta", "cta.href"],
    hints: { image: " (media URL)" },
    iso: ["countdown_to"],
  },

  category_showcase: {
    required: ["title", "items[].image", "items[].href"],
    alwaysString: ["items[].label"],
    hints: { "items[].image": " (media URL)" },
  },

  brand_strip: {
    required: ["brands[].image", "brands[].href"],
    hints: { "brands[].image": " (media URL)" },
  },

  rich_text: {
    required: ["html"],
    hints: { html: " (non-empty string)" },
  },

  image_with_text: {
    required: ["image", "title", "cta.href"],
    hints: { image: " (media URL)" },
    enumMsgTail: { image_side: 'must be "left" or "right"' },
  },

  newsletter: {
    required: ["title", "placeholder", "button"],
  },

  instagram_grid: {
    required: ["handle", "images[].image", "images[].href"],
    hints: { "images[].image": " (media URL)" },
  },

  testimonials: {
    required: ["items[].quote", "items[].author"],
    hints: { "items[].avatar": " (media URL)" },
  },

  image_gallery: {
    required: ["items[].image"],
    hints: { "items[].image": " (media URL)" },
    skip: ["columns", "gap", "aspect"],
    arrayNoStop: ["items"],
  },
}

/** Types the generator emits specs for (container deliberately absent). */
export const GENERATED_TYPES = Object.keys(BACKEND_ANNOTATIONS)
