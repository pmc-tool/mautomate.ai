/* ------------------------------------------------------------------ */
/* Canvas drag-drop (CANVAS P5 / seat 3A — ARCH-CANVAS §5).             */
/*                                                                     */
/* ONE payload vocabulary, ONE drop resolver, ONE in-flow placeholder.  */
/*                                                                     */
/* Payload: the WIRE is unchanged — the existing BLOCK_MIME /           */
/* WIDGET_MIME JSON the shell palette, the canvas grips and the         */
/* Navigator already speak — but every reader now goes through ONE      */
/* codec (`decodeDrag`), which normalizes the four legacy shapes        */
/* ({block_type[,presetIndex]}, {reorderFrom}, {widget_type},           */
/* {widget_type:"",moveFrom}) into the ONE `DragPayload` union. A       */
/* commerce palette card legitimately carries BOTH a section and a      */
/* widget representation (the old dual-MIME cards): the RESOLVER's      */
/* target decides which applies, not the payload — which is exactly     */
/* what retires the decorateSectionDrag "hack" as a hack: it is now     */
/* just a card with two representations and one decision point.        */
/*                                                                     */
/* DataTransfer payloads are unreadable during dragover by spec, so     */
/* kind detection during a drag is TYPE-based (`dragCaps`), plus a      */
/* module-level mirror of the active payload for same-window drags      */
/* (`noteDragStart` — the canvas window sees its own grip drags;        */
/* shell-window drags — palette, navigator — announce moves via the     */
/* MOVE_MIME marker type, readable during dragover like any type).      */
/*                                                                     */
/* Resolver: `resolveDrop` absorbs the monolith's computeInsertion      */
/* (section-seam midpoint rule), widgetInsertPos (`:scope > [data-w]`   */
/* midpoint rule) and the facade drop target (flush single-commerce     */
/* container has no [data-col] — its section box IS its one column).    */
/* The scattered originals in editor-canvas/[slug]/page.tsx are gone.   */
/*                                                                     */
/* Placeholder: a REAL `<div class="ffcms-drop-ph">` inserted into the  */
/* page flow at the resolved slot — ARCH-CANVAS §5.3's decision,        */
/* deliberately NOT the transform-push-apart variant: transforms on     */
/* theme-owned nodes (a) move only the two neighbors without making     */
/* room, so the gap overlaps the next sibling down, (b) create CSS      */
/* containing blocks that break the absolutely-positioned internals of  */
/* real theme sections (hero slides, deal-of-day media), and (c) fight  */
/* the outline pass, which writes inline styles on those same nodes.    */
/* A physical element in the flow opens a genuine gap, costs no         */
/* per-node bookkeeping, and is what Elementor itself does              */
/* (jquery-html5-dnd.js insertPlaceholder). It is tracked by ONE ref,   */
/* MOVED (never recreated) when the slot changes, sized to the dragged  */
/* item's height for same-window drags (48px for palette drags, whose   */
/* height is unknowable mid-drag), and removed on leave / drop /        */
/* dragend / Escape. It carries no data markers, so the hit-tester and  */
/* the `:scope > [data-w]` math never see it.                           */
/* ------------------------------------------------------------------ */

import { accent, radius } from "../design"
import { flushSingleCommerceWidget } from "../../document/facade"
import { hitTest } from "./hit-test"
import {
  BLOCK_MIME,
  WIDGET_MIME,
  type CmsCommandEnvelope,
  type CmsSection,
} from "./protocol"

/* ---------------- payload ------------------------------------------- */

/** Marker TYPE announcing "this drag MOVES an existing node" so drop
 *  targets can tell a navigator/grip move from a palette insert during
 *  dragover (when payload bytes are unreadable). Carries no data. */
export const MOVE_MIME = "application/x-ff-move"

/** Where a MOVED widget comes from (the grips' `moveFrom` wire shape). */
export type WidgetSource = { index: number; colPath: number[]; wi: number }

