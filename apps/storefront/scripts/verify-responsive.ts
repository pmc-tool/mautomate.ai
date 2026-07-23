/**
 * 3C (ARCH-CANVAS P7) — responsive completion checks.
 *
 * Dependency-free, follows the verify-style-engine.ts pattern (Node native
 * type stripping + the extensionless-import resolve hook). Run from
 * apps/storefront:
 *
 *   node --experimental-strip-types --no-warnings scripts/verify-responsive.ts
 *
 * Covers:
 *  1. DUAL-SHAPE visibility: the spec `advanced.hide` bag and the legacy
 *     `hideOn*` trio emit BYTE-IDENTICAL media-query display:none rules, on
 *     every node kind (section / element / column / widget / chrome element),
 *     and the chrome REGION refuses both shapes.
 *  2. Editor ghost opts: `{ hide: false }` suppresses ONLY the visibility
 *     rules, on every builder.
 *  3. writeResponsive / clearResponsiveOverride: promote-on-first-override,
 *     demote-on-last-clear, byte-equal round-trips, diff-only key deletion.
 *  4. writeHide / isHiddenOnDevice: edit-time normalization (legacy trio
 *     folds into the spec shape) + dual-shape reads + no device cascade.
 */
import { register } from "node:module"

const resolveHook = `
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith("./") || spec.startsWith("../")) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
    const asFile = new URL(spec + ".ts", ctx.parentURL)
    if (existsSync(fileURLToPath(asFile))) return next(spec + ".ts", ctx)
  }
  return next(spec, ctx)
}
`
register("data:text/javascript," + encodeURIComponent(resolveHook), import.meta.url)

const eng = await import(new URL("../src/modules/cms/render/style-engine.ts", import.meta.url).href)
const t = await import(new URL("../src/modules/cms/schema/types.ts", import.meta.url).href)
const { buildSectionCss, buildColumnCss, buildChromeCss, buildWidgetCssPath } = eng
const {
  writeResponsive,
  clearResponsiveOverride,
  hasDeviceOverride,
  isHiddenOnDevice,
  writeHide,
  resolveResponsive,
} = t

