/**
 * Dependency-free checks for the CMS Phase 2 render layer (style-engine).
 *
 * No test framework is installed in the storefront, so this runs the pure
 * style-engine functions directly under Node's native type stripping:
 *
 *   node --experimental-strip-types apps/storefront/scripts/verify-style-engine.ts
 *
 * (or `npm run verify:style-engine` from apps/storefront). Exits non-zero on any
 * failed assertion so it can gate CI later.
 *
 * style-engine.ts imports `../schema/types` with an extensionless specifier,
 * which Node's ESM resolver rejects. We register the same tiny resolve hook the
 * schema verifier uses (appends `.ts` for extensionless relative imports) so the
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

const {
  hasStyle,
  buildSectionCss,
  buildElementCss,
  buildChromeCss,
  buildWidgetCss,
  chromeHasStyle,
  entranceAnimationOf,
  ENTRANCE_CSS,
} = await import("../src/modules/cms/render/style-engine.ts")

const {
  ELEMENT_REGISTRY,
  getElementDefs,
  CHROME_ELEMENT_REGISTRY,
  getChromeElementDefs,
} = await import("../src/modules/cms/render/element-registry.ts")

const { buildThemeDefaultsCss } = await import(
  "../src/modules/cms/render/theme-defaults.ts"
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

/* ------------------------------- hasStyle -------------------------------- */

console.log("hasStyle:")

check("empty bags → false", hasStyle({}, {}) === false)
check("undefined bags → false", hasStyle(undefined, undefined) === false)
check("null bags → false", hasStyle(null, null) === false)
check("empty nested object → false", hasStyle({ padding: {} }, {}) === false)
check("empty responsive base → false", hasStyle({ padding: { base: {} } }, {}) === false)
check("default-false boolean → false", hasStyle({}, { hideOnMobile: false }) === false)
check("style with a value → true", hasStyle({ color: "#fff" }, {}) === true)
check("advanced hide flag → true", hasStyle({}, { hideOnMobile: true }) === true)
check("nested value → true", hasStyle({ padding: { base: { top: 10 } } }, {}) === true)

/* ------------------------------ empty output ----------------------------- */

console.log("empty output:")

check("empty bags → empty string", buildSectionCss("s1", {}, {}) === "")
check("undefined bags → empty string", buildSectionCss("s1", undefined, undefined) === "")

/* --------------------------- base rule emission -------------------------- */

console.log("base rule:")

const paddingBg = buildSectionCss(
  "s1",
  {
    padding: { base: { top: 10, right: 10, bottom: 10, left: 10, unit: "px" } },
    background: { color: "#ffffff" },
  },
  {}
)
check("base rule targets .cms-sec-s1", paddingBg.includes(".cms-sec-s1{"))
check("base rule contains padding", paddingBg.includes("padding-top:10px"))
check("base rule contains background", paddingBg.includes("background-color:#ffffff"))

/* --------------------------- responsive media ---------------------------- */

console.log("responsive media:")

const mobileOverride = buildSectionCss(
  "s2",
  { padding: { base: { top: 10, unit: "px" }, mobile: { top: 5, unit: "px" } } },
  {}
)
check("desktop base still present", mobileOverride.includes(".cms-sec-s2{padding-top:10px}"))
check("mobile media block emitted", mobileOverride.includes("@media (max-width:767px)"))
check("mobile override value present", mobileOverride.includes("padding-top:5px"))
check(
  "no tablet block when tablet == desktop",
  !mobileOverride.includes("@media (max-width:1024px)")
)

const tabletOverride = buildSectionCss(
  "s3",
  { minHeight: { base: 400, tablet: 300 } },
  {}
)
check("tablet media block emitted", tabletOverride.includes("@media (max-width:1024px)"))
check("tablet override value present", tabletOverride.includes("min-height:300px"))

/* ------------------------------- visibility ------------------------------ */

console.log("visibility:")