/** THE payload union — every drag source normalizes to this. */
export type DragPayload =
  | { op: "new"; what: "section"; type: string; presetIndex?: number }
  | { op: "new"; what: "widget"; type: string }
  | { op: "move"; what: "section"; from: number }
  | { op: "move"; what: "widget"; from: WidgetSource }

/** One decoded DataTransfer. A commerce palette card carries BOTH a
 *  section and a widget representation; every other source carries one. */
export type DecodedDrag = {
  section?: Extract<DragPayload, { what: "section" }>
  widget?: Extract<DragPayload, { what: "widget" }>
}

const isNums = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 0)

const isWidgetSource = (v: unknown): v is WidgetSource => {
  const s = v as WidgetSource | null
  return (
    !!s &&
    typeof s === "object" &&
    typeof s.index === "number" &&
    isNums(s.colPath) &&
    s.colPath.length % 2 === 1 &&
    typeof s.wi === "number"
  )
}

/** Decode a DataTransfer into the one payload vocabulary. Readable at
 *  dragstart and drop only (protected during dragover, by spec). */
export function decodeDrag(dt: DataTransfer | null): DecodedDrag | null {
  if (!dt) return null
  const out: DecodedDrag = {}
  try {
    const raw = dt.getData(BLOCK_MIME)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p?.reorderFrom === "number") {
        out.section = { op: "move", what: "section", from: p.reorderFrom }
      } else if (typeof p?.block_type === "string" && p.block_type) {
        out.section = {
          op: "new",
          what: "section",
          type: p.block_type,
          ...(typeof p.presetIndex === "number"
            ? { presetIndex: p.presetIndex }
            : {}),
        }
      }
    }
  } catch {}
  try {
    const raw = dt.getData(WIDGET_MIME)
    if (raw) {
      const p = JSON.parse(raw)
      if (isWidgetSource(p?.moveFrom)) {
        out.widget = { op: "move", what: "widget", from: p.moveFrom }
      } else if (typeof p?.widget_type === "string" && p.widget_type) {
        out.widget = { op: "new", what: "widget", type: p.widget_type }
      }
    }
  } catch {}
  return out.section || out.widget ? out : null
}

/** What a DataTransfer CAN mean, from its readable `types` — the only
 *  honest information during dragover. `move` is true for grip/navigator
 *  drags (marker type or the same-window mirror). */
export type DragCaps = { section: boolean; widget: boolean; move: boolean }

export function dragCaps(dt: DataTransfer | null): DragCaps | null {
  const types = Array.from(dt?.types ?? [])
  const section = types.includes(BLOCK_MIME)
  const widget = types.includes(WIDGET_MIME)
  if (!section && !widget) return null
  const mirror = active?.decoded
  const move =
    types.includes(MOVE_MIME) ||
    mirror?.widget?.op === "move" ||
    mirror?.section?.op === "move"
  return { section, widget, move }
}

/** Arm a DataTransfer with a widget MOVE — the one writer for move
 *  drags outside the canvas window (NavigatorTree rows). Same wire the
 *  canvas widget grip speaks, plus the MOVE_MIME marker. */
export function startWidgetMoveDrag(
  dt: DataTransfer,
  from: WidgetSource
): void {
  dt.setData(WIDGET_MIME, JSON.stringify({ widget_type: "", moveFrom: from }))
  dt.setData(MOVE_MIME, "widget")
  dt.effectAllowed = "move"
}

/* ---------------- same-window drag mirror ---------------------------- */

type ActiveDrag = { decoded: DecodedDrag; height: number }
let active: ActiveDrag | null = null

const PH_DEFAULT_HEIGHT = 48
const PH_MIN_HEIGHT = 24
const PH_MAX_HEIGHT = 220

/** Record the payload (readable during dragstart) + the dragged node's
 *  height for the placeholder. Call from a window `dragstart` listener;
 *  no-ops for drags that are not ours. */
