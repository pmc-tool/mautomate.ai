/* ------------------------------------------------------------------ */
/* Inline editing (CANVAS P6 / seat 3B — ARCH-CANVAS §6).               */
/*                                                                     */
/* Elementor's type-where-you-see-it loop, without an editor library:   */
/* native contentEditable on the exact node the merchant clicked, a     */
/* field-path marker contract, and sanitize-on-commit.                  */
/*                                                                     */
/*   - PLATFORM widgets (container-html.ts) carry                       */
/*     `data-edit="<field>" data-edit-mode="plain|rich"` on their       */
/*     text-bearing roots — editor branch only, live output untouched.  */
/*   - THEMED markup is addressed through its existing `data-el` /      */
/*     `data-el-item` markers via the per-block INLINE_MAPS             */
/*     (./inline-maps.ts). The commit HOST is facade-aware: a           */
/*     collapsed flush wrapper routes to its inner widget at [0,0] —    */
/*     the same route the shell's element panel writes through — so     */
/*     writeWidgetsAt's F1 rule KEEPS the facade collapsed (a content   */
/*     write never changes the widget count).                           */
/*                                                                     */
/* Every commit rides the EXISTING bus commands (`widget.setProps` /    */
/* `section.setProps`) with a per-session `txn`, so one editing         */
/* session is ONE labeled history entry and undo restores the           */
/* pre-session text (the history layer's txn coalescing, Phase 2A).     */
/*                                                                     */
/* SANITIZATION (layered, ARCH-CANVAS §6 mechanic 4 + P6 risk note):    */
/*   plain — the value is read as visible TEXT (innerText): markup      */
/*     cannot enter the document at all; paste is forced to text.       */
/*   rich  — innerHTML through the shared @lib/util/sanitize-html       */
/*     BEFORE dispatch. The same sanitizer runs again downstream        */
/*     (container-html + the theme engine escape/render path), so a     */
/*     canvas bypass still dies at the render gate.                     */
/*                                                                     */
/* RE-RENDER SUPPRESSION (§6 mechanic 3): while a session is active     */
/* the canvas must not rebuild the edited section under the caret.      */
/* The canvas's cms:patch handler asks `deferPatch()` first; the        */
/* freshest deferred section is both the commit BASE (so a late echo    */
/* never resurrects stale text) and the re-sync applied on exit.        */
/*                                                                     */
/* Framework-free (like dnd.ts's DropPlaceholder): the canvas page      */
/* owns React state; this module owns the DOM session.                  */
/* ------------------------------------------------------------------ */

import { sanitizeHtml } from "@lib/util/sanitize-html"
import { accent } from "../design"
import { flushSingleCommerceWidget } from "../../document/facade"
import { isCommerceWidget } from "../../schema/widgets"
import type { HitChain } from "./hit-test"
import type { CmsCommandEnvelope, CmsSection } from "./protocol"
import { inlineEntryOf, type InlineMode } from "./inline-maps"

/* ---------------- target resolution ---------------------------------- */

/** Where an inline commit lands. `widget` covers all three widget-shaped
 *  hosts (platform widget, commerce widget in a column, and a collapsed
 *  facade's inner widget at path [0,0]); `section` is the legacy flat
 *  themed section (pre-normalization shape — defensive, the canvas
 *  normalizes on load so it should not occur). */
export type InlineHost =
  | { kind: "widget"; index: number; path: number[] }
  | { kind: "section"; index: number }

/** One resolved inline-editable text node. */
export type InlineTarget = {
  host: InlineHost
  /** Dot path into the host's props ("text", "cta.label", "slides.2.title"). */
  fieldPath: string
  mode: InlineMode
  /** Plain only: whether Enter inserts a newline (textarea-backed field). */
  multiline: boolean
  /** The node that becomes contentEditable. */
  el: HTMLElement
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/**
 * A PLAIN target must be a text-only node: children may be text nodes,
 * comments and <br> only. Anything structural (a theme nesting an icon
 * in a button, an avatar in an author line) fails — the element stays
 * panel-edited rather than letting a text write clobber markup the
 * field does not own.
 */
function isPlainTextNode(el: HTMLElement): boolean {
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.COMMENT_NODE) {
      continue
    }
    if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === "BR") {
      continue
    }
    return false
  }
  return true
}

