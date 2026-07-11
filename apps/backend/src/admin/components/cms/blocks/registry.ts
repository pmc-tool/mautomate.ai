/**
 * Forever Finds CMS — ADMIN block-editor registry (Phase 3).
 *
 * The single integration point between the page-builder editor
 * (src/admin/routes/cms/pages/[id]/page.tsx) and the per-block editor UIs.
 * The page editor never imports a block editor directly — it looks the editor
 * up here by `section.type`, so adding a new block in Phase 4 is one entry.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EDITOR CONTRACT (what each block editor component conforms to)
 * ─────────────────────────────────────────────────────────────────────────
 * Each block editor lives in its own file in this folder and default-exports a
 * controlled React component with props `{ value, onChange, locale }`:
 *   - `value`    the data object for the locale being edited (the full en
 *                payload, or the working copy for a non-en locale).
 *   - `onChange` called with the FULL updated data object on every edit.
 *   - `locale`   the locale being edited ("en" | "bn"). On "en" the editor is the
 *                full structural editor; on a non-en locale structure/images/links
 *                are read-only and only translatable text is editable, the result
 *                being stored as that locale's section-translation override.
 *
 * `defaultData()` (what "Add section" inserts) and the human label are sourced
 * from the BACKEND block registry leaf files (src/modules/cms/registry/*), which
 * are pure (no Node-only deps) — so the seed/admin/publish all share ONE source
 * of truth for default content and there is no drift.
 */
import type { ComponentType } from "react"
import type { BlockType } from "../../../../modules/cms/types"

import HeroSliderEditor from "./hero-slider-editor"
import PromoBannerGridEditor from "./promo-banner-grid-editor"
import ProductTabsEditor from "./product-tabs-editor"
import DealOfDayEditor from "./deal-of-day-editor"
import CategoryShowcaseEditor from "./category-showcase-editor"
import BrandStripEditor from "./brand-strip-editor"
import RichTextEditor from "./rich-text-editor"
import ImageWithTextEditor from "./image-with-text-editor"
import NewsletterEditor from "./newsletter-editor"
import InstagramGridEditor from "./instagram-grid-editor"
import TestimonialsEditor from "./testimonials-editor"
import { heroSliderBlock } from "../../../../modules/cms/registry/hero-slider"
import { promoBannerGridBlock } from "../../../../modules/cms/registry/promo-banner-grid"
import { productTabsBlock } from "../../../../modules/cms/registry/product-tabs"
import { dealOfDayBlock } from "../../../../modules/cms/registry/deal-of-day"
import { categoryShowcaseBlock } from "../../../../modules/cms/registry/category-showcase"
import { brandStripBlock } from "../../../../modules/cms/registry/brand-strip"
import { richTextBlock } from "../../../../modules/cms/registry/rich-text"
import { imageWithTextBlock } from "../../../../modules/cms/registry/image-with-text"
import { newsletterBlock } from "../../../../modules/cms/registry/newsletter"
import { instagramGridBlock } from "../../../../modules/cms/registry/instagram-grid"
import { testimonialsBlock } from "../../../../modules/cms/registry/testimonials"

/* ------------------------------------------------------------------ */
/* Public contract                                                     */
/* ------------------------------------------------------------------ */

export type BlockEditorLocale = "en" | "bn"

/** Plain-JSON block payload (en base, or a per-locale working copy). */
export type BlockData = Record<string, any>

export type BlockEditorProps = {
  /** Data for the locale being edited (full en, or the locale working copy). */
  value: BlockData | null | undefined
  /** Receives the full updated data object on every edit. */
  onChange: (next: BlockData) => void
  /** The locale currently being edited. */
  locale?: string
}

export type BlockEditorEntry = {
  /** The BLOCK_TYPES key this editor edits. */
  type: BlockType
  /** Add-section palette label. */
  label: string
  /** Short palette description. */
  description?: string
  /** Fresh, valid default en payload — what "Add section" POSTs. */
  defaultData: () => BlockData
  /** The React editor component. */
  Editor: ComponentType<BlockEditorProps>
}

/* ------------------------------------------------------------------ */
/* The registry                                                        */
/* ------------------------------------------------------------------ */

