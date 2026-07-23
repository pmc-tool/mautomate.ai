/**
 * OFFSET-CONVENTION PROOF (Phase 5C — ARCH-SLIDER §3.2 vs §2.2).
 *
 * Renders fixture layer frames through BOTH implementations of the
 * nine-anchor + percent-offset model and asserts pixel agreement:
 *
 *   PUBLISHED TRUTH — seat 5A's renderer: `frameDecls` in
 *     src/modules/cms/render/slider-css.ts (anchor + percent → CSS
 *     left/right/top/bottom + translate re-centering + percent sizes).
 *     The CSS decls are interpreted into a pixel rect exactly as a
 *     browser would lay out `.ffs-layer` (position:absolute) inside a
 *     W×H slide box: left/top insets, right/bottom insets resolved
 *     against the box, `translate` percentages against the layer's OWN
 *     box, "auto" sizes = intrinsic.
 *
 *   STAGE GEOMETRY — seat 5B's `frameToRect` in
 *     src/modules/cms/editor/slider/stage-interactions.ts (the
 *     INWARD-POSITIVE inset convention documented in its header).
 *
 * All 9 anchors are exercised at the BASE device and again with mobile
 * frame overrides through the real `resolveResponsive` cascade, plus
 * "auto"-sized layers with a supplied intrinsic. Tolerance is 0.01px —
 * both sides are pure arithmetic over the same percentages, so they must
 * agree beyond mere rounding. A mismatch is a STAGE bug by definition
 * (the renderer is published truth). Also proves rectToFrame is
 * frameToRect's inverse (round-trip < 0.01% per component).
 *
 * Run (repo: apps/storefront):
 *   node --experimental-strip-types --no-warnings scripts/verify-stage-parity.ts
 */

import { register } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src")

const resolveHook = `
import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
const SRC = ${JSON.stringify(SRC)}
function withTs(base) {
  if (existsSync(base + ".ts")) return base + ".ts"
  if (existsSync(base + ".tsx")) return base + ".tsx"
  if (existsSync(base + "/index.ts")) return base + "/index.ts"
  return null
}
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@modules/") || spec.startsWith("@lib/")) {
    const rel = spec.startsWith("@modules/")
      ? "modules/" + spec.slice("@modules/".length)
      : "lib/" + spec.slice("@lib/".length)
    const hit = withTs(SRC + "/" + rel)
    if (hit) return next(pathToFileURL(hit).href, ctx)
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
    const base = fileURLToPath(new URL(spec, ctx.parentURL))
    const hit = withTs(base)
    if (hit) return next(pathToFileURL(hit).href, ctx)
  }
  return next(spec, ctx)
}
`
register("data:text/javascript," + encodeURIComponent(resolveHook), import.meta.url)

const { frameDecls } = await import("@modules/cms/render/slider-css")
const { frameToRect, rectToFrame } = await import(
  "@modules/cms/editor/slider/stage-interactions"
)
const { resolveResponsive } = await import("@modules/cms/schema/types")

type Frame = {
  anchor: string
  x: number
  y: number
  w: number | "auto"
  h: number | "auto"
}
type Rect = { left: number; top: number; width: number; height: number }

let passed = 0
let failed = 0
const fail = (msg: string) => {
  failed++
  console.error(`FAIL  ${msg}`)
}
const ok = (cond: boolean, msg: string) => {
  if (cond) passed++
  else fail(msg)
}

/* ---------------- CSS-decl interpreter (browser layout math) ---------- */

function rectFromDecls(
  decls: [string, string][],
  W: number,
  H: number,
  intrinsic: { width: number; height: number }
): Rect | null {
  const map = new Map(decls)
  const pct = (v: string | undefined): number | null => {
    if (v === undefined) return null
    const m = /^(-?[0-9.]+)%$/.exec(v)
    return m ? Number(m[1]) : null
  }
  const width =
    map.has("width") ? ((pct(map.get("width")) ?? NaN) / 100) * W : intrinsic.width
  const height =
    map.has("height") ? ((pct(map.get("height")) ?? NaN) / 100) * H : intrinsic.height
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null

  let left: number
  if (map.has("left")) {
    const p = pct(map.get("left"))
    if (p === null) return null
    left = (p / 100) * W
  } else if (map.has("right")) {
    const p = pct(map.get("right"))
    if (p === null) return null
    left = W - (p / 100) * W - width
  } else {
    return null
  }

  let top: number
  if (map.has("top")) {
    const p = pct(map.get("top"))
    if (p === null) return null
    top = (p / 100) * H
  } else if (map.has("bottom")) {
    const p = pct(map.get("bottom"))
    if (p === null) return null
    top = H - (p / 100) * H - height
  } else {
    return null
  }

  // `translate: <x> <y>` — percentages resolve against the layer's own box.
  const tr = map.get("translate")
  if (tr !== undefined) {
    const parts = tr.split(/\s+/)
    const shift = (v: string | undefined, own: number): number => {
      if (!v || v === "0") return 0
      const m = /^(-?[0-9.]+)%$/.exec(v)
      return m ? (Number(m[1]) / 100) * own : NaN
    }
    const dx = shift(parts[0], width)
    const dy = shift(parts[1] ?? "0", height)
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
    left += dx
    top += dy
  }
  return { left, top, width, height }
}

