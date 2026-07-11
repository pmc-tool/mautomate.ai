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
  | "textarea"
  | "richText"
  | "number"
  | "range"
  | "boolean"
  | "select"
  | "color"
  | "image"
  | "url"
  | "product"
  | "collection"
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
