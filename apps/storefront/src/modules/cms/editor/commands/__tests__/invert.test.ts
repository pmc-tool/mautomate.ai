/* Phase 2A — command registry invert() round-trips + executor history
 * semantics, run headless under node (esbuild-bundled, like the Phase 1
 * normalize suite). Every assertion is byte-level (JSON.stringify) where
 * the claim is "undo restores the document exactly".
 *
 * Run from apps/storefront:
 *   bash src/modules/cms/editor/commands/__tests__/run-invert-tests.sh
 */

import {
  COMMANDS,
  type Command,
  type EditorState,
  type Section,
} from "../registry"
import { createExecutor } from "../executor"

let passed = 0
let failed = 0
const fails: string[] = []

function ok(cond: unknown, name: string) {
  if (cond) {
    passed++
    console.log(`  ok  ${name}`)
  } else {
    failed++
    fails.push(name)
    console.log(`FAIL  ${name}`)
  }
}

function eq(a: unknown, b: unknown, name: string) {
  const sa = JSON.stringify(a)
  const sb = JSON.stringify(b)
  if (sa === sb) {
    passed++
    console.log(`  ok  ${name}`)
  } else {
    failed++
    fails.push(name)
    console.log(`FAIL  ${name}`)
    console.log(`      got:      ${String(sa).slice(0, 220)}`)
    console.log(`      expected: ${String(sb).slice(0, 220)}`)
  }
}

/* ------------------------------ fixtures ----------------------------- */

const facadeHero = (): Section => ({
  block_type: "container",
  layout: "1",
  flush: true,
  gap: { value: 0, unit: "px" },
  columns: [
    {
      widgets: [
        {
          widget_type: "hero_slider",
          slides: [{ title: "Slide A" }, { title: "Slide B" }],
        },
      ],
    },
  ],
})

const twoCol = (): Section => ({
  block_type: "container",
  layout: "2",
  columns: [
    {
      widgets: [
        { widget_type: "heading", text: "Hello" },
        { widget_type: "text", html: "<p>body</p>" },
      ],
    },
    { widgets: [{ widget_type: "button", label: "Go" }] },
  ],
})

const thirdSec = (): Section => ({
  block_type: "container",
  layout: "1",
  columns: [{ widgets: [{ widget_type: "heading", text: "Third" }] }],
})

const freshState = (): EditorState => ({
  content: [facadeHero(), twoCol(), thirdSec()],
  chrome: {
    header: { sticky: true },
    footer: { note: "hi" },
  },
})

/* Apply a RunResult's chrome part to a chrome map. */
const chromeAfter = (
  chrome: EditorState["chrome"],
  res: { chrome?: { region: string; data: Record<string, unknown> }[] } | null
) => {
  if (!res?.chrome) return chrome
  const out = { ...chrome }
  for (const { region, data } of res.chrome) out[region] = data
  return out
}

/** invert-before-run, run, run the inverse, compare bytes to the pre state. */
function roundTrip(name: string, pre: EditorState, cmd: Command) {
  const impl = COMMANDS[cmd.name]
  const inv = impl.invert(pre, cmd.args)
  const res = impl.run(pre, cmd.args)
  ok(res, `${name}: command applied`)
  if (!res) return
  const post: EditorState = {
    content: res.content ?? pre.content,
    chrome: chromeAfter(pre.chrome, res),
  }
  // The command must have actually changed something.
  ok(
    JSON.stringify(post) !== JSON.stringify(pre),
    `${name}: state changed`
  )
  const invImpl = COMMANDS[inv.name]
  const res2 = invImpl.run(post, inv.args)
  ok(res2, `${name}: inverse applied`)
  const back: EditorState = {
    content: res2?.content ?? post.content,
    chrome: chromeAfter(post.chrome, res2),
  }
  eq(back.content, pre.content, `${name}: content bytes restored`)
  eq(back.chrome, pre.chrome, `${name}: chrome bytes restored`)
}

/* ------------------------- 1. invert round-trips ---------------------- */

console.log("\n[1] registry invert() round-trips")

roundTrip("section.insert(rich_text)", freshState(), {
  name: "section.insert",
  args: { at: 1, type: "rich_text" },
})

roundTrip("section.insertRaw", freshState(), {
  name: "section.insertRaw",
  args: { at: 0, section: thirdSec() },
})

roundTrip("section.remove", freshState(), {
  name: "section.remove",
  args: { index: 1 },
})

roundTrip("section.duplicate", freshState(), {
  name: "section.duplicate",
  args: { index: 0 },
})

roundTrip("section.move 0->2", freshState(), {
  name: "section.move",
  args: { from: 0, to: 2 },
})

roundTrip("section.move 2->0", freshState(), {
  name: "section.move",
  args: { from: 2, to: 0 },
})

roundTrip("section.setProps", freshState(), {
  name: "section.setProps",
  args: { index: 2, section: { ...thirdSec(), layout: "1", pad: 1 } },
})

roundTrip("section.setBags set style", freshState(), {
  name: "section.setBags",
  args: { index: 1, bags: { style: { bg: "#fff" } } },
})

// setBags round-trip where the bag PRE-EXISTS (restore must bring the old
// value back, not delete the key).
{
  const pre = freshState()
  ;(pre.content[1] as any).style = { bg: "#000", pad: 2 }
  roundTrip("section.setBags overwrite existing", pre, {
    name: "section.setBags",
    args: { index: 1, bags: { style: { bg: "#fff" } } },
  })
}

roundTrip("container.insert", freshState(), {
  name: "container.insert",
  args: { at: 3, cols: 3 },
})

roundTrip("container.setLayout 2->4", freshState(), {
  name: "container.setLayout",
  args: { index: 1, cols: 4 },
})

// THE F1-critical one: widget.insert into a FACADE clears `flush`
// (structural top-level write); the inverse must RESTORE the flag so the
// published render stays collapsed after undo.
{
  const pre = freshState()
  const impl = COMMANDS["widget.insert"]
  const cmd = {
    name: "widget.insert" as const,
    args: { index: 0, colPath: [0], type: "heading", wi: 1 },
  }
  const res = impl.run(pre, cmd.args)
  ok(res?.content, "widget.insert on facade: applied")
  ok(
    res?.content && (res.content[0] as any).flush === undefined,
    "widget.insert on facade: flush cleared (structural write, F1)"
  )
  roundTrip("widget.insert on facade (flush restored by undo)", pre, cmd)
}

