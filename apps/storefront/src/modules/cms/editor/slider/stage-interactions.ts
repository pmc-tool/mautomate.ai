/* ------------------------------------------------------------------ */
/* Slider stage — interaction geometry (Phase 5B, ARCH-SLIDER §3.2)     */
/*                                                                      */
/* Pure math, no React: frame ⇄ pixel-rect conversion under the         */
/* nine-anchor + percent-offset model, nearest-third anchor inference,  */
/* snap resolution (center lines, edges, safe area, other layers), the  */
/* 8-point resize handle vocabulary, and keyboard nudges. StageMode is  */
/* the only consumer; keeping this framework-free makes every rule      */
/* testable headless.                                                   */
/*                                                                      */
/* OFFSET CONVENTION (must match the renderer's CSS emission — see      */
/* model-5a.ts LayerFrame): offsets are INWARD-POSITIVE from the        */
/* anchored edge (l: from left, r: from right, t: from top, b: from     */
/* bottom) and CENTER-RELATIVE for c (positive → right/down). An        */
/* edge-pinned badge therefore keeps its inset at every width — the     */
/* point of anchors.                                                    */
/* ------------------------------------------------------------------ */

import type { LayerFrame, SliderAnchor } from "./model-5a"

export type Rect = { left: number; top: number; width: number; height: number }

export type Guide = {
  axis: "v" | "h"
  /** Pixel position within the slide box (x for v, y for h). */
  pos: number
  kind: "center" | "edge" | "safe" | "layer"
}

/* --------------------------- frame ⇄ rect ---------------------------- */

const hOf = (a: SliderAnchor) => a[1] as "l" | "c" | "r"
const vOf = (a: SliderAnchor) => a[0] as "t" | "c" | "b"

/**
 * Frame → pixel rect inside a W×H slide box. `intrinsic` supplies the
 * measured size of "auto" layers (from the rendered [data-layer] box);
 * absent, a placeholder estimate keeps the overlay usable pre-render.
 */
export function frameToRect(
  frame: LayerFrame,
  W: number,
  H: number,
  intrinsic?: { width: number; height: number }
): Rect {
  const width =
    frame.w === "auto"
      ? (intrinsic?.width ?? W * 0.24)
      : (frame.w / 100) * W
  const height =
    frame.h === "auto"
      ? (intrinsic?.height ?? H * 0.1)
      : (frame.h / 100) * H
  let left: number
  switch (hOf(frame.anchor)) {
    case "l":
      left = (frame.x / 100) * W
      break
    case "c":
      left = W / 2 + (frame.x / 100) * W - width / 2
      break
    case "r":
      left = W - (frame.x / 100) * W - width
      break
  }
  let top: number
  switch (vOf(frame.anchor)) {
    case "t":
      top = (frame.y / 100) * H
      break
    case "c":
      top = H / 2 + (frame.y / 100) * H - height / 2
      break
    case "b":
      top = H - (frame.y / 100) * H - height
      break
  }
  return { left, top, width, height }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Pixel rect → frame against a GIVEN anchor. `keepAuto` preserves the
 * original "auto" dimensions (a drag must not bake a text layer's
 * measured size into the model — §1.4 auto-height rule).
 */
export function rectToFrame(
  rect: Rect,
  W: number,
  H: number,
  anchor: SliderAnchor,
  keepAuto?: { w: boolean; h: boolean }
): LayerFrame {
  let x: number
  switch (hOf(anchor)) {
    case "l":
      x = (rect.left / W) * 100
      break
    case "c":
      x = ((rect.left + rect.width / 2 - W / 2) / W) * 100
      break
    case "r":
      x = ((W - rect.left - rect.width) / W) * 100
      break
  }
  let y: number
  switch (vOf(anchor)) {
    case "t":
      y = (rect.top / H) * 100
      break
    case "c":
      y = ((rect.top + rect.height / 2 - H / 2) / H) * 100
      break
    case "b":
      y = ((H - rect.top - rect.height) / H) * 100
      break
  }
  return {
    anchor,
    x: round2(x),
    y: round2(y),
    w: keepAuto?.w ? "auto" : round2((rect.width / W) * 100),
    h: keepAuto?.h ? "auto" : round2((rect.height / H) * 100),
  }
}

/**
 * Anchor inference (§3.2): after a drag the frame is re-expressed against
 * the NEAREST of the nine anchors by the nearest-third heuristic on the
 * layer's CENTER — edge-pinned layers stay pinned responsively without
 * the merchant ever meeting the concept. The 9-dot picker overrides.
 */
export function inferAnchor(rect: Rect, W: number, H: number): SliderAnchor {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const h = cx < W / 3 ? "l" : cx > (2 * W) / 3 ? "r" : "c"
  const v = cy < H / 3 ? "t" : cy > (2 * H) / 3 ? "b" : "c"
  return `${v}${h}` as SliderAnchor
}

/* ------------------------------- snap -------------------------------- */

/** Safe-area inset, percent of each slide dimension. */
export const SAFE_INSET_PCT = 4
/** Screen-space snap threshold, px (§3.2). Alt suppresses. */
export const SNAP_PX = 6

type Line = { pos: number; kind: Guide["kind"] }

function candidateLines(W: number, H: number, others: Rect[]) {
  const v: Line[] = [
    { pos: 0, kind: "edge" },
    { pos: W / 2, kind: "center" },
    { pos: W, kind: "edge" },
    { pos: (SAFE_INSET_PCT / 100) * W, kind: "safe" },
    { pos: W - (SAFE_INSET_PCT / 100) * W, kind: "safe" },
  ]
  const h: Line[] = [
    { pos: 0, kind: "edge" },
    { pos: H / 2, kind: "center" },
    { pos: H, kind: "edge" },
    { pos: (SAFE_INSET_PCT / 100) * H, kind: "safe" },
    { pos: H - (SAFE_INSET_PCT / 100) * H, kind: "safe" },
  ]
  for (const r of others) {
    v.push(
      { pos: r.left, kind: "layer" },
      { pos: r.left + r.width / 2, kind: "layer" },
      { pos: r.left + r.width, kind: "layer" }
    )
    h.push(
      { pos: r.top, kind: "layer" },
      { pos: r.top + r.height / 2, kind: "layer" },
      { pos: r.top + r.height, kind: "layer" }
    )
  }
  return { v, h }
}

/**
 * Snap a dragged rect against center lines, slide edges, the safe-area
 * inset and other layers' edges/centers. Returns the (possibly moved)
 * rect plus the guide lines to draw. `disabled` (Alt held) returns the
 * rect untouched with no guides.
 */
export function snapRect(
  rect: Rect,
  W: number,
  H: number,
  others: Rect[],
  opts: { threshold?: number; disabled?: boolean } = {}
): { rect: Rect; guides: Guide[] } {
  if (opts.disabled) return { rect, guides: [] }
  const threshold = opts.threshold ?? SNAP_PX
  const { v, h } = candidateLines(W, H, others)
  const guides: Guide[] = []
  let dx = 0
  {
    let best: { delta: number; line: Line } | null = null
    for (const probe of [rect.left, rect.left + rect.width / 2, rect.left + rect.width]) {
      for (const line of v) {
        const delta = line.pos - probe
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, line }
        }
      }
    }
    if (best) {
      dx = best.delta
      guides.push({ axis: "v", pos: best.line.pos, kind: best.line.kind })
    }
  }
  let dy = 0
  {
    let best: { delta: number; line: Line } | null = null
    for (const probe of [rect.top, rect.top + rect.height / 2, rect.top + rect.height]) {
      for (const line of h) {
        const delta = line.pos - probe
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, line }
        }
      }
    }
    if (best) {
      dy = best.delta
      guides.push({ axis: "h", pos: best.line.pos, kind: best.line.kind })
    }
  }
  return {
    rect: { ...rect, left: rect.left + dx, top: rect.top + dy },
    guides,
  }
}

