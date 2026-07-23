/* ------------------------------------------------------------------ */
/* normalizeDocument — Phase 1 universal normalization (ARCH-CORE §1.2) */
/*                                                                      */
/* One node tree everywhere: document → section(container) → column →   */
/* widget. This module makes that true at edit time: every FLAT themed  */
/* commerce section is wrapped into a flush single-column container     */
/* carrying the block as its sole widget. The collapse rule in          */
/* theme-runtime (flush + 1 column + 1 commerce widget renders exactly  */
/* as the flat section did) makes the wrapped form render-identical, so */
/* the merchant never perceives normalization happening.                */
/*                                                                      */
/* WHERE IT RUNS: the editor shell's load path, after /api/puck/load    */
/* resolves the section list and BEFORE the first history baseline      */
/* (seat 1C wires it). Never on the server, never at render, never as a */
/* batch migration. Stores that never re-edit keep their flat v1        */
/* snapshots forever — flat v1 is a permanently supported render input. */
/*                                                                      */
/* THE RULES, exactly as implemented:                                   */
/*   1. `container` sections pass through untouched except that missing */
/*      node ids are stamped (section, columns, widgets, and the        */
/*      columns/widgets of `inner_section` widgets, recursively).       */
/*   2. A flat section whose block_type is one of the 12 themed         */
/*      commerce blocks (COMMERCE_WIDGET_TYPES) is wrapped:             */
/*        { block_type:"container", id, layout:"1", flush:true,         */
/*          gap:{value:0,unit:"px"},                                    */
/*          columns:[{ id, widgets:[{ id, widget_type, ...content }]}], */
/*          style?, advanced?, elementStyles? }                         */
/*      The three style bags STAY AT SECTION LEVEL on the wrapper.      */
/*      This matters: buildSectionCss scopes to `.cms-sec-sec-<i>` and  */
/*      element rules to `.cms-sec-sec-<i> [data-el=…]`; the widget's   */
/*      theme markup still sits inside that scope div, so the emitted   */
/*      CSS is byte-identical to the flat form. No style migration.     */
/*   3. Any OTHER block_type (unknown, future, malformed) passes        */
/*      through completely untouched — not even id stamping. Wrapping   */
/*      an unknown type would hand it to the container renderer, which  */
/*      has no collapse rule for it, and change published output —      */
/*      violating standing invariant 1 (published pages never break).   */
/*                                                                      */
/* PURE: the input array and every object in it are never mutated.      */
/* IDEMPOTENT: normalize(normalize(x).content) returns the same section */
/* references with changed === false. Sections the pass does not touch  */
/* keep their original references (cheap equality for React).           */
/*                                                                      */
/* Facade marking: the wrapper carries NO extra persisted marker.       */
/* `flush: true` + the 1-column/1-commerce-widget shape IS the facade   */
/* signal, derived by facade.ts (ARCH-CORE §1.4) — persisting a         */
/* separate flag would pollute the publish shape and add a second       */
/* source of truth that could drift from the structure.                 */
/*                                                                      */
/* `data.root.schemaVersion = 2` stamping is the SHELL's job (seat 1C): */
/* this module only sees the `content` array. Idempotency here is       */
/* structural, not version-gated, so it is safe to run unconditionally. */
/* ------------------------------------------------------------------ */

import { isCommerceWidget } from "../schema/widgets"

/* ----------------------------- shapes ----------------------------- */
/* The editor keeps page content loosely typed; these are the same      */
/* structural narrows the shell and NavigatorTree use. Deliberately not */
/* imported from editor files — the document module must stay free of   */
/* "use client" dependency edges.                                       */

export type SectionNode = { block_type: string; [k: string]: unknown }
export type WidgetNode = { widget_type: string; [k: string]: unknown }
export type ColumnNode = { id?: unknown; widgets?: unknown; [k: string]: unknown }

export interface NormalizeResult {
  content: SectionNode[]
  /** true when the output differs structurally from the input (a section
   *  was wrapped or a missing node id was stamped). Persisting remains
   *  gated on merchant edits (persist-only-on-edit, seat 1C) — `changed`
   *  alone must never set the dirty flag. */
  changed: boolean
}

/* --------------------------- meta keys ----------------------------- */
/* Everything EXCEPT these keys is a block's content and moves onto the  */
/* wrapped widget. Matches ARCH-CORE §1.2 contentPropsOf plus the two    */
/* render-derived aliases the codebase already treats as meta:           */
/*   - `type`         (stripMeta in theme-runtime/build-context.ts)      */
/*   - `sectionScope` (META in liquid-canvas.tsx / TemplateLibrary.tsx — */
/*     always derived per render as "sec-<idx>", never authored)         */
/* The style bags are NOT dropped — they are re-attached at wrapper      */
/* (section) level so the emitted CSS scope is unchanged.                */

const SECTION_META_KEYS = new Set([
  "block_type",
  "style",
  "advanced",
  "elementStyles",
  "id",
  "schema_version",
  "type",
  "sectionScope",
])

/* ----------------------------- node ids ---------------------------- */

