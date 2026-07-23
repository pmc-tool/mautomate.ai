/* ------------------------------------------------------------------ */
/* Block schema — the single source of truth for what is editable       */
/*                                                                     */
/* One BlockSchema per block type declares its editable fields. This    */
/* drives (1) the visual editor's control panel, (2) default props, and  */
/* (3) validation — so the editor never "guesses" controls from JSON.    */
/* Modeled on Shopify section schema + Builder.io inputs + Puck fields    */
/* (see docs/cms/platform-architecture.md). Theme-agnostic: themes       */
/* provide the components; this declares the data contract.              */
/* ------------------------------------------------------------------ */

export type FieldType =
  | "text"
  | "datetime"
  | "textarea"
  | "richText"
  | "number"
  | "range"
  | "boolean"
  | "select"
  | "color"
  | "image"
  | "url"
  | "video"
  | "product"
  | "collection"
  /* --- 3E (ARCH-UX U4 P1) control vocabulary --- */
  /** URL / page-picker hybrid with new-tab + nofollow. Value: `LinkValue` —
   *  a plain href string until extras are set, then a `LinkObject`. */
  | "link"
  /** Searchable picker over the Font Awesome 5 Free set the themes already
   *  ship. Value: the icon's full class string (e.g. "fas fa-star"). */
  | "icon"
  | "object"
  | "list"
  /* --- universal Style/Advanced controls (block.style / block.advanced) --- */
  | "dimensions"
  | "unitNumber"
  | "typographyGroup"
  | "background"
  | "border"
  | "boxShadow"
  | "choose"
  | "code"

/** The four editable sides of a `dimensions` (box) control. */
export type DimensionSide = "top" | "right" | "bottom" | "left"

export interface FieldDef {
  /** key in the block's props object. */
  name: string
  type: FieldType
  label: string
  default?: unknown
  required?: boolean
  /** help text shown under the control. */
  help?: string
  /** groups fields under a collapsible heading in the panel. */
  group?: string
  /** conditional visibility — a pure function of the block's current props. */
  hidden?: (props: Record<string, unknown>) => boolean
  /** select / choose options. `icon` (lucide name) is used by `choose`. */
  options?: { label: string; value: string; icon?: string }[]
  /** number / range / unitNumber bounds. */
  min?: number
  max?: number
  step?: number
  unit?: string

  /* --- per-type options for the universal Style/Advanced controls --- */
  /**
   * Allowed CSS units for `dimensions` / `unitNumber` controls.
   * First entry is treated as the default unit (e.g. ["px", "%", "rem", "em"]).
   */
  units?: string[]
  /** Which sides a `dimensions` control exposes (default: all four). */
  sides?: DimensionSide[]
  /** `dimensions`: whether the four sides start linked (edited together). */
  linked?: boolean
  /** `background`: allow a gradient value in addition to a solid color. */
  gradient?: boolean
  /** `background`: allow an image (url) layer. */
  allowImage?: boolean
  /** `code` / `textarea`: preferred visible row count. */
  rows?: number

  /**
   * Marks a control whose VALUE can differ per device. When true the stored
   * value is a `ResponsiveValue<T>` (`{ base, tablet?, mobile? }`) rather than
   * a plain `T`; resolve it for a device with `resolveResponsive`.
   */
  responsive?: boolean

  /** object / list sub-fields (recursive). */
  fields?: FieldDef[]
  /** list cap + a label template for each item ("Slide", "Item"). */
  maxItems?: number
  itemLabel?: string
}

export interface BlockPreset {
  name: string
  props: Record<string, unknown>
}

export interface BlockSchema {
  /** stable key (snake_case) — matches the block_type everywhere. */
  type: string
  label: string
  category: "hero" | "products" | "content" | "media" | "social" | "commerce" | "layout"
  /** lucide icon name (rendered in the Add/section list). */
  icon?: string
  fields: FieldDef[]
  defaultProps: Record<string, unknown>
  presets?: BlockPreset[]
  /** max times this block may appear on one page (e.g. 1 hero). */
  maxInstances?: number
  /** which page templates may use this block (omitted = any). */
  allowedTemplates?: string[]
  /** pre-built-theme protection: "contentOnly" hides structural add/remove. */
  lock?: "none" | "contentOnly"
}

