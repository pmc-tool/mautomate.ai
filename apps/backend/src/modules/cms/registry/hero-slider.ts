import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * hero_slider — full-width slide carousel (refactor of the storefront
 * `home/components/learts/hero-slider.tsx`).
 *
 * RESOLVED data shape (this is what one compiled block carries; the en values
 * live on `section.data`, bn overrides via cms_section_translation):
 *
 *   {
 *     autoplay_ms?: number              // locale-invariant (default 5000)
 *     slides: Array<{
 *       image: string                   // locale-invariant — media URL
 *       subtitle?: string  ·i18n        // short kicker line ("Handicraft shop")
 *       title: string      ·i18n        // headline; "\n" renders as a <br/>
 *       cta: {
 *         label?: string   ·i18n        // button text ("shop now")
 *         href: string                  // locale-invariant — link target
 *       }
 *     }>
 *   }
 *
 * `·i18n` = translatable (overridable per-locale). All other keys are
 * locale-invariant structure. `image` is stored as a plain URL string (the seed
 * uses `/learts/assets/images/slider/home3/slide-*.webp`); the admin ImagePicker
 * persists the chosen media URL here.
 */

export interface HeroSlideCta {
  label?: string
  href: string
}

export interface HeroSlide {
  image: string
  subtitle?: string
  title: string
  cta: HeroSlideCta
}

export interface HeroSliderData {
  autoplay_ms?: number
  slides: HeroSlide[]
}

export const HERO_SLIDER_SCHEMA_VERSION = 1

export const heroSliderBlock: BlockDefinition<HeroSliderData> = {
  type: "hero_slider",
  label: "Hero Slider",
  schemaVersion: HERO_SLIDER_SCHEMA_VERSION,
  defaultData: (): HeroSliderData => ({
    autoplay_ms: 5000,
    slides: [
      {
        image: "/learts/assets/images/slider/home3/slide-1.webp",
        subtitle: "Handicraft shop",
        title: "Inspired by Your\nSweetest Dreams",
        cta: { label: "shop now", href: "/store" },
      },
      {
        image: "/learts/assets/images/slider/home3/slide-2.webp",
        subtitle: "Handicraft shop",
        title: "Daily Recipes\nfor Your Health",
        cta: { label: "shop now", href: "/store" },
      },
      {
        image: "/learts/assets/images/slider/home3/slide-3.webp",
        subtitle: "Handicraft shop",
        title: "Decorative Box\nfor New Aspiration",
        cta: { label: "shop now", href: "/store" },
      },
    ],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["hero_slider: data must be an object"])
    }

    if (
      data.autoplay_ms !== undefined &&
      (typeof data.autoplay_ms !== "number" ||
        !Number.isFinite(data.autoplay_ms) ||
        data.autoplay_ms < 0)
    ) {
      errors.push("hero_slider: autoplay_ms must be a non-negative number")
    }

    if (!Array.isArray(data.slides)) {
      errors.push("hero_slider: slides must be an array")
      return ok(errors)
    }

    data.slides.forEach((slide, i) => {
      if (!isObj(slide)) {
        errors.push(`hero_slider: slides[${i}] must be an object`)
        return
      }
      if (!isNonEmptyStr(slide.image)) {
        errors.push(`hero_slider: slides[${i}].image is required (media URL)`)
      }
      if (!isNonEmptyStr(slide.title)) {
        errors.push(`hero_slider: slides[${i}].title is required`)
      }
      if (slide.subtitle !== undefined && !isStr(slide.subtitle)) {
        errors.push(`hero_slider: slides[${i}].subtitle must be a string`)
      }
      if (!isObj(slide.cta)) {
        errors.push(`hero_slider: slides[${i}].cta is required`)
      } else {
        if (!isNonEmptyStr(slide.cta.href)) {
          errors.push(`hero_slider: slides[${i}].cta.href is required`)
        }
        if (slide.cta.label !== undefined && !isStr(slide.cta.label)) {
          errors.push(`hero_slider: slides[${i}].cta.label must be a string`)
        }
      }
    })

    return ok(errors)
  },
}

export default heroSliderBlock
