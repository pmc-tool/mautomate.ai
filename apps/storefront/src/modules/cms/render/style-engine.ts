/* ------------------------------------------------------------------ */
/* CMS Style Engine — serialize a section's style/advanced bags to CSS  */
/*                                                                     */
/* Phase 2 render layer. Turns the universal `block.style` and           */
/* `block.advanced` bags (authored by the UNIVERSAL_STYLE /              */
/* UNIVERSAL_ADVANCED schemas) into a scoped CSS string targeting        */
/* `.cms-sec-<id>`. The SAME function feeds both the editor iframe        */
/* (app/editor-canvas) and production (section-renderer) so the two       */
/* paths can never drift.                                                 */
/*                                                                       */
/* Storage is DIFF-ONLY: bags carry only keys the user set, and           */
/* responsive leaves are `ResponsiveValue<T>` ({ base, tablet?, mobile? }).*/
/* We resolve every field per device, emit the desktop value as the base   */
/* rule, then emit `@media (max-width:1024px)` (tablet) and                 */
/* `@media (max-width:767px)` (mobile) blocks containing ONLY the           */
/* declarations that actually change at that breakpoint (small output).     */
/*                                                                        */
/* Defensive by contract: every value may be missing or partial. Nothing   */
/* here throws — unknown / malformed values are simply skipped, and         */
/* `buildSectionCss` returns "" whenever `hasStyle` is false so an          */
/* un-styled section stays byte-identical to today (display:contents).      */
/* ------------------------------------------------------------------ */

import type { Device } from "../schema/types"
// 3C (ARCH-CANVAS P7): isHiddenOnDevice is the DUAL-SHAPE visibility read —
// it accepts the legacy `hideOn<Device>` trio AND the spec `advanced.hide`
// bag ({desktop?,tablet?,mobile?}) for one release, so published pages keep
// rendering while edit-time normalization migrates bags to the new shape.
import { isHiddenOnDevice, resolveResponsive } from "../schema/types"

/** The namespaced style bag (`block.style`). Keys are diff-only. */
export type StyleBag = Record<string, unknown>
/** The namespaced advanced bag (`block.advanced`). Keys are diff-only. */
export type AdvancedBag = Record<string, unknown>

/**
 * Per-element override bag (`section.elementStyles`). Keyed by the element's
 * `data-el` key (see ELEMENT_REGISTRY), each entry carries its own diff-only
 * `style` / `advanced` bags — the SAME shape and serialization as a section's
 * `block.style` / `block.advanced`, just scoped to a descendant selector.
 */
export type ElementStyleEntry = { style?: StyleBag; advanced?: AdvancedBag }
/** The full per-element override map (`section.elementStyles`). Diff-only. */
export type ElementStyles = Record<string, ElementStyleEntry>

/** A single CSS declaration as a `[property, value]` pair. */
type Decl = [string, string]

/**
 * 3C (ARCH-CANVAS P7): serialization options accepted by every public
 * builder. `hide` (default true) controls whether the per-device visibility
 * rules (`display:none` inside the matching media query) are emitted.
 * Production callers never pass this — published output is byte-identical.
 * The EDITOR canvas passes `{ hide: false }` so device-hidden nodes stay in
 * the layout to be ghosted (40% opacity + an eye-off badge) instead of
 * disappearing, per Elementor's pattern — hidden things must stay findable.
 */
export type StyleEngineOpts = { hide?: boolean }

/* ------------------------------------------------------------------ */
/* Small, defensive value helpers                                       */
/* ------------------------------------------------------------------ */

/** Narrow an unknown to a plain object (not array), else undefined. */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

/** A raw numeric string like "12", "-3.5" (no unit / keyword). */
function isNumericString(s: string): boolean {
  return /^-?\d*\.?\d+$/.test(s.trim())
}

/**
 * Reduce a bag to an allowed key set (3D — restricted node contracts).
 * Returns undefined for a missing bag so `hasStyle` semantics are unchanged.
 * Used by the CHROME filters below; buildColumnCss (2E) keeps its own inline
 * copy of this logic — shipped and byte-verified, deliberately undisturbed.
 */
function filterBagKeys(
  bag: Record<string, unknown> | undefined,
  allowed: ReadonlySet<string>
): Record<string, unknown> | undefined {
  if (!bag) {
    return undefined
  }
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(bag)) {
    if (allowed.has(k)) {
      out[k] = bag[k]
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Global theme-token refs (Phase 5 — link-to-global-token)             */
/* ------------------------------------------------------------------ */

/** Valid colour token ids. Map to the `--ff-<id>` brand CSS vars. */
const COLOR_TOKEN_REFS = new Set([
  "primary",
  "heading",
  "text",
  "dark",
  "border",
  "bg",
])
/** Valid font token ids. Map to the `--ff-font-<id>` brand CSS vars. */
const FONT_TOKEN_REFS = new Set(["body", "heading"])
/**
 * Owner-defined custom tokens (F2a) use refs of the form `c-<slug>` where the
 * slug is derived from the token name (lowercase, non-alphanumerics → "-").
 * They map to the prefixed vars `--ff-c-<slug>` / `--ff-font-c-<slug>`, so
 * they can never collide with the built-in refs above.
 */
const CUSTOM_TOKEN_REF = /^c-[a-z0-9][a-z0-9-]*$/

/**
 * Resolve a colour / font value that may be LINKED to a global theme token.
 *
 * A linked value is the object `{ ref: string }` where `ref` is a token id
 * ("primary", "body", …). It resolves to the corresponding brand CSS var:
 *   color ref → `var(--ff-<ref>)`   (e.g. { ref:"primary" } → var(--ff-primary))
 *   font  ref → `var(--ff-font-<ref>)` (e.g. { ref:"body" } → var(--ff-font-body))
 *
 * A plain string value passes through unchanged (raw hex / font stack), so any
 * bag authored before Phase 5 stays byte-identical. Defensive by contract:
 * an unknown / missing / non-string ref yields undefined so the caller skips
 * that property entirely.
 */
export function resolveTokenRef(
  value: unknown,
  kind: "color" | "font"
): string | undefined {
  const rec = asRecord(value)
  if (rec) {
    if (typeof rec.ref !== "string") {
      return undefined
    }
    const ref = rec.ref.trim()
    if (!ref) {
      return undefined
    }
    if (kind === "color") {
      return COLOR_TOKEN_REFS.has(ref) || CUSTOM_TOKEN_REF.test(ref)
        ? `var(--ff-${ref})`
        : undefined
    }
    return FONT_TOKEN_REFS.has(ref) || CUSTOM_TOKEN_REF.test(ref)
      ? `var(--ff-font-${ref})`
      : undefined
  }
  if (typeof value === "string") {
    const s = value.trim()
    return s || undefined
  }
  return undefined
}

/**
 * Serialize a length-ish value to CSS. A bare number (or numeric string) gets
 * `unit` appended (default "px"); a keyword / already-united string passes
 * through unchanged. Missing / non-finite values yield undefined (skipped).
 */
function toLength(v: unknown, unit?: unknown): string | undefined {
  const u = typeof unit === "string" && unit ? unit : "px"
  if (v == null) {
    return undefined
  }
  if (typeof v === "number") {
    return Number.isFinite(v) ? `${v}${u}` : undefined
  }
  if (typeof v === "string") {
    const s = v.trim()
    if (!s) {
      return undefined
    }
    return isNumericString(s) ? `${s}${u}` : s
  }
  return undefined
}

/**
 * Serialize a `unitNumber` value: either a plain number/string or a
 * `{ value, unit }` object. Falls back to `defUnit` when no unit is present.
 */
export function unitNumberToCss(v: unknown, defUnit = "px"): string | undefined {
  const rec = asRecord(v)
  if (rec) {
    return toLength(rec.value, rec.unit ?? defUnit)
  }
  return toLength(v, defUnit)
}

/** Is a value "meaningful" (a real, non-empty setting)? Recurses. */
function isMeaningful(v: unknown): boolean {
  if (v == null) {
    return false
  }
  if (typeof v === "string") {
    return v.trim() !== ""
  }
  if (typeof v === "boolean") {
    return v === true
  }
  if (typeof v === "number") {
    return Number.isFinite(v)
  }
  if (Array.isArray(v)) {
    return v.some(isMeaningful)
  }
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>).some(isMeaningful)
  }
  return false
}

