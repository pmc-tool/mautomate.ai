"use client"

/* ------------------------------------------------------------------ */
/* ElementsPalette — the panel's RESIDENT default state (WS1).          */
/*                                                                     */
/* Elementor's core interaction: the panel is a box of draggable parts. */
/* Tab "Elements": a "Basic elements" grid of widget cards (drag into a */
/* container column on the canvas) + the full section palette           */
/* (AddSectionPicker, embedded — search, categories, click or drag).    */
/* Tab "Navigator": the classic section list / site elements, passed in */
/* by the editor as `navigator` so its drag-reorder closures stay put.  */
/* The palette never unmounts on insert — selection just swaps the      */
/* panel to the settings form, and deselect/back returns here.          */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"
import {
  isCommerceWidget,
  listBasicWidgetSchemas,
} from "@modules/cms/schema/widgets"
import { PaletteIcon, UiIcon } from "./palette-icons"
import { setCardDragImage } from "./drag-ghost"
import AddSectionPicker from "./AddSectionPicker"
import {
  accent,
  eyebrow,
  font,
  grey,
  hairline,
  motion,
  radius,
  surface,
  type,
} from "@modules/cms/editor/design"

/** DnD mime shared with the canvas + ContainerColumnsEditor. */
const WIDGET_DND_MIME = "application/x-ff-widget"
/** DnD mime AddSectionPicker's cards already set (full-width section insert). */
const BLOCK_DND_MIME = "application/x-ff-block"

/**
 * Make a "Store sections" card draggable as a WIDGET as well as a section.
 *
 * AddSectionPicker owns those cards and already writes its own
 * "application/x-ff-block" payload on dragstart. Rather than fork that
 * component, we listen on the BUBBLE phase of the wrapper — so the card's own
 * handler has already run — and ADD a second representation to the same
 * dataTransfer. A DataTransfer legitimately carries several types at once, and
 * each drop target reads the one it understands: a page seam reads the block
 * type (behaviour completely unchanged), a container column reads the widget
 * type. Nothing is removed, so section drops cannot regress.
 *
 * `container` is deliberately excluded: a container inside a column is the
 * `inner_section` widget, which the Basic elements grid already offers.
 * Preset chips carry a `presetIndex` the widget path has no concept of, so they
 * are left as section-only drags.
 */
function decorateSectionDrag(e: React.DragEvent<HTMLDivElement>): void {
  const dt = e.dataTransfer
  if (!dt) {
    return
  }
  let payload: unknown
  try {
    // dragstart is the one moment dataTransfer is readable AND writable.
    payload = JSON.parse(dt.getData(BLOCK_DND_MIME) || "null")
  } catch {
    return
  }
  if (!payload || typeof payload !== "object") {
    return
  }
  const { block_type, presetIndex } = payload as {
    block_type?: unknown
    presetIndex?: unknown
  }
  if (presetIndex !== undefined || !isCommerceWidget(block_type)) {
    return
  }
  dt.setData(WIDGET_DND_MIME, JSON.stringify({ widget_type: block_type }))
}

function WidgetMiniCard({
  type: widgetType,
  label,
}: {
  type: string
  label: string
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          WIDGET_DND_MIME,
          JSON.stringify({ widget_type: widgetType })
        )
        e.dataTransfer.effectAllowed = "copy"
        setCardDragImage(e, label)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drag into a container column on the page"
      style={{
        ...surface(),
        borderRadius: radius.md,
        borderColor: hover ? grey[30] : grey[20],
        background: hover ? grey[5] : grey[0],
        minHeight: 64,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: "grab",
        userSelect: "none",
        transition: `background ${motion.fast}, border-color ${motion.fast}`,
      }}
    >
      <span style={{ color: grey[50], display: "inline-flex" }}>
        <PaletteIcon type={widgetType} size={20} />
      </span>
      <span
        style={{
          ...type.label,
          fontFamily: font,
          color: grey[80],
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * The Elements pane BODY — basic-widget grid + store-section palette —
 * without the Elements/Navigator tab chrome. Phase 2 (2C): the dock owns
 * the top-level tabs now, so this is exported for `dock/Dock.tsx` to mount
 * directly as the "Elements" pane. The default export below keeps its old
 * two-tab shape so the pre-dock shell keeps working until the integrator
 * swaps it — same markup, same drag decoration, zero behavior change.
 */
export function ElementsPane({
  usedTypes,
  onAdd,
}: {
  usedTypes: string[]
  onAdd: (type: string, presetIndex?: number) => void
}) {
  const [basicOpen, setBasicOpen] = useState(true)

  // Only the ATOMIC widgets belong in "Basic elements". The 12 commerce blocks
  // are widget types too now (schema/widgets.ts), but they keep their home in
  // the "Store sections" palette below — listing 21 cards here would bury the
  // primitives a merchant reaches for most.
  const widgets = listBasicWidgetSchemas()

  return (
    <div>
      {/* Basic elements — draggable widget cards */}
      <button
        type="button"
        onClick={() => setBasicOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: 0,
          padding: "4px 0 8px",
          cursor: "pointer",
        }}
      >
        <span style={eyebrow()}>Basic elements</span>
        <span
          style={{
            color: grey[40],
            display: "inline-flex",
            transform: basicOpen ? "none" : "rotate(-90deg)",
            transition: `transform ${motion.fast}`,
          }}
        >
          <UiIcon name="chevron-down" size={14} />
        </span>
      </button>
      {basicOpen && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {widgets.map((w) => (
            <WidgetMiniCard key={w.type} type={w.type} label={w.label} />
          ))}
        </div>
      )}

      {/* Sections palette — search, categories, click or drag.
          A store-section card is now BOTH: dropped on a page seam it still
          inserts a full-width section (its own "application/x-ff-block"
          payload, untouched), and dropped into a container column it
          inserts the SAME type as a WIDGET. One card, two valid targets —
          which is exactly Elementor's model, and why a "+" is now always
          available inside a column. */}
      <div onDragStart={decorateSectionDrag}>
        <AddSectionPicker
          embedded
          usedTypes={usedTypes}
          onAdd={onAdd}
          onCancel={() => {}}
        />
      </div>
    </div>
  )
}

export default function ElementsPalette({
  usedTypes,
  onAdd,
  navigator,
}: {
  usedTypes: string[]
  onAdd: (type: string, presetIndex?: number) => void
  navigator: React.ReactNode
}) {
  const [tab, setTab] = useState<"elements" | "navigator">("elements")

  return (
    <div>
      {/* Elements / Navigator switch */}
      <div
        role="tablist"
        style={{ display: "flex", borderBottom: hairline, marginBottom: 12 }}
      >
        {(
          [
            { key: "elements", label: "Elements" },
            { key: "navigator", label: "Navigator" },
          ] as const
        ).map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              style={{
                ...type.micro,
                fontFamily: font,
                flex: 1,
                border: 0,
                borderBottom: `2px solid ${on ? accent.base : "transparent"}`,
                marginBottom: -1,
                background: "transparent",
                color: on ? accent.base : grey[50],
                padding: "8px 4px",
                cursor: "pointer",
                transition: `color ${motion.fast}, border-color ${motion.fast}`,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "navigator" ? (
        navigator
      ) : (
        <ElementsPane usedTypes={usedTypes} onAdd={onAdd} />
      )}
    </div>
  )
}
