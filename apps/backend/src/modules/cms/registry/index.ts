import type { BlockType } from "../types"
import type { BlockDefinition, BlockValidationResult } from "./types"
import { heroSliderBlock } from "./hero-slider"
import { promoBannerGridBlock } from "./promo-banner-grid"
import { productTabsBlock } from "./product-tabs"
import { dealOfDayBlock } from "./deal-of-day"
import { categoryShowcaseBlock } from "./category-showcase"
import { brandStripBlock } from "./brand-strip"
import { richTextBlock } from "./rich-text"
import { imageWithTextBlock } from "./image-with-text"
import { newsletterBlock } from "./newsletter"
import { instagramGridBlock } from "./instagram-grid"
import { testimonialsBlock } from "./testimonials"
import { containerBlock } from "./container"
import { imageGalleryBlock } from "./image-gallery"
import { generatedValidate } from "./generated"

/**
 * Block registry (phase-0-architecture.md §3).
 *
 * The single source of truth for every CMS block type: label, defaultData,
 * schemaVersion and a pure validator. Phase 3 ships TWO blocks — `hero_slider`
 * and `promo_banner_grid`. The remaining ~10 types (announcement_bar,
 * product_tabs, deal_of_day, category_showcase, brand_strip, rich_text,
 * image_with_text, newsletter, instagram_grid, testimonials) land in Phase 4:
 * add a file per type and register it here. Nothing else needs to change — the
 * publish compiler and the store read API are block-agnostic.
 *
 * UNREGISTERED-TYPE POLICY (forward-compat): a section whose `type` is a valid
 * BLOCK_TYPES value but has no registry entry yet (e.g. a seeded `product_tabs`
 * section before Phase 4) is PASS-THROUGH at publish — its data is compiled into
 * the snapshot unvalidated and stamped `schema_version: 0`, so the home page can
 * be published end-to-end while only the two Phase 3 blocks are "built". The
 * storefront SectionRenderer renders the registered blocks and degrades unknown
 * ones to null (§5.8). Replace pass-through with real validation as each block
 * is added.
 */
export const BLOCK_REGISTRY: Partial<Record<BlockType, BlockDefinition>> = {
  image_gallery: imageGalleryBlock,
  hero_slider: heroSliderBlock,
  promo_banner_grid: promoBannerGridBlock,
  product_tabs: productTabsBlock,
  deal_of_day: dealOfDayBlock,
  category_showcase: categoryShowcaseBlock,
  brand_strip: brandStripBlock,
  rich_text: richTextBlock,
  image_with_text: imageWithTextBlock,
  newsletter: newsletterBlock,
  instagram_grid: instagramGridBlock,
  testimonials: testimonialsBlock,
  container: containerBlock,
}

/** Stamped onto compiled sections whose type has no registry entry yet. */
export const UNREGISTERED_SCHEMA_VERSION = 0

/** Look up a block definition by type (undefined when not yet registered). */
export function getBlockDefinition(
  type: string
): BlockDefinition | undefined {
  return (BLOCK_REGISTRY as Record<string, BlockDefinition | undefined>)[type]
}

/** True when `type` has a registry entry (i.e. is validated + has a renderer). */
export function isRegisteredBlock(type: string): boolean {
  return !!getBlockDefinition(type)
}

/** Schema version for a type (0 when unregistered — see pass-through policy). */
export function schemaVersionFor(type: string): number {
  return getBlockDefinition(type)?.schemaVersion ?? UNREGISTERED_SCHEMA_VERSION
}

/* ------------------------------------------------------------------ */
/* Phase 4B — contract-generated validators, SHADOW MODE                */
/* (ARCH-CORE §4 deprecation path, step 2 of 3).                        */
/*                                                                     */
/* Both validators run on every publish; the OLD (hand-written) result  */
/* is returned. Divergences are counted and logged (capped) so a week   */
/* of real publish traffic with an empty divergence log gates the       */
/* cutover. Flags:                                                      */
/*   CMS_CONTRACT_SHADOW=0       disable the shadow run entirely        */
/*   CMS_CONTRACT_VALIDATORS=1   CUTOVER — return the generated result  */
/*                               (leave OFF until the gate passes)      */
/* ------------------------------------------------------------------ */

const CONTRACT_CUTOVER = process.env.CMS_CONTRACT_VALIDATORS === "1"
const CONTRACT_SHADOW = process.env.CMS_CONTRACT_SHADOW !== "0"
const SHADOW_LOG_CAP = 20

