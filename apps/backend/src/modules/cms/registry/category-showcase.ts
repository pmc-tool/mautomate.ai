import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * category_showcase — "Shop by categories" tile grid (refactor of the storefront
 * `home/components/learts/shop-categories.tsx`).
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     sub_title?: string ·i18n          // small kicker ("Shop by categories")
 *     title: string      ·i18n          // section heading ("Making & crafting")
 *     items: Array<{
 *       category_id?: string            // locale-invariant — live category ref;
 *                                       //   when set the renderer resolves the
 *                                       //   category live and SKIPS the tile if
 *                                       //   the category no longer exists
 *       label: string    ·i18n          // display name (overrides category name)
 *       image: string                   // locale-invariant — media URL
 *       href: string                    // locale-invariant — link target
 *     }>
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). All other keys are
 * locale-invariant structure. The renderer counts items from the live category's
 * `products.length`; a tile without a `category_id` is a static tile (no count).
 * `image` is stored as a plain URL string; the admin ImagePicker persists the
 * chosen media URL here.
 */

export interface CategoryShowcaseItem {
  category_id?: string
  label: string
  image: string
  href: string
}

export interface CategoryShowcaseData {
  sub_title?: string
  title: string
  items: CategoryShowcaseItem[]
}

export const CATEGORY_SHOWCASE_SCHEMA_VERSION = 1

const BANNER_S5 = "/learts/assets/images/banner/category"

export const categoryShowcaseBlock: BlockDefinition<CategoryShowcaseData> = {
  type: "category_showcase",
  label: "Category Showcase",
  schemaVersion: CATEGORY_SHOWCASE_SCHEMA_VERSION,
  defaultData: (): CategoryShowcaseData => ({
    sub_title: "Shop by categories",
    title: "Making & crafting",
    items: [
      {
        label: "Gift ideas",
        image: `${BANNER_S5}/banner-s5-1.webp`,
        href: "/store",
      },
      {
        label: "Home Decor",
        image: `${BANNER_S5}/banner-s5-2.webp`,
        href: "/store",
      },
      {
        label: "Toys",
        image: `${BANNER_S5}/banner-s5-3.webp`,
        href: "/store",
      },
      {
        label: "Pots",
        image: `${BANNER_S5}/banner-s5-4.webp`,
        href: "/store",
      },
      {
        label: "Kniting & Sewing",
        image: `${BANNER_S5}/banner-s5-5.webp`,
        href: "/store",
      },
    ],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["category_showcase: data must be an object"])
    }

    if (data.sub_title !== undefined && !isStr(data.sub_title)) {
      errors.push("category_showcase: sub_title must be a string")
    }

    if (!isNonEmptyStr(data.title)) {
      errors.push("category_showcase: title is required")
    }

    if (data.description !== undefined && !isStr(data.description)) {
      errors.push("category_showcase: description must be a string")
    }

    if (!Array.isArray(data.items)) {
      errors.push("category_showcase: items must be an array")
      return ok(errors)
    }

    data.items.forEach((item, i) => {
      if (!isObj(item)) {
        errors.push(`category_showcase: items[${i}] must be an object`)
        return
      }
      if (item.category_id !== undefined && !isStr(item.category_id)) {
        errors.push(
          `category_showcase: items[${i}].category_id must be a string`
        )
      }
      if (!isStr(item.label)) {
        errors.push(`category_showcase: items[${i}].label must be a string`)
      }
      if (!isNonEmptyStr(item.image)) {
        errors.push(
          `category_showcase: items[${i}].image is required (media URL)`
        )
      }
      if (!isNonEmptyStr(item.href)) {
        errors.push(`category_showcase: items[${i}].href is required`)
      }
    })

    return ok(errors)
  },
}

export default categoryShowcaseBlock
