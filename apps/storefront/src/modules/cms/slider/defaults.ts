/* ------------------------------------------------------------------ */
/* Slider defaults + theme placement map (ARCH-SLIDER §1.1 / §5).       */
/*                                                                     */
/* Layer defaults are authored against the BRAND TOKENS (--ff-* CSS     */
/* vars the style engine already resolves), never against a theme's     */
/* markup — that is how a layered slide re-skins itself when the        */
/* merchant changes theme or brand tokens even though the markup is     */
/* platform-owned (§2.1). The CSS side of these defaults is emitted by  */
/* render/slider-css.ts (SLIDER_BASE_CSS); the DATA side here is what   */
/* the stage editor (5B) stamps on newly added layers and what the      */
/* upgrade fn (upgrade.ts) composes from.                               */
/* ------------------------------------------------------------------ */

import type {
  LayerFrame,
  LayerType,
  LayeredSliderSettings,
  SliderHeight,
} from "./model"
import type { ResponsiveValue } from "../schema/types"

/* --------------------------- slider level --------------------------- */

/**
 * Default slider height: aspect-ratio 16/7 on desktop, 4/5 on mobile
 * (tall phone hero), floored at nothing — merchants opt into a minPx.
 * Applied by slider-css when settings carry no `height`.
 */
export const DEFAULT_SLIDER_HEIGHT: ResponsiveValue<SliderHeight> = {
  base: { aspect: "16/7" },
  mobile: { aspect: "4/5" },
}

export const DEFAULT_TRANSITION = "fade" as const
export const DEFAULT_AUTOPLAY_MS = 5000
/** Entrance default duration (ms) — matches the entrance vocabulary. */
export const DEFAULT_ANIM_DURATION_MS = 600

export function sliderDefaults(): Required<
  Pick<LayeredSliderSettings, "transition" | "arrows" | "dots" | "pauseOnHover">
> {
  return { transition: DEFAULT_TRANSITION, arrows: true, dots: true, pauseOnHover: true }
}

/* ---------------------------- layer level ---------------------------- */