const hidden = buildSectionCss("s4", {}, { hideOnMobile: true })
check("hide-on-mobile → mobile media", hidden.includes("@media (max-width:767px)"))
check("hide-on-mobile → display:none", hidden.includes("display:none"))
check(
  "hide-on-mobile → display:none inside 767px block",
  hidden.includes("@media (max-width:767px){.cms-sec-s4{display:none}}")
)

const hiddenTablet = buildSectionCss("s4b", {}, { hideOnTablet: true })
check(
  "hide-on-tablet → display:none inside 1024px block",
  hiddenTablet.includes("@media (max-width:1024px){.cms-sec-s4b{display:none}}")
)

const hiddenDesktop = buildSectionCss("s5", {}, { hideOnDesktop: true })
check("hide-on-desktop → min-width query", hiddenDesktop.includes("@media (min-width:1025px)"))
check("hide-on-desktop → display:none", hiddenDesktop.includes("display:none"))

/* ------------------------------- position -------------------------------- */

console.log("position:")

const positioned = buildSectionCss(
  "s5b",
  {},
  { position: "absolute", zIndex: 10, offsetX: 20, offsetY: 30 }
)
check("position:absolute emitted", positioned.includes("position:absolute"))
check("z-index emitted", positioned.includes("z-index:10"))
check("offsetX → left", positioned.includes("left:20px"))
check("offsetY → top", positioned.includes("top:30px"))
check(
  "default position is not emitted",
  !buildSectionCss("s5c", {}, { position: "default", zIndex: 1 }).includes("position:")
)

/* ------------------------------- custom CSS ------------------------------ */

console.log("custom CSS:")

const bare = buildSectionCss("s6", {}, { customCss: "color: red" })
check("bare declarations wrapped in selector", bare.includes(".cms-sec-s6{color: red}"))

const tokened = buildSectionCss("s7", {}, { customCss: "{{selector}} a{color:blue}" })
check("{{selector}} token swapped", tokened.includes(".cms-sec-s7 a{color:blue}"))
check("no leftover token", !tokened.includes("selector"))

const wordToken = buildSectionCss("s8", {}, { customCss: "selector:hover{opacity:.5}" })
check("bare `selector` word swapped", wordToken.includes(".cms-sec-s8:hover{opacity:.5}"))

const styleInjection = buildSectionCss(
  "s9",
  {},
  { customCss: "color:red}</style><script>alert(1)</script>" }
)
check("closing </style> tag stripped", !/<\s*\/\s*style/i.test(styleInjection))
check("no leftover < in output", !styleInjection.includes("<"))
check("declarations before injection survive", styleInjection.includes("color:red"))

const spacedStyleInjection = buildSectionCss(
  "s9b",
  {},
  { customCss: "a{color:blue} </ STYLE >" }
)
check(
  "whitespace/case </ STYLE > variant stripped",
  !/<\s*\/\s*style/i.test(spacedStyleInjection) && !spacedStyleInjection.includes("<")
)

const bareScoped = buildSectionCss("s9c", {}, { customCss: "font-weight:700;color:#111" })
check(
  "bare multi-declaration wrapped in scoped selector",
  bareScoped.includes(".cms-sec-s9c{font-weight:700;color:#111}")
)

/* --------------------- linked global theme tokens (P5) ------------------- */

console.log("theme tokens:")

const bgToken = buildSectionCss("t1", { background: { color: { ref: "primary" } } }, {})
check(
  "background { ref:'primary' } → var(--ff-primary)",
  bgToken.includes("background-color:var(--ff-primary)")
)

const colorToken = buildSectionCss("t2", { color: { ref: "heading" } }, {})
check("text color { ref:'heading' } → var(--ff-heading)", colorToken.includes("color:var(--ff-heading)"))

const fontToken = buildSectionCss(
  "t3",
  { typography: { base: { fontFamily: { ref: "body" } } } },
  {}
)
check(
  "typography fontFamily { ref:'body' } → var(--ff-font-body)",
  fontToken.includes("font-family:var(--ff-font-body)")
)

const borderToken = buildSectionCss(
  "t4",
  { border: { width: 2, color: { ref: "border" } } },
  {}
)
check("border color { ref:'border' } → var(--ff-border)", borderToken.includes("border-color:var(--ff-border)"))