/* ------------------------------------------------------------------ */
/* Responsive value model — a leaf value that can differ per device     */
/* ------------------------------------------------------------------ */

/** The three editing devices, largest → smallest. */
export type Device = "desktop" | "tablet" | "mobile"

/**
 * A leaf value that can hold a distinct value per device. `base` is the
 * desktop value; `tablet` / `mobile` are optional overrides. Unset devices
 * inherit up the cascade (see `resolveResponsive`). Stored only for fields
 * flagged `responsive: true`; everything else stays a plain scalar.
 */
export type ResponsiveValue<T> = { base: T; tablet?: T; mobile?: T }

/** Narrow an unknown value to a `ResponsiveValue<T>` (has a `base` key). */
export function isResponsiveValue<T = unknown>(
  v: ResponsiveValue<T> | T | unknown
): v is ResponsiveValue<T> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "base" in (v as Record<string, unknown>)
  )
}

/**
 * Resolve a (possibly responsive) value for one device using the cascade:
 *   desktop → base
 *   tablet  → tablet ?? base
 *   mobile  → mobile ?? tablet ?? base
 * A plain (non-responsive) value is returned unchanged for every device.
 */
export function resolveResponsive<T>(
  v: ResponsiveValue<T> | T,
  device: Device
): T {
  if (!isResponsiveValue<T>(v)) {
    return v as T
  }
  switch (device) {
    case "desktop":
      return v.base
    case "tablet":
      return v.tablet ?? v.base
    case "mobile":
      return v.mobile ?? v.tablet ?? v.base
  }
}

/* ------------------------------------------------------------------ */
/* Derived helpers — defaults + validation come FROM the schema        */
/* ------------------------------------------------------------------ */

/** Build a fresh default value for one field (recursive for object/list). */
function defaultForField(f: FieldDef): unknown {
  if (f.default !== undefined) {
    return f.default
  }
  switch (f.type) {
    case "number":
    case "range":
    case "unitNumber":
      return f.min ?? 0
    case "boolean":
      return false
    case "list":
      return []
    case "object":
      return Object.fromEntries((f.fields ?? []).map((sf) => [sf.name, defaultForField(sf)]))
    // Universal Style/Advanced composites default to an empty (inherit) bag so
    // stored style stays a tiny diff until the user actually sets something.
    case "dimensions":
    case "typographyGroup":
    case "background":
    case "border":
    case "boxShadow":
      return {}
    default:
      return ""
  }
}

/**
 * Build a default props object from a bare field list. Reused for the
 * universal Style/Advanced bags (`block.style` / `block.advanced`), which are
 * described by a `FieldDef[]` rather than a full `BlockSchema`.
 */
export function defaultPropsFromFields(fields: FieldDef[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.name, defaultForField(f)]))
}

/** Compose the default props object for a block from its schema. */
export function defaultPropsFromSchema(schema: BlockSchema): Record<string, unknown> {
  if (schema.defaultProps && Object.keys(schema.defaultProps).length) {
    return structuredClone(schema.defaultProps)
  }
  return defaultPropsFromFields(schema.fields)
}

export type ValidationError = { path: string; message: string }

/** Validate a props object against a field list (recursive). Returns errors. */
function validateFields(
  fields: FieldDef[],
  props: Record<string, unknown>,
  prefix = ""
): ValidationError[] {
  const errors: ValidationError[] = []
  for (const f of fields) {
    if (f.hidden?.(props)) {
      continue
    }
    const value = props?.[f.name]
    const path = prefix ? `${prefix}.${f.name}` : f.name

    if (f.required && (value === undefined || value === null || value === "")) {
      errors.push({ path, message: `${f.label} is required.` })
      continue
    }
    if (value == null) {
      continue
    }
    // Responsive leaves store a { base, tablet?, mobile? } shape rather than a
    // scalar — never fail the per-device bag against scalar type checks.
    if (isResponsiveValue(value)) {
      continue
    }
    if ((f.type === "number" || f.type === "range") && typeof value !== "number") {
      errors.push({ path, message: `${f.label} must be a number.` })
    }
    if (f.type === "list") {
      if (!Array.isArray(value)) {
        errors.push({ path, message: `${f.label} must be a list.` })
      } else if (f.fields) {
        value.forEach((item, i) => {
          errors.push(
            ...validateFields(f.fields!, item as Record<string, unknown>, `${path}[${i}]`)
          )
        })
      }
    }
    if (f.type === "object" && f.fields && typeof value === "object") {
      errors.push(...validateFields(f.fields, value as Record<string, unknown>, path))
    }
  }
  return errors
}