/** A new layer of each type drops at slide center (5B's Add-layer toolbar). */
export const DEFAULT_LAYER_FRAME: Record<LayerType, LayerFrame> = {
  text: { anchor: "cc", x: 0, y: 0, w: 46, h: "auto" },
  image: { anchor: "cc", x: 0, y: 0, w: 30, h: 30 },
  button: { anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" },
  shape: { anchor: "cc", x: 0, y: 0, w: 30, h: 20 },
  icon: { anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" },
}

/* ------------------------ theme placement map ------------------------ */

/**
 * Where the upgrade fn lands the three legacy roles (kicker / title / cta)
 * on the slide canvas. A theme package MAY declare `slider_placement`
 * hints in its manifest with exactly this shape (optional, additive — no
 * theme must change); absent hints, DEFAULT_PLACEMENT applies.
 */
export interface RolePlacement {
  frame: LayerFrame
  /** Entrance stagger delay for this role (ms). */
  delay_ms?: number
}

export interface SliderPlacement {
  kicker?: RolePlacement
  title?: RolePlacement
  cta?: RolePlacement
}

/**
 * The platform default mirrors the dominant theme composition (learts:
 * left-center stack — kicker above, title on the vertical center, button
 * below, all pinned to the left edge with an 8% inset), staggered.
 *
 * The three frames are vertically DISJOINT by construction: the title is
 * center-anchored (cl) while the kicker hangs off the top of the title
 * band (y = -14 → 36% line) and the button below it (y = +18 → 68% line),
 * so intrinsic-height text never collides for realistic headline sizes.
 */
export const DEFAULT_PLACEMENT: Required<SliderPlacement> = {
  kicker: {
    frame: { anchor: "cl", x: 8, y: -14, w: 46, h: "auto" },
    delay_ms: 0,
  },
  title: {
    frame: { anchor: "cl", x: 8, y: 0, w: 46, h: "auto" },
    delay_ms: 150,
  },
  cta: {
    frame: { anchor: "cl", x: 8, y: 18, w: "auto", h: "auto" },
    delay_ms: 300,
  },
}

/**
 * Normalize an untrusted `slider_placement` manifest hint into a complete
 * placement (missing / malformed roles fall back to the default). Pure.
 */
export function resolvePlacement(hint?: unknown): Required<SliderPlacement> {
  const h = (hint && typeof hint === "object" && !Array.isArray(hint)
    ? hint
    : {}) as SliderPlacement
  const pick = (r: RolePlacement | undefined, fallback: RolePlacement): RolePlacement => {
    const f = r?.frame
    if (
      !f ||
      typeof f !== "object" ||
      typeof f.x !== "number" ||
      typeof f.y !== "number"
    ) {
      return fallback
    }
    return {
      frame: {
        anchor: (f.anchor as LayerFrame["anchor"]) ?? fallback.frame.anchor,
        x: f.x,
        y: f.y,
        w: f.w ?? fallback.frame.w,
        h: f.h ?? fallback.frame.h,
      },
      delay_ms:
        typeof r?.delay_ms === "number" && r.delay_ms >= 0
          ? r.delay_ms
          : fallback.delay_ms,
    }
  }
  return {
    kicker: pick(h.kicker, DEFAULT_PLACEMENT.kicker),
    title: pick(h.title, DEFAULT_PLACEMENT.title),
    cta: pick(h.cta, DEFAULT_PLACEMENT.cta),
  }
}

/* ---------------------- per-theme placement hints --------------------- */

/**
 * Platform-side `slider_placement` hint sets for the live-tenant themes
 * (Phase 5C / ARCH-SLIDER S3). A theme package that declares its own
 * `slider_placement` manifest hint still wins at the call site; these are
 * the platform's readings of each theme's OWN hero composition, derived
 * from the shipped hero Liquid + CSS in the DB bundles:
 *
 *  - learts: the DEFAULT_PLACEMENT above (left-center stack, 8% inset).
 *  - rokon (`sections/hero_slider.liquid` + `.rk-hero-*` in theme.css):
 *    left editorial stack inside a centered `.rk-container` — uppercase
 *    eyebrow above a max-620px (~52% of the 1200 reference) headline with
 *    a 30px gap to the button, all left-aligned and vertically centered.
 *  - shofy (`.sf-hero-inner` is a 5fr/7fr grid): text lives in the LEFT
 *    ~40% column (white on the hero color), imagery owns the right — so
 *    the title is width-capped at 38% and everything hugs the left gutter.
 */
export const THEME_SLIDER_PLACEMENTS: Record<string, SliderPlacement> = {
  rokon: {
    kicker: {
      frame: { anchor: "cl", x: 7, y: -16, w: "auto", h: "auto" },
      delay_ms: 0,
    },
    title: {
      frame: { anchor: "cl", x: 7, y: 0, w: 52, h: "auto" },
      delay_ms: 150,
    },
    cta: {
      frame: { anchor: "cl", x: 7, y: 20, w: "auto", h: "auto" },
      delay_ms: 300,
    },
  },
  shofy: {
    kicker: {
      frame: { anchor: "cl", x: 6, y: -15, w: "auto", h: "auto" },
      delay_ms: 0,
    },
    title: {
      frame: { anchor: "cl", x: 6, y: 0, w: 38, h: "auto" },
      delay_ms: 150,
    },
    cta: {
      frame: { anchor: "cl", x: 6, y: 19, w: "auto", h: "auto" },
      delay_ms: 300,
    },
  },
}

/**
 * The placement hint for a theme handle ("rokon-liquid" → rokon's set),
 * or undefined (→ DEFAULT_PLACEMENT via resolvePlacement). Pure; safe on
 * client and server. learts deliberately has no entry — the platform
 * default IS the learts composition.
 */
export function placementForTheme(handle?: unknown): SliderPlacement | undefined {
  if (typeof handle !== "string" || !handle.trim()) return undefined
  const key = handle.trim().toLowerCase().replace(/-liquid$/, "")
  return THEME_SLIDER_PLACEMENTS[key]
}