roundTrip("widget.insertWrapped", freshState(), {
  name: "widget.insertWrapped",
  args: { at: 1, type: "heading" },
})

roundTrip("widget.remove", freshState(), {
  name: "widget.remove",
  args: { index: 1, path: [0, 1] },
})

roundTrip("widget.duplicate", freshState(), {
  name: "widget.duplicate",
  args: { index: 1, path: [0, 0] },
})

roundTrip("widget.paste", freshState(), {
  name: "widget.paste",
  args: {
    index: 1,
    path: [1, 0],
    widget: { widget_type: "heading", text: "pasted" },
  },
})

roundTrip("widget.move 0->2 (same column)", freshState(), {
  name: "widget.move",
  args: { index: 1, colPath: [0], from: 0, to: 2 },
})

/* ---------------- widget.transfer (3A: the full move matrix) --------- */

// Same-section CROSS-COLUMN: heading leaves column 0 for column 1; invert
// is the exact before-section (widget.move precedent), byte round-trip.
roundTrip("widget.transfer same-section cross-column", freshState(), {
  name: "widget.transfer",
  args: {
    from: { index: 1, colPath: [0], wi: 0 },
    to: { index: 1, colPath: [1], wi: 1 },
  },
})

// CROSS-SECTION: invert is the REVERSE TRANSFER (no snapshot) and the
// moved widget is the EXISTING object — bags and content intact.
{
  const pre = freshState()
  ;((pre.content[1] as any).columns[0].widgets[0] as any).style = {
    color: "#b00",
  }
  const cmd = {
    name: "widget.transfer" as const,
    args: {
      from: { index: 1, colPath: [0], wi: 0 },
      to: { index: 2, colPath: [0], wi: 1 },
    },
  }
  const inv = COMMANDS["widget.transfer"].invert(pre, cmd.args)
  ok(
    inv.name === "widget.transfer",
    "widget.transfer cross-section: invert is a reverse transfer (not a snapshot)"
  )
  eq(
    inv.args,
    {
      from: { index: 2, colPath: [0], wi: 1 },
      to: { index: 1, colPath: [0], wi: 0 },
    },
    "widget.transfer cross-section: reverse transfer addresses the landed slot"
  )
  const res = COMMANDS["widget.transfer"].run(pre, cmd.args)
  ok(
    res?.content &&
      JSON.stringify((res.content[2] as any).columns[0].widgets[1]) ===
        JSON.stringify((pre.content[1] as any).columns[0].widgets[0]),
    "widget.transfer cross-section: the EXISTING widget object moved (style bag intact)"
  )
  roundTrip("widget.transfer cross-section", pre, cmd)
}

// FACADE-IN: moving a widget INTO a facade's top-level column clears its
// `flush` (the existing structural rule, unforked); undo restores it
// byte-exactly (degraded snapshot inverse — flush key order survives).
{
  const pre = freshState()
  const cmd = {
    name: "widget.transfer" as const,
    args: {
      from: { index: 1, colPath: [0], wi: 0 },
      to: { index: 0, colPath: [0], wi: 1 },
    },
  }
  const res = COMMANDS["widget.transfer"].run(pre, cmd.args)
  ok(
    res?.content && (res.content[0] as any).flush === undefined,
    "widget.transfer facade-in: dest flush cleared (structural write, F1)"
  )
  roundTrip("widget.transfer facade-in (flush restored by undo)", pre, cmd)
}

// FACADE-OUT: moving the last widget OUT of a facade clears the source's
// `flush` too (0 widgets is no facade); undo restores the flag.
{
  const pre = freshState()
  const cmd = {
    name: "widget.transfer" as const,
    args: {
      from: { index: 0, colPath: [0], wi: 0 },
      to: { index: 1, colPath: [1], wi: 0 },
    },
  }
  const res = COMMANDS["widget.transfer"].run(pre, cmd.args)
  ok(
    res?.content && (res.content[0] as any).flush === undefined,
    "widget.transfer facade-out: source flush cleared (structural write, F1)"
  )
  ok(
    res?.content &&
      (res.content[1] as any).columns[1].widgets[0]?.widget_type ===
        "hero_slider",
    "widget.transfer facade-out: hero landed in the destination column"
  )
  roundTrip("widget.transfer facade-out (flush restored by undo)", pre, cmd)
}

// Destination path THREADS THROUGH the source column past the moved
// widget: removal shifts the inner section one slot down — the transfer
// adjusts, and the widget lands inside the inner column. Round-trips via
// the before-section.
{
  const innerHost = (): Section => ({
    block_type: "container",
    layout: "1",
    columns: [
      {
        widgets: [
          { widget_type: "text", html: "<p>lead</p>" },
          {
            widget_type: "inner_section",
            layout: "2",
            columns: [
              { widgets: [{ widget_type: "heading", text: "in" }] },
              { widgets: [] },
            ],
          },
        ],
      },
    ],
  })
  const pre: EditorState = {
    content: [facadeHero(), innerHost()],
    chrome: {},
  }
  const cmd = {
    name: "widget.transfer" as const,
    args: {
      from: { index: 1, colPath: [0], wi: 0 },
      // Pre-removal address: column 1 of the inner section at [0] wi 1.
      to: { index: 1, colPath: [0, 1, 1], wi: 0 },
    },
  }
  const res = COMMANDS["widget.transfer"].run(pre, cmd.args)
  ok(
    res?.content &&
      (res.content[1] as any).columns[0].widgets[0].columns[1].widgets[0]
        ?.widget_type === "text",
    "widget.transfer into a column threading the source: index adjusted, widget landed"
  )
  roundTrip("widget.transfer into inner column (threads source)", pre, cmd)

  // GUARDS on the same shape:
  ok(
    COMMANDS["widget.transfer"].run(pre, {
      from: { index: 1, colPath: [0], wi: 1 },
      to: { index: 1, colPath: [0, 1, 0], wi: 0 },
    }) === null,
    "widget.transfer refuses moving an inner section into its own column"
  )
  ok(
    COMMANDS["widget.transfer"].run(
      { content: [innerHost(), innerHost()], chrome: {} },
      {
        from: { index: 0, colPath: [0], wi: 1 },
        to: { index: 1, colPath: [0, 1, 0], wi: 0 },
      }
    ) === null,
    "widget.transfer refuses nesting an inner section inside another"
  )
  ok(
    COMMANDS["widget.transfer"].run(pre, {
      from: { index: 1, colPath: [0], wi: 7 },
      to: { index: 1, colPath: [1], wi: 0 },
    }) === null,
    "widget.transfer refuses a missing source widget"
  )
  ok(
    COMMANDS["widget.transfer"].run(pre, {
      from: { index: 1, colPath: [0], wi: 0 },
      to: { index: 1, colPath: [0], wi: 1 },
    }) === null,
    "widget.transfer same-column drop onto own slot is a guarded no-op"
  )
  ok(
    COMMANDS["widget.transfer"].run(pre, {
      from: { index: 1, colPath: [0, 0], wi: 0 },
      to: { index: 1, colPath: [1], wi: 0 },
    }) === null,
    "widget.transfer refuses an even-length (widget) column path"
  )
}