/* ------------------------------ resize ------------------------------- */

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

/** The 8-point vocabulary; auto-height layers (text) offer sides only —
 *  width is real, height follows content (§3.2). */
export const ALL_HANDLES: readonly HandleId[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
]
export const SIDE_HANDLES: readonly HandleId[] = ["e", "w"]

export function handleCursor(h: HandleId): string {
  switch (h) {
    case "n":
    case "s":
      return "ns-resize"
    case "e":
    case "w":
      return "ew-resize"
    case "ne":
    case "sw":
      return "nesw-resize"
    case "nw":
    case "se":
      return "nwse-resize"
  }
}

const MIN_PX = 12

/** Apply a resize drag (dx/dy px from pointerdown) to the start rect. */
export function applyResize(
  start: Rect,
  handle: HandleId,
  dx: number,
  dy: number
): Rect {
  let { left, top, width, height } = start
  if (handle.includes("e")) width = Math.max(MIN_PX, start.width + dx)
  if (handle.includes("w")) {
    width = Math.max(MIN_PX, start.width - dx)
    left = start.left + start.width - width
  }
  if (handle.includes("s")) height = Math.max(MIN_PX, start.height + dy)
  if (handle.includes("n")) {
    height = Math.max(MIN_PX, start.height - dy)
    top = start.top + start.height - height
  }
  return { left, top, width, height }
}

/* ------------------------------ nudge -------------------------------- */

/**
 * Arrow-key nudge: 1px (Shift = 10px) converted to percent against the
 * CURRENT slide box, applied along the frame's own anchor sign so a
 * right-anchored layer nudged right moves right (its inset shrinks).
 */
export function nudgeFrame(
  frame: LayerFrame,
  dxPx: number,
  dyPx: number,
  W: number,
  H: number
): LayerFrame {
  const sx = hOf(frame.anchor) === "r" ? -1 : 1
  const sy = vOf(frame.anchor) === "b" ? -1 : 1
  return {
    ...frame,
    x: round2(frame.x + sx * (dxPx / W) * 100),
    y: round2(frame.y + sy * (dyPx / H) * 100),
  }
}
