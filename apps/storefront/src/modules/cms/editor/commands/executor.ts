/* ------------------------------------------------------------------ */
/* Command executor (Phase 2A — ARCH-CANVAS §3.3).                      */
/*                                                                      */
/* ONE entry point for every document mutation: execute(command). The   */
/* shell owns the document (contentRef / chromeRef stay its truth —     */
/* the host callbacks read and write them); the executor owns           */
/* sequencing: invert-before-run capture, history (labeled entries OR   */
/* the compiled-in snapshot fallback), selection restore, and the       */
/* patch-vs-full canvas sync decision (exactly commit()'s rule).        */
/*                                                                      */
/* Framework-free on purpose: the shell hands it plain callbacks, and   */
/* the invert round-trip suite drives it headless under node.           */
/* ------------------------------------------------------------------ */

import {
  COMMANDS,
  type ChromeMap,
  type Command,
  type EditorState,
  type Section,
} from "./registry"
import {
  HISTORY_CAP,
  LEGACY_COALESCE_MS,
  pushEntry,
  snapshotFallbackOn,
  type HistoryEntry,
} from "./history"

export type ExecutorHost = {
  getContent(): Section[] | null
  getChrome(): ChromeMap
  /** Apply new content: update contentRef/state, mark dirty, and sync the
   *  canvas — a targeted patch of `touched` when non-null (same-length
   *  guard is the executor's), else a full cms:data push. */
  applyContent(next: Section[], touched: number | null): void
  /** Apply one chrome region: update chromeRef/state, mark that region
   *  dirty, and stream cms:chrome to the canvas. */
  applyChrome(region: string, data: Record<string, unknown>): void
  /** Current selection (the shell's Sel union — opaque here). */
  getSel(): unknown
  /** Restore a selection (routes through the shell's select()). */
  setSel(sel: unknown): void
  /** History stacks changed — re-render undo/redo button gating. */
  onHistoryChange(): void
  /** OPTIONAL batch hooks (Phase 4D — the History panel's jump). Between
   *  beginBatch() and endBatch() the host should keep updating its refs /
   *  state / dirty flags per applyContent call but SUPPRESS the per-step
   *  canvas postMessage; endBatch() flushes ONE full canvas sync (content
   *  push + each touched chrome region). Hosts without the hooks (the
   *  headless test harness) just take N sequential syncs — the DOCUMENT
   *  result is identical either way. */
  beginBatch?(): void
  endBatch?(): void
}

export type ExecuteOptions = {
  /** Selection after the command (wrappers that select the inserted /
   *  moved node pass it so redo can restore it). Defaults to selBefore. */
  selAfter?: unknown
  /** Apply WITHOUT history — the pending AI preview (ARCH-AI §4.1).
   *  Promote with promoteStaged(); discard with discardStaged(). */
  staged?: boolean
}

export type Executor = ReturnType<typeof createExecutor>