export const BLOCK_EDITORS: Partial<Record<BlockType, BlockEditorEntry>> = {
  hero_slider: {
    type: "hero_slider",
    label: heroSliderBlock.label,
    description: "Full-width rotating hero banner with slides.",
    defaultData: () => heroSliderBlock.defaultData() as BlockData,
    Editor: HeroSliderEditor as ComponentType<BlockEditorProps>,
  },
  promo_banner_grid: {
    type: "promo_banner_grid",
    label: promoBannerGridBlock.label,
    description: "Intro, sale banner, category tiles and Instagram.",
    defaultData: () => promoBannerGridBlock.defaultData() as BlockData,
    Editor: PromoBannerGridEditor as ComponentType<BlockEditorProps>,
  },
  product_tabs: {
    type: "product_tabs",
    label: productTabsBlock.label,
    description: "Tabbed product carousels (new, sale, best sellers).",
    defaultData: () => productTabsBlock.defaultData() as BlockData,
    Editor: ProductTabsEditor as ComponentType<BlockEditorProps>,
  },
  deal_of_day: {
    type: "deal_of_day",
    label: dealOfDayBlock.label,
    description: "Featured product with a countdown timer.",
    defaultData: () => dealOfDayBlock.defaultData() as BlockData,
    Editor: DealOfDayEditor as ComponentType<BlockEditorProps>,
  },
  category_showcase: {
    type: "category_showcase",
    label: categoryShowcaseBlock.label,
    description: "Shop-by-category tiles linking to live categories.",
    defaultData: () => categoryShowcaseBlock.defaultData() as BlockData,
    Editor: CategoryShowcaseEditor as ComponentType<BlockEditorProps>,
  },
  brand_strip: {
    type: "brand_strip",
    label: brandStripBlock.label,
    description: "A row of brand logos.",
    defaultData: () => brandStripBlock.defaultData() as BlockData,
    Editor: BrandStripEditor as ComponentType<BlockEditorProps>,
  },
  rich_text: {
    type: "rich_text",
    label: richTextBlock.label,
    description: "Free-form rich text / HTML content.",
    defaultData: () => richTextBlock.defaultData() as BlockData,
    Editor: RichTextEditor as ComponentType<BlockEditorProps>,
  },
  image_with_text: {
    type: "image_with_text",
    label: imageWithTextBlock.label,
    description: "Two-column image and text banner with optional CTA.",
    defaultData: () => imageWithTextBlock.defaultData() as BlockData,
    Editor: ImageWithTextEditor as ComponentType<BlockEditorProps>,
  },
  newsletter: {
    type: "newsletter",
    label: newsletterBlock.label,
    description: "Email newsletter signup band.",
    defaultData: () => newsletterBlock.defaultData() as BlockData,
    Editor: NewsletterEditor as ComponentType<BlockEditorProps>,
  },
  instagram_grid: {
    type: "instagram_grid",
    label: instagramGridBlock.label,
    description: "A row of Instagram tiles (follow-us grid).",
    defaultData: () => instagramGridBlock.defaultData() as BlockData,
    Editor: InstagramGridEditor as ComponentType<BlockEditorProps>,
  },
  testimonials: {
    type: "testimonials",
    label: testimonialsBlock.label,
    description: "Customer quotes with avatar, name and role.",
    defaultData: () => testimonialsBlock.defaultData() as BlockData,
    Editor: TestimonialsEditor as ComponentType<BlockEditorProps>,
  },
}

/** Look up the editor entry for a section type (undefined when unsupported). */
export function getBlockEditor(type: string): BlockEditorEntry | undefined {
  return (BLOCK_EDITORS as Record<string, BlockEditorEntry | undefined>)[type]
}

/** True when this type has a built admin editor (Phase 3: the two blocks). */
export function isEditableBlock(type: string): boolean {
  return !!getBlockEditor(type)
}

/**
 * The "Add section" palette — the block types an editor can add today, in a
 * stable display order. Phase 4 blocks appear here automatically once their
 * editor file is registered above.
 */
export const ADD_SECTION_PALETTE: BlockEditorEntry[] = Object.values(
  BLOCK_EDITORS
).filter(Boolean) as BlockEditorEntry[]
