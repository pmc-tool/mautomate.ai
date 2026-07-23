/* ------------------------------------------------------------------ */
/* Layered-slider CSS (ARCH-SLIDER §2.2 — Phase S1, seat 5A).           */
/*                                                                     */
/* The slide box is the coordinate system:                              */
/*   .ffs        { position:relative; aspect-ratio:<h> }                */
/*   .ffs-slide  { container-type:size; position:absolute; inset:0 }    */
/*   .ffs-layer  { position:absolute }                                  */
/*                                                                     */
/* RevSlider's virtual design grid, carried by pure CSS: offsets are    */
/* PERCENT of the slide, so no runtime measuring engine exists at all;  */
/* typography authored in px at the 1200px reference width is emitted   */
/* as `max(<floor>px, <px/12>cqw)` so text shrinks proportionally at    */
/* every width with a legibility floor and zero JS (the grid-scaling    */
/* decision). An EXPLICIT tablet/mobile override in the layer's style   */
/* bag beats the derived value — merchants who hand-tune get exactly    */
/* what they set.                                                       */
/*                                                                     */
/* Media-query strategy mirrors the style engine: base rule + @media    */
/* (max-width:1024px) / (max-width:767px) blocks containing only the    */
/* declarations that changed. Per-device layer visibility uses          */
/* INDEPENDENT windows (tablet = 768–1024px, mobile = ≤767px) so hiding  */
/* on tablet never leaks into mobile.                                   */
/*                                                                     */
/* Brand-token DEFAULTS (§2.1): text/button/icon layers default to the  */
/* --ff-* vars in SLIDER_BASE_CSS below, so a layered slide re-skins    */
/* itself on theme/brand changes. Layer style bags override through     */
/* buildLayerStyleCss — the slider-scoped subset serializer 5B's        */
/* buildLayerCssPath should DELEGATE to (one implementation of the cqw  */
/* math, never two).                                                    */
/*                                                                     */
/* Isomorphic, framework-free string work. Never throws.                */
/* ------------------------------------------------------------------ */

import {
  resolveTokenRef,
  unitNumberToCss,
  dimensionDecls,
  hasStyle,
  type AdvancedBag,
  type StyleBag,
} from "./style-engine"
import { resolveResponsive, isResponsiveValue, type Device } from "../schema/types"
import type {
  LayerFrame,
  LayeredSlide,
  LayeredSliderSettings,
  SlideBackground,
  SliderLayer,
} from "../slider/model"
import { DEFAULT_SLIDER_HEIGHT } from "../slider/defaults"

type Decl = [string, string]

/* --------------------------- tiny helpers --------------------------- */

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

/** Attribute/selector-safe key (same character class as the style engine). */
export function sanitizeSliderKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
}

/** A CSS value that must never break out of its rule (colors, gradients). */
function cssValue(v: unknown): string {
  return String(v ?? "").replace(/[<>{}]/g, "").replace(/;/g, "").trim()
}

/** aspect-ratio value: digits, dot, slash, spaces only. */
function cssAspect(v: unknown): string {
  const s = String(v ?? "").trim()
  return /^[0-9]+(\.[0-9]+)?\s*\/\s*[0-9]+(\.[0-9]+)?$/.test(s) || /^[0-9.]+$/.test(s)
    ? s
    : ""
}

/**
 * A URL destined for `url("…")` inside a <style> element. Refuses the
 * script-bearing schemes (same probe as container-html's escapeUrl) and
 * escapes everything that could terminate the string / the style element.
 */