export function noteDragStart(
  dt: DataTransfer | null,
  source: Element | null
): void {
  const decoded = decodeDrag(dt)
  if (!decoded) {
    active = null
    return
  }
  let height = PH_DEFAULT_HEIGHT
  const el = source?.closest?.("[data-w], [data-cms-idx]") as Element | null
  const h = el?.getBoundingClientRect().height ?? 0
  if (h > 0) {
    height = Math.max(PH_MIN_HEIGHT, Math.min(Math.round(h), PH_MAX_HEIGHT))
  }
  active = { decoded, height }
}

export function noteDragEnd(): void {
  active = null
}

/** The mirrored payload of a same-window drag, or null (shell drags). */
export function activeDrag(): ActiveDrag | null {
  return active
}

/* ---------------- pure content readers ------------------------------- */
/* Read-only twins of the registry's widgetsAtPath — kept here so the
   canvas bundle does not pull the whole command registry (and its panel
   component imports) just to validate a drag. */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

function widgetsAt(
  content: CmsSection[],
  index: number,
  colPath: number[]
): any[] | null {
  const sec: any = content?.[index]
  if (!sec || !isNums(colPath) || colPath.length % 2 !== 1) return null
  let cols: any = sec.columns
  for (let i = 0; i < colPath.length; i++) {
    if (!Array.isArray(cols)) return null
    const col = cols[colPath[i]]
    if (!col) return null
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    if (i === colPath.length - 1) return ws
    const w = ws[colPath[++i]]
    if (!w || w.widget_type !== "inner_section") return null
    cols = w.columns
  }
  return null
}

function widgetTypeAt(
  content: CmsSection[],
  src: WidgetSource
): string | null {
  const ws = widgetsAt(content, src.index, src.colPath)
  const w = ws?.[src.wi]
  return isObj(w) && typeof w.widget_type === "string" ? w.widget_type : null
}

/* ---------------- the drop target ------------------------------------ */

export type Rect = { top: number; left: number; width: number; height: number }

export type DropTarget =
  /** Between two top-level sections (index = insertion index 0..N). */
  | { kind: "seam"; index: number; top: number; label: string }
  /** Inside a container column, before its `wi`-th direct widget. */
  | { kind: "column"; index: number; colPath: number[]; wi: number; el: HTMLElement; rect: Rect }
  /** Onto a collapsed facade — its single implicit column ([0], wi 1). */
  | { kind: "facade"; index: number; wi: number; el: HTMLElement; rect: Rect }

const numsEq = (a: number[], b: number[]) =>
  a.length === b.length && a.every((n, i) => n === b[i])

/** Value identity, so dragover ticks don't churn state per pixel. */
export function dropTargetEq(
  a: DropTarget | null,
  b: DropTarget | null
): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  if (a.kind === "seam" && b.kind === "seam") {
    return a.index === b.index && a.top === b.top && a.label === b.label
  }
  if (a.kind === "column" && b.kind === "column") {
    return (
      a.index === b.index &&
      a.wi === b.wi &&
      numsEq(a.colPath, b.colPath) &&
      a.rect.top === b.rect.top &&
      a.rect.height === b.rect.height
    )
  }
  if (a.kind === "facade" && b.kind === "facade") {
    return a.index === b.index && a.wi === b.wi && a.rect.top === b.rect.top
  }
  return false
}

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/* The element a section's seam math measures. Moved VERBATIM from the
   canvas monolith (it also imports it back for its outline passes): an
   un-styled section is a display:contents wrapper (no box), so measure
   its first real child; a zero-height box falls back to the tallest
   child (hero sliders' out-of-flow slides). */