/**
 * Resolve the hit chain under a click to an inline-editable target, or
 * null (no inline affordance — the click keeps its selection meaning).
 *
 * Priority mirrors the click ladder: a platform widget's own data-edit
 * marker wins; otherwise a themed data-el element resolves through the
 * per-block inline map with a facade-aware host.
 */
export function resolveInlineTarget(
  hit: HitChain,
  content: CmsSection[] | null
): InlineTarget | null {
  // PLATFORM widgets — the data-edit marker IS the contract.
  const wEl = hit.widget?.el ?? null
  if (wEl && hit.widget && wEl.hasAttribute("data-edit")) {
    const field = wEl.getAttribute("data-edit") || ""
    if (!field) return null
    const mode: InlineMode =
      wEl.getAttribute("data-edit-mode") === "rich" ? "rich" : "plain"
    if (mode === "plain" && !isPlainTextNode(wEl)) return null
    return {
      host: { kind: "widget", index: hit.widget.index, path: hit.widget.path },
      fieldPath: field,
      mode,
      // The rich body edits free-form; plain platform fields (heading
      // text, button label) are single-line inputs in the panel too.
      multiline: mode === "rich",
      el: wEl,
    }
  }

  // THEMED markup — data-el + the block's inline map.
  if (!hit.element || !content) return null
  const index = hit.element.index
  const sec = content[index]
  if (!isObj(sec)) return null

  let host: InlineHost
  let blockType: string
  if (
    hit.widget &&
    hit.widget.el.classList.contains("ff-commerce-widget") &&
    hit.widget.el.contains(hit.element.el)
  ) {
    // A commerce widget in a real container: theme markup under [data-w].
    blockType = hit.widget.el.getAttribute("data-widget-type") || ""
    host = { kind: "widget", index, path: hit.widget.path }
  } else {
    const inner = flushSingleCommerceWidget(sec as any)
    if (inner) {
      // Collapsed facade: props live on the inner widget at [0,0] — the
      // exact route the shell's element panel content form writes.
      blockType = String(inner.widget_type)
      host = { kind: "widget", index, path: [0, 0] }
    } else if (isCommerceWidget(sec.block_type)) {
      // Flat legacy section (defensive — load-path normalization wraps
      // these; a mid-session denormalized shape still commits correctly).
      blockType = String(sec.block_type)
      host = { kind: "section", index }
    } else {
      return null
    }
  }

  const entry = inlineEntryOf(blockType, hit.element.key)
  if (!entry) return null

  let fieldPath = entry.path
  if (entry.itemField) {
    // The repeated-item index comes from the data-el-item marker the
    // hit-tester already parsed; a mapped item field with no marker in
    // this theme's markup cannot be addressed — no affordance.
    const item =
      hit.item && hit.item.field === entry.itemField ? hit.item : null
    if (!item) return null
    fieldPath = `${entry.itemField}.${item.index}.${entry.path}`
  }

  let el: HTMLElement | null = hit.element.el
  if (entry.within) {
    el = el.matches(entry.within)
      ? el
      : (el.querySelector(entry.within) as HTMLElement | null)
    if (!el) return null
  }
  if (entry.mode === "plain" && !isPlainTextNode(el)) return null

  return {
    host,
    fieldPath,
    mode: entry.mode,
    multiline: entry.multiline === true,
    el,
  }
}

/* ---------------- value plumbing ------------------------------------- */

/**
 * Immutably set a dot path ("slides.2.title") on a host object. Numeric
 * segments index arrays. A missing/mismatched intermediate ABORTS (null)
 * — inline editing updates fields the theme just rendered; it never
 * conjures structure.
 */