const shadowToken = buildSectionCss(
  "t5",
  { boxShadow: { x: 0, y: 4, blur: 8, color: { ref: "dark" } } },
  {}
)
check(
  "box-shadow color { ref:'dark' } → var(--ff-dark)",
  shadowToken.includes("box-shadow:0px 4px 8px 0px var(--ff-dark)")
)

const plainColor = buildSectionCss("t6", { color: "#123456", background: { color: "#abcdef" } }, {})
check("plain string text color still literal", plainColor.includes("color:#123456"))
check("plain string bg color still literal", plainColor.includes("background-color:#abcdef"))

const fontHeadingToken = buildSectionCss(
  "t7",
  { typography: { base: { fontFamily: { ref: "heading" } } } },
  {}
)
check(
  "font { ref:'heading' } → var(--ff-font-heading)",
  fontHeadingToken.includes("font-family:var(--ff-font-heading)")
)

const badColorRef = buildSectionCss("t8", { color: { ref: "nope" } }, {})
check("unknown color ref → property skipped", !badColorRef.includes("color:var"))

const badFontRef = buildSectionCss(
  "t9",
  { typography: { base: { fontFamily: { ref: "primary" } } } },
  {}
)
check("invalid font ref → font-family skipped", !badFontRef.includes("font-family"))

const plainFont = buildSectionCss(
  "t10",
  { typography: { base: { fontFamily: "Georgia, serif" } } },
  {}
)
check("plain string font family still literal", plainFont.includes("font-family:Georgia, serif"))

/* ------------------------------- motion (P6) ----------------------------- */

console.log("motion:")

const lift = buildSectionCss("m1", {}, { hoverAnimation: "lift" })
check(
  "hoverAnimation:lift → :hover translateY rule",
  lift.includes(".cms-sec-m1:hover{transform:translateY(-6px)}")
)
check(
  "hoverAnimation:lift → transition on base rule",
  lift.includes(".cms-sec-m1{transition:all 300ms}")
)

const grow = buildSectionCss("m2", {}, { hoverAnimation: "grow" })
check("hoverAnimation:grow → scale(1.03)", grow.includes(".cms-sec-m2:hover{transform:scale(1.03)}"))

const shrink = buildSectionCss("m3", {}, { hoverAnimation: "shrink" })
check("hoverAnimation:shrink → scale(0.97)", shrink.includes(".cms-sec-m3:hover{transform:scale(0.97)}"))

const hoverNone = buildSectionCss("m4", {}, { hoverAnimation: "none" })
check("hoverAnimation:none → no :hover rule", !hoverNone.includes(":hover"))
check("hoverAnimation:none → no transition", !hoverNone.includes("transition"))

const duration = buildSectionCss("m5", {}, { transitionDuration: 500 })
check("transitionDuration:500 → transition:all 500ms", duration.includes("transition:all 500ms"))

const durationUnit = buildSectionCss(
  "m5b",
  {},
  { transitionDuration: { value: 1, unit: "s" } }
)
check("transitionDuration {value:1,unit:s} → transition:all 1s", durationUnit.includes("transition:all 1s"))

const sticky = buildSectionCss("m6", {}, { sticky: true })
check("sticky:true → position:sticky", sticky.includes("position:sticky"))
check("sticky:true → top:0px default offset", sticky.includes("top:0px"))

const stickyOffset = buildSectionCss("m7", {}, { sticky: true, stickyOffset: 24 })
check("sticky + offset → top:24px", stickyOffset.includes("position:sticky") && stickyOffset.includes("top:24px"))

const stickyConflict = buildSectionCss(
  "m8",
  {},
  { sticky: true, position: "absolute" }
)
check("sticky loses to explicit position → position:absolute", stickyConflict.includes("position:absolute"))
check("sticky loses to explicit position → no position:sticky", !stickyConflict.includes("position:sticky"))