let passed = 0
let failed = 0
function eq(name: string, a: unknown, b: unknown) {
  const sa = JSON.stringify(a)
  const sb = JSON.stringify(b)
  if (sa === sb) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${name}\n  got:  ${sa}\n  want: ${sb}`)
  }
}
function ok(name: string, cond: boolean) {
  cond ? passed++ : (failed++, console.error(`FAIL ${name}`))
}

/* ---------- 1. dual-shape hide: byte-equal emission ---------- */
const style = { align: "center" }
for (const [legacyKey, device] of [
  ["hideOnDesktop", "desktop"],
  ["hideOnTablet", "tablet"],
  ["hideOnMobile", "mobile"],
] as const) {
  const legacy = buildSectionCss("x", style, { [legacyKey]: true })
  const spec = buildSectionCss("x", style, { hide: { [device]: true } })
  eq(`section hide equiv ${device}`, spec, legacy)
}
eq(
  "section hide equiv all-three",
  buildSectionCss("x", style, { hide: { desktop: true, tablet: true, mobile: true } }),
  buildSectionCss("x", style, { hideOnDesktop: true, hideOnTablet: true, hideOnMobile: true })
)
// media queries present and correctly placed
const specTablet = buildSectionCss("x", null, { hide: { tablet: true } })
ok("tablet hide in max-1024 query", specTablet.includes("@media (max-width:1024px){.cms-sec-x{display:none}}"))
const specDesk = buildSectionCss("x", null, { hide: { desktop: true } })
ok("desktop hide in min-1025 query", specDesk.includes("@media (min-width:1025px){.cms-sec-x{display:none}}"))
const specMob = buildSectionCss("x", null, { hide: { mobile: true } })
ok("mobile hide in max-767 query", specMob.includes("@media (max-width:767px){.cms-sec-x{display:none}}"))

/* column: new shape passes the column advanced filter */
eq(
  "column hide equiv",
  buildColumnCss("sec-1", [0], null, { hide: { mobile: true } }),
  buildColumnCss("sec-1", [0], null, { hideOnMobile: true })
)
/* widget path */
eq(
  "widget hide equiv",
  buildWidgetCssPath("sec-1", [0, 0], { color: "#111" }, { hide: { tablet: true } }),
  buildWidgetCssPath("sec-1", [0, 0], { color: "#111" }, { hideOnTablet: true })
)
/* chrome ELEMENT: allowed; chrome REGION: refused in BOTH shapes */
eq(
  "chrome element hide equiv",
  buildChromeCss("header", null, null, { logo: { advanced: { hide: { mobile: true } } } }),
  buildChromeCss("header", null, null, { logo: { advanced: { hideOnMobile: true } } })
)
ok(
  "chrome region hide refused (new shape)",
  !buildChromeCss("header", { background: { color: "#fff" } }, { hide: { tablet: true } }).includes("display:none")
)
ok(
  "chrome region hide refused (legacy)",
  !buildChromeCss("header", { background: { color: "#fff" } }, { hideOnTablet: true }).includes("display:none")
)
/* element inside a section (unfiltered path) */
eq(
  "section element hide equiv",
  buildSectionCss("e", null, null, { h: { advanced: { hide: { desktop: true } } } }),
  buildSectionCss("e", null, null, { h: { advanced: { hideOnDesktop: true } } })
)

/* mixed shapes: legacy tablet + spec mobile both emit */
const mixed = buildSectionCss("m", null, { hideOnTablet: true, hide: { mobile: true } })
ok("mixed shapes both emit", mixed.includes("max-width:1024px") && mixed.includes("max-width:767px"))

/* ---------- 2. editor ghost opts: hide suppressed, rest identical ---------- */
const full = buildSectionCss("g", style, { hideOnTablet: true, hide: { desktop: true } })
const ghost = buildSectionCss("g", style, { hideOnTablet: true, hide: { desktop: true } }, null, { hide: false })
const noHide = buildSectionCss("g", style, {})
ok("opts hide:false emits no display:none", !ghost.includes("display:none"))
eq("opts hide:false equals unhidden emission", ghost, noHide)
eq("opts hide:true is default", buildSectionCss("g", style, { hideOnTablet: true }, null, { hide: true }), buildSectionCss("g", style, { hideOnTablet: true }))
ok(
  "opts reaches elements",
  !buildSectionCss("e", null, null, { h: { advanced: { hide: { desktop: true }, customCss: "selector{color:red}" } } }, { hide: false }).includes("display:none")
)
ok(
  "opts reaches columns",
  !buildColumnCss("sec-1", [0], { padding: { top: 4, unit: "px" } }, { hideOnMobile: true }, { hide: false }).includes("display:none")
)
ok(
  "opts reaches chrome elements",
  !buildChromeCss("header", null, null, { logo: { advanced: { hideOnMobile: true } } }, { hide: false }).includes("display:none")
)
ok(
  "opts reaches widgets",
  !buildWidgetCssPath("sec-1", [0, 0], { color: "#111" }, { hide: { tablet: true } }, { hide: false }).includes("display:none")
)

/* ---------- 3. writeResponsive promote / demote round-trips ---------- */
const bag0 = { padding: { top: 20, unit: "px" }, align: "center" }
const snap0 = JSON.stringify(bag0)

// plain -> tablet override (PROMOTE)
const bag1 = writeResponsive(bag0, "padding", "tablet", { top: 10, unit: "px" })
eq("promote shape", bag1.padding, { base: { top: 20, unit: "px" }, tablet: { top: 10, unit: "px" } })
ok("promote leaves original untouched", JSON.stringify(bag0) === snap0)
ok("override flag on", hasDeviceOverride(bag1.padding, "tablet") && !hasDeviceOverride(bag1.padding, "mobile"))

// clear -> back to plain (DEMOTE), byte-equal round trip
const bag2 = clearResponsiveOverride(bag1, "padding", "tablet")
eq("promote->clear round-trips bytes", JSON.stringify(bag2), snap0)

// desktop write with overrides present keeps them
const bag3 = writeResponsive(bag1, "padding", "desktop", { top: 30, unit: "px" })
eq("desktop write keeps overrides", bag3.padding, { base: { top: 30, unit: "px" }, tablet: { top: 10, unit: "px" } })

// desktop plain write stays plain; empty deletes the key
const bag4 = writeResponsive(bag0, "padding", "desktop", { top: 24, unit: "px" })
ok("desktop write stays plain", !("base" in (bag4.padding as object)))
const bag5 = writeResponsive(bag0, "padding", "desktop", {})
ok("empty desktop write deletes key", !("padding" in bag5) && bag5.align === "center")

// override on an absent key, then clear -> key fully gone
const bag6 = writeResponsive({ align: "left" }, "gap", "mobile", { value: 8, unit: "px" })
eq("promote from absent", bag6.gap, { base: undefined, mobile: { value: 8, unit: "px" } })
const bag7 = clearResponsiveOverride(bag6, "gap", "mobile")
eq("clear from absent round-trips", JSON.stringify(bag7), JSON.stringify({ align: "left" }))

// mobile resolves through tablet (cascade) for the editor preview
eq(
  "resolve cascade mobile->tablet",
  resolveResponsive({ base: 1, tablet: 2 }, "mobile"),
  2
)

// clearing desktop / clearing a plain value is a no-op
eq("clear desktop no-op", clearResponsiveOverride(bag1, "padding", "desktop"), bag1)
eq("clear plain no-op", clearResponsiveOverride(bag0, "padding", "tablet"), bag0)

/* ---------- 4. writeHide normalization + dual read ---------- */
ok("read legacy", isHiddenOnDevice({ hideOnTablet: true }, "tablet"))
ok("read spec", isHiddenOnDevice({ hide: { tablet: true } }, "tablet"))
ok("read absent", !isHiddenOnDevice({}, "tablet") && !isHiddenOnDevice(undefined, "mobile"))
ok("no cascade", !isHiddenOnDevice({ hide: { tablet: true } }, "mobile"))

// legacy fold + write
const adv1 = writeHide({ hideOnTablet: true, customCss: "x" }, "desktop", true)
eq("legacy folds into spec", adv1, { customCss: "x", hide: { tablet: true, desktop: true } })
const adv2 = writeHide(adv1, "tablet", false)
eq("unhide removes device key", adv2, { customCss: "x", hide: { desktop: true } })
const adv3 = writeHide(adv2, "desktop", false)
eq("last unhide drops hide bag", adv3, { customCss: "x" })
// pure toggle round-trip from clean bag
const advA = writeHide({}, "mobile", true)
eq("hide from empty", advA, { hide: { mobile: true } })
eq("hide->unhide round-trips", JSON.stringify(writeHide(advA, "mobile", false)), "{}")

console.log(`\n3C verify: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