export function setFieldPath(
  host: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> | null {
  const segs = path.split(".").filter(Boolean)
  if (!segs.length) return null
  const write = (node: unknown, d: number): unknown => {
    const key = segs[d]
    const last = d === segs.length - 1
    if (/^\d+$/.test(key)) {
      if (!Array.isArray(node)) return null
      const i = Number(key)
      if (i < 0 || i >= node.length) return null
      const child = last ? value : write(node[i], d + 1)
      if (child === null && !last) return null
      const next = node.slice()
      next[i] = child
      return next
    }
    if (!isObj(node)) return null
    const child = last ? value : write(node[key], d + 1)
    if (child === null && !last) return null
    return { ...node, [key]: child }
  }
  const out = write(host, 0)
  return isObj(out) ? out : null
}

/** The widget object at an even-length [data-w] path WITHIN one section
 *  (walks columns/widgets pairs — the marker grammar hit-test parses). */
function widgetInSection(
  section: Record<string, unknown>,
  path: number[]
): Record<string, unknown> | null {
  if (!Array.isArray(path) || path.length < 2 || path.length % 2 !== 0) {
    return null
  }
  let cols: unknown = section.columns
  for (let d = 0; ; d += 2) {
    if (!Array.isArray(cols)) return null
    const col = cols[path[d]]
    if (!isObj(col)) return null
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    const w = ws[path[d + 1]]
    if (!isObj(w)) return null
    if (d + 2 >= path.length) return w
    if (w.widget_type !== "inner_section") return null
    cols = w.columns
  }
}

/**
 * Build the bus command for one committed value against the CURRENT
 * section object (the freshest deferred shell echo, else canvas state).
 * The registry does the actual write (widget.setProps routes through
 * writeWidgetsAt — same-count content write, facade `flush` KEPT).
 */
export function buildInlineCommand(
  target: InlineTarget,
  section: CmsSection,
  value: string
): CmsCommandEnvelope | null {
  const sec = section as unknown as Record<string, unknown>
  if (target.host.kind === "widget") {
    const w = widgetInSection(sec, target.host.path)
    if (!w) return null
    const updated = setFieldPath(w, target.fieldPath, value)
    if (!updated) return null
    return {
      name: "widget.setProps",
      args: {
        index: target.host.index,
        path: target.host.path,
        widget: updated,
      },
    }
  }
  const updated = setFieldPath(sec, target.fieldPath, value)
  if (!updated) return null
  return {
    name: "section.setProps",
    args: { index: target.host.index, section: updated },
  }
}

/* ---------------- the editing session -------------------------------- */

export type InlineHandlers = {
  /** Live canvas content (a ref read — never captured). */
  getContent: () => CmsSection[] | null
  /** Dispatch a bus command to the shell (postCommandToShell). */
  send: (cmd: CmsCommandEnvelope) => void
  /** Route Cmd+Z / Cmd+Shift+Z pressed INSIDE the editor to the bus. */
  undo: (redo: boolean) => void
  /** Session started/ended — the page re-runs outline/toolbar passes. */
  onActiveChange: (active: { index: number } | null) => void
  /** Apply the deferred shell patch held through the session (exit re-sync). */
  applyPatch: (index: number, section: CmsSection) => void
}

const DEBOUNCE_MS = 350

/** The thin "editing" treatment that replaces the selection outline. */
const EDITING_OUTLINE = `1px dashed ${accent.base}`

let txnCounter = 0

/**
 * One inline-editing session at a time (Elementor's model). The page
 * creates ONE instance and routes activation (click-on-selected /
 * double-click), patch deferral and preview/data resets through it.
 */
export class InlineEditor {
  private t: InlineTarget | null = null
  private held: { index: number; section: CmsSection } | null = null
  /** Last value dispatched this session (echo pending until deferPatch). */
  private lastSent: string | null = null
  /** True from a send until its cms:patch echo lands in deferPatch. */
  private echoPending = false
  private baseline = ""
  private txn = ""
  private timer: number | null = null
  private prev: {
    contentEditable: string
    outline: string
    outlineOffset: string
    draggable: boolean
  } | null = null
  private stopping = false

  constructor(private h: InlineHandlers) {}

  /** The active target, or null. */
  active(): InlineTarget | null {
    return this.t
  }

  /** Is the session editing inside section `index`? */
  isEditing(index: number): boolean {
    return this.t !== null && this.t.host.index === index
  }

  /** Is this DOM node inside the active editable? (clicks pass through) */
  containsNode(n: EventTarget | null): boolean {
    return (
      this.t !== null &&
      n instanceof Node &&
      (this.t.el === n || this.t.el.contains(n))
    )
  }

  /**
   * cms:patch interception (§6 mechanic 3): while editing section
   * `index`, the canvas must NOT rebuild its DOM under the caret. The
   * freshest section is held — it becomes the commit base immediately
   * and the exit re-sync when no further echo is due.
   */
  deferPatch(index: number, section: CmsSection): boolean {
    if (!this.isEditing(index)) return false
    this.held = { index, section }
    this.echoPending = false
    return true
  }

  /** Begin a session on a resolved target (idempotent on the same node). */
  start(target: InlineTarget, at?: { x: number; y: number }): void {
    if (this.t?.el === target.el) return
    if (this.t) this.stop()
    const el = target.el
    this.t = target
    this.held = null
    this.lastSent = null
    this.echoPending = false
    this.txn = `inline-${Date.now()}-${++txnCounter}`
    this.prev = {
      contentEditable: el.getAttribute("contenteditable") ?? "",
      outline: el.style.outline,
      outlineOffset: el.style.outlineOffset,
      draggable: el.draggable,
    }
    // plaintext-only keeps the DOM to text + <br> while typing/pasting
    // (Chrome/Safari/new Firefox); older engines fall back to true +
    // the paste/keydown guards below.
    if (target.mode === "plain") {
      try {
        el.contentEditable = "plaintext-only"
      } catch {
        el.contentEditable = "true"
      }
    } else {
      el.contentEditable = "true"
    }
    // The overlay's ember selection box is replaced by the thin editing
    // treatment; the page's outline pass skips [data-cms-editing] nodes.
    el.setAttribute("data-cms-editing", "")
    el.style.outline = EDITING_OUTLINE
    el.style.outlineOffset = "-1px"
    // Anchors (button labels) are natively draggable — a text-select
    // drag inside the editor must not start a link drag.
    el.draggable = false
    el.addEventListener("keydown", this.onKeyDown)
    el.addEventListener("input", this.onInput)
    el.addEventListener("paste", this.onPaste)
    el.addEventListener("blur", this.onBlur)
    this.baseline = this.readValue()
    el.focus({ preventScroll: true })
    placeCaret(el, at)
    this.h.onActiveChange({ index: target.host.index })
  }

  /**
   * End the session. Commits by default (Esc AND blur commit — §6
   * mechanic 2; undo is the road back). `commit: false` discards the
   * final un-dispatched keystrokes (already-dispatched ones stand —
   * they are one txn entry, one undo away).
   */
  stop(opts?: { commit?: boolean }): void {
    const t = this.t
    if (!t || this.stopping) return
    this.stopping = true
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    if (opts?.commit !== false) this.commit()
    const el = t.el
    el.removeEventListener("keydown", this.onKeyDown)
    el.removeEventListener("input", this.onInput)
    el.removeEventListener("paste", this.onPaste)
    el.removeEventListener("blur", this.onBlur)
    if (this.prev) {
      if (this.prev.contentEditable) {
        el.setAttribute("contenteditable", this.prev.contentEditable)
      } else {
        el.removeAttribute("contenteditable")
      }
      el.style.outline = this.prev.outline
      el.style.outlineOffset = this.prev.outlineOffset
      el.draggable = this.prev.draggable
    }
    el.removeAttribute("data-cms-editing")
    el.blur()
    const held = this.held
    const echoPending = this.echoPending
    this.t = null
    this.held = null
    this.prev = null
    this.lastSent = null
    this.echoPending = false
    this.stopping = false
    // Exit re-sync: apply the held patch only when it IS the final
    // truth. If a dispatch's echo is still in flight, the held section
    // is stale — dropping it lets the incoming cms:patch (no longer
    // deferred) rebuild the section with the final text, with no
    // intermediate stale flash.
    if (held && !echoPending) {
      this.h.applyPatch(held.index, held.section)
    }
    this.h.onActiveChange(null)
  }

  /* ---------------- session internals -------------------------------- */

  /** Read the field value from the DOM. plain = visible text (innerText
   *  keeps authored <br> line breaks as \n); rich = sanitized innerHTML. */
  private readValue(): string {
    const t = this.t
    if (!t) return ""
    if (t.mode === "rich") {
      // CANVAS-SIDE sanitize gate (P6 risk note): the shared sanitizer
      // runs BEFORE dispatch; the render paths sanitize again.
      return sanitizeHtml(t.el.innerHTML)
    }
    const text = (t.el.innerText ?? "").replace(/\u00a0/g, " ")
    return t.multiline ? text : text.replace(/\s*\n+\s*/g, " ")
  }

  /** Dispatch the current value if it changed since the last dispatch. */
  private commit(): void {
    const t = this.t
    if (!t) return
    const value = this.readValue()
    if (value === (this.lastSent ?? this.baseline)) return
    const content = this.h.getContent()
    const base = this.held?.section ?? content?.[t.host.index]
    if (!isObj(base)) return
    const cmd = buildInlineCommand(t, base as CmsSection, value)
    if (!cmd) return
    this.lastSent = value
    this.echoPending = true
    this.h.send({ ...cmd, txn: this.txn })
  }

  private onInput = (): void => {
    if (this.timer !== null) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.timer = null
      this.commit()
    }, DEBOUNCE_MS)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Keystrokes inside the editor NEVER reach the canvas's global
    // shortcuts (delete-selection, clipboard, the drag Esc handler…).
    e.stopPropagation()
    const t = this.t
    if (!t) return
    const meta = e.metaKey || e.ctrlKey
    const k = e.key.toLowerCase()
    if (e.key === "Escape") {
      e.preventDefault()
      this.stop()
      return
    }
    if (meta && k === "z") {
      // Cmd+Z inside routes to the BUS undo: the session's dispatches
      // are one txn history entry, so undo restores the pre-edit text.
      e.preventDefault()
      this.stop()
      this.h.undo(e.shiftKey)
      return
    }
    if (e.key === "Enter" && t.mode === "plain" && !t.multiline) {
      // Single-line field: Enter commits, like the panel input it maps.
      e.preventDefault()
      this.stop()
      return
    }
    if (meta && t.mode === "plain" && (k === "b" || k === "i" || k === "u")) {
      // Formatting cannot enter a plain field (contentEditable="true"
      // fallback engines would otherwise inject <b>/<i>/<u>).
      e.preventDefault()
    }
  }

  private onPaste = (e: ClipboardEvent): void => {
    const t = this.t
    if (!t) return
    if (t.mode === "rich") return // sanitized on commit (and again downstream)
    // Plain fields accept TEXT only, whatever was copied.
    e.preventDefault()
    let text = e.clipboardData?.getData("text/plain") ?? ""
    if (!t.multiline) text = text.replace(/\s*\n+\s*/g, " ")
    insertPlainText(t.el, text)
    this.onInput()
  }

  private onBlur = (): void => {
    this.stop()
  }
}

