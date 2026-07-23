"use client"

/* ------------------------------------------------------------------ */
/* HistoryPane — the dock's "History" tab (Phase 4, 4D — ARCH-UX §5.4). */
/*                                                                     */
/* Two sub-tabs, Elementor's proven History shape:                     */
/*                                                                     */
/*   Actions  — the in-session labeled undo stack (the executor's      */
/*              entry-mode history), newest first, with the current    */
/*              position marked. Clicking a row JUMPS to that state —  */
/*              executor.jumpTo() runs the same sequential undo/redo   */
/*              path the toolbar buttons use, batched into one canvas  */
/*              flush. Undone (redoable) rows stay listed, dimmed, so  */
/*              redo is navigation instead of a blind shortcut.        */
/*   Versions — the published snapshot list (RevisionsPanel), same     */
/*              endpoint + Restore→review→Publish flow as always.      */
/*                                                                     */
/* Coalesced runs of edits and txn-grouped dispatches arrive here as   */
/* ONE HistoryEntry each (merged at push time in history.ts), so they  */
/* naturally render as single rows.                                    */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"
import {
  snapshotFallbackOn,
  type HistoryEntry,
} from "@modules/cms/editor/commands/history"
import { RevisionsPanel, relTime } from "@modules/cms/editor/RevisionsPanel"
import {
  accent,
  font,
  grey,
  hairline,
  motion,
  radius,
  type,
} from "@modules/cms/editor/design"

/** The Actions feed, handed down by the shell from the executor. */
export type HistoryActionsFeed = {
  /** Applied entries, oldest first (executor.entries()). */
  done: readonly HistoryEntry[]
  /** Undone entries as the executor stores them — LAST = next redo
   *  (executor.redoEntries()). */
  undone: readonly HistoryEntry[]
  /** Jump to an absolute depth: 0 = before the first action,
   *  done.length + undone.length = the newest state. */
  onJump: (depth: number) => void
}

type SubTab = "actions" | "versions"

function SubTabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: SubTab
  label: string
  active: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`history-subtab-${id}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        ...type.label,
        fontFamily: font,
        fontWeight: 600,
        padding: "6px 0",
        background: active ? "#fff" : "transparent",
        color: active ? grey[90] : hover ? grey[70] : grey[50],
        border: 0,
        borderRadius: radius.sm,
        boxShadow: active ? `inset 0 0 0 1px ${grey[20]}` : "none",
        cursor: "pointer",
        transition: `color ${motion.fast}, background ${motion.fast}`,
      }}
    >
      {label}
    </button>
  )
}

/* ------------------------------ Actions ----------------------------- */

function ActionRow({
  label,
  at,
  state,
  isCurrent,
  onClick,
}: {
  label: string
  at: number | null
  state: "applied" | "undone" | "origin"
  isCurrent: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  const dim = state === "undone"
  return (
    <button
      onClick={onClick}
      title={
        isCurrent
          ? "You are here"
          : dim
            ? "Redo up to this action"
            : "Undo back to this action"
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "7px 8px",
        border: 0,
        borderBottom: hairline,
        background: isCurrent ? accent.soft : hover ? grey[10] : "transparent",
        cursor: isCurrent ? "default" : "pointer",
        transition: `background ${motion.fast}`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: radius.pill,
          flexShrink: 0,
          background: isCurrent ? accent.base : dim ? grey[30] : grey[50],
        }}
      />
      <span
        style={{
          ...type.body,
          fontFamily: font,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: dim ? grey[40] : grey[90],
          fontStyle: state === "origin" ? "italic" : "normal",
        }}
      >
        {label}
      </span>
      {isCurrent ? (
        <span
          style={{
            ...type.micro,
            fontFamily: font,
            color: accent.base,
            border: `1px solid ${accent.tintStrong}`,
            borderRadius: radius.pill,
            padding: "0 6px",
            flexShrink: 0,
          }}
        >
          Current
        </span>
      ) : at != null ? (
        <span
          style={{
            ...type.micro,
            fontFamily: font,
            color: grey[40],
            flexShrink: 0,
          }}
        >
          {relTime(at)}
        </span>
      ) : null}
    </button>
  )
}

function ActionsList({ feed }: { feed: HistoryActionsFeed }) {
  const note: React.CSSProperties = {
    ...type.body,
    fontFamily: font,
    color: grey[50],
    padding: "8px 0",
  }

  if (snapshotFallbackOn()) {
    return (
      <div style={note}>
        The actions list is unavailable while the legacy snapshot history is
        enabled. Undo and redo keep working from the toolbar.
      </div>
    )
  }

  const { done, undone, onJump } = feed
  if (done.length === 0 && undone.length === 0) {
    return (
      <div style={note}>
        No history yet. Every change you make appears here — click any entry
        to go back to that moment.
      </div>
    )
  }

  // Chronological timeline: applied entries (oldest first), then the undone
  // entries — the executor stores the redo stack with the NEXT redo last, so
  // reversing it continues the timeline forward. Depth d = the state after
  // the first d actions; current = done.length.
  const timeline: {
    entry: HistoryEntry
    depth: number
    state: "applied" | "undone"
  }[] = [
    ...done.map((entry, i) => ({
      entry,
      depth: i + 1,
      state: "applied" as const,
    })),
    ...[...undone].reverse().map((entry, i) => ({
      entry,
      depth: done.length + i + 1,
      state: "undone" as const,
    })),
  ]
  const current = done.length

  return (
    <div role="list" aria-label="Editing actions">
      {/* Newest first (reverse-chronological), "Editing started" at the
          bottom — Elementor's exact reading order. */}
      {[...timeline].reverse().map(({ entry, depth, state }) => (
        <ActionRow
          key={depth}
          label={entry.label}
          at={entry.at}
          state={state}
          isCurrent={depth === current}
          onClick={() => depth !== current && onJump(depth)}
        />
      ))}
      <ActionRow
        label="Editing started"
        at={null}
        state="origin"
        isCurrent={current === 0}
        onClick={() => current !== 0 && onJump(0)}
      />
    </div>
  )
}

/* ------------------------------- pane ------------------------------- */

export default function HistoryPane({
  slug,
  locale,
  editorKey,
  actions,
  onRestored,
}: {
  slug: string
  locale: string
  editorKey: string
  /** The executor's labeled history (Actions tab). */
  actions: HistoryActionsFeed
  /** Same contract as RevisionsPanel: the draft was replaced; reload it. */
  onRestored: (version: number) => void
}) {
  const [tab, setTab] = useState<SubTab>("actions")

  return (
    <div style={{ fontFamily: font }}>
      <div
        role="tablist"
        aria-label="History"
        style={{
          display: "flex",
          gap: 2,
          padding: 2,
          background: grey[10],
          borderRadius: radius.md,
          marginBottom: 10,
        }}
      >
        <SubTabButton
          id="actions"
          label="Actions"
          active={tab === "actions"}
          onClick={() => setTab("actions")}
        />
        <SubTabButton
          id="versions"
          label="Versions"
          active={tab === "versions"}
          onClick={() => setTab("versions")}
        />
      </div>

      {tab === "actions" ? (
        <div id="history-subtab-actions" role="tabpanel">
          <ActionsList feed={actions} />
        </div>
      ) : (
        <div id="history-subtab-versions" role="tabpanel">
          <RevisionsPanel
            slug={slug}
            locale={locale}
            editorKey={editorKey}
            onRestored={onRestored}
          />
        </div>
      )}
    </div>
  )
}
