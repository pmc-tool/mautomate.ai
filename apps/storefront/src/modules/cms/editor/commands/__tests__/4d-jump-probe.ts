/* Phase 4D probe — History JUMP correctness (headless, node).
 *
 * Claim under test: executor.jumpTo(depth) produces EXACTLY the document,
 * chrome, selection, and stacks that N sequential undo()/redo() calls
 * produce (it IS the same code path), and the host batch hooks reduce the
 * canvas syncs to ONE content flush + one per touched chrome region.
 *
 * Method: twin executors over identical hosts. Executor A jumps; executor B
 * steps sequentially. Byte-compare (JSON) after every jump target, both
 * directions, including chrome entries and coalesced/txn entries.
 *
 * Run from apps/storefront (bundled like the 2A invert suite):
 *   node_modules/.bin/esbuild <this file> --bundle --platform=node \
 *     --format=cjs --alias:@modules=./src/modules --outfile=/tmp/4d-jump.cjs
 *   node /tmp/4d-jump.cjs
 */

import type { Command, Section } from "../registry"
import type { HistoryEntry } from "../history"
import { createExecutor, type ExecutorHost } from "../executor"

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
    console.log(`      A: ${String(sa).slice(0, 200)}`)
    console.log(`      B: ${String(sb).slice(0, 200)}`)
  }
}

/* ---------------- host harness ---------------- */

type Log = { contentSyncs: number; chromeSyncs: string[] }

function makeHost(withBatch: boolean) {
  const state = {
    // The shell loads a document before any command runs; start with the
    // loaded-empty-page state (content commands are guarded no-ops on null).
    content: [] as Section[] | null,
    chrome: {} as Record<string, Record<string, unknown>>,
    sel: null as unknown,
  }
  const log: Log = { contentSyncs: 0, chromeSyncs: [] }
  let batch: { on: boolean; content: boolean; chrome: Set<string> } = {
    on: false,
    content: false,
    chrome: new Set(),
  }
  const host: ExecutorHost = {
    getContent: () => state.content,
    getChrome: () => state.chrome,
    applyContent: (next) => {
      state.content = next
      if (batch.on) {
        batch.content = true
        return
      }
      log.contentSyncs++
    },
    applyChrome: (region, data) => {
      state.chrome = { ...state.chrome, [region]: data }
      if (batch.on) {
        batch.chrome.add(region)
        return
      }
      log.chromeSyncs.push(region)
    },
    getSel: () => state.sel,
    setSel: (s) => {
      state.sel = s
    },
    onHistoryChange: () => {},
    ...(withBatch
      ? {
          beginBatch: () => {
            batch = { on: true, content: false, chrome: new Set() }
          },
          endBatch: () => {
            const b = batch
            batch = { on: false, content: false, chrome: new Set() }
            if (b.content) log.contentSyncs++
            b.chrome.forEach((r) => log.chromeSyncs.push(r))
          },
        }
      : {}),
  }
  return { state, log, host }
}

const snap = (s: { content: unknown; chrome: unknown; sel: unknown }) => ({
  content: s.content,
  chrome: s.chrome,
  sel: s.sel,
})

/** Stack comparison must ignore `at` — the twin sessions dispatch the same
 *  commands a few wall-clock ms apart, and `at` is presentation-only
 *  (relative timestamps in the panel), never jump semantics. */
const stripAt = (es: readonly HistoryEntry[]) =>
  es.map(({ at: _at, ...rest }) => rest)

/* ---------------- fixture script ---------------- */

const sec = (label: string): Section => ({
  block_type: "container",
  layout: "1",
  columns: [
    {
      id: `col-${label}`,
      widgets: [{ id: `w-${label}`, widget_type: "rich_text", html: `<p>${label}</p>` }],
    },
  ],
})

/** The editing session: inserts, a props edit, chrome edits, a txn pair,
 *  and two same-key coalesced edits (which must land as ONE entry/row). */
function script(): { cmd: Command; sel?: unknown }[] {
  return [
    { cmd: { name: "section.insertRaw", args: { at: 0, section: sec("A") } }, sel: { kind: "section", index: 0 } },
    { cmd: { name: "section.insertRaw", args: { at: 1, section: sec("B") } }, sel: { kind: "section", index: 1 } },
    { cmd: { name: "chrome.setProps", args: { region: "header", data: { logo: "one.png" } } } },
    { cmd: { name: "section.move", args: { from: 0, to: 1 } }, sel: { kind: "section", index: 1 } },
    { cmd: { name: "section.setProps", args: { index: 0, section: { ...sec("A"), anchor: "x1" } }, txn: "t1" } },
    { cmd: { name: "section.setProps", args: { index: 0, section: { ...sec("A"), anchor: "x2" } }, txn: "t1" } },
    { cmd: { name: "section.duplicate", args: { index: 1 } }, sel: { kind: "section", index: 2 } },
    { cmd: { name: "chrome.setProps", args: { region: "footer", data: { note: "hi" } } } },
    { cmd: { name: "section.remove", args: { index: 0 } }, sel: null },
  ]
}

