"use client"

/* ------------------------------------------------------------------ */
/* Slider stage — right-panel vocabulary (Phase 5B, ARCH-SLIDER §3.1)   */
/*                                                                      */
/* Everything the SHELL needs to mount the existing SchemaPanel for a   */
/* selected slider layer or slide: per-layer-type Content field sets,   */
/* the Anim group (§4 — one entrance, a delay, a duration), Style tab   */
/* subsets carved from UNIVERSAL_STYLE (reuse, not re-invention), the   */
/* Frame group (anchor 9-dot picker + x/y/w/h with device overrides),   */
/* and the split helpers that turn one SchemaPanel onChange into the    */
/* right slider.* command(s).                                           */
/* ------------------------------------------------------------------ */

import React from "react"
import type { Device, FieldDef } from "@modules/cms/schema/types"
import { resolveResponsive } from "@modules/cms/schema/types"
import { UNIVERSAL_STYLE } from "@modules/cms/schema/universal/style"
import { UNIVERSAL_ADVANCED } from "@modules/cms/schema/universal/advanced"
import {
  accent,
  font,
  grey,
  radius,
  type,
} from "@modules/cms/editor/design"
import type {
  LayerFrame,
  LayeredSlide,
  SlideBackground,
  SliderAnchor,
  SliderLayer,
  SliderLayerType,
} from "./model-5a"

/* ----------------------- Content fields per type ---------------------- */

export const LAYER_CONTENT_FIELDS: Record<SliderLayerType, FieldDef[]> = {
  text: [
    {
      name: "html",
      type: "textarea",
      label: "Text",
      help: "Inline HTML allowed (b, i, br, span) — sanitized on render.",
    },
    {
      name: "tag",
      type: "select",
      label: "Tag",
      default: "p",
      options: ["h1", "h2", "h3", "h4", "h5", "h6", "p"].map((v) => ({
        label: v.toUpperCase(),
        value: v,
      })),
    },
  ],
  image: [
    { name: "src", type: "image", label: "Image" },
    { name: "alt", type: "text", label: "Alt text" },
    { name: "href", type: "link", label: "Link" },
  ],
  button: [
    { name: "label", type: "text", label: "Label", default: "Shop now" },
    { name: "href", type: "link", label: "Link", default: "/store" },
    {
      name: "variant",
      type: "choose",
      label: "Variant",
      default: "solid",
      options: [
        { label: "Solid", value: "solid", icon: "Square" },
        { label: "Outline", value: "outline", icon: "SquareDashed" },
      ],
    },
  ],
  shape: [{ name: "href", type: "link", label: "Link" }],
  icon: [
    { name: "icon", type: "icon", label: "Icon", default: "fas fa-star" },
    {
      name: "size",
      type: "range",
      label: "Size",
      min: 8,
      max: 160,
      step: 1,
      unit: "px",
      default: 32,
    },
  ],
}

/* ------------------------------ Anim group ---------------------------- */

/** §4: entrance presets only, and that is final. Rendered as a Content
 *  group — the panel's values live on layer.anim (splitLayerEdit routes
 *  them to slider.setLayerAnim, never into props). */
export const LAYER_ANIM_FIELDS: FieldDef[] = [
  {
    name: "preset",
    type: "select",
    label: "Entrance",
    group: "Animation",
    default: "none",
    options: [
      { label: "None", value: "none" },
      { label: "Fade", value: "fade" },
      { label: "Slide up", value: "slide-up" },
      { label: "Slide down", value: "slide-down" },
      { label: "Slide left", value: "slide-left" },
      { label: "Slide right", value: "slide-right" },
      { label: "Zoom in", value: "zoom-in" },
      { label: "Zoom out", value: "zoom-out" },
    ],
  },
  {
    name: "delay_ms",
    type: "range",
    label: "Delay",
    group: "Animation",
    min: 0,
    max: 4000,
    step: 50,
    unit: "ms",
    default: 0,
  },
  {
    name: "duration_ms",
    type: "range",
    label: "Duration",
    group: "Animation",
    min: 100,
    max: 3000,
    step: 50,
    unit: "ms",
    default: 600,
  },
  {
    name: "ease",
    type: "select",
    label: "Easing",
    group: "Animation",
    default: "ease-out",
    options: [
      { label: "Ease out", value: "ease-out" },
      { label: "Ease in-out", value: "ease-in-out" },
      { label: "Spring", value: "spring" },
    ],
  },
]

const ANIM_KEYS = new Set(LAYER_ANIM_FIELDS.map((f) => f.name))

/* --------------------- Style/Advanced tab subsets --------------------- */

const pickStyle = (names: string[]): FieldDef[] =>
  UNIVERSAL_STYLE.filter((f) => names.includes(f.name))

/** UNIVERSAL_STYLE subsets per layer type (ARCH-SLIDER §3.1) — same
 *  controls, same bag serialization; only what is OFFERED differs. */
