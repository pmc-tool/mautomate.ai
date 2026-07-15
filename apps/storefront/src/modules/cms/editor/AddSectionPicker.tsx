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
import { PaletteIcon, UiIcon } from "./palette-icons"
import {
  accent,
  eyebrow,
  field,
  font,
  grey,
  motion,
  radius,
  surface,
  type,
} from "@modules/cms/editor/design"

/** DnD mime type shared with the canvas (see editor-canvas). */
export const BLOCK_DND_MIME = "application/x-ff-block"

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
}

const groupHead: React.CSSProperties = {
  ...eyebrow(),
  margin: "16px 0 8px",
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
        ...surface(),
        borderRadius: radius.md,
        borderColor: hover && !maxed ? grey[30] : grey[20],
        background: maxed ? grey[5] : hover ? grey[5] : grey[0],
        opacity: maxed ? 0.6 : 1,
        minHeight: 64,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: maxed ? "not-allowed" : "grab",
        userSelect: "none",
        transition: `background ${motion.fast}, border-color ${motion.fast}`,
      }}
    >
      <span
        style={{ color: maxed ? grey[40] : grey[50], display: "inline-flex" }}
      >
        <PaletteIcon type={schema.type} size={20} />
      </span>
      <span
        style={{
          ...type.label,
          fontFamily: font,
          color: maxed ? grey[40] : grey[80],
          textAlign: "center",
        }}
      >
        {schema.label}
      </span>
      {maxed ? (
        <span style={{ ...type.micro, fontFamily: font, color: grey[40] }}>
          Already added
        </span>
      ) : presets.length ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowPresets((v) => !v)
            }}
            style={{
              ...type.micro,
              fontFamily: font,
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              color: accent.base,
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showPresets
              ? "Hide presets"
              : `${presets.length} preset${presets.length > 1 ? "s" : ""}`}
            <UiIcon
              name="chevron-down"
              size={12}
              style={{
                transform: showPresets ? "rotate(180deg)" : "none",
                transition: `transform ${motion.fast}`,
              }}
            />
          </button>
          {showPresets && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 4,
                marginTop: 4,
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
                    ...type.label,
                    fontFamily: font,
                    padding: "2px 8px",
                    borderRadius: radius.pill,
                    border: `1px solid ${accent.tintStrong}`,
                    background: accent.tint,
                    color: accent.base,
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
              ...type.label,
              fontFamily: font,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: grey[50],
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
              marginBottom: 8,
            }}
          >
            <UiIcon name="arrow-left" size={14} />
            Cancel
          </button>
          <h3
            style={{
              ...type.title,
              fontFamily: font,
              color: grey[90],
              margin: "0 0 4px",
            }}
          >
            Add a section
          </h3>
          <p
            style={{
              ...type.body,
              fontFamily: font,
              color: grey[50],
              margin: "0 0 8px",
            }}
          >
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
          background: grey[0],
          padding: "4px 0 8px",
        }}
      >
        <div style={{ position: "relative" }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: grey[40],
              display: "inline-flex",
            }}
          >
            <UiIcon name="search" size={14} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections…"
            aria-label="Search sections"
            style={{
              ...field(),
              boxSizing: "border-box",
              padding: "0 10px 0 30px",
            }}
          />
        </div>
      </div>

      {groups.length === 0 && (
        <div
          style={{
            ...type.body,
            fontFamily: font,
            color: grey[40],
            padding: "12px 0",
          }}
        >
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