/** Does a bag hold at least one meaningful value? */
function bagHasValue(bag: unknown): boolean {
  const rec = asRecord(bag)
  return rec ? Object.values(rec).some(isMeaningful) : false
}

/** Make an id safe to embed in a class selector (`.cms-sec-<id>`). */
function sanitizeId(id: string | number): string {
  const clean = String(id ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
  return clean || "x"
}

/**
 * Make an element key safe to embed in an attribute selector
 * (`[data-el="<key>"]`). Element keys come from the ELEMENT_REGISTRY and are
 * always simple identifiers, but we defensively strip anything that could
 * break out of the attribute selector (quotes, brackets, whitespace). Returns
 * "" for an unusable key so the caller can skip it entirely.
 */
function sanitizeElementKey(key: unknown): string {
  return String(key ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
}

/* ------------------------------------------------------------------ */
/* Field → CSS declaration mappers (one per composite control)          */
/* ------------------------------------------------------------------ */

const DIMENSION_SIDES = ["top", "right", "bottom", "left"] as const

/**
 * A `dimensions` box value → per-side longhand declarations (e.g.
 * `padding-top`). `{ top, right, bottom, left, unit }`; missing sides skipped.
 */
export function dimensionDecls(prop: string, v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const out: Decl[] = []
  for (const side of DIMENSION_SIDES) {
    const cv = toLength(rec[side], rec.unit)
    if (cv !== undefined) {
      out.push([`${prop}-${side}`, cv])
    }
  }
  return out
}

/**
 * A `dimensions` value used as a corner radius → a single `border-radius`
 * shorthand (top/right/bottom/left map to the four corners; unset → 0).
 */
function borderRadiusDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const sides = DIMENSION_SIDES.map((s) => toLength(rec[s], rec.unit))
  if (sides.every((s) => s === undefined)) {
    return []
  }
  return [["border-radius", sides.map((s) => s ?? "0").join(" ")]]
}

/** A `background` value → colour / gradient / image declarations. */
function backgroundDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const out: Decl[] = []
  const bgColor = resolveTokenRef(rec.color, "color")
  if (bgColor) {
    out.push(["background-color", bgColor])
  }
  // Gradient and image LAYER (gradient first, so it reads as an overlay on the
  // photo) — the standard "darken a hero photo so text stays legible" pattern.
  // Either alone behaves exactly as before.
  const gradient =
    typeof rec.gradient === "string" && rec.gradient.trim() ? rec.gradient.trim() : ""
  const image =
    typeof rec.image === "string" && rec.image.trim() ? rec.image.trim() : ""
  if (gradient || image) {
    const layers: string[] = []
    if (gradient) layers.push(gradient)
    if (image) layers.push(`url(${image})`)
    out.push(["background-image", layers.join(", ")])
  }
  if (image) {
    out.push(["background-size", typeof rec.size === "string" && rec.size ? rec.size : "cover"])
    out.push([
      "background-position",
      typeof rec.position === "string" && rec.position ? rec.position : "center",
    ])
    out.push([
      "background-repeat",
      typeof rec.repeat === "string" && rec.repeat ? rec.repeat : "no-repeat",
    ])
  }
  return out
}

/** A `border` value → width / style / colour declarations. */
function borderDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const out: Decl[] = []
  const widthRec = asRecord(rec.width)
  const width = widthRec ? unitNumberToCss(widthRec) : toLength(rec.width, rec.unit)
  if (width) {
    out.push(["border-width", width])
  }
  const hasStyle = typeof rec.style === "string" && rec.style.trim()
  const borderColor = resolveTokenRef(rec.color, "color")
  if (hasStyle) {
    out.push(["border-style", (rec.style as string).trim()])
  } else if (width || borderColor) {
    // A width/colour with no explicit style still needs a style to render.
    out.push(["border-style", "solid"])
  }
  if (borderColor) {
    out.push(["border-color", borderColor])
  }
  return out
}

/** A `boxShadow` value → a single `box-shadow` declaration. */
function boxShadowDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const hasAny = ["x", "y", "blur", "spread", "color"].some(
    (k) => rec[k] != null && rec[k] !== ""
  )
  if (!hasAny) {
    return []
  }
  const x = toLength(rec.x ?? 0, "px") ?? "0px"
  const y = toLength(rec.y ?? 0, "px") ?? "0px"
  const blur = toLength(rec.blur ?? 0, "px") ?? "0px"
  const spread = toLength(rec.spread ?? 0, "px") ?? "0px"
  const color = resolveTokenRef(rec.color, "color") ?? ""
  const parts = [
    rec.inset === true ? "inset" : "",
    x,
    y,
    blur,
    spread,
    color,
  ].filter(Boolean)
  return [["box-shadow", parts.join(" ")]]
}