// Same-column transfer still behaves like widget.move (splice + adjust).
roundTrip("widget.transfer same-column reorder", freshState(), {
  name: "widget.transfer",
  args: {
    from: { index: 1, colPath: [0], wi: 0 },
    to: { index: 1, colPath: [0], wi: 2 },
  },
})

// Content write on a facade widget KEEPS flush (F1: non-structural).
{
  const pre = freshState()
  const impl = COMMANDS["widget.setProps"]
  const res = impl.run(pre, {
    index: 0,
    path: [0, 0],
    widget: {
      widget_type: "hero_slider",
      slides: [{ title: "Edited" }, { title: "Slide B" }],
    },
  })
  ok(
    res?.content && (res.content[0] as any).flush === true,
    "widget.setProps on facade: flush KEPT (content write, F1)"
  )
}

roundTrip("widget.setProps", freshState(), {
  name: "widget.setProps",
  args: {
    index: 1,
    path: [0, 0],
    widget: { widget_type: "heading", text: "Changed" },
  },
})

roundTrip("widget.setBags", freshState(), {
  name: "widget.setBags",
  args: { index: 1, path: [1, 0], bags: { style: { color: "red" } } },
})

// 2E integration: column.setBags round-trips (top-level column bags).
roundTrip("column.setBags set style", freshState(), {
  name: "column.setBags",
  args: {
    index: 1,
    colPath: [0],
    bags: { style: { background: { color: "#eee" } } },
  },
})

// Restore must bring the OLD bag value back, not delete the key.
{
  const pre = freshState()
  ;((pre.content[1] as any).columns[0] as any).style = { color: "#000" }
  roundTrip("column.setBags overwrite existing", pre, {
    name: "column.setBags",
    args: { index: 1, colPath: [0], bags: { style: { color: "#fff" } } },
  })
}

// Content-class write: column.setBags on a FACADE section must KEEP flush
// (F1's structural rule is about widget COUNT — this never touches it).
// (The editor never dispatches this shape — facade routing sends facade
// column styling to section.setBags — but templates/AI may.)
{
  const pre = freshState()
  const res = COMMANDS["column.setBags"].run(pre, {
    index: 0,
    colPath: [0],
    bags: { style: { bg: "#123" } },
  })
  ok(
    res?.content && (res.content[0] as any).flush === true,
    "column.setBags on facade: flush KEPT (content-class write)"
  )
}

// Guarded no-ops: even-length (widget) path and missing column refuse.
{
  const pre = freshState()
  ok(
    COMMANDS["column.setBags"].run(pre, {
      index: 1,
      colPath: [0, 0],
      bags: { style: { a: 1 } },
    }) === null,
    "column.setBags refuses an even-length (widget) path"
  )
  ok(
    COMMANDS["column.setBags"].run(pre, {
      index: 1,
      colPath: [7],
      bags: { style: { a: 1 } },
    }) === null,
    "column.setBags refuses a missing column"
  )
}

roundTrip("element.setBags", freshState(), {
  name: "element.setBags",
  args: { index: 0, key: "heading", bags: { style: { typography: { fontSize: { value: 20, unit: "px" } } } } },
})

roundTrip("item.duplicate (facade slides)", freshState(), {
  name: "item.duplicate",
  args: { index: 0, field: "slides", itemIndex: 0 },
})

roundTrip("item.remove (facade slides)", freshState(), {
  name: "item.remove",
  args: { index: 0, field: "slides", itemIndex: 1 },
})

// Last-item delete refused.
{
  const pre = freshState()
  ;((pre.content[0] as any).columns[0].widgets[0] as any).slides = [
    { title: "only" },
  ]
  const res = COMMANDS["item.remove"].run(pre, {
    index: 0,
    field: "slides",
    itemIndex: 0,
  })
  ok(res === null, "item.remove refuses the last item")
}

roundTrip("template.insert (flat block normalizes)", freshState(), {
  name: "template.insert",
  args: {
    at: 1,
    sections: [
      { block_type: "rich_text", html: "<p>tpl</p>" },
      thirdSec(),
    ],
  },
})

roundTrip("ai.apply patches (facade replace_props routes to widget)", freshState(), {
  name: "ai.apply",
  args: {
    patches: [
      { op: "replace_props", index: 0, props: { slides: [{ title: "AI" }] } },
      { op: "move_section", from: 2, to: 0 },
    ],
  },
})

roundTrip("ai.apply {ref,set,before} (§4.1 single node)", freshState(), {
  name: "ai.apply",
  args: {
    ref: { t: "widget", i: 1, path: [0, 0] },
    set: { text: "AI heading" },
    before: { text: "Hello" },
    label: "AI: rewrote heading",
  },
})

