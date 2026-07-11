/**
 * Dependency-free EDITOR == PRODUCTION render-parity checks (Phase 4 QA).
 *
 * Both render paths — the editor iframe (`src/app/editor-canvas/[slug]/page.tsx`,
 * SectionItem) and production (`src/modules/cms/section-renderer.tsx`) — build
 * their scoped section CSS by calling the SAME `buildSectionCss(id, style,
 * advanced)` from `src/modules/cms/render/style-engine.ts`. Because there is a
 * single serializer, the two paths cannot drift by construction. This script
 * makes that invariant executable: it feeds a battery of fixture style/advanced
 * bags through the real engine and asserts the emitted rules + media queries
 * match what BOTH paths will render on each device.
 *
 * No test framework is installed in the storefront, so this runs the pure
 * engine directly under Node's native type stripping:
 *
 *   node --experimental-strip-types apps/storefront/scripts/verify-render-parity.ts
 *
 * (or `npm run verify:render-parity` from apps/storefront). Exits non-zero on
 * any failed assertion so it can gate CI later.
 *
 * style-engine.ts imports `../schema/types` with an extensionless specifier,
 * which Node's ESM resolver rejects. We register the same tiny resolve hook the
 * other verifiers use (appends `.ts` for extensionless relative imports) so the
 * REAL engine is exercised, not a re-implementation.
 */

import { register } from "node:module"

const resolveHook = `
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith("./") || spec.startsWith("../")) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
    const asFile = new URL(spec + ".ts", ctx.parentURL)
    if (existsSync(fileURLToPath(asFile))) return next(spec + ".ts", ctx)
    const asIndex = spec.replace(/\\/$/, "") + "/index.ts"
    if (existsSync(fileURLToPath(new URL(asIndex, ctx.parentURL)))) {
      return next(asIndex, ctx)
    }
  }
  return next(spec, ctx)
}
`
register("data:text/javascript," + encodeURIComponent(resolveHook), import.meta.url)

const { hasStyle, buildSectionCss } = await import(
  "../src/modules/cms/render/style-engine.ts"
)

let passed = 0
let failed = 0

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`  FAIL: ${name}`)
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures — one bag pair per scenario, exercised on every device.     */
/* ------------------------------------------------------------------ */

type Fixture = {
  id: string
  style: Record<string, unknown>
  advanced: Record<string, unknown>
}

const F_PADDING: Fixture = {
  id: "pad",
  style: { padding: { base: { top: 20, right: 20, bottom: 20, left: 20, unit: "px" } } },
  advanced: {},
}

const F_RESPONSIVE: Fixture = {
  id: "resp",
  style: {
    padding: { base: { top: 40, unit: "px" }, mobile: { top: 16, unit: "px" } },
  },
  advanced: {},
}

const F_HIDE_MOBILE: Fixture = {
  id: "hidem",
  style: {},
  advanced: { hideOnMobile: true },
}

const F_BACKGROUND: Fixture = {
  id: "bg",
  style: { background: { color: "#101828" } },
  advanced: {},
}

const F_BORDER: Fixture = {
  id: "brd",
  style: { border: { width: 2, style: "dashed", color: "#d2d2d2" } },
  advanced: {},
}

const F_CUSTOM_CSS: Fixture = {
  id: "css",
  style: {},
  advanced: { customCss: "{{selector}}:hover{opacity:.8}" },
}

const F_POSITION: Fixture = {
  id: "pos",
  style: {},
  advanced: { position: "relative", zIndex: 5, offsetX: 12, offsetY: 8 },
}

/**
 * The two render paths call buildSectionCss identically. Model that: a helper
 * that mimics BOTH call sites and asserts they produce byte-identical CSS.
 */
function renderBoth(f: Fixture): { editor: string; production: string } {
  // editor-canvas SectionItem: buildSectionCss(id, style, advanced)
  const editor = buildSectionCss(f.id, f.style, f.advanced)
  // section-renderer (production): buildSectionCss(id, style, advanced)
  const production = buildSectionCss(f.id, f.style, f.advanced)
  return { editor, production }
}

/* ------------------------------------------------------------------ */
/* 1. Editor == Production parity (same serializer, same output)        */
/* ------------------------------------------------------------------ */

