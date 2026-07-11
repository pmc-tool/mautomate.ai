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
import { WIDGET_SCHEMAS } from "@modules/cms/schema/widgets"
import { PaletteIcon } from "./palette-icons"
import { setCardDragImage } from "./drag-ghost"
import AddSectionPicker from "./AddSectionPicker"

/** DnD mime shared with the canvas + ContainerColumnsEditor. */
const WIDGET_DND_MIME = "application/x-ff-widget"

function WidgetMiniCard({ type, label }: { type: string; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(WIDGET_DND_MIME, JSON.stringify({ widget_type: type }))
        e.dataTransfer.effectAllowed = "copy"
        setCardDragImage(e, label)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drag into a container column on the page"
      style={{
        border: `1px solid ${hover ? "#93003f" : "#e6e8ea"}`,
        borderRadius: 3,
        padding: "12px 4px 10px",
        background: "#fff",
        textAlign: "center",
        cursor: "grab",
        userSelect: "none",
        transform: hover ? "translateY(-1px)" : "none",
        boxShadow: hover ? "0 3px 8px rgba(147, 0, 63, 0.10)" : "none",
        transition: "border-color .12s, transform .12s, box-shadow .12s",
      }}
    >
      <div style={{ color: hover ? "#93003f" : "#515962" }}>
        <PaletteIcon type={type} size={22} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#515962", marginTop: 6, lineHeight: 1.2 }}>
        {label}
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
  const [basicOpen, setBasicOpen] = useState(true)

  const widgets = Object.values(WIDGET_SCHEMAS)

  return (
    <div>
      {/* Elements / Navigator switch */}
      <div
        role="tablist"
        style={{ display: "flex", borderBottom: "1px solid #e6e8ea", marginBottom: 10 }}
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
                flex: 1,
                border: 0,
                borderBottom: on ? "2px solid #93003f" : "2px solid transparent",
                marginBottom: -1,
                background: "transparent",
                color: on ? "#93003f" : "#6d7882",
                fontSize: 11,
                fontWeight: on ? 700 : 500,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                padding: "8px 4px",
                cursor: "pointer",
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
              padding: "4px 0 6px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6d7882", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Basic elements
            </span>
            <span
              style={{
                fontSize: 10,
                color: "#9ca3af",
                transform: basicOpen ? "rotate(90deg)" : "none",
                transition: "transform 0.15s",
              }}
            >
              ▸
            </span>
          </button>
          {basicOpen && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {widgets.map((w) => (
                <WidgetMiniCard key={w.type} type={w.type} label={w.label} />
              ))}
            </div>
          )}

          {/* Sections palette — search, categories, click or drag */}
          <AddSectionPicker
            embedded
            usedTypes={usedTypes}
            onAdd={onAdd}
            onCancel={() => {}}
          />
        </div>
      )}
    </div>
  )
}
