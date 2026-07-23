/* ------------------------------------------------------------------ */
/* Canvas hit-tester (CANVAS P1 — parity).                              */
/*                                                                     */
/* ONE resolver from an event target to the editor nodes under it,      */
/* built on the DOM address markers the renderers already emit:         */
/*   [data-cms-idx]     section wrapper (top-level, never nested)       */
/*   [data-col]         container column ("0" or "0-1-2" inner paths)   */
/*   [data-w]           widget ("w-0-1", "w-0-1-2-3" inner paths)       */
/*   [data-el]          styleable element (sections AND chrome)         */
/*   [data-el-item]     repeated item ("slides:2")                      */
/*   [data-cms-chrome]  chrome region (header/topbar/footer)            */
/*   [data-cms-overlay] editor chrome — never a page target             */
/*                                                                     */
/* This replaces the scattered closest() chains that lived inline in    */
/* the canvas's click / mousemove / contextmenu / drag handlers. The    */
/* resolution rules (containment guards, innermost-wins) are copied     */
/* from those handlers verbatim — same behavior, one implementation.    */
/* ------------------------------------------------------------------ */

/* ---------------- marker parsers (moved verbatim from the canvas) --- */

/* Parse a widget DOM marker into its PATH — the chain of (column, widget)
   indices from the section down to the widget. "w-0-1" is column 0 / widget 1;
   "w-0-1-2-3" is the widget at column 2 / index 3 INSIDE the inner section at
   column 0 / index 1. Always an even-length array. Null for anything else. */
export function parseWidgetPath(v: string | null): number[] | null {
  const s = v ?? ""
  if (!/^w-\d+(?:-\d+)+$/.test(s)) return null
  const nums = s.slice(2).split("-").map(Number)
  if (nums.length < 2 || nums.length % 2 !== 0) return null
  return nums.every((n) => Number.isInteger(n) && n >= 0) ? nums : null
}

/* Parse a column marker `data-col="0"` (top level) or `data-col="0-1-2"`
   (column 2 of the inner section at column 0 / widget 1). */
export function parseColPath(v: string | null): number[] | null {
  const s = (v ?? "").trim()
  if (!/^\d+(?:-\d+)*$/.test(s)) return null
  const nums = s.split("-").map(Number)
  // A column path is odd-length: [c] or [c, wi, c2] …
  if (!nums.length || nums.length % 2 === 0) return null
  return nums.every((n) => Number.isInteger(n) && n >= 0) ? nums : null
}

/** Is this widget path inside an inner section? (deeper than one level) */
export const isNestedPath = (p: number[]): boolean => p.length > 2

/* Parse a repeated-item DOM marker `data-el-item="<arrayProp>:<index>"` —
   the slide / banner tile / testimonial the cursor is inside, carried as the
   section prop array's name plus the item's ORIGINAL index in that array. */
export function parseItemMarker(
  v: string | null
): { field: string; index: number } | null {
  const m = /^([A-Za-z_][A-Za-z0-9_]*):(\d+)$/.exec(v ?? "")
  return m ? { field: m[1], index: Number(m[2]) } : null
}

/* ---------------- owner lookups (for node ENUMERATION passes) ------- */
/* The outline effects iterate every [data-el]/[data-w] and ask which    */
/* section or chrome region OWNS each node — same closest() walk as the  */
/* event path, exported here so it exists exactly once.                  */

/** The section index owning `el`, or null when it is not inside one. */
export function ownerSectionIndex(el: Element): number | null {
  const w = el.closest("[data-cms-idx]") as HTMLElement | null
  if (!w) return null
  const idx = Number(w.dataset.cmsIdx)
  return Number.isFinite(idx) ? idx : null
}

/** The section wrapper element owning `el`, or null. */
export function ownerSectionEl(el: Element): HTMLElement | null {
  return el.closest("[data-cms-idx]") as HTMLElement | null
}

/** The chrome region owning `el` ("header" | "topbar" | "footer"), or null. */
export function ownerChromeRegion(el: Element): string | null {
  const cw = el.closest("[data-cms-chrome]") as HTMLElement | null
  return cw?.getAttribute("data-cms-chrome") ?? null
}

/* ---------------- the hit types ------------------------------------- */

/** One resolved node under the pointer — the discriminated address. */
export type NodeHit =
  | { t: "section"; index: number; el: HTMLElement }
  | { t: "column"; index: number; colPath: number[]; el: HTMLElement }
  | { t: "widget"; index: number; path: number[]; el: HTMLElement }
  | { t: "element"; index: number; key: string; el: HTMLElement }
  | { t: "chrome"; region: string; el: HTMLElement }
  | { t: "chromeElement"; region: string; key: string; el: HTMLElement }

/**
 * Everything under one event target, each level resolved independently
 * (the handlers need several levels at once to apply their own priority
 * rules — widget beats element beats section, etc.).
 *
 * Guards match the monolith's originals exactly:
 * - `column` / `widget` / `element` require containment in `section`.
 * - `chromeElement` requires the element NOT be inside a section and BE
 *   contained in the chrome region (the mousemove/click rule).
 * - `item` requires containment in `section`.
 */