export function outlineTarget(w: Element | null | undefined): HTMLElement | null {
  if (!w) {
    return null
  }
  const el = w as HTMLElement
  const isContents =
    typeof window !== "undefined" &&
    getComputedStyle(el).display === "contents"
  let target: HTMLElement | null = isContents
    ? (el.firstElementChild as HTMLElement | null)
    : el

  const heightOf = (n: Element | null) =>
    n ? Math.round(n.getBoundingClientRect().height) : 0

  if (heightOf(target) === 0) {
    let best: HTMLElement | null = null
    let bestH = 0
    for (const child of Array.from(el.children)) {
      if (child.tagName === "STYLE") {
        continue
      }
      const h = heightOf(child)
      if (h > bestH) {
        bestH = h
        best = child as HTMLElement
      }
    }
    if (best) {
      target = best
    }
  }

  return target
}

/** Where a section dropped at `clientY` would insert: before the first
 *  section whose midpoint the pointer is above (0..N). `top` is the
 *  viewport Y of that boundary. (The monolith's computeInsertion,
 *  verbatim — the in-flow placeholder shifts these rects, but the math
 *  is self-consistent: a pointer inside the gap stays above the same
 *  midpoint, so the resolved index is stable, not oscillating.) */
function seamAt(
  root: HTMLElement,
  clientY: number
): { index: number; top: number } {
  const wrappers = Array.from(
    root.querySelectorAll<HTMLElement>("[data-cms-idx]")
  )
  let lastBottom = 0
  let count = 0
  for (const w of wrappers) {
    const el = outlineTarget(w)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) {
      return { index: Number(w.dataset.cmsIdx), top: rect.top }
    }
    lastBottom = rect.bottom
    count = Number(w.dataset.cmsIdx) + 1
  }
  return { index: count, top: lastBottom }
}

/** Insertion position within a column: before the first direct widget
 *  whose midpoint the pointer is above. (The monolith's widgetInsertPos;
 *  `:scope >` so inner-section widgets are not siblings — and so the
 *  markerless placeholder is invisible to it.) */
function widgetSlotAt(colEl: HTMLElement, clientY: number): number {
  const kids = Array.from(
    colEl.querySelectorAll<HTMLElement>(":scope > [data-w]")
  )
  let wi = kids.length
  for (let i = 0; i < kids.length; i++) {
    const kr = kids[i].getBoundingClientRect()
    if (clientY < kr.top + kr.height / 2) {
      wi = i
      break
    }
  }
  return wi
}

/* ---------------- THE resolver --------------------------------------- */

/**
 * Pointer + hit chain + drag capabilities → the one DropTarget (or null).
 *
 * Priority (ARCH-CANVAS §5.2): innermost column slot → facade column →
 * section seam. Validity lives HERE: a widget-capable drag over a column
 * or facade targets it; a MOVE-only widget drag anywhere else targets
 * nothing (a move never auto-wraps); everything else falls to the seam —
 * a section insert when the drag has a section representation, a wrapped
 * widget insert when it does not.
 */
export function resolveDrop(opts: {
  root: HTMLElement
  target: EventTarget | null
  clientY: number
  dt: DataTransfer | null
  content: CmsSection[]
}): DropTarget | null {
  const { root, target, clientY, dt, content } = opts
  const caps = dragCaps(dt)
  if (!caps) return null
  const chain = hitTest(target)
  if (chain.overlay) return null

  const moveWidget = active?.decoded.widget?.op === "move"
    ? active.decoded.widget.from
    : null
  const widgetMoveDrag =
    caps.move && caps.widget && !caps.section

  if (caps.widget) {
    // 1. Innermost column slot.
    if (chain.column) {
      const { el, index, colPath } = chain.column
      const wi = widgetSlotAt(el, clientY)
      // Self / descendant rejection for same-window moves: an inner
      // section may not be dropped into one of its own columns.
      if (
        moveWidget &&
        moveWidget.index === index &&
        colPath.length > moveWidget.colPath.length &&
        [...moveWidget.colPath, moveWidget.wi].every(
          (n, i) => colPath[i] === n
        )
      ) {
        return null
      }
      return { kind: "column", index, colPath, wi, el, rect: rectOf(el) }
    }
    // 2. Collapsed facade: pure theme markup, no [data-col] — the section
    //    box IS its single column; the shell clears `flush` on insert.
    if (chain.section && content[chain.section.index]) {
      if (flushSingleCommerceWidget(content[chain.section.index] as any)) {
        const el = outlineTarget(chain.section.el) ?? chain.section.el
        const fr = rectOf(el)
        return {
          kind: "facade",
          index: chain.section.index,
          // Pointer-half rule (same feel as widgetSlotAt): top half lands
          // the drop BEFORE the themed content, bottom half after it.
          wi: clientY < fr.top + fr.height / 2 ? 0 : 1,
          el: chain.section.el,
          rect: fr,
        }
      }
    }
  }

  // 3. Section seam. A widget MOVE never lands here (moving is not
  //    wrapping — rebuilding context around an existing widget is a
  //    different intent the merchant did not express).
  if (widgetMoveDrag) return null
  const pos = seamAt(root, clientY)
  const label = caps.section
    ? caps.move
      ? "Move section here"
      : "New section"
    : "New section for this element"
  return { kind: "seam", index: pos.index, top: pos.top, label }
}