export function cssUrl(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  const probe = s
    .replace(/&#(\d+);?/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[\u0000-\u0020]/g, "")
    .toLowerCase()
  if (/^(javascript|vbscript|data):/.test(probe)) return ""
  return s
    .replace(/\\/g, "%5C")
    .replace(/"/g, "%22")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/[\r\n]/g, "")
}

function declsToBody(decls: Decl[]): string {
  return decls.map(([p, v]) => `${p}:${v}`).join(";")
}

function diffDecls(current: Decl[], reference: Decl[]): Decl[] {
  const ref = new Map(reference.map(([p, v]) => [p, v]))
  return current.filter(([p, v]) => ref.get(p) !== v)
}

/* ----------------------- the grid-scaling math ----------------------- */

/** The design reference width merchants author px values against. */
export const SLIDER_REFERENCE_WIDTH = 1200

/**
 * px at the 1200px reference → `max(<floor>px, <px/12>cqw)`.
 * 40px → max(15px, 3.333cqw). Floor = max(12, round(px * 0.375)) — the
 * legibility clamp (a 40px headline never drops under 15px; nothing ever
 * drops under 12px). Non-finite / non-positive inputs yield undefined.
 */
export function scaledPxToCss(px: number): string | undefined {
  if (!Number.isFinite(px) || px <= 0) return undefined
  const cqw = Math.round((px / (SLIDER_REFERENCE_WIDTH / 100)) * 1000) / 1000
  const floor = Math.max(12, Math.round(px * 0.375))
  return `max(${floor}px,${cqw}cqw)`
}

/**
 * A unitNumber-ish font/icon size → CSS. px values (bare numbers, numeric
 * strings, { value, unit:"px" }) go through the cqw scaler; any other unit
 * passes through unchanged (the merchant said rem/em/%, believe them).
 */
export function scaledSizeToCss(v: unknown): string | undefined {
  const rec = asRecord(v)
  const value = rec ? rec.value : v
  const unit = rec ? rec.unit : undefined
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim())
  const isPx = unit == null || unit === "" || unit === "px"
  if (Number.isFinite(n) && isPx) {
    return scaledPxToCss(n)
  }
  return unitNumberToCss(v, "px")
}

/* ------------------------------ frames ------------------------------ */

/**
 * Anchor + percent offsets → position declarations. Offsets are measured
 * from the anchor toward the slide interior; centered axes fold the
 * offset into the 50% base (both are % of the same box, so no calc()),
 * and a `translate` re-centers the layer's own box on centered axes.
 */
export function frameDecls(frame: LayerFrame | undefined): Decl[] {
  if (!frame || typeof frame !== "object") return []
  const out: Decl[] = []
  const a = typeof frame.anchor === "string" ? frame.anchor : "tl"
  const v = a[0] === "c" ? "c" : a[0] === "b" ? "b" : "t"
  const h = a[1] === "c" ? "c" : a[1] === "r" ? "r" : "l"
  const x = Number.isFinite(frame.x) ? frame.x : 0
  const y = Number.isFinite(frame.y) ? frame.y : 0

  if (h === "l") out.push(["left", `${x}%`])
  else if (h === "r") out.push(["right", `${x}%`])
  else out.push(["left", `${50 + x}%`])

  if (v === "t") out.push(["top", `${y}%`])
  else if (v === "b") out.push(["bottom", `${y}%`])
  else out.push(["top", `${50 + y}%`])

  if (h === "c" || v === "c") {
    out.push(["translate", `${h === "c" ? "-50%" : "0"} ${v === "c" ? "-50%" : "0"}`])
  }

  if (typeof frame.w === "number" && Number.isFinite(frame.w)) {
    out.push(["width", `${frame.w}%`])
  }
  if (typeof frame.h === "number" && Number.isFinite(frame.h)) {
    out.push(["height", `${frame.h}%`])
  }
  return out
}

/* ----------------------- layer style bag subset ----------------------- */

/**
 * Typography declarations with the slider's font scaling: base font-size
 * px → max(floor, cqw); everything else mirrors the style engine's
 * vocabulary. `scaleFont=false` emits the merchant's exact value (used
 * for explicit tablet/mobile overrides, which beat the derived scale).
 */
function typographyDecls(v: unknown, scaleFont: boolean): Decl[] {
  const rec = asRecord(v)
  if (!rec) return []
  const out: Decl[] = []
  const fs = scaleFont ? scaledSizeToCss(rec.fontSize) : unitNumberToCss(rec.fontSize, "px")
  if (fs) out.push(["font-size", fs])
  if (rec.lineHeight != null && rec.lineHeight !== "") {
    out.push(["line-height", cssValue(rec.lineHeight)])
  }
  const ls = unitNumberToCss(rec.letterSpacing, "px")
  if (ls) out.push(["letter-spacing", ls])
  if (rec.fontWeight != null && rec.fontWeight !== "") {
    out.push(["font-weight", cssValue(rec.fontWeight)])
  }
  const ff = resolveTokenRef(rec.fontFamily, "font")
  if (ff) out.push(["font-family", cssValue(ff)])
  if (typeof rec.textTransform === "string" && rec.textTransform.trim()) {
    out.push(["text-transform", cssValue(rec.textTransform)])
  }
  return out
}

/** background / border / radius / shadow — the style-engine vocabulary. */
function boxDecls(s: Record<string, unknown>): Decl[] {
  const out: Decl[] = []
  const bg = asRecord(s.background)
  if (bg) {
    const color = resolveTokenRef(bg.color, "color")
    if (color) out.push(["background-color", cssValue(color)])
    const gradient = typeof bg.gradient === "string" && bg.gradient.trim() ? cssValue(bg.gradient) : ""
    const image = typeof bg.image === "string" && bg.image.trim() ? cssUrl(bg.image) : ""
    if (gradient || image) {
      const layers: string[] = []
      if (gradient) layers.push(gradient)
      if (image) layers.push(`url("${image}")`)
      out.push(["background-image", layers.join(", ")])
    }
    if (image) {
      out.push(["background-size", cssValue(bg.size) || "cover"])
      out.push(["background-position", cssValue(bg.position) || "center"])
      out.push(["background-repeat", cssValue(bg.repeat) || "no-repeat"])
    }
  }
  const border = asRecord(s.border)
  if (border) {
    const width = unitNumberToCss(border.width, "px")
    if (width) out.push(["border-width", width])
    const style = typeof border.style === "string" && border.style.trim() ? cssValue(border.style) : ""
    const color = resolveTokenRef(border.color, "color")
    if (style) out.push(["border-style", style])
    else if (width || color) out.push(["border-style", "solid"])
    if (color) out.push(["border-color", cssValue(color)])
  }
  const radius = asRecord(s.borderRadius)
  if (radius) {
    const sides = (["top", "right", "bottom", "left"] as const).map((k) =>
      unitNumberToCss(radius[k], typeof radius.unit === "string" ? radius.unit : "px")
    )
    if (sides.some((x) => x !== undefined)) {
      out.push(["border-radius", sides.map((x) => x ?? "0").join(" ")])
    }
  }
  const shadow = asRecord(s.boxShadow)
  if (shadow) {
    const hasAny = ["x", "y", "blur", "spread", "color"].some(
      (k) => shadow[k] != null && shadow[k] !== ""
    )
    if (hasAny) {
      const part = (k: string) => unitNumberToCss(shadow[k] ?? 0, "px") ?? "0px"
      const color = resolveTokenRef(shadow.color, "color") ?? ""
      out.push([
        "box-shadow",
        [shadow.inset === true ? "inset" : "", part("x"), part("y"), part("blur"), part("spread"), cssValue(color)]
          .filter(Boolean)
          .join(" "),
      ])
    }
  }
  return out
}

/** Whether a responsive leaf carries its OWN override for a device. */
function hasOwn(v: unknown, device: "tablet" | "mobile"): boolean {
  return isResponsiveValue(v) && (v as Record<string, unknown>)[device] !== undefined
}

/**
 * All style-bag declarations for one device. Font scaling applies to the
 * device's typography ONLY while it is derived (no explicit override at
 * or below that device) — an explicit per-device value is emitted as-is.
 */
function layerStyleDecls(
  style: StyleBag | undefined,
  advanced: AdvancedBag | undefined,
  device: Device
): Decl[] {
  const s = asRecord(style) ?? {}
  const a = asRecord(advanced) ?? {}
  const out: Decl[] = []

  out.push(...dimensionDecls("padding", resolveResponsive(s.padding as never, device)))

  const explicitTypo =
    device === "tablet"
      ? hasOwn(s.typography, "tablet")
      : device === "mobile"
        ? hasOwn(s.typography, "mobile") || hasOwn(s.typography, "tablet")
        : false
  out.push(
    ...typographyDecls(resolveResponsive(s.typography as never, device), !explicitTypo)
  )

  if (typeof s.align === "string" && s.align.trim()) {
    out.push(["text-align", cssValue(s.align)])
  }
  const color = resolveTokenRef(s.color, "color")
  if (color) out.push(["color", cssValue(color)])

  out.push(...boxDecls(s))

  if (a.opacity != null && a.opacity !== "" && Number.isFinite(Number(a.opacity))) {
    out.push(["opacity", String(Number(a.opacity))])
  }
  // The escape hatch the model documents: not part of the layer model, but
  // honoured when authored (array order stays the normal z mechanism).
  if (a.zIndex != null && a.zIndex !== "" && Number.isFinite(Number(a.zIndex))) {
    out.push(["z-index", String(Number(a.zIndex))])
  }
  return out
}

/**
 * The per-layer style-bag serializer (frame excluded — see buildSliderCss).
 * Selector-agnostic so 5B's buildLayerCssPath can delegate here with its
 * own editor-side selector. Returns "" for bag-less layers.
 */
export function buildLayerStyleCss(
  sel: string,
  style?: StyleBag | null,
  advanced?: AdvancedBag | null
): string {
  if (!hasStyle(style, advanced)) return ""
  const base = layerStyleDecls(style ?? undefined, advanced ?? undefined, "desktop")
  const tablet = layerStyleDecls(style ?? undefined, advanced ?? undefined, "tablet")
  const mobile = layerStyleDecls(style ?? undefined, advanced ?? undefined, "mobile")
  let css = ""
  if (base.length) css += `${sel}{${declsToBody(base)}}`
  const tabletDiff = diffDecls(tablet, base)
  if (tabletDiff.length) css += `@media (max-width:1024px){${sel}{${declsToBody(tabletDiff)}}}`
  const mobileDiff = diffDecls(mobile, tablet)
  if (mobileDiff.length) css += `@media (max-width:767px){${sel}{${declsToBody(mobileDiff)}}}`
  return css
}

/* --------------------------- static base ---------------------------- */

/**
 * Structural + brand-token-default CSS, identical for every slider (safe
 * to emit once per slider instance — duplicate rules are no-ops). Layer
 * type defaults are authored against the --ff-* brand vars (§2.1) so a
 * layered slide follows the merchant's theme with an EMPTY style bag.
 */
export const SLIDER_BASE_CSS =
  ".ffs{position:relative;overflow:hidden;width:100%;display:block}" +
  ".ffs-slide{container-type:size;position:absolute;inset:0;overflow:hidden;" +
  "opacity:0;pointer-events:none;transition:opacity .6s ease;z-index:0}" +
  ".ffs-slide.ffs-active{opacity:1;pointer-events:auto;z-index:1}" +
  '.ffs[data-ffs-transition="slide"] .ffs-slide{opacity:1;transition:transform .55s ease;transform:translateX(103%)}' +
  '.ffs[data-ffs-transition="slide"] .ffs-slide.ffs-active{transform:none}' +
  '.ffs[data-ffs-transition="slide"] .ffs-slide.ffs-before{transform:translateX(-103%)}' +
  ".ffs-bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat}" +
  "video.ffs-bg{width:100%;height:100%;object-fit:cover}" +
  ".ffs-overlay{position:absolute;inset:0;pointer-events:none}" +
  ".ffs-slide-link{position:absolute;inset:0;display:block;z-index:0}" +
  ".ffs-layer{position:absolute;margin:0;box-sizing:border-box;min-width:0;z-index:1}" +
  ".ffs-l-text{color:var(--ff-heading);font-family:var(--ff-font-heading);line-height:1.15}" +
  "p.ffs-l-text{color:var(--ff-text);font-family:var(--ff-font-body);line-height:1.5}" +
  "img.ffs-l-image,.ffs-l-image img{width:100%;height:100%;object-fit:cover;display:block}" +
  ".ffs-l-button{display:inline-flex;align-items:center;justify-content:center;" +
  "padding:0.9em 2.2em;background:var(--ff-primary);color:#fff;" +
  "font-family:var(--ff-font-body);font-size:max(12px,1.167cqw);font-weight:600;" +
  "letter-spacing:1px;text-transform:uppercase;text-decoration:none;white-space:nowrap;" +
  "border:1px solid var(--ff-primary);cursor:pointer}" +
  ".ffs-l-button.ffs-btn-outline{background:transparent;color:var(--ff-heading);border-color:currentColor}" +
  ".ffs-l-icon{color:var(--ff-heading);display:inline-flex;align-items:center;justify-content:center}" +
  ".ffs-arrow{position:absolute;top:50%;translate:0 -50%;z-index:3;width:44px;height:44px;" +
  "display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28);color:#fff;" +
  "border:0;border-radius:50%;font-size:22px;line-height:1;cursor:pointer}" +
  ".ffs-prev{left:14px}.ffs-next{right:14px}" +
  ".ffs-dots{position:absolute;left:50%;bottom:14px;translate:-50% 0;z-index:3;display:flex;gap:8px}" +
  ".ffs-dot{width:9px;height:9px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.5);cursor:pointer}" +
  ".ffs-dot.ffs-active{background:#fff}" +
  "@media (prefers-reduced-motion:reduce){.ffs-slide{transition:none}}"

/* ----------------------- entrance presets (5C) ----------------------- */

/**
 * ADDITIVE BLOCK — Phase 5C (ARCH-SLIDER §4). Entrance preset CSS for the
 * per-layer entrance attrs 5A's renderer already emits
 * (data-ffs-anim / data-ffs-delay / data-ffs-dur / data-ffs-ease).
 *
 * The ffs-js DISCIPLINE (5A-NOTES §3): hiding is gated on the runtime's
 * `ffs-js` root class — a page whose JS never ran NEVER hides content.
 * The runtime (public/ffslider.js) stamps `ffs-in` on a layer after its
 * data-ffs-delay on slide activation (cleared on slide leave); this CSS
 * only defines the from/to states and the transition.
 *
 * Property split, deliberate: layer frames use the `translate` property
 * (frameDecls' centering), entrances use `transform` (slide-*) and the
 * independent `scale` property (zoom-*) — the three never collide.
 * Per-layer duration overrides (`duration_ms` ≠ 600) are emitted by
 * buildSliderCss as [data-layer] rules; ease rides the attribute
 * selectors below. Reduced-motion users get content instantly.
 */
export const SLIDER_ENTRANCE_CSS =
  ".ffs.ffs-js [data-ffs-anim]{opacity:0;" +
  "transition-property:opacity,transform,scale;transition-duration:.6s;" +
  "transition-timing-function:ease-out}" +
  '.ffs.ffs-js [data-ffs-anim="slide-up"]{transform:translateY(28px)}' +
  '.ffs.ffs-js [data-ffs-anim="slide-down"]{transform:translateY(-28px)}' +
  '.ffs.ffs-js [data-ffs-anim="slide-left"]{transform:translateX(28px)}' +
  '.ffs.ffs-js [data-ffs-anim="slide-right"]{transform:translateX(-28px)}' +
  '.ffs.ffs-js [data-ffs-anim="zoom-in"]{scale:.88}' +
  '.ffs.ffs-js [data-ffs-anim="zoom-out"]{scale:1.12}' +
  '.ffs.ffs-js [data-ffs-ease="ease-in-out"]{transition-timing-function:ease-in-out}' +
  '.ffs.ffs-js [data-ffs-ease="spring"]{transition-timing-function:cubic-bezier(.34,1.56,.64,1)}' +
  ".ffs.ffs-js [data-ffs-anim].ffs-in{opacity:1;transform:none;scale:1}" +
  "@media (prefers-reduced-motion:reduce){" +
  ".ffs.ffs-js [data-ffs-anim]{opacity:1;transform:none;scale:1;transition:none}}"

/* --------------------------- per-slider CSS --------------------------- */

function heightDecls(h: { aspect?: unknown; minPx?: unknown } | undefined): Decl[] {
  const out: Decl[] = []
  const aspect = cssAspect(h?.aspect)
  if (aspect) out.push(["aspect-ratio", aspect])
  const minPx = Number(h?.minPx)
  if (Number.isFinite(minPx) && minPx > 0) out.push(["min-height", `${minPx}px`])
  return out
}

function backgroundCss(sel: string, bg: SlideBackground | undefined): string {
  if (!bg || typeof bg !== "object") return ""
  let css = ""
  const bgDecls: Decl[] = []
  const color = resolveTokenRef(bg.color, "color")
  if (color) bgDecls.push(["background-color", cssValue(color)])
  /* The background MODE decides what paints. Picking "Color" used to leave
     the stored photo painting over the colour (the image is kept on purpose,
     so switching back to Image restores it) — the colour was set and
     invisible. An ABSENT type stays legacy: image-if-present, so every slide
     authored before the mode existed renders byte-identically. */
  const image =
    bg.type !== "video" && bg.type !== "color" && typeof bg.image === "string"
      ? cssUrl(bg.image)
      : ""
  if (image) {
    bgDecls.push(["background-image", `url("${image}")`])
    bgDecls.push(["background-size", bg.fit === "contain" ? "contain" : "cover"])
    const fx = Number(bg.focal?.x)
    const fy = Number(bg.focal?.y)
    if (Number.isFinite(fx) && Number.isFinite(fy)) {
      bgDecls.push(["background-position", `${fx}% ${fy}%`])
    }
  }
  if (bgDecls.length) css += `${sel}>.ffs-bg{${declsToBody(bgDecls)}}`

  const ov = bg.overlay
  if (ov && typeof ov === "object") {
    const ovDecls: Decl[] = []
    const gradient =
      typeof (ov as { gradient?: unknown }).gradient === "string" &&
      String((ov as { gradient?: unknown }).gradient).trim()
        ? cssValue((ov as { gradient?: unknown }).gradient)
        : ""
    if (gradient) {
      ovDecls.push(["background-image", gradient])
    } else {
      const c = resolveTokenRef((ov as { color?: unknown }).color, "color")
      if (c) ovDecls.push(["background-color", cssValue(c)])
      const o = Number((ov as { opacity?: unknown }).opacity)
      if (Number.isFinite(o)) ovDecls.push(["opacity", String(Math.min(Math.max(o, 0), 1))])
    }
    if (ovDecls.length) css += `${sel}>.ffs-overlay{${declsToBody(ovDecls)}}`
  }
  return css
}

/** Per-device frame + visibility rules for one layer. */
function layerFrameCss(sel: string, layer: SliderLayer): string {
  const frame = layer.frame
  const base = frameDecls(resolveResponsive(frame as never, "desktop") as LayerFrame)
  const tablet = frameDecls(resolveResponsive(frame as never, "tablet") as LayerFrame)
  const mobile = frameDecls(resolveResponsive(frame as never, "mobile") as LayerFrame)
  let css = ""
  if (base.length) css += `${sel}{${declsToBody(base)}}`
  const tabletDiff = diffDecls(tablet, base)
  if (tabletDiff.length) css += `@media (max-width:1024px){${sel}{${declsToBody(tabletDiff)}}}`
  const mobileDiff = diffDecls(mobile, tablet)
  if (mobileDiff.length) css += `@media (max-width:767px){${sel}{${declsToBody(mobileDiff)}}}`
  // Independent per-device hide windows (never cascade into each other).
  if (layer.hidden?.tablet === true) {
    css += `@media (min-width:768px) and (max-width:1024px){${sel}{display:none}}`
  }
  if (layer.hidden?.mobile === true) {
    css += `@media (max-width:767px){${sel}{display:none}}`
  }
  return css
}

/**
 * The whole per-slider stylesheet: root sizing, slide backgrounds +
 * overlays, layer frames + style bags. `rootKey` scopes every selector
 * ([data-ffs="<key>"]) so two sliders on one page can never cross-style;
 * slide/layer ids further key each rule.
 *
 * `slides` must already be fully layered (the HTML renderer upgrades
 * fields slides before calling here).
 */
export function buildSliderCss(
  rootKey: string,
  settings: LayeredSliderSettings,
  slides: LayeredSlide[]
): string {
  const key = sanitizeSliderKey(rootKey) || "x"
  const root = `.ffs[data-ffs="${key}"]`
  let css = ""

  // Root sizing: the responsive height cascade with the platform default.
  const height = settings.height ?? DEFAULT_SLIDER_HEIGHT
  const baseH = heightDecls(resolveResponsive(height as never, "desktop"))
  const tabletH = heightDecls(resolveResponsive(height as never, "tablet"))
  const mobileH = heightDecls(resolveResponsive(height as never, "mobile"))
  if (baseH.length) css += `${root}{${declsToBody(baseH)}}`
  const tabletHDiff = diffDecls(tabletH, baseH)
  if (tabletHDiff.length) css += `@media (max-width:1024px){${root}{${declsToBody(tabletHDiff)}}}`
  const mobileHDiff = diffDecls(mobileH, tabletH)
  if (mobileHDiff.length) css += `@media (max-width:767px){${root}{${declsToBody(mobileHDiff)}}}`

  for (const slide of slides) {
    const sid = sanitizeSliderKey(slide.id)
    if (!sid) continue
    const slideSel = `${root} [data-slide="${sid}"]`
    css += backgroundCss(slideSel, slide.background)
    for (const layer of slide.layers ?? []) {
      const lid = sanitizeSliderKey(layer?.id)
      if (!lid) continue
      const sel = `${root} [data-layer="${lid}"]`
      css += layerFrameCss(sel, layer)
      css += buildLayerStyleCss(sel, layer.style, layer.advanced)
      // 5C entrance: a non-default duration_ms becomes a per-layer
      // transition-duration override (delay is stamped by the runtime;
      // ease rides the data-ffs-ease attribute selectors in
      // SLIDER_ENTRANCE_CSS). Gated on .ffs-js like every entrance rule.
      const anim = layer.anim
      if (anim && typeof anim === "object" && anim.preset && anim.preset !== "none") {
        const dur = Number(anim.duration_ms)
        if (Number.isFinite(dur) && dur > 0 && dur !== 600) {
          const clamped = Math.min(Math.max(Math.round(dur), 50), 5000)
          css += `${root}.ffs-js [data-layer="${lid}"]{transition-duration:${clamped}ms}`
        }
      }
    }
  }
  return css
}
