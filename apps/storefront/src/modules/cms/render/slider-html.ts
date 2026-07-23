/* ------------------------------------------------------------------ */
/* Layered slider — PLATFORM-LEVEL HTML renderer (ARCH-SLIDER §2).      */
/*                                                                     */
/* A layered slide is rendered by the PLATFORM, never by a theme's      */
/* sections/hero_slider.liquid — the container-html precedent: no       */
/* uploaded theme can be trusted to know the layer vocabulary, and      */
/* patching ten themes never fixes the NEXT upload. ONE function serves */
/* BOTH render paths (live `render_section` via the document composer,  */
/* and the editor canvas), so editor and live page can never disagree.  */
/*                                                                     */
/* Markers are `data-ffs-*` / `data-slide` / `data-layer` EXCLUSIVELY — */
/* a theme's own `[data-hero]` JS can never find this markup, so        */
/* double-binding is impossible by construction (§2.3 / §5 risk (b)).   */
/*                                                                     */
/* SECURITY: every authored string is HTML-escaped on the way out; the  */
/* only raw HTML is a TEXT layer's body, and only after the shared      */
/* @lib/util/sanitize-html. URLs are attribute-escaped with the same    */
/* scheme refusal as container-html. Background videos are direct       */
/* http(s) .mp4 ONLY. CSS goes through slider-css's sanitizers.         */
/*                                                                     */
/* MIXED SLIDERS (§5): a fields-shaped slide inside a layered slider    */
/* upgrades AT RENDER TIME through the pure upgrade fn — never stored,  */
/* deterministic ids — so mixed states never fork the runtime.          */
/*                                                                     */
/* Framework-free, isomorphic, never throws on merchant data.           */
/* ------------------------------------------------------------------ */

import { sanitizeHtml } from "@lib/util/sanitize-html"
import { linkAttrs } from "@modules/cms/schema/types"
import {
  isLayeredSlide,
  type LayeredSlide,
  type LayeredSliderSettings,
  type SliderLayer,
  type ButtonLayerProps,
  type IconLayerProps,
  type ImageLayerProps,
  type ShapeLayerProps,
  type TextLayerProps,
} from "@modules/cms/slider/model"
import { upgradeFieldsSlide } from "@modules/cms/slider/upgrade"
import {
  DEFAULT_AUTOPLAY_MS,
  sliderDefaults,
  type SliderPlacement,
} from "@modules/cms/slider/defaults"
import {
  SLIDER_BASE_CSS,
  SLIDER_ENTRANCE_CSS,
  buildSliderCss,
  sanitizeSliderKey,
} from "@modules/cms/render/slider-css"

export interface RenderSliderOptions {
  /**
   * Stable per-section style scope ("sec-<i>") — namespaces this slider's
   * CSS ([data-ffs="<key>"]). Falls back to a key derived from the first
   * slide id (the widget-in-column path, which has no section scope).
   */
  scope?: string
  /**
   * EDITOR-ONLY. The stage (5B) drives slide visibility, so the runtime
   * script tag is not emitted and autoplay never runs in the canvas.
   * Live output leaves this falsy.
   */
  editor?: boolean
  /**
   * 5C: the active theme's `slider_placement` hint (placementForTheme /
   * a theme manifest), applied to RENDER-TIME upgrades of leftover
   * fields slides in a mixed slider. The editor's upgrade command passes
   * the SAME hint, so a committed upgrade and its render preview agree.
   */
  placement?: SliderPlacement
}

/* ------------------------------ escaping ------------------------------ */

