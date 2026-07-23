"use client"

/* ------------------------------------------------------------------ */
/* Slider stage — layer rail (Phase 5B, ARCH-SLIDER §3.1)               */
/*                                                                      */
/* The left rail while staged (the NavigatorTree's slot): the active    */
/* slide's layers TOP-FIRST (array order = paint order, reversed for    */
/* display so "above" reads as above), drag-to-restack, per-device eye, */
/* session lock, rename, delete — plus the five-type "Add layer" row    */
/* (new layers drop at slide center, §3.1).                             */
/* ------------------------------------------------------------------ */

import React, { useRef, useState } from "react"
import type { Device } from "@modules/cms/schema/types"
import {
  accent,
  font,
  ink,
  radius,
  shadow,
} from "@modules/cms/editor/design"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import { layerDisplayName, type SliderLayer, type SliderLayerType } from "./model-5a"
import { FILMSTRIP_H } from "./Filmstrip"

export const RAIL_W = 224

/** The stage's own device set (RevSlider's editor-view switch). */
const STAGE_DEVICES: { id: Device; label: string; icon: "monitor" | "tablet" | "phone" }[] = [
  { id: "desktop", label: "Desktop", icon: "monitor" },
  { id: "tablet", label: "Tablet", icon: "tablet" },
  { id: "mobile", label: "Mobile", icon: "phone" },
]

const LAYER_TYPES: { type: SliderLayerType; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "text" },
  { type: "image", label: "Image", icon: "image" },
  { type: "button", label: "Button", icon: "button" },
  // "shape" has no registered glyph — UiIcon's plain-square fallback IS the
  // right drawing for a shape layer, so the miss is deliberate.
  { type: "shape", label: "Shape", icon: "shape" },
  { type: "icon", label: "Icon", icon: "icon" },
]

/** Tiny inline lock glyph — palette-icons has none, and the fallback
 *  square would read as "shape". Stroke style matches UiIcon's. */
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