/** Validate a block's props against its schema. */
export function validatePropsFromSchema(
  schema: BlockSchema,
  props: Record<string, unknown>
): ValidationError[] {
  return validateFields(schema.fields, props ?? {})
}

/* ================================================================== */
/* 3E — Link value model (ARCH-UX U4 P1 "Link control")                 */
/*                                                                     */
/* Every `href` / `url` field stores a plain string today, and themes    */
/* consume plain strings from Liquid — so the string form is permanent.  */
/* The Link control writes an OBJECT only when the merchant sets an      */
/* extra (new tab / nofollow); with no extras it keeps writing the       */
/* string, so untouched data never changes shape.                        */
/*                                                                     */
/*   LinkValue = string                        (today, and the default)  */
/*             | { href, target?: "_blank", rel?: string }               */
/*                                                                     */
/* CONSUMER CONTRACT:                                                    */
/*  - Platform renderers (container-html image/button) read the value    */
/*    through `linkAttrs()` so extras become real attributes.            */
/*  - The Liquid path (theme sections, chrome nav) must be handed        */
/*    STRINGS: call `flattenLinkValues()` on a settings object before    */
/*    it reaches the engine (commerceWidgetSettings + build-context).    */
/*    A theme therefore never sees the object shape.                     */
/* These helpers are pure and isomorphic (no React, no DOM), which is    */
/* why they live here and not in an editor module.                       */
/* ================================================================== */

/** The object form of a link — only written when an extra is set. */
export interface LinkObject {
  href: string
  /** Open in a new tab. The only target the control ever writes. */
  target?: "_blank"
  /** Space-separated rel tokens (v1 writes only "nofollow"). */
  rel?: string
}

/** What a `link`-typed field stores. String in → string out unless extras. */
export type LinkValue = string | LinkObject

const LINK_OBJECT_KEYS = new Set(["href", "target", "rel"])

/**
 * Strict shape test for the object form. Deliberately conservative — any
 * unknown key, a non-string href, or a target other than "_blank" fails —
 * so `flattenLinkValues` can walk arbitrary settings objects with no risk
 * of false positives on unrelated data.
 */
export function isLinkObject(v: unknown): v is LinkObject {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return false
  }
  const rec = v as Record<string, unknown>
  if (typeof rec.href !== "string") {
    return false
  }
  for (const k of Object.keys(rec)) {
    if (!LINK_OBJECT_KEYS.has(k)) {
      return false
    }
  }
  if (rec.target !== undefined && rec.target !== "_blank") {
    return false
  }
  if (rec.rel !== undefined && typeof rec.rel !== "string") {
    return false
  }
  return true
}

/** The href of either form ("" for anything unusable). */
export function linkHref(v: unknown): string {
  if (typeof v === "string") {
    return v
  }
  return isLinkObject(v) ? v.href : ""
}

/**
 * Resolve either form to the anchor attributes a renderer should emit.
 * `target="_blank"` always brings `rel` containing "noopener" (tab-nabbing
 * guard), merged with any stored tokens; a plain string yields href only.
 */
export function linkAttrs(v: unknown): {
  href: string
  target?: "_blank"
  rel?: string
} {
  if (typeof v === "string" || !isLinkObject(v)) {
    return { href: linkHref(v) }
  }
  const out: { href: string; target?: "_blank"; rel?: string } = {
    href: v.href,
  }
  const relTokens = (v.rel ?? "")
    .split(/\s+/)
    .filter(Boolean)
  if (v.target === "_blank") {
    out.target = "_blank"
    if (!relTokens.includes("noopener")) {
      relTokens.push("noopener")
    }
  }
  if (relTokens.length) {
    out.rel = relTokens.join(" ")
  }
  return out
}

/**
 * Deep-walk any settings value and replace every `LinkObject` with its plain
 * href string — the Liquid-side flattener (themes read strings, per the theme
 * data contract). Pure and allocation-shy: returns the ORIGINAL reference
 * whenever nothing inside changed, so untouched settings stay `===` and no
 * render memoization is invalidated. Never throws.
 */
