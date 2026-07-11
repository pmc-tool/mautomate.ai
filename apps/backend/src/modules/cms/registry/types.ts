import type { BlockType } from "../types"

/**
 * Block registry — shared types (phase-0-architecture.md §3).
 *
 * Each block type has a single source-of-truth definition: a stable label, a
 * `defaultData()` factory (what "Add section" inserts in the admin builder), a
 * `schemaVersion` (carried on every compiled block for forward-compat), and a
 * pure `validate(data)` run against the RESOLVED block data (after the section
 * translation has been deep-merged over the en base) at publish time.
 *
 * Localized string fields live in `section.data` as the `en` value; non-default
 * locales override them via cms_section_translation. The registry validates the
 * RESOLVED shape only — it does not need to know which keys are translatable.
 * (See each block file's header for the per-field locale annotations the admin
 * editors / translation tabs consume.)
 */

export interface BlockValidationResult {
  /** true when `errors` is empty. */
  valid: boolean
  /** Human-readable, field-pathed validation errors (empty when valid). */
  errors: string[]
}

export interface BlockDefinition<T = unknown> {
  /** The BLOCK_TYPES key this definition validates. */
  type: BlockType
  /** Admin-facing label (used by the Add-section palette). */
  label: string
  /** Schema version stamped onto every compiled block of this type. */
  schemaVersion: number
  /** Factory for a fresh, valid default payload (en). */
  defaultData: () => T
  /** Validate RESOLVED block data; never throws. */
  validate: (data: unknown) => BlockValidationResult
}

/* ------------------------------------------------------------------ */
/* Small shared validation primitives                                  */
/* ------------------------------------------------------------------ */

export const isStr = (v: unknown): v is string => typeof v === "string"

export const isNonEmptyStr = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

export const ok = (errors: string[]): BlockValidationResult => ({
  valid: errors.length === 0,
  errors,
})
