/* ------------------------------------------------------------------ */
/* Generated-validator interpreter (Phase 4B, ARCH-CORE §4).            */
/*                                                                     */
/* HAND-WRITTEN and reviewed. Executes the declarative validation      */
/* specs emitted by `packages/cms-contract/src/generate.ts` into        */
/* `contract.gen.ts`. The check vocabulary is deliberately tiny: it     */
/* reproduces EXACTLY the semantics (and message strings) of the 12     */
/* hand-written registry validators — no more, no less — so shadow      */
/* mode can prove equivalence before any cutover.                       */
/*                                                                     */
/* The `container` validator is NOT part of this system: its            */
/* deliberate permissiveness (any object with a string `widget_type`    */
/* passes) is a forward-compatibility guarantee, not a schema           */
/* artifact, and stays hand-written (see ./index.ts).                   */
/* ------------------------------------------------------------------ */

import {
  isNonEmptyStr,
  isObj,
  isStr,
  ok,
  type BlockValidationResult,
} from "../types"

/**
 * One declarative check on one field. `hint` carries the exact message
 * suffix INCLUDING its leading space (e.g. " (media URL)") so generated
 * messages are byte-identical to the hand-written ones.
 */
export type FieldCheck =
  /** required non-empty string → "<path> is required<hint>" (non-blocking downstream). */
  | { kind: "reqStr"; name: string; hint?: string }
  /** optional string: only type-checked when present → "must be a string<hint>". */
  | { kind: "optStr"; name: string; hint?: string }
  /** unconditional isStr check (blocks even when the key is absent) — matches
   *  the hand-written validators that call isStr() without an undefined guard. */
  | { kind: "alwaysStr"; name: string }
  | { kind: "optBool"; name: string }
  | { kind: "optNonNegNum"; name: string }
  /** enum checked unconditionally (missing/non-string also errors). */
  | { kind: "reqEnum"; name: string; values: string[]; msgTail?: string }
  /** enum checked only when the key is present. */
  | { kind: "optEnum"; name: string; values: string[]; msgTail?: string }
  /** required ISO-8601 datetime chain (deal_of_day.countdown_to). */
  | { kind: "isoDate"; name: string }
  /** nested object group. required=true uses the "<path> is required"
   *  phrasing on any non-object (hand-written cta semantics). */
  | { kind: "group"; name: string; required: boolean; fields: FieldCheck[] }
  /** repeater. stop=true aborts the whole validation after
   *  "must be an array" (the hand-written early-return). */
  | { kind: "array"; name: string; stop: boolean; item: { fields: FieldCheck[] } }
  /** conditionally-required string (product_tabs bindings). */
  | { kind: "condReqStr"; name: string; whenField: string; whenEq: string }
  /** conditionally-required array of non-empty strings (product_ids). */
  | { kind: "condStrArray"; name: string; whenField: string; whenEq: string }

export interface BlockSpec {
  type: string
  fields: FieldCheck[]
}

const enumMsg = (
  t: string,
  path: string,
  c: { values: string[]; msgTail?: string }
): string =>
  `${t}: ${path} ${c.msgTail ?? `must be one of ${c.values.join(", ")}`}`

/**
 * Run one level of checks. Returns true when validation must ABORT
 * entirely (an `array` check with stop=true failed) — mirroring the
 * hand-written validators' `return ok(errors)` early exits.
 */
function runChecks(
  t: string,
  checks: FieldCheck[],
  obj: Record<string, unknown>,
  prefix: string,
  errors: string[]
): boolean {
  for (const c of checks) {
    const path = prefix ? `${prefix}.${c.name}` : c.name
    const v = obj[c.name]
    switch (c.kind) {
      case "reqStr":
        if (!isNonEmptyStr(v)) {
          errors.push(`${t}: ${path} is required${c.hint ?? ""}`)
        }
        break
      case "optStr":
        if (v !== undefined && !isStr(v)) {
          errors.push(`${t}: ${path} must be a string${c.hint ?? ""}`)
        }
        break
      case "alwaysStr":
        if (!isStr(v)) {
          errors.push(`${t}: ${path} must be a string`)
        }
        break
      case "optBool":
        if (v !== undefined && typeof v !== "boolean") {
          errors.push(`${t}: ${path} must be a boolean`)
        }
        break
      case "optNonNegNum":
        if (
          v !== undefined &&
          (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        ) {
          errors.push(`${t}: ${path} must be a non-negative number`)
        }
        break
      case "reqEnum":
        if (!isStr(v) || !c.values.includes(v)) {
          errors.push(enumMsg(t, path, c))
        }
        break
      case "optEnum":
        if (
          v !== undefined &&
          !(typeof v === "string" && c.values.includes(v))
        ) {
          errors.push(enumMsg(t, path, c))
        }
        break
      case "isoDate":
        if (!isNonEmptyStr(v)) {
          errors.push(`${t}: ${path} is required (ISO date string)`)
        } else if (Number.isNaN(Date.parse(v))) {
          errors.push(`${t}: ${path} must be a valid ISO date string`)
        }
        break
      case "group":
        if (c.required) {
          if (!isObj(v)) {
            errors.push(`${t}: ${path} is required`)
          } else if (runChecks(t, c.fields, v, path, errors)) {
            return true
          }
        } else if (v !== undefined) {
          if (!isObj(v)) {
            errors.push(`${t}: ${path} must be an object`)
          } else if (runChecks(t, c.fields, v, path, errors)) {
            return true
          }
        }
        break
      case "array":
        if (!Array.isArray(v)) {
          errors.push(`${t}: ${path} must be an array`)
          if (c.stop) {
            return true
          }
        } else {
          for (let i = 0; i < v.length; i++) {
            const item = v[i]
            const ip = `${path}[${i}]`
            if (!isObj(item)) {
              errors.push(`${t}: ${ip} must be an object`)
              continue
            }
            runChecks(t, c.item.fields, item, ip, errors)
          }
        }
        break
      case "condReqStr":
        if (obj[c.whenField] === c.whenEq && !isNonEmptyStr(v)) {
          errors.push(
            `${t}: ${path} is required when ${c.whenField} is "${c.whenEq}"`
          )
        }
        break
      case "condStrArray":
        if (obj[c.whenField] === c.whenEq) {
          if (!Array.isArray(v)) {
            errors.push(
              `${t}: ${path} must be an array when ${c.whenField} is "${c.whenEq}"`
            )
          } else if (!v.every((x) => isNonEmptyStr(x))) {
            errors.push(`${t}: ${path} must contain only non-empty strings`)
          }
        }
        break
    }
  }
  return false
}

/** Validate `data` against a generated block spec. Pure; never throws. */
export function validateWithSpec(
  spec: BlockSpec,
  data: unknown
): BlockValidationResult {
  if (!isObj(data)) {
    return ok([`${spec.type}: data must be an object`])
  }
  const errors: string[] = []
  runChecks(spec.type, spec.fields, data, "", errors)
  return ok(errors)
}