const reducedFromHover = buildSectionCss("m9", {}, { hoverAnimation: "lift" })
check(
  "reduced-motion override present for hover",
  reducedFromHover.includes(
    "@media (prefers-reduced-motion:reduce){.cms-sec-m9,.cms-sec-m9:hover{transition:none;transform:none}}"
  )
)

const reducedFromTransition = buildSectionCss("m10", {}, { transitionDuration: 200 })
check(
  "reduced-motion override present for transition-only",
  reducedFromTransition.includes("@media (prefers-reduced-motion:reduce)") &&
    reducedFromTransition.includes("transition:none")
)

check(
  "no motion → no reduced-motion override",
  !buildSectionCss("m11", { color: "#000" }, {}).includes("prefers-reduced-motion")
)

/* ------------------------ entrance-on-scroll (F3) ------------------------ */

console.log("entrance:")

const entranceDur = buildSectionCss(
  "e1",
  {},
  { entranceAnimation: "fade", entranceDuration: 800 }
)
check(
  "entrance + duration → --ff-anim-d:800ms on base rule",
  entranceDur.includes(".cms-sec-e1{") && entranceDur.includes("--ff-anim-d:800ms")
)

const entranceDurUnit = buildSectionCss(
  "e2",
  {},
  { entranceAnimation: "slide-up", entranceDuration: { value: 1, unit: "s" } }
)
check(
  "entrance duration {value:1,unit:s} → --ff-anim-d:1s",
  entranceDurUnit.includes("--ff-anim-d:1s")
)

const entranceNoDur = buildSectionCss("e3", {}, { entranceAnimation: "zoom" })
check(
  "entrance without duration → no --ff-anim-d (600ms fallback in ENTRANCE_CSS)",
  !entranceNoDur.includes("--ff-anim-d")
)

check(
  "entranceAnimation:none → no --ff-anim-d",
  !buildSectionCss("e4", {}, { entranceAnimation: "none", entranceDuration: 800 }).includes(
    "--ff-anim-d"
  )
)
check(
  "duration without entrance kind → no --ff-anim-d",
  !buildSectionCss("e5", {}, { entranceDuration: 800 }).includes("--ff-anim-d")
)
check(
  "--ff-anim-d not duplicated into media blocks (non-responsive)",
  (buildSectionCss("e6", {}, { entranceAnimation: "fade", entranceDuration: 800 }).match(
    /--ff-anim-d/g
  ) ?? []).length === 1
)

// entranceAnimationOf: the wrapper's data-anim contract.
check("entranceAnimationOf fade → fade", entranceAnimationOf({ entranceAnimation: "fade" }) === "fade")
check(
  "entranceAnimationOf slide-up → slide-up",
  entranceAnimationOf({ entranceAnimation: "slide-up" }) === "slide-up"
)
check("entranceAnimationOf zoom → zoom", entranceAnimationOf({ entranceAnimation: "zoom" }) === "zoom")
check(
  "entranceAnimationOf none → undefined",
  entranceAnimationOf({ entranceAnimation: "none" }) === undefined
)
check(
  "entranceAnimationOf unknown kind → undefined",
  entranceAnimationOf({ entranceAnimation: "spin" }) === undefined
)
check("entranceAnimationOf undefined bag → undefined", entranceAnimationOf(undefined) === undefined)
check("entranceAnimationOf null bag → undefined", entranceAnimationOf(null) === undefined)

// A section with ONLY an entrance animation still promotes to a real box.
check(
  "hasStyle true with only entranceAnimation set",
  hasStyle({}, { entranceAnimation: "fade" }) === true
)

