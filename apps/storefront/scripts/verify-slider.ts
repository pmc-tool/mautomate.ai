/**
 * Slider model + platform renderer checks (Phase 5, seat 5A — ARCH-SLIDER S1).
 *
 * No test framework is installed in the storefront, so this runs the pure
 * slider modules directly under Node's native type stripping:
 *
 *   node --experimental-strip-types apps/storefront/scripts/verify-slider.ts
 *
 * Exits non-zero on any failed assertion. Covers the 5A hard gates:
 *   2. upgradeFieldsSlide is PURE (no input mutation, deterministic) and its
 *      upgrade→render output matches a hand-authored expected layout.
 *   3. Layered render correctness: all 5 layer types, all 9 anchors,
 *      responsive overrides, overlay, entrance attrs — asserted against the
 *      emitted HTML/CSS (selectors, cqw math with the floor clamp, percent
 *      frames, marker attrs) — plus sanitization (text layers through the
 *      shared sanitizer, URLs attribute-escaped, scheme refusal).
 *   4. Mixed sliders: layered slide 0 + fields slide 1 render in one hero,
 *      the fields slide upgrading AT RENDER (pure, never stored).
 *   +  planSection routing: fields heroes stay "flat" (theme Liquid),
 *      layered heroes route to "slider".
 */

import { register } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src")

// Resolve hook: extensionless relative imports get ".ts"; the tsconfig
// aliases (@modules/*, @lib/*) map onto src/*. Keeps the REAL modules under
// test — no copies, no forks.
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

const { isLayeredSlide, isLayeredSlider } = await import(
  "../src/modules/cms/slider/model.ts"
)
const { upgradeFieldsSlide } = await import("../src/modules/cms/slider/upgrade.ts")
const { DEFAULT_PLACEMENT } = await import("../src/modules/cms/slider/defaults.ts")
const { renderSliderHtml } = await import(
  "../src/modules/cms/render/slider-html.ts"
)
const { scaledPxToCss, frameDecls, buildSliderCss } = await import(
  "../src/modules/cms/render/slider-css.ts"
)
const { planSection } = await import("../src/modules/cms/render/document.ts")

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.freeze(o)
    for (const v of Object.values(o as object)) deepFreeze(v)
  }
  return o
}

/* ================= Gate 2 — the upgrade fn ================= */

const fieldsSlide = deepFreeze({
  image: "/learts/assets/images/slider/home3/slide-1.webp",
  subtitle: "Handicraft shop",
  title: "Inspired by Your\nSweetest <Dreams>",
  cta: { label: "shop now", href: "/store" },
})

const up1 = upgradeFieldsSlide(fieldsSlide, { index: 3 })
const up2 = upgradeFieldsSlide(fieldsSlide, { index: 3 })

check("upgrade: deterministic", JSON.stringify(up1) === JSON.stringify(up2))
check("upgrade: id derives from index", up1.id === "up-3")
check(
  "upgrade: image -> background cover",
  up1.background?.type === "image" &&
    up1.background?.image === fieldsSlide.image &&
    up1.background?.fit === "cover"
)
check("upgrade: three layers (kicker/title/cta)", up1.layers.length === 3)

const [kicker, title, cta] = up1.layers
check("upgrade: kicker is a small-caps body-font text layer",
  kicker.type === "text" &&
    (kicker.props as { tag?: string }).tag === "p" &&
    (kicker.props as { html?: string }).html === "Handicraft shop" &&
    JSON.stringify((kicker.style as any)?.typography?.fontFamily) === '{"ref":"body"}' &&
    (kicker.style as any)?.typography?.textTransform === "uppercase"
)
check("upgrade: title is h1 with <br> + escaped angle brackets",
  title.type === "text" &&
    (title.props as { tag?: string }).tag === "h1" &&
    (title.props as { html?: string }).html ===
      "Inspired by Your<br>Sweetest &lt;Dreams&gt;"
)
check("upgrade: cta is a button layer",
  cta.type === "button" &&
    (cta.props as { label?: string }).label === "shop now" &&
    (cta.props as { href?: string }).href === "/store"
)
// Hand-authored expected layout: the default placement (learts left-center
// stack) — anchors, offsets and the entrance stagger, all per defaults.ts.
check("upgrade: kicker frame = default placement",
  JSON.stringify(kicker.frame.base) === JSON.stringify(DEFAULT_PLACEMENT.kicker.frame))
