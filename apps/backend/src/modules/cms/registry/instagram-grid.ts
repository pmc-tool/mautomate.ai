import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * instagram_grid — a row of Instagram tiles (the Learts "follow us on
 * instagram" look). Each tile is a square image that links out to a post /
 * profile; the section carries one shared handle and an optional heading.
 *
 * RESOLVED data shape (en lives on `section.data`, bn overrides via
 * cms_section_translation):
 *
 *   {
 *     handle: string                    // locale-invariant — "@forever_finds"
 *     heading?: string  ·i18n           // section sub-title ("Follow us on instagram")
 *     images: Array<{                   // 6–8 tiles recommended
 *       image: string                   // locale-invariant — media URL
 *       href: string                    // locale-invariant — link target
 *     }>
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). `handle`, every `image`
 * and `href` are locale-invariant structure edited only on the default locale
 * (en); `heading` is the single translatable string. `images` is always an
 * array (possibly empty).
 */

export interface InstagramGridImage {
  image: string
  href: string
}

export interface InstagramGridData {
  handle: string
  heading?: string
  images: InstagramGridImage[]
}

export const INSTAGRAM_GRID_SCHEMA_VERSION = 1

const INSTA = "/learts/assets/images/instagram"

export const instagramGridBlock: BlockDefinition<InstagramGridData> = {
  type: "instagram_grid",
  label: "Instagram Grid",
  schemaVersion: INSTAGRAM_GRID_SCHEMA_VERSION,
  defaultData: (): InstagramGridData => ({
    handle: "@forever_finds",
    heading: "Follow us on instagram",
    images: [
      { image: `${INSTA}/instagram-1.webp`, href: "#" },
      { image: `${INSTA}/instagram-2.webp`, href: "#" },
      { image: `${INSTA}/instagram-3.webp`, href: "#" },
      { image: `${INSTA}/instagram-4.webp`, href: "#" },
      { image: `${INSTA}/instagram-1.webp`, href: "#" },
      { image: `${INSTA}/instagram-2.webp`, href: "#" },
    ],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["instagram_grid: data must be an object"])
    }

    if (!isNonEmptyStr(data.handle)) {
      errors.push("instagram_grid: handle is required")
    }

    if (data.heading !== undefined && !isStr(data.heading)) {
      errors.push("instagram_grid: heading must be a string")
    }

    if (!Array.isArray(data.images)) {
      errors.push("instagram_grid: images must be an array")
      return ok(errors)
    }

    data.images.forEach((item, i) => {
      if (!isObj(item)) {
        errors.push(`instagram_grid: images[${i}] must be an object`)
        return
      }
      if (!isNonEmptyStr(item.image)) {
        errors.push(`instagram_grid: images[${i}].image is required (media URL)`)
      }
      if (!isNonEmptyStr(item.href)) {
        errors.push(`instagram_grid: images[${i}].href is required`)
      }
    })

    return ok(errors)
  },
}

export default instagramGridBlock
