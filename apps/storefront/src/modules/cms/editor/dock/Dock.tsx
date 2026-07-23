"use client"

/* ------------------------------------------------------------------ */
/* Dock — the panel's top-level information architecture (Phase 2, 2C). */
/*                                                                     */
/* ARCH-UX §1.1: one left dock, Elementor's proven shape — a tab strip  */
/* over a swappable main region. Five pages:                            */
/*                                                                     */
/*   Elements  — the palette (basic widgets + store sections)           */
/*   Navigator — the page tree + site elements (shell-owned closures,   */
/*               passed in as a node so drag-reorder wiring stays put)  */
/*   Editor    — the selected node's settings (the shell's existing     */
/*               selection chain, passed in as a node)                  */
/*   Page      — page-level settings (PagePane)                         */
/*   History   — version history (HistoryPane)                          */
/*                                                                     */
/* This is RE-HOUSING: every control keeps its exact behavior; only the */
/* housing (which pane it lives in, how you reach it) changes. The dock */
/* is controlled — the shell owns the active tab via useDockTab so      */
/* entry points (footer History button, canvas selection, openAddAt)    */
/* can drive it.                                                        */
/*                                                                     */
/* Site Settings is NOT a dock tab: per ARCH-UX §2 it is a panel        */
/* TAKEOVER with a mode banner, built in U2 proper. The "Site elements" */
/* list keeps living inside Navigator until that takeover lands.        */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  font,
  grey,
  hairline,
  motion,
  type,
} from "@modules/cms/editor/design"

export type DockTabId = "elements" | "navigator" | "editor" | "page" | "history"

const TABS: { id: DockTabId; label: string; icon: string; title: string }[] = [
  { id: "elements", label: "Elements", icon: "plus", title: "Add sections and widgets" },
  { id: "navigator", label: "Navigator", icon: "panel", title: "The whole page, outlined" },
  { id: "editor", label: "Editor", icon: "brush", title: "Settings for the selected item" },
  { id: "page", label: "Page", icon: "settings", title: "Page settings" },
  { id: "history", label: "History", icon: "clock", title: "Version history" },
]

/**
 * The dock's tab state + the selection-follow rule that preserves today's
 * behavior: clicking something on the canvas swaps the panel to its settings
 * form, and deselecting returns to the palette.
 *
 * `selectionKey` is a stable string naming WHAT is selected (null = nothing).
 * When it changes to a new non-null value the dock jumps to Editor; when it
 * clears, an open Editor tab falls back to Elements. Manual tab choices are
 * otherwise respected (a merchant browsing Elements with a live selection is
 * not yanked away — only a NEW selection moves the dock).
 */
export function useDockTab(
  selectionKey: string | null
): [DockTabId, (t: DockTabId) => void] {
  const [tab, setTab] = useState<DockTabId>("elements")
  const prev = useRef<string | null>(null)
  useEffect(() => {
    const was = prev.current
    prev.current = selectionKey
    if (selectionKey != null && selectionKey !== was) {
      setTab("editor")
    } else if (selectionKey == null && was != null) {
      setTab((t) => (t === "editor" ? "elements" : t))
    }
  }, [selectionKey])
  return [tab, setTab]
}

function DockTabButton({
  id,
  label,
  icon,
  title,
  active,
  showDot,
  onClick,
}: {
  id: DockTabId
  label: string
  icon: string
  title: string
  active: boolean
  showDot: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`dock-pane-${id}`}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "8px 2px 6px",
        background: "transparent",
        border: 0,
        borderBottom: `2px solid ${active ? accent.base : "transparent"}`,
        marginBottom: -1,
        color: active ? accent.base : hover ? grey[70] : grey[50],
        cursor: "pointer",
        position: "relative",
        transition: `color ${motion.fast}, border-color ${motion.fast}`,
      }}
    >
      <span style={{ display: "inline-flex", position: "relative" }}>
        <UiIcon name={icon} size={16} />
        {showDot && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: accent.base,
            }}
          />
        )}
      </span>
      <span
        style={{
          ...type.micro,
          fontFamily: font,
          letterSpacing: "0.04em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {label}
      </span>
    </button>
  )
}

/** Editor tab with nothing selected — a pointer, not a dead end. */
function EditorEmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{ padding: "24px 8px", textAlign: "center" }}>
      <div style={{ color: grey[40], marginBottom: 10 }}>
        <UiIcon name="brush" size={22} />
      </div>
      <p
        style={{
          ...type.bodyStrong,
          fontFamily: font,
          color: grey[70],
          margin: "0 0 4px",
        }}
      >
        Nothing selected
      </p>
      <p
        style={{
          ...type.label,
          fontFamily: font,
          color: grey[50],
          margin: "0 0 14px",
        }}
      >
        Click any section, column or widget on the page to edit it here.
      </p>
      <button
        onClick={onBrowse}
        style={{
          ...type.label,
          fontFamily: font,
          border: 0,
          background: "none",
          color: accent.base,
          cursor: "pointer",
          padding: 0,
        }}
      >
        Browse elements instead
      </button>
    </div>
  )
}

export default function Dock({
  active,
  onSelect,
  hasSelection,
  elements,
  navigator,
  editor,
  page,
  history,
}: {
  /** Controlled active tab (pair with useDockTab in the shell). */
  active: DockTabId
  onSelect: (t: DockTabId) => void
  /** Something is selected on the canvas (drives the Editor tab dot). */
  hasSelection: boolean
  /** Pane contents. `editor` may be null when nothing is selected. */
  elements: React.ReactNode
  navigator: React.ReactNode
  editor: React.ReactNode
  page: React.ReactNode
  history: React.ReactNode
}) {
  const panes: Record<DockTabId, React.ReactNode> = {
    elements,
    navigator,
    editor:
      hasSelection && editor != null ? (
        editor
      ) : (
        <EditorEmptyState onBrowse={() => onSelect("elements")} />
      ),
    page,
    history,
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: font,
      }}
    >
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Editor panel"
        style={{
          display: "flex",
          borderBottom: hairline,
          flexShrink: 0,
          background: grey[0],
        }}
      >
        {TABS.map((t) => (
          <DockTabButton
            key={t.id}
            id={t.id}
            label={t.label}
            icon={t.icon}
            title={t.title}
            active={active === t.id}
            showDot={t.id === "editor" && hasSelection && active !== "editor"}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </div>

      {/* Active pane — the one scroll region, same 12px inset the panel
          body always had. */}
      <div
        id={`dock-pane-${active}`}
        role="tabpanel"
        style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}
      >
        {panes[active]}
      </div>
    </div>
  )
}
