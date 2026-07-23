"use client"

/* ------------------------------------------------------------------ */
/* Slider stage — SHELL-side chrome (Phase 7A)                          */
/*                                                                      */
/* The RevSlider layout, rebuilt as a full-screen takeover that the      */
/* SHELL owns. Until 7A this chrome lived inside the canvas iframe,      */
/* which the shell constrains to whatever width its 380px editing panel  */
/* leaves over — so the stage was boxed in, the layer rail read as       */
/* "hiding behind the sidebar", and at mobile preview width (390px) the  */
/* rail had to disappear outright. Nothing inside a constrained iframe   */
/* can fix that, so the chrome moved OUT.                                */
/*                                                                      */
/*   ┌──────────────────────────────────────────────────────────────┐   */
/*   │ Back │ Slides │ + Add Layer   [layer + actions]   [device]   │   │ TOPBAR_H
/*   ├───────────────────────────────────────────┬──────────────────┤   */
/*   │ (slide filmstrip — toggled by "Slides")   │  LAYER OPTIONS   │   */
/*   │                                           │                  │   */
/*   │            canvas iframe                  │  the re-housed   │   */
/*   │        (the shell positions it here)      │   SchemaPanel    │   */
/*   ├───────────────────────────────────────────┤                  │   */
/*   │ layer list — top-most first, drag to      │                  │   BOTTOM_H
/*   │ restack, eye / lock / delete              │                  │   */
/*   └───────────────────────────────────────────┴──────────────────┘   */
/*                                               └── SIDEBAR_W ─────┘   */
/*                                                                      */
/* DIVISION OF LABOUR (the crux): geometry stays in the iframe, chrome   */
/* lives here. StageMode still owns the stage rect, layer boxes, resize  */
/* handles, snap guides and the device badge — it just stops drawing its */
/* filmstrip/rail once the shell posts cms:stageChrome{external:true}.   */
/*                                                                      */
/* This component is PRESENTATIONAL. It never touches the document: it   */
/* raises intent, and the shell dispatches slider.* commands through the */
/* 2A executor IN-PROCESS (no iframe round trip), so undo granularity,   */
/* autosave and revisions need zero new plumbing — the same contract the */
/* in-canvas chrome had via postCommandToShell.                          */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef, useState } from "react"
import type { Device } from "@modules/cms/schema/types"
import {
  accent,
  font,
  grey,
  hairlineDark,
  ink,
  motion,
  radius,
  shadow,
  type,
  zLayer,
} from "@modules/cms/editor/design"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  layerDisplayName,
  type LayeredSlide,
  type SliderLayer,
  type SliderLayerType,
} from "./model-5a"

/* Region sizes. The shell reads these to inset the canvas iframe, so the
   iframe's box and this chrome can never disagree about the centre. */
export const TOPBAR_H = 44
/* The re-housed SchemaPanel was drawn for the dock's 320px column; at
   272 its inputs and their trailing icon buttons overflowed and clipped. */
export const SIDEBAR_W = 320
export const BOTTOM_H = 196
export const SLIDESTRIP_H = 104

const LAYER_TYPES: { type: SliderLayerType; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "text" },
  { type: "image", label: "Image", icon: "image" },
  { type: "button", label: "Button", icon: "button" },
  { type: "shape", label: "Shape", icon: "shape" },
  { type: "icon", label: "Icon", icon: "icon" },
]

const DEVICES: { id: Device; label: string; icon: "monitor" | "tablet" | "phone" }[] = [
  { id: "desktop", label: "Desktop", icon: "monitor" },
  { id: "tablet", label: "Tablet", icon: "tablet" },
  { id: "mobile", label: "Mobile", icon: "phone" },
]

/** Padlock glyph — palette-icons has none and its fallback square would
 *  read as a "shape" layer. Stroke matches UiIcon's. (Same drawing as the
 *  5B rail's, kept local so neither file owns the other's chrome.) */
function LockGlyph({ open, size = 12 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      {open ? (
        <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      ) : (
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      )}
    </svg>
  )
}

/* ------------------------------- atoms ------------------------------- */

const barBtn = (active = false): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 28,
  padding: "0 10px",
  border: hairlineDark,
  borderRadius: radius.md,
  background: active ? accent.base : ink.raised,
  color: active ? accent.on : ink.text,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: font,
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1,
  transition: `background ${motion.fast}, color ${motion.fast}`,
})

