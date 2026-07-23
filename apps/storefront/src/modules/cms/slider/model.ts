/* ------------------------------------------------------------------ */
/* Slider layer model (ARCH-SLIDER §1 — Phase S1, seat 5A).             */
/*                                                                     */
/* The hero_slider BLOCK keeps its type, registry entry and             */
/* maxInstances. A slide is LAYERED iff it carries a `layers` array —   */
/* that single predicate (isLayeredSlide) is the entire migration       */
/* policy: legacy fields-shaped slides ({image, subtitle, title, cta})  */
/* keep routing to the theme's own sections/hero_slider.liquid          */
/* byte-identically; a slider with ANY layered slide routes to the      */
/* platform renderer (render/slider-html.ts) for ALL its slides,        */
/* upgrading leftover fields slides AT RENDER TIME through the pure     */
/* upgrade fn (never stored) so mixed states never fork the runtime.    */
/*                                                                     */
/* Positioning is RevSlider's nine-anchor model with PERCENT offsets    */
/* riding the platform's existing ResponsiveValue<T> convention         */
/* ({ base, tablet?, mobile? }, cascade via resolveResponsive). The     */
/* whole frame is ONE responsive leaf, so a drag on the tablet device   */
/* writes one `frame.tablet` object — atomic per device.                */
/*                                                                     */
/* Z-order: array order is paint order. No stored z-index.              */
/*                                                                     */
/* ISOMORPHIC ON PURPOSE: types + pure guards only. No React, no DOM,   */
/* no engine imports — the renderer (server + editor canvas), the       */
/* stage editor (5B) and the upgrade command (5C) all consume this      */
/* one vocabulary.                                                      */
/* ------------------------------------------------------------------ */

import type { ResponsiveValue } from "../schema/types"
import type { AdvancedBag, StyleBag } from "../render/style-engine"

/* ----------------------------- anchors ----------------------------- */

/**
 * The nine anchor points of a slide (RevSlider's h∈{l,c,r} × v∈{t,m,b},
 * `data-xy` in its output.sr6 renderer). First letter = vertical row
 * (top / center / bottom), second = horizontal column (left / center /
 * right) — "tl", "cc", "br", …
 */
export const LAYER_ANCHORS = [
  "tl", "tc", "tr",
  "cl", "cc", "cr",
  "bl", "bc", "br",
] as const

export type LayerAnchor = (typeof LAYER_ANCHORS)[number]

export function isLayerAnchor(v: unknown): v is LayerAnchor {
  return typeof v === "string" && (LAYER_ANCHORS as readonly string[]).includes(v)
}

/* ------------------------------ frame ------------------------------ */

/**
 * THE positioning atom. Offsets are PERCENT of the slide box (x: % of
 * slide width, y: % of slide height), measured from the anchor point
 * toward the slide interior (a `br` layer with x=4 sits 4% in from the
 * right edge). Width/height are % of the slide, or "auto" (intrinsic —
 * the default for text/button layers, whose height follows content).
 *
 * Stored as ONE ResponsiveValue<LayerFrame> on the layer, so per-device
 * repositioning is atomic and `resolveResponsive` works unmodified.
 */
export interface LayerFrame {
  anchor: LayerAnchor
  x: number
  y: number
  w: number | "auto"
  h: number | "auto"
}

/* --------------------------- layer types --------------------------- */

/** The five v1 layer types (ARCH-SLIDER §1.4 — video/audio/svg/group cut). */
export const LAYER_TYPES = ["text", "image", "button", "shape", "icon"] as const
export type LayerType = (typeof LAYER_TYPES)[number]

export function isLayerType(v: unknown): v is LayerType {
  return typeof v === "string" && (LAYER_TYPES as readonly string[]).includes(v)
}

/** Text layer: inline-rich HTML (through the shared sanitizer at render). */
export interface TextLayerProps {
  html: string
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p"
}

/** Image layer (covers .svg files too — it is just an <img src>). */
export interface ImageLayerProps {
  src: string
  alt?: string
  href?: string
}

/** Button layer. Defaults styled from brand tokens (var(--ff-primary)). */
export interface ButtonLayerProps {
  label: string
  href: string
  variant?: "solid" | "outline"
}

/** Shape layer: a styled box — scrims, badges, cards. Appearance = style bag. */
export interface ShapeLayerProps {
  href?: string
}

/** Icon layer: reuses the icon widget's vocabulary (icon class string). */
export interface IconLayerProps {
  icon: string
  /** px at the 1200px reference width (emitted cqw-scaled with a floor). */
  size?: number
}