export function flattenLinkValues(value: unknown): unknown {
  if (isLinkObject(value)) {
    return value.href
  }
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const n = flattenLinkValues(item)
      if (n !== item) {
        changed = true
      }
      return n
    })
    return changed ? next : value
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>
    let changed = false
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(rec)) {
      const n = flattenLinkValues(rec[k])
      if (n !== rec[k]) {
        changed = true
      }
      out[k] = n
    }
    return changed ? out : value
  }
  return value
}

/* ================================================================== */
/* 3C — Responsive write path + per-device visibility (ARCH-CANVAS P7)  */
/*                                                                     */
/* ONE write path for every device-scoped edit: `writeResponsive`.      */
/* Desktop writes stay PLAIN (a scalar/leaf, exactly what is stored     */
/* today); the first tablet/mobile write PROMOTES the plain value to    */
/* `{ base, tablet?, mobile? }`; clearing the last override DEMOTES     */
/* back to the plain value — so a promote → clear round-trip leaves     */
/* the stored bag byte-identical. No control may hand-craft a           */
/* `{ base, … }` shape; every panel control funnels through here via    */
/* ResponsiveFieldWrapper, and the canvas font handle routes through    */
/* the same helper shell-side.                                          */
/*                                                                     */
/* Per-device VISIBILITY moves to the spec shape                        */
/*   advanced.hide = { desktop?: true, tablet?: true, mobile?: true }   */
/* (diff-only: absent key = shown, empty bag never stored). The legacy  */
/* trio (`hideOnDesktop`/`hideOnTablet`/`hideOnMobile`) is normalized   */
/* to this shape at EDIT time only (`writeHide` folds it in and strips  */
/* the legacy keys); READERS accept BOTH shapes for one release         */
/* (`isHiddenOnDevice`) so no published page changes behavior.          */
/* These helpers are pure and isomorphic (no React, no DOM) — the       */
/* render engine (style-engine.ts) and the editor share them, which is  */
/* why they live here.                                                  */
/* ================================================================== */

/**
 * Is a leaf value "empty" (nothing worth storing)? Mirrors the panel's
 * diff-only rule: undefined/null/"" and the empty object are empty. A
 * ResponsiveValue is never empty by this test — it always carries `base`.
 */
function isEmptyLeaf(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v as object).length === 0)
  )
}

/**
 * Does the stored value carry its OWN override for `device`? Desktop is the
 * base — authoritative but never an "override" — so it always returns false.
 * Drives the panel's per-device override dot and the "Reset <device>" button.
 */
export function hasDeviceOverride(value: unknown, device: Device): boolean {
  if (device === "desktop") {
    return false
  }
  return (
    isResponsiveValue(value) &&
    (value as ResponsiveValue<unknown>)[device] !== undefined
  )
}

/**
 * THE single device-write path (ARCH-CANVAS P7 / Decision 5).
 *
 * Returns a NEW bag with `bag[key]` updated for `device`:
 *  - desktop, plain value:      writes the plain value (no shape change);
 *    an empty value deletes the key entirely (diff-only storage).
 *  - desktop, responsive value: updates `base`, keeping the overrides.
 *  - tablet/mobile:             sets that device's slot, PROMOTING a plain
 *    value to `{ base: <old>, [device]: <new> }` on the first override.
 *
 * Never mutates its inputs. To REMOVE an override use
 * `clearResponsiveOverride` (demotes back to plain when only base remains).
 */
export function writeResponsive(
  bag: Record<string, unknown>,
  key: string,
  device: Device,
  value: unknown
): Record<string, unknown> {
  const current = bag[key]
  if (device === "desktop") {
    if (isResponsiveValue(current)) {
      return {
        ...bag,
        [key]: { ...(current as ResponsiveValue<unknown>), base: value },
      }
    }
    if (isEmptyLeaf(value)) {
      const rest = { ...bag }
      delete rest[key]
      return rest
    }
    return { ...bag, [key]: value }
  }
  // tablet / mobile — ensure the responsive shape, then set this device slot.
  const rv: ResponsiveValue<unknown> = isResponsiveValue(current)
    ? { ...(current as ResponsiveValue<unknown>) }
    : { base: current }
  rv[device] = value
  return { ...bag, [key]: rv }
}