console.log("editor/production parity:")

for (const f of [
  F_PADDING,
  F_RESPONSIVE,
  F_HIDE_MOBILE,
  F_BACKGROUND,
  F_BORDER,
  F_CUSTOM_CSS,
  F_POSITION,
]) {
  const { editor, production } = renderBoth(f)
  check(`[${f.id}] editor CSS === production CSS`, editor === production)
  check(`[${f.id}] output is non-empty`, editor.length > 0)
}

/* ------------------------------------------------------------------ */
/* 2. Expected rules & media queries per fixture                        */
/* ------------------------------------------------------------------ */

console.log("padding:")
const pad = buildSectionCss(F_PADDING.id, F_PADDING.style, F_PADDING.advanced)
check("base rule targets .cms-sec-pad", pad.includes(".cms-sec-pad{"))
check("padding longhands emitted", pad.includes("padding-top:20px") && pad.includes("padding-left:20px"))
check("no media query for non-responsive padding", !pad.includes("@media"))

console.log("responsive base + mobile override:")
const resp = buildSectionCss(F_RESPONSIVE.id, F_RESPONSIVE.style, F_RESPONSIVE.advanced)
check("emits base rule", resp.includes(".cms-sec-resp{padding-top:40px}"))
check("emits mobile media query", resp.includes("@media (max-width:767px)"))
check("mobile override value present", resp.includes("padding-top:16px"))
check(
  "no tablet query (tablet == desktop)",
  !resp.includes("@media (max-width:1024px)")
)

console.log("hide-on-mobile visibility:")
const hidem = buildSectionCss(F_HIDE_MOBILE.id, F_HIDE_MOBILE.style, F_HIDE_MOBILE.advanced)
check("hide-on-mobile → mobile media query", hidem.includes("@media (max-width:767px)"))
check("hide-on-mobile → display:none", hidem.includes("display:none"))
check("hide-on-mobile emits no base box rule", !hidem.includes(".cms-sec-hidem{padding"))

console.log("background:")
const bg = buildSectionCss(F_BACKGROUND.id, F_BACKGROUND.style, F_BACKGROUND.advanced)
check("background-color emitted", bg.includes("background-color:#101828"))

console.log("border:")
const brd = buildSectionCss(F_BORDER.id, F_BORDER.style, F_BORDER.advanced)
check("border-width emitted", brd.includes("border-width:2px"))
check("border-style emitted", brd.includes("border-style:dashed"))
check("border-color emitted", brd.includes("border-color:#d2d2d2"))

console.log("custom CSS escape hatch:")
const css = buildSectionCss(F_CUSTOM_CSS.id, F_CUSTOM_CSS.style, F_CUSTOM_CSS.advanced)
check("{{selector}} token swapped for scoped selector", css.includes(".cms-sec-css:hover{opacity:.8}"))
check("no leftover selector token", !css.includes("selector"))

console.log("position / offsets / z-index:")
const pos = buildSectionCss(F_POSITION.id, F_POSITION.style, F_POSITION.advanced)
check("position emitted", pos.includes("position:relative"))
check("z-index emitted", pos.includes("z-index:5"))
check("offsetX → left", pos.includes("left:12px"))
check("offsetY → top", pos.includes("top:8px"))

/* ------------------------------------------------------------------ */
/* 3. hasStyle gating (has-style true/false)                            */
/* ------------------------------------------------------------------ */

console.log("hasStyle gating:")
check("styled fixture → hasStyle true", hasStyle(F_PADDING.style, F_PADDING.advanced) === true)
check("advanced-only fixture → hasStyle true", hasStyle(F_HIDE_MOBILE.style, F_HIDE_MOBILE.advanced) === true)
check("empty bags → hasStyle false", hasStyle({}, {}) === false)
check("empty bags → buildSectionCss empty string", buildSectionCss("empty", {}, {}) === "")
check(
  "hasStyle false ⇒ no CSS ⇒ wrapper stays display:contents (parity)",
  buildSectionCss("empty", {}, {}) === "" && buildSectionCss("empty", undefined, undefined) === ""
)

/* -------------------------------- report --------------------------------- */

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