export const LAYER_STYLE_FIELDS: Record<SliderLayerType, FieldDef[]> = {
  text: pickStyle([
    "typography",
    "align",
    "color",
    "background",
    "padding",
    "borderRadius",
    "boxShadow",
  ]),
  button: pickStyle([
    "typography",
    "color",
    "background",
    "border",
    "borderRadius",
    "boxShadow",
    "padding",
  ]),
  image: pickStyle(["border", "borderRadius", "boxShadow"]),
  shape: pickStyle(["background", "border", "borderRadius", "boxShadow"]),
  icon: pickStyle([
    "color",
    "background",
    "padding",
    "borderRadius",
    "boxShadow",
  ]),
}

/** Advanced: the §1.3 zIndex escape hatch + custom CSS only. */
export const LAYER_ADVANCED_FIELDS: FieldDef[] = UNIVERSAL_ADVANCED.filter(
  (f) => f.name === "zIndex" || f.name === "customCss"
)

/* -------------------------- edit splitting ---------------------------- */

/** Panel props for a layer: content props + anim flattened together (no
 *  key collisions by construction — see ANIM_KEYS vs the type fields). */
export function layerPanelProps(layer: SliderLayer): Record<string, unknown> {
  return { ...layer.props, ...(layer.anim ?? {}) }
}

/**
 * One SchemaPanel onChange → the right command payload(s): anim-group
 * keys peel off into an `anim` object, everything else is layer.props.
 */
export function splitLayerEdit(next: Record<string, unknown>): {
  props: Record<string, unknown>
  anim: Record<string, unknown>
} {
  const props: Record<string, unknown> = {}
  const anim: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(next)) {
    if (ANIM_KEYS.has(k)) anim[k] = v
    else props[k] = v
  }
  return { props, anim }
}

/* --------------------------- Slide panel ------------------------------ */

export const SLIDE_CONTENT_FIELDS: FieldDef[] = [
  { name: "name", type: "text", label: "Slide name", help: "Filmstrip label." },
  {
    name: "duration_ms",
    type: "range",
    label: "Slide duration",
    min: 0,
    max: 15000,
    step: 500,
    unit: "ms",
    default: 0,
    help: "Autoplay override for this slide. 0 uses the slider's speed.",
  },
  { name: "link", type: "link", label: "Slide link", help: "Whole-slide click-through (layers on top win)." },
  {
    name: "bg_type",
    type: "choose",
    label: "Background",
    group: "Background",
    default: "color",
    options: [
      { label: "Color", value: "color", icon: "Palette" },
      { label: "Image", value: "image", icon: "Image" },
      { label: "Video", value: "video", icon: "Video" },
    ],
  },
  { name: "bg_color", type: "color", label: "Color", group: "Background" },
  { name: "bg_image", type: "image", label: "Image", group: "Background" },
  {
    name: "bg_video",
    type: "url",
    label: "Video (.mp4)",
    group: "Background",
    help: "Direct self-hosted .mp4 only — muted, looping, autoplaying.",
  },
  {
    name: "bg_fit",
    type: "choose",
    label: "Fit",
    group: "Background",
    default: "cover",
    options: [
      { label: "Cover", value: "cover", icon: "Maximize" },
      { label: "Contain", value: "contain", icon: "Minimize" },
    ],
  },
  {
    name: "overlay_color",
    type: "color",
    label: "Overlay color",
    group: "Background",
    help: "Scrim over the background so text stays readable.",
  },
  {
    name: "overlay_opacity",
    type: "range",
    label: "Overlay opacity",
    group: "Background",
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    default: 0,
  },
]

/** Slide → flat panel props (background unpacked). */
export function slidePanelProps(slide: LayeredSlide): Record<string, unknown> {
  const bg = slide.background ?? { type: "color" }
  const overlay =
    bg.overlay && "color" in bg.overlay ? bg.overlay : undefined
  return {
    name: slide.name ?? "",
    duration_ms: slide.duration_ms ?? 0,
    link: slide.link ?? "",
    bg_type: bg.type ?? "color",
    bg_color: typeof bg.color === "string" ? bg.color : "",
    bg_image: bg.image ?? "",
    bg_video: bg.video ?? "",
    bg_fit: bg.fit ?? "cover",
    overlay_color: overlay?.color ?? "",
    overlay_opacity: overlay ? Math.round((overlay.opacity ?? 0) * 100) : 0,
  }
}

/** Flat panel props → the two command payloads (slide scalars + the
 *  reassembled background object). */
export function assembleSlideEdit(next: Record<string, unknown>): {
  props: { name?: string; duration_ms?: number; link?: string }
  background: SlideBackground
} {
  const t = String(next.bg_type ?? "color")
  const background: SlideBackground = {
    type: t === "image" || t === "video" ? (t as "image" | "video") : "color",
  }
  if (typeof next.bg_color === "string" && next.bg_color) {
    background.color = next.bg_color
  }
  if (typeof next.bg_image === "string" && next.bg_image) {
    background.image = next.bg_image
  }
  if (typeof next.bg_video === "string" && next.bg_video) {
    background.video = next.bg_video
  }
  const fit = next.bg_fit
  if (fit === "contain") background.fit = "contain"
  const oc = typeof next.overlay_color === "string" ? next.overlay_color : ""
  const oo = Number(next.overlay_opacity) || 0
  if (oc && oo > 0) {
    background.overlay = { color: oc, opacity: Math.min(1, oo / 100) }
  }
  return {
    props: {
      name: typeof next.name === "string" ? next.name : "",
      duration_ms: Number(next.duration_ms) || 0,
      link: typeof next.link === "string" ? next.link : "",
    },
    background,
  }
}

