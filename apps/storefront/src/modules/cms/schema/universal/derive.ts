/* ------------------------------------------------------------------ */
/* Field-set derivation helpers (Phase 3 seat 3D — ARCH-UX §1.2)        */
/*                                                                     */
/* Generalizes the pick()+retarget() pattern seat 2E shipped inside     */
/* column.ts: every restricted node contract SELECTS its fields from    */
/* the universal lists (UNIVERSAL_STYLE / UNIVERSAL_ADVANCED) and only  */
/* re-words the merchant-facing copy — the control definition (type,    */
/* units, ranges, responsive flag) is never re-authored, so a tweak to  */
/* the universal control flows into every node's panel automatically.   */
/*                                                                     */
/* column.ts predates this file and keeps its own local copies (it is   */
/* shipped and byte-verified; not worth churning). New contracts        */
/* (element / chrome / inner-section) derive through here.              */
/* ------------------------------------------------------------------ */

import type { FieldDef } from "../types"

/**
 * Re-target a shared field's merchant-facing copy at another node noun.
 * The universal lists speak of "the section"; a themed leaf's panel must say
 * "the element", a chrome bar's "the bar", and so on — same rule 2E applied
 * for columns. Only `label` and `help` change; everything else is untouched.
 */
export function retargetField(f: FieldDef, noun: string): FieldDef {
  const cap = noun.charAt(0).toUpperCase() + noun.slice(1)
  const swap = (s: string) => s.replace(/section/g, noun).replace(/Section/g, cap)
  return {
    ...f,
    label: swap(f.label),
    ...(f.help !== undefined ? { help: swap(f.help) } : {}),
  }
}

/**
 * Select fields (by `name`, order preserved from `keys`) out of a universal
 * list, optionally re-targeting their copy at `noun`. Unknown keys are
 * silently skipped, so a renamed universal field can never crash a panel —
 * it just drops out of the derived set until the key list is updated.
 */
export function pickFields(
  source: FieldDef[],
  keys: readonly string[],
  noun?: string
): FieldDef[] {
  const picked = keys
    .map((k) => source.find((f) => f.name === k))
    .filter((f): f is FieldDef => !!f)
  return noun ? picked.map((f) => retargetField(f, noun)) : picked
}
