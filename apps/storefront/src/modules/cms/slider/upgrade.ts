/* ------------------------------------------------------------------ */
/* Fields-slide → layered-slide upgrade (ARCH-SLIDER §5).               */
/*                                                                     */
/* PURE AND DETERMINISTIC — that is the contract everything else        */
/* leans on:                                                            */
/*  - The 5C editor command (`slider.upgradeSlide`) runs it IN HISTORY  */
/*    so undo restores the stored fields shape (and thereby theme       */
/*    rendering). The undo path is 5C's; this fn only has to never      */
/*    mutate its input and always produce the same output for the same  */
/*    input.                                                            */
/*  - The RENDERER runs it AT RENDER TIME for leftover fields slides    */
/*    inside a mixed slider (isLayeredSlider = any layered slide →      */
/*    platform renders the whole slider). Render-time output is never   */
/*    stored, so ids must be deterministic — they derive from the       */
/*    slide index, never from randomness.                               */
/*                                                                     */
/* Mapping: image → slide background (cover); subtitle → kicker text    */
/* layer (--ff-font-body, small caps); title → h1 text layer            */
/* (--ff-font-heading, linebreaks preserved as <br>); cta → button      */
/* layer (--ff-primary via the button type default). Placement comes    */
/* from the theme's optional `slider_placement` manifest hint, else     */
/* the platform default (defaults.ts).                                  */
/*                                                                     */
/* Section-level style bags / elementStyles stay on the SECTION (outer  */
/* chrome) — they do not translate into layers.                         */
/* ------------------------------------------------------------------ */

import type {
  FieldsSlide,
  LayeredSlide,
  SliderLayer,
} from "./model"
import {
  DEFAULT_ANIM_DURATION_MS,
  resolvePlacement,
  type SliderPlacement,
} from "./defaults"

/** Minimal HTML escape for plain-text fields becoming rich-text layers. */
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Plain text with \n preserved as <br> (the fields title contract). */
function textToHtml(s: string): string {
  return escapeText(s).replace(/\r?\n/g, "<br>")
}

export interface UpgradeOptions {
  /**
   * The slide's index in the slider — the deterministic id seed for
   * render-time upgrades. The 5C editor command passes the same index at
   * commit time, so an editor-upgraded slide and its render-time preview
   * carry identical ids.
   */
  index?: number
  /** Theme `slider_placement` manifest hint (optional, additive). */
  placement?: SliderPlacement
}

/**
 * Upgrade ONE fields-shaped slide to the layered model. Pure: never
 * mutates `slide`, never reads anything but its arguments, and returns a
 * structurally fresh object every call.
 */
export function upgradeFieldsSlide(
  slide: FieldsSlide | null | undefined,
  opts: UpgradeOptions = {}
): LayeredSlide {
  const s = slide && typeof slide === "object" ? slide : {}
  const idx = Number.isInteger(opts.index) && (opts.index as number) >= 0 ? (opts.index as number) : 0
  const id = `up-${idx}`
  const place = resolvePlacement(opts.placement)

  const layers: SliderLayer[] = []

  const subtitle = typeof s.subtitle === "string" ? s.subtitle.trim() : ""
  if (subtitle) {
    layers.push({
      id: `${id}-kicker`,
      type: "text",
      name: "Kicker",
      frame: { base: { ...place.kicker.frame } },
      props: { html: escapeText(subtitle), tag: "p" },
      // Small caps kicker in the body font — the learts eyebrow reading,
      // expressed through brand tokens so any theme re-skins it.
      style: {
        typography: {
          fontFamily: { ref: "body" },
          fontSize: { value: 14, unit: "px" },
          letterSpacing: { value: 2, unit: "px" },
          textTransform: "uppercase",
        },
      },
      anim: {
        preset: "slide-up",
        delay_ms: place.kicker.delay_ms ?? 0,
        duration_ms: DEFAULT_ANIM_DURATION_MS,
      },
    })
  }

  const title = typeof s.title === "string" ? s.title.trim() : ""
  if (title) {
    layers.push({
      id: `${id}-title`,
      type: "text",
      name: "Title",
      frame: { base: { ...place.title.frame } },
      props: { html: textToHtml(title), tag: "h1" },
      anim: {
        preset: "slide-up",
        delay_ms: place.title.delay_ms ?? 150,
        duration_ms: DEFAULT_ANIM_DURATION_MS,
      },
    })
  }

  const cta = s.cta && typeof s.cta === "object" ? s.cta : undefined
  const href = typeof cta?.href === "string" ? cta.href.trim() : ""
  if (href) {
    layers.push({
      id: `${id}-cta`,
      type: "button",
      name: "Button",
      frame: { base: { ...place.cta.frame } },
      props: {
        label: typeof cta?.label === "string" && cta.label ? cta.label : "Shop now",
        href,
        variant: "solid",
      },
      anim: {
        preset: "slide-up",
        delay_ms: place.cta.delay_ms ?? 300,
        duration_ms: DEFAULT_ANIM_DURATION_MS,
      },
    })
  }

  const image = typeof s.image === "string" ? s.image.trim() : ""

  return {
    id,
    background: image ? { type: "image", image, fit: "cover" } : { type: "color" },
    layers,
  }
}