export default function LayerRail({
  layers,
  selectedId,
  device,
  locked,
  onSelect,
  onAdd,
  onReorder,
  onToggleHidden,
  onDeviceChange,
  onSetHidden,
  onToggleLock,
  onRename,
  onRemove,
}: {
  /** Model order (bottom → top); the rail renders it reversed. */
  layers: SliderLayer[]
  selectedId: string | null
  device: Device
  /** Editor-session lock set (never persisted — a stage convenience). */
  locked: ReadonlySet<string>
  onSelect: (layerId: string | null) => void
  onAdd: (type: SliderLayerType) => void
  /** to = MODEL index (bottom → top). */
  onReorder: (layerId: string, to: number) => void
  onToggleHidden: (layerId: string) => void
  /** Stage-internal responsive switch (RevSlider's editor-view devices). */
  onDeviceChange?: (device: Device) => void
  /** Explicit per-device visibility for one layer (desktop always shows). */
  onSetHidden?: (layerId: string, device: "tablet" | "mobile", hidden: boolean) => void
  onToggleLock: (layerId: string) => void
  onRename: (layerId: string, name: string) => void
  onRemove: (layerId: string) => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)

  const top = [...layers].reverse()
  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null

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
        top: FILMSTRIP_H,
        left: 0,
        bottom: 0,
        width: RAIL_W,
        display: "flex",
        flexDirection: "column",
        background: ink.base,
        boxShadow: shadow.chip,
        fontFamily: font,
        boxSizing: "border-box",
      }}
    >
      {onDeviceChange ? (
        <div style={{ padding: "12px 12px 4px" }}>
          <div style={{ font: `600 11px/1 ${font}`, color: ink.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>
            Responsive
          </div>
          <div
            role="group"
            aria-label="Stage device"
            style={{
              display: "flex",
              gap: 2,
              marginTop: 8,
              padding: 2,
              background: ink.raised,
              borderRadius: radius.md,
            }}
          >
            {STAGE_DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                title={`Edit ${d.label} frames`}
                aria-pressed={device === d.id}
                onClick={() => onDeviceChange(d.id)}
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  height: 26,
                  border: 0,
                  borderRadius: radius.sm,
                  cursor: "pointer",
                  font: `600 10px/1 ${font}`,
                  background: device === d.id ? accent.base : "transparent",
                  color: device === d.id ? "#fff" : ink.muted,
                }}
              >
                <UiIcon name={d.icon} size={13} />
                {d.label}
              </button>
            ))}
          </div>
          <div style={{ font: `500 10px/1.5 ${font}`, color: ink.muted, marginTop: 6 }}>
            Positions are saved per device.
          </div>
          {/* Per-device visibility for the SELECTED layer (RevSlider's
              Visibility panel). Desktop always shows — the model stores
              hides for tablet/mobile only. */}
          {onSetHidden && selectedLayer ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ font: `600 10px/1 ${font}`, color: ink.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>
                Show “{layerDisplayName(selectedLayer)}” on
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {STAGE_DEVICES.map((d) => {
                  const isDesktop = d.id === "desktop"
                  const on = isDesktop
                    ? true
                    : selectedLayer.hidden?.[d.id as "tablet" | "mobile"] !== true
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={isDesktop}
                      title={
                        isDesktop
                          ? "Layers always show on desktop"
                          : on
                            ? `Hide on ${d.label.toLowerCase()}`
                            : `Show on ${d.label.toLowerCase()}`
                      }
                      onClick={() =>
                        onSetHidden(
                          selectedLayer.id,
                          d.id as "tablet" | "mobile",
                          on
                        )
                      }
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        height: 24,
                        border: 0,
                        borderRadius: radius.sm,
                        cursor: isDesktop ? "default" : "pointer",
                        font: `600 9px/1 ${font}`,
                        opacity: isDesktop ? 0.55 : 1,
                        background: on ? accent.base : ink.raised,
                        color: on ? "#fff" : ink.muted,
                      }}
                    >
                      <UiIcon name={d.icon} size={12} />
                      {on ? "ON" : "OFF"}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ padding: "12px 12px 8px" }}>
        <div style={{ font: `600 11px/1 ${font}`, color: ink.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>
          Add layer
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {LAYER_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              title={`Add ${t.label} layer`}
              onClick={() => onAdd(t.type)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "7px 0 5px",
                font: `500 9px/1 ${font}`,
                color: ink.text,
                background: accent.base,
                border: "none",
                borderRadius: radius.sm,
                cursor: "pointer",
              }}
            >
              <UiIcon name={t.icon} size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ font: `600 11px/1 ${font}`, color: ink.muted, letterSpacing: 0.4, textTransform: "uppercase", padding: "8px 12px 6px" }}>
        Layers
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
        {top.length === 0 ? (
          <p style={{ font: `400 11px/1.5 ${font}`, color: ink.muted, padding: "4px 6px" }}>
            No layers yet. Add one above — it drops at the slide center.
          </p>
        ) : null}
        {top.map((l) => {
          const selected = l.id === selectedId
          const isLocked = locked.has(l.id)
          const hiddenHere =
            device !== "desktop" && l.hidden?.[device] === true
          const modelIndex = layers.findIndex((x) => x.id === l.id)
          return (
            <div
              key={l.id}
              draggable={renaming !== l.id}
              onDragStart={(e) => {
                setDragId(l.id)
                e.dataTransfer.effectAllowed = "move"
                try {
                  e.dataTransfer.setData("text/plain", l.id)
                } catch {
                  /* older engines */
                }
              }}
              onDragEnd={() => {
                setDragId(null)
                setDragOver(null)
              }}
              onDragOver={(e) => {
                if (!dragId || dragId === l.id) return
                e.preventDefault()
                setDragOver(l.id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId && dragId !== l.id) onReorder(dragId, modelIndex)
                setDragId(null)
                setDragOver(null)
              }}
              onClick={() => onSelect(l.id)}
              onDoubleClick={() => setRenaming(l.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 6px",
                marginBottom: 2,
                borderRadius: radius.sm,
                cursor: "pointer",
                background: selected ? ink.raised : "transparent",
                outline: selected
                  ? `1px solid ${accent.base}`
                  : dragOver === l.id
                    ? `1px dashed ${accent.base}`
                    : "none",
                opacity: dragId === l.id ? 0.5 : hiddenHere ? 0.55 : 1,
              }}
            >
              <span style={{ color: ink.muted, display: "inline-flex", flexShrink: 0 }}>
                <UiIcon
                  name={
                    LAYER_TYPES.find((t) => t.type === l.type)?.icon ?? "square"
                  }
                  size={12}
                />
              </span>
              {renaming === l.id ? (
                <input
                  ref={renameRef}
                  autoFocus
                  defaultValue={l.name ?? ""}
                  placeholder={layerDisplayName(l)}
                  onBlur={() => commitRename(l.id)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === "Enter") commitRename(l.id)
                    if (e.key === "Escape") setRenaming(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "2px 4px",
                    font: `500 11px/1.3 ${font}`,
                    color: ink.text,
                    background: ink.base,
                    border: `1px solid ${accent.base}`,
                    borderRadius: radius.sm,
                    outline: "none",
                  }}
                />
              ) : (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    font: `500 11px/1.3 ${font}`,
                    color: selected ? ink.text : ink.muted,
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
                    ? "Layers always show on desktop — switch device to hide per device"
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
                  ...railBtn,
                  opacity: device === "desktop" ? 0.35 : 1,
                  color: hiddenHere ? accent.base : ink.muted,
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
                style={{ ...railBtn, color: isLocked ? accent.base : ink.muted }}
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
                style={railBtn}
              >
                <UiIcon name="x" size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const railBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  padding: 0,
  flexShrink: 0,
  color: "inherit",
  background: "transparent",
  border: "none",
  cursor: "pointer",
}
