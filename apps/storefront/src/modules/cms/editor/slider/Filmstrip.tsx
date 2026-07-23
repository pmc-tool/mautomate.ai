"use client"

/* ------------------------------------------------------------------ */
/* Slider stage — filmstrip (Phase 5B, ARCH-SLIDER §3.1)                */
/*                                                                      */
/* The top bar of the stage takeover: slide thumbnails (background      */
/* preview + name), add / duplicate / delete / drag-reorder / rename,   */
/* and the Done exit. Every mutation dispatches ONE id-targeted         */
/* slider.* command through the caller; this component holds no         */
/* document state of its own.                                           */
/* ------------------------------------------------------------------ */

import React, { useRef, useState } from "react"
import {
  accent,
  font,
  ink,
  overlay,
  radius,
  shadow,
} from "@modules/cms/editor/design"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import type { LayeredSlide } from "./model-5a"

export const FILMSTRIP_H = 74

const thumbW = 96
const thumbH = 42

function bgPreview(slide: LayeredSlide): React.CSSProperties {
  const bg = slide.background
  if (bg?.type === "image" && bg.image) {
    return {
      backgroundImage: `url(${JSON.stringify(bg.image)})`,
      backgroundSize: bg.fit === "contain" ? "contain" : "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: ink.raised,
    }
  }
  if (bg?.type === "color" && typeof bg.color === "string") {
    return { backgroundColor: bg.color }
  }
  return { backgroundColor: ink.raised }
}

export default function Filmstrip({
  slides,
  activeId,
  fieldsCount,
  onActivate,
  onAdd,
  onDuplicate,
  onRemove,
  onReorder,
  onRename,
  onExit,
}: {
  slides: LayeredSlide[]
  activeId: string | null
  /** Slides still in the sealed fields shape (mixed slider, §5). */
  fieldsCount: number
  onActivate: (slideId: string) => void
  onAdd: () => void
  onDuplicate: (slideId: string) => void
  onRemove: (slideId: string) => void
  onReorder: (slideId: string, to: number) => void
  onRename: (slideId: string, name: string) => void
  onExit: () => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)

  const commitRename = (id: string) => {
    const v = renameRef.current?.value ?? ""
    setRenaming(null)
    onRename(id, v.trim())
  }

  return (
    <div
      data-cms-overlay="1"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: FILMSTRIP_H,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        background: ink.base,
        boxShadow: shadow.chip,
        fontFamily: font,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          font: `600 12px/1 ${font}`,
          color: ink.text,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ color: accent.base, display: "inline-flex" }}>
          <UiIcon name="hero_slider" size={15} />
        </span>
        Slide stage
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          flex: 1,
          padding: "6px 2px",
        }}
      >
        {slides.map((s, i) => {
          const active = s.id === activeId
          return (
            <div
              key={s.id}
              draggable={renaming !== s.id}
              onDragStart={(e) => {
                setDragId(s.id)
                e.dataTransfer.effectAllowed = "move"
                try {
                  e.dataTransfer.setData("text/plain", s.id)
                } catch {
                  /* older engines */
                }
              }}
              onDragEnd={() => {
                setDragId(null)
                setDragOver(null)
              }}
              onDragOver={(e) => {
                if (!dragId || dragId === s.id) return
                e.preventDefault()
                setDragOver(i)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId && dragId !== s.id) onReorder(dragId, i)
                setDragId(null)
                setDragOver(null)
              }}
              onClick={() => onActivate(s.id)}
              onDoubleClick={() => setRenaming(s.id)}
              title={s.name || `Slide ${i + 1}`}
              style={{
                position: "relative",
                flexShrink: 0,
                width: thumbW,
                borderRadius: radius.md,
                cursor: "pointer",
                outline: active
                  ? `2px solid ${accent.base}`
                  : dragOver === i
                    ? `2px dashed ${accent.base}`
                    : `1px solid ${ink.hairline}`,
                outlineOffset: 1,
                opacity: dragId === s.id ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  width: thumbW,
                  height: thumbH,
                  borderRadius: `${radius.md}px ${radius.md}px 0 0`,
                  ...bgPreview(s),
                }}
              />
              {renaming === s.id ? (
                <input
                  ref={renameRef}
                  autoFocus
                  defaultValue={s.name ?? ""}
                  placeholder={`Slide ${i + 1}`}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === "Enter") commitRename(s.id)
                    if (e.key === "Escape") setRenaming(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "2px 4px",
                    font: `500 10px/1.3 ${font}`,
                    color: ink.text,
                    background: ink.raised,
                    border: `1px solid ${accent.base}`,
                    borderRadius: `0 0 ${radius.md}px ${radius.md}px`,
                    outline: "none",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "2px 6px",
                    font: `500 10px/1.4 ${font}`,
                    color: active ? ink.text : ink.muted,
                    background: ink.raised,
                    borderRadius: `0 0 ${radius.md}px ${radius.md}px`,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name || `Slide ${i + 1}`}
                  </span>
                  {active ? (
                    <>
                      <button
                        type="button"
                        title="Duplicate slide"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDuplicate(s.id)
                        }}
                        style={stripBtn}
                      >
                        <UiIcon name="duplicate" size={11} />
                      </button>
                      <button
                        type="button"
                        title={
                          slides.length + fieldsCount <= 1
                            ? "A slider needs at least one slide"
                            : "Delete slide"
                        }
                        disabled={slides.length + fieldsCount <= 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemove(s.id)
                        }}
                        style={stripBtn}
                      >
                        <UiIcon name="x" size={11} />
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          title="Add slide"
          onClick={onAdd}
          style={{
            flexShrink: 0,
            width: 40,
            height: thumbH + 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: overlay.ember.on,
            background: overlay.ember.bg,
            border: "none",
            borderRadius: radius.md,
            cursor: "pointer",
          }}
        >
          <UiIcon name="plus" size={16} />
        </button>

        {fieldsCount > 0 ? (
          <span
            style={{
              flexShrink: 0,
              font: `500 11px/1.3 ${font}`,
              color: ink.muted,
              maxWidth: 220,
            }}
          >
            {fieldsCount} slide{fieldsCount > 1 ? "s" : ""} not yet layered —
            they render through the theme until converted.
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onExit}
        title="Exit the slide stage (Esc)"
        style={{
          flexShrink: 0,
          padding: "8px 18px",
          font: `600 12px/1 ${font}`,
          color: ink.base,
          background: ink.text,
          border: "none",
          borderRadius: radius.md,
          cursor: "pointer",
        }}
      >
        Done
      </button>
    </div>
  )
}

const stripBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  padding: 0,
  color: "inherit",
  background: "transparent",
  border: "none",
  cursor: "pointer",
}