/** A `typographyGroup` value → font / text declarations. */
function typographyDecls(v: unknown): Decl[] {
  const rec = asRecord(v)
  if (!rec) {
    return []
  }
  const out: Decl[] = []
  const fs = unitNumberToCss(rec.fontSize, "px")
  if (fs) {
    out.push(["font-size", fs])
  }
  if (rec.lineHeight != null && rec.lineHeight !== "") {
    out.push(["line-height", String(rec.lineHeight)])
  }
  const ls = unitNumberToCss(rec.letterSpacing, "px")
  if (ls) {
    out.push(["letter-spacing", ls])
  }
  if (rec.fontWeight != null && rec.fontWeight !== "") {
    out.push(["font-weight", String(rec.fontWeight)])
  }
  const fontFamily = resolveTokenRef(rec.fontFamily, "font")
  if (fontFamily) {
    out.push(["font-family", fontFamily])
  }
  if (typeof rec.textTransform === "string" && rec.textTransform.trim()) {
    out.push(["text-transform", rec.textTransform.trim()])
  }
  return out
}

/** Map the `width` (content width) choose value to a `max-width`. */
const CONTENT_WIDTH: Record<string, string> = {
  narrow: "800px",
  normal: "1200px",
  wide: "1400px",
  full: "100%",
}

/**
 * Map the `hoverAnimation` (Motion) choose value to a CSS `transform`. Only
 * these keys animate; anything else (incl. "none") yields no hover rule. All
 * are pure CSS — no JS, no scroll listeners — so they carry zero hydration risk.
 */
const HOVER_TRANSFORMS: Record<string, string> = {
  grow: "scale(1.03)",
  shrink: "scale(0.97)",
  lift: "translateY(-6px)",
}

/* ------------------------------------------------------------------ */
/* Entrance-on-scroll (F3) — JS-assisted but no-JS-safe                 */
/* ------------------------------------------------------------------ */

/**
 * The valid `entranceAnimation` kinds (Motion group). "none" / unknown values
 * are NOT entrance animations — they yield no `data-anim` attribute and no
 * duration var, so absent data renders byte-identical to today.
 */
const ENTRANCE_KINDS = new Set(["fade", "slide-up", "zoom"])

/**
 * Read a section's entrance animation kind from its `advanced` bag. Returns the
 * kind ("fade" | "slide-up" | "zoom") when set to a valid value, else undefined.
 * The wrappers (editor-canvas SectionItem + section-renderer) use this to decide
 * whether to add `data-anim="<kind>"` — the hook the ENTRANCE_CSS rules and the
 * EntranceObserver client component key off. Never throws.
 */
export function entranceAnimationOf(
  advanced?: AdvancedBag | null
): string | undefined {
  const a = asRecord(advanced)
  const kind = a?.entranceAnimation
  return typeof kind === "string" && ENTRANCE_KINDS.has(kind) ? kind : undefined
}

/**
 * Static entrance-on-scroll CSS, emitted ONCE per page (alongside the section
 * CSS) whenever any section carries an entrance animation.
 *
 * SAFETY DESIGN — content must NEVER be hidden without JS:
 *  - Every hiding rule is gated on `html.ff-io`, a class only added by the
 *    EntranceObserver client component on mount. No JS → no `ff-io` → nothing
 *    is ever hidden (sections render exactly as today).
 *  - The whole block sits inside `@media (prefers-reduced-motion:
 *    no-preference)`, so users who prefer reduced motion never see the
 *    animation OR the initial hidden state.
 *  - Per-section duration comes from the `--ff-anim-d` var (emitted onto the
 *    wrapper by `buildSectionCss` from `entranceDuration`), defaulting to 600ms.
 */
export const ENTRANCE_CSS =
  "@media (prefers-reduced-motion: no-preference){" +
  "html.ff-io [data-anim]:not(.ff-in){opacity:0}" +
  'html.ff-io [data-anim="slide-up"]:not(.ff-in){transform:translateY(24px)}' +
  'html.ff-io [data-anim="zoom"]:not(.ff-in){transform:scale(.96)}' +
  "[data-anim].ff-in{opacity:1;transform:none;" +
  "transition:opacity var(--ff-anim-d,600ms) ease,transform var(--ff-anim-d,600ms) ease}" +
  "}"

/* ------------------------------------------------------------------ */
/* Per-device declaration assembly                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve every style/advanced field for one device and flatten to an ordered
 * list of CSS declarations. Non-responsive fields resolve identically for all
 * devices (so they never appear in a media diff). Never throws.
 */