/** Short random node id (Elementor's generate_random_string precedent).
 *  Ids exist for history, future collaboration, and stable style keys —
 *  DOM addressing stays positional (data-cms-idx / data-col / data-w). */
export function nid(): string {
  let s = ""
  while (s.length < 8) {
    s += Math.random().toString(36).slice(2)
  }
  return s.slice(0, 8)
}

const hasId = (o: Record<string, unknown>): boolean =>
  typeof o.id === "string" && o.id.length > 0

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/* ------------------------- id stamping (containers) ------------------ */

/** Stamp missing ids on a widget (and, for `inner_section`, recursively on
 *  its columns/widgets). Returns the SAME reference when nothing was added. */
function stampWidget(w: unknown): { node: unknown; changed: boolean } {
  if (!isObj(w)) {
    return { node: w, changed: false }
  }
  let changed = false
  let next = w
  if (!hasId(w)) {
    next = { ...w, id: nid() }
    changed = true
  }
  if (w.widget_type === "inner_section" && Array.isArray(w.columns)) {
    const cols = stampColumns(w.columns)
    if (cols.changed) {
      next = { ...(next as Record<string, unknown>), columns: cols.nodes }
      changed = true
    }
  }
  return { node: next, changed }
}

/** Stamp missing ids on a columns array. Same-reference when unchanged. */
function stampColumns(cols: unknown[]): { nodes: unknown[]; changed: boolean } {
  let changed = false
  const nodes = cols.map((c) => {
    if (!isObj(c)) {
      return c
    }
    let nextCol = c
    if (!hasId(c)) {
      nextCol = { ...c, id: nid() }
      changed = true
    }
    if (Array.isArray(c.widgets)) {
      let widgetsChanged = false
      const widgets = c.widgets.map((w) => {
        const r = stampWidget(w)
        widgetsChanged = widgetsChanged || r.changed
        return r.node
      })
      if (widgetsChanged) {
        nextCol = { ...(nextCol as Record<string, unknown>), widgets }
        changed = true
      }
    }
    return nextCol
  })
  return { nodes: changed ? nodes : cols, changed }
}

/** An existing container passes through untouched except missing-id stamps. */
function stampContainer(s: SectionNode): { node: SectionNode; changed: boolean } {
  let changed = false
  let next = s
  if (!hasId(s)) {
    next = { ...s, id: nid() }
    changed = true
  }
  if (Array.isArray(s.columns)) {
    const cols = stampColumns(s.columns)
    if (cols.changed) {
      next = { ...next, columns: cols.nodes }
      changed = true
    }
  }
  return { node: next, changed }
}

/* ------------------------------ wrapping ---------------------------- */

/** Wrap a flat themed commerce section into its flush container form. */
function wrapFlatSection(s: SectionNode): SectionNode {
  const content: Record<string, unknown> = {}
  for (const k of Object.keys(s)) {
    if (!SECTION_META_KEYS.has(k)) {
      content[k] = s[k]
    }
  }

  const wrapper: SectionNode = {
    block_type: "container",
    // The wrapper IS the section, positionally — keep its pre-existing id
    // when it has one (stability for history/style keys), mint otherwise.
    id: hasId(s) ? (s.id as string) : nid(),
    layout: "1",
    flush: true,
    gap: { value: 0, unit: "px" },
    columns: [
      {
        id: nid(),
        widgets: [{ id: nid(), widget_type: s.block_type, ...content }],
      },
    ],
  }

  // All three style bags stay at SECTION level on the wrapper so
  // buildSectionCss emits byte-identical CSS under the same scope.
  if (s.style !== undefined) {
    wrapper.style = s.style
  }
  if (s.advanced !== undefined) {
    wrapper.advanced = s.advanced
  }
  if (s.elementStyles !== undefined) {
    wrapper.elementStyles = s.elementStyles
  }
  return wrapper
}

/* ------------------------------- main ------------------------------- */

/**
 * Pure, idempotent normalization of a page's `content` array.
 *
 * - container sections: pass through, missing node ids stamped
 * - flat themed commerce sections: wrapped flush (render-identical via
 *   the engine collapse rule)
 * - anything else: passed through byte-untouched
 *
 * Untouched sections keep their input references; `changed` is false
 * exactly when every section kept its reference.
 */
export function normalizeDocument(content: SectionNode[]): NormalizeResult {
  if (!Array.isArray(content)) {
    return { content: [], changed: false }
  }

  let changed = false
  const next = content.map((s) => {
    if (!isObj(s) || typeof s.block_type !== "string") {
      // Malformed entry — never invent structure around it.
      return s
    }
    if (s.block_type === "container") {
      const r = stampContainer(s as SectionNode)
      changed = changed || r.changed
      return r.node
    }
    if (isCommerceWidget(s.block_type)) {
      changed = true
      return wrapFlatSection(s as SectionNode)
    }
    // Unknown / future / chrome-ish block types: conservative passthrough.
    return s
  }) as SectionNode[]

  return { content: changed ? next : content, changed }
}
