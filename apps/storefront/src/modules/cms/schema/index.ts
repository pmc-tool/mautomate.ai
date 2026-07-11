/* ------------------------------------------------------------------ */
/* Block schema registry — the single source of truth for editing       */
/* ------------------------------------------------------------------ */

import type { BlockSchema, FieldDef } from "./types"

import { UNIVERSAL_STYLE } from "./universal/style"
import { UNIVERSAL_ADVANCED } from "./universal/advanced"

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
import containerSchema from "./blocks/container"
import imageGallerySchema from "./blocks/image-gallery"

export * from "./types"
export * from "./widgets"

export const BLOCK_SCHEMAS: Record<string, BlockSchema> = {
  hero_slider: heroSliderSchema,
  promo_banner_grid: promoBannerGridSchema,
  product_tabs: productTabsSchema,
  deal_of_day: dealOfDaySchema,
  category_showcase: categoryShowcaseSchema,
  brand_strip: brandStripSchema,
  rich_text: richTextSchema,
  image_with_text: imageWithTextSchema,
  newsletter: newsletterSchema,
  instagram_grid: instagramGridSchema,
  image_gallery: imageGallerySchema,
  testimonials: testimonialsSchema,
  container: containerSchema,
}

export function getBlockSchema(type: string): BlockSchema | undefined {
  return BLOCK_SCHEMAS[type]
}

/** All schemas, for the "Add section" picker (grouped by category). */
export function listBlockSchemas(): BlockSchema[] {
  return Object.values(BLOCK_SCHEMAS)
}

/**
 * The three schemas that build a block's editor panel: its own content
 * `BlockSchema` plus the two UNIVERSAL bags shared by every block. `content`
 * is `null` for an unknown block_type — style/advanced are always present so
 * the Style / Advanced tabs render even for chrome or not-yet-registered types.
 */
export interface PanelSchema {
  content: BlockSchema | null
  style: FieldDef[]
  advanced: FieldDef[]
}

/**
 * Merge a block's content schema with the universal Style / Advanced schemas at
 * panel-build time. Style/Advanced are NEVER authored per block — they come
 * from the shared UNIVERSAL_STYLE / UNIVERSAL_ADVANCED arrays and edit the
 * namespaced `block.style` / `block.advanced` bags.
 */
export function getPanelSchema(block_type: string): PanelSchema {
  return {
    content: getBlockSchema(block_type) ?? null,
    style: UNIVERSAL_STYLE,
    advanced: UNIVERSAL_ADVANCED,
  }
}