function declsForDevice(
  style: StyleBag | undefined,
  advanced: AdvancedBag | undefined,
  device: Device
): Decl[] {
  const s = style ?? {}
  const a = advanced ?? {}
  const out: Decl[] = []

  /* --- Spacing --- */
  out.push(...dimensionDecls("padding", resolveResponsive(s.padding, device)))
  out.push(...dimensionDecls("margin", resolveResponsive(s.margin, device)))
  const gap = unitNumberToCss(resolveResponsive(s.gap, device))
  if (gap) {
    out.push(["gap", gap])
  }

  /* --- Size --- */
  if (typeof s.width === "string" && CONTENT_WIDTH[s.width]) {
    out.push(["max-width", CONTENT_WIDTH[s.width]])
  }
  // Defensive: honour explicit maxWidth / contentWidth keys if a caller sets them.
  const maxWidth = unitNumberToCss(resolveResponsive(s.maxWidth ?? s.contentWidth, device))
  if (maxWidth) {
    out.push(["max-width", maxWidth])
  }
  const minHeight = unitNumberToCss(resolveResponsive(s.minHeight, device))
  if (minHeight) {
    out.push(["min-height", minHeight])
  }

  /* --- Background --- */
  out.push(...backgroundDecls(s.background))

  /* --- Border --- */
  out.push(...borderDecls(s.border))
  out.push(...borderRadiusDecls(resolveResponsive(s.borderRadius, device)))
  out.push(...boxShadowDecls(s.boxShadow))

  /* --- Typography --- */
  out.push(...typographyDecls(resolveResponsive(s.typography, device)))
  if (typeof s.align === "string" && s.align.trim()) {
    out.push(["text-align", s.align.trim()])
  }
  const textColor = resolveTokenRef(s.color, "color")
  if (textColor) {
    out.push(["color", textColor])
  }

  /* --- Advanced: position / offsets / z-index / opacity --- */
  if (typeof a.position === "string" && a.position && a.position !== "default") {
    out.push(["position", a.position])
  }
  if (a.zIndex != null && a.zIndex !== "" && Number.isFinite(Number(a.zIndex))) {
    out.push(["z-index", String(Number(a.zIndex))])
  }
  const offsetX = unitNumberToCss(resolveResponsive(a.offsetX, device))
  if (offsetX) {
    out.push(["left", offsetX])
  }
  const offsetY = unitNumberToCss(resolveResponsive(a.offsetY, device))
  if (offsetY) {
    out.push(["top", offsetY])
  }
  if (a.opacity != null && a.opacity !== "" && Number.isFinite(Number(a.opacity))) {
    out.push(["opacity", String(Number(a.opacity))])
  }

  /* --- Motion (Phase 6, CSS-only): transition + sticky --------------- */
  // A `transition` is emitted when the user sets a duration OR asks for a
  // hover animation (so the hover transform has something to ease). It is
  // non-responsive, so the identical declaration is diffed out of the media
  // blocks and lives only on the base rule. The reduced-motion override in
  // `buildSectionCss` neutralises it for users who prefer no motion.
  const hasHover =
    typeof a.hoverAnimation === "string" &&
    HOVER_TRANSFORMS[a.hoverAnimation] !== undefined
  const durationCss = unitNumberToCss(a.transitionDuration, "ms")
  if (durationCss || hasHover) {
    out.push(["transition", `all ${durationCss ?? "300ms"}`])
  }

  // Entrance-on-scroll (F3): the animation itself lives in the static
  // ENTRANCE_CSS (gated on html.ff-io + data-anim, reduced-motion-guarded);
  // here we only surface the per-section duration as the `--ff-anim-d` CSS var
  // the shared transition reads (falls back to 600ms when unset). Emitted only
  // when a real entrance kind is chosen, so no var leaks otherwise.
  if (entranceAnimationOf(a)) {
    const animDuration = unitNumberToCss(a.entranceDuration, "ms")
    if (animDuration) {
      out.push(["--ff-anim-d", animDuration])
    }
  }

  // Sticky positioning. GUARD: `position:sticky` only wins when the user has
  // NOT already chosen an explicit Position (relative/absolute/fixed) — those
  // would conflict, so an explicit position takes precedence and sticky is
  // skipped. `top` uses the sticky offset (default 0px).
  const positionSet =
    typeof a.position === "string" && a.position !== "" && a.position !== "default"
  if (a.sticky === true && !positionSet) {
    out.push(["position", "sticky"])
    out.push(["top", unitNumberToCss(a.stickyOffset, "px") ?? "0px"])
  }

  return out
}

/** Serialize declarations to a compact rule body (`prop:value;prop:value`). */
function declsToBody(decls: Decl[]): string {
  return decls.map(([p, v]) => `${p}:${v}`).join(";")
}

/**
 * Keep only the declarations in `current` whose value differs from `reference`
 * (or that are absent from it) — the diff-only media payload.
 */
function diffDecls(current: Decl[], reference: Decl[]): Decl[] {
  const ref = new Map(reference.map(([p, v]) => [p, v]))
  return current.filter(([p, v]) => ref.get(p) !== v)
}