let shadowRuns = 0
let shadowDivergences = 0
let shadowLogged = 0

/** Shadow-mode counters (also surfaced for the 4B probe + ops checks). */
export function getContractShadowStats(): {
  runs: number
  divergences: number
} {
  return { runs: shadowRuns, divergences: shadowDivergences }
}

/**
 * The publish policy applied to a raw validator result: a page builder must
 * NEVER block Publish just because a merchant left an (in-practice optional)
 * field empty — those "... is required" cases render gracefully (the element
 * is simply omitted). Only genuine data corruption ("... must be a <type>",
 * "must be an object/array", invalid ISO date) is allowed to block. So we
 * downgrade "is required" errors to non-blocking here, once, for every
 * registered block type.
 */
function applyPublishPolicy(result: BlockValidationResult): BlockValidationResult {
  const blocking = (result.errors || []).filter((e) => !/\bis required\b/.test(e))
  return { valid: blocking.length === 0, errors: blocking }
}

const sameErrors = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((e, i) => e === sb[i])
}

/**
 * Validate RESOLVED block data against its registry schema. Unregistered types
 * are treated as valid (pass-through) so publishing is not blocked before
 * Phase 4. Never throws.
 */
export function validateBlockData(
  type: string,
  data: unknown
): BlockValidationResult {
  const def = getBlockDefinition(type)
  if (!def) {
    return { valid: true, errors: [] }
  }
  const old = applyPublishPolicy(def.validate(data))

  if (CONTRACT_SHADOW || CONTRACT_CUTOVER) {
    try {
      const gen = generatedValidate(type, data)
      if (gen) {
        shadowRuns++
        const g = applyPublishPolicy(gen)
        if (g.valid !== old.valid || !sameErrors(g.errors, old.errors)) {
          shadowDivergences++
          if (shadowLogged < SHADOW_LOG_CAP) {
            shadowLogged++
            console.warn(
              `[cms-contract shadow] divergence #${shadowDivergences} type=${type} ` +
                `old=${JSON.stringify(old.errors)} gen=${JSON.stringify(g.errors)}`
            )
          }
        }
        if (CONTRACT_CUTOVER) {
          return g
        }
      }
    } catch (e) {
      shadowDivergences++
      if (shadowLogged < SHADOW_LOG_CAP) {
        shadowLogged++
        console.warn(
          `[cms-contract shadow] generated validator threw for type=${type}: ${String(e)}`
        )
      }
      // CUTOVER never rides an exception — fall through to the old result.
    }
  }

  return old
}

export * from "./types"
export { imageGalleryBlock } from "./image-gallery"
export { heroSliderBlock } from "./hero-slider"
export { promoBannerGridBlock } from "./promo-banner-grid"
export { productTabsBlock } from "./product-tabs"
export { dealOfDayBlock } from "./deal-of-day"
export { categoryShowcaseBlock } from "./category-showcase"
export { brandStripBlock } from "./brand-strip"
export { richTextBlock } from "./rich-text"
export { imageWithTextBlock } from "./image-with-text"
export { newsletterBlock } from "./newsletter"
export { instagramGridBlock } from "./instagram-grid"
export { testimonialsBlock } from "./testimonials"
export { containerBlock } from "./container"
export type {
  HeroSliderData,
  HeroSlide,
  HeroSlideCta,
} from "./hero-slider"
export type {
  PromoBannerGridData,
  PromoIntro,
  PromoSale,
  PromoCategoryTile,
  PromoInstagram,
} from "./promo-banner-grid"
export type {
  ProductTabsData,
  ProductTab,
  ProductTabSource,
  ProductTabSort,
} from "./product-tabs"
export type { DealOfDayData, DealOfDayCta } from "./deal-of-day"
export type {
  CategoryShowcaseData,
  CategoryShowcaseItem,
} from "./category-showcase"
export type { BrandStripData, BrandStripItem } from "./brand-strip"
export type { RichTextData, RichTextWidth } from "./rich-text"
export type {
  ImageWithTextData,
  ImageWithTextCta,
  ImageWithTextSide,
} from "./image-with-text"
export type { NewsletterData } from "./newsletter"
export type {
  InstagramGridData,
  InstagramGridImage,
} from "./instagram-grid"
export type { TestimonialsData, TestimonialItem } from "./testimonials"
export type {
  ContainerData,
  ContainerColumn,
  ContainerWidget,
  ContainerLayout,
  ContainerVerticalAlign,
} from "./container"