roundTrip("chrome.setProps", freshState(), {
  name: "chrome.setProps",
  args: { region: "header", data: { sticky: false, promo: "x" } },
})

roundTrip("chrome.setBags", freshState(), {
  name: "chrome.setBags",
  args: { region: "footer", bags: { style: { bg: "#111" } } },
})

roundTrip("chromeElement.setBags", freshState(), {
  name: "chromeElement.setBags",
  args: { region: "header", key: "logo", bags: { style: { width: 120 } } },
})

roundTrip("doc.normalize (flat legacy page)", {
  content: [
    { block_type: "rich_text", html: "<p>legacy</p>" } as Section,
    twoCol(),
  ],
  chrome: {},
}, {
  name: "doc.normalize",
  args: {},
})

/* ---------------- 1b. slider.* round-trips (Phase 5B) ----------------
   Every slider command inverts via the exact before-section, so each
   round-trip is a byte-level restore claim — including §5's headline
   guarantee: undo of slider.upgradeSlide restores the FIELDS shape (and
   thereby theme Liquid rendering) byte-identically. Each mutating op is
   exercised on BOTH host shapes (facade widget / flat legacy section)
   at least once across the set; guards (last-slide delete, id
   collisions, missing ids) are asserted as no-ops. */

console.log("\n[1b] slider.* round-trips (5B)")

const layeredSlides = () => [
  {
    id: "sd-a",
    name: "Hero A",
    background: { type: "image", image: "/x.webp", fit: "cover" },
    layers: [
      {
        id: "ly-1",
        type: "text",
        frame: { base: { anchor: "cl", x: 8, y: 0, w: 46, h: "auto" } },
        props: { html: "Big title", tag: "h1" },
        style: { color: { ref: "--ff-heading" } },
      },
      {
        id: "ly-2",
        type: "button",
        frame: {
          base: { anchor: "cl", x: 8, y: 16, w: "auto", h: "auto" },
          mobile: { anchor: "bc", x: 0, y: 8, w: "auto", h: "auto" },
        },
        props: { label: "Shop", href: "/store" },
        anim: { preset: "fade", delay_ms: 150, duration_ms: 600 },
      },
    ],
  },
  {
    id: "sd-b",
    background: { type: "color", color: { ref: "--ff-primary" } },
    layers: [
      {
        id: "ly-1", // same layer id in a DIFFERENT slide — pair-unique
        type: "shape",
        frame: { base: { anchor: "br", x: 4, y: 4, w: 20, h: 12 } },
        props: {},
      },
    ],
  },
]

/** Layered hero as a Phase-1 facade (the normalized shape). */
const facadeLayeredHero = (): Section => ({
  block_type: "container",
  layout: "1",
  flush: true,
  gap: { value: 0, unit: "px" },
  columns: [
    {
      widgets: [
        { widget_type: "hero_slider", autoplay_ms: 5000, slides: layeredSlides() },
      ],
    },
  ],
})

/** Layered hero as a FLAT legacy section (never normalized). */
const flatLayeredHero = (): Section => ({
  block_type: "hero_slider",
  autoplay_ms: 5000,
  slides: layeredSlides(),
})

const sliderState = (host: "facade" | "flat"): EditorState => ({
  content: [
    host === "facade" ? facadeLayeredHero() : flatLayeredHero(),
    twoCol(),
  ],
  chrome: {},
})

roundTrip("slider.addSlide (facade host)", sliderState("facade"), {
  name: "slider.addSlide",
  args: {
    index: 0,
    slide: { id: "sd-new", background: { type: "color", color: "#123" }, layers: [] },
  },
})

roundTrip("slider.addSlide at 0 (flat host)", sliderState("flat"), {
  name: "slider.addSlide",
  args: {
    index: 0,
    at: 0,
    slide: { id: "sd-new", background: { type: "color" }, layers: [] },
  },
})

roundTrip("slider.duplicateSlide", sliderState("facade"), {
  name: "slider.duplicateSlide",
  args: { index: 0, slideId: "sd-a", newId: "sd-copy" },
})

roundTrip("slider.removeSlide", sliderState("flat"), {
  name: "slider.removeSlide",
  args: { index: 0, slideId: "sd-a" },
})

roundTrip("slider.reorderSlides", sliderState("facade"), {
  name: "slider.reorderSlides",
  args: { index: 0, slideId: "sd-b", to: 0 },
})

roundTrip("slider.setSlideBackground", sliderState("facade"), {
  name: "slider.setSlideBackground",
  args: {
    index: 0,
    slideId: "sd-a",
    background: {
      type: "image",
      image: "/y.webp",
      overlay: { color: "#000", opacity: 0.4 },
    },
  },
})

roundTrip("slider.setSlideProps (rename + duration)", sliderState("flat"), {
  name: "slider.setSlideProps",
  args: {
    index: 0,
    slideId: "sd-a",
    props: { name: "Renamed", duration_ms: 7000 },
  },
})