/** Scope raw custom CSS to `sel`, swapping the {{selector}} / selector token. */
function customCssScoped(raw: unknown, sel: string): string {
  if (typeof raw !== "string") {
    return ""
  }
  let cc = raw.trim()
  if (!cc) {
    return ""
  }
  // SECURITY: this string is injected verbatim into a <style> element, so it
  // must never be able to break out of it. Strip any closing </style> tag
  // (case-insensitive, whitespace-tolerant) first, then any remaining "<" that
  // could begin a new tag. CSS never legitimately needs a bare "<" character,
  // so removing them cannot corrupt a well-formed stylesheet.
  cc = cc.replace(/<\s*\/\s*style/gi, "").replace(/</g, "")
  // Support the doubled-brace token AND the bare `selector` keyword.
  cc = cc.replace(/\{\{\s*selector\s*\}\}/g, sel).replace(/\bselector\b/g, sel)
  // Bare declarations (no rule braces) → wrap them in the scoped selector.
  if (!cc.includes("{")) {
    cc = `${sel}{${cc}}`
  }
  return cc
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Does this section carry any real style? True when either the `style` or the
 * `advanced` bag holds at least one meaningful (non-empty) value, OR — when an
 * `elementStyles` map is passed — when ANY per-element entry has a non-empty
 * `style` / `advanced` bag. Used by the wrapper to decide between
 * `display:contents` (no style → byte-identical to today) and a real
 * `.cms-sec-<id>` box (has style) — the box is required for the descendant
 * `[data-el]` element selectors to apply.
 */
export function hasStyle(
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  elementStyles?: ElementStyles | null
): boolean {
  if (bagHasValue(style) || bagHasValue(advanced)) {
    return true
  }
  const rec = asRecord(elementStyles)
  if (rec) {
    for (const entry of Object.values(rec)) {
      const e = asRecord(entry)
      if (e && (bagHasValue(e.style) || bagHasValue(e.advanced))) {
        return true
      }
    }
  }
  return false
}

/**
 * Emit the full set of scoped rules for ONE selector from a `style` / `advanced`
 * pair: base (desktop) rule, diff-only tablet / mobile media blocks, per-device
 * visibility, motion (hover + reduced-motion guard) and scoped custom CSS. This
 * is the SINGLE source of per-property serialization — both the section
 * (`sel = .cms-sec-<id>`) and each element (`sel = .cms-sec-<id> [data-el=...]`)
 * feed through it, so section and element CSS can never drift. Never throws.
 */
/**
 * Inheritable text properties. Theme CSS often styles text nodes DIRECTLY
 * (e.g. Learts `.site-main-menu>ul>li>a{color:#7e7e7e}`), and a direct rule
 * always beats a value inherited from the styled container — so the user's
 * "Text color" / typography would silently not apply. For these props we ALSO
 * emit a specificity-boosted descendant rule reaching the real text carriers.
 */
const INHERITED_TEXT_PROPS = new Set([
  "color",
  "font-size",
  "line-height",
  "letter-spacing",
  "font-weight",
  "font-family",
  "text-transform",
  "text-align",
])

/**
 * The text-carrying descendants the boosted rule targets. `:where()` keeps the
 * list at zero specificity (the boost comes from doubling the scope class), and
 * `a:not([class*="btn"])` recolors nav/menu/body links while leaving styled
 * buttons (e.g. Learts `.btn` CTAs) alone.
 */
const TEXT_DESCENDANTS =
  ':where(p,li,span,h1,h2,h3,h4,h5,h6,blockquote,small,label,a:not([class*="btn"]))'

/**
 * Repeat the scope's leading class to outrank theme rules (`.x …` → `.x.x.x.x …`).
 *
 * It used to double the class, giving (0,3,0) for an element rule. That is NOT
 * enough: Learts styles its text through deep descendant chains — e.g.
 * `.learts-blockquote .inner .desc p` at (0,3,1) — which outranks it on the
 * element count. The result was silent and maddening: the merchant set a font
 * size, it was stored, the CSS was emitted, and the text did not move, because
 * the theme won the cascade by one element selector.
 *
 * Four repetitions put our rule at (0,5,0), which beats any realistic theme
 * chain, and ties still fall to us because this CSS is emitted after the theme's
 * stylesheets. Specificity, not !important — so a merchant's own custom CSS can
 * still override it, which is the whole point of having custom CSS.
 */
function boostSel(sel: string): string {
  return sel.replace(/^(\.[A-Za-z0-9_-]+)/, "$1$1$1$1")
}

/** The inherited-text subset of a declaration list. */
function textSubset(decls: Decl[]): Decl[] {
  return decls.filter(([p]) => INHERITED_TEXT_PROPS.has(p))
}

function buildScopedRules(
  sel: string,
  style: StyleBag | undefined,
  advanced: AdvancedBag | undefined,
  /**
   * 3C: emit the per-device `display:none` visibility rules (default true —
   * production always emits them). The EDITOR canvas passes false so hidden
   * nodes can be GHOSTED (dimmed + badged) instead of vanishing — a removed
   * node can't be found to un-hide (Elementor's behavior, ARCH-CANVAS P7).
   */
  emitHide = true
): string {
  const s = asRecord(style)
  const a = asRecord(advanced) ?? {}

  const baseDecls = declsForDevice(s, a, "desktop")
  const tabletDecls = declsForDevice(s, a, "tablet")
  const mobileDecls = declsForDevice(s, a, "mobile")

  // Boosted descendant rule so inherited text props actually reach text nodes
  // that the theme styles directly (see INHERITED_TEXT_PROPS).
  const textSel = `${boostSel(sel)} ${TEXT_DESCENDANTS}`
  const baseText = textSubset(baseDecls)
  const tabletText = textSubset(tabletDecls)
  const mobileText = textSubset(mobileDecls)

  let css = ""

  if (baseDecls.length) {
    css += `${sel}{${declsToBody(baseDecls)}}`
  }
  if (baseText.length) {
    css += `${textSel}{${declsToBody(baseText)}}`
  }

  // Hide-on-desktop lives in its own min-width query so tablet/mobile stay shown.
  // 3C: visibility reads go through the dual-shape helper (legacy trio OR the
  // spec `hide` bag) — emission points, order and bytes are unchanged for
  // legacy-authored bags.
  if (emitHide && isHiddenOnDevice(a, "desktop")) {
    css += `@media (min-width:1025px){${sel}{display:none}}`
  }

  // Tablet: diff vs desktop base, plus hide-on-tablet.
  const tabletParts = diffDecls(tabletDecls, baseDecls)
  if (emitHide && isHiddenOnDevice(a, "tablet")) {
    tabletParts.push(["display", "none"])
  }
  const tabletTextParts = diffDecls(tabletText, baseText)
  if (tabletParts.length || tabletTextParts.length) {
    let block = ""
    if (tabletParts.length) {
      block += `${sel}{${declsToBody(tabletParts)}}`
    }
    if (tabletTextParts.length) {
      block += `${textSel}{${declsToBody(tabletTextParts)}}`
    }
    css += `@media (max-width:1024px){${block}}`
  }

  // Mobile: diff vs tablet (tablet's max-width query already covers mobile widths).
  const mobileParts = diffDecls(mobileDecls, tabletDecls)
  if (emitHide && isHiddenOnDevice(a, "mobile")) {
    mobileParts.push(["display", "none"])
  }
  const mobileTextParts = diffDecls(mobileText, tabletText)
  if (mobileParts.length || mobileTextParts.length) {
    let block = ""
    if (mobileParts.length) {
      block += `${sel}{${declsToBody(mobileParts)}}`
    }
    if (mobileTextParts.length) {
      block += `${textSel}{${declsToBody(mobileTextParts)}}`
    }
    css += `@media (max-width:767px){${block}}`
  }

  // Motion (Phase 6): hover animation + reduced-motion guard. The hover
  // transform is a rule (not per-device), and the base rule may already carry a
  // `transition`. For users who prefer reduced motion we emit an override that
  // disables BOTH the transition and the hover transform, so no animation ever
  // plays against their stated preference. All CSS-only.
  const hoverTransform =
    typeof a.hoverAnimation === "string" ? HOVER_TRANSFORMS[a.hoverAnimation] : undefined
  const hasTransition = baseDecls.some(([p]) => p === "transition")
  if (hoverTransform) {
    css += `${sel}:hover{transform:${hoverTransform}}`
  }
  if (hoverTransform || hasTransition) {
    css += `@media (prefers-reduced-motion:reduce){${sel},${sel}:hover{transition:none;transform:none}}`
  }

  // Raw custom CSS escape hatch, scoped to this selector.
  css += customCssScoped(a.customCss, sel)

  /* ---- 3E (ARCH-UX U4 P1): hover-state rules from `style.hover` ----
     Single wiring line; the serializer lives in the clearly-marked 3E
     block at the END of this file. Emits "" for every bag with no
     meaningful `hover` sub-bag, so existing stored data (which never
     carries the key) stays byte-identical. */
  css += buildHoverCss(sel, s)

  return css
}

/**
 * Emit descendant `[data-el="<key>"]` rules for an `elementStyles` map, scoped
 * under an arbitrary `base` selector (`.cms-sec-<id>` for sections,
 * `.cms-chrome-<region>` for chrome). This is the SINGLE per-element serializer
 * — both sections and chrome feed through it, so element CSS can never drift.
 * Returns "" when there is nothing to emit. Never throws. Order follows the
 * map's own key order.
 */
function buildElementCssForBase(
  base: string,
  elementStyles?: ElementStyles | null,
  /**
   * Optional per-entry ADVANCED key filter (3D). When set, each element's
   * advanced bag is reduced to these keys before serialization — the chrome
   * path passes CHROME_ELEMENT_ADVANCED_KEYS (U3: chrome leaves are
   * "Visibility only"). SECTION elements pass nothing and keep serializing
   * in full: real published bags carry excluded keys (a live snapshot has
   * hoverAnimation/entranceAnimation on an element) and filtering them
   * would break a published page — see schema/universal/element.ts.
   */
  advancedAllowed?: ReadonlySet<string>,
  /** 3C: forwarded to buildScopedRules (see StyleEngineOpts.hide). */
  opts?: StyleEngineOpts
): string {
  const rec = asRecord(elementStyles)
  if (!rec) {
    return ""
  }
  let css = ""
  for (const [key, entry] of Object.entries(rec)) {
    const e = asRecord(entry)
    if (!e) {
      continue
    }
    const style = asRecord(e.style)
    const advanced = advancedAllowed
      ? filterBagKeys(asRecord(e.advanced), advancedAllowed)
      : asRecord(e.advanced)
    if (!hasStyle(style, advanced)) {
      continue
    }
    const safeKey = sanitizeElementKey(key)
    if (!safeKey) {
      continue
    }
    css += buildScopedRules(
      `${base} [data-el="${safeKey}"]`,
      style,
      advanced,
      opts?.hide !== false
    )
  }
  return css
}

/**
 * Build the descendant CSS for a section's per-element overrides. For each key
 * in `elementStyles` that carries a non-empty `style` / `advanced` bag, emits
 * the SAME rules as a section but scoped to
 * `.cms-sec-<id> [data-el="<key>"]`. Returns "" when there is nothing to emit.
 * Never throws. Order follows the map's own key order.
 */
export function buildElementCss(
  id: string | number,
  elementStyles?: ElementStyles | null,
  opts?: StyleEngineOpts
): string {
  return buildElementCssForBase(
    `.cms-sec-${sanitizeId(id)}`,
    elementStyles,
    undefined,
    opts
  )
}

/**
 * Build the scoped CSS for one section, targeting `.cms-sec-<id>`. Emits a base
 * (desktop) rule plus diff-only `@media (max-width:1024px)` (tablet) and
 * `@media (max-width:767px)` (mobile) blocks, per-device visibility
 * (`display:none`), motion and scoped custom CSS. When an `elementStyles` map is
 * passed, ALSO appends per-element descendant rules (see `buildElementCss`) so a
 * single call yields ALL css for the section. Returns "" when the section has no
 * style AND no element overrides so the caller can keep it as a
 * `display:contents` wrapper. Never throws.
 */
export function buildSectionCss(
  id: string | number,
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  elementStyles?: ElementStyles | null,
  opts?: StyleEngineOpts
): string {
  const sel = `.cms-sec-${sanitizeId(id)}`
  let css = ""
  if (hasStyle(style, advanced)) {
    css += buildScopedRules(
      sel,
      style ?? undefined,
      advanced ?? undefined,
      opts?.hide !== false
    )
  }
  css += buildElementCss(id, elementStyles, opts)
  return css
}

/* ------------------------------------------------------------------ */
/* Widgets (Composer W1) — atoms inside a `container` section           */
/* ------------------------------------------------------------------ */

/**
 * Build the scoped CSS for ONE widget inside a container section. Widgets
 * cannot scope under `.cms-sec-<id>` — an un-styled container wrapper is
 * `display:contents` and carries no class — so the Container component root
 * carries `data-scope="<sectionScope>"` (the stable "sec-<index>" both render
 * paths pass explicitly) and every widget root carries
 * `data-w="w-<col>-<wi>"`. The selector is therefore
 * `[data-scope="sec-<i>"] [data-w="w-<col>-<wi>"]`, fed through the exact same
 * `buildScopedRules` as sections / elements / chrome so widget serialization
 * (responsive diffs, tokens, motion, custom CSS) can never drift. Returns ""
 * for empty bags or unusable inputs. Never throws.
 */
export function buildWidgetCss(
  sectionScope: string,
  col: number,
  wi: number,
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  opts?: StyleEngineOpts
): string {
  return buildWidgetCssPath(sectionScope, [col, wi], style, advanced, opts)
}

/**
 * Widget CSS addressed by PATH, so a widget nested inside an inner section is
 * styleable exactly like a top-level one.
 *
 * The path is the chain of (column, widget) indices from the section down to
 * the widget: `[0,1]` is column 0 / widget 1; `[0,1,2,3]` is the widget at
 * column 2 / index 3 INSIDE the inner-section widget at column 0 / index 1.
 * It serializes to the same `data-w="w-…"` marker the DOM carries, so a
 * two-element path produces byte-identical CSS to the old signature — nothing
 * already published changes.
 */
export function buildWidgetCssPath(
  sectionScope: string,
  path: number[],
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  opts?: StyleEngineOpts
): string {
  if (!hasStyle(style, advanced)) {
    return ""
  }
  // Same character class as element keys — safe inside an attribute selector.
  const scope = sanitizeElementKey(sectionScope)
  if (
    !scope ||
    !Array.isArray(path) ||
    path.length < 2 ||
    path.length % 2 !== 0 ||
    !path.every((n) => Number.isInteger(n) && n >= 0)
  ) {
    return ""
  }
  const sel = `[data-scope="${scope}"] [data-w="w-${path.join("-")}"]`
  return buildScopedRules(
    sel,
    style ?? undefined,
    advanced ?? undefined,
    opts?.hide !== false
  )
}

/* ------------------------------------------------------------------ */
/* Columns (2E — ARCH-UX U3 "columns finally get style bags")           */
/* ------------------------------------------------------------------ */

/**
 * Advanced keys a COLUMN is allowed to emit: visibility, identity, custom
 * CSS. The Position and Motion groups are deliberately refused — columns
 * positioning breaks the container contract (ARCH-UX §1.2's subset rule),
 * and unlike the FORM-side restriction (schema/universal/column.ts, which
 * merely doesn't offer the fields) this filter makes the restriction real
 * for template-, AI- and import-authored bags too. Kept as a literal here
 * (rather than importing the schema module) so the render engine stays free
 * of editor-schema imports; schema/universal/column.ts mirrors this list and
 * says so.
 */
const COLUMN_ADVANCED_KEYS = new Set([
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
  // 3C: the spec visibility shape (advanced.hide = {desktop?,tablet?,mobile?})
  // — same capability as the legacy trio above, so it passes the same filter.
  "hide",
  "anchorId",
  "cssClasses",
  "customCss",
])

/** `verticalAlign` (column Layout) → the flex-item `align-self` value. */
const COLUMN_ALIGN_SELF: Record<string, string> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
  stretch: "stretch",
}

