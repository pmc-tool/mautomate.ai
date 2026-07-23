/* ------------------------------------------------------------------ */
/* Plain-assert test for normalizeDocument + facadeOf. No jest — run:   */
/*                                                                      */
/*   cd apps/storefront && bash src/modules/cms/document/__tests__/run-normalize-tests.sh */
/*                                                                      */
/* (bundles this file with the repo's esbuild, runs it with node).      */
/* ------------------------------------------------------------------ */

import assert from "assert"
import { normalizeDocument, type SectionNode } from "../normalize"
import { facadeOf, flushSingleCommerceWidget } from "../facade"
import {
  COMMERCE_WIDGET_TYPES,
  getWidgetSchema,
} from "../../schema/widgets"
import {
  containerWithCommerceWidgets,
  emptyPage,
  flatHeroSlider,
  flatStyledRichText,
  innerSectionContainer,
  mixedPage,
  multiColContainer,
  normalizedFlushHero,
  oneColContainer,
  unknownBlock,
} from "./normalize.fixtures"

let passed = 0
function ok(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const isNid = (v: unknown) => typeof v === "string" && (v as string).length > 0

/* Purity guard: pristine deep copies taken BEFORE any normalization.   */
const pristine = clone(mixedPage)

console.log("normalizeDocument")

ok("flat commerce block wraps into a flush 1-col container", () => {
  const r = normalizeDocument([clone(flatHeroSlider)])
  assert.strictEqual(r.changed, true)
  assert.strictEqual(r.content.length, 1)
  const s = r.content[0] as any
  assert.strictEqual(s.block_type, "container")
  assert.strictEqual(s.flush, true)
  assert.strictEqual(s.layout, "1")
  assert.deepStrictEqual(s.gap, { value: 0, unit: "px" })
  assert.ok(isNid(s.id))
  assert.strictEqual(s.columns.length, 1)
  assert.ok(isNid(s.columns[0].id))
  assert.strictEqual(s.columns[0].widgets.length, 1)
  const w = s.columns[0].widgets[0]
  assert.strictEqual(w.widget_type, "hero_slider")
  assert.ok(isNid(w.id))
  // content props preserved verbatim
  assert.strictEqual(w.autoplaySpeed, 5000)
  assert.deepStrictEqual(w.slides, flatHeroSlider.slides)
  // no meta leaked onto the widget
  assert.ok(!("block_type" in w) && !("style" in w) && !("advanced" in w) && !("elementStyles" in w) && !("schema_version" in w))
  // no style bags invented on the wrapper (source had none)
  assert.ok(!("style" in s) && !("advanced" in s) && !("elementStyles" in s))
})

ok("style/advanced/elementStyles stay at SECTION level on the wrapper", () => {
  const r = normalizeDocument([clone(flatStyledRichText)])
  const s = r.content[0] as any
  assert.strictEqual(s.block_type, "container")
  assert.strictEqual(s.flush, true)
  // pre-existing section id preserved on the wrapper
  assert.strictEqual(s.id, "sec-rich-1")
  // the three bags, byte-equal, on the SECTION — never the widget
  assert.deepStrictEqual(s.style, flatStyledRichText.style)
  assert.deepStrictEqual(s.advanced, flatStyledRichText.advanced)
  assert.deepStrictEqual(s.elementStyles, flatStyledRichText.elementStyles)
  const w = s.columns[0].widgets[0]
  assert.strictEqual(w.widget_type, "rich_text")
  assert.strictEqual(w.heading, "Our story")
  assert.strictEqual(w.html, "<p>We make things by hand.</p>")
  assert.ok(!("style" in w) && !("advanced" in w) && !("elementStyles" in w))
  // meta dropped everywhere
  assert.ok(!("schema_version" in s) && !("schema_version" in w))
})

ok("existing 1-col container passes through (id stamps only)", () => {
  const input = clone(oneColContainer)
  const r = normalizeDocument([input])
  assert.strictEqual(r.changed, true) // ids were missing → stamped
  const s = r.content[0] as any
  assert.strictEqual(s.block_type, "container")
  assert.notStrictEqual(s.flush, true) // never invented
  assert.strictEqual(s.layout, "1")
  assert.deepStrictEqual(s.gap, oneColContainer.gap)
  assert.strictEqual(s.verticalAlign, "top")
  assert.ok(isNid(s.id) && isNid(s.columns[0].id))
  const widgets = s.columns[0].widgets
  assert.strictEqual(widgets.length, 2)
  assert.strictEqual(widgets[0].widget_type, "heading")
  assert.strictEqual(widgets[0].text, "Welcome")
  assert.strictEqual(widgets[1].widget_type, "text")
  assert.ok(isNid(widgets[0].id) && isNid(widgets[1].id))
  // structurally identical apart from added ids
  const strip = (o: any) => JSON.parse(JSON.stringify(o, (k, v) => (k === "id" ? undefined : v)))
  assert.deepStrictEqual(strip(s), strip(oneColContainer))
})

ok("fully-id'd multi-col container is untouched — SAME reference", () => {
  const r = normalizeDocument([multiColContainer])
  assert.strictEqual(r.changed, false)
  assert.strictEqual(r.content[0], multiColContainer)
})

ok("container holding commerce widgets passes through", () => {
  const input = clone(containerWithCommerceWidgets)
  const r = normalizeDocument([input])
  const s = r.content[0] as any
  assert.strictEqual(s.block_type, "container")
  assert.strictEqual(s.columns.length, 2)
  assert.strictEqual(s.columns[0].widgets[0].widget_type, "product_tabs")
  assert.deepStrictEqual(s.columns[0].widgets[0].tabs, (containerWithCommerceWidgets as any).columns[0].widgets[0].tabs)
  assert.strictEqual(s.columns[1].widgets[0].widget_type, "heading")
})

ok("inner_section gets ids stamped recursively", () => {
  const r = normalizeDocument([clone(innerSectionContainer)])
  const s = r.content[0] as any
  const inner = s.columns[0].widgets[0]
  assert.strictEqual(inner.widget_type, "inner_section")
  assert.ok(isNid(inner.id))
  assert.strictEqual(inner.columns.length, 2)
  for (const col of inner.columns) {
    assert.ok(isNid(col.id))
    for (const w of col.widgets) assert.ok(isNid(w.id))
  }
  assert.strictEqual(inner.columns[0].widgets[0].text, "Inner left")
  assert.strictEqual(inner.columns[1].widgets[0].widget_type, "button")
})

ok("empty page: no change, same reference", () => {
  const r = normalizeDocument(emptyPage)
  assert.strictEqual(r.changed, false)
  assert.strictEqual(r.content, emptyPage)
  assert.strictEqual(r.content.length, 0)
})

ok("unknown block type passes through byte-untouched — SAME reference", () => {
  const r = normalizeDocument([unknownBlock])
  assert.strictEqual(r.changed, false)
  assert.strictEqual(r.content[0], unknownBlock)
  assert.deepStrictEqual(r.content[0], clone(unknownBlock))
})

ok("already-normalized flush wrapper is a no-op", () => {
  const r = normalizeDocument([normalizedFlushHero])
  assert.strictEqual(r.changed, false)
  assert.strictEqual(r.content[0], normalizedFlushHero)
})

ok("malformed entries (null / no block_type) pass through", () => {
  const junk = [null, 42, { foo: "bar" }] as unknown as SectionNode[]
  const r = normalizeDocument(junk)
  assert.strictEqual(r.changed, false)
  assert.strictEqual(r.content, junk)
})

ok("IDEMPOTENT: normalize(normalize(x)) === normalize(x), every fixture", () => {
  const pages: SectionNode[][] = [
    [clone(flatHeroSlider)],
    [clone(flatStyledRichText)],
    [clone(oneColContainer)],
    [clone(multiColContainer)],
    [clone(containerWithCommerceWidgets)],
    [clone(innerSectionContainer)],
    [clone(unknownBlock)],
    [clone(normalizedFlushHero)],
    clone(mixedPage),
    [],
  ]
  for (const page of pages) {
    const n1 = normalizeDocument(page)
    const n2 = normalizeDocument(n1.content)
    assert.strictEqual(n2.changed, false)
    assert.strictEqual(n2.content, n1.content) // same array reference back
    assert.deepStrictEqual(n2.content, n1.content) // and structurally equal
    // every section keeps its reference on the second pass
    n1.content.forEach((s, i) => assert.strictEqual(n2.content[i], s))
  }
})

ok("PURE: the input array and its objects are never mutated", () => {
  normalizeDocument(mixedPage)
  assert.deepStrictEqual(mixedPage, pristine)
})

ok("changed flag: false when nothing to do, true when anything changed", () => {
  const done = [multiColContainer, normalizedFlushHero]
  const r1 = normalizeDocument(done)
  assert.strictEqual(r1.changed, false)
  assert.strictEqual(r1.content, done)
  const r2 = normalizeDocument([multiColContainer, clone(flatHeroSlider)])
  assert.strictEqual(r2.changed, true)
  assert.strictEqual(r2.content[0], multiColContainer) // untouched keeps ref
})

console.log("facadeOf")

ok("normalized hero presents as Hero Slider (facade)", () => {
  const s = normalizeDocument([clone(flatHeroSlider)]).content[0]
  assert.deepStrictEqual(facadeOf(s), {
    label: "Hero Slider",
    iconType: "hero_slider",
    isFacade: true,
  })
  assert.strictEqual(flushSingleCommerceWidget(s)?.widget_type, "hero_slider")
})

ok("every commerce type wraps to a facade with its schema label", () => {
  for (const t of Array.from(COMMERCE_WIDGET_TYPES)) {
    const s = normalizeDocument([{ block_type: t }]).content[0]
    const f = facadeOf(s)
    assert.strictEqual(f.isFacade, true, t)
    assert.strictEqual(f.iconType, t)
    assert.strictEqual(f.label, getWidgetSchema(t)?.label, t)
  }
})

ok("real containers present as Container", () => {
  for (const s of [multiColContainer, oneColContainer, containerWithCommerceWidgets, innerSectionContainer]) {
    assert.deepStrictEqual(facadeOf(s), {
      label: "Container",
      iconType: "container",
      isFacade: false,
    })
    assert.strictEqual(flushSingleCommerceWidget(s), null)
  }
})

ok("flush container with a single BASIC widget is NOT a facade", () => {
  const s: SectionNode = {
    block_type: "container",
    id: "x",
    layout: "1",
    flush: true,
    gap: { value: 0, unit: "px" },
    columns: [{ id: "c", widgets: [{ id: "w", widget_type: "heading", text: "Hi" }] }],
  }
  assert.deepStrictEqual(facadeOf(s), { label: "Container", iconType: "container", isFacade: false })
  assert.strictEqual(flushSingleCommerceWidget(s), null)
})

ok("flush container with 2 widgets / 2 columns is NOT a facade", () => {
  const base = clone(normalizedFlushHero) as any
  base.columns[0].widgets.push({ id: "w2", widget_type: "heading", text: "More" })
  assert.strictEqual(facadeOf(base).isFacade, false)
  const twoCol = clone(normalizedFlushHero) as any
  twoCol.columns.push({ id: "c2", widgets: [] })
  assert.strictEqual(facadeOf(twoCol).isFacade, false)
})

ok("flat (un-normalized) sections present as their block, not a facade", () => {
  assert.deepStrictEqual(facadeOf(flatHeroSlider), {
    label: "Hero Slider",
    iconType: "hero_slider",
    isFacade: false,
  })
  assert.deepStrictEqual(facadeOf(flatStyledRichText), {
    label: "Rich Text",
    iconType: "rich_text",
    isFacade: false,
  })
})

ok("unknown block types get a titleized label", () => {
  assert.deepStrictEqual(facadeOf(unknownBlock), {
    label: "Mystery Widget X",
    iconType: "mystery_widget_x",
    isFacade: false,
  })
})

console.log(`\nALL PASS — ${passed} checks`)