// ENTRANCE_CSS: static, reduced-motion-guarded, no-JS-safe (ff-io gate).
check(
  "ENTRANCE_CSS wrapped in prefers-reduced-motion no-preference guard",
  ENTRANCE_CSS.startsWith("@media (prefers-reduced-motion: no-preference){") &&
    ENTRANCE_CSS.endsWith("}")
)
check(
  "ENTRANCE_CSS hides only under html.ff-io (no-JS-safe)",
  ENTRANCE_CSS.includes("html.ff-io [data-anim]:not(.ff-in){opacity:0}")
)
check(
  "ENTRANCE_CSS slide-up initial transform",
  ENTRANCE_CSS.includes('html.ff-io [data-anim="slide-up"]:not(.ff-in){transform:translateY(24px)}')
)
check(
  "ENTRANCE_CSS zoom initial transform",
  ENTRANCE_CSS.includes('html.ff-io [data-anim="zoom"]:not(.ff-in){transform:scale(.96)}')
)
check(
  "ENTRANCE_CSS .ff-in reveal uses --ff-anim-d with 600ms fallback",
  ENTRANCE_CSS.includes("[data-anim].ff-in{opacity:1;transform:none;") &&
    ENTRANCE_CSS.includes("transition:opacity var(--ff-anim-d,600ms) ease,transform var(--ff-anim-d,600ms) ease")
)
check(
  "ENTRANCE_CSS never hides without the ff-io gate",
  !ENTRANCE_CSS.replace(/html\.ff-io [^{]*\{[^}]*\}/g, "").includes("opacity:0")
)

/* ------------------------- id sanitization / scope ----------------------- */

console.log("scoping:")

const weirdId = buildSectionCss("a b/c", { color: "#000" }, {})
check("unsafe id chars sanitized", weirdId.includes(".cms-sec-a-b-c{"))

/* ------------------------- element registry (E1) ------------------------- */

console.log("element registry:")

check("hero_slider registered", Array.isArray(ELEMENT_REGISTRY.hero_slider))
check("hero_slider has 4 elements", ELEMENT_REGISTRY.hero_slider.length === 4)
check(
  "hero_slider keys are title/kicker/button/image",
  ELEMENT_REGISTRY.hero_slider.map((e: { key: string }) => e.key).join(",") ===
    "title,kicker,button,image"
)
check(
  "every element has a label",
  ELEMENT_REGISTRY.hero_slider.every(
    (e: { label: string }) => typeof e.label === "string" && e.label.length > 0
  )
)
check("getElementDefs(hero_slider) → 4", getElementDefs("hero_slider").length === 4)
check("getElementDefs(unknown) → []", getElementDefs("nope").length === 0)
check("getElementDefs(undefined) → []", getElementDefs(undefined).length === 0)

/* --------------------------- element styles (E1) ------------------------- */

console.log("element styles:")

// hasStyle: elementStyles-only presence flips the wrapper on.
check(
  "hasStyle false when all bags empty (with empty elementStyles)",
  hasStyle({}, {}, {}) === false
)
check(
  "hasStyle true when only elementStyles has a style",
  hasStyle({}, {}, { title: { style: { padding: { base: { top: 10 } } } } }) === true
)
check(
  "hasStyle true when only elementStyles has advanced",
  hasStyle({}, {}, { button: { advanced: { hideOnMobile: true } } }) === true
)
check(
  "hasStyle false when elementStyles entries are empty",
  hasStyle({}, {}, { title: { style: {} }, button: {} }) === false
)

// buildElementCss: emits a descendant selector reusing section serialization.
const elOnly = buildElementCss("X", {
  title: {
    style: { padding: { base: { top: 10, right: 10, bottom: 10, left: 10, unit: "px" } } },
  },
})
check(
  "element rule targets .cms-sec-X [data-el=\"title\"]",
  elOnly.includes('.cms-sec-X [data-el="title"]{')
)
check("element rule reuses padding serialization", elOnly.includes("padding-top:10px"))

// buildElementCss: empty / missing → "".
check("buildElementCss(undefined) → empty", buildElementCss("X", undefined) === "")
check("buildElementCss({}) → empty", buildElementCss("X", {}) === "")
check(
  "buildElementCss with empty entry → empty",
  buildElementCss("X", { title: { style: {} } }) === ""
)

