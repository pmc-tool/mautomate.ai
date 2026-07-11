"use client"

/* ------------------------------------------------------------------ */
/* Add-section palette (Composer W2)                                    */
/*                                                                     */
/* Elementor-style palette: sticky search on top, category groups        */
/* ("Layout" = container, "Store sections" = everything else), and a     */
/* 2-column grid of icon cards. Every card is BOTH:                      */
/*   - clickable → onAdd(type[, presetIndex]) appends at the end (the    */
/*     pre-drag behavior, unchanged), and                                */
/*   - draggable → sets "application/x-ff-block" dataTransfer JSON       */
/*     ({ block_type, presetIndex? }) so the canvas iframe can compute   */
/*     an insertion index and post cms:insertAt back to the parent.      */
/* Preset chips live behind a small "presets" expander on each card and  */
/* are click+drag sources too (same payload plus presetIndex).           */
/* ------------------------------------------------------------------ */

import React, { useMemo, useState } from "react"
import { listBlockSchemas } from "@modules/cms/schema"
import type { BlockSchema } from "@modules/cms/schema"
import { PaletteIcon } from "./palette-icons"

/** DnD mime type shared with the canvas (see editor-canvas). */
export const BLOCK_DND_MIME = "application/x-ff-block"

const ACCENT = "#2563eb"

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
}

const groupHead: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  margin: "14px 0 6px",
}

function SectionCard({
  schema,
  maxed,
  onAdd,
}: {
  schema: BlockSchema
  maxed: boolean
  onAdd: (type: string, presetIndex?: number) => void
}) {
  const [hover, setHover] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const presets = schema.presets ?? []

  return (
    <div
      role="button"
      tabIndex={maxed ? -1 : 0}
      aria-disabled={maxed}
      draggable={!maxed}
      onDragStart={(e) => {
        if (maxed) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData(
          BLOCK_DND_MIME,
          JSON.stringify({ block_type: schema.type })
        )
        e.dataTransfer.effectAllowed = "copy"
      }}
      onClick={() => !maxed && onAdd(schema.type)}
      onKeyDown={(e) => {
        if (!maxed && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onAdd(schema.type)
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={maxed ? "Already added (max reached)" : `Click to add, or drag onto the page`}
      style={{
        border: `1px solid ${hover && !maxed ? ACCENT : "#e5e7eb"}`,
        borderRadius: 10,
        padding: "12px 8px 10px",
        background: maxed ? "#f9fafb" : "#fff",
        opacity: maxed ? 0.5 : 1,
        cursor: maxed ? "not-allowed" : "grab",
        textAlign: "center",
        userSelect: "none",
        transform: hover && !maxed ? "translateY(-1px)" : "none",
        boxShadow:
          hover && !maxed ? "0 3px 10px rgba(37, 99, 235, 0.12)" : "none",
        transition: "border-color .12s, transform .12s, box-shadow .12s",
      }}
    >
      <div style={{ color: hover && !maxed ? ACCENT : "#4b5563" }}>
        <PaletteIcon type={schema.type} size={22} />
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#111827",
          marginTop: 6,
          lineHeight: 1.25,
        }}
      >
        {schema.label}
      </div>
      {maxed ? (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
          already added
        </div>
      ) : presets.length ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowPresets((v) => !v)
            }}
            style={{
              fontSize: 10,
              color: ACCENT,
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
              marginTop: 4,
            }}
          >
            {showPresets ? "hide presets ▴" : `${presets.length} preset${presets.length > 1 ? "s" : ""} ▾`}
          </button>
          {showPresets && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 4,
                marginTop: 6,
              }}
            >
              {presets.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation()
                    e.dataTransfer.setData(
                      BLOCK_DND_MIME,
                      JSON.stringify({ block_type: schema.type, presetIndex: i })
                    )
                    e.dataTransfer.effectAllowed = "copy"
                  }}
                  onClick={() => onAdd(schema.type, i)}
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid #dbeafe",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    cursor: "pointer",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

export default function AddSectionPicker({
  usedTypes,
  onAdd,
  onCancel,
  embedded = false,
}: {
  usedTypes: string[]
  onAdd: (type: string, presetIndex?: number) => void
  onCancel: () => void
  /** Rendered inside the resident ElementsPalette — hide the modal header. */
  embedded?: boolean
}) {
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const schemas = listBlockSchemas()
    const q = query.trim().toLowerCase()
    const visible = q
      ? schemas.filter((s) => s.label.toLowerCase().includes(q))
      : schemas
    return [
      { label: "Layout", items: visible.filter((s) => s.category === "layout") },
      {
        label: "Store sections",
        items: visible.filter((s) => s.category !== "layout"),
      },
    ].filter((g) => g.items.length)
  }, [query])

  return (
    <div>
      {!embedded && (
        <>
          <button
            onClick={onCancel}
            style={{
              fontSize: 12,
              color: ACCENT,
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
              marginBottom: 8,
            }}
          >
            ← Cancel
          </button>
          <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>Add a section</h3>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
            Click to add at the end, or drag a card onto the page.
          </p>
        </>
      )}

      {/* Sticky search */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "#fff",
          padding: "4px 0 8px",
        }}
      >
        <div style={{ position: "relative" }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
              display: "inline-flex",
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections…"
            aria-label="Search sections"
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: 13,
              padding: "7px 10px 7px 28px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              outline: "none",
              background: "#f9fafb",
            }}
          />
        </div>
      </div>

      {groups.length === 0 && (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "10px 0" }}>
          No sections match “{query}”.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label}>
          <div style={groupHead}>{g.label}</div>
          <div style={gridStyle}>
            {g.items.map((s) => {
              const maxed =
                s.maxInstances != null &&
                usedTypes.filter((t) => t === s.type).length >= s.maxInstances
              return (
                <SectionCard
                  key={s.type}
                  schema={s}
                  maxed={maxed}
                  onAdd={onAdd}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