/* ---------------- drop → command ------------------------------------- */

/**
 * The full move/insert matrix, in one place:
 *
 *   source \ target        seam                 column                facade
 *   palette section card   section.insert       —(resolver: seam)     —
 *   commerce card (dual)   section.insert       widget.insert         widget.insert
 *   palette widget card    widget.insertWrapped widget.insert         widget.insert
 *   section grip (move)    section.move         —(resolver: seam)     —
 *   widget grip (move)     —(resolver: null)    widget.move/transfer  widget.transfer
 *   navigator widget row   —(resolver: null)    widget.move/transfer  widget.transfer
 *
 * Same column → widget.move (unchanged command); any other column,
 * section or facade → widget.transfer (the existing widget OBJECT moves;
 * content, style bags, advanced bags intact).
 */
export function commandForDrop(
  decoded: DecodedDrag,
  target: DropTarget,
  content: CmsSection[]
): CmsCommandEnvelope | null {
  if (target.kind === "seam") {
    const s = decoded.section
    if (s?.op === "move") {
      const to = s.from < target.index ? target.index - 1 : target.index
      if (to === s.from) return null
      return { name: "section.move", args: { from: s.from, to } }
    }
    if (s?.op === "new") {
      return {
        name: "section.insert",
        args: {
          at: target.index,
          type: s.type,
          ...(typeof s.presetIndex === "number"
            ? { presetIndex: s.presetIndex }
            : {}),
        },
      }
    }
    if (decoded.widget?.op === "new") {
      return {
        name: "widget.insertWrapped",
        args: { at: target.index, type: decoded.widget.type },
      }
    }
    return null
  }

  // Column-shaped targets: a facade IS its single column ([0], after the
  // one commerce widget → wi 1; the shell clears `flush` on the insert).
  const index = target.index
  const colPath = target.kind === "facade" ? [0] : target.colPath
  const wi = target.wi

  const w = decoded.widget
  if (!w) return null

  if (w.op === "new") {
    // One level of nesting — an inner section cannot hold another.
    if (w.type === "inner_section" && colPath.length > 1) return null
    return {
      name: "widget.insert",
      args: { index, colPath, wi, type: w.type },
    }
  }

  // MOVE. Same column → reorder (widget.move, unchanged); else transfer.
  const from = w.from
  const sameColumn =
    from.index === index && numsEq(from.colPath, colPath)
  if (sameColumn) {
    // Dropping back onto its own slot (either edge) is a no-op.
    if (wi === from.wi || wi === from.wi + 1) return null
    return {
      name: "widget.move",
      args: { index, colPath, from: from.wi, to: wi },
    }
  }
  const movedType = widgetTypeAt(content, from)
  if (!movedType) return null
  if (movedType === "inner_section" && colPath.length > 1) return null
  // Self / descendant rejection (registry guards it too — belt and braces).
  if (
    from.index === index &&
    colPath.length > from.colPath.length &&
    [...from.colPath, from.wi].every((n, i) => colPath[i] === n)
  ) {
    return null
  }
  return {
    name: "widget.transfer",
    args: {
      from: { index: from.index, colPath: from.colPath, wi: from.wi },
      to: { index, colPath, wi },
    },
  }
}

