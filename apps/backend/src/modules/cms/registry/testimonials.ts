import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * testimonials — a section of customer / client quotes in the Learts
 * `.testimonial` styling (round avatar, quote, author name + role).
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     title?: string                    ·i18n        // section heading
 *     items: Array<{
 *       quote: string                   ·i18n        // the testimonial body
 *       author: string                                // person's name (invariant)
 *       role?: string                   ·i18n        // their role / company line
 *       avatar?: string                               // invariant — media URL
 *     }>
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). All other keys are
 * locale-invariant structure. `author` is a proper name (kept invariant) and
 * `avatar` is stored as a plain URL string (the seed uses
 * `/learts/assets/images/testimonial/testimonial-*.webp`); the admin
 * ImagePicker persists the chosen media URL here.
 */

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
}

export interface TestimonialsData {
  title?: string
  items: TestimonialItem[]
}

export const TESTIMONIALS_SCHEMA_VERSION = 1

const TESTIMONIAL = "/learts/assets/images/testimonial"

export const testimonialsBlock: BlockDefinition<TestimonialsData> = {
  type: "testimonials",
  label: "Testimonials",
  schemaVersion: TESTIMONIALS_SCHEMA_VERSION,
  defaultData: (): TestimonialsData => ({
    title: "What our customers say",
    items: [
      {
        quote:
          "Absolutely in love with my purchase. The craftsmanship is beautiful and it arrived even quicker than I expected. I'll definitely be shopping here again.",
        author: "Amelia Hart",
        role: "Verified buyer",
        avatar: `${TESTIMONIAL}/testimonial-1.webp`,
      },
      {
        quote:
          "Every piece feels unique and made with care. Forever Finds has become my go-to for thoughtful, one-of-a-kind gifts.",
        author: "Daniel Brooks",
        role: "Verified buyer",
        avatar: `${TESTIMONIAL}/testimonial-2.webp`,
      },
      {
        quote:
          "Wonderful quality and friendly service. The little handwritten note in my package made my whole day — highly recommended!",
        author: "Sofia Nguyen",
        role: "Verified buyer",
        avatar: `${TESTIMONIAL}/testimonial-3.webp`,
      },
    ],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["testimonials: data must be an object"])
    }

    if (data.title !== undefined && !isStr(data.title)) {
      errors.push("testimonials: title must be a string")
    }

    if (!Array.isArray(data.items)) {
      errors.push("testimonials: items must be an array")
      return ok(errors)
    }

    data.items.forEach((item, i) => {
      if (!isObj(item)) {
        errors.push(`testimonials: items[${i}] must be an object`)
        return
      }
      if (!isNonEmptyStr(item.quote)) {
        errors.push(`testimonials: items[${i}].quote is required`)
      }
      if (!isNonEmptyStr(item.author)) {
        errors.push(`testimonials: items[${i}].author is required`)
      }
      if (item.role !== undefined && !isStr(item.role)) {
        errors.push(`testimonials: items[${i}].role must be a string`)
      }
      if (item.avatar !== undefined && !isStr(item.avatar)) {
        errors.push(
          `testimonials: items[${i}].avatar must be a string (media URL)`
        )
      }
    })

    return ok(errors)
  },
}

export default testimonialsBlock
