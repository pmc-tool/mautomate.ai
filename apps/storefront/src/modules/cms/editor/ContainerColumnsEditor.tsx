"use client"

/* ------------------------------------------------------------------ */
/* Container columns manager (Composer W1)                              */
/*                                                                     */
/* Shown under the CONTENT tab when a `container` section is selected.  */
/* Per column: the list of its widgets (click a row → select that       */
/* widget for editing, ↑↓ reorder within the column, ✕ remove) plus an   */
/* "+ Add widget" picker listing every WIDGET_SCHEMAS entry. A new       */
/* widget is built from its schema `defaults` (content props only — no   */
/* style/advanced, so it stays a tiny diff until the user styles it).    */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"
import {
  getWidgetSchema,
  listWidgetSchemas,
} from "@modules/cms/schema/widgets"
import { PaletteIcon, IconButton } from "./palette-icons"

/** DnD mime type shared with the canvas (see editor-canvas). */
export const WIDGET_DND_MIME = "application/x-ff-widget"

/** A widget instance inside a container column. */
export type Widget = { widget_type: string; [k: string]: unknown }
/** One container column — just an ordered list of widgets. */
export type Column = { widgets: Widget[] }

/** Build a fresh widget of `type` from its schema defaults. */
export function newWidgetOf(type: string): Widget {
  const def = getWidgetSchema(type)
  return { widget_type: type, ...structuredClone(def?.defaults ?? {}) }
}

/**
 * Grow/shrink a columns array to `count`, never silently deleting content:
 * growing appends empty columns; shrinking concatenates the removed columns'
 * widgets onto the LAST KEPT column. Returns the input unchanged when the
 * count already matches (or is unusable), so no-op layout edits stay cheap.
 */
export function reconcileColumns(
  columns: Column[],
  count: number
): Column[] {
  if (!Number.isInteger(count) || count < 1) {
    return columns
  }
  const cols = Array.isArray(columns) ? columns : []
  if (cols.length === count) {
    return cols
  }
  if (cols.length < count) {
    return [
      ...cols,
      ...Array.from({ length: count - cols.length }, () => ({
        widgets: [] as Widget[],
      })),
    ]
  }
  // Shrink: merge every removed column's widgets into the last kept column.
  const kept = cols.slice(0, count)
  const overflow = cols
    .slice(count)
    .flatMap((c) => (Array.isArray(c?.widgets) ? c.widgets : []))
  const last = kept.length - 1
  return kept.map((c, i) =>
    i === last
      ? { ...c, widgets: [...(c.widgets ?? []), ...overflow] }
      : c
  )
}

/* ------------------------------ styles ----------------------------- */
const colBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 9,
  margin: "8px 0",
  background: "#fff",
  overflow: "hidden",
}
const colHead: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "7px 10px",
  background: "#f9fafb",
  borderBottom: "1px solid #f3f4f6",
}
const rowBtn: React.CSSProperties = {
  flex: 1,
  textAlign: "left",
  background: "none",
  border: 0,
  cursor: "pointer",
  fontSize: 13,
  color: "#111827",
  padding: 0,
}
const miniBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 5,
  fontSize: 11,
  padding: "2px 7px",
  cursor: "pointer",
  color: "#374151",
}

/* --------------------------- widget card --------------------------- */
/**
 * One card in the "+ Add widget" grid — click appends to the column
 * (pre-drag behavior, unchanged) and drag carries the shared
 * "application/x-ff-widget" payload ({ widget_type }) so the canvas
 * iframe can compute a drop position and post cms:insertWidgetAt.
 */