// Responsive + advanced flow through the shared helper for elements too.
const elResponsive = buildElementCss("Y", {
  kicker: {
    style: { typography: { base: { fontSize: 20 }, mobile: { fontSize: 14 } } },
    advanced: { hideOnMobile: true },
  },
})
check(
  "element base typography emitted",
  elResponsive.includes('.cms-sec-Y [data-el="kicker"]{') &&
    elResponsive.includes("font-size:20px")
)
check(
  "element mobile media block emitted",
  elResponsive.includes('@media (max-width:767px){.cms-sec-Y [data-el="kicker"]{')
)
check("element mobile font-size override present", elResponsive.includes("font-size:14px"))
check("element hide-on-mobile → display:none", elResponsive.includes("display:none"))

// Token refs resolve identically for elements (no drift).
const elToken = buildElementCss("Z", {
  button: { style: { background: { color: { ref: "primary" } } } },
})
check(
  "element bg token → var(--ff-primary)",
  elToken.includes('.cms-sec-Z [data-el="button"]{background-color:var(--ff-primary)}')
)

// Element key is sanitized for the attribute selector.
const elUnsafeKey = buildElementCss("W", {
  'ti"tle]': { style: { color: "#000" } },
})
check(
  "unsafe element key sanitized to a safe attribute selector",
  elUnsafeKey.includes('[data-el="title"]{color:#000}')
)

// buildSectionCss 4th param: section + element css from ONE call.
const combined = buildSectionCss(
  "C",
  { background: { color: "#111111" } },
  {},
  { title: { style: { color: "#ffffff" } } }
)
check("combined includes section rule", combined.includes(".cms-sec-C{background-color:#111111}"))
check(
  "combined includes element rule",
  combined.includes('.cms-sec-C [data-el="title"]{color:#ffffff}')
)

// buildSectionCss with ONLY element overrides still emits (wrapper becomes real).
const elWrapperOnly = buildSectionCss("D", {}, {}, {
  button: { style: { padding: { base: { top: 8, unit: "px" } } } },
})
check(
  "element-only section emits element rule",
  elWrapperOnly.includes('.cms-sec-D [data-el="button"]{padding-top:8px}')
)
check(
  "element-only section emits no bare section rule",
  !elWrapperOnly.includes(".cms-sec-D{")
)

// Fully empty (no bags, no elements) still yields "".
check(
  "no style + no elements → empty string",
  buildSectionCss("E", {}, {}, {}) === ""
)

/* ------------------------- chrome (F1) ----------------------------------- */

console.log("chrome css:")

// chromeHasStyle mirrors hasStyle semantics.
check("chromeHasStyle empty → false", chromeHasStyle({}, {}) === false)
check("chromeHasStyle undefined → false", chromeHasStyle(undefined, undefined) === false)
check("chromeHasStyle style value → true", chromeHasStyle({ color: "#fff" }, {}) === true)
check(
  "chromeHasStyle elementStyles-only → true",
  chromeHasStyle({}, {}, { logo: { style: { color: "#000" } } }) === true
)

// Region-level style scopes to the stable .cms-chrome-<region> class.
const chromeHeader = buildChromeCss(
  "header",
  {
    padding: { base: { top: 10, right: 10, bottom: 10, left: 10, unit: "px" } },
    background: { color: "#ffffff" },
  },
  {},
  { logo: { style: { color: "#111111" } } }
)
check(
  "chrome region rule targets .cms-chrome-header",
  chromeHeader.includes(".cms-chrome-header{")
)
check("chrome region padding emitted", chromeHeader.includes("padding-top:10px"))
check("chrome region background emitted", chromeHeader.includes("background-color:#ffffff"))
check(
  "chrome element rule targets .cms-chrome-header [data-el=\"logo\"]",
  chromeHeader.includes('.cms-chrome-header [data-el="logo"]{color:#111111}')
)

// Element-only chrome still emits (region root becomes styled).
const chromeElOnly = buildChromeCss("footer", {}, {}, {
  newsletter: { style: { padding: { base: { top: 8, unit: "px" } } } },
})
check(
  "chrome element-only emits element rule",
  chromeElOnly.includes('.cms-chrome-footer [data-el="newsletter"]{padding-top:8px}')
)
check(
  "chrome element-only emits no bare region rule",
  !chromeElOnly.includes(".cms-chrome-footer{")
)

