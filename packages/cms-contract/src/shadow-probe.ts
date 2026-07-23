/* ------------------------------------------------------------------ */
/* cms-contract — SHADOW DIVERGENCE PROBE (Phase 4B verification).      */
/*                                                                     */
/* Runs the hand-written registry validators and the contract-generated */
/* validators over:                                                     */
/*   1. every registered block's defaultData()                          */
/*   2. the contract defaults + every catalog preset                    */
/*   3. a systematic type-fuzz of every field path (wrong-type mutants, */
/*      deletions, responsive bags, NaN/Infinity, empty strings)        */
/*   4. targeted conditional cases (product_tabs bindings, ISO dates)   */
/*   5. every section found in /home/ratul/editor-truth/fixtures/**     */
/*      (incl. the 1V adversarial container shapes)                     */
/*   6. real draft + snapshot sections dumped from the DB               */
/*      (/home/ratul/4b-work/db-sections.json — see dump-sections.sh)   */
/* and reports every divergence of the POST-POLICY result (the only     */
/* thing consumers see: "is required" downgraded to non-blocking).      */
/* Raw (pre-policy) mismatches are reported separately as informational.*/
/*                                                                     */
/* RUN:                                                                 */
/*   cd /home/ratul/brandtodoor/packages/cms-contract                   */
/*   ../../node_modules/.bin/esbuild src/shadow-probe.ts --bundle       */
/*     --platform=node --format=cjs --outfile=/tmp/cms-probe.cjs        */
/*   node /tmp/cms-probe.cjs                                            */
/* Exit code 1 on any post-policy divergence.                           */
/* ------------------------------------------------------------------ */

import fs from "fs"
import path from "path"

import { BLOCK_REGISTRY, validateBlockData, getContractShadowStats } from "../../../apps/backend/src/modules/cms/registry"
import { generatedValidate } from "../../../apps/backend/src/modules/cms/registry/generated"
import { CONTRACT_DEFAULTS } from "../../../apps/backend/src/modules/cms/registry/generated/contract.gen"
import { BLOCK_SCHEMAS, defaultPropsFromSchema } from "./index"

type Case = { id: string; type: string; data: unknown }

const FIXTURE_DIR = "/home/ratul/editor-truth/fixtures"
const DB_DUMP = "/home/ratul/4b-work/db-sections.json"

const SECTION_STRIP = new Set([
  "block_type",
  "type",
  "style",
  "advanced",
  "elementStyles",
  "id",
  "schema_version",
])

const downgrade = (errors: string[]) =>
  (errors || []).filter((e) => !/\bis required\b/.test(e))

const sortedEq = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((e, i) => e === sb[i])
}

const deepEq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/* ---------------- case collection ----------------------------------- */

const cases: Case[] = []
const push = (id: string, type: string, data: unknown) =>
  cases.push({ id, type, data })

/* 1+2: defaults, contract defaults, presets */
for (const [type, def] of Object.entries(BLOCK_REGISTRY)) {
  if (!def) continue
  push(`defaultData:${type}`, type, def.defaultData())
  const cd = (CONTRACT_DEFAULTS as Record<string, unknown>)[type]
  if (cd) push(`contractDefaults:${type}`, type, cd)
  const schema = BLOCK_SCHEMAS[type]
  if (schema) {
    push(`schemaDefaults:${type}`, type, defaultPropsFromSchema(schema))
    for (const p of schema.presets ?? []) {
      push(`preset:${type}:${p.name}`, type, p.props)
    }
  }
}

/* 3: systematic fuzz — mutate every path of defaultData() */
const MUTANTS: Array<[string, unknown]> = [
  ["num", 42],
  ["emptyStr", ""],
  ["null", null],
  ["bool", true],
  ["obj", { x: 1 }],
  ["arr", ["x"]],
  ["junk", "junk"],
  ["respBag", { base: "x" }],
  ["nan", Number.NaN],
  ["negInf", Number.NEGATIVE_INFINITY],
  ["neg", -5],
  ["DELETE", Symbol.for("DELETE")],
]

function setPath(root: any, segs: (string | number)[], value: unknown): void {
  let cur = root
  for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]]
  const last = segs[segs.length - 1]
  if (value === Symbol.for("DELETE")) {
    if (Array.isArray(cur)) cur.splice(Number(last), 1)
    else delete cur[last]
  } else {
    cur[last] = value
  }
}

