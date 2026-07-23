/* ------------------------------------------------------------------ */
/* History M3 (Phase 2A — ARCH-CANVAS §3.3 + P4).                       */
/*                                                                      */
/* Labeled per-command entries replace whole-content snapshots. Each    */
/* entry stores the INVERSE command (undo) and the ORIGINAL command     */
/* (redo) plus the selection on both sides, so undo restores what was   */
/* selected instead of clearing it. Chrome commands push entries onto   */
/* the SAME stack — undo after a header edit undoes the header edit.    */
/*                                                                      */
/* Coalescing is by command + target (the registry's coalesceKey), not  */
/* wall clock alone: typing a headline is one entry; a delete right     */
/* after typing is a second entry even inside the window, because the   */
/* key differs. An explicit `txn` id groups dispatches into one entry   */
/* regardless of timing (Elementor's debounced settings transaction).   */
/*                                                                      */
/* SNAPSHOT FALLBACK (ARCH-CANVAS P4 mitigation): the pre-M3 behavior   */
/* — whole-content snapshots, 700 ms wall-clock coalescing, chrome      */
/* outside history, selection cleared on undo — stays COMPILED IN and   */
/* is selected at runtime by the flag below. Turning it on restores     */
/* the old behavior exactly; it is the kill switch if per-command undo  */
/* misbehaves on a working page.                                        */
/* ------------------------------------------------------------------ */

import type { Command } from "./registry"

/** Runtime kill switch. Enable the legacy snapshot history with either:
 *    localStorage.setItem("ff_history_snapshot", "1")   (persistent)
 *    window.__FF_HISTORY_SNAPSHOT__ = true              (this tab)
 *  Checked live on every dispatch/undo/redo, so it can be flipped
 *  mid-session from the console (entries recorded by the other mode
 *  simply stop being consulted). */
export const SNAPSHOT_FALLBACK_LS_KEY = "ff_history_snapshot"

export function snapshotFallbackOn(): boolean {
  if (typeof window === "undefined") return false
  try {
    if ((window as unknown as Record<string, unknown>).__FF_HISTORY_SNAPSHOT__ === true) {
      return true
    }
    return window.localStorage.getItem(SNAPSHOT_FALLBACK_LS_KEY) === "1"
  } catch {
    return false
  }
}

/** Max history depth — same cap as the snapshot stack it replaces. */
export const HISTORY_CAP = 50

/** Same-key dispatches within this window merge into the open entry. */
export const COALESCE_MS = 800

/** Legacy snapshot path's wall-clock coalescing window (pre-M3 value). */
export const LEGACY_COALESCE_MS = 700

export type HistoryEntry = {
  /** Human label for the entry ("Delete Hero Slider", "AI: rewrote…"). */
  label: string
  /** Inverse command — running it undoes the entry. */
  undoCmd: Command
  /** The original command — running it redoes the entry. */
  redoCmd: Command
  /** Selection to restore on undo (whatever was selected at dispatch). */
  selBefore: unknown
  /** Selection to restore on redo (post-command selection). */
  selAfter: unknown
  /** Coalescing key (`name:target` or `txn:<id>`); null = never merges. */
  key: string | null
  /** Timestamp of the LAST dispatch merged into this entry. */
  at: number
  /** True when the key came from an explicit txn (timing ignored). */
  isTxn: boolean
}

/**
 * Push an entry onto the undo stack with coalescing + cap. Returns the new
 * stack (callers keep stacks immutable so React state can gate buttons).
 *
 * Merge rule: the incoming entry merges into the TOP entry iff both carry
 * the same non-null key AND (explicit txn, or the top entry's last dispatch
 * was within COALESCE_MS). The merged entry keeps the FIRST undoCmd /
 * selBefore / label (the state before the run of edits) and takes the
 * LATEST redoCmd / selAfter / timestamp.
 */
export function pushEntry(
  stack: HistoryEntry[],
  entry: HistoryEntry,
  now: number = Date.now()
): HistoryEntry[] {
  const top = stack[stack.length - 1]
  if (
    top &&
    top.key !== null &&
    top.key === entry.key &&
    (entry.isTxn || now - top.at <= COALESCE_MS)
  ) {
    const merged: HistoryEntry = {
      ...top,
      redoCmd: entry.redoCmd,
      selAfter: entry.selAfter,
      at: now,
    }
    return [...stack.slice(0, -1), merged]
  }
  return [...stack.slice(-(HISTORY_CAP - 1)), entry]
}