const iconBtn = (active = false): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  padding: 0,
  border: 0,
  borderRadius: radius.sm,
  background: active ? accent.soft : "transparent",
  color: active ? accent.base : ink.muted,
  cursor: "pointer",
  transition: `background ${motion.fast}, color ${motion.fast}`,
})

/* ----------------------------- Add Layer ----------------------------- */

function AddLayerMenu({ onAdd }: { onAdd: (t: SliderLayerType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      // Swallow Esc: closing the menu must not also tear down the stage.
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [open])
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Add a layer to this slide"
        style={barBtn(open)}
      >
        <UiIcon name="plus" size={13} />
        Add Layer
        <UiIcon name="chevron-down" size={11} />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 168,
            padding: 4,
            background: ink.raised,
            border: hairlineDark,
            borderRadius: radius.md,
            boxShadow: shadow.lg,
            zIndex: 1,
          }}
        >
          {LAYER_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => {
                setOpen(false)
                onAdd(t.type)
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                height: 30,
                padding: "0 8px",
                border: 0,
                borderRadius: radius.sm,
                background: "transparent",
                color: ink.text,
                cursor: "pointer",
                fontFamily: font,
                fontSize: 12,
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = accent.soft
                e.currentTarget.style.color = accent.base
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = ink.text
              }}
            >
              <UiIcon name={t.icon} size={13} />
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------ slide strip --------------------------- */

