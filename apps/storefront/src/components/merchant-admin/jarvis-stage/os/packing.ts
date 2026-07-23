/* ------------------------------------------------------------------ */
/* Pixi OS — packing.ts. The pure geometry engine for Card Canvas v2. */
/*                                                                     */
/* A dependency-free, absolute-position PACKER working in GRID UNITS      */
/* (column x row). It seeds new cards into the first free top-left cell,    */
/* resolves drags/resizes by re-packing around a pinned card, and never      */
/* overlaps — including a reserved CENTER ORB-GUTTER band (a set of blocked     */
/* columns) so cards can never cover the mA core. Everything here is a pure     */
/* function of (layouts, geometry); the reducer in use-canvas-layout.ts owns     */
/* the state, and CardHost projects it to pixels. No React, no side effects.      */
/* ------------------------------------------------------------------ */

/** A card's placement in grid units. x/w are columns, y/h are row units. */
export type GridRect = { x: number; y: number; w: number; h: number }

/** The active grid geometry, derived by CardHost from the measured canvas. */
export type Geom = {
  cols: number // total columns spanning the full canvas width
  colW: number // px width of one column (excludes gap)
  rowH: number // px height of one row unit
  gap: number // px gap between cells
  blocked: number[] // sorted blocked column indices (the full-height orb gutter)
  maxPlaceable: number // widest contiguous non-blocked run (max card width)
}

export const MIN_W = 2 // columns
export const MIN_H = 7 // row units (~ compact card)
export const MAX_H = 64 // row units (safety ceiling)
const MAX_ROWS = 4000 // firstFit search ceiling — guards against runaway loops

/* ------------------------------- geometry --------------------------- */

/**
 * Which columns the centered orb-gutter blocks. The gutter is a horizontal
 * band `gutterPx` wide, centered in the canvas, reserved for the full height
 * so cards can never cover the orb (mirrors the old two-rail center column).
 */
export function computeBlocked(
  width: number,
  gutterPx: number,
  cols: number,
  colW: number,
  gap: number
): number[] {
  if (width <= 0 || cols <= 0) return []
  const start = (width - gutterPx) / 2
  const end = (width + gutterPx) / 2
  const blocked: number[] = []
  for (let c = 0; c < cols; c++) {
    const left = gap + c * (colW + gap)
    const right = left + colW
    // Block any column whose pixel span overlaps the gutter band.
    if (right > start && left < end) blocked.push(c)
  }
  // Never block EVERY column — always leave at least one usable side.
  if (blocked.length >= cols) return []
  return blocked
}

/** The widest contiguous run of non-blocked columns (max card width). */
export function maxPlaceableWidth(cols: number, blocked: number[]): number {
  const set = new Set(blocked)
  let best = 0
  let run = 0
  for (let c = 0; c < cols; c++) {
    if (set.has(c)) {
      run = 0
    } else {
      run++
      if (run > best) best = run
    }
  }
  return Math.max(1, best)
}

/** Does the span [x, x+w) touch any blocked (gutter) column? */
export function hitsBlocked(x: number, w: number, blocked: number[]): boolean {
  if (blocked.length === 0) return false
  const set = new Set(blocked)
  for (let c = x; c < x + w; c++) if (set.has(c)) return true
  return false
}

/** Clamp a size to grid bounds (min/max width, the placeable run, height cap). */
export function clampSize(w: number, h: number, geom: Geom): { w: number; h: number } {
  const maxW = Math.max(MIN_W, Math.min(geom.cols, geom.maxPlaceable))
  const cw = Math.max(MIN_W, Math.min(Math.round(w), maxW))
  const ch = Math.max(MIN_H, Math.min(Math.round(h), MAX_H))
  return { w: cw, h: ch }
}

