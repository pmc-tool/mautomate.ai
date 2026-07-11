import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * brand_strip — brand logo strip (refactor of the storefront
 * `home/components/learts/brands.tsx`).
 *
 * RESOLVED data shape (en lives on `section.data`, bn overrides via
 * cms_section_translation):
 *
 *   {
 *     title?: string                    ·i18n  // section heading ("Shop by brands")
 *     brands: Array<{
 *       image: string                          // locale-invariant — media URL
 *       href: string                           // locale-invariant — link target
 *     }>
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). `title` is optional (absent =
 * the heading is not rendered). `brands` is always an array (possibly empty);
 * each logo is a plain media URL the admin ImagePicker persists, with an
 * accompanying `href`.
 */

export interface BrandStripItem {
  image: string
  href: string
}

export interface BrandStripData {
  title?: string
  brands: BrandStripItem[]
}

export const BRAND_STRIP_SCHEMA_VERSION = 1

const BRAND = "/learts/assets/images/brands"

export const brandStripBlock: BlockDefinition<BrandStripData> = {
  type: "brand_strip",
  label: "Brand Strip",
  schemaVersion: BRAND_STRIP_SCHEMA_VERSION,
  defaultData: (): BrandStripData => ({
    title: "Shop by brands",
    brands: [7, 8, 1, 2, 3, 4, 5, 6].map((n) => ({
      image: `${BRAND}/brand-${n}.webp`,
      href: "#",
    })),
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["brand_strip: data must be an object"])
    }

    if (data.title !== undefined && !isStr(data.title)) {
      errors.push("brand_strip: title must be a string")
    }

    if (!Array.isArray(data.brands)) {
      errors.push("brand_strip: brands must be an array")
      return ok(errors)
    }

    data.brands.forEach((brand, i) => {
      if (!isObj(brand)) {
        errors.push(`brand_strip: brands[${i}] must be an object`)
        return
      }
      if (!isNonEmptyStr(brand.image)) {
        errors.push(`brand_strip: brands[${i}].image is required (media URL)`)
      }
      if (!isNonEmptyStr(brand.href)) {
        errors.push(`brand_strip: brands[${i}].href is required`)
      }
    })

    return ok(errors)
  },
}

export default brandStripBlock