/* ---------------- DOM helpers ---------------------------------------- */

/** Insert plain text at the caret (execCommand still ships everywhere;
 *  the Range path covers engines that removed it). */
function insertPlainText(el: HTMLElement, text: string): void {
  const doc = el.ownerDocument
  try {
    if (doc.execCommand("insertText", false, text)) return
  } catch {
    /* fall through to the Range path */
  }
  const sel = doc.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return
  range.deleteContents()
  const node = doc.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Put the caret where the activating click landed (Elementor's feel),
 *  falling back to end-of-content. */
function placeCaret(el: HTMLElement, at?: { x: number; y: number }): void {
  const doc = el.ownerDocument
  const sel = doc.getSelection()
  if (!sel) return
  let range: Range | null = null
  if (at) {
    const d = doc as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null
    }
    if (typeof d.caretRangeFromPoint === "function") {
      range = d.caretRangeFromPoint(at.x, at.y)
    } else if (typeof d.caretPositionFromPoint === "function") {
      const p = d.caretPositionFromPoint(at.x, at.y)
      if (p) {
        range = doc.createRange()
        range.setStart(p.offsetNode, p.offset)
        range.collapse(true)
      }
    }
    if (range && !el.contains(range.startContainer)) range = null
  }
  if (!range) {
    range = doc.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}