export function createExecutor(host: ExecutorHost) {
  /* Entry-mode stacks (M3). */
  let entryUndo: HistoryEntry[] = []
  let entryRedo: HistoryEntry[] = []

  /* Legacy snapshot stacks (P4 fallback — pre-M3 behavior, verbatim:
   * Section[][] capped at 50, 700 ms wall-clock coalescing, chrome
   * excluded, selection cleared on undo). */
  let snapUndo: Section[][] = []
  let snapRedo: Section[][] = []
  let lastSnapAt = 0

  /* Pending staged preview (one at a time, ARCH-AI §4.1). */
  let staged: {
    beforeContent: Section[]
    beforeChrome: ChromeMap
    chromeTouched: Set<string>
    selBefore: unknown
  } | null = null

  const state = (): EditorState => ({
    content: host.getContent() ?? [],
    chrome: host.getChrome(),
  })

  /** Run + apply, no history. Returns what changed (null = no-op). */
  const runAndApply = (
    cmd: Command
  ): { contentChanged: boolean; chromeRegions: string[] } | null => {
    const impl = COMMANDS[cmd.name]
    if (!impl) return null
    const pre = state()
    if (impl.scope === "content" && !host.getContent()) return null
    const res = impl.run(pre, cmd.args)
    if (!res) return null
    let contentChanged = false
    const chromeRegions: string[] = []
    if (res.content && res.content !== pre.content) {
      const touched = impl.touches ? impl.touches(cmd.args) : null
      // commit()'s patch-vs-full rule: targeted patch only when the shape
      // allows (same length, section exists at the touched index).
      const canPatch =
        touched != null &&
        res.content.length === pre.content.length &&
        !!res.content[touched]
      host.applyContent(res.content, canPatch ? touched : null)
      contentChanged = true
    }
    if (res.chrome) {
      for (const { region, data } of res.chrome) {
        host.applyChrome(region, data)
        chromeRegions.push(region)
      }
    }
    return contentChanged || chromeRegions.length
      ? { contentChanged, chromeRegions }
      : null
  }

  /** THE entry point. Returns whether the command actually applied. */
  const execute = (cmd: Command, opts: ExecuteOptions = {}): boolean => {
    const impl = COMMANDS[cmd.name]
    if (!impl) return false

    if (opts.staged) return stagePreview(cmd)

    const pre = state()
    if (impl.scope === "content" && !host.getContent()) return false
    const selBefore = host.getSel()
    // Inverse captured against the PRE state, before anything mutates.
    const inverse = impl.invert(pre, cmd.args)

    const applied = runAndApply(cmd)
    if (!applied) return false

    if (snapshotFallbackOn()) {
      // Legacy behavior exactly: content commands snapshot (wall-clock
      // coalesced); chrome commands stay OUTSIDE history.
      if (applied.contentChanged) {
        const now = Date.now()
        if (now - lastSnapAt >= LEGACY_COALESCE_MS) {
          lastSnapAt = now
          snapUndo = [...snapUndo.slice(-(HISTORY_CAP - 1)), pre.content]
          snapRedo = []
        }
      }
    } else {
      const now = Date.now()
      const key = cmd.txn
        ? `txn:${cmd.txn}`
        : impl.coalesceKey
          ? impl.coalesceKey(cmd.args)
          : null
      const entry: HistoryEntry = {
        label: cmd.label ?? impl.label(cmd.args, pre),
        undoCmd: inverse,
        redoCmd: cmd,
        selBefore,
        selAfter: opts.selAfter !== undefined ? opts.selAfter : selBefore,
        key,
        at: now,
        isTxn: !!cmd.txn,
      }
      entryUndo = pushEntry(entryUndo, entry, now)
      entryRedo = []
    }
    host.onHistoryChange()
    return true
  }

  const undo = () => {
    if (snapshotFallbackOn()) {
      // Legacy path verbatim: pop snapshot, push current, full sync,
      // clear selection, reset the coalescing clock.
      const cur = host.getContent()
      if (!snapUndo.length || !cur) return
      const prev = snapUndo[snapUndo.length - 1]
      snapUndo = snapUndo.slice(0, -1)
      snapRedo = [...snapRedo, cur]
      host.applyContent(prev, null)
      host.setSel(null)
      lastSnapAt = 0
      host.onHistoryChange()
      return
    }
    const entry = entryUndo[entryUndo.length - 1]
    if (!entry) return
    entryUndo = entryUndo.slice(0, -1)
    runAndApply(entry.undoCmd)
    entryRedo = [...entryRedo, entry]
    host.setSel(entry.selBefore)
    host.onHistoryChange()
  }

  const redo = () => {
    if (snapshotFallbackOn()) {
      const cur = host.getContent()
      if (!snapRedo.length || !cur) return
      const next = snapRedo[snapRedo.length - 1]
      snapRedo = snapRedo.slice(0, -1)
      snapUndo = [...snapUndo, cur]
      host.applyContent(next, null)
      host.setSel(null)
      lastSnapAt = 0
      host.onHistoryChange()
      return
    }
    const entry = entryRedo[entryRedo.length - 1]
    if (!entry) return
    entryRedo = entryRedo.slice(0, -1)
    runAndApply(entry.redoCmd)
    entryUndo = [...entryUndo.slice(-(HISTORY_CAP - 1)), entry]
    host.setSel(entry.selAfter)
    host.onHistoryChange()
  }

  /* ---------------- history jump (Phase 4D — ARCH-UX §5.4) ----------- */

  /** Jump to an absolute history depth: `depth` = how many entries are
   *  applied afterwards (0 = the state before the first recorded action,
   *  entries().length + redoEntries().length = the newest state). This IS
   *  N sequential undos/redos — the same code paths, so there is no second
   *  state machine to diverge — wrapped in the host's batch hooks so the
   *  canvas gets ONE flush instead of N patches. Entry-mode only: in the
   *  snapshot fallback there are no labeled entries to jump between. */
  const jumpTo = (depth: number): boolean => {
    if (snapshotFallbackOn()) return false
    const target = Math.max(
      0,
      Math.min(depth, entryUndo.length + entryRedo.length)
    )
    if (target === entryUndo.length) return false
    host.beginBatch?.()
    try {
      while (entryUndo.length > target && entryUndo.length > 0) undo()
      while (entryUndo.length < target && entryRedo.length > 0) redo()
    } finally {
      host.endBatch?.()
    }
    return true
  }

  /* ---------------- staged preview (ai.apply, ARCH-AI §4.1) ---------- */

  /** Apply without history, remembering the pre-stage document once —
   *  repeated staged applies build on each other but promote/discard
   *  always resolves against the ORIGINAL before. */
  const stagePreview = (cmd: Command): boolean => {
    const pre = state()
    const first = !staged
    if (first) {
      staged = {
        beforeContent: pre.content,
        beforeChrome: pre.chrome,
        chromeTouched: new Set(),
        selBefore: host.getSel(),
      }
    }
    const applied = runAndApply(cmd)
    if (applied) {
      for (const r of applied.chromeRegions) staged!.chromeTouched.add(r)
      return true
    }
    if (first) staged = null
    return false
  }

  /** Promote the pending preview into ONE labeled history entry. */
  const promoteStaged = (label: string): boolean => {
    if (!staged) return false
    const cur = state()
    const chromeBefore: ChromeMap = {}
    const chromeAfter: ChromeMap = {}
    staged.chromeTouched.forEach((r) => {
      chromeBefore[r] = staged!.beforeChrome[r] ?? {}
      chromeAfter[r] = cur.chrome[r] ?? {}
    })
    const hasChrome = staged.chromeTouched.size > 0
    const entry: HistoryEntry = {
      label,
      undoCmd: {
        name: "doc.replace",
        args: {
          content: staged.beforeContent,
          ...(hasChrome ? { chrome: chromeBefore } : {}),
        },
      },
      redoCmd: {
        name: "doc.replace",
        args: {
          content: cur.content,
          ...(hasChrome ? { chrome: chromeAfter } : {}),
        },
      },
      selBefore: staged.selBefore,
      selAfter: host.getSel(),
      key: null,
      at: Date.now(),
      isTxn: false,
    }
    entryUndo = pushEntry(entryUndo, entry, entry.at)
    entryRedo = []
    staged = null
    host.onHistoryChange()
    return true
  }

  /** Drop the pending preview, restoring the pre-stage document. */
  const discardStaged = (): boolean => {
    if (!staged) return false
    const chromeBefore: ChromeMap = {}
    staged.chromeTouched.forEach((r) => {
      chromeBefore[r] = staged!.beforeChrome[r] ?? {}
    })
    const restore: Command = {
      name: "doc.replace",
      args: {
        content: staged.beforeContent,
        ...(staged.chromeTouched.size ? { chrome: chromeBefore } : {}),
      },
    }
    const sel = staged.selBefore
    staged = null
    runAndApply(restore)
    host.setSel(sel)
    return true
  }

  return {
    execute,
    undo,
    redo,
    canUndo: () =>
      snapshotFallbackOn() ? snapUndo.length > 0 : entryUndo.length > 0,
    canRedo: () =>
      snapshotFallbackOn() ? snapRedo.length > 0 : entryRedo.length > 0,
    /** Labeled APPLIED entries, oldest first (the History panel's feed). */
    entries: (): readonly HistoryEntry[] => entryUndo,
    /** Labeled UNDONE entries — the redo stack as stored: the LAST element
     *  is the next redo (chronologically the EARLIEST undone action). The
     *  History panel reverses it to draw the timeline. */
    redoEntries: (): readonly HistoryEntry[] => entryRedo,
    jumpTo,
    hasStage: () => staged !== null,
    promoteStaged,
    discardStaged,
  }
}