export type LayerProps =
  | TextLayerProps
  | ImageLayerProps
  | ButtonLayerProps
  | ShapeLayerProps
  | IconLayerProps

/* --------------------------- animation ----------------------------- */

/** v1 animation: ONE entrance, a delay, a duration (ARCH-SLIDER §4). */
export const LAYER_ANIM_PRESETS = [
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom-in",
  "zoom-out",
] as const

export type LayerAnimPreset = (typeof LAYER_ANIM_PRESETS)[number]

export interface LayerAnim {
  preset: LayerAnimPreset
  /** 0–4000 ms. */
  delay_ms?: number
  /** default 600 ms. */
  duration_ms?: number
  ease?: "ease-out" | "ease-in-out" | "spring"
}

/* ----------------------------- layers ------------------------------ */

export interface SliderLayer {
  id: string
  type: LayerType
  /** Layer-list label; default derived from type/content. */
  name?: string
  /** THE positioning atom — one responsive leaf (see LayerFrame). */
  frame: ResponsiveValue<LayerFrame>
  /** Per-device visibility (desktop always shows; hide is per-device INDEPENDENT). */
  hidden?: { tablet?: boolean; mobile?: boolean }
  props: LayerProps
  /** EXISTING universal style bag (diff-only) — serialized by slider-css. */
  style?: StyleBag
  /** EXISTING advanced bag, slider-relevant subset. */
  advanced?: AdvancedBag
  anim?: LayerAnim
}

/* --------------------------- background ----------------------------- */

export interface SlideBackground {
  type?: "color" | "image" | "video"
  /** Token refs ({ ref: "primary" }) resolve via resolveTokenRef. */
  color?: string | { ref: string }
  image?: string
  /** Direct .mp4 ONLY (muted, loop, autoplay) — no YouTube/Vimeo backgrounds. */
  video?: string
  /** default "cover". */
  fit?: "cover" | "contain"
  /** object-position / background-position, percent. */
  focal?: { x: number; y: number }
  /** First-class scrim — the one-control "darken the photo" answer. */
  overlay?: { color?: string; opacity?: number; gradient?: string }
}

/* ------------------------------ slides ------------------------------ */

export interface LayeredSlide {
  /** Stable id — command targeting (5B) and CSS selectors key off it. */
  id: string
  /** Filmstrip label. */
  name?: string
  background?: SlideBackground
  /** ARRAY ORDER = z-order, bottom → top. */
  layers: SliderLayer[]
  /** Per-slide autoplay override. */
  duration_ms?: number
  /** Whole-slide click-through (layers on top win). */
  link?: string
}

/** The legacy fields-shaped slide — what every published hero stores today. */
export interface FieldsSlide {
  image?: string
  subtitle?: string
  title?: string
  cta?: { label?: string; href?: string }
  [key: string]: unknown
}

/* ------------------------- slider settings -------------------------- */

/**
 * Slider-level props. `autoplay_ms` is the pre-existing field; the rest are
 * new, flat scalars living in the normal SchemaPanel (never the stage).
 * `height` rides the existing responsive cascade; defaults 16/7 desktop and
 * 4/5 mobile (see defaults.ts).
 */
export interface SliderHeight {
  /** CSS aspect-ratio (e.g. "16/7"). */
  aspect?: string
  /** min-height floor in px. */
  minPx?: number
}

export interface LayeredSliderSettings {
  autoplay_ms?: number
  slides?: Array<LayeredSlide | FieldsSlide>
  transition?: "fade" | "slide"
  height?: ResponsiveValue<SliderHeight>
  arrows?: boolean
  dots?: boolean
  pauseOnHover?: boolean
  [key: string]: unknown
}

/* ------------------------------ guards ------------------------------ */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * THE migration predicate (ARCH-SLIDER §5 risk register): deliberately
 * STRICT — a slide is layered iff it is an object carrying a `layers`
 * ARRAY. No fields-shaped slide ever carries the key, so no published
 * hero can misfire into the platform renderer.
 */
export function isLayeredSlide(v: unknown): v is LayeredSlide {
  return isObj(v) && Array.isArray((v as { layers?: unknown }).layers)
}

/**
 * A hero_slider's settings route to the platform renderer when ANY slide
 * is layered (mixed sliders are legal — leftover fields slides upgrade at
 * render time through the pure upgrade fn, never stored).
 */
export function isLayeredSlider(settings: unknown): settings is LayeredSliderSettings {
  if (!isObj(settings)) {
    return false
  }
  const slides = (settings as { slides?: unknown }).slides
  return Array.isArray(slides) && slides.some(isLayeredSlide)
}