roundTrip("slider.addLayer", sliderState("facade"), {
  name: "slider.addLayer",
  args: {
    index: 0,
    slideId: "sd-b",
    layer: {
      id: "ly-new",
      type: "icon",
      frame: { base: { anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" } },
      props: { icon: "fas fa-star", size: 32 },
    },
  },
})

roundTrip("slider.removeLayer", sliderState("facade"), {
  name: "slider.removeLayer",
  args: { index: 0, slideId: "sd-a", layerId: "ly-2" },
})

roundTrip("slider.duplicateLayer", sliderState("flat"), {
  name: "slider.duplicateLayer",
  args: { index: 0, slideId: "sd-a", layerId: "ly-1", newId: "ly-copy" },
})

roundTrip("slider.reorderLayers (restack)", sliderState("facade"), {
  name: "slider.reorderLayers",
  args: { index: 0, slideId: "sd-a", layerId: "ly-1", to: 1 },
})

roundTrip("slider.setLayerFrame desktop (base)", sliderState("facade"), {
  name: "slider.setLayerFrame",
  args: {
    index: 0,
    slideId: "sd-a",
    layerId: "ly-1",
    device: "desktop",
    frame: { anchor: "tc", x: 0, y: 12, w: 40, h: "auto" },
  },
})

roundTrip("slider.setLayerFrame tablet override write", sliderState("flat"), {
  name: "slider.setLayerFrame",
  args: {
    index: 0,
    slideId: "sd-a",
    layerId: "ly-1",
    device: "tablet",
    frame: { anchor: "cc", x: 0, y: 0, w: 60, h: "auto" },
  },
})

roundTrip("slider.setLayerFrame mobile override CLEAR", sliderState("facade"), {
  name: "slider.setLayerFrame",
  args: { index: 0, slideId: "sd-a", layerId: "ly-2", device: "mobile", frame: null },
})

roundTrip("slider.setLayerProps (props merge)", sliderState("facade"), {
  name: "slider.setLayerProps",
  args: {
    index: 0,
    slideId: "sd-a",
    layerId: "ly-1",
    props: { html: "New copy", tag: "h2" },
  },
})

roundTrip("slider.setLayerProps (rename + hide on mobile)", sliderState("flat"), {
  name: "slider.setLayerProps",
  args: {
    index: 0,
    slideId: "sd-a",
    layerId: "ly-2",
    name: "CTA",
    hidden: { mobile: true },
  },
})

roundTrip("slider.setLayerStyle set", sliderState("facade"), {
  name: "slider.setLayerStyle",
  args: {
    index: 0,
    slideId: "sd-a",
    layerId: "ly-1",
    bags: { style: { color: "#fff", typography: { size: 40 } } },
  },
})

{
  // {} deletes the bag key — and undo restores it byte-exactly.
  const pre = sliderState("facade")
  roundTrip("slider.setLayerStyle delete via {}", pre, {
    name: "slider.setLayerStyle",
    args: { index: 0, slideId: "sd-a", layerId: "ly-1", bags: { style: {} } },
  })
}

roundTrip("slider.setLayerAnim set", sliderState("facade"), {
  name: "slider.setLayerAnim",
  args: {
    index: 0,
    slideId: "sd-a",
    layerId: "ly-1",
    anim: { preset: "slide-up", delay_ms: 200, duration_ms: 700, ease: "ease-out" },
  },
})

roundTrip("slider.setLayerAnim none deletes", sliderState("flat"), {
  name: "slider.setLayerAnim",
  args: { index: 0, slideId: "sd-a", layerId: "ly-2", anim: { preset: "none" } },
})

/* §5's headline: upgrade a FIELDS hero (the existing facadeHero fixture),
   then prove undo restores the fields shape byte-identically. */
roundTrip("slider.upgradeSlide (fields → layered, undo restores fields)", freshState(), {
  name: "slider.upgradeSlide",
  args: { index: 0, idSeed: "up1" },
})

{
  // Determinism: the same idSeed replays to identical bytes (redo claim).
  const a = COMMANDS["slider.upgradeSlide"].run(freshState(), {
    index: 0,
    idSeed: "up1",
  })
  const b = COMMANDS["slider.upgradeSlide"].run(freshState(), {
    index: 0,
    idSeed: "up1",
  })
  eq(a?.content, b?.content, "upgradeSlide is deterministic per idSeed")
}

/* ---- 5C: upgrade ids + the theme placement hint (ARCH-SLIDER S3) ---- */
{
  const slidesOf = (content: Section[] | undefined): any[] => {
    const sec: any = content?.[0]
    const w = sec?.columns?.[0]?.widgets?.[0]
    const host = sec?.block_type === "hero_slider" ? sec : w
    return Array.isArray(host?.slides) ? host.slides : []
  }

  // Ids derive from the slide INDEX (`up-<i>` — the renderer's render-time
  // convention, 5A-NOTES §3), never from the idSeed: an editor commit and a
  // render-time preview of the same slider carry identical ids.
  const a = COMMANDS["slider.upgradeSlide"].run(freshState(), {
    index: 0,
    idSeed: "seed-one",
  })
  const b = COMMANDS["slider.upgradeSlide"].run(freshState(), {
    index: 0,
    idSeed: "seed-two",
  })
  eq(a?.content, b?.content, "5C: upgrade output is idSeed-independent")
  const upSlides = slidesOf(a?.content)
  ok(
    upSlides.length === 2 && upSlides[0]?.id === "up-0" && upSlides[1]?.id === "up-1",
    "5C: upgraded slide ids are up-<index>"
  )
  ok(
    upSlides[0]?.layers?.[0]?.id === "up-0-title",
    "5C: layer ids ride the slide id (up-0-title)"
  )

  // Placement hint: rides the ARGS (resolved at dispatch, command stays
  // pure), lands the hinted frames, stays byte-deterministic, and undo
  // still restores the fields shape byte-identically.
  const rokonish = {
    title: { frame: { anchor: "cl", x: 7, y: 0, w: 52, h: "auto" }, delay_ms: 150 },
  }
  roundTrip("5C: upgradeSlide with placement hint", freshState(), {
    name: "slider.upgradeSlide",
    args: { index: 0, idSeed: "up1", placement: rokonish },
  })
  const p1 = COMMANDS["slider.upgradeSlide"].run(freshState(), {
    index: 0,
    idSeed: "up1",
    placement: rokonish,
  })
  const p2 = COMMANDS["slider.upgradeSlide"].run(freshState(), {
    index: 0,
    idSeed: "up1",
    placement: rokonish,
  })
  eq(p1?.content, p2?.content, "5C: placement upgrade is deterministic")
  const pSlides = slidesOf(p1?.content)
  const titleFrame = pSlides[0]?.layers?.[0]?.frame?.base
  ok(
    titleFrame?.x === 7 && titleFrame?.w === 52,
    "5C: hinted title frame (cl/7%/52%) lands on the upgraded layer"
  )
  const dSlides = slidesOf(
    COMMANDS["slider.upgradeSlide"].run(freshState(), { index: 0, idSeed: "up1" })?.content
  )
  ok(
    dSlides[0]?.layers?.[0]?.frame?.base?.x === 8,
    "5C: hint-less upgrade keeps the platform default (8% inset)"
  )
  ok(
    COMMANDS["slider.upgradeSlide"].run(freshState(), {
      index: 0,
      idSeed: "up1",
      placement: "not-an-object",
    }) !== null &&
      slidesOf(
        COMMANDS["slider.upgradeSlide"].run(freshState(), {
          index: 0,
          idSeed: "up1",
          placement: "not-an-object",
        })?.content
      )[0]?.layers?.[0]?.frame?.base?.x === 8,
    "5C: malformed placement degrades to the default, never throws"
  )
}


{
  // Guards: every refused shape is a strict no-op (null), so nothing is
  // applied and nothing is recorded.
  const st = sliderState("facade")
  ok(
    COMMANDS["slider.removeSlide"].run(
      { content: [flatLayeredHero(), twoCol()], chrome: {} },
      { index: 0, slideId: "sd-a" }
    ) !== null,
    "guard baseline: removeSlide applies when >1 slide"
  )
  const oneSlide: Section = {
    block_type: "hero_slider",
    slides: [layeredSlides()[0]],
  }
  ok(
    COMMANDS["slider.removeSlide"].run(
      { content: [oneSlide], chrome: {} },
      { index: 0, slideId: "sd-a" }
    ) === null,
    "guard: last-slide delete refused"
  )
  ok(
    COMMANDS["slider.addSlide"].run(st, {
      index: 0,
      slide: { id: "sd-a", background: { type: "color" }, layers: [] },
    }) === null,
    "guard: duplicate slide id refused"
  )
  ok(
    COMMANDS["slider.addLayer"].run(st, {
      index: 0,
      slideId: "sd-a",
      layer: {
        id: "ly-1",
        type: "text",
        frame: { base: { anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" } },
        props: {},
      },
    }) === null,
    "guard: duplicate layer id refused"
  )
  ok(
    COMMANDS["slider.setLayerFrame"].run(st, {
      index: 0,
      slideId: "sd-a",
      layerId: "ly-1",
      device: "desktop",
      frame: { anchor: "zz", x: 0, y: 0, w: 10, h: 10 },
    }) === null,
    "guard: invalid anchor refused"
  )
  ok(
    COMMANDS["slider.setLayerFrame"].run(st, {
      index: 0,
      slideId: "sd-a",
      layerId: "ly-1",
      device: "desktop",
      frame: null,
    }) === null,
    "guard: clearing the BASE frame refused"
  )
  ok(
    COMMANDS["slider.removeLayer"].run(st, {
      index: 0,
      slideId: "sd-a",
      layerId: "nope",
    }) === null,
    "guard: unknown layer id refused"
  )
  ok(
    COMMANDS["slider.upgradeSlide"].run(st, { index: 0, idSeed: "x" }) === null,
    "guard: upgrade of an already-layered slider is a no-op"
  )
  ok(
    COMMANDS["slider.addSlide"].run(st, { index: 1, slide: layeredSlides()[0] }) ===
      null,
    "guard: section without a hero_slider host refused"
  )
  // Facade neutrality: a slide edit never drops the facade's flush flag.
  const res = COMMANDS["slider.setSlideProps"].run(st, {
    index: 0,
    slideId: "sd-a",
    props: { name: "n" },
  })
  ok(
    !!res?.content && (res.content[0] as any).flush === true,
    "facade flush survives slide edits (content-class write)"
  )
}

/* ---------------- 2. executor: coalescing + history ------------------ */

console.log("\n[2] executor history semantics")

function makeHost(initial: EditorState) {
  const st = {
    content: initial.content as Section[] | null,
    chrome: initial.chrome,
    sel: null as unknown,
    histChanges: 0,
  }
  const host = {
    getContent: () => st.content,
    getChrome: () => st.chrome,
    applyContent: (n: Section[]) => {
      st.content = n
    },
    applyChrome: (r: string, d: Record<string, unknown>) => {
      st.chrome = { ...st.chrome, [r]: d }
    },
    getSel: () => st.sel,
    setSel: (s: unknown) => {
      st.sel = s
    },
    onHistoryChange: () => {
      st.histChanges++
    },
  }
  return { st, host }
}

// Controllable clock so the coalescing window is testable.
const realNow = Date.now
let clock = 1_000_000
Date.now = () => clock

{
  // setProps coalescing: same command+target within the window = ONE entry.
  const init = freshState()
  const bytes0 = JSON.stringify(init.content)
  const { st, host } = makeHost(init)
  const exe = createExecutor(host)
  st.sel = { kind: "section", index: 2 }

  exe.execute({
    name: "section.setProps",
    args: { index: 2, section: { ...thirdSec(), a: 1 } },
  })
  clock += 100
  exe.execute({
    name: "section.setProps",
    args: { index: 2, section: { ...thirdSec(), a: 12 } },
  })
  clock += 100
  exe.execute({
    name: "section.setProps",
    args: { index: 2, section: { ...thirdSec(), a: 123 } },
  })
  ok(exe.entries().length === 1, "typing coalesces: 3 setProps same target = 1 entry")

  // Different TARGET does not merge (key includes the index).
  clock += 100
  exe.execute({
    name: "section.setProps",
    args: { index: 1, section: { ...twoCol(), b: 1 } },
  })
  ok(exe.entries().length === 2, "different target = new entry")

  // Different COMMAND right after typing does not merge (not wall clock).
  clock += 100
  exe.execute({ name: "widget.remove", args: { index: 1, path: [0, 1] } })
  ok(exe.entries().length === 3, "delete right after typing = new entry (command key differs)")

  // Window expiry: same key after > window = new entry.
  clock += 5000
  exe.execute({
    name: "section.setProps",
    args: { index: 1, section: { ...twoCol(), b: 2 } },
  })
  ok(exe.entries().length === 4, "same key after window expiry = new entry")

  // Labels are humane.
  ok(
    typeof exe.entries()[0]?.label === "string" && exe.entries()[0].label.length > 0,
    `entries carry labels (first: "${exe.entries()[0]?.label}")`
  )

  // Undo everything restores the original bytes AND the selection.
  st.sel = { kind: "widget", index: 1, path: [0, 0] }
  exe.undo()
  exe.undo()
  exe.undo()
  exe.undo()
  eq(JSON.parse(JSON.stringify(st.content)), JSON.parse(bytes0), "undo x4 restores original content bytes")
  eq(st.sel, { kind: "section", index: 2 }, "undo restores the selection recorded at dispatch")

  // Redo replays to the final state.
  exe.redo()
  exe.redo()
  exe.redo()
  exe.redo()
  ok((st.content as any)[1].b === 2, "redo x4 replays to the final state")
}

{
  // txn grouping: same txn id = one entry regardless of key/timing.
  const { st, host } = makeHost(freshState())
  void st
  const exe = createExecutor(host)
  exe.execute({
    name: "section.setBags",
    args: { index: 1, bags: { style: { a: 1 } } },
    txn: "ai-123",
  })
  clock += 10_000
  exe.execute({
    name: "element.setBags",
    args: { index: 0, key: "heading", bags: { style: { b: 2 } } },
    txn: "ai-123",
  })
  ok(exe.entries().length === 1, "same txn groups into one entry across commands and time")
}

{
  // Chrome JOINS the undo stack; undo restores the region.
  const init = freshState()
  const headerBytes = JSON.stringify(init.chrome.header)
  const { st, host } = makeHost(init)
  const exe = createExecutor(host)
  exe.execute({
    name: "chrome.setProps",
    args: { region: "header", data: { sticky: false } },
  })
  ok(exe.canUndo(), "chrome edit created a history entry")
  exe.undo()
  eq(JSON.parse(JSON.stringify(st.chrome.header)), JSON.parse(headerBytes), "undo restored the chrome region")
}

{
  // ai.apply patch list = ONE labeled entry; undo restores bytes.
  const init = freshState()
  const bytes0 = JSON.stringify(init.content)
  const { st, host } = makeHost(init)
  const exe = createExecutor(host)
  exe.execute({
    name: "ai.apply",
    args: {
      patches: [
        { op: "replace_props", index: 0, props: { slides: [{ title: "AI" }] } },
        { op: "remove_section", index: 2 },
      ],
    },
    label: "AI: restyled page",
  })
  ok(exe.entries().length === 1, "multi-patch ai.apply = one entry")
  ok(exe.entries()[0].label === "AI: restyled page", "ai entry carries its label")
  exe.undo()
  eq(JSON.parse(JSON.stringify(st.content)), JSON.parse(bytes0), "undo of ai.apply restores content bytes")
}

{
  // Staged preview: apply without history, promote to ONE entry.
  const init = freshState()
  const bytes0 = JSON.stringify(init.content)
  const { st, host } = makeHost(init)
  const exe = createExecutor(host)
  exe.execute(
    {
      name: "ai.apply",
      args: {
        ref: { t: "section", i: 2 },
        set: { staged_marker: 1 },
        before: {},
      },
    },
    { staged: true }
  )
  ok(exe.entries().length === 0, "staged apply writes NO history entry")
  ok(exe.hasStage(), "stage is pending")
  exe.promoteStaged("AI: staged edit")
  ok(exe.entries().length === 1, "promote = one labeled entry")
  exe.undo()
  eq(JSON.parse(JSON.stringify(st.content)), JSON.parse(bytes0), "undo of promoted stage restores bytes")
}

{
  // Staged preview: discard restores without any entry.
  const init = freshState()
  const bytes0 = JSON.stringify(init.content)
  const { st, host } = makeHost(init)
  const exe = createExecutor(host)
  exe.execute(
    {
      name: "ai.apply",
      args: { ref: { t: "section", i: 2 }, set: { x: 1 }, before: {} },
    },
    { staged: true }
  )
  exe.discardStaged()
  ok(exe.entries().length === 0, "discarded stage leaves no history entry")
  eq(JSON.parse(JSON.stringify(st.content)), JSON.parse(bytes0), "discard restored bytes")
}

/* ---------------- 3. snapshot fallback flag (P4 kill switch) --------- */

console.log("\n[3] snapshot fallback flag")

{
  // Fake a window with the flag ON: legacy behavior (snapshots, chrome
  // outside history, selection cleared on undo).
  ;(globalThis as any).window = {
    __FF_HISTORY_SNAPSHOT__: true,
    localStorage: { getItem: () => null },
  }
  const init = freshState()
  const bytes0 = JSON.stringify(init.content)
  const { st, host } = makeHost(init)
  const exe = createExecutor(host)
  st.sel = { kind: "section", index: 0 }

  exe.execute({
    name: "chrome.setProps",
    args: { region: "header", data: { sticky: false } },
  })
  ok(!exe.canUndo(), "fallback ON: chrome edits stay OUTSIDE history (legacy)")

  exe.execute({
    name: "section.setProps",
    args: { index: 2, section: { ...thirdSec(), z: 1 } },
  })
  ok(exe.canUndo(), "fallback ON: content edit snapshots")
  exe.undo()
  eq(JSON.parse(JSON.stringify(st.content)), JSON.parse(bytes0), "fallback ON: undo restores from snapshot")
  ok(st.sel === null, "fallback ON: undo clears selection (legacy)")

  // Flip the flag OFF at runtime: the entry path takes over immediately.
  ;(globalThis as any).window.__FF_HISTORY_SNAPSHOT__ = false
  ok(!exe.canUndo(), "flag OFF at runtime: executor consults the (empty) entry stack")
  exe.execute({
    name: "section.setProps",
    args: { index: 2, section: { ...thirdSec(), z: 2 } },
  })
  ok(exe.canUndo() && exe.entries().length === 1, "flag OFF: new edits create labeled entries")
  delete (globalThis as any).window
}

Date.now = realNow

/* ---------------- 4. section.convertToWidgets (6B — ARCH-CORE P5) ----- */

console.log("\n[4] section.convertToWidgets")

const richTextFacade = (): Section => ({
  block_type: "container",
  id: "rt-sec",
  layout: "1",
  flush: true,
  gap: { value: 0, unit: "px" },
  columns: [
    {
      id: "rt-col",
      widgets: [
        {
          id: "rt-w",
          widget_type: "rich_text",
          html: "<h2>Our Story</h2>\n<p>Body copy</p>",
          width: "narrow",
        },
      ],
    },
  ],
  style: { padding: { top: { value: 24, unit: "px" } } },
  advanced: { cssId: "story" },
  elementStyles: { title: { style: { color: "#123456" } } },
})

const imageWithTextFacade = (): Section => ({
  block_type: "container",
  id: "iwt-sec",
  layout: "1",
  flush: true,
  gap: { value: 0, unit: "px" },
  columns: [
    {
      id: "iwt-col",
      widgets: [
        {
          id: "iwt-w",
          widget_type: "image_with_text",
          image: "/img/craft.webp",
          image_side: "right",
          eyebrow: "Handmade",
          title: "Crafted with care,\nmade to be found",
          body: "Line one.\nLine two.",
          cta: { label: "shop now", href: "/store" },
        },
      ],
    },
  ],
})

const convertState = (): EditorState => ({
  content: [richTextFacade(), imageWithTextFacade(), thirdSec()],
  chrome: {},
})

// Undo restores the EXACT original section JSON — incl. the wrapper's
// `flush`, gap and elementStyles (the slider.upgradeSlide snapshot-inverse
// precedent).
roundTrip("section.convertToWidgets(rich_text facade)", convertState(), {
  name: "section.convertToWidgets",
  args: { index: 0, idSeed: "cv1" },
})

roundTrip("section.convertToWidgets(image_with_text facade)", convertState(), {
  name: "section.convertToWidgets",
  args: { index: 1, idSeed: "cv2" },
})

// Flat legacy shape (defensive — the load path normalizes, but the command
// must behave on any stored document handed to it).
roundTrip(
  "section.convertToWidgets(flat rich_text)",
  {
    content: [
      { block_type: "rich_text", html: "<p>x</p>", width: "wide" } as Section,
    ],
    chrome: {},
  },
  {
    name: "section.convertToWidgets",
    args: { index: 0, idSeed: "cv3" },
  }
)

{
  const impl = COMMANDS["section.convertToWidgets"]

  // Mapping bytes locked: rich_text facade → 1-col container holding ONE
  // text widget; wrapper keeps its section id; style/advanced carried;
  // the block's width select → style.width; elementStyles DROPPED (their
  // keys target theme [data-el] hooks platform widgets do not emit).
  const res = impl.run(convertState(), { index: 0, idSeed: "cv1" })
  eq(
    res?.content?.[0],
    {
      block_type: "container",
      id: "rt-sec",
      layout: "1",
      columns: [
        {
          id: "cv1-c0",
          widgets: [
            {
              id: "cv1-w0",
              widget_type: "text",
              html: "<h2>Our Story</h2>\n<p>Body copy</p>",
            },
          ],
        },
      ],
      style: { padding: { top: { value: 24, unit: "px" } }, width: "narrow" },
      advanced: { cssId: "story" },
    },
    "convertToWidgets: rich_text mapping bytes"
  )

  // image_with_text: two centered columns; image_side "right" puts the
  // text column first; eyebrow/title/body/cta map to text/heading/text/
  // button in order.
  const res2 = impl.run(convertState(), { index: 1, idSeed: "cv2" })
  const sec2: any = res2?.content?.[1]
  ok(
    sec2?.layout === "2" && sec2?.verticalAlign === "center",
    "convertToWidgets: iwt two centered columns"
  )
  const c0: any = sec2?.columns?.[0]
  const c1: any = sec2?.columns?.[1]
  eq(
    (c0?.widgets ?? []).map((w: any) => w.widget_type),
    ["text", "heading", "text", "button"],
    "convertToWidgets: iwt text column order (image_side right → text first)"
  )
  eq(
    (c1?.widgets ?? []).map((w: any) => w.widget_type),
    ["image"],
    "convertToWidgets: iwt image column"
  )
  ok(
    c0?.widgets?.[2]?.html === "<p>Line one.<br>Line two.</p>",
    "convertToWidgets: body newlines become <br>"
  )
  ok(
    c1?.widgets?.[0]?.alt === "Crafted with care, made to be found",
    "convertToWidgets: image alt from the title, linebreaks collapsed"
  )
  ok(
    c0?.widgets?.[3]?.label === "shop now" && c0?.widgets?.[3]?.href === "/store",
    "convertToWidgets: cta becomes a button widget"
  )

  // Deterministic: same args replay byte-identically (the redo contract —
  // ids derive from the dispatch-time idSeed, never from randomness).
  eq(
    res2?.content,
    impl.run(convertState(), { index: 1, idSeed: "cv2" })?.content,
    "convertToWidgets: deterministic replay"
  )

  // FACADE RULING: conversion reads THROUGH the one shared predicate
  // (flushSingleCommerceWidget). A flush wrapper whose inner widget
  // carries its own bags is NOT a facade — the engine will not collapse
  // it, the UI does not present it as the themed block, and silently
  // discarding the inner widget's own styling would lose merchant work —
  // so the command REFUSES it (guarded no-op, nothing recorded).
  const styled: any = richTextFacade()
  styled.columns[0].widgets[0].style = {
    typography: { fontSize: { value: 18, unit: "px" } },
  }
  ok(
    impl.run({ content: [styled], chrome: {} }, { index: 0, idSeed: "x" }) ===
      null,
    "convertToWidgets: non-facade wrapper (styled inner widget) refused"
  )

  // Every other section shape: refused.
  ok(
    impl.run(freshState(), { index: 0, idSeed: "x" }) === null,
    "convertToWidgets: hero facade refused"
  )
  ok(
    impl.run(freshState(), { index: 1, idSeed: "x" }) === null,
    "convertToWidgets: real container refused"
  )
  ok(
    impl.run(freshState(), { index: 9, idSeed: "x" }) === null,
    "convertToWidgets: missing index refused"
  )
}

/* --------------------------------------------------------------------- */

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) {
  console.log("Failures:\n  - " + fails.join("\n  - "))
  process.exit(1)
}