export type HitChain = {
  /** Inside editor overlay chrome ([data-cms-overlay]) — handlers bail. */
  overlay: boolean
  section: { el: HTMLElement; index: number } | null
  /** Innermost column, contained in `section`. */
  column: { el: HTMLElement; index: number; colPath: number[] } | null
  /** Innermost widget, contained in `section`. */
  widget: { el: HTMLElement; index: number; path: number[] } | null
  /** Innermost [data-el] contained in `section` (section elements only). */
  element: { el: HTMLElement; index: number; key: string } | null
  /** Innermost chrome region under the target. */
  chrome: { el: HTMLElement; region: string } | null
  /** [data-el] inside chrome (and NOT inside any section). */
  chromeElement: { el: HTMLElement; region: string; key: string } | null
  /** Repeated item (slide / banner tile …), contained in `section`. */
  item: { el: HTMLElement; field: string; index: number } | null
  /** Nearest real anchor — the link-click interception needs it. */
  anchor: HTMLAnchorElement | null
}

/* ---------------- the hit-tester ------------------------------------ */

/**
 * Resolve an event target to every editor node above it. Pure DOM walk —
 * no state, no measurement — so it is safe from any handler (click,
 * mousemove, contextmenu, dragover, drop).
 */
export function hitTest(target: EventTarget | null): HitChain {
  const t = target as HTMLElement | null
  const miss: HitChain = {
    overlay: false,
    section: null,
    column: null,
    widget: null,
    element: null,
    chrome: null,
    chromeElement: null,
    item: null,
    anchor: null,
  }
  if (!t || typeof t.closest !== "function") return miss

  const overlay = !!t.closest("[data-cms-overlay]")

  const secEl = t.closest("[data-cms-idx]") as HTMLElement | null
  const secIdx = secEl ? Number(secEl.dataset.cmsIdx) : NaN
  const section =
    secEl && Number.isFinite(secIdx) ? { el: secEl, index: secIdx } : null

  const chromeEl = t.closest("[data-cms-chrome]") as HTMLElement | null
  const chromeRegion = chromeEl?.getAttribute("data-cms-chrome") ?? null
  const chrome =
    chromeEl && chromeRegion ? { el: chromeEl, region: chromeRegion } : null

  // Innermost column — real only when owned by the hit section (the drag
  // handlers' columnAt() rule).
  let column: HitChain["column"] = null
  const colEl = t.closest("[data-col]") as HTMLElement | null
  if (colEl && section && section.el.contains(colEl)) {
    const colPath = parseColPath(colEl.getAttribute("data-col"))
    if (colPath) column = { el: colEl, index: section.index, colPath }
  }

  // Innermost widget — owned by the hit section (mousemove/click rule).
  let widget: HitChain["widget"] = null
  const wEl = t.closest("[data-w]") as HTMLElement | null
  if (wEl && section && section.el.contains(wEl)) {
    const path = parseWidgetPath(wEl.getAttribute("data-w"))
    if (path) widget = { el: wEl, index: section.index, path }
  }

  // Innermost [data-el]: a SECTION element when owned by the hit section;
  // a CHROME element when there is no section and the chrome region owns it
  // (exactly the mousemove `elw && !w` split).
  let element: HitChain["element"] = null
  let chromeElement: HitChain["chromeElement"] = null
  const elEl = t.closest("[data-el]") as HTMLElement | null
  const elKey = elEl?.getAttribute("data-el") || null
  if (elEl && elKey) {
    if (section && section.el.contains(elEl)) {
      element = { el: elEl, index: section.index, key: elKey }
    } else if (!section && chrome && chrome.el.contains(elEl)) {
      chromeElement = { el: elEl, region: chrome.region, key: elKey }
    }
  }

  // Repeated item — owned by the hit section (context-menu rule).
  let item: HitChain["item"] = null
  const itemEl = t.closest("[data-el-item]") as HTMLElement | null
  if (itemEl && section && section.el.contains(itemEl)) {
    const parsed = parseItemMarker(itemEl.getAttribute("data-el-item"))
    if (parsed) item = { el: itemEl, field: parsed.field, index: parsed.index }
  }

  const anchor = t.closest("a") as HTMLAnchorElement | null

  return {
    overlay,
    section,
    column,
    widget,
    element,
    chrome,
    chromeElement,
    item,
    anchor,
  }
}

/**
 * The single innermost node of a chain, by the editor's priority rule
 * (widget beats element beats column beats section; chrome element beats
 * its region). Not used by the parity commit's handlers — they need the
 * whole chain — but this is the NodeHit the later selection unification
 * consumes.
 */
export function innermostOf(hit: HitChain): NodeHit | null {
  if (hit.widget) {
    return {
      t: "widget",
      index: hit.widget.index,
      path: hit.widget.path,
      el: hit.widget.el,
    }
  }
  if (hit.element) {
    return {
      t: "element",
      index: hit.element.index,
      key: hit.element.key,
      el: hit.element.el,
    }
  }
  if (hit.column) {
    return {
      t: "column",
      index: hit.column.index,
      colPath: hit.column.colPath,
      el: hit.column.el,
    }
  }
  if (hit.section) {
    return { t: "section", index: hit.section.index, el: hit.section.el }
  }
  if (hit.chromeElement) {
    return {
      t: "chromeElement",
      region: hit.chromeElement.region,
      key: hit.chromeElement.key,
      el: hit.chromeElement.el,
    }
  }
  if (hit.chrome) {
    return { t: "chrome", region: hit.chrome.region, el: hit.chrome.el }
  }
  return null
}
