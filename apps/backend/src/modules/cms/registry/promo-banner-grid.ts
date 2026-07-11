import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * promo_banner_grid — mixed promo / category / instagram tiles (refactor of the
 * storefront `home/components/learts/category-banners.tsx`).
 *
 * RESOLVED data shape (en lives on `section.data`, bn overrides via
 * cms_section_translation):
 *
 *   {
 *     intro: {                          // the left blockquote
 *       title: string      ·i18n
 *       body: string       ·i18n        // paragraph copy
 *       link_label: string ·i18n        // "ABOUT US"
 *       href: string                    // locale-invariant
 *     },
 *     sale: {                           // the "Spring sale" promo banner
 *       image: string                   // locale-invariant — media URL
 *       special_title: string ·i18n     // "Spring sale"
 *       title: string        ·i18n      // "Sale up to 10% all"
 *       link_label: string   ·i18n      // "SHOP NOW"
 *       href: string                    // locale-invariant
 *     },
 *     categories: Array<{               // category tiles; the "Toys" tile sets wide
 *       image: string                   // locale-invariant — media URL
 *       title: string       ·i18n       // "Home Decor"
 *       count_label: string ·i18n       // "16 items"
 *       href: string                    // locale-invariant
 *       wide?: boolean                  // locale-invariant — spans two columns
 *     }>,
 *     instagram: {                      // the Instagram follow tile
 *       image: string                   // locale-invariant — media URL
 *       sub_title: string  ·i18n        // "Follow us on instagram"
 *       handle: string                  // locale-invariant — "@forever_finds"
 *       href: string                    // locale-invariant
 *     }
 *   }
 *
 * `·i18n` = translatable. `intro`, `sale` and `instagram` are optional groups
 * (absent group = that area is not rendered); when present their fields are
 * type-checked. `categories` is always an array (possibly empty).
 */

export interface PromoIntro {
  title: string
  body: string
  link_label: string
  href: string
}

export interface PromoSale {
  image: string
  special_title: string
  title: string
  link_label: string
  href: string
}

export interface PromoCategoryTile {
  image: string
  title: string
  count_label: string
  href: string
  wide?: boolean
}

export interface PromoInstagram {
  image: string
  sub_title: string
  handle: string
  href: string
}

export interface PromoBannerGridData {
  intro?: PromoIntro
  sale?: PromoSale
  categories: PromoCategoryTile[]
  instagram?: PromoInstagram
}

export const PROMO_BANNER_GRID_SCHEMA_VERSION = 1

const BANNER = "/learts/assets/images/banner"

export const promoBannerGridBlock: BlockDefinition<PromoBannerGridData> = {
  type: "promo_banner_grid",
  label: "Promo Banner Grid",
  schemaVersion: PROMO_BANNER_GRID_SCHEMA_VERSION,
  defaultData: (): PromoBannerGridData => ({
    intro: {
      title:
        "Forever Finds is an online shop for handicrafts and arts' works based in the US.",
      body: "Crafting beautiful stuff with our own hands and the help from useful tools is a wonderful process, where you can enjoy yourself while pulling out some ideas and busy perfecting your work. We provide high-end unique vases, wall arts, home accessories, and furniture pieces.",
      link_label: "ABOUT US",
      href: "/store",
    },
    sale: {
      image: `${BANNER}/sale/sale-banner3-1.webp`,
      special_title: "Spring sale",
      title: "Sale up to 10% all",
      link_label: "SHOP NOW",
      href: "/store",
    },
    categories: [
      {
        image: `${BANNER}/category/banner-s2-7.webp`,
        title: "Home Decor",
        count_label: "16 items",
        href: "/store",
      },
      {
        image: `${BANNER}/category/banner-s2-8.webp`,
        title: "Gift Ideas",
        count_label: "16 items",
        href: "/store",
      },
      {
        image: `${BANNER}/category/banner-s2-9.webp`,
        title: "Toys",
        count_label: "6 items",
        href: "/store",
        wide: true,
      },
    ],
    instagram: {
      image: `${BANNER}/instagram-1.webp`,
      sub_title: "Follow us on instagram",
      handle: "@forever_finds",
      href: "#",
    },
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["promo_banner_grid: data must be an object"])
    }

    // intro (optional)
    if (data.intro !== undefined) {
      if (!isObj(data.intro)) {
        errors.push("promo_banner_grid: intro must be an object")
      } else {
        if (!isNonEmptyStr(data.intro.title)) {
          errors.push("promo_banner_grid: intro.title is required")
        }
        if (!isStr(data.intro.body)) {
          errors.push("promo_banner_grid: intro.body must be a string")
        }
        if (!isStr(data.intro.link_label)) {
          errors.push("promo_banner_grid: intro.link_label must be a string")
        }
        if (!isNonEmptyStr(data.intro.href)) {
          errors.push("promo_banner_grid: intro.href is required")
        }
      }
    }

    // sale (optional)
    if (data.sale !== undefined) {
      if (!isObj(data.sale)) {
        errors.push("promo_banner_grid: sale must be an object")
      } else {
        if (!isNonEmptyStr(data.sale.image)) {
          errors.push("promo_banner_grid: sale.image is required (media URL)")
        }
        if (!isStr(data.sale.special_title)) {
          errors.push("promo_banner_grid: sale.special_title must be a string")
        }
        if (!isNonEmptyStr(data.sale.title)) {
          errors.push("promo_banner_grid: sale.title is required")
        }
        if (!isStr(data.sale.link_label)) {
          errors.push("promo_banner_grid: sale.link_label must be a string")
        }
        if (!isNonEmptyStr(data.sale.href)) {
          errors.push("promo_banner_grid: sale.href is required")
        }
      }
    }

    // categories (required array)
    if (!Array.isArray(data.categories)) {
      errors.push("promo_banner_grid: categories must be an array")
    } else {
      data.categories.forEach((tile, i) => {
        if (!isObj(tile)) {
          errors.push(`promo_banner_grid: categories[${i}] must be an object`)
          return
        }
        if (!isNonEmptyStr(tile.image)) {
          errors.push(
            `promo_banner_grid: categories[${i}].image is required (media URL)`
          )
        }
        if (!isNonEmptyStr(tile.title)) {
          errors.push(`promo_banner_grid: categories[${i}].title is required`)
        }
        if (tile.count_label !== undefined && !isStr(tile.count_label)) {
          errors.push(
            `promo_banner_grid: categories[${i}].count_label must be a string`
          )
        }
        if (!isNonEmptyStr(tile.href)) {
          errors.push(`promo_banner_grid: categories[${i}].href is required`)
        }
        if (tile.wide !== undefined && typeof tile.wide !== "boolean") {
          errors.push(
            `promo_banner_grid: categories[${i}].wide must be a boolean`
          )
        }
      })
    }

    // instagram (optional)
    if (data.instagram !== undefined) {
      if (!isObj(data.instagram)) {
        errors.push("promo_banner_grid: instagram must be an object")
      } else {
        if (!isNonEmptyStr(data.instagram.image)) {
          errors.push(
            "promo_banner_grid: instagram.image is required (media URL)"
          )
        }
        if (!isStr(data.instagram.sub_title)) {
          errors.push("promo_banner_grid: instagram.sub_title must be a string")
        }
        if (!isNonEmptyStr(data.instagram.handle)) {
          errors.push("promo_banner_grid: instagram.handle is required")
        }
        if (!isNonEmptyStr(data.instagram.href)) {
          errors.push("promo_banner_grid: instagram.href is required")
        }
      }
    }

    return ok(errors)
  },
}

export default promoBannerGridBlock