function collectPaths(v: unknown, prefix: (string | number)[] = []): (string | number)[][] {
  const out: (string | number)[][] = []
  if (Array.isArray(v)) {
    if (v.length > 0) {
      out.push([...prefix, 0])
      out.push(...collectPaths(v[0], [...prefix, 0]))
    }
  } else if (v && typeof v === "object") {
    for (const k of Object.keys(v as object)) {
      out.push([...prefix, k])
      out.push(...collectPaths((v as any)[k], [...prefix, k]))
    }
  }
  return out
}

for (const [type, def] of Object.entries(BLOCK_REGISTRY)) {
  if (!def) continue
  const base = def.defaultData() as Record<string, unknown>
  for (const p of collectPaths(base)) {
    for (const [mname, mval] of MUTANTS) {
      const copy = JSON.parse(JSON.stringify(base))
      try {
        setPath(copy, p, mval)
      } catch {
        continue
      }
      push(`fuzz:${type}:${p.join(".")}=${mname}`, type, copy)
    }
  }
  /* root-level non-object payloads */
  for (const bad of [null, 42, "x", ["y"], undefined]) {
    push(`fuzz:${type}:root=${JSON.stringify(bad)}`, type, bad)
  }
}

/* 4: targeted conditionals */
const targeted: Array<[string, unknown]> = [
  ["product_tabs", { tabs: [{ label: "L", source: "category" }] }],
  ["product_tabs", { tabs: [{ label: "L", source: "collection" }] }],
  ["product_tabs", { tabs: [{ label: "L", source: "manual" }] }],
  ["product_tabs", { tabs: [{ label: "L", source: "manual", product_ids: ["a", ""] }] }],
  ["product_tabs", { tabs: [{ label: "L", source: "manual", product_ids: "x" }] }],
  ["product_tabs", { tabs: [{ label: "L", source: "manual", product_ids: [] }] }],
  ["product_tabs", { tabs: [{ label: "", source: "bogus", sort: "bogus", limit: -1 }] }],
  ["product_tabs", { tabs: ["x", null, 7] }],
  ["product_tabs", { tabs: {} }],
  ["deal_of_day", { image: "i", title: "t", countdown_to: "not-a-date", cta: { href: "/x" } }],
  ["deal_of_day", { image: "i", title: "t", countdown_to: "", cta: { href: "/x" } }],
  ["deal_of_day", { image: "i", title: "t", countdown_to: 42, cta: "nope" }],
  ["hero_slider", { autoplay_ms: -1, slides: [{ cta: "x" }, null, "y"] }],
  ["hero_slider", { slides: "not-an-array" }],
  ["rich_text", { html: 42, width: 42 }],
  ["rich_text", { html: "", width: "bogus" }],
  ["image_with_text", { image: "", image_side: "up", title: 3, cta: [] }],
  ["promo_banner_grid", { intro: "x", sale: 4, categories: "y", instagram: [] }],
  ["promo_banner_grid", { categories: [{ wide: "yes", height: "tall", fit: 9 }] }],
  ["image_gallery", { columns: 9, gap: true, aspect: 4, items: [{ image: "", href: 4, caption: 5 }] }],
  ["container", { layout: "9", verticalAlign: "diagonal", gap: "x", columns: [{ widgets: [{}, { widget_type: "" }, { widget_type: "heading" }, "x"] }, "y"] }],
]
targeted.forEach(([t, d], i) => push(`targeted:${t}:${i}`, t as string, d))

/* 5: fixture files */
function collectSections(v: unknown, file: string, trail: string): void {
  if (Array.isArray(v)) {
    v.forEach((x, i) => collectSections(x, file, `${trail}[${i}]`))
    return
  }
  if (!v || typeof v !== "object") return
  const rec = v as Record<string, unknown>
  const bt = rec.block_type ?? rec.type
  if (typeof bt === "string" && (BLOCK_REGISTRY as Record<string, unknown>)[bt]) {
    if (rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)) {
      push(`file:${file}${trail}(data)`, bt, rec.data)
    }
    if (rec.block_type) {
      const props: Record<string, unknown> = {}
      for (const k of Object.keys(rec)) {
        if (!SECTION_STRIP.has(k)) props[k] = rec[k]
      }
      push(`file:${file}${trail}`, bt, props)
    }
  }
  for (const k of Object.keys(rec)) {
    collectSections(rec[k], file, `${trail}.${k}`)
  }
}

