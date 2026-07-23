/* ------------------------------------------------------------------ */
/* Command registry (Phase 2A — ARCH-CANVAS §3.2/§3.3, executor side).  */
/*                                                                      */
/* Every document mutation the editor can perform is a named            */
/* `domain.verb` command. The bodies below are the shell's EXISTING     */
/* mutators re-homed as pure functions over (state, args) — a           */
/* re-homing, not a rewrite (ARCH-CANVAS P3: "mutation BODIES are       */
/* unchanged so document corruption risk is nil"). The shell's          */
/* executor (./executor.ts) is the only caller.                         */
/*                                                                      */
/* Command contract:                                                    */
/*   run(state, args)    → RunResult | null   (null = guarded no-op;    */
/*                          nothing applied, nothing recorded)          */
/*   invert(state, args) → Command             computed against the     */
/*                          PRE-run state; running it undoes run. For   */
/*                          multi-section/unbounded commands (ai.apply  */
/*                          patch lists) the inverse is the snapshot    */
/*                          marker `doc.replace` carrying the before    */
/*                          document — ARCH-CANVAS §3.3's section-      */
/*                          granularity capture, degraded to a full     */
/*                          snapshot only where a targeted inverse      */
/*                          cannot be exact.                            */
/*   label(args, state)  → history-entry label ("Delete Hero Slider")   */
/*   coalesceKey(args)   → same key within the coalescing window        */
/*                          merges into one entry (typing); absent =    */
/*                          never coalesces (structural commands).      */
/*   touches(args)       → top-level section index for a targeted       */
/*                          canvas patch; null = full sync. Mirrors     */
/*                          commit()'s patch-vs-full rule.              */
/*                                                                      */
/* Phase-1 interplay (do not regress):                                  */
/*   - The facade flush-clear lives in writeWidgetsAt below, VERBATIM   */
/*     from the shell (1V finding F1): structural top-level writes      */
/*     only. Every widget.* command routes through it.                  */
/*   - Undo of a structural facade write restores `flush` because       */
/*     structural widget commands invert via section.setProps with the  */
/*     complete before-section (a widget.remove inverse would not       */
/*     bring the flag back).                                            */
/*   - doc.normalize exists as a command but the LOAD path still calls  */
/*     normalizeDocument directly, outside history (baseline rule).     */
/* ------------------------------------------------------------------ */

import {
  getBlockSchema,
  getWidgetSchema,
  defaultPropsFromSchema,
} from "../../schema"
import { normalizeDocument } from "../../document/normalize"
import { flushSingleCommerceWidget, facadeOf } from "../../document/facade"
import { deepMergeBag } from "../clipboard"
import {
  newWidgetOf,
  reconcileColumns,
  type Column,
  type Widget,
} from "../ContainerColumnsEditor"
import type { ElementStyles } from "../../render/style-engine"
/* --- 5B stage: slider.* command bodies (pure ops + host walker) ------ */
import {
  findLayer,
  findSlide,
  layerAdd,
  layerDuplicate,
  layerRemove,
  layerReorder,
  layerSetAnim,
  layerSetBags,
  layerSetFrame,
  layerSetProps,
  readSliderHost,
  slideAdd,
  slideDuplicate,
  slideRemove,
  slideReorder,
  slideSetBackground,
  slideSetProps,
  upgradeSlides,
} from "../slider/stage-commands"
import { layerDisplayName, type SliderPlacement } from "../slider/model-5a"

/* ------------------------------- types ------------------------------ */

export type Section = { block_type: string; [k: string]: unknown }
export type ChromeMap = Record<string, Record<string, unknown>>
/** The document as the executor sees it: page content + chrome regions. */
export type EditorState = { content: Section[]; chrome: ChromeMap }

export type CommandName =
  | "doc.replace"
  | "doc.removeRange"
  | "doc.normalize"
  | "section.insert"
  | "section.insertRaw"
  | "section.remove"
  | "section.duplicate"
  | "section.move"
  | "section.setProps"
  | "section.setBags"
  | "container.insert"
  | "container.setLayout"
  | "widget.insert"
  | "widget.insertWrapped"
  | "widget.remove"
  | "widget.duplicate"
  | "widget.paste"
  | "widget.move"
  | "widget.transfer"
  | "widget.setProps"
  | "widget.setBags"
  | "column.setBags"
  | "element.setBags"
  | "item.duplicate"
  | "item.remove"
  | "template.insert"
  | "ai.apply"
  | "chrome.setProps"
  | "chrome.setBags"
  | "chromeElement.setBags"
  /* --- 5B stage: the slider.* family (ARCH-SLIDER §3.3). All content-
     scope, all id-targeted (never slide/layer indexes — reorders can
     never invalidate a queued command), all touching one section.
     enterStage/exitStage are MODE, not history, and are deliberately
     not commands. --- */
  | "slider.addSlide"
  | "slider.duplicateSlide"
  | "slider.removeSlide"
  | "slider.reorderSlides"
  | "slider.setSlideBackground"
  | "slider.setSlideProps"
  | "slider.addLayer"
  | "slider.removeLayer"
  | "slider.duplicateLayer"
  | "slider.reorderLayers"
  | "slider.setLayerFrame"
  | "slider.setLayerProps"
  | "slider.setLayerStyle"
  | "slider.setLayerAnim"
  | "slider.upgradeSlide"
  /* --- 6B (ARCH-CORE P5): merchant-invoked, explicit conversion of a
     rich_text / image_with_text themed section into a real container of
     platform widgets. Never automatic. --- */
  | "section.convertToWidgets"

/** One dispatched command. `label` overrides the registry label (used by
 *  style clipboard actions so "Paste Style" reads right in history);
 *  `txn` groups dispatches into one history entry (ARCH-CANVAS §3.3). */
export type Command = {
  name: CommandName
  args: Record<string, unknown>
  label?: string
  txn?: string
}

export type RunResult = {
  content?: Section[]
  chrome?: { region: string; data: Record<string, unknown> }[]
}

export type CommandImpl = {
  scope: "content" | "chrome"
  label: (args: any, state?: EditorState) => string
  coalesceKey?: (args: any) => string
  touches?: (args: any) => number | null
  run: (state: EditorState, args: any) => RunResult | null
  invert: (state: EditorState, args: any) => Command
}

/** Bag-diff writes: undefined leaves a bag untouched; {} deletes the key
 *  (diff-only storage — an un-styled node stays byte-identical to a
 *  never-styled one). Same semantics as the shell writers they replace. */
export type Bags = {
  style?: Record<string, unknown>
  advanced?: Record<string, unknown>
  elementStyles?: Record<string, unknown>
}

/* ------------------------- shared pure helpers ---------------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const clampAt = (at: number, len: number) => Math.max(0, Math.min(at, len))

/* --- widget.transfer helpers (3A) ----------------------------------- */

/** One end of a widget.transfer: the column a widget sits in + its slot. */
export type WidgetSource = { index: number; colPath: number[]; wi: number }

const isNums = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 0)

const numsEq = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i])

const asWidgetSource = (v: unknown): WidgetSource | null => {
  const s = v as WidgetSource | null
  return s &&
    typeof s === "object" &&
    typeof s.index === "number" &&
    isNums(s.colPath) &&
    s.colPath.length % 2 === 1 &&
    typeof s.wi === "number" &&
    s.wi >= 0
    ? { index: s.index, colPath: s.colPath, wi: s.wi }
    : null
}

/** Validated {from, to} of a widget.transfer, or null (guarded no-op). */
function transferEnds(
  args: any
): { from: WidgetSource; to: WidgetSource } | null {
  const from = asWidgetSource(args?.from)
  const to = asWidgetSource(args?.to)
  return from && to ? { from, to } : null
}

/** After removing (from.colPath, from.wi), a destination column path in
 *  the SAME section that threads through the source column at a widget
 *  index past from.wi points one slot too far — shift it back. (Equal
 *  indices are the self-descendant case, guarded before removal.) */
function adjustColPathAfterRemoval(
  from: WidgetSource,
  toColPath: number[]
): number[] {
  if (toColPath.length <= from.colPath.length) return toColPath
  if (!from.colPath.every((n, i) => toColPath[i] === n)) return toColPath
  const wIdx = toColPath[from.colPath.length]
  if (wIdx > from.wi) {
    const next = [...toColPath]
    next[from.colPath.length] = wIdx - 1
    return next
  }
  return toColPath
}