// Empty chrome → "" (byte-identical to today).
check("chrome empty → empty string", buildChromeCss("topbar", {}, {}, {}) === "")
check("chrome undefined → empty string", buildChromeCss("header") === "")

// Chrome reuses the section serialization (responsive + token refs, no drift).
const chromeResponsive = buildChromeCss("topbar", {
  padding: { base: { top: 10, unit: "px" }, mobile: { top: 4, unit: "px" } },
})
check(
  "chrome desktop base present",
  chromeResponsive.includes(".cms-chrome-topbar{padding-top:10px}")
)
check(
  "chrome mobile media block emitted",
  chromeResponsive.includes("@media (max-width:767px){.cms-chrome-topbar{")
)

const chromeToken = buildChromeCss("header", { background: { color: { ref: "primary" } } })
check(
  "chrome bg token → var(--ff-primary)",
  chromeToken.includes(".cms-chrome-header{background-color:var(--ff-primary)}")
)

/* ------------------------- widget css (Composer W1) ---------------------- */

console.log("widget css:")

// Empty / undefined bags → "" (an un-styled widget emits nothing).
check("widget empty bags → empty string", buildWidgetCss("sec-0", 0, 0, {}, {}) === "")
check(
  "widget undefined bags → empty string",
  buildWidgetCss("sec-0", 0, 0, undefined, undefined) === ""
)

// Base rule targets the attribute-scoped selector (NOT .cms-sec-*).
const widgetPadding = buildWidgetCss(
  "sec-0",
  0,
  1,
  { padding: { base: { top: 10, right: 10, bottom: 10, left: 10, unit: "px" } } },
  {}
)
check(
  'widget rule targets [data-scope="sec-0"] [data-w="w-0-1"]',
  widgetPadding.includes('[data-scope="sec-0"] [data-w="w-0-1"]{')
)
check("widget rule contains padding", widgetPadding.includes("padding-top:10px"))
check("widget rule never scopes to .cms-sec-", !widgetPadding.includes(".cms-sec-"))

// Responsive + advanced flow through the shared serializer for widgets too.
const widgetResponsive = buildWidgetCss(
  "sec-2",
  1,
  0,
  { typography: { base: { fontSize: 20 }, mobile: { fontSize: 14 } } },
  { hideOnMobile: true }
)
check(
  "widget base typography emitted",
  widgetResponsive.includes('[data-scope="sec-2"] [data-w="w-1-0"]{') &&
    widgetResponsive.includes("font-size:20px")
)
check(
  "widget mobile media block emitted",
  widgetResponsive.includes('@media (max-width:767px){[data-scope="sec-2"] [data-w="w-1-0"]{')
)
check("widget mobile font-size override present", widgetResponsive.includes("font-size:14px"))
check("widget hide-on-mobile → display:none", widgetResponsive.includes("display:none"))

// Token refs resolve identically for widgets (no drift).
const widgetToken = buildWidgetCss("sec-1", 2, 3, { background: { color: { ref: "primary" } } }, {})
check(
  "widget bg token → var(--ff-primary)",
  widgetToken.includes(
    '[data-scope="sec-1"] [data-w="w-2-3"]{background-color:var(--ff-primary)}'
  )
)

// Scope and indices are sanitized for the attribute selectors.
check(
  "unsafe scope chars stripped from the attribute selector",
  buildWidgetCss('sec-0"] x,body{', 0, 0, { color: "#000" }, {}).includes(
    '[data-scope="sec-0xbody"] [data-w="w-0-0"]{color:#000}'
  )
)
check("empty scope → empty string", buildWidgetCss("", 0, 0, { color: "#000" }, {}) === "")
check(
  "negative column index → empty string",
  buildWidgetCss("sec-0", -1, 0, { color: "#000" }, {}) === ""
)
check(
  "non-integer widget index → empty string",
  buildWidgetCss("sec-0", 0, 1.5, { color: "#000" }, {}) === ""
)
check(
  "NaN indices → empty string",
  buildWidgetCss("sec-0", NaN as unknown as number, 0, { color: "#000" }, {}) === ""
)

