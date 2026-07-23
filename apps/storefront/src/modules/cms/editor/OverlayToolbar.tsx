"use client"

/**
 * OverlayToolbar — THE node toolbar.
 *
 * One primitive for every floating chip of controls the canvas draws over a
 * node: the section toolbar, the widget chip, a future column toolbar, and
 * any context affordance that is "a row of small actions on a dark chip".
 * Before this existed the canvas hand-built three visually different
 * toolbars (section at 30px, widget at 26px, ad-hoc chips in between); this
 * component is the guard against a fourth. Which ACTIONS render is the
 * caller's business — the metrics never are. Everything visual comes from
 * `overlay.toolbar` in design.ts; there are no size/height/radius props on
 * purpose.
 *
 * Item kinds:
 *   - action     an icon (or wide text) button: { icon | label, title,
 *                onSelect, danger?, disabled? }
 *   - drag       the drag-handle affordance: grab cursor, native draggable,
 *                caller supplies onDragStart (payload + ghost)
 *   - separator  a hairline gap between groups
 *
 * Positioning: pass the node's viewport rect (`anchor`) and a `placement`;
 * the toolbar renders `position: fixed` and clamps itself on-screen. Every
 * instance is editor chrome: `data-cms-overlay="1"` is load-bearing (the
 * canvas hover logic bails on overlays so travelling to a button does not
 * clear the hover that produced it) and it can never reach the published
 * page.
 */

import React, { useState } from "react"
import {
  font,
  type,
  overlay,
  semantic,
  zLayer,
} from "./design"
import { UiIcon } from "./palette-icons"

/* ------------------------------ types ------------------------------ */

export interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
}

export type OverlayToolbarPlacement =
  /** Straddling the anchor's top edge, horizontally aligned. */
  | "top-start"
  | "top-center"
  | "top-end"
  /** Just INSIDE the anchor's top edge (the section-toolbar stance). */
  | "inside-top-center"
  /** Straddling the anchor's bottom edge. */
  | "bottom-center"
  /** Hugging the anchor's left edge, vertically centered (vertical rails). */
  | "left-center"

export type OverlayToolbarItem =
  | {
      kind?: "action"
      /** UiIcon name. Omit when `label` carries the button (e.g. "Edit"). */
      icon?: string
      /** Wide text button instead of a square icon button. */
      label?: string
      title: string
      onSelect: () => void
      danger?: boolean
      disabled?: boolean
    }
  | {
      kind: "drag"
      title: string
      /** Defaults to the grip glyph. */
      icon?: string
      onDragStart: (e: React.DragEvent<HTMLElement>) => void
      onDragEnd?: (e: React.DragEvent<HTMLElement>) => void
    }
  | { kind: "separator" }

export interface OverlayToolbarProps {
  items: OverlayToolbarItem[]
  /** Row (default) or column of controls. Metrics are identical. */
  orientation?: "horizontal" | "vertical"
  /** The annotated node's viewport rect. */
  anchor: OverlayRect
  placement?: OverlayToolbarPlacement
  /** Extra px between the anchor edge and the toolbar. */
  offset?: number
  /** Stacking level. Defaults to zLayer.canvasToolbar; pass another zLayer
      token when a toolbar must ride a different layer — never a literal. */
  z?: number
  /** Minimum viewport top, so a toolbar on the first section never slides
      under the shell's top bar. */
  clampTop?: number
}

/* --------------------------- placement math -------------------------- */

const EDGE = 6 // px the toolbar always keeps from the viewport edge

function position(
  anchor: OverlayRect,
  placement: OverlayToolbarPlacement,
  offset: number,
  clampTop: number
): React.CSSProperties {
  const right = anchor.left + anchor.width
  const midX = anchor.left + anchor.width / 2
  const midY = anchor.top + anchor.height / 2
  switch (placement) {
    case "top-start":
      return {
        top: Math.max(clampTop, anchor.top - offset),
        left: Math.max(EDGE, anchor.left),
        transform: "translateY(-50%)",
      }
    case "top-end":
      return {
        top: Math.max(clampTop, anchor.top - offset),
        left: Math.max(EDGE + 90, right - 2),
        transform: "translate(-100%, -50%)",
      }
    case "inside-top-center":
      return {
        top: Math.max(clampTop, anchor.top + offset),
        left: midX,
        transform: "translateX(-50%)",
      }
    case "bottom-center":
      return {
        top: anchor.top + anchor.height + offset,
        left: midX,
        transform: "translate(-50%, -50%)",
      }
    case "left-center":
      return {
        top: Math.max(clampTop, midY),
        left: Math.max(EDGE, anchor.left - offset),
        transform: "translate(-100%, -50%)",
      }
    case "top-center":
    default:
      return {
        top: Math.max(clampTop, anchor.top - offset),
        left: midX,
        transform: "translate(-50%, -50%)",
      }
  }
}