function loadFixtures(dir: string): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      loadFixtures(p)
    } else if (entry.name.endsWith(".json")) {
      try {
        collectSections(JSON.parse(fs.readFileSync(p, "utf8")), path.relative(FIXTURE_DIR, p), "")
      } catch {
        /* non-JSON payloads are not the probe's problem */
      }
    }
  }
}
loadFixtures(FIXTURE_DIR)

/* 6: DB sections */
if (fs.existsSync(DB_DUMP)) {
  const rows = JSON.parse(fs.readFileSync(DB_DUMP, "utf8")) as Array<{
    src: string
    type: string
    data: unknown
  }>
  rows.forEach((r, i) => {
    if ((BLOCK_REGISTRY as Record<string, unknown>)[r.type]) {
      push(`db:${r.src}#${i}`, r.type, r.data)
    }
  })
} else {
  console.warn(`probe: no DB dump at ${DB_DUMP} — run dump-sections.sh first`)
}

/* ---------------- run ------------------------------------------------ */

let ran = 0
let skipped = 0
let rawMismatches = 0
const divergences: Array<{ id: string; old: string[]; gen: string[] }> = []

for (const c of cases) {
  const def = (BLOCK_REGISTRY as Record<string, any>)[c.type]
  if (!def) {
    skipped++
    continue
  }
  const oldRaw = def.validate(c.data)
  const genRaw = generatedValidate(c.type, c.data)
  if (!genRaw) {
    skipped++
    continue
  }
  ran++
  if (!sortedEq(oldRaw.errors ?? [], genRaw.errors ?? [])) rawMismatches++
  const o = downgrade(oldRaw.errors ?? [])
  const g = downgrade(genRaw.errors ?? [])
  if (!sortedEq(o, g)) {
    divergences.push({ id: c.id, old: o, gen: g })
  }
}

/* wiring check: the in-registry shadow path itself */
const statsBefore = getContractShadowStats()
validateBlockData("hero_slider", (BLOCK_REGISTRY as any)["hero_slider"].defaultData())
validateBlockData("rich_text", { html: 42 })
const statsAfter = getContractShadowStats()

/* informational: generated (contract) defaults vs runtime defaultData */
const defaultsDeltas: string[] = []
for (const [type, def] of Object.entries(BLOCK_REGISTRY)) {
  if (!def) continue
  const cd = (CONTRACT_DEFAULTS as Record<string, unknown>)[type]
  if (cd && !deepEq(def.defaultData(), cd)) defaultsDeltas.push(type)
}

/* ---------------- report --------------------------------------------- */

console.log("=== cms-contract shadow probe ===")
const bySource: Record<string, number> = {}
for (const c of cases) {
  const src = c.id.split(":")[0]
  bySource[src] = (bySource[src] ?? 0) + 1
}
console.log(
  `by source       : ${Object.entries(bySource)
    .map(([k, n]) => `${k}=${n}`)
    .join(" ")}`
)
const advCount = cases.filter((c) => c.id.includes("1v-adversarial")).length
console.log(`1v adversarial  : ${advCount}`)
console.log(`cases collected : ${cases.length}`)
console.log(`compared        : ${ran}`)
console.log(`skipped         : ${skipped} (unregistered type / no spec)`)
console.log(`raw mismatches  : ${rawMismatches} (pre-policy, informational)`)
console.log(`POST-POLICY divergences: ${divergences.length}`)
for (const d of divergences.slice(0, 50)) {
  console.log(`  DIVERGENT ${d.id}`)
  console.log(`    old: ${JSON.stringify(d.old)}`)
  console.log(`    gen: ${JSON.stringify(d.gen)}`)
}
console.log(
  `registry shadow wiring: runs ${statsBefore.runs}→${statsAfter.runs}, divergences ${statsBefore.divergences}→${statsAfter.divergences}`
)
console.log(
  `defaultData vs CONTRACT_DEFAULTS deltas (informational, cutover decision): ${defaultsDeltas.join(", ") || "none"}`
)
process.exit(divergences.length || statsAfter.divergences > statsBefore.divergences ? 1 : 0)