/** Standard AABB overlap test in grid units. */
export function intersects(a: GridRect, b: GridRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

/**
 * First-fit top-left placement: the topmost, then leftmost free cell that
 * fits (w,h) without overlapping `placed` and without touching the gutter.
 */
export function firstFit(
  w: number,
  h: number,
  placed: GridRect[],
  geom: Geom
): { x: number; y: number } {
  const cols = geom.cols
  const ww = Math.min(w, Math.max(1, cols))
  for (let y = 0; y < MAX_ROWS; y++) {
    for (let x = 0; x + ww <= cols; x++) {
      if (hitsBlocked(x, ww, geom.blocked)) continue
      const cand: GridRect = { x, y, w: ww, h }
      if (!placed.some((p) => intersects(cand, p))) return { x, y }
    }
  }
  return { x: 0, y: MAX_ROWS } // pathological fallback (never reached in practice)
}

/** Default size (grid units) for a freshly spawned card, by kind. */
export function defaultRect(kind: string, geom: Geom): { w: number; h: number } {
  // A card fills roughly one side zone; writes/confirms get more height.
  const w = Math.max(MIN_W, Math.min(geom.maxPlaceable, geom.cols))
  const targetPx = kind === "write" ? 300 : 224
  const h = Math.round((targetPx + geom.gap) / (geom.rowH + geom.gap))
  return clampSize(w, h, geom)
}

/* ------------------------------ operations -------------------------- */

/** Order ids by their current visual position (top-left first). */
export function orderByPosition(
  ids: string[],
  layouts: Record<string, GridRect>
): string[] {
  return ids.slice().sort((a, b) => {
    const ra = layouts[a]
    const rb = layouts[b]
    if (!ra || !rb) return 0
    if (ra.y !== rb.y) return ra.y - rb.y
    return ra.x - rb.x
  })
}

/**
 * Re-pack an ordered list of ids from scratch (top-left gravity). Existing
 * sizes are preserved (clamped to geom); missing sizes use `sizeFor`. This is
 * the AUTO_ARRANGE / viewport-reflow primitive.
 */
export function arrangeAll(
  ids: string[],
  layouts: Record<string, GridRect>,
  sizeFor: (id: string) => { w: number; h: number },
  geom: Geom
): Record<string, GridRect> {
  const placed: GridRect[] = []
  const out: Record<string, GridRect> = {}
  for (const id of ids) {
    const prev = layouts[id]
    const size = prev
      ? clampSize(prev.w, prev.h, geom)
      : clampSize(sizeFor(id).w, sizeFor(id).h, geom)
    const pos = firstFit(size.w, size.h, placed, geom)
    const rect = { x: pos.x, y: pos.y, w: size.w, h: size.h }
    placed.push(rect)
    out[id] = rect
  }
  return out
}

/**
 * Incremental reconcile: drop layouts whose id left the board, keep the rest
 * untouched, and place any brand-new ids into the first free slot. Used every
 * time the active-card set changes WITHOUT a geometry change, so accumulation
 * never reshuffles existing cards.
 */
export function reconcileAdd(
  ids: string[],
  layouts: Record<string, GridRect>,
  sizeFor: (id: string) => { w: number; h: number },
  geom: Geom
): Record<string, GridRect> {
  const present = new Set(ids)
  const out: Record<string, GridRect> = {}
  const placed: GridRect[] = []
  // keep existing (still-active) placements verbatim
  for (const id of ids) {
    const r = layouts[id]
    if (r) {
      out[id] = r
      placed.push(r)
    }
  }
  // place newcomers in incoming (turn/slot) order
  for (const id of ids) {
    if (out[id]) continue
    if (!present.has(id)) continue
    const size = clampSize(sizeFor(id).w, sizeFor(id).h, geom)
    const pos = firstFit(size.w, size.h, placed, geom)
    const rect = { x: pos.x, y: pos.y, w: size.w, h: size.h }
    out[id] = rect
    placed.push(rect)
  }
  return out
}

/** Nudge a target x into a legal start column (in-bounds, clear of the gutter). */
function legalizeX(x: number, w: number, geom: Geom): number {
  const cols = geom.cols
  let nx = Math.max(0, Math.min(x, cols - w))
  if (!hitsBlocked(nx, w, geom.blocked)) return nx
  // search outward for the nearest non-blocked start
  for (let d = 1; d <= cols; d++) {
    const r = nx + d
    if (r + w <= cols && !hitsBlocked(r, w, geom.blocked)) return r
    const l = nx - d
    if (l >= 0 && !hitsBlocked(l, w, geom.blocked)) return l
  }
  return 0
}

/**
 * Move a card to a target cell (pin it there) and re-pack every other card
 * around it. Guarantees no overlap and respects the gutter.
 */
export function moveCard(
  layouts: Record<string, GridRect>,
  id: string,
  x: number,
  y: number,
  geom: Geom
): Record<string, GridRect> {
  const cur = layouts[id]
  if (!cur) return layouts
  const nx = legalizeX(x, cur.w, geom)
  const ny = Math.max(0, Math.round(y))
  const pinned: GridRect = { x: nx, y: ny, w: cur.w, h: cur.h }
  const others = orderByPosition(
    Object.keys(layouts).filter((k) => k !== id),
    layouts
  )
  const placed: GridRect[] = [pinned]
  const out: Record<string, GridRect> = { [id]: pinned }
  for (const oid of others) {
    const r = layouts[oid]
    if (!r) continue
    const pos = firstFit(r.w, r.h, placed, geom)
    const rect = { x: pos.x, y: pos.y, w: r.w, h: r.h }
    out[oid] = rect
    placed.push(rect)
  }
  return out
}

/**
 * Resize a card (pin its top-left, apply the clamped new size) and re-pack
 * the rest around it.
 */
export function resizeCard(
  layouts: Record<string, GridRect>,
  id: string,
  w: number,
  h: number,
  geom: Geom
): Record<string, GridRect> {
  const cur = layouts[id]
  if (!cur) return layouts
  const size = clampSize(w, h, geom)
  const nx = legalizeX(cur.x, size.w, geom)
  const pinned: GridRect = { x: nx, y: cur.y, w: size.w, h: size.h }
  const others = orderByPosition(
    Object.keys(layouts).filter((k) => k !== id),
    layouts
  )
  const placed: GridRect[] = [pinned]
  const out: Record<string, GridRect> = { [id]: pinned }
  for (const oid of others) {
    const r = layouts[oid]
    if (!r) continue
    const pos = firstFit(r.w, r.h, placed, geom)
    const rect = { x: pos.x, y: pos.y, w: r.w, h: r.h }
    out[oid] = rect
    placed.push(rect)
  }
  return out
}

/* ---------------------------- px projection ------------------------- */

/** Grid rect -> absolute pixel box for rendering. */
export function toPx(
  r: GridRect,
  geom: Geom
): { left: number; top: number; width: number; height: number } {
  const step = geom.colW + geom.gap
  const rstep = geom.rowH + geom.gap
  return {
    left: geom.gap + r.x * step,
    top: geom.gap + r.y * rstep,
    width: r.w * geom.colW + (r.w - 1) * geom.gap,
    height: r.h * geom.rowH + (r.h - 1) * geom.gap,
  }
}

/** Pixel left/top -> nearest grid cell (for drop). */
export function pxToCell(left: number, top: number, geom: Geom): { x: number; y: number } {
  const step = geom.colW + geom.gap
  const rstep = geom.rowH + geom.gap
  return {
    x: Math.round((left - geom.gap) / step),
    y: Math.round((top - geom.gap) / rstep),
  }
}

/** Pixel size -> nearest grid size (for resize). */
export function pxToSize(width: number, height: number, geom: Geom): { w: number; h: number } {
  const step = geom.colW + geom.gap
  const rstep = geom.rowH + geom.gap
  return {
    w: Math.round((width + geom.gap) / step),
    h: Math.round((height + geom.gap) / rstep),
  }
}

/** Total rows the current layout spans (drives the scrollable canvas height). */
export function contentRows(layouts: Record<string, GridRect>): number {
  let max = 0
  for (const k in layouts) {
    const r = layouts[k]
    if (r.y + r.h > max) max = r.y + r.h
  }
  return max
}