/* ------------------------------ buttons ------------------------------ */

function ToolbarButton({
  item,
}: {
  item: Extract<OverlayToolbarItem, { onSelect: () => void }>
}) {
  const [hot, setHot] = useState(false)
  const wide = item.label != null
  const restColor = item.danger ? semantic.dangerBorder : overlay.ink.muted
  const hotColor = item.danger ? semantic.dangerBg : overlay.ink.fg
  return (
    <button
      type="button"
      title={item.title}
      aria-label={item.title}
      disabled={item.disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        item.onSelect()
      }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        ...type.label,
        fontFamily: font,
        minWidth: wide ? undefined : overlay.toolbar.btn.size,
        height: overlay.toolbar.btn.size,
        padding: wide ? "0 8px" : 0,
        border: 0,
        borderRadius: overlay.toolbar.btn.radius,
        background: "transparent",
        color: hot && !item.disabled ? hotColor : restColor,
        cursor: item.disabled ? "default" : "pointer",
        opacity: item.disabled ? 0.35 : 1,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        transition: `color ${overlay.motion.show}`,
      }}
    >
      {item.icon ? (
        <UiIcon name={item.icon} size={overlay.toolbar.btn.icon} />
      ) : null}
      {item.label}
    </button>
  )
}

function DragHandle({
  item,
}: {
  item: Extract<OverlayToolbarItem, { kind: "drag" }>
}) {
  return (
    <span
      draggable
      title={item.title}
      aria-label={item.title}
      onDragStart={item.onDragStart}
      onDragEnd={item.onDragEnd}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: overlay.toolbar.btn.size,
        height: overlay.toolbar.btn.size,
        borderRadius: overlay.toolbar.btn.radius,
        color: overlay.ink.muted,
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <UiIcon name={item.icon ?? "grip"} size={overlay.toolbar.btn.icon} />
    </span>
  )
}

/* ------------------------------ toolbar ------------------------------ */

export default function OverlayToolbar({
  items,
  orientation = "horizontal",
  anchor,
  placement = "top-center",
  offset = 0,
  z = zLayer.canvasToolbar,
  clampTop = 2,
}: OverlayToolbarProps) {
  const vertical = orientation === "vertical"
  return (
    <div
      data-cms-overlay="1"
      role="toolbar"
      aria-orientation={orientation}
      style={{
        position: "fixed",
        ...position(anchor, placement, offset, clampTop),
        zIndex: z,
        display: "inline-flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
        gap: overlay.toolbar.gap,
        height: vertical ? undefined : overlay.toolbar.height,
        width: vertical ? overlay.toolbar.height : undefined,
        padding: vertical ? "4px 0" : overlay.toolbar.padding,
        borderRadius: overlay.toolbar.radius,
        background: overlay.toolbar.bg,
        boxShadow: overlay.toolbar.shadow,
        pointerEvents: "auto",
        whiteSpace: "nowrap",
        fontFamily: font,
      }}
    >
      {items.map((item, i) => {
        if (item.kind === "separator") {
          return (
            <span
              key={`sep-${i}`}
              aria-hidden="true"
              style={{
                alignSelf: "stretch",
                width: vertical ? undefined : 1,
                height: vertical ? 1 : undefined,
                margin: vertical ? "2px 4px" : "4px 2px",
                background: "rgba(255,255,255,0.14)",
              }}
            />
          )
        }
        if (item.kind === "drag") {
          return <DragHandle key={`drag-${i}`} item={item} />
        }
        return <ToolbarButton key={`${item.title}-${i}`} item={item} />
      })}
    </div>
  )
}