function SlideStrip({
  slides,
  activeId,
  fieldsCount,
  onActivate,
  onAdd,
  onDuplicate,
  onRemove,
  onReorder,
}: {
  slides: LayeredSlide[]
  activeId: string | null
  fieldsCount: number
  onActivate: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onReorder: (id: string, to: number) => void
}) {
  const dragId = useRef<string | null>(null)
  return (
    <div
      style={{
        height: SLIDESTRIP_H,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        overflowX: "auto",
        overflowY: "hidden",
        background: ink.base,
        borderBottom: hairlineDark,
      }}
    >
      {slides.map((s, i) => {
        const active = s.id === activeId
        return (
          <div
            key={s.id}
            draggable
            onDragStart={() => {
              dragId.current = s.id
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const id = dragId.current
              dragId.current = null
              if (id && id !== s.id) onReorder(id, i)
            }}
            onClick={() => onActivate(s.id)}
            title={s.name || `Slide ${i + 1}`}
            style={{
              position: "relative",
              flexShrink: 0,
              width: 132,
              height: 72,
              borderRadius: radius.md,
              border: active
                ? `2px solid ${accent.base}`
                : `1px solid ${ink.hairline}`,
              background: slideThumbBg(s),
              backgroundSize: "cover",
              backgroundPosition: "center",
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "3px 6px",
                background: "rgba(15,19,25,0.72)",
                color: ink.text,
                fontFamily: font,
                fontSize: 10,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {i + 1}. {s.name || "Slide"}
            </span>
            {active ? (
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  display: "flex",
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  title="Duplicate slide"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(s.id)
                  }}
                  style={{ ...iconBtn(), width: 20, height: 20, background: ink.base, color: ink.text }}
                >
                  <UiIcon name="duplicate" size={11} />
                </button>
                {slides.length > 1 ? (
                  <button
                    type="button"
                    title="Delete slide"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(s.id)
                    }}
                    style={{ ...iconBtn(), width: 20, height: 20, background: ink.base, color: ink.text }}
                  >
                    <UiIcon name="trash" size={11} />
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        )
      })}
      <button type="button" onClick={onAdd} title="Add slide" style={barBtn()}>
        <UiIcon name="plus" size={13} />
        Slide
      </button>
      {fieldsCount > 0 ? (
        <span
          style={{
            fontFamily: font,
            fontSize: 11,
            color: ink.muted,
            whiteSpace: "nowrap",
          }}
        >
          {fieldsCount} classic slide{fieldsCount === 1 ? "" : "s"} (not staged)
        </span>
      ) : null}
    </div>
  )
}

/** Cheap thumb: the slide's own background, else the ink surface. Purely
 *  decorative — the real render lives in the canvas. */
function slideThumbBg(s: LayeredSlide): string {
  const bg = s.background as
    | { type?: string; color?: unknown; image?: unknown }
    | undefined
  if (bg?.type === "image" && typeof bg.image === "string" && bg.image) {
    return `url(${JSON.stringify(bg.image)})`
  }
  if (bg?.type === "color" && typeof bg.color === "string") return bg.color
  return ink.raised
}

/* ------------------------------ layer list ---------------------------- */

function LayerList({
  layers,
  selectedId,
  device,
  locked,
  onSelect,
  onReorder,
  onToggleHidden,
  onToggleLock,
  onRemove,
  onRename,
}: {
  layers: SliderLayer[]
  selectedId: string | null
  device: Device
  locked: ReadonlySet<string>
  onSelect: (id: string) => void
  onReorder: (id: string, to: number) => void
  onToggleHidden: (id: string) => void
  onToggleLock: (id: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
}) {
  const dragId = useRef<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  /* Paint order is array order; "above" must read as above, so the list
     shows the array REVERSED — same convention as the 5B rail. */
  const rows = layers.map((l, i) => ({ l, i })).reverse()
  return (
    <div
      style={{
        height: BOTTOM_H,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: ink.base,
        borderTop: hairlineDark,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 28,
          padding: "0 12px",
          flexShrink: 0,
          borderBottom: hairlineDark,
          fontFamily: font,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: ink.muted,
        }}
      >
        Layers
        <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>
          ({layers.length})
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "14px 12px",
              fontFamily: font,
              fontSize: 12,
              color: ink.muted,
            }}
          >
            No layers yet — use “Add Layer”.
          </p>
        ) : null}
        {rows.map(({ l, i }) => {
          const selected = l.id === selectedId
          const isLocked = locked.has(l.id)
          const hiddenHere = device !== "desktop" && l.hidden?.[device] === true
          return (
            <div
              key={l.id}
              draggable={editing !== l.id}
              onDragStart={() => {
                dragId.current = l.id
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const id = dragId.current
                dragId.current = null
                if (id && id !== l.id) onReorder(id, i)
              }}
              onClick={() => onSelect(l.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 30,
                padding: "0 10px 0 6px",
                cursor: "pointer",
                background: selected ? accent.soft : "transparent",
                borderLeft: `2px solid ${selected ? accent.base : "transparent"}`,
                color: selected ? accent.base : ink.text,
                opacity: hiddenHere ? 0.5 : 1,
              }}
            >
              <span style={{ color: ink.muted, display: "inline-flex", cursor: "grab" }}>
                <UiIcon name="grip" size={12} />
              </span>
              <span style={{ display: "inline-flex", color: ink.muted }}>
                <UiIcon name={layerIcon(l.type)} size={12} />
              </span>
              {editing === l.id ? (
                <input
                  autoFocus
                  defaultValue={l.name ?? layerDisplayName(l)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    setEditing(null)
                    const v = e.target.value.trim()
                    if (v && v !== (l.name ?? "")) onRename(l.id, v)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                    if (e.key === "Escape") {
                      e.stopPropagation()
                      setEditing(null)
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 22,
                    padding: "0 6px",
                    border: `1px solid ${accent.base}`,
                    borderRadius: radius.sm,
                    background: ink.base,
                    color: ink.text,
                    fontFamily: font,
                    fontSize: 12,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setEditing(l.id)
                  }}
                  title="Double-click to rename"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: font,
                    fontSize: 12,
                    fontWeight: selected ? 600 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {layerDisplayName(l)}
                </span>
              )}
              <button
                type="button"
                title={
                  device === "desktop"
                    ? "Per-device visibility — switch to tablet or mobile"
                    : hiddenHere
                      ? `Show on ${device}`
                      : `Hide on ${device}`
                }
                disabled={device === "desktop"}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleHidden(l.id)
                }}
                style={{
                  ...iconBtn(hiddenHere),
                  width: 22,
                  height: 22,
                  opacity: device === "desktop" ? 0.35 : 1,
                  cursor: device === "desktop" ? "default" : "pointer",
                }}
              >
                <UiIcon name="eye" size={12} />
              </button>
              <button
                type="button"
                title={isLocked ? "Unlock layer" : "Lock layer (this session)"}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLock(l.id)
                }}
                style={{ ...iconBtn(isLocked), width: 22, height: 22 }}
              >
                <LockGlyph open={!isLocked} />
              </button>
              <button
                type="button"
                title="Delete layer"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(l.id)
                }}
                style={{ ...iconBtn(), width: 22, height: 22 }}
              >
                <UiIcon name="trash" size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function layerIcon(t: SliderLayerType): string {
  return t === "text"
    ? "text"
    : t === "image"
      ? "image"
      : t === "button"
        ? "button"
        : t === "icon"
          ? "icon"
          : "shape"
}

