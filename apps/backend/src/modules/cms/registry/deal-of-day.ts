import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * deal_of_day — single "Deal of the day" promo with a live countdown (refactor
 * of the storefront `home/components/learts/deal-of-day.tsx`).
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     image: string                     // locale-invariant — media URL
 *     title: string        ·i18n        // "Deal of the day"
 *     description?: string ·i18n        // supporting paragraph copy
 *     countdown_to: string              // locale-invariant — ISO date the timer
 *                                       //   counts down to (e.g. "2026-07-10T00:00:00.000Z")
 *     cta: {
 *       label?: string     ·i18n        // button text ("Shop Now")
 *       href: string                    // locale-invariant — link target
 *     }
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). All other keys are
 * locale-invariant structure. `image` is stored as a plain URL string (the seed
 * uses `/learts/assets/images/product/deal-product-1.webp`); the admin
 * ImagePicker persists the chosen media URL here. `countdown_to` is an ISO 8601
 * datetime string; the storefront ticks down to it on the client.
 */

export interface DealOfDayCta {
  label?: string
  href: string
}

export interface DealOfDayData {
  image: string
  title: string
  description?: string
  countdown_to: string
  cta: DealOfDayCta
}

export const DEAL_OF_DAY_SCHEMA_VERSION = 1

export const dealOfDayBlock: BlockDefinition<DealOfDayData> = {
  type: "deal_of_day",
  label: "Deal of the Day",
  schemaVersion: DEAL_OF_DAY_SCHEMA_VERSION,
  defaultData: (): DealOfDayData => ({
    image: "/learts/assets/images/product/deal-product-1.webp",
    title: "Deal of the day",
    description:
      "Years of experience brought about by our skilled craftsmen could ensure that every piece produced is a work of art. Our focus is always the best quality possible.",
    countdown_to: "2026-07-10T00:00:00.000Z",
    cta: { label: "Shop Now", href: "/store" },
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["deal_of_day: data must be an object"])
    }

    if (!isNonEmptyStr(data.image)) {
      errors.push("deal_of_day: image is required (media URL)")
    }

    if (!isNonEmptyStr(data.title)) {
      errors.push("deal_of_day: title is required")
    }

    if (data.description !== undefined && !isStr(data.description)) {
      errors.push("deal_of_day: description must be a string")
    }

    if (!isNonEmptyStr(data.countdown_to)) {
      errors.push("deal_of_day: countdown_to is required (ISO date string)")
    } else if (Number.isNaN(Date.parse(data.countdown_to))) {
      errors.push("deal_of_day: countdown_to must be a valid ISO date string")
    }

    if (!isObj(data.cta)) {
      errors.push("deal_of_day: cta is required")
    } else {
      if (!isNonEmptyStr(data.cta.href)) {
        errors.push("deal_of_day: cta.href is required")
      }
      if (data.cta.label !== undefined && !isStr(data.cta.label)) {
        errors.push("deal_of_day: cta.label must be a string")
      }
    }

    return ok(errors)
  },
}

export default dealOfDayBlock