function WidgetCard({
  type,
  label,
  onAdd,
}: {
  type: string
  label: string
  onAdd: () => void
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
          JSON.stringify({ widget_type: type })
        )
        e.dataTransfer.effectAllowed = "copy"
      }}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onAdd()
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click to add, or drag into a column on the page"
      style={{
        border: `1px solid ${hover ? "#2563eb" : "#dbeafe"}`,
        borderRadius: 8,
        padding: "9px 4px 7px",
        background: "#fff",
        textAlign: "center",
        cursor: "grab",
        userSelect: "none",
        transform: hover ? "translateY(-1px)" : "none",
        boxShadow: hover ? "0 3px 8px rgba(37, 99, 235, 0.12)" : "none",
        transition: "border-color .12s, transform .12s, box-shadow .12s",
      }}
    >
      <div style={{ color: hover ? "#2563eb" : "#4b5563" }}>
        <PaletteIcon type={type} size={18} />
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#111827",
          marginTop: 4,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default function ContainerColumnsEditor({
  columns,
  onChange,
  onSelectWidget,
}: {
  columns: Column[]
  onChange: (next: Column[]) => void
  /** A widget row was clicked — select it for editing (panel + canvas). */
  onSelectWidget: (col: number, wi: number) => void
}) {
  // Which column's "+ Add widget" picker is open (null = none).
  const [pickerCol, setPickerCol] = useState<number | null>(null)
  const cols = Array.isArray(columns) ? columns : []

  const setColumn = (ci: number, widgets: Widget[]) =>
    onChange(cols.map((c, i) => (i === ci ? { ...c, widgets } : c)))

  const moveWidget = (ci: number, wi: number, dir: -1 | 1) => {
    const widgets = [...(cols[ci]?.widgets ?? [])]
    const to = wi + dir
    if (to < 0 || to >= widgets.length) {
      return
    }
    ;[widgets[wi], widgets[to]] = [widgets[to], widgets[wi]]
    setColumn(ci, widgets)
  }

  const removeWidget = (ci: number, wi: number) => {
    const widgets = (cols[ci]?.widgets ?? []).filter((_, i) => i !== wi)
    setColumn(ci, widgets)
  }

  const addWidget = (ci: number, type: string) => {
    const widgets = [...(cols[ci]?.widgets ?? []), newWidgetOf(type)]
    setColumn(ci, widgets)
    setPickerCol(null)
    // Select the freshly added widget so its fields open immediately.
    onSelectWidget(ci, widgets.length - 1)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          margin: "6px 0 2px",
        }}
      >
        Columns &amp; widgets
      </div>
      {cols.map((col, ci) => {
        const widgets = Array.isArray(col?.widgets) ? col.widgets : []
        return (
          <div key={ci} style={colBox}>
            <div style={colHead}>Column {ci + 1}</div>
            <div style={{ padding: "6px 10px 10px" }}>
              {widgets.length === 0 && (
                <div style={{ fontSize: 12, color: "#9ca3af", padding: "6px 0" }}>
                  No widgets yet.
                </div>
              )}
              {widgets.map((w, wi) => (
                <div
                  key={wi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    margin: "4px 0",
                    border: "1px solid #e5e7eb",
                    borderRadius: 7,
                    background: "#fff",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      color: "#6b7280",
                      display: "inline-flex",
                      flexShrink: 0,
                    }}
                  >
                    <PaletteIcon type={w.widget_type} size={15} />
                  </span>
                  <button
                    type="button"
                    style={rowBtn}
                    title="Edit this widget"
                    onClick={() => onSelectWidget(ci, wi)}
                  >
                    {getWidgetSchema(w.widget_type)?.label ?? w.widget_type}
                  </button>
                  <IconButton
                    icon="arrow-up"
                    label="Move up"
                    size={22}
                    iconSize={12}
                    disabled={wi === 0}
                    onClick={() => moveWidget(ci, wi, -1)}
                  />
                  <IconButton
                    icon="arrow-down"
                    label="Move down"
                    size={22}
                    iconSize={12}
                    disabled={wi === widgets.length - 1}
                    onClick={() => moveWidget(ci, wi, 1)}
                  />
                  <IconButton
                    icon="x"
                    label="Remove widget"
                    danger
                    size={22}
                    iconSize={12}
                    onClick={() => removeWidget(ci, wi)}
                  />
                </div>
              ))}
              {pickerCol === ci ? (
                <div
                  style={{
                    border: "1px solid #dbeafe",
                    background: "#eff6ff",
                    borderRadius: 7,
                    padding: 8,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>
                      Pick a widget
                    </span>
                    <button
                      type="button"
                      style={{ ...miniBtn, marginLeft: "auto" }}
                      onClick={() => setPickerCol(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                    }}
                  >
                    {listWidgetSchemas().map((def) => (
                      <WidgetCard
                        key={def.type}
                        type={def.type}
                        label={def.label}
                        onAdd={() => addWidget(ci, def.type)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerCol(ci)}
                  style={{
                    width: "100%",
                    border: "1px dashed #93c5fd",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    borderRadius: 7,
                    fontSize: 12,
                    padding: "6px",
                    cursor: "pointer",
                    marginTop: 4,
                  }}
                >
                  + Add widget
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