/* ------------------------------- the shell ---------------------------- */

export default function StageChrome({
  slides,
  activeSlide,
  fieldsCount,
  selectedLayerId,
  device,
  locked,
  slidesOpen,
  onToggleSlides,
  onDevice,
  onBack,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onRemoveSlide,
  onReorderSlides,
  onSelectLayer,
  onAddLayer,
  onReorderLayers,
  onToggleLayerHidden,
  onToggleLock,
  onRemoveLayer,
  onDuplicateLayer,
  onRenameLayer,
  sidebar,
}: {
  slides: LayeredSlide[]
  activeSlide: LayeredSlide | null
  fieldsCount: number
  selectedLayerId: string | null
  device: Device
  locked: ReadonlySet<string>
  slidesOpen: boolean
  onToggleSlides: () => void
  onDevice: (d: Device) => void
  onBack: () => void
  onSelectSlide: (id: string) => void
  onAddSlide: () => void
  onDuplicateSlide: (id: string) => void
  onRemoveSlide: (id: string) => void
  onReorderSlides: (id: string, to: number) => void
  onSelectLayer: (id: string | null) => void
  onAddLayer: (t: SliderLayerType) => void
  onReorderLayers: (id: string, to: number) => void
  onToggleLayerHidden: (id: string) => void
  onToggleLock: (id: string) => void
  onRemoveLayer: (id: string) => void
  onDuplicateLayer: (id: string) => void
  onRenameLayer: (id: string, name: string) => void
  /** The RE-HOUSED SchemaPanel — the very same per-layer / per-slide mount
   *  the dock renders, handed in by the shell so the stage's options are
   *  the product's real controls, not a stage-only reimplementation. */
  sidebar: React.ReactNode
}) {
  const layers = activeSlide?.layers ?? []
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null
  const selLocked = selectedLayer ? locked.has(selectedLayer.id) : false
  const selHidden =
    selectedLayer && device !== "desktop"
      ? selectedLayer.hidden?.[device] === true
      : false

  return (
    <>
      {/* Top toolbar — spans the full viewport width, above everything. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TOPBAR_H,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          background: ink.base,
          borderBottom: hairlineDark,
          zIndex: zLayer.shellPanel,
          fontFamily: font,
        }}
      >
        <button type="button" onClick={onBack} title="Leave the slide stage" style={barBtn()}>
          <UiIcon name="arrow-left" size={13} />
          Back
        </button>
        <button
          type="button"
          onClick={onToggleSlides}
          title="Show / hide the slide filmstrip"
          style={barBtn(slidesOpen)}
        >
          <UiIcon name="template" size={13} />
          Slides
          <span style={{ opacity: 0.7 }}>({slides.length})</span>
        </button>
        <AddLayerMenu onAdd={onAddLayer} />

        <span style={{ width: 1, height: 20, background: ink.hairline }} />

        {/* Selected layer + its actions. */}
        {selectedLayer ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            <span style={{ display: "inline-flex", color: accent.base }}>
              <UiIcon name={layerIcon(selectedLayer.type)} size={13} />
            </span>
            <span
              style={{
                ...type.label,
                fontFamily: font,
                color: ink.text,
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {layerDisplayName(selectedLayer)}
            </span>
            <button
              type="button"
              title="Duplicate layer (⌘D)"
              onClick={() => onDuplicateLayer(selectedLayer.id)}
              style={iconBtn()}
            >
              <UiIcon name="duplicate" size={13} />
            </button>
            <button
              type="button"
              title={
                device === "desktop"
                  ? "Per-device visibility — switch to tablet or mobile"
                  : selHidden
                    ? `Show on ${device}`
                    : `Hide on ${device}`
              }
              disabled={device === "desktop"}
              onClick={() => onToggleLayerHidden(selectedLayer.id)}
              style={{
                ...iconBtn(selHidden),
                opacity: device === "desktop" ? 0.35 : 1,
                cursor: device === "desktop" ? "default" : "pointer",
              }}
            >
              <UiIcon name="eye" size={13} />
            </button>
            <button
              type="button"
              title={selLocked ? "Unlock layer" : "Lock layer (this session)"}
              onClick={() => onToggleLock(selectedLayer.id)}
              style={iconBtn(selLocked)}
            >
              <LockGlyph open={!selLocked} size={13} />
            </button>
            <button
              type="button"
              title="Delete layer (Del)"
              onClick={() => onRemoveLayer(selectedLayer.id)}
              style={iconBtn()}
            >
              <UiIcon name="trash" size={13} />
            </button>
          </div>
        ) : (
          <span style={{ ...type.label, fontFamily: font, color: ink.muted }}>
            {activeSlide?.name || "Slide"} — no layer selected
          </span>
        )}

        {/* Device switch. Resizing the iframe is what makes the preview
            REAL: the slider's per-device frames and visibility are @media
            rules keyed on the viewport, so only a genuinely narrow canvas
            renders the mobile art direction. */}
        <div
          role="group"
          aria-label="Stage device"
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 2,
            padding: 2,
            background: ink.raised,
            border: hairlineDark,
            borderRadius: radius.md,
          }}
        >
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              title={`Edit ${d.label.toLowerCase()} frames`}
              aria-label={d.label}
              onClick={() => onDevice(d.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 24,
                border: 0,
                borderRadius: radius.sm,
                cursor: "pointer",
                background: device === d.id ? accent.base : "transparent",
                color: device === d.id ? accent.on : ink.muted,
                transition: `background ${motion.fast}, color ${motion.fast}`,
              }}
            >
              <UiIcon name={d.icon} size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Slide filmstrip — under the top bar, left of the sidebar. */}
      {slidesOpen ? (
        <div
          style={{
            position: "fixed",
            top: TOPBAR_H,
            left: 0,
            right: SIDEBAR_W,
            zIndex: zLayer.shellPanel,
          }}
        >
          <SlideStrip
            slides={slides}
            activeId={activeSlide?.id ?? null}
            fieldsCount={fieldsCount}
            onActivate={onSelectSlide}
            onAdd={onAddSlide}
            onDuplicate={onDuplicateSlide}
            onRemove={onRemoveSlide}
            onReorder={onReorderSlides}
          />
        </div>
      ) : null}

      {/* Bottom layer list. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: SIDEBAR_W,
          bottom: 0,
          zIndex: zLayer.shellPanel,
        }}
      >
        <LayerList
          layers={layers}
          selectedId={selectedLayerId}
          device={device}
          locked={locked}
          onSelect={onSelectLayer}
          onReorder={onReorderLayers}
          onToggleHidden={onToggleLayerHidden}
          onToggleLock={onToggleLock}
          onRemove={onRemoveLayer}
          onRename={onRenameLayer}
        />
      </div>

      {/* Right sidebar — LAYER OPTIONS. */}
      <aside
        style={{
          position: "fixed",
          top: TOPBAR_H,
          right: 0,
          bottom: 0,
          width: SIDEBAR_W,
          display: "flex",
          flexDirection: "column",
          background: ink.base,
          borderLeft: hairlineDark,
          zIndex: zLayer.shellPanel,
          fontFamily: font,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            height: 30,
            padding: "0 10px",
            flexShrink: 0,
            borderBottom: hairlineDark,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: ink.muted,
          }}
        >
          {selectedLayer ? "Layer Options" : "Slide Options"}
          {selectedLayer ? (
            <button
              type="button"
              title="Back to slide options"
              onClick={() => onSelectLayer(null)}
              style={{ ...iconBtn(), width: 20, height: 20 }}
            >
              <UiIcon name="arrow-left" size={11} />
            </button>
          ) : null}
        </div>
        {/* The re-housed SchemaPanel. It is a LIGHT surface by design (the
            product's panel), so it keeps its own background inside this
            dark frame rather than being restyled — but it must be FRAMED:
            the dock gives it padding and a column it fits in, and dropping
            it in raw let its controls run under the sidebar edge. */}
        <div
          data-cms-stage-sidebar="1"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            background: grey[0],
            padding: "12px 12px 24px",
            boxSizing: "border-box",
          }}
        >
          <style>{`
            [data-cms-stage-sidebar] input,
            [data-cms-stage-sidebar] textarea,
            [data-cms-stage-sidebar] select {
              max-width: 100%;
              box-sizing: border-box;
            }
            [data-cms-stage-sidebar] * { min-width: 0; }
          `}</style>
          {sidebar}
        </div>
      </aside>
    </>
  )
}