/**
 * Build the scoped CSS for ONE column of a container section, from the
 * column's own `style` / `advanced` bags (`columns[i].style`, diff-only, the
 * same UNIVERSAL_STYLE vocabulary as every other node).
 *
 * Selector convention follows buildWidgetCssPath exactly: an un-styled
 * container wrapper is `display:contents` and carries no class, so the rule
 * anchors on the Container root's `data-scope` and the column's own
 * `data-col` marker:
 *
 *   [data-scope="sec-<i>"] [data-col="<colPath.join("-")>"]
 *
 * `colPath` is the ODD-length column address from ARCH-CANVAS §4.1's NodeRef
 * (`{ t:"column", col:number[] }`): `[0]` is top-level column 0 (DOM marker
 * data-col="0"), `[0,1,2]` is column 2 INSIDE the inner-section widget at
 * column 0 / index 1 (DOM marker data-col="0-1-2") — the exact strings
 * container-html already stamps, so the selector can never miss.
 *
 * Serialization feeds through the SAME buildScopedRules as sections /
 * elements / widgets / chrome (responsive diffs, token refs, custom CSS), so
 * column CSS can never drift from the rest of the engine. Column-specific
 * mapping: the style key `verticalAlign` (not a section vocabulary key —
 * ignored by the shared serializer) emits an `align-self` rule; the advanced
 * bag is filtered to the column subset (see COLUMN_ADVANCED_KEYS).
 *
 * Returns "" for empty/meaningless bags or unusable inputs — a column with
 * no bags emits NOTHING, keeping published output byte-identical. Never
 * throws.
 */
