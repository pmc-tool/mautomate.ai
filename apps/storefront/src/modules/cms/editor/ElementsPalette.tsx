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