check("upgrade: title frame = default placement",
  JSON.stringify(title.frame.base) === JSON.stringify(DEFAULT_PLACEMENT.title.frame))
check("upgrade: cta frame = default placement",
  JSON.stringify(cta.frame.base) === JSON.stringify(DEFAULT_PLACEMENT.cta.frame))
check("upgrade: entrance stagger 0/150/300",
  kicker.anim?.delay_ms === 0 && title.anim?.delay_ms === 150 && cta.anim?.delay_ms === 300)

// Purity: the frozen input survived (a mutation would have thrown above in
// strict mode; belt-and-braces compare too).
check("upgrade: input not mutated",
  fieldsSlide.title === "Inspired by Your\nSweetest <Dreams>" &&
    fieldsSlide.cta.label === "shop now")

// Placement hint override (theme slider_placement contract).
const placed = upgradeFieldsSlide(fieldsSlide, {
  index: 0,
  placement: { title: { frame: { anchor: "bc", x: 0, y: 8, w: 60, h: "auto" }, delay_ms: 500 } },
})
const placedTitle = placed.layers.find((l: any) => l.name === "Title")
check("upgrade: placement hint wins for its role",
  placedTitle?.frame.base.anchor === "bc" && placedTitle?.anim?.delay_ms === 500)
check("upgrade: other roles keep the default",
  placed.layers[0].frame.base.anchor === DEFAULT_PLACEMENT.kicker.frame.anchor)

// Partial slides: absent fields emit no layers.
const bare = upgradeFieldsSlide({ title: "Only title" }, { index: 0 })
check("upgrade: absent kicker/cta emit no layers",
  bare.layers.length === 1 && bare.layers[0].type === "text")
check("upgrade: no image -> color background", bare.background?.type === "color")

/* ================= guards ================= */

check("isLayeredSlide: fields slide is NOT layered", !isLayeredSlide(fieldsSlide))
check("isLayeredSlide: layers array IS layered", isLayeredSlide({ id: "a", layers: [] }))
check("isLayeredSlide: layers non-array is NOT layered", !isLayeredSlide({ layers: "x" }))
check("isLayeredSlider: all-fields hero is NOT layered",
  !isLayeredSlider({ slides: [fieldsSlide, fieldsSlide] }))
check("isLayeredSlider: one layered slide flips the slider",
  isLayeredSlider({ slides: [fieldsSlide, { id: "a", layers: [] }] }))

/* ================= Gate 3 — layered render correctness ================= */

const anchors = ["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"] as const
const anchorLayers = anchors.map((a, i) => ({
  id: `sh-${a}`,
  type: "shape",
  frame: { base: { anchor: a, x: 5, y: 6, w: 10, h: 10 } },
  style: { background: { color: "#112233" } },
}))

const fixture = {
  autoplay_ms: 4000,
  transition: "fade",
  slides: [
    {
      id: "slide-a",
      background: {
        type: "image",
        image: 'https://cdn.example.com/hero "x".jpg',
        fit: "cover",
        focal: { x: 30, y: 60 },
        overlay: { color: "#000000", opacity: 0.4 },
      },
      layers: [
        ...anchorLayers,
        {
          id: "t-1",
          type: "text",
          frame: {
            base: { anchor: "cl", x: 8, y: 0, w: 46, h: "auto" },
            tablet: { anchor: "cl", x: 4, y: 0, w: 60, h: "auto" },
            mobile: { anchor: "tc", x: 0, y: 12, w: 90, h: "auto" },
          },
          props: {
            html: 'Hello <b>bold</b><script>alert(1)</script><img src=x onerror="alert(2)">',
            tag: "h1",
          },
          style: {
            typography: {
              fontSize: { value: 40, unit: "px" },
            },
          },
          anim: { preset: "slide-up", delay_ms: 150, duration_ms: 700 },
        },
        {
          id: "t-2",
          type: "text",
          frame: { base: { anchor: "cl", x: 8, y: 10, w: 40, h: "auto" } },
          props: { html: "Kicker", tag: "p" },
          style: {
            typography: {
              base: { fontSize: { value: 18, unit: "px" } },
              mobile: { fontSize: { value: 22, unit: "px" } },
            },
          },
          hidden: { tablet: true },
        },
        {
          id: "im-1",
          type: "image",
          frame: { base: { anchor: "tr", x: 4, y: 8, w: 22, h: 30 } },
          props: { src: "https://cdn.example.com/badge.png", alt: 'A "badge"' },
        },
        {
          id: "bt-1",
          type: "button",
          frame: { base: { anchor: "bl", x: 8, y: 12, w: "auto", h: "auto" } },
          props: { label: "Shop <now>", href: "/store", variant: "outline" },
          anim: { preset: "fade", delay_ms: 300 },
        },
        {
          id: "ic-1",
          type: "icon",
          frame: { base: { anchor: "br", x: 4, y: 4, w: "auto", h: "auto" } },
          props: { icon: "fas fa-star", size: 24 },
        },
        {
          id: "evil-img",
          type: "image",
          frame: { base: { anchor: "cc", x: 0, y: 0, w: 10, h: 10 } },
          props: { src: "javascript:alert(1)" },
        },
      ],
    },
  ],
}