export function buildColumnCss(
  sectionScope: string,
  colPath: number[],
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  opts?: StyleEngineOpts
): string {
  const scope = sanitizeElementKey(sectionScope)
  if (
    !scope ||
    !Array.isArray(colPath) ||
    colPath.length < 1 ||
    colPath.length % 2 !== 1 ||
    !colPath.every((n) => Number.isInteger(n) && n >= 0)
  ) {
    return ""
  }
  // Enforce the column Advanced subset at the engine (not just the form).
  const a = asRecord(advanced)
  const allowedAdvanced: AdvancedBag = {}
  if (a) {
    for (const k of Object.keys(a)) {
      if (COLUMN_ADVANCED_KEYS.has(k)) {
        allowedAdvanced[k] = a[k]
      }
    }
  }
  if (!hasStyle(style, allowedAdvanced)) {
    return ""
  }
  const sel = `[data-scope="${scope}"] [data-col="${colPath.join("-")}"]`
  let css = buildScopedRules(
    sel,
    style ?? undefined,
    allowedAdvanced,
    opts?.hide !== false
  )
  // Column-specific Layout control: verticalAlign → align-self on the flex
  // item. Non-responsive in v1 (plain choose value); unknown values skipped.
  const s = asRecord(style)
  const va = typeof s?.verticalAlign === "string" ? COLUMN_ALIGN_SELF[s.verticalAlign] : undefined
  if (va) {
    css += `${sel}{align-self:${va}}`
  }
  return css
}

/* ------------------------------------------------------------------ */
/* Chrome (header / top bar / footer) — same engine, stable region scope */
/* ------------------------------------------------------------------ */

/**
 * The three chrome regions. Unlike sections (which are keyed by a dynamic id),
 * chrome regions are a fixed, known set and scope to a STABLE per-region class
 * `.cms-chrome-<region>` on the header / top-bar / footer root — so the exact
 * same CSS applies in both the editor canvas and production.
 */
export type ChromeRegion = "topbar" | "header" | "footer"

/**
 * Advanced keys a chrome REGION is allowed to emit (3D — ARCH-UX §1.2:
 * chrome Advanced is "identity + custom CSS only"). Chrome ships to every
 * page of a live store, so position/sticky/motion/per-device-hide on a bar
 * is the highest-blast-radius footgun in the product; like the column
 * filter above (2E), enforcing here makes the restriction real for
 * template-, AI- and import-authored bags, not just the form. Kept as a
 * literal so the render engine stays free of editor-schema imports;
 * schema/universal/chrome.ts (CHROME_ADVANCED_ALLOWED) mirrors this list
 * and says so. SAFE against live data: the 2026-07-19 scan of all 51
 * chrome cms_setting rows found zero advanced keys outside this set.
 */
const CHROME_ADVANCED_KEYS = new Set(["anchorId", "cssClasses", "customCss"])

/**
 * Advanced keys a chrome ELEMENT (data-el leaf inside a bar) is allowed to
 * emit: per-device visibility ONLY (ARCH-UX §1.2 "Chrome leaf" row).
 * Mirrored by schema/universal/chrome.ts CHROME_ELEMENT_ADVANCED_ALLOWED.
 */
const CHROME_ELEMENT_ADVANCED_KEYS = new Set([
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
  // 3C: the spec visibility shape — chrome leaves are "visibility only", and
  // the new shape carries exactly that capability. The chrome REGION set
  // (CHROME_ADVANCED_KEYS above) deliberately excludes BOTH shapes: hiding a
  // whole bar per device stays refused no matter how the bag was authored.
  "hide",
])

/**
 * Does this chrome region carry any real style? Identical semantics to
 * `hasStyle` (section) — true when the region `style` / `advanced` bag holds a
 * meaningful value OR any `elementStyles` entry does. Kept as a distinct export
 * so chrome callers read clearly; delegates to `hasStyle` so the two can never
 * diverge.
 *
 * NOTE (3D): this pre-gate is deliberately UNFILTERED — a bag holding only
 * refused advanced keys reads as "has style" here, but `buildChromeCss` then
 * emits "" and both callers (`chrome-styles`, the editor canvas) already
 * treat an empty string as nothing-to-inject. Filtering here too would buy
 * nothing and create a second copy of the allowed sets to drift.
 */
export function chromeHasStyle(
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  elementStyles?: ElementStyles | null
): boolean {
  return hasStyle(style, advanced, elementStyles)
}