/* ------------------------- chrome element registry (F1) ------------------ */

console.log("chrome element registry:")

check(
  "topbar keys are message/links",
  CHROME_ELEMENT_REGISTRY.topbar.map((e: { key: string }) => e.key).join(",") ===
    "message,links"
)
check(
  "header keys are logo/search/icons/menu",
  CHROME_ELEMENT_REGISTRY.header.map((e: { key: string }) => e.key).join(",") ===
    "logo,search,icons,menu"
)
check(
  "footer keys are heading/columns/newsletter/social/copyright",
  CHROME_ELEMENT_REGISTRY.footer.map((e: { key: string }) => e.key).join(",") ===
    "heading,columns,newsletter,social,copyright"
)
check(
  "every chrome element has a label",
  (["topbar", "header", "footer"] as const).every((r) =>
    CHROME_ELEMENT_REGISTRY[r].every(
      (e: { label: string }) => typeof e.label === "string" && e.label.length > 0
    )
  )
)
check("getChromeElementDefs(header) → 4", getChromeElementDefs("header").length === 4)
check("getChromeElementDefs(topbar) → 2", getChromeElementDefs("topbar").length === 2)
check("getChromeElementDefs(footer) → 5", getChromeElementDefs("footer").length === 5)
check("getChromeElementDefs(unknown) → []", getChromeElementDefs("nope").length === 0)
check("getChromeElementDefs(undefined) → []", getChromeElementDefs(undefined).length === 0)

/* ----------------------- theme component defaults (F2b) ------------------ */

console.log("buildThemeDefaultsCss:")

const BTN_SEL = ".learts-theme .btn,.learts-theme button[type=submit]"
const HEAD_SEL =
  ".learts-theme h1,.learts-theme h2,.learts-theme h3," +
  ".learts-theme h4,.learts-theme h5,.learts-theme h6"

check("empty theme → \"\"", buildThemeDefaultsCss({}) === "")
check("undefined theme → \"\"", buildThemeDefaultsCss(undefined) === "")
check("non-object theme → \"\"", buildThemeDefaultsCss("nope") === "")
check(
  "empty component bags → \"\"",
  buildThemeDefaultsCss({ button: {}, headings: {} }) === ""
)
check(
  "button background → base rule",
  buildThemeDefaultsCss({ button: { background: "#ff0000" } }) ===
    `${BTN_SEL}{background-color:#ff0000}`
)
check(
  "button background token ref → var(--ff-primary)",
  buildThemeDefaultsCss({ button: { background: { ref: "primary" } } }) ===
    `${BTN_SEL}{background-color:var(--ff-primary)}`
)
check(
  "button radius + padding serialized",
  buildThemeDefaultsCss({
    button: {
      radius: { value: 8, unit: "px" },
      padding: { top: 10, bottom: 10, unit: "px" },
    },
  }) === `${BTN_SEL}{border-radius:8px;padding-top:10px;padding-bottom:10px}`
)
check(
  "button textColor → color decl",
  buildThemeDefaultsCss({ button: { textColor: "#fff" } }) ===
    `${BTN_SEL}{color:#fff}`
)
check(
  "headings color/font/letter-spacing",
  buildThemeDefaultsCss({
    headings: {
      color: { ref: "heading" },
      fontFamily: "Georgia, serif",
      letterSpacing: { value: 0.5, unit: "em" },
    },
  }) ===
    `${HEAD_SEL}{color:var(--ff-heading);font-family:Georgia, serif;letter-spacing:0.5em}`
)
check(
  "button + headings emit two rules joined by newline",
  buildThemeDefaultsCss({
    button: { background: "#111" },
    headings: { color: "#222" },
  }) === `${BTN_SEL}{background-color:#111}\n${HEAD_SEL}{color:#222}`
)
check(
  "unknown token ref skipped entirely",
  buildThemeDefaultsCss({ button: { background: { ref: "nope!" } } }) === ""
)

/* -------------------------------- report --------------------------------- */

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