/* ---------------- the in-flow placeholder ----------------------------- */

export const PH_CLASS = "ffcms-drop-ph"

/**
 * The gap that opens. One physical element, moved between slots, never
 * recreated (recreating restarts the CSS height transition every tick).
 *
 *   column target → inside the column, before its wi-th direct [data-w]
 *   seam target   → in the body flow, before the section wrapper at
 *                   `index` (after the last wrapper for index == N)
 *   facade target → inside the section wrapper, before or after the
 *                   facade's one commerce widget (pointer-half rule) —
 *                   exactly where the inserted widget will land
 *
 * pointer-events:none so dragover resolves against what is under the
 * gap's place in the flow (its column / the seam's neighbors), keeping
 * the resolver's math stable while the layout is open.
 */
export class DropPlaceholder {
  private el: HTMLDivElement | null = null
  private slot: string | null = null

  private ensure(): HTMLDivElement {
    if (this.el) return this.el
    const el = document.createElement("div")
    el.className = PH_CLASS
    el.setAttribute("aria-hidden", "true")
    Object.assign(el.style, {
      boxSizing: "border-box",
      height: "0px",
      margin: "4px 0",
      border: `1.5px dashed ${accent.base}`,
      borderRadius: `${radius.sm}px`,
      background: accent.tint,
      pointerEvents: "none",
      transition: "height 140ms ease",
      overflow: "hidden",
    })
    this.el = el
    return el
  }

  /** Open (or move) the gap for `target`; null closes it. */
  sync(target: DropTarget | null, root: HTMLElement, height: number): void {
    if (!target) {
      this.clear()
      return
    }
    let parent: HTMLElement | null = null
    let before: Element | null = null
    let slot: string
    if (target.kind === "column") {
      parent = target.el
      const kids = parent.querySelectorAll<HTMLElement>(":scope > [data-w]")
      before = kids[target.wi] ?? null
      slot = `col:${target.index}:${target.colPath.join("-")}:${target.wi}`
    } else if (target.kind === "facade") {
      parent = root.querySelector<HTMLElement>(
        `[data-cms-idx="${target.index}"]`
      )
      before =
        target.wi === 0 ? (parent?.firstElementChild ?? null) : null
      slot = `facade:${target.index}:${target.wi}`
    } else {
      const wrapper = root.querySelector<HTMLElement>(
        `[data-cms-idx="${target.index}"]`
      )
      if (wrapper) {
        parent = wrapper.parentElement
        before = wrapper
      } else {
        // index == N: after the last section wrapper.
        const all = root.querySelectorAll<HTMLElement>("[data-cms-idx]")
        const last = all[all.length - 1]
        if (last) {
          parent = last.parentElement
          before = last.nextSibling as Element | null
        }
      }
      slot = `seam:${target.index}`
    }
    if (!parent) {
      this.clear()
      return
    }
    const el = this.ensure()
    const fresh = !el.isConnected
    if (this.slot !== slot || !el.isConnected) {
      parent.insertBefore(el, before)
      this.slot = slot
    }
    const px = `${Math.max(PH_MIN_HEIGHT, height)}px`
    if (fresh) {
      // Grow 0 → height so the layout visibly opens (one frame at 0).
      el.style.height = "0px"
      requestAnimationFrame(() => {
        if (this.el === el && el.isConnected) el.style.height = px
      })
    } else if (el.style.height !== px) {
      el.style.height = px
    }
  }

  clear(): void {
    if (this.el) {
      this.el.remove()
      this.el.style.height = "0px"
    }
    this.slot = null
  }
}