const live = renderSliderHtml(fixture as never, { scope: "sec-2" })
const editor = renderSliderHtml(fixture as never, { scope: "sec-2", editor: true })

check("render: root marker + scope key", live.includes('<div class="ffs" data-ffs="sec-2"'))
check("render: autoplay + transition attrs",
  live.includes('data-ffs-autoplay="4000"') && live.includes('data-ffs-transition="fade"'))
check("render: slide marker + first-active",
  live.includes('class="ffs-slide ffs-active" data-slide="slide-a"'))
check("render: no data-hero anywhere (theme JS can never bind)",
  !live.includes("data-hero"))

// cqw math with the floor clamp.
check("scaledPxToCss: 40px -> max(15px,3.333cqw)", scaledPxToCss(40) === "max(15px,3.333cqw)")
check("scaledPxToCss: 12px floors at 12", scaledPxToCss(12) === "max(12px,1cqw)")
check("render: derived cqw font on t-1",
  live.includes('[data-layer="t-1"]{font-size:max(15px,3.333cqw)'))
check("render: explicit mobile px override beats the derived scale",
  live.includes("@media (max-width:767px)") &&
    /@media \(max-width:767px\)\{[^}]*\[data-layer="t-2"\]\{font-size:22px\}/.test(live))

// Percent frames, all nine anchors.
const cssOf = (id: string) => {
  const m = live.match(new RegExp(`\\[data-layer="${id}"\\]\\{([^}]*)\\}`))
  return m ? m[1] : ""
}
check("frame tl", cssOf("sh-tl") === "left:5%;top:6%;width:10%;height:10%")
check("frame tc", cssOf("sh-tc") === "left:55%;top:6%;translate:-50% 0;width:10%;height:10%")
check("frame tr", cssOf("sh-tr") === "right:5%;top:6%;width:10%;height:10%")
check("frame cl", cssOf("sh-cl") === "left:5%;top:56%;translate:0 -50%;width:10%;height:10%")
check("frame cc", cssOf("sh-cc") === "left:55%;top:56%;translate:-50% -50%;width:10%;height:10%")
check("frame cr", cssOf("sh-cr") === "right:5%;top:56%;translate:0 -50%;width:10%;height:10%")
check("frame bl", cssOf("sh-bl") === "left:5%;bottom:6%;width:10%;height:10%")
check("frame bc", cssOf("sh-bc") === "left:55%;bottom:6%;translate:-50% 0;width:10%;height:10%")
check("frame br", cssOf("sh-br") === "right:5%;bottom:6%;width:10%;height:10%")

