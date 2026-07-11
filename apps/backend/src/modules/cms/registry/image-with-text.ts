import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * image_with_text — a single image + text banner (a two-column "media object":
 * an image on one side, a copy block — eyebrow / title / body / CTA — on the
 * other). Learts markup mirrors the storefront `home/components/learts`
 * two-column `product-deal` / image+content layout.
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     image: string                    // locale-invariant — media URL
 *     image_side: "left" | "right"     // locale-invariant — which side the
 *                                      //   image sits on (default "left")
 *     eyebrow?: string   ·i18n         // small kicker line above the title
 *     title: string      ·i18n         // headline; "\n" renders as a <br/>
 *     body?: string      ·i18n         // paragraph copy
 *     cta?: {                          // optional button (absent => no button)
 *       label?: string   ·i18n         // button text ("shop now")
 *       href: string                   // locale-invariant — link target
 *     }
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). All other keys are
 * locale-invariant structure. `image` is stored as a plain URL string; the
 * admin ImagePicker persists the chosen media URL here.
 */

export interface ImageWithTextCta {
  label?: string
  href: string
}

export type ImageWithTextSide = "left" | "right"

export interface ImageWithTextData {
  image: string
  image_side: ImageWithTextSide
  eyebrow?: string
  title: string
  body?: string
  cta?: ImageWithTextCta
}

export const IMAGE_WITH_TEXT_SCHEMA_VERSION = 1

export const imageWithTextBlock: BlockDefinition<ImageWithTextData> = {
  type: "image_with_text",
  label: "Image with Text",
  schemaVersion: IMAGE_WITH_TEXT_SCHEMA_VERSION,
  defaultData: (): ImageWithTextData => ({
    image: "/learts/assets/images/product/deal-product-1.webp",
    image_side: "left",
    eyebrow: "Handicraft shop",
    title: "Crafted with care,\nmade to be found",
    body: "Years of experience brought about by our skilled craftsmen could ensure that every piece produced is a work of art. Our focus is always the best quality possible.",
    cta: { label: "shop now", href: "/store" },
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["image_with_text: data must be an object"])
    }

    if (!isNonEmptyStr(data.image)) {
      errors.push("image_with_text: image is required (media URL)")
    }

    if (
      data.image_side !== undefined &&
      data.image_side !== "left" &&
      data.image_side !== "right"
    ) {
      errors.push(
        'image_with_text: image_side must be "left" or "right"'
      )
    }

    if (!isNonEmptyStr(data.title)) {
      errors.push("image_with_text: title is required")
    }

    if (data.eyebrow !== undefined && !isStr(data.eyebrow)) {
      errors.push("image_with_text: eyebrow must be a string")
    }

    if (data.body !== undefined && !isStr(data.body)) {
      errors.push("image_with_text: body must be a string")
    }

    // cta (optional group)
    if (data.cta !== undefined) {
      if (!isObj(data.cta)) {
        errors.push("image_with_text: cta must be an object")
      } else {
        if (!isNonEmptyStr(data.cta.href)) {
          errors.push("image_with_text: cta.href is required")
        }
        if (data.cta.label !== undefined && !isStr(data.cta.label)) {
          errors.push("image_with_text: cta.label must be a string")
        }
      }
    }

    return ok(errors)
  },
}

export default imageWithTextBlock