function drive(exe: ReturnType<typeof createExecutor>) {
  for (const step of script()) {
    exe.execute(step.cmd, step.sel !== undefined ? { selAfter: step.sel } : {})
  }
}

/* ---------------- 1. jump == sequential, all targets ---------------- */

{
  const A = makeHost(true)
  const B = makeHost(false)
  const exeA = createExecutor(A.host)
  const exeB = createExecutor(B.host)
  drive(exeA)
  drive(exeB)

  eq(snap(A.state), snap(B.state), "twin sessions start byte-identical")
  const total = exeA.entries().length
  ok(total > 0 && total === exeB.entries().length, `entry counts match (${total})`)
  // txn pair coalesced to one row, same-key merge verified structurally:
  // 9 dispatches -> fewer entries.
  ok(total < script().length, `txn dispatches coalesced (${script().length} dispatches -> ${total} rows)`)

  // Walk every jump target down to 0 and back up, comparing against the
  // sequential twin at every stop.
  for (let target = total - 1; target >= 0; target--) {
    exeA.jumpTo(target)
    while (exeB.entries().length > target) exeB.undo()
    eq(snap(A.state), snap(B.state), `jump down to depth ${target} == sequential undos`)
    eq(
      { done: stripAt(exeA.entries()), undone: stripAt(exeA.redoEntries()) },
      { done: stripAt(exeB.entries()), undone: stripAt(exeB.redoEntries()) },
      `stacks identical at depth ${target}`
    )
  }
  for (let target = 1; target <= total; target++) {
    exeA.jumpTo(target)
    while (exeB.entries().length < target) exeB.redo()
    eq(snap(A.state), snap(B.state), `jump up to depth ${target} == sequential redos`)
  }

  // Direct multi-step jumps (not walked one at a time).
  exeA.jumpTo(0)
  while (exeB.entries().length > 0) exeB.undo()
  eq(snap(A.state), snap(B.state), "single jump to 0 == full sequential rewind")
  exeA.jumpTo(total)
  while (exeB.redoEntries().length > 0) exeB.redo()
  eq(snap(A.state), snap(B.state), "single jump to top == full sequential replay")
}

/* ---------------- 2. one canvas flush per jump ---------------- */

{
  const A = makeHost(true)
  const exe = createExecutor(A.host)
  drive(exe)
  const total = exe.entries().length
  A.log.contentSyncs = 0
  A.log.chromeSyncs = []
  exe.jumpTo(0) // rewinds EVERYTHING incl. two chrome entries
  eq(A.log.contentSyncs, 1, "jump to 0 flushes content ONCE")
  eq([...A.log.chromeSyncs].sort(), ["footer", "header"], "jump flushes each touched chrome region once")

  A.log.contentSyncs = 0
  A.log.chromeSyncs = []
  exe.jumpTo(total)
  eq(A.log.contentSyncs, 1, "jump to top flushes content ONCE")
  eq([...A.log.chromeSyncs].sort(), ["footer", "header"], "redo jump flushes chrome once per region")

  // No-op jumps emit nothing.
  A.log.contentSyncs = 0
  A.log.chromeSyncs = []
  ok(exe.jumpTo(total) === false, "jump to current depth is a no-op")
  eq(A.log.contentSyncs, 0, "no-op jump emits no content sync")

  // Out-of-range clamps.
  ok(exe.jumpTo(999) === false, "over-range jump clamps to current top (no-op)")
  exe.jumpTo(-5)
  eq(exe.entries().length, 0, "under-range jump clamps to 0")
}

/* ---------------- 3. host without batch hooks still correct ---------------- */

{
  const A = makeHost(false) // headless host: no batch hooks
  const B = makeHost(false)
  const exeA = createExecutor(A.host)
  const exeB = createExecutor(B.host)
  drive(exeA)
  drive(exeB)
  exeA.jumpTo(1)
  while (exeB.entries().length > 1) exeB.undo()
  eq(snap(A.state), snap(B.state), "hook-less host: jump == sequential (document identical)")
}

console.log("")
console.log(`${passed} passed, ${failed} failed`)
if (failed) {
  console.log("FAILED: " + fails.join(" | "))
  process.exit(1)
}