// Responsive frame overrides emit diff-only media rules.
check("frame responsive: tablet diff",
  /@media \(max-width:1024px\)\{[^{]*\[data-layer="t-1"\]\{left:4%;width:60%\}/.test(live))
check("frame responsive: mobile re-anchors",
  /@media \(max-width:767px\)\{[^{]*\[data-layer="t-1"\]\{left:50%;top:12%;translate:-50% 0;width:90%\}/.test(live))

// Per-device hide: independent tablet window.
check("hidden.tablet emits an independent 768-1024 window",
  live.includes('@media (min-width:768px) and (max-width:1024px){.ffs[data-ffs="sec-2"] [data-layer="t-2"]{display:none}}'))

// Background + overlay.
check("background image url attribute-escaped into CSS",
  live.includes('url("https://cdn.example.com/hero%20%22x%22.jpg")') ||
    live.includes('url("https://cdn.example.com/hero %22x%22.jpg")'))
check("background focal -> background-position", live.includes("background-position:30% 60%"))
check("overlay color+opacity rule",
  live.includes('[data-slide="slide-a"]>.ffs-overlay{background-color:#000000;opacity:0.4}'))

// Sanitization: script + event handler stripped, markup kept.
check("text layer sanitized: script stripped", !live.includes("<script>alert"))
check("text layer sanitized: onerror stripped", !live.includes("onerror"))
check("text layer keeps inline formatting", live.includes("Hello <b>bold</b>"))
check("button label HTML-escaped", live.includes("Shop &lt;now&gt;"))
check("image alt attribute-escaped", live.includes('alt="A &quot;badge&quot;"'))
// The layer's MARKUP is dropped entirely (its frame CSS rule is inert
// without a matching element); no scripty URL survives anywhere.
check("javascript: image src refused (no markup, no scheme)",
  !live.includes("javascript:") && !/<(a|span|img)[^>]*evil-img/.test(live))

// Entrance attrs.
check("entrance attrs on t-1",
  live.includes('data-layer="t-1" data-ffs-anim="slide-up" data-ffs-delay="150" data-ffs-dur="700" data-ffs-ease="ease-out"'))

// Default height cascade: 16/7 base, 4/5 mobile.
check("default aspect 16/7", live.includes('.ffs[data-ffs="sec-2"]{aspect-ratio:16/7}'))
check("default mobile aspect 4/5",
  live.includes('@media (max-width:767px){.ffs[data-ffs="sec-2"]{aspect-ratio:4/5}}'))

// Runtime tag: live yes, editor no. Editor output otherwise identical intent.
check("live emits the runtime tag", live.includes('<script src="/ffslider.js" defer>'))
check("editor emits NO runtime tag", !editor.includes("ffslider.js"))

// Type defaults ride brand tokens.
check("base css: text defaults use --ff tokens",
  live.includes(".ffs-l-text{color:var(--ff-heading);font-family:var(--ff-font-heading)"))
check("base css: button default uses --ff-primary",
  live.includes("background:var(--ff-primary)"))

/* ================= Gate 4 — mixed sliders ================= */

const mixed = {
  autoplay_ms: 0,
  slides: [
    { id: "lay-0", layers: [{ id: "l0", type: "text", frame: { base: { anchor: "cc", x: 0, y: 0, w: 40, h: "auto" } }, props: { html: "Layered", tag: "h2" } }] },
    deepFreeze({ image: "/img/two.jpg", subtitle: "Two", title: "Second", cta: { label: "Go", href: "/x" } }),
  ],
}
const mixedJson = JSON.stringify(mixed)
const mixedHtml = renderSliderHtml(mixed as never, { scope: "sec-9" })
check("mixed: layered slide renders", mixedHtml.includes('data-slide="lay-0"'))
check("mixed: fields slide upgraded AT RENDER with deterministic id",
  mixedHtml.includes('data-slide="up-1"'))
check("mixed: upgraded slide got its layers",
  mixedHtml.includes('data-layer="up-1-title"') && mixedHtml.includes("Second"))
check("mixed: stored settings never mutated", JSON.stringify(mixed) === mixedJson)
check("mixed: single slide count = 2 dots",
  (mixedHtml.match(/data-ffs-dot=/g) ?? []).length === 2)

/* ================= planSection routing ================= */

const files = { "sections/hero_slider.liquid": "<section data-hero>legacy</section>" }
const fieldsHeroSection = {
  type: "hero_slider",
  settings: { autoplay_ms: 5000, slides: [fieldsSlide] },
  scope: "sec-0",
}
const flatPlan = planSection(fieldsHeroSection, files)
check("planSection: fields hero stays FLAT (theme Liquid untouched)",
  flatPlan.kind === "flat" && (flatPlan as any).src === files["sections/hero_slider.liquid"])

const layeredHeroSection = {
  type: "hero_slider",
  settings: mixed,
  scope: "sec-1",
}
check("planSection: layered hero routes to the slider renderer",
  planSection(layeredHeroSection, files).kind === "slider")

const containerPlan = planSection(
  { type: "container", settings: { columns: [{ widgets: [] }] } },
  files
)
check("planSection: container path untouched", containerPlan.kind === "container")

check("planSection: empty hero_slider (no slides) stays flat",
  planSection({ type: "hero_slider", settings: {} }, files).kind === "flat")

/* ================= frameDecls edge cases ================= */

check("frameDecls: garbage in, empty out", frameDecls(undefined as never).length === 0)
check("frameDecls: auto sizes emit no width/height",
  frameDecls({ anchor: "tl", x: 0, y: 0, w: "auto", h: "auto" }).every(([p]) => p !== "width" && p !== "height"))

// buildSliderCss never throws on hostile ids.
const hostile = buildSliderCss('"]{}<style>', { slides: [] } as never, [
  { id: '"><script>', layers: [{ id: "x{}", type: "shape", frame: { base: { anchor: "tl", x: 0, y: 0, w: 10, h: 10 } }, props: {} }] } as never,
])
check("buildSliderCss: hostile ids sanitized out of selectors",
  !hostile.includes("<script>") && !hostile.includes('"]{}'))

/* ================= 5C — entrance presets + placement hints ================= */

const { SLIDER_ENTRANCE_CSS } = await import("../src/modules/cms/render/slider-css.ts")
const { placementForTheme, resolvePlacement, THEME_SLIDER_PLACEMENTS } = await import(
  "../src/modules/cms/slider/defaults.ts"
)

// --- Entrance CSS: the ffs-js discipline (no-JS pages never hide content).
{
  const rules = SLIDER_ENTRANCE_CSS.split("}").filter(Boolean)
  const hiders = rules.filter(
    (r: string) => r.includes("opacity:0") || r.includes("transform:translate") || r.includes("scale:.") || r.includes("scale:1.")
  )
  check("entrance: has hiding rules at all", hiders.length >= 7)
  check(
    "entrance: EVERY hiding rule is gated on .ffs-js",
    hiders.every((r: string) => r.includes(".ffs.ffs-js")),
    hiders.find((r: string) => !r.includes(".ffs.ffs-js"))
  )
  check(
    "entrance: all 7 animated presets have a from-state",
    ["slide-up", "slide-down", "slide-left", "slide-right", "zoom-in", "zoom-out"].every(
      (p) => SLIDER_ENTRANCE_CSS.includes(`[data-ffs-anim="${p}"]`)
    ) && SLIDER_ENTRANCE_CSS.includes(".ffs.ffs-js [data-ffs-anim]{opacity:0")
  )
  check(
    "entrance: ffs-in restores (after the preset rules, higher specificity)",
    SLIDER_ENTRANCE_CSS.includes('.ffs.ffs-js [data-ffs-anim].ffs-in{opacity:1;transform:none;scale:1}')
  )
  check(
    "entrance: reduced-motion shows content instantly",
    SLIDER_ENTRANCE_CSS.includes("prefers-reduced-motion") &&
      /prefers-reduced-motion:reduce\)\{\.ffs\.ffs-js \[data-ffs-anim\]\{opacity:1/.test(SLIDER_ENTRANCE_CSS)
  )
  check(
    "entrance: ease presets map through data-ffs-ease",
    SLIDER_ENTRANCE_CSS.includes('[data-ffs-ease="ease-in-out"]{transition-timing-function:ease-in-out') &&
      SLIDER_ENTRANCE_CSS.includes('[data-ffs-ease="spring"]{transition-timing-function:cubic-bezier')
  )
  // The animation transform channel never collides with frame centering:
  // frames use the `translate` property, entrances use transform/scale.
  check(
    "entrance: never touches the translate property (frame centering)",
    !/[{;]translate:/.test(SLIDER_ENTRANCE_CSS)
  )
}

// --- Per-layer duration overrides (buildSliderCss, ffs-js gated).
{
  const mkLayer = (id: string, anim: unknown) => ({
    id,
    type: "text",
    frame: { base: { anchor: "tl", x: 0, y: 0, w: 20, h: "auto" } },
    props: { html: "x" },
    ...(anim ? { anim } : {}),
  })
  const css = buildSliderCss("k", { slides: [] } as never, [
    {
      id: "sl",
      layers: [
        mkLayer("ly-900", { preset: "fade", delay_ms: 0, duration_ms: 900 }),
        mkLayer("ly-600", { preset: "fade", delay_ms: 0, duration_ms: 600 }),
        mkLayer("ly-none", { preset: "none", duration_ms: 900 }),
        mkLayer("ly-plain", null),
        mkLayer("ly-huge", { preset: "zoom-in", duration_ms: 99999 }),
      ],
    } as never,
  ])
  check(
    "entrance: duration_ms 900 emits an ffs-js-gated per-layer override",
    css.includes('.ffs[data-ffs="k"].ffs-js [data-layer="ly-900"]{transition-duration:900ms}')
  )
  check(
    "entrance: default 600ms emits NO override",
    !css.includes('[data-layer="ly-600"]{transition-duration')
  )
  check(
    "entrance: preset none / no anim emit NO override",
    !css.includes('[data-layer="ly-none"]{transition-duration') &&
      !css.includes('[data-layer="ly-plain"]{transition-duration')
  )
  check(
    "entrance: duration clamps at 5000ms",
    css.includes('[data-layer="ly-huge"]{transition-duration:5000ms}')
  )
}

// --- Rendered output carries the entrance block (live + editor paths).
{
  const settings = {
    slides: [
      {
        id: "s1",
        background: { type: "color", color: "#123456" },
        layers: [
          {
            id: "l1",
            type: "text",
            frame: { base: { anchor: "cl", x: 8, y: 0, w: 46, h: "auto" } },
            props: { html: "Hi" },
            anim: { preset: "slide-up", delay_ms: 100, duration_ms: 800 },
          },
        ],
      },
    ],
  }
  const live = renderSliderHtml(settings as never, { scope: "sec-9" })
  const editor = renderSliderHtml(settings as never, { scope: "sec-9", editor: true })
  check("entrance: live output embeds SLIDER_ENTRANCE_CSS", live.includes('.ffs.ffs-js [data-ffs-anim]{opacity:0'))
  check("entrance: editor output embeds it too (stage replay arms it)", editor.includes('.ffs.ffs-js [data-ffs-anim]{opacity:0'))
  check(
    "entrance: rendered layer carries per-layer duration override",
    live.includes('.ffs[data-ffs="sec-9"].ffs-js [data-layer="l1"]{transition-duration:800ms}')
  )
  check("entrance: editor output still has NO runtime tag", !editor.includes("ffslider.js"))
}

// --- Placement hints: rokon + shofy sets; learts stays the default.
{
  check("placement: rokon-liquid resolves the rokon set", placementForTheme("rokon-liquid") === THEME_SLIDER_PLACEMENTS.rokon)
  check("placement: bare handle + case-insensitive", placementForTheme("ROKON") === THEME_SLIDER_PLACEMENTS.rokon)
  check("placement: shofy-liquid resolves the shofy set", placementForTheme("shofy-liquid") === THEME_SLIDER_PLACEMENTS.shofy)
  check("placement: learts has NO entry (default IS learts)", placementForTheme("learts-liquid") === undefined)
  check("placement: unknown/empty -> undefined", placementForTheme("katan-liquid") === undefined && placementForTheme("") === undefined && placementForTheme(null) === undefined)

  const rk = resolvePlacement(placementForTheme("rokon-liquid"))
  check(
    "placement: rokon frames survive resolvePlacement (cl/7% inset, 52% title)",
    rk.kicker.frame.anchor === "cl" && rk.kicker.frame.x === 7 && rk.kicker.frame.y === -16 &&
      rk.title.frame.w === 52 && rk.cta.frame.y === 20
  )
  const sf = resolvePlacement(placementForTheme("shofy-liquid"))
  check(
    "placement: shofy title width-capped to the 5fr text column (38%)",
    sf.title.frame.w === 38 && sf.title.frame.x === 6 && sf.kicker.frame.anchor === "cl"
  )
  check(
    "placement: stagger delays preserved (0/150/300)",
    rk.kicker.delay_ms === 0 && rk.title.delay_ms === 150 && rk.cta.delay_ms === 300
  )

  // Upgrade honors the hint; without it the learts default applies.
  const upRk = upgradeFieldsSlide(fieldsSlide, { index: 0, placement: placementForTheme("rokon-liquid") })
  const upDefault = upgradeFieldsSlide(fieldsSlide, { index: 0 })
  check("placement: upgrade lands the rokon title frame", (upRk.layers[1].frame as { base: { x: number; w: unknown } }).base.x === 7 && (upRk.layers[1].frame as { base: { w: unknown } }).base.w === 52)
  check("placement: hint-less upgrade keeps DEFAULT_PLACEMENT", (upDefault.layers[1].frame as { base: { x: number } }).base.x === DEFAULT_PLACEMENT.title.frame.x)

  // Render path: a mixed slider's render-time upgrade uses opts.placement.
  const mixed = {
    slides: [
      { id: "sl-a", background: {}, layers: [] },
      { image: "/x.webp", subtitle: "Kicker", title: "Title", cta: { label: "Go", href: "/store" } },
    ],
  }
  const htmlRk = renderSliderHtml(mixed as never, { scope: "sec-1", placement: placementForTheme("rokon-liquid") })
  const htmlDefault = renderSliderHtml(mixed as never, { scope: "sec-1" })
  check("placement: rendered mixed upgrade uses the hinted 7% inset", htmlRk.includes('[data-layer="up-1-title"]{left:7%'))
  check("placement: hint-less render keeps the 8% default", htmlDefault.includes('[data-layer="up-1-title"]{left:8%'))
}

/* ========== F1 (5V finding, 6B fix): render-time id dedup ========== */
/* A STORED layered slide can legitimately carry an `up-<i>` id (it was
   committed by the editor's upgrade command, then slides were reordered
   or inserted around it). When a render-upgraded fields slide lands the
   SAME id, the emitted data-slide / data-layer ids must not collide:
   the RENDER-UPGRADED side is suffixed (`-r`), stored ids are never
   touched, and collision-free sliders stay byte-identical (every check
   above ran unchanged). */
{
  const collide = {
    slides: [
      {
        id: "up-1",
        background: {},
        layers: [
          {
            id: "up-1-title",
            type: "text",
            frame: { base: { anchor: "cc", x: 0, y: 0, w: 40, h: "auto" } },
            props: { html: "Stored", tag: "h1" },
          },
        ],
      },
      { image: "/x.webp", title: "Upgraded", cta: { label: "Go", href: "/s" } },
    ],
  }
  const html = renderSliderHtml(collide as never, { scope: "sec-3" })
  const domSlides = (id: string) =>
    (html.match(new RegExp(`class="ffs-slide[^"]*" data-slide="${id}"`, "g")) ?? [])
      .length
  const domLayers = (id: string) =>
    (html.match(new RegExp(`class="ffs-layer[^"]*" data-layer="${id}"`, "g")) ?? [])
      .length
  check("F1: stored slide keeps its id", domSlides("up-1") === 1)
  check("F1: upgraded slide id deduped to up-1-r", domSlides("up-1-r") === 1)
  check("F1: stored layer id unrewritten and unique", domLayers("up-1-title") === 1)
  check("F1: upgraded layer ids follow the deduped slide id", domLayers("up-1-r-title") === 1)
  check("F1: no upgraded layer emitted under the stored prefix", domLayers("up-1-cta") === 0)
  check("F1: CSS keys follow the deduped ids", html.includes('[data-layer="up-1-r-title"]'))

  // No collision → the dedup block is inert: a stored "up-0" beside an
  // upgraded index-1 slide emits the plain `up-1` id, no `-r` anywhere.
  const noCollide = {
    slides: [
      { id: "up-0", background: {}, layers: [] },
      { image: "/x.webp", title: "T" },
    ],
  }
  const h2 = renderSliderHtml(noCollide as never, { scope: "sec-4" })
  check(
    "F1: non-colliding mixed slider untouched",
    domSlidesIn(h2, "up-1") === 1 && !h2.includes("up-1-r")
  )
  function domSlidesIn(s: string, id: string): number {
    return (s.match(new RegExp(`class="ffs-slide[^"]*" data-slide="${id}"`, "g")) ?? [])
      .length
  }
}

/* ================= summary ================= */

console.log(`\nverify-slider: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
