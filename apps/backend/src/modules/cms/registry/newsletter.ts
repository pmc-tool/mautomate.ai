import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * newsletter — email signup section (Learts `widget-subscibe` look).
 *
 * RESOLVED data shape (en lives on `section.data`, bn overrides via
 * cms_section_translation):
 *
 *   {
 *     title: string         ·i18n        // headline ("Sign up to Newsletter")
 *     subtitle?: string     ·i18n        // supporting copy under the title
 *     placeholder: string   ·i18n        // email input placeholder
 *     button: string        ·i18n        // submit button label ("Subscribe")
 *     provider_note?: string ·i18n       // small print under the form
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). There is no locale-invariant
 * structure here — every field is a translatable string. `subtitle` and
 * `provider_note` are optional (absent => that line is not rendered).
 */

export interface NewsletterData {
  title: string
  subtitle?: string
  placeholder: string
  button: string
  provider_note?: string
}

export const NEWSLETTER_SCHEMA_VERSION = 1

export const newsletterBlock: BlockDefinition<NewsletterData> = {
  type: "newsletter",
  label: "Newsletter",
  schemaVersion: NEWSLETTER_SCHEMA_VERSION,
  defaultData: (): NewsletterData => ({
    title: "Sign up to Newsletter",
    subtitle: "...and receive $20 coupon for your first shopping.",
    placeholder: "Enter your email address",
    button: "Subscribe",
    provider_note: "We respect your privacy. Unsubscribe at any time.",
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["newsletter: data must be an object"])
    }

    if (!isNonEmptyStr(data.title)) {
      errors.push("newsletter: title is required")
    }
    if (data.subtitle !== undefined && !isStr(data.subtitle)) {
      errors.push("newsletter: subtitle must be a string")
    }
    if (!isNonEmptyStr(data.placeholder)) {
      errors.push("newsletter: placeholder is required")
    }
    if (!isNonEmptyStr(data.button)) {
      errors.push("newsletter: button is required")
    }
    if (data.provider_note !== undefined && !isStr(data.provider_note)) {
      errors.push("newsletter: provider_note must be a string")
    }

    return ok(errors)
  },
}

export default newsletterBlock