/**
 * Remove `device`'s override from `bag[key]`. When no override remains the
 * shape DEMOTES back to the plain base value — and when that base is itself
 * empty the key is deleted entirely, so promote → clear round-trips to the
 * exact original bag. Desktop has no override to clear (returns `bag`).
 * Never mutates its inputs.
 */
export function clearResponsiveOverride(
  bag: Record<string, unknown>,
  key: string,
  device: Device
): Record<string, unknown> {
  const current = bag[key]
  if (device === "desktop" || !isResponsiveValue(current)) {
    return bag
  }
  const rv: ResponsiveValue<unknown> = {
    ...(current as ResponsiveValue<unknown>),
  }
  delete rv[device]
  if (rv.tablet === undefined && rv.mobile === undefined) {
    if (isEmptyLeaf(rv.base)) {
      const rest = { ...bag }
      delete rest[key]
      return rest
    }
    return { ...bag, [key]: rv.base }
  }
  return { ...bag, [key]: rv }
}

/* ---------------- per-device visibility (advanced.hide) ------------- */

/**
 * The spec shape for per-device visibility. Diff-only: a device key is
 * present ONLY when that device is hidden (`true`); an all-shown node
 * stores no `hide` key at all.
 */
export type HideBag = { desktop?: boolean; tablet?: boolean; mobile?: boolean }

/** The legacy advanced-bag visibility keys, by device (pre-P7 shape). */
export const LEGACY_HIDE_KEY: Record<Device, string> = {
  desktop: "hideOnDesktop",
  tablet: "hideOnTablet",
  mobile: "hideOnMobile",
}

/**
 * Panel routing table: legacy visibility FIELD name → the device it hides.
 * The Advanced tab keeps offering the three familiar toggles (their FieldDefs
 * are unchanged), but SchemaPanel routes their reads/writes through
 * `isHiddenOnDevice` / `writeHide` so storage uses the spec shape.
 */
export const HIDE_FIELD_DEVICE: Record<string, Device> = {
  hideOnDesktop: "desktop",
  hideOnTablet: "tablet",
  hideOnMobile: "mobile",
}

/**
 * Dual-shape visibility READ (the one-release compatibility contract):
 * hidden when the spec shape says so (`advanced.hide[device] === true`) OR
 * the legacy flag does (`advanced.hideOn<Device> === true`). Visibility is
 * per-device INDEPENDENT — no cascade, matching how the flags have always
 * been emitted. Defensive: any malformed input reads as "shown".
 */
export function isHiddenOnDevice(
  advanced: Record<string, unknown> | null | undefined,
  device: Device
): boolean {
  if (!advanced || typeof advanced !== "object" || Array.isArray(advanced)) {
    return false
  }
  const hide = (advanced as Record<string, unknown>).hide
  if (
    hide &&
    typeof hide === "object" &&
    !Array.isArray(hide) &&
    (hide as HideBag)[device] === true
  ) {
    return true
  }
  return (advanced as Record<string, unknown>)[LEGACY_HIDE_KEY[device]] === true
}

/**
 * The EDIT-time visibility write + normalizer. Returns a new advanced bag
 * where:
 *  - every legacy `hideOn*` key is folded into the spec `hide` shape and
 *    removed (normalize-on-write, per the no-breaking-published-pages rule:
 *    published pages are untouched until the merchant actually edits
 *    visibility, and the storefront reads both shapes for one release);
 *  - `device` is set hidden/shown per `hidden`;
 *  - storage stays diff-only: shown devices carry no key, and a fully-shown
 *    node carries no `hide` bag at all.
 * Never mutates its inputs.
 */
export function writeHide(
  advanced: Record<string, unknown>,
  device: Device,
  hidden: boolean
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...advanced }
  const hide: HideBag = {}
  // Fold BOTH shapes into a fresh diff-only hide bag.
  for (const d of ["desktop", "tablet", "mobile"] as const) {
    if (isHiddenOnDevice(advanced, d)) {
      hide[d] = true
    }
    delete next[LEGACY_HIDE_KEY[d]]
  }
  if (hidden) {
    hide[device] = true
  } else {
    delete hide[device]
  }
  if (Object.keys(hide).length) {
    next.hide = hide
  } else {
    delete next.hide
  }
  return next
}