/** Same escaper as container-html / the theme engine. */
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Attribute URL with the script-bearing schemes refused (container-html). */
function escapeUrl(raw: unknown): string {
  const s = String(raw ?? "").trim()
  const probe = s
    .replace(/&#(\d+);?/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[\u0000-\u0020]/g, "")
    .toLowerCase()
  if (/^(javascript|vbscript|data):/.test(probe)) {
    return ""
  }
  return escapeHtml(s)
}

const escapeAttr = escapeHtml

/** Direct http(s) .mp4 only — the §1.2 background-video contract. */
function mp4Src(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return ""
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return ""
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return ""
  if (!url.pathname.toLowerCase().endsWith(".mp4")) return ""
  return url.href
}

const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"])

/* ------------------------------- layers ------------------------------- */

/** Entrance attributes (§4): the runtime stamps `ffs-in` after delay_ms;
 *  5C's preset CSS keys off `data-ffs-anim` / duration / ease. Emitted
 *  only for a real preset, so anim-less layers carry no extra bytes. */
function animAttrs(layer: SliderLayer): string {
  const anim = layer.anim
  if (!anim || typeof anim !== "object" || !anim.preset || anim.preset === "none") {
    return ""
  }
  const preset = escapeAttr(anim.preset)
  const delay = Number.isFinite(Number(anim.delay_ms))
    ? Math.min(Math.max(Number(anim.delay_ms), 0), 4000)
    : 0
  const dur = Number.isFinite(Number(anim.duration_ms)) && Number(anim.duration_ms) > 0
    ? Number(anim.duration_ms)
    : 600
  const ease =
    anim.ease === "ease-in-out" || anim.ease === "spring" ? anim.ease : "ease-out"
  return (
    ` data-ffs-anim="${preset}" data-ffs-delay="${delay}"` +
    ` data-ffs-dur="${dur}" data-ffs-ease="${ease}"`
  )
}

function renderLayer(layer: SliderLayer): string {
  if (!layer || typeof layer !== "object") return ""
  const id = sanitizeSliderKey(layer.id)
  if (!id) return ""
  const common = `data-layer="${id}"${animAttrs(layer)}`

  switch (layer.type) {
    case "text": {
      const p = (layer.props ?? {}) as TextLayerProps
      const tag = typeof p.tag === "string" && TEXT_TAGS.has(p.tag) ? p.tag : "p"
      const html = sanitizeHtml(typeof p.html === "string" ? p.html : "")
      return `<${tag} class="ffs-layer ffs-l-text" ${common}>${html}</${tag}>`
    }
    case "image": {
      const p = (layer.props ?? {}) as ImageLayerProps
      const src = escapeUrl(typeof p.src === "string" ? p.src : "")
      if (!src) return ""
      const img =
        `<img src="${src}" alt="${escapeHtml(typeof p.alt === "string" ? p.alt : "")}">`
      const a = linkAttrs(p.href)
      const href = escapeUrl(a.href.trim())
      if (href) {
        return (
          `<a class="ffs-layer ffs-l-image" ${common} href="${href}"` +
          (a.target ? ` target="_blank"` : "") +
          (a.rel ? ` rel="${escapeAttr(a.rel)}"` : "") +
          `>${img}</a>`
        )
      }
      return `<span class="ffs-layer ffs-l-image" ${common}>${img}</span>`
    }
    case "button": {
      const p = (layer.props ?? {}) as ButtonLayerProps
      const label = typeof p.label === "string" ? p.label : ""
      const a = linkAttrs(p.href)
      const href = escapeUrl(a.href.trim()) || "#"
      const variant = p.variant === "outline" ? " ffs-btn-outline" : ""
      return (
        `<a class="ffs-layer ffs-l-button${variant}" ${common} href="${href}"` +
        (a.target ? ` target="_blank"` : "") +
        (a.rel ? ` rel="${escapeAttr(a.rel)}"` : "") +
        `>${escapeHtml(label)}</a>`
      )
    }
    case "shape": {
      const p = (layer.props ?? {}) as ShapeLayerProps
      const a = linkAttrs(p.href)
      const href = escapeUrl(a.href.trim())
      if (href) {
        return (
          `<a class="ffs-layer ffs-l-shape" ${common} href="${href}"` +
          (a.target ? ` target="_blank"` : "") +
          (a.rel ? ` rel="${escapeAttr(a.rel)}"` : "") +
          `></a>`
        )
      }
      return `<div class="ffs-layer ffs-l-shape" ${common}></div>`
    }
    case "icon": {
      const p = (layer.props ?? {}) as IconLayerProps
      const icon = typeof p.icon === "string" ? p.icon.trim() : ""
      if (!icon) return ""
      // Same vocabulary as the icon widget: the icon's class string, with
      // the size emitted inline through the cqw scaler by slider-css? No —
      // icon size is a PROP (not a style bag), so it rides inline here as
      // a font-size the frame CSS cannot miss. Scaled in slider-css terms:
      // px at the 1200 reference.
      const size = Number(p.size)
      const style =
        Number.isFinite(size) && size > 0
          ? ` style="font-size:max(${Math.max(12, Math.round(size * 0.375))}px,${
              Math.round((size / 12) * 1000) / 1000
            }cqw)"`
          : ""
      return (
        `<span class="ffs-layer ffs-l-icon" ${common}${style}>` +
        `<i class="${escapeAttr(icon)}" aria-hidden="true"></i></span>`
      )
    }
    default:
      // Unknown layer type (a future vocabulary) — degrade silently.
      return ""
  }
}

/* ------------------------------- slides ------------------------------- */

function renderSlide(slide: LayeredSlide, index: number): string {
  const sid = sanitizeSliderKey(slide.id) || `s${index}`
  const bg = slide.background
  const duration = Number(slide.duration_ms)
  let out =
    `<div class="ffs-slide${index === 0 ? " ffs-active" : ""}" data-slide="${sid}"` +
    (Number.isFinite(duration) && duration > 0 ? ` data-ffs-duration="${duration}"` : "") +
    `>`

  // Background: a video element for mp4 backgrounds, else a CSS-painted
  // div (color / image / focal / fit all live in slider-css).
  const video = bg?.type === "video" ? mp4Src(bg.video) : ""
  if (video) {
    out += `<video class="ffs-bg" src="${escapeUrl(video)}" muted loop autoplay playsinline></video>`
  } else {
    out += `<div class="ffs-bg"></div>`
  }
  if (bg?.overlay && typeof bg.overlay === "object") {
    out += `<div class="ffs-overlay"></div>`
  }

  // Whole-slide click-through sits UNDER the layers (layers on top win).
  const link = escapeUrl(typeof slide.link === "string" ? slide.link.trim() : "")
  if (link) {
    out += `<a class="ffs-slide-link" href="${link}" aria-label="${escapeHtml(
      slide.name ?? `Slide ${index + 1}`
    )}"></a>`
  }

  // ARRAY ORDER = paint order (z comes from DOM order, no stored z-index).
  for (const layer of slide.layers ?? []) {
    out += renderLayer(layer)
  }
  out += `</div>`
  return out
}

/* -------------------------------- root -------------------------------- */

/**
 * Render a layered hero_slider to HTML (styles inlined, runtime loaded
 * once per page from /ffslider.js — a static public asset middleware
 * passes straight through, so it reaches LIVE Liquid-rendered pages).
 * The caller has already decided this slider IS layered (isLayeredSlider
 * — the engine branch in the document composer).
 */
export function renderSliderHtml(
  settings: LayeredSliderSettings | null | undefined,
  opts: RenderSliderOptions = {}
): string {
  const s = settings && typeof settings === "object" ? settings : {}
  const rawSlides = Array.isArray(s.slides) ? s.slides : []

  // Mixed sliders: upgrade leftover fields slides at render, pure + index-
  // deterministic (never stored — the stored document keeps its shapes).
  const upgradedAt: number[] = []
  const slides: LayeredSlide[] = rawSlides
    .filter((sl): sl is NonNullable<typeof sl> => !!sl && typeof sl === "object")
    .map((sl, i) => {
      if (isLayeredSlide(sl)) return sl
      upgradedAt.push(i)
      return upgradeFieldsSlide(sl, { index: i, placement: opts.placement })
    })

  // F1 (5V finding, 6B fix): a STORED layered slide can legitimately carry
  // an `up-<i>` id (it was committed by the editor's upgrade command, then
  // slides were reordered or inserted around it). When a render-upgraded
  // fields slide lands the SAME `up-<index>` id, the emitted data-slide
  // ids — and, because upgraded layer ids are prefixed with their slide
  // id, the data-layer ids too — would collide. Dedup on emit, on the
  // RENDER-UPGRADED side ONLY: stored ids are the editor's addressing
  // truth and are never rewritten, and collision-free sliders skip this
  // block entirely, so existing output stays byte-identical. Runs BEFORE
  // rootKey/buildSliderCss read `slides`, so CSS keys always match the
  // DOM they scope.
  if (upgradedAt.length) {
    const upgradedSet = new Set(upgradedAt)
    const storedIds = new Set<string>()
    slides.forEach((sl, i) => {
      if (!upgradedSet.has(i)) storedIds.add(String(sl.id))
    })
    for (const i of upgradedAt) {
      const sl = slides[i]
      const id = String(sl.id)
      if (!storedIds.has(id)) continue
      let next = `${id}-r`
      for (let n = 2; storedIds.has(next); n++) next = `${id}-r${n}`
      slides[i] = {
        ...sl,
        id: next,
        layers: (sl.layers ?? []).map((l) =>
          l && typeof l.id === "string" && l.id.startsWith(`${id}-`)
            ? { ...l, id: `${next}${l.id.slice(id.length)}` }
            : l
        ),
      }
    }
  }

  if (!slides.length) return ""

  const defaults = sliderDefaults()
  const firstSlideKey = sanitizeSliderKey(slides[0]?.id)
  const rootKey =
    sanitizeSliderKey(opts.scope) || (firstSlideKey ? `s-${firstSlideKey}` : "x")

  const autoplayRaw = Number(s.autoplay_ms)
  const autoplay =
    Number.isFinite(autoplayRaw) && autoplayRaw >= 0 ? autoplayRaw : DEFAULT_AUTOPLAY_MS
  const transition = s.transition === "slide" ? "slide" : defaults.transition
  const arrows = (s.arrows === undefined ? defaults.arrows : s.arrows === true) && slides.length > 1
  const dots = (s.dots === undefined ? defaults.dots : s.dots === true) && slides.length > 1
  const pause = s.pauseOnHover === undefined ? defaults.pauseOnHover : s.pauseOnHover === true

  const css = (SLIDER_BASE_CSS + SLIDER_ENTRANCE_CSS + buildSliderCss(rootKey, s, slides))
    // A "<" is never legitimate CSS — stripping it makes closing the
    // <style> element impossible (the container-html discipline).
    .replace(/</g, "")

  let out =
    `<div class="ffs" data-ffs="${rootKey}"` +
    ` data-ffs-autoplay="${autoplay}" data-ffs-transition="${transition}"` +
    (pause ? ` data-ffs-pause="1"` : "") +
    ` role="region" aria-roledescription="carousel" aria-label="Slider">`
  out += `<style>${css}</style>`

  slides.forEach((slide, i) => {
    out += renderSlide(slide, i)
  })

  if (arrows) {
    out +=
      `<button class="ffs-arrow ffs-prev" type="button" data-ffs-prev aria-label="Previous slide">&#8249;</button>` +
      `<button class="ffs-arrow ffs-next" type="button" data-ffs-next aria-label="Next slide">&#8250;</button>`
  }
  if (dots) {
    out += `<div class="ffs-dots" data-ffs-dots>`
    slides.forEach((_sl, i) => {
      out += `<button class="ffs-dot${i === 0 ? " ffs-active" : ""}" type="button" data-ffs-dot="${i}" aria-label="Slide ${i + 1}"></button>`
    })
    out += `</div>`
  }

  // Live pages load the ~2 KB runtime once; the browser dedupes the fetch
  // and the IIFE guards against double execution, so two sliders on one
  // page emitting two tags is harmless. The editor canvas gets NO runtime
  // — the stage (5B) drives slide visibility (and innerHTML-spliced
  // script tags never execute there anyway).
  if (!opts.editor) {
    out += `<script src="/ffslider.js" defer></script>`
  }
  out += `</div>`
  return out
}

export default renderSliderHtml