/**
 * Build the scoped CSS for one chrome region, targeting the stable class
 * `.cms-chrome-<region>` (from the region `style` / `advanced` bag) plus
 * per-element descendant rules `.cms-chrome-<region> [data-el="<key>"]` (from
 * `elementStyles`). REUSES the exact same `buildScopedRules` /
 * `buildElementCssForBase` helpers as sections, so serialization is byte-for-byte
 * identical. Returns "" when the region has no style and no element overrides, so
 * an un-styled chrome stays visually unchanged. Never throws.
 *
 * RESTRICTED ADVANCED (3D, engine-enforced like 2E's column filter): the
 * region advanced bag is reduced to CHROME_ADVANCED_KEYS (identity + custom
 * CSS) and every element entry's advanced bag to
 * CHROME_ELEMENT_ADVANCED_KEYS (visibility) BEFORE serialization, so
 * position/sticky/motion/hide on a bar cannot reach published CSS no matter
 * how the bag was authored. STYLE bags are unrestricted (full universal
 * vocabulary, per the U3 table).
 */
export function buildChromeCss(
  region: ChromeRegion | string,
  style?: StyleBag | null,
  advanced?: AdvancedBag | null,
  elementStyles?: ElementStyles | null,
  opts?: StyleEngineOpts
): string {
  const sel = `.cms-chrome-${sanitizeId(region)}`
  const allowedAdvanced = filterBagKeys(
    asRecord(advanced),
    CHROME_ADVANCED_KEYS
  )
  let css = ""
  if (hasStyle(style, allowedAdvanced)) {
    css += buildScopedRules(
      sel,
      style ?? undefined,
      allowedAdvanced,
      opts?.hide !== false
    )
  }
  css += buildElementCssForBase(
    sel,
    elementStyles,
    CHROME_ELEMENT_ADVANCED_KEYS,
    opts
  )
  return css
}

export default buildSectionCss

/* ================================================================== */
/* 3E — HOVER STATES (ARCH-UX U4 P1) — seat 3E owns this block          */
/*                                                                     */
/* Storage: a `hover` sub-bag INSIDE the style bag, diff-only like       */
/* everything else:                                                     */
/*                                                                     */
/*   style.hover = {                                                    */
/*     background?: <same shape as style.background>,                   */
/*     color?:      <same shape as style.color (raw string | {ref})>,   */
/*     border?:     <same shape as style.border>,                       */
/*     boxShadow?:  <same shape as style.boxShadow>,                    */
/*   }                                                                  */
/*                                                                     */
/* Exactly the four groups ARCH-UX U4 names — anything else in the       */
/* sub-bag is ignored by the whitelist below, so template/AI/import-     */
/* authored bags cannot smuggle arbitrary properties into a :hover rule. */
/* Values reuse the SAME mappers as the normal state (backgroundDecls,   */
/* borderDecls, boxShadowDecls, resolveTokenRef), so hover serialization  */
/* can never drift from normal serialization. Non-responsive in v1:      */
/* hover is a pointer affordance, and per-device hover is noise.         */
/*                                                                     */
/* Emission, per selector (only when the sub-bag holds a meaningful      */
/* value — otherwise "" and published output is byte-identical):         */
/*   1. `sel:hover{...}` — the hover declarations.                       */
/*   2. When a hover text color is set, the same boosted descendant      */
/*      rule the normal state uses (see INHERITED_TEXT_PROPS), with      */
/*      `:hover` on the scope — themes style text nodes directly, and    */
/*      a hover color that silently loses the cascade is the exact bug   */
/*      boostSel() exists to prevent.                                    */
/*   3. A transition so the state change eases instead of snapping —     */
/*      wrapped in `@media (prefers-reduced-motion: no-preference)`      */
/*      following the ENTRANCE_CSS pattern: reduced-motion users get     */
/*      the hover STATE instantly, never the animation. The property     */
/*      list includes `transform` so an also-present hoverAnimation      */
/*      (Motion group) keeps easing when this rule wins the cascade.     */
/*                                                                     */
/* NOTE ON WIRING: buildScopedRules calls buildHoverCss once, right      */
/* before its return (the single 3E line marked there). Every node kind  */
/* — section, element, widget, column, chrome — funnels through          */
/* buildScopedRules, so hover works uniformly with no per-kind code.     */
/* hasStyle() already counts a hover-only bag as "has style" (it         */
/* recurses into nested objects), so a section styled ONLY on hover      */
/* still gets its `.cms-sec-<id>` box instead of display:contents.       */
/* ================================================================== */

/** The only style keys a hover sub-bag may emit (ARCH-UX U4 P1). */
const HOVER_STYLE_KEYS = ["background", "color", "border", "boxShadow"] as const

/** Hover transition: fast ease, one declaration, shared by every rule. */
const HOVER_TRANSITION =
  "background-color 160ms ease,color 160ms ease,border-color 160ms ease," +
  "box-shadow 160ms ease,transform 160ms ease"

/**
 * Extract the meaningful, whitelisted part of a style bag's `hover` sub-bag.
 * Returns undefined when there is nothing to emit. Never throws.
 */
function hoverBagOf(
  style: StyleBag | undefined
): Record<string, unknown> | undefined {
  const s = asRecord(style)
  const h = asRecord(s?.hover)
  if (!h) {
    return undefined
  }
  const out: Record<string, unknown> = {}
  for (const k of HOVER_STYLE_KEYS) {
    if (isMeaningful(h[k])) {
      out[k] = h[k]
    }
  }
  return Object.keys(out).length ? out : undefined
}

/** Hover sub-bag → declarations, through the SAME mappers as normal state. */
function hoverDecls(h: Record<string, unknown>): Decl[] {
  const out: Decl[] = []
  out.push(...backgroundDecls(h.background))
  const color = resolveTokenRef(h.color, "color")
  if (color) {
    out.push(["color", color])
  }
  out.push(...borderDecls(h.border))
  out.push(...boxShadowDecls(h.boxShadow))
  return out
}

/**
 * Build the `:hover` rules for one selector from its style bag. Exported for
 * tests; production callers never call it directly — buildScopedRules does.
 * Returns "" whenever the bag carries no meaningful `hover` sub-bag, keeping
 * every already-published page byte-identical. Never throws.
 */
export function buildHoverCss(sel: string, style?: StyleBag | null): string {
  const h = hoverBagOf(style ?? undefined)
  if (!h) {
    return ""
  }
  const decls = hoverDecls(h)
  if (!decls.length) {
    return ""
  }
  let css = `${sel}:hover{${declsToBody(decls)}}`
  // Inherited-text boost for the hover color (mirrors the normal-state rule).
  const text = textSubset(decls)
  if (text.length) {
    css += `${boostSel(sel)}:hover ${TEXT_DESCENDANTS}{${declsToBody(text)}}`
  }
  // Ease the state change — but only for users who accept motion.
  css += `@media (prefers-reduced-motion:no-preference){${sel}{transition:${HOVER_TRANSITION}}}`
  return css
}