/* ------------------------------ fixtures ------------------------------ */

/** Nine anchors, mixed signs (incl. NEGATIVE center offsets — the kicker
 *  convention), sized and auto-sized. Mobile overrides differ everywhere. */
const FIXTURES: {
  name: string
  base: Frame
  mobile?: Frame
  intrinsic?: { width: number; height: number }
}[] = [
  { name: "tl sized", base: { anchor: "tl", x: 8, y: 6, w: 20, h: 10 }, mobile: { anchor: "tl", x: 4, y: 3, w: 40, h: 12 } },
  { name: "tc negative-x", base: { anchor: "tc", x: -5, y: 4, w: 30, h: 12 }, mobile: { anchor: "tc", x: 0, y: 2, w: 60, h: 14 } },
  { name: "tr sized", base: { anchor: "tr", x: 7, y: 9, w: 25, h: 15 }, mobile: { anchor: "tr", x: 3, y: 5, w: 45, h: 18 } },
  { name: "cl auto-h (kicker)", base: { anchor: "cl", x: 8, y: -14, w: 46, h: "auto" }, mobile: { anchor: "cl", x: 6, y: -18, w: 88, h: "auto" }, intrinsic: { width: 320, height: 64 } },
  { name: "cc all-auto", base: { anchor: "cc", x: 3, y: -2, w: "auto", h: "auto" }, mobile: { anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" }, intrinsic: { width: 200, height: 50 } },
  { name: "cr sized", base: { anchor: "cr", x: 6, y: 12, w: 18, h: 22 }, mobile: { anchor: "cr", x: 2, y: 6, w: 30, h: 20 } },
  { name: "bl sized", base: { anchor: "bl", x: 4, y: 8, w: 40, h: 10 }, mobile: { anchor: "bl", x: 2, y: 4, w: 70, h: 12 } },
  { name: "bc zero-x", base: { anchor: "bc", x: 0, y: 5, w: 33, h: 9 }, mobile: { anchor: "bc", x: 1, y: 8, w: 50, h: 10 } },
  { name: "br badge", base: { anchor: "br", x: 8, y: 8, w: 12, h: 12 }, mobile: { anchor: "br", x: 4, y: 4, w: 20, h: 15 } },
]

/** Slide boxes: the 16/7 base hero at a desktop width, the 4/5 mobile box. */
const BOXES = {
  desktop: { W: 1280, H: 560 },
  mobile: { W: 360, H: 450 },
} as const

const TOL = 0.01

const near = (a: number, b: number) => Math.abs(a - b) <= TOL

for (const fx of FIXTURES) {
  const responsive = { base: fx.base, ...(fx.mobile ? { mobile: fx.mobile } : {}) }
  for (const device of ["desktop", "mobile"] as const) {
    const { W, H } = BOXES[device]
    const frame = resolveResponsive(responsive as never, device) as Frame
    const intrinsic = fx.intrinsic ?? { width: 240, height: 56 }

    const stage = frameToRect(frame as never, W, H, intrinsic)
    const decls = frameDecls(frame as never) as [string, string][]
    const css = rectFromDecls(decls, W, H, intrinsic)

    if (!css) {
      fail(`${fx.name} @${device}: CSS decls not interpretable: ${JSON.stringify(decls)}`)
      continue
    }
    for (const k of ["left", "top", "width", "height"] as const) {
      ok(
        near(stage[k], css[k]),
        `${fx.name} @${device} ${k}: stage=${stage[k].toFixed(3)} css=${css[k].toFixed(3)} (frame=${JSON.stringify(frame)}, box=${W}x${H})`
      )
    }

    // Inverse proof: rectToFrame(frameToRect(f)) round-trips (auto kept).
    const back = rectToFrame(stage, W, H, frame.anchor as never, {
      w: frame.w === "auto",
      h: frame.h === "auto",
    }) as Frame
    ok(back.anchor === frame.anchor, `${fx.name} @${device}: anchor round-trip`)
    ok(
      Math.abs(back.x - frame.x) <= 0.01 && Math.abs(back.y - frame.y) <= 0.01,
      `${fx.name} @${device}: offset round-trip x=${back.x} y=${back.y} vs ${frame.x},${frame.y}`
    )
    const wOk =
      frame.w === "auto" ? back.w === "auto" : Math.abs((back.w as number) - frame.w) <= 0.01
    const hOk =
      frame.h === "auto" ? back.h === "auto" : Math.abs((back.h as number) - frame.h) <= 0.01
    ok(wOk && hOk, `${fx.name} @${device}: size round-trip w=${back.w} h=${back.h}`)
  }
}

console.log(`\nverify-stage-parity: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