function titleize(s: string): string {
  return String(s || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function typeLabel(type: string): string {
  return (
    getWidgetSchema(type)?.label ?? getBlockSchema(type)?.label ?? titleize(type)
  )
}

function sectionLabel(state: EditorState | undefined, index: number): string {
  const sec = state?.content?.[index]
  if (!sec) return "Section"
  return facadeOf(sec as any).label
}

function widgetLabel(
  state: EditorState | undefined,
  index: number,
  path: number[]
): string {
  if (!state || !Array.isArray(path)) return "Widget"
  const ws = widgetsAtPath(state.content, index, path.slice(0, -1))
  const w = ws?.[path[path.length - 1]]
  return w ? typeLabel(String(w.widget_type)) : "Widget"
}

/** 5B: history label for a slider-layer command ("Delete Title"). */
function sliderLayerLabel(state: EditorState | undefined, a: any): string {
  if (!state) return "Layer"
  const host = readSliderHost(state.content, a?.index as number)
  const layer = findLayer(findSlide(host, String(a?.slideId)), String(a?.layerId))
  return layer ? layerDisplayName(layer) : "Layer"
}

/** The widgets array living at a column path, or null. (Shell body, pure.)
 *  A COLUMN path is odd-length ([0] or [0,1,2]); a WIDGET path is even. */
export function widgetsAtPath(
  content: Section[],
  index: number,
  colPath: number[]
): any[] | null {
  const sec: any = content?.[index]
  if (!sec || !Array.isArray(colPath) || colPath.length % 2 !== 1) return null
  let cols: any = sec.columns
  for (let i = 0; i < colPath.length; i++) {
    if (!Array.isArray(cols)) return null
    const col = cols[colPath[i]]
    if (!col) return null
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    if (i === colPath.length - 1) return ws
    // Descend through the inner-section widget named by the next index.
    const w = ws[colPath[++i]]
    if (!w || w.widget_type !== "inner_section") return null
    cols = w.columns
  }
  return null
}

/**
 * Immutably write a widgets array back to a column path. (Shell
 * writeWidgetsAtPath body, verbatim — INCLUDING the Phase-1 facade rule:
 * un-collapse on STRUCTURAL write only, 1V finding F1. A facade wrapper
 * carries flush:true; composing into it (widget COUNT of its top-level
 * column changes) makes it a REAL container, so the marker drops. A
 * CONTENT write (same count) keeps the collapse. Nested colPath writes
 * never touch it.)
 */
export function writeWidgetsAt(
  content: Section[],
  index: number,
  colPath: number[],
  widgets: any[]
): Section[] | null {
  const sec: any = content[index]
  if (!sec || !Array.isArray(sec.columns)) return null

  // Rebuild the chain from the leaf up: replace `widgets` at the target
  // column, then rewrap each ancestor inner section on the way out.
  const rebuild = (cols: any[], depth: number): any[] | null => {
    const ci = colPath[depth]
    if (!Array.isArray(cols) || !cols[ci]) return null
    if (depth === colPath.length - 1) {
      return cols.map((cl: any, i: number) =>
        i === ci ? { ...cl, widgets } : cl
      )
    }
    const wi = colPath[depth + 1]
    const col = cols[ci]
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    const inner = ws[wi]
    if (!inner || inner.widget_type !== "inner_section") return null
    const innerCols = rebuild(inner.columns ?? [], depth + 2)
    if (!innerCols) return null
    return cols.map((cl: any, i: number) =>
      i === ci
        ? {
            ...cl,
            widgets: ws.map((w: any, j: number) =>
              j === wi ? { ...inner, columns: innerCols } : w
            ),
          }
        : cl
    )
  }

  const nextCols = rebuild(sec.columns as any[], 0)
  if (!nextCols) return null
  const prevCount = Array.isArray(sec.columns?.[colPath[0]]?.widgets)
    ? sec.columns[colPath[0]].widgets.length
    : -1
  const structural =
    sec.flush === true && colPath.length === 1 && widgets.length !== prevCount
  const { flush: _flush, ...secRest } = sec
  const nextSec = structural
    ? ({ ...secRest, columns: nextCols } as Section)
    : ({ ...sec, columns: nextCols } as Section)
  return content.map((b, i) => (i === index ? nextSec : b))
}

/** The column object at an odd-length col path, or null. (2E: the column
 *  addressing twin of widgetsAtPath — [0] is a top-level column, [0,1,2]
 *  descends through the inner-section widget at column 0 / index 1.) */
export function columnAtPath(
  content: Section[],
  index: number,
  colPath: number[]
): Record<string, unknown> | null {
  const sec: any = content?.[index]
  if (!sec || !Array.isArray(colPath) || colPath.length % 2 !== 1) return null
  let cols: any[] = Array.isArray(sec.columns) ? sec.columns : []
  for (let d = 0; ; d += 2) {
    const col = cols[colPath[d]]
    if (!isObj(col)) return null
    if (d === colPath.length - 1) return col
    const ws = Array.isArray((col as any).widgets) ? (col as any).widgets : []
    const inner = ws[colPath[d + 1]]
    if (!inner || inner.widget_type !== "inner_section") return null
    cols = Array.isArray(inner.columns) ? inner.columns : []
  }
}

/**
 * Immutably replace the column object at an odd-length col path. (2E.)
 * NON-STRUCTURAL by definition: column-bag writes are content-class, so
 * `flush` is never read or cleared here — this deliberately does NOT ride
 * writeWidgetsAt, whose F1 rule is about widget-COUNT changes and does not
 * apply. (Editor-authored facades never receive column bags at all — the
 * facade routing sends those to the SECTION bags — but templates/AI may
 * dispatch this on any shape, and it must stay flush-neutral.)
 */
function writeColumnAt(
  content: Section[],
  index: number,
  colPath: number[],
  nextCol: Record<string, unknown>
): Section[] | null {
  const sec: any = content[index]
  if (!sec || !Array.isArray(sec.columns)) return null
  const rebuild = (cols: any[], depth: number): any[] | null => {
    const ci = colPath[depth]
    if (!Array.isArray(cols) || !cols[ci]) return null
    if (depth === colPath.length - 1) {
      return cols.map((cl: any, i: number) => (i === ci ? nextCol : cl))
    }
    const wi = colPath[depth + 1]
    const col = cols[ci]
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    const inner = ws[wi]
    if (!inner || inner.widget_type !== "inner_section") return null
    const innerCols = rebuild(inner.columns ?? [], depth + 2)
    if (!innerCols) return null
    return cols.map((cl: any, i: number) =>
      i === ci
        ? {
            ...cl,
            widgets: ws.map((w: any, j: number) =>
              j === wi ? { ...inner, columns: innerCols } : w
            ),
          }
        : cl
    )
  }
  const nextCols = rebuild(sec.columns as any[], 0)
  if (!nextCols) return null
  return content.map((b, i) =>
    i === index ? ({ ...sec, columns: nextCols } as Section) : b
  )
}

/** Container layout change: grow/shrink `columns` to match the new count,
 *  preserving widgets (shell body, verbatim). */
export function reconcileContainerProps(
  next: Record<string, unknown>
): Record<string, unknown> {
  const desired = parseInt(String(next.layout ?? ""), 10)
  if (!Number.isInteger(desired) || desired < 1 || desired > 4) return next
  const cols = Array.isArray(next.columns) ? (next.columns as Column[]) : []
  const reconciled = reconcileColumns(cols, desired)
  return reconciled === cols ? next : { ...next, columns: reconciled }
}

/** Apply a bag diff to a plain record host (section or widget). */
function withBags<T extends Record<string, unknown>>(
  host: T,
  bags: Bags,
  keys: readonly ("style" | "advanced" | "elementStyles")[]
): T {
  const updated: Record<string, unknown> = { ...host }
  for (const k of keys) {
    const v = bags[k]
    if (v === undefined) continue
    if (v && Object.keys(v).length > 0) updated[k] = v
    else delete updated[k]
  }
  return updated as T
}

/** The current value of each bag key present in `bags`, for exact undo:
 *  a key the command sets is restored to its prior value ({} = it did not
 *  exist, which deletes it again). */
function beforeBags<T extends Record<string, unknown>>(
  host: T,
  bags: Bags,
  keys: readonly ("style" | "advanced" | "elementStyles")[]
): Bags {
  const out: Bags = {}
  for (const k of keys) {
    if (bags[k] === undefined) continue
    out[k] = (host[k] as Record<string, unknown> | undefined) ?? {}
  }
  return out
}

/** Element-bag write (shell writeElementBags body, pure). */
function sectionWithElementBags(
  section: Section,
  key: string,
  bags: Bags
): Section {
  const prevEs = (section.elementStyles as ElementStyles | undefined) ?? {}
  const entry: Record<string, unknown> = { ...(prevEs[key] ?? {}) }
  for (const k of ["style", "advanced"] as const) {
    const v = bags[k]
    if (v === undefined) continue
    if (v && Object.keys(v).length > 0) entry[k] = v
    else delete entry[k]
  }
  const nextEs: ElementStyles = { ...prevEs }
  if (Object.keys(entry).length > 0) nextEs[key] = entry
  else delete nextEs[key]
  const updated: Record<string, unknown> = { ...(section as any) }
  if (Object.keys(nextEs).length > 0) updated.elementStyles = nextEs
  else delete updated.elementStyles
  return updated as Section
}

/** Chrome element-bag write (shell writeChromeElementBags body, pure). */
function chromeRegionWithElementBags(
  regionData: Record<string, unknown>,
  key: string,
  bags: Bags
): Record<string, unknown> {
  const prevEs = (regionData.elementStyles as ElementStyles | undefined) ?? {}
  const entry: Record<string, unknown> = { ...(prevEs[key] ?? {}) }
  for (const k of ["style", "advanced"] as const) {
    const v = bags[k]
    if (v === undefined) continue
    if (v && Object.keys(v).length > 0) entry[k] = v
    else delete entry[k]
  }
  const nextEs: ElementStyles = { ...prevEs }
  if (Object.keys(entry).length > 0) nextEs[key] = entry
  else delete nextEs[key]
  const updated: Record<string, unknown> = { ...regionData }
  if (Object.keys(nextEs).length > 0) updated.elementStyles = nextEs
  else delete updated.elementStyles
  return updated
}

/** Build the block a fresh section insert produces (shell insertSectionAt
 *  body: schema defaults or preset, commerce blocks wrapped as a facade —
 *  Phase 1's exact flush shape, so a fresh commerce section collapses on
 *  publish like every normalized one). */
export function buildInsertSection(
  type: string,
  presetIndex?: number
): { block: Section; isContainer: boolean } | null {
  const schema = getBlockSchema(type)
  if (!schema) return null
  const props =
    presetIndex != null && schema.presets?.[presetIndex]
      ? structuredClone(schema.presets[presetIndex].props)
      : defaultPropsFromSchema(schema)
  const isContainer = type === "container"
  const block = (
    isContainer
      ? { block_type: type, ...props }
      : reconcileContainerProps({
          block_type: "container",
          layout: "1",
          flush: true,
          gap: { value: 0, unit: "px" },
          columns: [{ widgets: [{ widget_type: type, ...props }] }],
        } as any)
  ) as Section
  return { block, isContainer }
}

/* --- 6B: "Convert to widgets" (ARCH-CORE P5) ------------------------- */

/** The two themed section types the explicit merchant-invoked conversion
 *  supports. Also gates the canvas toolbar entry (OverlayLayer) — one
 *  set, both sides. */
export const CONVERTIBLE_SECTION_TYPES: ReadonlySet<string> = new Set([
  "rich_text",
  "image_with_text",
])

/** Minimal HTML escape for plain-text fields becoming rich-text widget
 *  content (the slider upgrade's escaper, same contract). */
function escapePlain(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Plain text with \n preserved as <br> (the textarea fields contract —
 *  the upgradeFieldsSlide precedent). */
function plainToHtml(s: string): string {
  return escapePlain(s).replace(/\r?\n/g, "<br>")
}

/**
 * Transform a rich_text / image_with_text themed section into a REAL
 * container section holding equivalent platform widgets. Pure and
 * deterministic: every minted node id derives from the dispatch-time
 * `idSeed`, so redo replays byte-identically (the slider family's
 * dispatch-time-id precedent). Returns null for any shape it does not
 * bless (guarded no-op — nothing applied, nothing recorded).
 *
 * ACCEPTED SHAPES (the facade ruling):
 *  - the NORMALIZED facade wrapper — the normal edit-time shape — read
 *    THROUGH the one shared predicate (flushSingleCommerceWidget):
 *    conversion happens "from the facade", using the inner widget's
 *    content fields and the WRAPPER's section-level bags + id;
 *  - a FLAT legacy section of either type (defensive: mid-session
 *    ingress normalizes, but the command must behave on any document);
 *  - REFUSED: a flush wrapper the facade predicate rejects (styled
 *    column / inner widget carrying its own bags / extra widgets) —
 *    the engine will not collapse those, the UI does not present them
 *    as the themed block, and silently discarding the inner widget's
 *    own bags would lose merchant styling. One predicate, one answer.
 *
 * MAPPING:
 *  rich_text → layout "1", one column, ONE `text` widget carrying the
 *    html verbatim (same richText vocabulary, sanitized on render). The
 *    block's `width` select shares the universal style bag's `width`
 *    vocabulary — carried onto style.width unless the merchant already
 *    styled width ("normal" is the style default and stays unwritten).
 *  image_with_text → layout "2", verticalAlign "center"; image column
 *    (`image` widget, alt from the title with linebreaks collapsed) and
 *    text column (eyebrow → `text`, title → `heading` h2, body → `text`
 *    with \n → <br>, cta → `button` when its link is non-empty — the
 *    theme's own "no link, no button" gating). Column order follows
 *    image_side.
 *  Section-level `style` / `advanced` bags carry over verbatim (same
 *  `.cms-sec-sec-<i>` scope). `elementStyles` are DROPPED: their keys
 *  target the theme markup's [data-el] hooks, which platform widgets do
 *  not emit — carrying them forward would be dead config that could
 *  re-attach wrongly if a commerce widget is later added to this
 *  section. Undo restores them byte-exactly (snapshot inverse).
 */
export function convertSectionToWidgets(
  section: Section,
  idSeed: string
): Section | null {
  if (!isObj(section) || typeof section.block_type !== "string") return null

  let type: string
  let fields: Record<string, unknown>
  if (CONVERTIBLE_SECTION_TYPES.has(section.block_type)) {
    type = section.block_type
    fields = section as Record<string, unknown>
  } else if (section.block_type === "container") {
    const w = flushSingleCommerceWidget(section as any)
    if (!w || !CONVERTIBLE_SECTION_TYPES.has(String(w.widget_type))) {
      return null
    }
    type = String(w.widget_type)
    fields = w as unknown as Record<string, unknown>
  } else {
    return null
  }

  const seed = idSeed || "cvt"
  const host = section as Record<string, unknown>
  // The converted container IS the section, positionally — keep its id.
  const sid = typeof host.id === "string" && host.id ? (host.id as string) : seed

  let style = isObj(host.style)
    ? (host.style as Record<string, unknown>)
    : undefined
  let converted: Section

  if (type === "rich_text") {
    const html = typeof fields.html === "string" ? fields.html : ""
    const width = typeof fields.width === "string" ? fields.width : ""
    if (
      (width === "narrow" || width === "wide" || width === "full") &&
      !(style && style.width !== undefined)
    ) {
      style = { ...(style ?? {}), width }
    }
    converted = {
      block_type: "container",
      id: sid,
      layout: "1",
      columns: [
        {
          id: `${seed}-c0`,
          widgets: [{ id: `${seed}-w0`, widget_type: "text", html }],
        },
      ],
    } as Section
  } else {
    const image = typeof fields.image === "string" ? fields.image : ""
    const side = fields.image_side === "right" ? "right" : "left"
    const eyebrow =
      typeof fields.eyebrow === "string" ? fields.eyebrow.trim() : ""
    const title = typeof fields.title === "string" ? fields.title.trim() : ""
    const body = typeof fields.body === "string" ? fields.body.trim() : ""
    const cta = isObj(fields.cta) ? (fields.cta as Record<string, unknown>) : null
    const ctaHref = typeof cta?.href === "string" ? cta.href.trim() : ""
    const ctaLabel =
      typeof cta?.label === "string" && cta.label ? cta.label : "Shop now"

    const imageCol = {
      id: `${seed}-c0`,
      widgets: [
        {
          id: `${seed}-w0`,
          widget_type: "image",
          src: image,
          alt: title.replace(/\s*\r?\n\s*/g, " "),
        },
      ],
    }
    const textWidgets: Record<string, unknown>[] = []
    let wn = 1
    if (eyebrow) {
      textWidgets.push({
        id: `${seed}-w${wn++}`,
        widget_type: "text",
        html: `<p>${escapePlain(eyebrow)}</p>`,
      })
    }
    if (title) {
      textWidgets.push({
        id: `${seed}-w${wn++}`,
        widget_type: "heading",
        text: title,
        level: "h2",
      })
    }
    if (body) {
      textWidgets.push({
        id: `${seed}-w${wn++}`,
        widget_type: "text",
        html: `<p>${plainToHtml(body)}</p>`,
      })
    }
    if (ctaHref) {
      textWidgets.push({
        id: `${seed}-w${wn++}`,
        widget_type: "button",
        label: ctaLabel,
        href: ctaHref,
        variant: "primary",
      })
    }
    const textCol = { id: `${seed}-c1`, widgets: textWidgets }
    converted = {
      block_type: "container",
      id: sid,
      layout: "2",
      verticalAlign: "center",
      columns: side === "right" ? [textCol, imageCol] : [imageCol, textCol],
    } as Section
  }

  if (style !== undefined) {
    ;(converted as Record<string, unknown>).style = style
  }
  if (host.advanced !== undefined) {
    ;(converted as Record<string, unknown>).advanced = host.advanced
  }
  return converted
}

/* --- end 6B ----------------------------------------------------------- */

/** AI patch application (shell applyAiPatches body, pure — keeps the 1V
 *  F2 fixes: insert_section normalizes; replace_props on a facade routes
 *  content props to the inner widget, appearance bags to the wrapper). */
export function applyAiPatchesPure(
  content: Section[],
  patches: any[]
): { content: Section[]; applied: number } {
  const next = [...content]
  let applied = 0
  for (const p of Array.isArray(patches) ? patches : []) {
    if (
      p?.op === "replace_props" &&
      typeof p.index === "number" &&
      next[p.index] &&
      p.props &&
      typeof p.props === "object"
    ) {
      const { block_type, ...rest } = next[p.index] as any
      const { block_type: _bt, ...safe } = p.props
      const fw: any = flushSingleCommerceWidget(next[p.index] as any)
      if (fw) {
        const sectionKeys = ["style", "advanced", "elementStyles"]
        const wrapperPatch: Record<string, unknown> = {}
        const widgetPatch: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(safe)) {
          if (sectionKeys.includes(k)) wrapperPatch[k] = v
          else widgetPatch[k] = v
        }
        const sec: any = { block_type, ...rest, ...wrapperPatch }
        sec.columns = [
          {
            ...sec.columns[0],
            widgets: [{ ...fw, ...widgetPatch }],
          },
        ]
        next[p.index] = sec as Section
      } else {
        next[p.index] = { block_type, ...rest, ...safe } as Section
      }
      applied++
    } else if (
      p?.op === "insert_section" &&
      typeof p.at === "number" &&
      typeof p.block_type === "string"
    ) {
      const schema = getBlockSchema(p.block_type)
      if (!schema) continue
      const at = Math.max(0, Math.min(p.at, next.length))
      const flat = {
        block_type: p.block_type,
        ...defaultPropsFromSchema(schema),
        ...(p.props ?? {}),
      } as Section
      next.splice(at, 0, normalizeDocument([flat] as any).content[0] as Section)
      applied++
    } else if (
      p?.op === "remove_section" &&
      typeof p.index === "number" &&
      next[p.index]
    ) {
      next.splice(p.index, 1)
      applied++
    } else if (
      p?.op === "move_section" &&
      typeof p.from === "number" &&
      typeof p.to === "number" &&
      next[p.from]
    ) {
      const [m] = next.splice(p.from, 1)
      next.splice(Math.max(0, Math.min(p.to, next.length)), 0, m)
      applied++
    }
  }
  return { content: next, applied }
}

/** Resolve an ARCH-AI §4.1 NodeRef-ish target to a merge host. Supports
 *  the shapes 3F will send: {t:"section",i} and {t:"widget",i,path}. */
function aiMergeRef(
  content: Section[],
  ref: any,
  set: Record<string, unknown>
): Section[] | null {
  if (!isObj(ref)) return null
  if (ref.t === "section" && typeof ref.i === "number" && content[ref.i]) {
    const i = ref.i as number
    return content.map((s, j) => (j === i ? ({ ...s, ...set } as Section) : s))
  }
  if (
    ref.t === "widget" &&
    typeof ref.i === "number" &&
    Array.isArray(ref.path)
  ) {
    const i = ref.i as number
    const path = ref.path as number[]
    const colPath = path.slice(0, -1)
    const wi = path[path.length - 1]
    const ws = widgetsAtPath(content, i, colPath)
    if (!ws || !ws[wi]) return null
    return writeWidgetsAt(
      content,
      i,
      colPath,
      ws.map((w: any, j: number) => (j === wi ? { ...w, ...set } : w))
    )
  }
  return null
}

/* ----------------------------- the registry -------------------------- */

const sectionInverse = (state: EditorState, index: number): Command =>
  state.content[index]
    ? {
        name: "section.setProps",
        args: { index, section: state.content[index] },
      }
    : { name: "doc.replace", args: { content: state.content } }

export const COMMANDS: Record<CommandName, CommandImpl> = {
  /* -------- doc (internal restore + normalize) ---------------------- */

  /** The snapshot marker (ARCH-CANVAS §3.3 degraded case): replaces the
   *  whole content array and/or the given chrome regions. Only ever
   *  dispatched as an inverse / staged-preview restore. */
  "doc.replace": {
    scope: "content",
    label: () => "Restore Document",
    run: (_state, args) => {
      const out: RunResult = {}
      if (Array.isArray(args.content)) out.content = args.content as Section[]
      if (isObj(args.chrome)) {
        out.chrome = Object.entries(args.chrome as ChromeMap).map(
          ([region, data]) => ({ region, data })
        )
      }
      return out.content || out.chrome ? out : null
    },
    invert: (state, args) => ({
      name: "doc.replace",
      args: {
        ...(Array.isArray(args.content) ? { content: state.content } : {}),
        ...(isObj(args.chrome) ? { chrome: state.chrome } : {}),
      },
    }),
  },

  /** Inverse of template.insert: remove `count` sections at `at`. */
  "doc.removeRange": {
    scope: "content",
    label: () => "Remove Sections",
    run: (state, args) => {
      const at = args.at as number
      const count = args.count as number
      if (
        typeof at !== "number" ||
        typeof count !== "number" ||
        count <= 0 ||
        at < 0 ||
        at >= state.content.length
      ) {
        return null
      }
      const next = [...state.content]
      next.splice(at, count)
      return { content: next }
    },
    invert: (state) => ({
      name: "doc.replace",
      args: { content: state.content },
    }),
  },

  /** Universal normalization as a command. The LOAD path deliberately
   *  does NOT dispatch this (it calls normalizeDocument directly, before
   *  the history baseline — Phase 1 rule); this command exists for
   *  mid-session ingress that wants normalization inside history. */
  "doc.normalize": {
    scope: "content",
    label: () => "Normalize Document",
    run: (state) => {
      const { content, changed } = normalizeDocument(state.content as any)
      return changed ? { content: content as Section[] } : null
    },
    invert: (state) => ({
      name: "doc.replace",
      args: { content: state.content },
    }),
  },

  /* -------- section -------------------------------------------------- */

  /** Fresh block at `at` (schema defaults / preset; commerce wrapped as a
   *  Phase-1 facade). Shell insertSectionAt body. */
  "section.insert": {
    scope: "content",
    label: (a) => `Add ${typeLabel(String(a.type))}`,
    run: (state, args) => {
      const built = buildInsertSection(
        String(args.type),
        typeof args.presetIndex === "number" ? args.presetIndex : undefined
      )
      if (!built) return null
      const at = clampAt(args.at as number, state.content.length)
      return {
        content: [
          ...state.content.slice(0, at),
          built.block,
          ...state.content.slice(at),
        ],
      }
    },
    invert: (state, args) => ({
      name: "section.remove",
      args: { index: clampAt(args.at as number, state.content.length) },
    }),
  },

  /** Insert a GIVEN section object (paste / undo-restore). */
  "section.insertRaw": {
    scope: "content",
    label: () => "Paste Section",
    run: (state, args) => {
      if (!isObj(args.section)) return null
      const at = clampAt(args.at as number, state.content.length)
      return {
        content: [
          ...state.content.slice(0, at),
          structuredClone(args.section) as Section,
          ...state.content.slice(at),
        ],
      }
    },
    invert: (state, args) => ({
      name: "section.remove",
      args: { index: clampAt(args.at as number, state.content.length) },
    }),
  },

  "section.remove": {
    scope: "content",
    label: (a, s) => `Delete ${sectionLabel(s, a.index as number)}`,
    run: (state, args) => {
      const i = args.index as number
      if (typeof i !== "number" || !state.content[i]) return null
      return { content: state.content.filter((_, idx) => idx !== i) }
    },
    invert: (state, args) => {
      const i = args.index as number
      return state.content[i]
        ? {
            name: "section.insertRaw",
            args: { at: i, section: state.content[i] },
          }
        : { name: "doc.replace", args: { content: state.content } }
    },
  },

  "section.duplicate": {
    scope: "content",
    label: (a, s) => `Duplicate ${sectionLabel(s, a.index as number)}`,
    run: (state, args) => {
      const i = args.index as number
      if (typeof i !== "number" || i < 0 || i >= state.content.length) {
        return null
      }
      const clone = structuredClone(state.content[i])
      return {
        content: [
          ...state.content.slice(0, i + 1),
          clone,
          ...state.content.slice(i + 1),
        ],
      }
    },
    invert: (_state, args) => ({
      name: "section.remove",
      args: { index: (args.index as number) + 1 },
    }),
  },

  /** Splice-move (shell moveSectionTo body; the arrow buttons dispatch
   *  the same command with to = from ± 1). Self-inverting. */
  "section.move": {
    scope: "content",
    label: () => "Move Section",
    run: (state, args) => {
      const from = args.from as number
      const to = args.to as number
      if (
        typeof from !== "number" ||
        typeof to !== "number" ||
        from === to ||
        from < 0 ||
        from >= state.content.length ||
        to < 0 ||
        to >= state.content.length
      ) {
        return null
      }
      const next = [...state.content]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { content: next }
    },
    invert: (_state, args) => ({
      name: "section.move",
      args: { from: args.to, to: args.from },
    }),
  },

  /** Whole-section replace (shell updateSectionAt: the SchemaPanel's
   *  content edits, incl. container layout reconciliation done by the
   *  dispatching wrapper). Self-inverting via the before-section. */
  "section.setProps": {
    scope: "content",
    label: (a, s) => `Edit ${sectionLabel(s, a.index as number)}`,
    coalesceKey: (a) => `section.setProps:${a.index}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const i = args.index as number
      if (typeof i !== "number" || !state.content[i] || !isObj(args.section)) {
        return null
      }
      return {
        content: state.content.map((b, idx) =>
          idx === i ? (args.section as Section) : b
        ),
      }
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Section appearance bags (shell writeSectionBags). */
  "section.setBags": {
    scope: "content",
    label: (a, s) => `Style ${sectionLabel(s, a.index as number)}`,
    coalesceKey: (a) => `section.setBags:${a.index}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const i = args.index as number
      const sec = state.content[i]
      if (!sec || !isObj(args.bags)) return null
      const updated = withBags(sec as any, args.bags as Bags, [
        "style",
        "advanced",
        "elementStyles",
      ])
      return {
        content: state.content.map((b, idx) =>
          idx === i ? (updated as Section) : b
        ),
      }
    },
    invert: (state, args) => {
      const i = args.index as number
      const sec = state.content[i]
      if (!sec || !isObj(args.bags)) return sectionInverse(state, i)
      return {
        name: "section.setBags",
        args: {
          index: i,
          bags: beforeBags(sec as any, args.bags as Bags, [
            "style",
            "advanced",
            "elementStyles",
          ]),
        },
      }
    },
  },

  /* -------- container ------------------------------------------------ */

  /** Structure picker: N empty columns at `at` (shell insertContainerAt). */
  "container.insert": {
    scope: "content",
    label: () => "Add Container",
    run: (state, args) => {
      const schema = getBlockSchema("container")
      if (!schema) return null
      const n = Math.max(1, Math.min(4, args.cols as number))
      if (!Number.isFinite(n)) return null
      const props = {
        ...defaultPropsFromSchema(schema),
        layout: String(n),
        columns: Array.from({ length: n }, () => ({ widgets: [] })),
      }
      const block = { block_type: "container", ...props } as Section
      const at = clampAt(args.at as number, state.content.length)
      return {
        content: [
          ...state.content.slice(0, at),
          block,
          ...state.content.slice(at),
        ],
      }
    },
    invert: (state, args) => ({
      name: "section.remove",
      args: { index: clampAt(args.at as number, state.content.length) },
    }),
  },

  /** Column count change routed through reconcileContainerProps (shell
   *  setContainerLayout — widget-preserving shrink). */
  "container.setLayout": {
    scope: "content",
    label: () => "Change Columns",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const i = args.index as number
      const block = state.content[i] as Record<string, unknown> | undefined
      if (!block || block.block_type !== "container") return null
      const n = Math.max(1, Math.min(4, Math.floor(args.cols as number)))
      if (!Number.isFinite(n)) return null
      return {
        content: state.content.map((b, idx) =>
          idx === i
            ? (reconcileContainerProps({
                ...(b as any),
                layout: String(n),
              }) as Section)
            : b
        ),
      }
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /* -------- widget ---------------------------------------------------- */

  /** Fresh widget into a column at `wi` (shell insertWidgetAt; structural
   *  → clears a facade's flush via writeWidgetsAt; undo restores it via
   *  the before-section inverse). */
  "widget.insert": {
    scope: "content",
    label: (a) => `Add ${typeLabel(String(a.type))}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const colPath = args.colPath as number[]
      const widgetType = String(args.type)
      if (!getWidgetSchema(widgetType)) return null
      // One level of nesting: an inner section may not go inside another.
      if (widgetType === "inner_section" && (colPath?.length ?? 0) > 1) {
        return null
      }
      const existing = widgetsAtPath(state.content, index, colPath)
      if (!existing) return null
      const widget = newWidgetOf(widgetType)
      const wi = args.wi as number | undefined
      const at =
        wi == null
          ? existing.length
          : Math.max(0, Math.min(wi, existing.length))
      const next = writeWidgetsAt(state.content, index, colPath, [
        ...existing.slice(0, at),
        widget,
        ...existing.slice(at),
      ])
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Widget dropped on open ground → auto-wrap in a 1-column container
   *  (shell insertWidgetAsSection). */
  "widget.insertWrapped": {
    scope: "content",
    label: (a) => `Add ${typeLabel(String(a.type))}`,
    run: (state, args) => {
      const widgetType = String(args.type)
      if (!getWidgetSchema(widgetType)) return null
      const schema = getBlockSchema("container")
      if (!schema) return null
      const widget = newWidgetOf(widgetType)
      const props = {
        ...defaultPropsFromSchema(schema),
        layout: "1",
        columns: [{ widgets: [widget] }],
      }
      const block = { block_type: "container", ...props } as Section
      const at = clampAt(args.at as number, state.content.length)
      return {
        content: [
          ...state.content.slice(0, at),
          block,
          ...state.content.slice(at),
        ],
      }
    },
    invert: (state, args) => ({
      name: "section.remove",
      args: { index: clampAt(args.at as number, state.content.length) },
    }),
  },

  "widget.remove": {
    scope: "content",
    label: (a, s) =>
      `Delete ${widgetLabel(s, a.index as number, a.path as number[])}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const path = args.path as number[]
      const colPath = path.slice(0, -1)
      const wi = path[path.length - 1]
      const ws = widgetsAtPath(state.content, index, colPath)
      if (!ws || !ws[wi]) return null
      const next = writeWidgetsAt(
        state.content,
        index,
        colPath,
        ws.filter((_: unknown, i: number) => i !== wi)
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "widget.duplicate": {
    scope: "content",
    label: (a, s) =>
      `Duplicate ${widgetLabel(s, a.index as number, a.path as number[])}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const path = args.path as number[]
      const colPath = path.slice(0, -1)
      const wi = path[path.length - 1]
      const ws = widgetsAtPath(state.content, index, colPath)
      if (!ws || !ws[wi]) return null
      const next = writeWidgetsAt(state.content, index, colPath, [
        ...ws.slice(0, wi + 1),
        structuredClone(ws[wi]),
        ...ws.slice(wi + 1),
      ])
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Paste a GIVEN widget object after `path` (clipboard payload captured
   *  at dispatch time so redo replays deterministically). */
  "widget.paste": {
    scope: "content",
    label: () => "Paste Widget",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const path = args.path as number[]
      const clipWidget = args.widget as Widget
      if (!isObj(clipWidget)) return null
      const colPath = path.slice(0, -1)
      const wi = path[path.length - 1]
      const ws = widgetsAtPath(state.content, index, colPath)
      if (!ws) return null
      // One level of nesting (same guard as insert).
      if (clipWidget.widget_type === "inner_section" && colPath.length > 1) {
        return null
      }
      const next = writeWidgetsAt(state.content, index, colPath, [
        ...ws.slice(0, wi + 1),
        structuredClone(clipWidget),
        ...ws.slice(wi + 1),
      ])
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Reorder within a column (shell moveWidget: moves the EXISTING
   *  object, never rebuilds; `to` indexes the ORIGINAL array). */
  "widget.move": {
    scope: "content",
    label: () => "Move Widget",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const colPath = args.colPath as number[]
      const from = args.from as number
      const to = args.to as number
      const existing = widgetsAtPath(state.content, index, colPath)
      if (!existing || from === to) return null
      if (from < 0 || from >= existing.length) return null
      const next = existing.slice()
      const [w] = next.splice(from, 1)
      if (!w) return null
      const dest = Math.max(0, Math.min(from < to ? to - 1 : to, next.length))
      next.splice(dest, 0, w)
      const out = writeWidgetsAt(state.content, index, colPath, next)
      return out ? { content: out } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Cross-column / cross-section move (3A, ARCH-CANVAS §5.4): splice
   *  the EXISTING widget object out of {from} and into {to} — content,
   *  style bag, advanced bag intact; never rebuilt from schema defaults.
   *  Both splices ride writeWidgetsAt, so the Phase-1 facade rule
   *  applies unforked on BOTH ends: moving INTO a facade's top-level
   *  column clears its `flush` (structural, count changes), and moving
   *  the last widget OUT of one does too.
   *
   *  Same-column dispatches stay `widget.move` (the canvas routes them
   *  there), but a same-column transfer still runs correctly.
   *
   *  Inverse: same-section → the exact before-section (section.setProps,
   *  the widget.move precedent — restores `flush` byte-exactly);
   *  cross-section with a facade endpoint → doc.replace snapshot (a
   *  reverse transfer cannot re-seat the dropped `flush` flag in its
   *  original key position — §3.3's documented degraded case); plain
   *  cross-section → the reverse transfer. */
  "widget.transfer": {
    scope: "content",
    label: (a, s) => {
      const f = a?.from as WidgetSource | undefined
      return f && isNums(f.colPath)
        ? `Move ${widgetLabel(s, f.index, [...f.colPath, f.wi])}`
        : "Move Widget"
    },
    // No `touches`: a transfer may span two sections → full canvas sync.
    run: (state, args) => {
      const ends = transferEnds(args)
      if (!ends) return null
      const { from, to } = ends
      const srcWs = widgetsAtPath(state.content, from.index, from.colPath)
      const w = srcWs?.[from.wi]
      if (!srcWs || !w) return null
      // One level of nesting: an inner section may not land nested.
      if (w.widget_type === "inner_section" && to.colPath.length > 1) {
        return null
      }
      // Self / descendant rejection: the destination column may not live
      // inside the widget being moved.
      if (
        to.index === from.index &&
        to.colPath.length > from.colPath.length &&
        [...from.colPath, from.wi].every((n, i) => to.colPath[i] === n)
      ) {
        return null
      }
      // Same column → widget.move semantics (splice within one array).
      if (to.index === from.index && numsEq(to.colPath, from.colPath)) {
        if (from.wi === to.wi) return null
        const arr = srcWs.slice()
        const [moved] = arr.splice(from.wi, 1)
        const dest = Math.max(
          0,
          Math.min(from.wi < to.wi ? to.wi - 1 : to.wi, arr.length)
        )
        if (dest === from.wi) return null
        arr.splice(dest, 0, moved)
        const out = writeWidgetsAt(state.content, from.index, from.colPath, arr)
        return out ? { content: out } : null
      }
      // Out of the source (structural — may clear the source's flush)…
      let content = writeWidgetsAt(
        state.content,
        from.index,
        from.colPath,
        srcWs.filter((_: unknown, i: number) => i !== from.wi)
      )
      if (!content) return null
      // …into the destination. If the destination path threads through
      // the source COLUMN, the removal shifted widget indices after
      // from.wi down by one.
      const toColPath =
        to.index === from.index
          ? adjustColPathAfterRemoval(from, to.colPath)
          : to.colPath
      const destWs = widgetsAtPath(content, to.index, toColPath)
      if (!destWs) return null
      const at = Math.max(0, Math.min(to.wi, destWs.length))
      content = writeWidgetsAt(content, to.index, toColPath, [
        ...destWs.slice(0, at),
        w,
        ...destWs.slice(at),
      ])
      return content ? { content } : null
    },
    invert: (state, args) => {
      const ends = transferEnds(args)
      if (!ends) return { name: "doc.replace", args: { content: state.content } }
      const { from, to } = ends
      // Same section (incl. cross-column): the before-section is exact
      // AND targeted — and restores a cleared `flush` byte-for-byte.
      if (to.index === from.index) return sectionInverse(state, from.index)
      const srcSec: any = state.content[from.index]
      const dstSec: any = state.content[to.index]
      if (srcSec?.flush === true || dstSec?.flush === true) {
        return { name: "doc.replace", args: { content: state.content } }
      }
      // Reverse transfer: the widget will sit at (to.index, to.colPath,
      // clamped wi) once run() applies — cross-section, so the source
      // removal cannot shift the destination path or length.
      const destWs = widgetsAtPath(state.content, to.index, to.colPath)
      const insertedWi = destWs
        ? Math.max(0, Math.min(to.wi, destWs.length))
        : to.wi
      return {
        name: "widget.transfer",
        args: {
          from: { index: to.index, colPath: to.colPath, wi: insertedWi },
          to: { index: from.index, colPath: from.colPath, wi: from.wi },
        },
      }
    },
  },

  /** Whole-widget replace (shell writeWidget: panel content edits on a
   *  widget; same count → a facade's flush is KEPT, per F1). */
  "widget.setProps": {
    scope: "content",
    label: (a, s) =>
      `Edit ${widgetLabel(s, a.index as number, a.path as number[])}`,
    coalesceKey: (a) =>
      `widget.setProps:${a.index}:${(a.path as number[]).join(".")}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const path = args.path as number[]
      if (!isObj(args.widget)) return null
      const colPath = path.slice(0, -1)
      const wi = path[path.length - 1]
      const ws = widgetsAtPath(state.content, index, colPath)
      if (!ws || !ws[wi]) return null
      const next = writeWidgetsAt(
        state.content,
        index,
        colPath,
        ws.map((w: any, i: number) => (i === wi ? args.widget : w))
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Widget appearance bags (shell writeWidgetBags). */
  "widget.setBags": {
    scope: "content",
    label: (a, s) =>
      `Style ${widgetLabel(s, a.index as number, a.path as number[])}`,
    coalesceKey: (a) =>
      `widget.setBags:${a.index}:${(a.path as number[]).join(".")}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const index = args.index as number
      const path = args.path as number[]
      if (!isObj(args.bags)) return null
      const colPath = path.slice(0, -1)
      const wi = path[path.length - 1]
      const ws = widgetsAtPath(state.content, index, colPath)
      const widget = ws?.[wi]
      if (!widget) return null
      const updated = withBags(widget, args.bags as Bags, [
        "style",
        "advanced",
      ])
      const next = writeWidgetsAt(
        state.content,
        index,
        colPath,
        ws!.map((w: any, i: number) => (i === wi ? updated : w))
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /* -------- column (2E: columns carry style bags) ---------------------- */

  /** Column style/advanced bags at an odd-length col path (shell
   *  writeColumnBags). Content-class write — writeColumnAt never touches
   *  `flush` (F1's structural rule is about widget COUNT and does not
   *  apply here). Same setBags pattern as section/widget: undefined
   *  leaves a bag untouched, {} deletes the key; invert restores the
   *  prior value of exactly the bags the command set. */
  "column.setBags": {
    scope: "content",
    label: () => "Edit column style",
    coalesceKey: (a) =>
      `column.setBags:${a.index}:${(a.colPath as number[]).join(".")}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const i = args.index as number
      const colPath = args.colPath as number[]
      if (!isObj(args.bags)) return null
      const col = columnAtPath(state.content, i, colPath)
      if (!col) return null
      const updated = withBags(col, args.bags as Bags, ["style", "advanced"])
      const next = writeColumnAt(state.content, i, colPath, updated)
      return next ? { content: next } : null
    },
    invert: (state, args) => {
      const i = args.index as number
      const colPath = args.colPath as number[]
      const col = isObj(args.bags)
        ? columnAtPath(state.content, i, colPath)
        : null
      if (!col) return sectionInverse(state, i)
      return {
        name: "column.setBags",
        args: {
          index: i,
          colPath,
          bags: beforeBags(col, args.bags as Bags, ["style", "advanced"]),
        },
      }
    },
  },

  /* -------- element --------------------------------------------------- */

  /** Element style/advanced bags inside a section (shell writeElementBags
   *  — also the font-size handle's write path). */
  "element.setBags": {
    scope: "content",
    label: (a) => `Style ${titleize(String(a.key))}`,
    coalesceKey: (a) => `element.setBags:${a.index}:${a.key}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const i = args.index as number
      const section = state.content[i]
      if (!section || typeof args.key !== "string" || !isObj(args.bags)) {
        return null
      }
      const updated = sectionWithElementBags(
        section,
        args.key,
        args.bags as Bags
      )
      return {
        content: state.content.map((b, idx) => (idx === i ? updated : b)),
      }
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /* -------- item (repeatable arrays: slides / banners / tiles) -------- */

  "item.duplicate": {
    scope: "content",
    label: () => "Duplicate Item",
    touches: (a) => a.index as number,
    run: (state, args) => runItemAction(state, args, "duplicateItem"),
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "item.remove": {
    scope: "content",
    label: () => "Delete Item",
    touches: (a) => a.index as number,
    run: (state, args) => runItemAction(state, args, "deleteItem"),
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /* -------- template --------------------------------------------------- */

  /** Insert template blocks at a seam. Runs the SAME normalization the
   *  load path applies (Phase 1: a normalized document never regrows flat
   *  sections mid-session). Inverse removes exactly the inserted range. */
  "template.insert": {
    scope: "content",
    label: () => "Insert Template",
    run: (state, args) => {
      const blocks = args.sections
      if (!Array.isArray(blocks) || blocks.length === 0) return null
      const inserted = normalizeDocument(blocks as any).content as Section[]
      const at = clampAt(args.at as number, state.content.length)
      return {
        content: [
          ...state.content.slice(0, at),
          ...inserted,
          ...state.content.slice(at),
        ],
      }
    },
    invert: (state, args) => ({
      name: "doc.removeRange",
      args: {
        at: clampAt(args.at as number, state.content.length),
        count: Array.isArray(args.sections) ? args.sections.length : 0,
      },
    }),
  },

  /* -------- ai (ARCH-AI §4.1) ------------------------------------------ */

  /** One command carries every AI result through the bus. Two arg shapes:
   *  - { patches } — today's server-validated Tier-3 panel ops
   *    (replace_props / insert_section / remove_section / move_section);
   *    grouped as ONE entry, inverse = doc.replace snapshot marker.
   *  - { ref, set, before } — the §4.1 single-node contract (3F): merges
   *    `set` onto the node; inverse re-applies `before` via the same
   *    command (fully targeted undo, no snapshot).
   *  `staged` is handled by the executor (apply without history; Apply
   *  promotes to one labeled entry; Discard restores). */
  "ai.apply": {
    scope: "content",
    label: (a) =>
      typeof a.label === "string" && a.label ? String(a.label) : "AI Edit",
    run: (state, args) => {
      if (Array.isArray(args.patches)) {
        const { content, applied } = applyAiPatchesPure(
          state.content,
          args.patches as any[]
        )
        return applied > 0 ? { content } : null
      }
      if (isObj(args.set)) {
        const next = aiMergeRef(state.content, args.ref, args.set)
        return next ? { content: next } : null
      }
      return null
    },
    invert: (state, args) => {
      if (isObj(args.set) && isObj(args.before)) {
        return {
          name: "ai.apply",
          args: {
            ref: args.ref,
            set: args.before,
            before: args.set,
            label:
              typeof args.label === "string" ? `Undo ${args.label}` : undefined,
          },
        }
      }
      return { name: "doc.replace", args: { content: state.content } }
    },
  },

  /* -------- chrome (JOINS the undo stack — ARCH-CANVAS §3.3 item 1) ---- */

  /** One region's data replaced (shell updateChrome). Self-inverting via
   *  the region's before-data — undo after a header edit now undoes the
   *  HEADER edit, not the most recent page edit. */
  "chrome.setProps": {
    scope: "chrome",
    label: (a) => `Edit ${titleize(String(a.region))}`,
    coalesceKey: (a) => `chrome.setProps:${a.region}`,
    run: (_state, args) => {
      if (typeof args.region !== "string" || !isObj(args.data)) return null
      return {
        chrome: [
          { region: args.region, data: args.data as Record<string, unknown> },
        ],
      }
    },
    invert: (state, args) => ({
      name: "chrome.setProps",
      args: {
        region: args.region,
        data: state.chrome[String(args.region)] ?? {},
      },
    }),
  },

  /** Region style/advanced bags (shell updateChromeBag). */
  "chrome.setBags": {
    scope: "chrome",
    label: (a) => `Style ${titleize(String(a.region))}`,
    coalesceKey: (a) => `chrome.setBags:${a.region}`,
    run: (state, args) => {
      if (typeof args.region !== "string" || !isObj(args.bags)) return null
      const prev = (state.chrome[args.region] ?? {}) as Record<string, unknown>
      const updated = withBags(prev, args.bags as Bags, ["style", "advanced"])
      return { chrome: [{ region: args.region, data: updated }] }
    },
    invert: (state, args) => ({
      name: "chrome.setProps",
      args: {
        region: args.region,
        data: state.chrome[String(args.region)] ?? {},
      },
    }),
  },

  /* -------- slider (5B stage — ARCH-SLIDER §3.3) ----------------------
     One command per gesture. Bodies live in ../slider/stage-commands
     (pure, id-targeted, facade-neutral: slide/layer edits never change
     the top-level widget count, so a normalized hero keeps its `flush`
     collapse). Inverse = the exact before-section (sectionInverse) — the
     item/widget family precedent: fully targeted, restores the host
     byte-exactly wherever it sits (flat, facade, or in-column), and
     ARCH-SLIDER §5's undo-restores-theme-rendering guarantee falls out
     of it for slider.upgradeSlide. */

  "slider.addSlide": {
    scope: "content",
    label: () => "Add Slide",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = slideAdd(
        state.content,
        args.index as number,
        args.slide,
        typeof args.at === "number" ? args.at : undefined
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** `newId` is computed at DISPATCH (deterministic redo; the shell's
   *  sink can select the clone). Layer ids are kept — commands address
   *  the (slideId, layerId) pair, unique by construction. */
  "slider.duplicateSlide": {
    scope: "content",
    label: () => "Duplicate Slide",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = slideDuplicate(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.newId ?? "")
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "slider.removeSlide": {
    scope: "content",
    label: () => "Delete Slide",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = slideRemove(
        state.content,
        args.index as number,
        String(args.slideId)
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "slider.reorderSlides": {
    scope: "content",
    label: () => "Reorder Slides",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = slideReorder(
        state.content,
        args.index as number,
        String(args.slideId),
        args.to as number
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "slider.setSlideBackground": {
    scope: "content",
    label: () => "Edit Slide Background",
    coalesceKey: (a) => `slider.setSlideBackground:${a.index}:${a.slideId}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = slideSetBackground(
        state.content,
        args.index as number,
        String(args.slideId),
        args.background
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "slider.setSlideProps": {
    scope: "content",
    label: () => "Edit Slide",
    coalesceKey: (a) => `slider.setSlideProps:${a.index}:${a.slideId}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = slideSetProps(
        state.content,
        args.index as number,
        String(args.slideId),
        args.props
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** The layer object (with its id and base frame) is built at dispatch
   *  time — redo replays byte-identically, selection can target it. */
  "slider.addLayer": {
    scope: "content",
    label: (a) => {
      const t = (a?.layer as { type?: unknown } | undefined)?.type
      return `Add ${typeof t === "string" ? t.charAt(0).toUpperCase() + t.slice(1) : ""} Layer`.replace("  ", " ")
    },
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerAdd(
        state.content,
        args.index as number,
        String(args.slideId),
        args.layer,
        typeof args.at === "number" ? args.at : undefined
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "slider.removeLayer": {
    scope: "content",
    label: (a, s) => `Delete ${sliderLayerLabel(s, a)}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerRemove(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId)
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  "slider.duplicateLayer": {
    scope: "content",
    label: (a, s) => `Duplicate ${sliderLayerLabel(s, a)}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerDuplicate(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId),
        String(args.newId ?? "")
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Restack: array order is paint order (§1.3). */
  "slider.reorderLayers": {
    scope: "content",
    label: () => "Restack Layers",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerReorder(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId),
        args.to as number
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** One drag / resize / nudge-burst = one frame write for one device
   *  (desktop → base, tablet/mobile → the override slot; frame: null on
   *  tablet/mobile clears the override). NO coalesceKey: two separate
   *  drags are two history entries; nudge bursts group via the canvas's
   *  explicit txn. */
  "slider.setLayerFrame": {
    scope: "content",
    label: (a, s) => `Move ${sliderLayerLabel(s, a)}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerSetFrame(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId),
        (args.device as "desktop" | "tablet" | "mobile") ?? "desktop",
        args.frame
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Layer content (props merge) + name + per-device hidden. */
  "slider.setLayerProps": {
    scope: "content",
    label: (a, s) => `Edit ${sliderLayerLabel(s, a)}`,
    coalesceKey: (a) =>
      `slider.setLayerProps:${a.index}:${a.slideId}:${a.layerId}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerSetProps(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId),
        { props: args.props, name: args.name, hidden: args.hidden }
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Layer appearance bags — the setBags semantics verbatim (undefined
   *  leaves a bag untouched, {} deletes the key). */
  "slider.setLayerStyle": {
    scope: "content",
    label: (a, s) => `Style ${sliderLayerLabel(s, a)}`,
    coalesceKey: (a) =>
      `slider.setLayerStyle:${a.index}:${a.slideId}:${a.layerId}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerSetBags(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId),
        (args.bags ?? {}) as {
          style?: Record<string, unknown>
          advanced?: Record<string, unknown>
        }
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** §4: one entrance, a delay, a duration. null/"none" removes it. */
  "slider.setLayerAnim": {
    scope: "content",
    label: (a, s) => `Animate ${sliderLayerLabel(s, a)}`,
    coalesceKey: (a) =>
      `slider.setLayerAnim:${a.index}:${a.slideId}:${a.layerId}`,
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = layerSetAnim(
        state.content,
        args.index as number,
        String(args.slideId),
        String(args.layerId),
        args.anim
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** ARCH-SLIDER §5: fields → layered, lazily, IN HISTORY — undo
   *  restores the fields shape and thereby the theme's own Liquid
   *  rendering byte-exactly (the section.setProps inverse). Ids derive
   *  from each slide's INDEX (`up-<i>` — the renderer's render-time
   *  convention, seat 5A), so redo replays byte-identically; `idSeed`
   *  stays as the envelope's replay token. `placement` is the active
   *  theme's optional slider_placement hint, resolved at DISPATCH so the
   *  command stays pure and args-deterministic. */
  "slider.upgradeSlide": {
    scope: "content",
    label: () => "Convert to Layered Slides",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const next = upgradeSlides(
        state.content,
        args.index as number,
        String(args.idSeed ?? ""),
        isObj(args.placement)
          ? (args.placement as unknown as SliderPlacement)
          : undefined
      )
      return next ? { content: next } : null
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /* --- 6B (ARCH-CORE P5): rich_text / image_with_text → real widgets.
     Merchant-invoked, explicit, never automatic. The mapping and the
     facade ruling live on convertSectionToWidgets above. Ids derive from
     the dispatch-time `idSeed` (the slider family's precedent), so redo
     replays byte-identically. Inverse = the exact before-section
     (sectionInverse) — undo restores the themed section, and thereby the
     theme's own Liquid rendering, byte-exactly (the slider.upgradeSlide
     precedent, incl. the facade wrapper's `flush` and elementStyles). */
  "section.convertToWidgets": {
    scope: "content",
    label: () => "Convert to widgets",
    touches: (a) => a.index as number,
    run: (state, args) => {
      const i = args.index as number
      if (typeof i !== "number" || !state.content[i]) return null
      const next = convertSectionToWidgets(
        state.content[i],
        String(args.idSeed ?? "")
      )
      if (!next) return null
      return {
        content: state.content.map((b, j) => (j === i ? next : b)),
      }
    },
    invert: (state, args) => sectionInverse(state, args.index as number),
  },

  /** Chrome element bags (shell writeChromeElementBags). */
  "chromeElement.setBags": {
    scope: "chrome",
    label: (a) =>
      `Style ${titleize(String(a.region))} ${titleize(String(a.key))}`,
    coalesceKey: (a) => `chromeElement.setBags:${a.region}:${a.key}`,
    run: (state, args) => {
      if (
        typeof args.region !== "string" ||
        typeof args.key !== "string" ||
        !isObj(args.bags)
      ) {
        return null
      }
      const prev = (state.chrome[args.region] ?? {}) as Record<string, unknown>
      const updated = chromeRegionWithElementBags(
        prev,
        args.key,
        args.bags as Bags
      )
      return { chrome: [{ region: args.region, data: updated }] }
    },
    invert: (state, args) => ({
      name: "chrome.setProps",
      args: {
        region: args.region,
        data: state.chrome[String(args.region)] ?? {},
      },
    }),
  },
}

/** Shared body of item.duplicate / item.remove (shell itemAction commit
 *  updater, verbatim — incl. the Phase-1 facade routing: the repeatable
 *  array lives on the INNER widget of a normalized wrapper). */
function runItemAction(
  state: EditorState,
  args: any,
  a: "duplicateItem" | "deleteItem"
): RunResult | null {
  const index = args.index as number
  const field = String(args.field)
  const itemIndex = args.itemIndex as number
  const s: any = state.content[index]
  const f: any = s ? flushSingleCommerceWidget(s) : null
  const host: any = f ?? s
  const list = host?.[field]
  if (!Array.isArray(list) || itemIndex < 0 || itemIndex >= list.length) {
    return null
  }
  // Last-item delete is refused (the merchant should delete the section).
  if (a === "deleteItem" && list.length <= 1) return null
  const next =
    a === "duplicateItem"
      ? [
          ...list.slice(0, itemIndex + 1),
          structuredClone(list[itemIndex]),
          ...list.slice(itemIndex + 1),
        ]
      : list.filter((_: unknown, j: number) => j !== itemIndex)
  const updated: Section = f
    ? ({
        ...s,
        columns: [{ ...s.columns[0], widgets: [{ ...f, [field]: next }] }],
      } as Section)
    : ({ ...host, [field]: next } as Section)
  return {
    content: state.content.map((b, j) => (j === index ? updated : b)),
  }
}

/** Runtime guard for commands arriving over postMessage (cms:cmd). */
export function hasCommand(name: string): name is CommandName {
  return Object.prototype.hasOwnProperty.call(COMMANDS, name)
}

/** deepMergeBag re-export: dispatching wrappers (paste-style actions)
 *  compute merged bags at dispatch time so redo replays deterministically. */
export { deepMergeBag }