/* --------------------------- FrameControls ---------------------------- */

const ANCHOR_GRID: SliderAnchor[][] = [
  ["tl", "tc", "tr"],
  ["cl", "cc", "cr"],
  ["bl", "bc", "br"],
]

const lbl: React.CSSProperties = {
  ...type.micro,
  fontFamily: font,
  display: "block",
  color: grey[50],
  margin: "10px 0 4px",
}

const numInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  font: `500 12px/1.2 ${font}`,
  color: grey[80],
  background: grey[0],
  border: `1px solid ${grey[20]}`,
  borderRadius: radius.sm,
}

/**
 * The Frame group (ARCH-SLIDER §3.1): anchor 9-dot picker + x/y/w/h
 * numerics editing ONE responsive leaf. Desktop writes `frame.base`;
 * tablet/mobile write the override slot, visibly badged with a
 * clear-override affordance — mirroring the responsive style bags.
 * Mounted through SchemaPanel's `contentExtra`, so the panel itself is
 * reused untouched.
 */
export function FrameControls({
  frame,
  device,
  onCommit,
}: {
  frame: SliderLayer["frame"]
  device: Device
  onCommit: (device: Device, next: LayerFrame | null) => void
}) {
  const resolved = resolveResponsive<LayerFrame>(frame, device)
  const cur: LayerFrame =
    resolved ?? ({ anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" } as LayerFrame)
  const hasOverride =
    device !== "desktop" &&
    !!(frame as Record<string, unknown>)?.[device]

  const write = (patch: Partial<LayerFrame>) =>
    onCommit(device, { ...cur, ...patch })

  const dim = (key: "w" | "h") => {
    const v = cur[key]
    const isAuto = v === "auto"
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={lbl}>{key.toUpperCase()} %</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            step={0.5}
            disabled={isAuto}
            value={isAuto ? "" : Number(v)}
            placeholder="auto"
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              if (Number.isFinite(n)) write({ [key]: n } as Partial<LayerFrame>)
            }}
            style={{ ...numInput, opacity: isAuto ? 0.55 : 1 }}
          />
          <button
            type="button"
            title={isAuto ? "Set an explicit size" : "Size to content"}
            onClick={() =>
              write({ [key]: isAuto ? 20 : "auto" } as Partial<LayerFrame>)
            }
            style={{
              padding: "5px 7px",
              font: `600 10px/1 ${font}`,
              color: isAuto ? accent.base : grey[50],
              background: isAuto ? accent.soft : grey[5],
              border: `1px solid ${isAuto ? accent.base : grey[20]}`,
              borderRadius: radius.sm,
              cursor: "pointer",
            }}
          >
            auto
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          ...type.micro,
          fontFamily: font,
          color: grey[60],
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        Frame
        {hasOverride ? (
          <span
            style={{
              padding: "2px 6px",
              font: `600 10px/1 ${font}`,
              color: accent.base,
              background: accent.soft,
              borderRadius: radius.sm,
            }}
          >
            {device} override
          </span>
        ) : null}
        {hasOverride ? (
          <button
            type="button"
            onClick={() => onCommit(device, null)}
            style={{
              marginLeft: "auto",
              padding: "2px 6px",
              font: `500 10px/1 ${font}`,
              color: grey[50],
              background: "transparent",
              border: `1px solid ${grey[20]}`,
              borderRadius: radius.sm,
              cursor: "pointer",
            }}
          >
            Clear override
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        <div>
          <span style={{ ...lbl, margin: "0 0 4px" }}>Anchor</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 16px)",
              gap: 3,
              padding: 6,
              background: grey[5],
              border: `1px solid ${grey[20]}`,
              borderRadius: radius.sm,
              width: "fit-content",
            }}
          >
            {ANCHOR_GRID.flat().map((a) => (
              <button
                key={a}
                type="button"
                title={`Anchor ${a}`}
                onClick={() => write({ anchor: a })}
                style={{
                  width: 16,
                  height: 16,
                  padding: 0,
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  background: cur.anchor === a ? accent.base : grey[20],
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px" }}>
          <div>
            <span style={lbl}>X %</span>
            <input
              type="number"
              step={0.5}
              value={cur.x}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (Number.isFinite(n)) write({ x: n })
              }}
              style={numInput}
            />
          </div>
          <div>
            <span style={lbl}>Y %</span>
            <input
              type="number"
              step={0.5}
              value={cur.y}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (Number.isFinite(n)) write({ y: n })
              }}
              style={numInput}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        {dim("w")}
        {dim("h")}
      </div>
      <p style={{ ...type.label, fontFamily: font, color: grey[40], margin: "8px 0 0" }}>
        Offsets are % of the slide, measured inward from the anchored edge.
      </p>
    </div>
  )
}
