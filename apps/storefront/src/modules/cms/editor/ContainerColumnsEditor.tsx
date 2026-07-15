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
/*                                                                     */
/* Styling comes entirely from the shared editor design system          */
/* (./design) — same ramp as the dashboard, one ember accent.           */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"
import {
  getWidgetSchema,
  listWidgetSchemas,
} from "@modules/cms/schema/widgets"
import { PaletteIcon, IconButton, UiIcon } from "./palette-icons"
import {
  accent,
  button,
  eyebrow,
  font,
  grey,
  hairline,
  motion,
  radius,
  shadow,
  surface,
  type,
} from "@modules/cms/editor/design"

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
  ...surface(),
  borderRadius: radius.md,
  margin: "8px 0",
  overflow: "hidden",
}
const colHead: React.CSSProperties = {
  ...eyebrow(),
  padding: "8px 12px",
  background: grey[5],
  borderBottom: hairline,
}
const rowBtn: React.CSSProperties = {
  ...type.body,
  fontFamily: font,
  flex: 1,
  textAlign: "left",
  background: "none",
  border: 0,
  cursor: "pointer",
  color: grey[90],
  padding: 0,
}
const miniBtn: React.CSSProperties = {
  ...button("secondary", "sm"),
}

/* --------------------------- widget card --------------------------- */
/**
 * One card in the "+ Add widget" grid — click appends to the column
 * (pre-drag behavior, unchanged) and drag carries the shared
 * "application/x-ff-widget" payload ({ widget_type }) so the canvas
 * iframe can compute a drop position and post cms:insertWidgetAt.
 */
function WidgetCard({
  type: widgetType,
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
          JSON.stringify({ widget_type: widgetType })
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
        border: `1px solid ${hover ? accent.base : grey[20]}`,
        borderRadius: radius.md,
        padding: "12px 6px 8px",
        background: grey[0],
        textAlign: "center",
        cursor: "grab",
        userSelect: "none",
        transform: hover ? "translateY(-1px)" : "none",
        boxShadow: hover ? shadow.sm : "none",
        transition: `border-color ${motion.fast}, transform ${motion.fast}, box-shadow ${motion.fast}`,
      }}
    >
      <div style={{ color: hover ? accent.base : grey[50] }}>
        <PaletteIcon type={widgetType} size={18} />
      </div>
      <div
        style={{
          ...type.label,
          fontFamily: font,
          fontWeight: 600,
          color: grey[90],
          marginTop: 6,
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

  const addWidget = (ci: number, widgetType: string) => {
    const widgets = [...(cols[ci]?.widgets ?? []), newWidgetOf(widgetType)]
    setColumn(ci, widgets)
    setPickerCol(null)
    // Select the freshly added widget so its fields open immediately.
    onSelectWidget(ci, widgets.length - 1)
  }

  return (
    <div style={{ marginTop: 16, fontFamily: font }}>
      <div style={{ ...eyebrow(), margin: "8px 0 4px" }}>
        Columns &amp; widgets
      </div>
      {cols.map((col, ci) => {
        const widgets = Array.isArray(col?.widgets) ? col.widgets : []
        return (
          <div key={ci} style={colBox}>
            <div style={colHead}>Column {ci + 1}</div>
            <div style={{ padding: "8px 12px 12px" }}>
              {widgets.length === 0 && (
                <div style={{ ...type.label, fontFamily: font, color: grey[40], padding: "6px 0" }}>
                  No widgets yet.
                </div>
              )}
              {widgets.map((w, wi) => (
                <div
                  key={wi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px",
                    margin: "4px 0",
                    border: hairline,
                    borderRadius: radius.md,
                    background: grey[0],
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      color: grey[50],
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
                    size={24}
                    iconSize={13}
                    disabled={wi === 0}
                    onClick={() => moveWidget(ci, wi, -1)}
                  />
                  <IconButton
                    icon="arrow-down"
                    label="Move down"
                    size={24}
                    iconSize={13}
                    disabled={wi === widgets.length - 1}
                    onClick={() => moveWidget(ci, wi, 1)}
                  />
                  <IconButton
                    icon="trash"
                    label="Remove widget"
                    danger
                    size={24}
                    iconSize={13}
                    onClick={() => removeWidget(ci, wi)}
                  />
                </div>
              ))}
              {pickerCol === ci ? (
                <div
                  style={{
                    border: `1px solid ${accent.tintStrong}`,
                    background: accent.tint,
                    borderRadius: radius.md,
                    padding: 8,
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ ...eyebrow(), color: accent.active }}>
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
                    ...button("secondary", "sm"),
                    width: "100%",
                    border: `1px dashed ${grey[30]}`,
                    color: grey[70],
                    marginTop: 6,
                  }}
                >
                  <UiIcon name="plus" size={13} />
                  Add widget
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
