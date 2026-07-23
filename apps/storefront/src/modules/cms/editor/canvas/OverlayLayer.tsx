"use client"

/* ------------------------------------------------------------------ */
/* OverlayLayer (CANVAS P1 — parity).                                   */
/*                                                                     */
/* EVERY fixed-position editor affordance the canvas paints over the    */
/* page, extracted verbatim from the canvas monolith into one component */
/* rendering from one props bag: selection/hover-derived boxes          */
/* (activeRect, widgetBox, elBadge, fontPill), geometry-derived pills   */
/* (emptyCols, hoverColBox, hiddenBadges), the resolved drop target's   */
/* outline/chip, the in-canvas widget picker and the right-click menu.  */
/* Positions, z-indexes, handlers and gating are IDENTICAL to the       */
/* monolith's originals — this commit moves code, it does not change    */
/* behavior.                                                            */
/*                                                                     */
/* The in-flow add affordances (SectionInsertBar between sections,      */
/* AddSectionZone at the bottom) live in this file too so the canvas    */
/* monolith only shrinks — but they are NOT part of <OverlayLayer/>:    */
/* they occupy places in the page flow and stay mounted there.          */
/* ------------------------------------------------------------------ */

import React, { useLayoutEffect, useRef, useState } from "react"

import {
  accent,
  button,
  canvas as canvasTokens,
  chip,
  eyebrow,
  font,
  grey,
  hairline,
  ink,
  menuItem,
  motion,
  radius,
  semantic,
  shadow,
  surface,
  type,
  zLayer,
} from "@modules/cms/editor/design"
import { PaletteIcon, UiIcon } from "@modules/cms/editor/palette-icons"
import { facadeOf } from "@modules/cms/document/facade"
import { listWidgetSchemas } from "@modules/cms/schema/widgets"
import type { Device } from "@modules/cms/schema/types"

import {
  BLOCK_MIME,
  WIDGET_MIME,
  postCommandToShell,
  postToShell,
  type CmsSection,
} from "./protocol"
/* --- 3A drop placeholder --- */
import type { DropTarget } from "./dnd"
/* --- end 3A drop placeholder --- */

/* --- 3F AI surface --- */
import AiPromptBox from "@modules/cms/editor/AiPromptBox"
import { aiEligible } from "@modules/cms/editor/ai/chips"
import { openAiBox } from "@modules/cms/editor/ai/events"
import type { AiOverlayContext } from "@modules/cms/editor/ai/targets"
import type { NodeRef } from "./protocol"
/* --- end 3F AI surface --- */

/* ---------------- shared state shapes (one definition, both files) --- */

export type CtxMenuState = {
  x: number
  y: number
  index: number
  scope: "section" | "widget" | "element" | "chrome" | "chromeElement"
  label: string
  path?: number[]
  elementKey?: string
  region?: string
  /** Repeated-item context (slide / tile / testimonial under the cursor). */
  itemField?: string
  itemIndex?: number
  itemLabel?: string
}

export type ClipState = {
  hasSection: boolean
  hasWidget: boolean
  hasStyle: boolean
}

export type PickerState = {
  index: number
  colPath: number[]
  wi: number
  x: number
  y: number
}

/* --- 3A drop placeholder ---------------------------------------------
   DropLineState / DropColState (the 2px indicator states) are deleted
   (ARCH-CANVAS §5.3): the gap-opening in-flow placeholder lives in
   ./dnd (DropPlaceholder); the overlay renders only the target's
   naming/outline from the ONE resolved DropTarget below. */
/* --- end 3A drop placeholder --- */

export type ElBadgeState = { top: number; right: number; sel: boolean }
export type FontPillState = { top: number; left: number; px: number }

// Owner-facing names for the on-canvas hover label.
export const SECTION_LABELS: Record<string, string> = {
  hero_slider: "Hero Slider",
  promo_banner_grid: "Promo Banner Grid",
  product_tabs: "Product Tabs",
  deal_of_day: "Deal of the Day",
  category_showcase: "Category Showcase",
  brand_strip: "Brand Strip",
  rich_text: "Rich Text",
  image_with_text: "Image With Text",
  newsletter: "Newsletter",
  instagram_grid: "Instagram Grid",
  testimonials: "Testimonials",
  image_gallery: "Image Gallery",
  container: "Container / Columns",
}

/** Facade-aware on-canvas name (Phase 1, ARCH-CORE §1.4): a flush single-
 *  commerce-widget container — normalizeDocument's wrapper — reads as its
 *  inner block ("Hero Slider"), never "Container / Columns". Labels ONLY:
 *  the wrapper stays a container, so every container affordance (column
 *  add-widget pills, widget toolbars, structure controls) still applies.
 *  Non-facades keep this file's SECTION_LABELS spellings exactly. */
function sectionDisplayLabel(block: CmsSection): string {
  const f = facadeOf(block)
  return f.isFacade
    ? f.label
    : SECTION_LABELS[block.block_type] ?? block.block_type
}

/* Leading icon for each right-click menu action. A row without one is a row you
   have to READ; with one you recognise it, which is the whole point of a menu
   you open a hundred times a day. */
const CTX_ICONS: Record<string, string> = {
  edit: "brush",
  duplicate: "duplicate",
  duplicateItem: "duplicate",
  copy: "copy",
  paste: "paste",
  copyStyle: "brush",
  pasteStyle: "paste",
  resetStyle: "reset",
  delete: "trash",
  deleteItem: "trash",
}

/* --- 3F AI surface --- */
/** The context-menu's scope -> the NodeRef the AI row opens on. A cursor
 *  inside one repeated item (slide/tile/testimonial) targets THAT item
 *  (the matrix's item row); scopes AI excludes return null (no row). */
function ctxAiRef(m: CtxMenuState): NodeRef | null {
  if (m.itemField != null && m.itemIndex != null && m.scope !== "chrome" && m.scope !== "chromeElement") {
    return { t: "item", i: m.index, field: m.itemField, n: m.itemIndex }
  }
  switch (m.scope) {
    case "section":
      return { t: "section", i: m.index }
    case "widget":
      return m.path ? { t: "widget", i: m.index, path: m.path } : null
    case "element":
      return m.elementKey ? { t: "element", i: m.index, el: m.elementKey } : null
    case "chrome":
      return m.region ? { t: "chrome", region: m.region } : null
    case "chromeElement":
      return m.region && m.elementKey
        ? { t: "chromeEl", region: m.region, el: m.elementKey }
        : null
  }
}
/* --- end 3F AI surface --- */

/* --- 3C ghost badges: helpers ---------------------------------------- */
/** Owner-facing device names for the badge ("Hidden on Tablet"). */
const DEVICE_LABELS: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
}

/** Stable React key for a hidden-node badge. */
function hiddenRefKey(ref: NodeRef): string {
  switch (ref.t) {
    case "section":
      return `s-${ref.i}`
    case "column":
      return `c-${ref.i}-${ref.col.join("-")}`
    case "widget":
      return `w-${ref.i}-${ref.path.join("-")}`
    case "element":
      return `e-${ref.i}-${ref.el}`
    case "chromeEl":
      return `ce-${ref.region}-${ref.el}`
    case "chrome":
      return `ch-${ref.region}`
    default:
      return JSON.stringify(ref)
  }
}

/** Eye-off glyph (same stroke conventions as UiIcon — no icon package). */
function EyeOffGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.5-7 10-7c1.8 0 3.4.54 4.8 1.32M22 12s-3.5 7-10 7c-1.8 0-3.4-.54-4.8-1.32" />
      <circle cx="12" cy="12" r="3" />
      <line x1="4" y1="20" x2="20" y2="4" />
    </svg>
  )
}
/* --- end 3C ghost badges helpers --- */

/* --- 6C viewport clamp (P0 fix) --------------------------------------
   A floating toolbar anchored to its node's rect can leave the viewport
   when the node's own box does (a slider whose measured rect is wider
   than — or partly outside — the canvas viewport put the section toolbar
   off the LEFT edge). The anchor math cannot know the toolbar's width
   before render, so the clamp measures AFTER render, pre-paint (layout
   effect), and composes a corrective translateX onto the chip's base
   transform. The hook OWNS the transform: pass the base the JSX used to
   declare inline. Vertical stays with the anchors — they already clamp
   (Math.max) and the toolbar already sits BELOW the section's top edge
   (Elementor's flip-inside-at-viewport-top behavior). */
function useClampX<T extends HTMLElement>(base: string) {
  const ref = useRef<T | null>(null)
  // No dep array on purpose: re-measure on every render (anchor rects are
  // in the deps of the memos that re-render this tree; a few rect reads
  // per render is what the old measure effects cost too).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = base
    const r = el.getBoundingClientRect()
    let dx = 0
    if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right
    if (r.left + dx < 8) dx = 8 - r.left
    if (dx) el.style.transform = `${base} translateX(${dx}px)`.trim()
  })
  return ref
}
/* --- end 6C viewport clamp --- */

/** Small dark chip as the drag image (WS5 polish). */
function setDragGhost(e: React.DragEvent, label: string) {
  try {
    const el = document.createElement("div")
    el.textContent = label
    Object.assign(el.style, {
      position: "fixed", top: "-1000px", left: "-1000px", padding: "6px 12px",
      background: ink.base, color: ink.text, font: `600 12px ${font}`,
      borderRadius: `${radius.md}px`, boxShadow: shadow.chip,
    })
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 12, 12)
    setTimeout(() => document.body.removeChild(el), 0)
  } catch {}
}

/** A single button in the on-canvas floating toolbar. */
// 0C-replace: absorbed by the shared OverlayToolbar primitive when seat 0C's
// exports land in @modules/cms/editor — same names, one import change.
function CanvasToolBtn({
  title,
  onClick,
  children,
  disabled,
  danger,
  wide,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = danger
            ? semantic.dangerBg
            : ink.text
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = danger
          ? semantic.dangerBorder
          : ink.muted
      }}
      style={{
        ...type.label,
        fontFamily: font,
        minWidth: wide ? undefined : 24,
        height: 24,
        padding: wide ? "0 8px" : 0,
        border: 0,
        borderRadius: radius.sm,
        background: "transparent",
        color: danger ? semantic.dangerBorder : ink.muted,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  )
}

/* --------------------- tree-level add affordances ------------------- */
/**
 * The one control the editor was missing: a "+" that belongs to a place in the
 * tree rather than to the page as a whole.
 *
 * Every one of these is EDITOR CHROME rendered as a fixed-position sibling of
 * the page body — never inside `content`, never inside a `[data-cms-idx]`
 * wrapper — so it costs the layout nothing, cannot be captured by the section
 * click delegate, and can never reach the published page.
 *
 * `data-cms-overlay` is load-bearing: handleMouseMove bails on anything inside
 * an overlay, so travelling to one of these buttons does not clear the hover
 * that produced it (which would unmount the button under the cursor).
 */
// 0C-replace: swap for seat 0C's shared AddPill primitive when it lands in
// @modules/cms/editor — same name and props, one import change.
function AddPill({
  label,
  title,
  top,
  left,
  onClick,
  compact,
}: {
  label?: string
  title: string
  top: number
  left: number
  onClick: () => void
  compact?: boolean
}) {
  const [hot, setHot] = useState(false)
  return (
    <button
      type="button"
      data-cms-overlay="1"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        ...type.label,
        fontFamily: font,
        fontWeight: 600,
        position: "fixed",
        top,
        left,
        transform: "translate(-50%, -50%)",
        zIndex: 2147483120,
        height: compact ? 22 : 26,
        minWidth: compact ? 22 : undefined,
        padding: compact ? 0 : "0 10px 0 8px",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        border: 0,
        borderRadius: radius.pill,
        // Quiet until you mean it: the resting state is the accent at low
        // strength, hover commits to it. Never a second competing hue.
        background: hot ? accent.active : accent.base,
        color: accent.on,
        boxShadow: hot ? shadow.md : shadow.sm,
        cursor: "pointer",
        pointerEvents: "auto",
        whiteSpace: "nowrap",
        transition: `background ${motion.fast}, box-shadow ${motion.fast}`,
      }}
    >
      <UiIcon name="plus" size={compact ? 13 : 14} />
      {label}
    </button>
  )
}

/**
 * The in-canvas widget picker.
 *
 * The Elements palette lives in the SHELL, and the canvas cannot open it for a
 * specific column — the shell only exposes `cms:setAddTarget` / `cms:insert`,
 * which arm a SECTION seam. So the picker is rendered here, reading the same
 * `WIDGET_SCHEMAS` registry the palette does, and commits through the command
 * bus (Phase 2B): a `widget.insert` envelope over `cms:cmd`.
 */
function WidgetPicker({
  x,
  y,
  allowNested,
  onPick,
  onClose,
}: {
  x: number
  y: number
  /** One level of nesting only — an inner section cannot hold another. */
  allowNested: boolean
  onPick: (widgetType: string) => void
  onClose: () => void
}) {
  const defs = listWidgetSchemas().filter(
    (d) => allowNested || d.type !== "inner_section"
  )
  const W = 244
  const H = 300
  const left = Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - H - 8))
  return (
    <>
      <div
        data-cms-overlay="1"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
        style={{ position: "fixed", inset: 0, zIndex: 2147483400 }}
      />
      <div
        data-cms-overlay="1"
        style={{
          ...surface("md"),
          position: "fixed",
          top,
          left,
          width: W,
          zIndex: 2147483401,
          padding: 8,
          fontFamily: font,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "2px 2px 8px",
            borderBottom: hairline,
            marginBottom: 8,
          }}
        >
          <span style={{ ...eyebrow() }}>Add a widget</span>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            style={{
              marginLeft: "auto",
              border: 0,
              background: "none",
              color: grey[50],
              cursor: "pointer",
              display: "inline-flex",
              padding: 2,
            }}
          >
            <UiIcon name="x" size={13} />
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {defs.map((def) => (
            <PickerCard
              key={def.type}
              type={def.type}
              label={def.label}
              onPick={() => onPick(def.type)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

/** One tile in the in-canvas widget picker (mirrors the panel's WidgetCard). */
function PickerCard({
  type: widgetType,
  label,
  onPick,
}: {
  type: string
  label: string
  onPick: () => void
}) {
  const [hot, setHot] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onPick()
      }}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        border: `1px solid ${hot ? accent.base : grey[20]}`,
        borderRadius: radius.md,
        padding: "10px 6px 8px",
        background: grey[0],
        textAlign: "center",
        cursor: "pointer",
        display: "block",
        transition: `border-color ${motion.fast}, box-shadow ${motion.fast}`,
        boxShadow: hot ? shadow.sm : "none",
      }}
    >
      <span
        style={{
          color: hot ? accent.base : grey[50],
          display: "inline-flex",
        }}
      >
        <PaletteIcon type={widgetType} size={18} />
      </span>
      <span
        style={{
          ...type.label,
          fontFamily: font,
          fontWeight: 600,
          color: grey[90],
          display: "block",
          marginTop: 6,
        }}
      >
        {label}
      </span>
    </button>
  )
}

/**
 * The add-section affordance, BETWEEN sections.
 *
 * `AddSectionZone` only exists once, after the last section. On a real page —
 * thirty-odd sections, ~18,000px — that is somewhere below the footer, and a
 * merchant who wants a section in the MIDDLE of their page has no way to say so:
 * they add at the bottom and then drag it up past thirty neighbours.
 *
 * So every seam between sections gets its own insert bar: invisible until you
 * approach it, then a line with the same two doors as the zone at the bottom —
 * a plus for a fresh container, a template icon for a saved layout — both
 * inserting AT THIS SEAM.
 *
 * IN-FLOW editor chrome (zero height), NOT part of <OverlayLayer/> — it holds
 * a place between two sections in the page flow.
 */
export function SectionInsertBar({ index }: { index: number }) {
  const [hot, setHot] = useState(false)
  const [structure, setStructure] = useState(false)

  const dot = (bg: string): React.CSSProperties => ({
    border: 0,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    background: bg,
    color: accent.on,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadow.sm,
    pointerEvents: "auto",
  })

  return (
    // ZERO HEIGHT, always. The first version grew from 12px to 34px on hover —
    // which reflowed every section below it, so the page visibly jumped as the
    // pointer crossed a seam. An affordance must never move the thing it is
    // pointing at. The hit strip and the buttons are therefore absolutely
    // positioned OUT of flow, and the seam itself occupies no space.
    <div style={{ position: "relative", height: 0 }}>
      <div
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => {
          setHot(false)
          setStructure(false)
        }}
        /* The strip is an INVISIBLE hover affordance that straddles the seam
           (11px above it, 11px below), so it sits on top of the last 11px of
           whatever is above — the header, or any section. Those pixels were
           dead: a click there hit the strip, resolved to no editor node, and
           nothing happened. It cannot simply be pointer-events:none (then it
           never detects hover and the + never appears), so a click that lands
           on the strip ITSELF is handed down to whatever it is covering. The
           pills stop propagation, so this only ever fires on the empty strip. */
        onClick={(e) => {
          if (e.target !== e.currentTarget) return
          const strip = e.currentTarget as HTMLElement
          const prev = strip.style.pointerEvents
          strip.style.pointerEvents = "none"
          const under = document.elementFromPoint(e.clientX, e.clientY)
          strip.style.pointerEvents = prev
          if (!under || under === strip) return
          under.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              clientX: e.clientX,
              clientY: e.clientY,
            })
          )
        }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -11,
          height: 22,
          // Under the section toolbar (2147483100) on purpose: where they
          // overlap, the toolbar you are already using stays on top.
          zIndex: 2147482000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
        }}
      >
        {hot ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 10,
                height: 2,
                background: accent.base,
                opacity: 0.3,
              }}
            />
            {!structure ? (
              // CENTRED. The section below owns both ends of its top edge — the
              // name badge sits top-LEFT, the toolbar (Edit / duplicate / delete)
              // top-RIGHT. Offsetting left dodged the toolbar and landed straight
              // on the badge. The middle is the only lane nothing else claims.
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 6,
                  pointerEvents: "auto",
                }}
              >
                <button
                  title="Add a section here"
                  onClick={() => {
                    // Arm this seam. Whatever the merchant reaches for next — a
                    // column structure below, or a section from the Elements
                    // palette — lands HERE, not at the bottom of the page.
                    postToShell({ type: "cms:setAddTarget", index })
                    setStructure(true)
                  }}
                  style={dot(accent.base)}
                >
                  <UiIcon name="plus" size={14} />
                </button>
                <button
                  title="Insert a template here"
                  onClick={() =>
                    postToShell({ type: "cms:openTemplates", at: index })
                  }
                  style={dot(grey[60])}
                >
                  <UiIcon name="template" size={14} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  ...surface("md"),
                  position: "relative",
                  display: "flex",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: radius.md,
                  pointerEvents: "auto",
                }}
              >
                {/* STRUCTURE FIRST. Elementor's seam offers a structure, and
                    the store-section palette is the secondary door beside it —
                    the reverse of the order this popover shipped with. */}
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    title={`${n} column${n > 1 ? "s" : ""}`}
                    onClick={() => {
                      // Phase 2B: structure inserts ride the command bus.
                      postCommandToShell({
                        name: "container.insert",
                        args: { at: index, cols: n },
                      })
                      setStructure(false)
                    }}
                    style={{
                      border: hairline,
                      borderRadius: radius.sm,
                      background: grey[5],
                      padding: 4,
                      cursor: "pointer",
                      display: "flex",
                      gap: 2,
                    }}
                  >
                    {Array.from({ length: n }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: Math.max(8, 34 / n),
                          height: 16,
                          background: grey[30],
                          borderRadius: 1,
                          display: "inline-block",
                        }}
                      />
                    ))}
                  </button>
                ))}
                <span
                  aria-hidden="true"
                  style={{ width: 1, background: grey[20], margin: "2px 2px" }}
                />
                <button
                  title="Add a store section here from the Elements panel"
                  onClick={() => {
                    // `cms:insert` is the shell's existing openAddAt() path: it
                    // arms the insertion index AND opens the section palette.
                    // Full-width store sections stay fully insertable here.
                    postToShell({ type: "cms:insert", index })
                    setStructure(false)
                  }}
                  style={{
                    ...button("secondary", "sm"),
                    borderColor: grey[30],
                  }}
                >
                  <UiIcon name="plus" size={12} />
                  Store section
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The persistent add row at the BOTTOM of the page — the canvas's own
 * "what next?".
 *
 * Elementor puts two doors here and nothing else: a plus for a fresh section
 * and a folder for a saved one. This is that row, with the labels spelled out
 * (icon-only circles tested as "what do these do?"), sitting on a dashed
 * hairline so it reads as scaffolding rather than as content.
 *
 * Both doors go through mechanisms the shell already speaks:
 *   - "Add new section"    -> `cms:insert` -> the shell's openAddAt(): opens
 *                             the Elements / section palette, armed to land at
 *                             `count` (the end of the page).
 *   - "Insert a template"  -> `cms:openTemplates` with `at: count` -> the shell
 *                             sets `templateAt` and opens the Template Library.
 *
 * The column-structure picker the zone used to open on the plus is still here,
 * demoted to a quiet secondary link — it is a layout choice, not the primary
 * "add something" intent, and burying the palette behind it was the reason the
 * plus felt like a dead end.
 *
 * EDITOR-ONLY CHROME: rendered under `!previewMode` inside the canvas iframe,
 * never part of `content`, so it can never reach the published page. IN-FLOW,
 * not part of <OverlayLayer/>.
 */
export function AddSectionZone({ count }: { count: number }) {
  const [view, setView] = useState<"choose" | "structure">("choose")
  const [hot, setHot] = useState(false)

  return (
    <div
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        margin: "28px auto 48px",
        maxWidth: 880,
        padding: "28px 24px",
        border: `1px dashed ${hot ? accent.tintStrong : grey[30]}`,
        borderRadius: radius.lg,
        textAlign: "center",
        fontFamily: font,
        background: hot ? accent.tint : grey[5],
        transition: `background ${motion.base}, border-color ${motion.base}`,
      }}
    >
      {view === "choose" ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              title="Add a new section at the end of the page"
              onClick={() => {
                // ELEMENTOR'S DEFAULT. The plus asks "select your structure"
                // and builds a section OF COLUMNS; widgets then go inside it.
                // This used to jump straight to the store-section palette,
                // which quietly made "a section" mean "a commerce block" and
                // left containers as an obscure secondary link. Store sections
                // are still one click away (below, and in the Elements panel) —
                // they are just no longer the only meaning of "add a section".
                postToShell({ type: "cms:setAddTarget", index: count })
                setView("structure")
              }}
              style={{ ...button("accent") }}
            >
              <UiIcon name="plus" size={14} />
              Add new section
            </button>
            <button
              title="Insert a saved template at the end of the page"
              onClick={() =>
                postToShell({ type: "cms:openTemplates", at: count })
              }
              style={{ ...button("secondary") }}
            >
              <UiIcon name="template" size={14} />
              Insert a template
            </button>
          </div>
          <div
            style={{
              ...type.label,
              color: grey[50],
              marginTop: 12,
              display: "flex",
              gap: 6,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <span>Drag a widget here, or</span>
            <button
              onClick={() => postToShell({ type: "cms:insert", index: count })}
              style={{
                ...type.label,
                fontFamily: font,
                border: 0,
                background: "none",
                padding: 0,
                color: accent.base,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              browse store sections
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ ...type.title, color: grey[70], marginBottom: 16 }}>
            Select your structure
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                title={n + (n > 1 ? " columns" : " column")}
                onClick={() => {
                  // Phase 2B: structure inserts ride the command bus.
                  postCommandToShell({
                    name: "container.insert",
                    args: { at: count, cols: n },
                  })
                  setView("choose")
                }}
                style={{
                  border: hairline,
                  borderRadius: radius.md,
                  background: grey[0],
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  gap: 4,
                }}
              >
                {Array.from({ length: n }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: Math.max(14, 60 / n),
                      height: 34,
                      background: grey[30],
                      borderRadius: radius.sm,
                      display: "inline-block",
                    }}
                  />
                ))}
              </button>
            ))}
          </div>
          <div
            style={{
              ...type.label,
              color: grey[50],
              marginTop: 12,
              display: "flex",
              gap: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => postToShell({ type: "cms:insert", index: count })}
              style={{
                ...type.label,
                fontFamily: font,
                border: 0,
                background: "none",
                padding: 0,
                color: accent.base,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Or add a store section
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setView("choose")}
              style={{
                ...type.label,
                fontFamily: font,
                border: 0,
                background: "none",
                padding: 0,
                color: grey[50],
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- the overlay layer itself --------------------------- */

export type OverlayLayerProps = {
  /* view state */
  previewMode: boolean
  /** 7A: the full-screen slide stage owns the screen — the canvas's
   *  PAGE-editing affordances (section toolbar, column handles, add pills,
   *  element pencil, context menu) must not paint over it. The AI prompt
   *  box is deliberately NOT gated here: it stays available to a staged
   *  slider layer (5C). */
  stageActive?: boolean
  device: Device
  contentLength: number

  /* section hover/selection (hovered beats selected — resolved upstream) */
  activeIdx: number | null
  /** The pointer entered/left the floating section toolbar — the canvas
   *  keeps the toolbar's section "held" so it never unmounts under the
   *  pointer mid-travel (the first-section toolbar overlaps the header). */
  onToolbarHold?: (idx: number | null) => void
  activeBlock: CmsSection | null
  activeRect: DOMRect | null

  /* geometry-derived affordances */
  /* --- 3C ghost badges: hidden-node badges on EVERY node kind ---------
     Generalized from `{ idx, rect }[]` (sections only) to NodeRefs so
     column / widget / element / chrome-element ghosts carry the same
     badge. The 40% dim comes from the canvas CSS (hiddenCss) — this
     layer only ever draws chrome, never mutates page paint. */
  hiddenBadges: { ref: NodeRef; rect: DOMRect }[]
  /** Select a badge's node — the canvas's own click path (local sel +
   *  the same cms:clicked* message), so the merchant lands on the node's
   *  Advanced tab to un-hide it. */
  selectHidden: (ref: NodeRef) => void
  /* --- end 3C ghost badges --- */
  emptyCols: { index: number; colPath: number[]; rect: DOMRect }[]
  hoverColBox: {
    index: number
    colPath: number[]
    wi: number
    rect: DOMRect
  } | null
  widgetBox: { index: number; path: number[]; rect: DOMRect } | null
  /** The SELECTED column's box (Phase 2B): drives the "Column N" chip +
   *  compact toolbar. `facade` = the box is the section's (collapsed
   *  facade — its single implicit column has no DOM of its own). */
  columnBox: {
    index: number
    colPath: number[]
    nextWi: number
    facade: boolean
    rect: DOMRect
  } | null
  /** Select the parent section (the column toolbar's hop up the tree). */
  selectSection: (index: number) => void

  /* --- 3A drop placeholder: the ONE resolved drag target --- */
  dropTarget: DropTarget | null

  /* element affordances */
  elBadge: ElBadgeState | null
  fontPill: FontPillState | null
  selectedEl: { index: number; key: string } | null
  fontDragRef: React.MutableRefObject<{ startX: number; startPx: number } | null>
  fontPxRef: React.MutableRefObject<number | null>
  setFontPill: (p: FontPillState | null) => void
  /** Paint style.fontSize inline for live drag feedback (monolith owns DOM). */
  paintInlineFont: (index: number, key: string, px: number) => void
  /** Remove the inline paint once the committed CSS has landed. */
  releaseInlineFont: (index: number, key: string) => void

  /* widget picker */
  picker: PickerState | null
  setPicker: (p: PickerState | null) => void
  insertWidget: (
    index: number,
    colPath: number[],
    wi: number,
    widgetType: string
  ) => void

  /* context menu */
  ctxMenu: CtxMenuState | null
  setCtxMenu: (m: CtxMenuState | null) => void
  clip: ClipState

  /* actions (all doors onto existing shell machinery) */
  canvasAction: (action: string, index: number) => void
  widgetAction: (action: string, index: number, path: number[]) => void
  selectWidget: (index: number, path: number[]) => void

  /* --- 3F AI surface --- */
  /** Selection-anchored AI context (ARCH-AI §2). Optional: without it no
   *  sparkle, no Cmd+J, no box — the overlay renders exactly as before.
   *  The canvas passes { sel, content, chrome, geom, brand }. */
  ai?: AiOverlayContext
  /* --- end 3F AI surface --- */

  /* --- 5B stage --- */
  /** What the ACTIVE section hosts (computed by the canvas via
   *  sliderKindOf): "layered" → the toolbar offers "Edit slide";
   *  "fields" → it offers "Convert to layered slide" (which dispatches
   *  the in-history upgrade, then enters the stage); null/undefined →
   *  no slider affordance, the toolbar renders exactly as before. */
  sliderStage?: "layered" | "fields" | null
  /** Enter the slide stage for a section (canvas-owned takeover). */
  onStageEnter?: (index: number) => void
  /* --- end 5B stage --- */

  /* --- 6B convert-to-widgets --- */
  /** True when the ACTIVE section is a convertible themed section
   *  (rich_text / image_with_text — the normalized facade or the flat
   *  legacy shape; the canvas computes it via facadeOf +
   *  CONVERTIBLE_SECTION_TYPES, the same predicate family the command's
   *  run() accepts). Gated exactly like the 5B sliderStage entry:
   *  without BOTH props the toolbar renders exactly as before. */
  convertToWidgets?: boolean
  /** Dispatch the in-history section.convertToWidgets command. */
  onConvertToWidgets?: (index: number) => void
  /* --- end 6B convert-to-widgets --- */
}

/**
 * Mounted ONCE by the canvas, exactly where the extracted JSX used to sit
 * (before the chrome/header in DOM order, so equal z-index stacking is
 * unchanged). Renders nothing it was not already rendering.
 */
export default function OverlayLayer(props: OverlayLayerProps) {
  const {
    previewMode,
    stageActive,
    device,
    contentLength,
    activeIdx,
    onToolbarHold,
    activeBlock,
    activeRect,
    hiddenBadges,
    selectHidden,
    emptyCols,
    hoverColBox,
    widgetBox,
    columnBox,
    selectSection,
    dropTarget,
    elBadge,
    fontPill,
    selectedEl,
    fontDragRef,
    fontPxRef,
    setFontPill,
    paintInlineFont,
    releaseInlineFont,
    picker,
    setPicker,
    insertWidget,
    ctxMenu,
    setCtxMenu,
    clip,
    canvasAction,
    widgetAction,
    selectWidget,
  } = props

  /* 7A: page chrome yields to the full-screen stage. */
  const pageChrome = !previewMode && !stageActive

  /* 6C: viewport-clamped floating toolbars — the hooks OWN these chips'
     transforms (base + corrective shift); the JSX declares none. */
  const sectionBarRef = useClampX<HTMLDivElement>("translateX(-50%)")
  const widgetBarRef = useClampX<HTMLDivElement>("translate(-100%, -50%)")
  const columnBarRef = useClampX<HTMLDivElement>("translate(-100%, -50%)")

  return (
    <>
      {/* --- 3C ghost badges: "Hidden on <Device>" over EVERY ghosted node
          (section / element / column / widget / chrome element). Clicking a
          badge selects its node — the door onto the node's own click path —
          so the merchant can reach the Advanced tab and un-hide. */}
      {hiddenBadges.length ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: zLayer.canvasSeam,
            pointerEvents: "none",
            fontFamily: font,
          }}
        >
          {hiddenBadges.map(({ ref, rect }) => (
            <button
              key={`cms-hidden-${hiddenRefKey(ref)}`}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                selectHidden(ref)
              }}
              style={{
                ...type.micro,
                fontFamily: font,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                border: "none",
                borderRadius: radius.sm,
                background: ink.base,
                color: ink.muted,
                boxShadow: shadow.chip,
                whiteSpace: "nowrap",
                position: "absolute",
                top: Math.max(2, rect.top + 6),
                left: Math.max(6, rect.left + 6),
                pointerEvents: "auto",
                cursor: "pointer",
              }}
            >
              <EyeOffGlyph />
              Hidden on {DEVICE_LABELS[device]}
            </button>
          ))}
        </div>
      ) : null}
      {/* --- end 3C ghost badges --- */}

      {/* --- 3A drop placeholder -------------------------------------------
          The REAL gap (an in-flow div) is opened by ./dnd's DropPlaceholder;
          the overlay adds only what a gap cannot say: WHICH column/section
          is hot (outline) and what a seam drop will DO (the named chip).
          The old 2px dropLine/dropCol indicators are deleted. */}
      {dropTarget?.kind === "seam" && contentLength > 0 ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483200,
            pointerEvents: "none",
          }}
        >
          {/* Name the outcome so the drop never feels like a no-op. A basic
              element over an atomic block can't go INSIDE it, so it lands as
              a new section at this seam — say so, plainly and on-brand. */}
          <div
            style={{
              position: "absolute",
              top: Math.max(0, dropTarget.top - 10),
              left: 12,
              padding: "2px 9px",
              borderRadius: 999,
              background: accent.base,
              color: "#fff",
              font: `600 11px ${font}`,
              boxShadow: shadow.chip,
              whiteSpace: "nowrap",
              transition: "top 90ms ease",
            }}
          >
            {dropTarget.label}
          </div>
        </div>
      ) : null}
      {dropTarget?.kind === "column" || dropTarget?.kind === "facade" ? (
        <div
          style={{
            position: "fixed",
            top: dropTarget.rect.top,
            left: dropTarget.rect.left,
            width: dropTarget.rect.width,
            height: dropTarget.rect.height,
            zIndex: 2147483200,
            pointerEvents: "none",
            outline: canvasTokens.selected,
            outlineOffset: -2,
            background: canvasTokens.dropFill,
            borderRadius: radius.sm,
          }}
        />
      ) : null}
      {dropTarget?.kind === "facade" ? (
        <div
          style={{
            position: "fixed",
            top: Math.max(0, dropTarget.rect.top - 10),
            left: Math.max(12, dropTarget.rect.left + 12),
            zIndex: 2147483201,
            pointerEvents: "none",
            padding: "2px 9px",
            borderRadius: 999,
            background: accent.base,
            color: "#fff",
            font: `600 11px ${font}`,
            boxShadow: shadow.chip,
            whiteSpace: "nowrap",
          }}
        >
          Drops inside this section
        </div>
      ) : null}
      {/* --- end 3A drop placeholder -------------------------------------- */}

      {/* On-canvas hover/selection overlay: section label + floating toolbar. */}
      {pageChrome && activeRect && activeIdx != null && activeBlock ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483000,
            pointerEvents: "none",
            fontFamily: font,
          }}
        >
          <div
            style={{
              ...chip(),
              position: "absolute",
              top: Math.max(0, activeRect.top),
              left: Math.max(0, activeRect.left),
              height: 24,
              borderRadius: `0 0 ${radius.md}px 0`,
              color: ink.muted,
            }}
          >
            {sectionDisplayLabel(activeBlock)}
          </div>
          <div
            ref={sectionBarRef}
            data-cms-overlay="1"
            onMouseEnter={() => onToolbarHold?.(activeIdx)}
            onMouseLeave={() => onToolbarHold?.(null)}
            style={{
              ...chip(),
              position: "absolute",
              top: Math.max(2, activeRect.top + 6),
              left: activeRect.left + activeRect.width / 2,
              height: 30,
              gap: 2,
              padding: "0 4px",
              pointerEvents: "auto",
            }}
          >
            <div
              draggable
              title="Drag to reorder"
              onDragStart={(e) => {
                e.dataTransfer.setData(BLOCK_MIME, JSON.stringify({ reorderFrom: activeIdx }))
                e.dataTransfer.effectAllowed = "move"
                setDragGhost(e, sectionDisplayLabel(activeBlock))
              }}
              style={{ display: "flex", alignItems: "center", padding: "0 4px", color: ink.muted, cursor: "grab", userSelect: "none" }}
            >
              <UiIcon name="grip" size={14} />
            </div>
            {/* --- 3F AI surface: node-toolbar sparkle (EMBER — "ink
                manipulates, ember creates"; AI creates). Selection-scoped:
                opens the prompt box pinned to THIS section. --- */}
            {props.ai && aiEligible({ t: "section", i: activeIdx }, props.ai) ? (
              <CanvasToolBtn
                title="Edit with AI (⌘J)"
                onClick={() => openAiBox({ t: "section", i: activeIdx })}
              >
                <span style={{ color: accent.base, display: "inline-flex" }}>
                  <UiIcon name="sparkles" size={14} />
                </span>
              </CanvasToolBtn>
            ) : null}
            {/* --- end 3F AI surface --- */}
            {/* --- 5B stage: "Edit slide" on a layered hero; the CONVERT
                entry on a fields hero. Ink manipulates, ember creates —
                editing an existing layered slide is ink, converting to
                the layered model creates one, so it reads ember. --- */}
            {props.sliderStage && props.onStageEnter ? (
              <CanvasToolBtn
                title={
                  props.sliderStage === "layered"
                    ? "Open the slide stage"
                    : "Convert this hero to layered slides (undoable), then open the stage"
                }
                wide
                onClick={() => props.onStageEnter!(activeIdx)}
              >
                {props.sliderStage === "layered" ? (
                  "Edit slide"
                ) : (
                  <span style={{ color: accent.base }}>
                    Convert to layered slide
                  </span>
                )}
              </CanvasToolBtn>
            ) : null}
            {/* --- end 5B stage --- */}
            {/* --- 6B: "Convert to widgets" on a rich_text /
                image_with_text section (facade or flat) — explicit,
                merchant-invoked, one undoable command. Ink manipulates,
                ember creates — conversion creates the widget tree, so it
                reads ember (the 5B convert entry's precedent). --- */}
            {props.convertToWidgets && props.onConvertToWidgets ? (
              <CanvasToolBtn
                title="Convert this section into editable widgets (undoable)"
                wide
                onClick={() => props.onConvertToWidgets!(activeIdx)}
              >
                <span style={{ color: accent.base }}>Convert to widgets</span>
              </CanvasToolBtn>
            ) : null}
            {/* --- end 6B convert-to-widgets --- */}
            <CanvasToolBtn
              title="Move up"
              disabled={activeIdx === 0}
              onClick={() => canvasAction("up", activeIdx)}
            >
              <UiIcon name="arrow-up" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Move down"
              disabled={activeIdx === contentLength - 1}
              onClick={() => canvasAction("down", activeIdx)}
            >
              <UiIcon name="arrow-down" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Duplicate"
              onClick={() => canvasAction("duplicate", activeIdx)}
            >
              <UiIcon name="duplicate" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Edit"
              wide
              onClick={() => canvasAction("edit", activeIdx)}
            >
              Edit
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Add section below"
              onClick={() => canvasAction("addBelow", activeIdx)}
            >
              <UiIcon name="plus" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Delete"
              danger
              onClick={() => canvasAction("delete", activeIdx)}
            >
              <UiIcon name="x" size={14} />
            </CanvasToolBtn>
          </div>
        </div>
      ) : null}

      {/* ---------------- COLUMN level: "+ Add widget" ----------------
          An empty column has no content and therefore no presence: before
          this, the only way in was to drag a card from the shell palette and
          hope you hit it. Its plus is permanent. A column that already holds
          widgets gets one on hover, straddling its BOTTOM edge — where the
          new widget will actually land, and where it covers nothing. */}
      {pageChrome &&
        emptyCols.map((c) => (
          <AddPill
            key={`empty-${c.index}-${c.colPath.join("-")}`}
            title="Add a widget to this column"
            label="Add widget"
            top={c.rect.top + c.rect.height / 2}
            left={c.rect.left + c.rect.width / 2}
            onClick={() =>
              setPicker({
                index: c.index,
                colPath: c.colPath,
                wi: 0,
                x: c.rect.left + c.rect.width / 2,
                y: c.rect.top + c.rect.height / 2 + 18,
              })
            }
          />
        ))}
      {/* --- Column handle (owner feedback): a small tab at the hovered
          column's top-left that SELECTS the column — Elementor's column
          handle. Content clicks select widgets and the rail selects the
          section; a packed column had no visible way in. */}
      {pageChrome && hoverColBox ? (
        <button
          data-cms-overlay="1"
          title={`Select column ${hoverColBox.colPath[hoverColBox.colPath.length - 1] + 1}`}
          onClick={() =>
            postToShell({
              type: "cms:clickedColumn",
              index: hoverColBox.index,
              colPath: hoverColBox.colPath,
            })
          }
          style={{
            position: "fixed",
            top: Math.max(2, hoverColBox.rect.top - 10),
            left: hoverColBox.rect.left + 6,
            zIndex: zLayer.canvasToolbar,
            height: 20,
            padding: "0 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: 0,
            borderRadius: radius.sm,
            background: ink.base,
            color: "#fff",
            fontFamily: font,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.4,
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          {"COLUMN " + (hoverColBox.colPath[hoverColBox.colPath.length - 1] + 1)}
        </button>
      ) : null}
      {pageChrome && hoverColBox ? (
        <AddPill
          title="Add a widget at the end of this column"
          label="Add widget"
          top={hoverColBox.rect.bottom}
          left={hoverColBox.rect.left + hoverColBox.rect.width / 2}
          onClick={() =>
            setPicker({
              index: hoverColBox.index,
              colPath: hoverColBox.colPath,
              wi: hoverColBox.wi,
              x: hoverColBox.rect.left + hoverColBox.rect.width / 2,
              y: hoverColBox.rect.bottom + 16,
            })
          }
        />
      ) : null}

      {/* ---------------- WIDGET level: the compact toolbar ----------------
          Elementor's per-widget controls, at the widget's top-right corner so
          they never cover the thing they act on. Every button is a door onto
          machinery the shell already runs — the same handlers the right-click
          menu uses — because the canvas cannot add new ones. */}
      {pageChrome && widgetBox ? (
        <div
          ref={widgetBarRef}
          data-cms-overlay="1"
          style={{
            ...chip(),
            position: "fixed",
            top: Math.max(14, widgetBox.rect.top),
            left: Math.max(96, widgetBox.rect.right - 2),
            zIndex: 2147483110,
            height: 26,
            gap: 2,
            padding: "0 3px",
            pointerEvents: "auto",
            fontFamily: font,
          }}
        >
          {/* Drag to reorder within the column — same grammar as the section
              grip, and it carries `moveFrom` so the drop MOVES the existing
              widget instead of inserting a new one. */}
          <span
            draggable
            title="Drag to reorder"
            onDragStart={(e) => {
              e.dataTransfer.setData(
                WIDGET_MIME,
                JSON.stringify({
                  widget_type: "",
                  moveFrom: {
                    index: widgetBox.index,
                    colPath: widgetBox.path.slice(0, -1),
                    wi: widgetBox.path[widgetBox.path.length - 1],
                  },
                })
              )
              e.dataTransfer.effectAllowed = "move"
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              cursor: "grab",
              color: "#fff",
              opacity: 0.85,
            }}
          >
            <UiIcon name="grip" size={13} />
          </span>
          {/* --- 3F AI surface: widget-toolbar sparkle (ember). The chip
              matrix gates it — html/spacer/divider/media widgets show
              nothing (ARCH-AI §2.3/§5.3). --- */}
          {props.ai &&
          aiEligible(
            { t: "widget", i: widgetBox.index, path: widgetBox.path },
            props.ai
          ) ? (
            <CanvasToolBtn
              title="Edit with AI (⌘J)"
              onClick={() =>
                openAiBox({ t: "widget", i: widgetBox.index, path: widgetBox.path })
              }
            >
              <span style={{ color: accent.base, display: "inline-flex" }}>
                <UiIcon name="sparkles" size={13} />
              </span>
            </CanvasToolBtn>
          ) : null}
          {/* --- end 3F AI surface --- */}
          <CanvasToolBtn
            title="Add a widget below this one"
            onClick={() =>
              setPicker({
                index: widgetBox.index,
                colPath: widgetBox.path.slice(0, -1),
                wi: widgetBox.path[widgetBox.path.length - 1] + 1,
                x: widgetBox.rect.left + widgetBox.rect.width / 2,
                y: widgetBox.rect.bottom + 8,
              })
            }
          >
            <UiIcon name="plus" size={14} />
          </CanvasToolBtn>
          <CanvasToolBtn
            title="Edit this widget"
            onClick={() => selectWidget(widgetBox.index, widgetBox.path)}
          >
            <UiIcon name="brush" size={14} />
          </CanvasToolBtn>
          <CanvasToolBtn
            title="Duplicate this widget"
            onClick={() =>
              widgetAction("duplicate", widgetBox.index, widgetBox.path)
            }
          >
            <UiIcon name="duplicate" size={14} />
          </CanvasToolBtn>
          <CanvasToolBtn
            title="Delete this widget"
            danger
            onClick={() =>
              widgetAction("delete", widgetBox.index, widgetBox.path)
            }
          >
            <UiIcon name="trash" size={14} />
          </CanvasToolBtn>
        </div>
      ) : null}

      {/* ---------------- COLUMN level: chip + toolbar (Phase 2B) ------------
          The owner's ask, verbatim: "I cannot even select the column — I only
          can select the whole section either or the individual element." A
          selected column now gets the same grammar as a widget: its outline
          (painted by the canvas's unified outline pass), a "Column N" chip
          naming what is selected, and a compact toolbar — add a widget into
          THIS column through the existing picker, or hop to the parent
          section. On a collapsed facade the box is the SECTION box (the
          single implicit column IS the section, INTEGRATION-2E §4) and the
          chip says so. Below the widget toolbar's z on purpose: where a
          hovered widget's toolbar overlaps, the thing you are aiming at
          stays on top. */}
      {pageChrome && columnBox ? (
        <>
          <div
            style={{
              ...chip(),
              position: "fixed",
              top: Math.max(0, columnBox.rect.top),
              left: Math.max(0, columnBox.rect.left),
              zIndex: 2147483105,
              height: 24,
              borderRadius: `0 0 ${radius.md}px 0`,
              color: accent.on,
              background: accent.base,
              pointerEvents: "none",
              fontFamily: font,
            }}
          >
            {columnBox.facade
              ? "Column 1 (whole section)"
              : `Column ${columnBox.colPath[columnBox.colPath.length - 1] + 1}`}
          </div>
          <div
            ref={columnBarRef}
            data-cms-overlay="1"
            style={{
              ...chip(),
              position: "fixed",
              top: Math.max(14, columnBox.rect.top),
              left: Math.max(96, columnBox.rect.right - 2),
              zIndex: 2147483105,
              height: 26,
              gap: 2,
              padding: "0 3px",
              pointerEvents: "auto",
              fontFamily: font,
            }}
          >
            <CanvasToolBtn
              title="Add a widget to this column"
              onClick={() =>
                setPicker({
                  index: columnBox.index,
                  colPath: columnBox.colPath,
                  wi: columnBox.nextWi,
                  x: columnBox.rect.left + columnBox.rect.width / 2,
                  y: columnBox.rect.bottom + 8,
                })
              }
            >
              <UiIcon name="plus" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Select the parent section"
              wide
              onClick={() => selectSection(columnBox.index)}
            >
              Section
            </CanvasToolBtn>
          </div>
        </>
      ) : null}

      {/* ---------------- SECTION level: "+" above and below ----------------
          A theme-owned commerce section (hero slider, product tabs …) is a
          fixed shape: it cannot accept arbitrary children, so it has no column
          to hover and no widget to sit next to. Rather than leave it a dead
          end, it gets a plus at each end that drops a fresh 1-column container
          THERE — the merchant can always add something adjacent.
          Right-hand rail on purpose: the name badge owns the top-left, the
          section toolbar the top-centre, and the seam bar the centre line. */}
      {pageChrome &&
      activeRect &&
      activeIdx != null &&
      activeBlock &&
      (activeBlock.block_type !== "container" ||
        facadeOf(activeBlock).isFacade) ? (
        <>
          <AddPill
            compact
            title="Add a container above this section"
            top={Math.max(14, activeRect.top)}
            left={activeRect.right - 34}
            onClick={() =>
              postCommandToShell({
                name: "container.insert",
                args: { at: activeIdx, cols: 1 },
              })
            }
          />
          <AddPill
            compact
            title="Add a container below this section"
            top={activeRect.bottom}
            left={activeRect.right - 34}
            onClick={() =>
              postCommandToShell({
                name: "container.insert",
                args: { at: activeIdx + 1, cols: 1 },
              })
            }
          />
          {facadeOf(activeBlock).isFacade ? (
            /* The direct answer to "I can't add anywhere INSIDE a section":
               a facade IS a 1-column container, so this opens the widget
               picker targeting that column; the shell clears `flush` on the
               insert and the section un-collapses into a real container. */
            <AddPill
              label="Add widget"
              title="Add a widget inside this section"
              top={activeRect.bottom}
              left={activeRect.left + activeRect.width / 2}
              onClick={() =>
                setPicker({
                  index: activeIdx,
                  colPath: [0],
                  wi: 1,
                  x: activeRect.left + activeRect.width / 2,
                  y: activeRect.bottom + 8,
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {/* The picker any of the pluses above opens, committing through the
          palette-drop message the shell already handles. */}
      {pageChrome && picker ? (
        <WidgetPicker
          x={picker.x}
          y={picker.y}
          // One level of nesting only — the same rule handleDrop enforces.
          allowNested={picker.colPath.length === 1}
          onClose={() => setPicker(null)}
          onPick={(widgetType) => {
            insertWidget(picker.index, picker.colPath, picker.wi, widgetType)
            setPicker(null)
          }}
        />
      ) : null}

      {pageChrome && elBadge ? (
        <div
          style={{
            position: "fixed",
            top: Math.max(0, elBadge.top),
            left: elBadge.right,
            transform: "translate(-100%, -100%)",
            zIndex: 2147483100,
            pointerEvents: "none",
            background: elBadge.sel ? accent.base : ink.base,
            color: elBadge.sel ? accent.on : ink.muted,
            width: 22,
            height: 22,
            borderRadius: radius.sm,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shadow.chip,
          }}
        >
          <UiIcon name="brush" size={14} />
        </div>
      ) : null}

      {/* On-canvas font-size handle — drag right to grow, left to shrink. */}
      {pageChrome && fontPill && selectedEl ? (
        <div
          style={{
            ...chip(),
            position: "fixed",
            top: Math.max(0, fontPill.top - 32),
            left: Math.max(0, fontPill.left),
            zIndex: 2147483100,
            height: 28,
            gap: 2,
            padding: "0 4px 0 6px",
            userSelect: "none",
          }}
        >
          <span
            title="Drag to resize the text"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              fontDragRef.current = { startX: e.clientX, startPx: fontPill.px }
            }}
            onPointerMove={(e) => {
              const d = fontDragRef.current
              if (!d) return
              // 2px of travel per 1px of type: fine enough to land on a value,
              // coarse enough to cross a heading's range without a marathon.
              const next = Math.min(
                200,
                Math.max(8, Math.round(d.startPx + (e.clientX - d.startX) / 2))
              )
              if (next === fontPill.px) return
              fontPxRef.current = next
              setFontPill({ ...fontPill, px: next })
              // Paint it NOW so the text moves under the cursor. The editor is
              // the source of truth and will push the authoritative CSS back;
              // this is just so the drag does not feel dead.
              paintInlineFont(selectedEl.index, selectedEl.key, next)
            }}
            onPointerUp={(e) => {
              const d = fontDragRef.current
              fontDragRef.current = null
              if (!d) return
              ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
              // Commit through the editor so it lands in the element's style bag
              // (undo, autosave and the responsive device all keep working).
              postToShell({
                type: "cms:fontSize",
                index: selectedEl.index,
                elementKey: selectedEl.key,
                px: fontPill.px,
              })
              releaseInlineFont(selectedEl.index, selectedEl.key)
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "ew-resize",
              padding: "0 4px",
              color: ink.muted,
              fontWeight: 600,
            }}
          >
            <UiIcon
              name="resize-h"
              size={14}
              style={{ pointerEvents: "none" }}
            />
            <span style={{ color: accent.base, pointerEvents: "none" }}>
              {fontPill.px}px
            </span>
          </span>

          {[-1, 1].map((step) => (
            <button
              key={step}
              type="button"
              title={step < 0 ? "Smaller" : "Bigger"}
              onClick={(e) => {
                e.stopPropagation()
                const next = Math.min(200, Math.max(8, fontPill.px + step))
                fontPxRef.current = next
                setFontPill({ ...fontPill, px: next })
                postToShell({
                  type: "cms:fontSize",
                  index: selectedEl.index,
                  elementKey: selectedEl.key,
                  px: next,
                })
                // Any inline paint left over from a drag would outrank the CSS
                // the editor is about to write, and the nudge would do nothing.
                releaseInlineFont(selectedEl.index, selectedEl.key)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = ink.text
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = ink.muted
              }}
              style={{
                border: 0,
                background: "transparent",
                color: ink.muted,
                width: 20,
                height: 20,
                borderRadius: radius.sm,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UiIcon name={step < 0 ? "minus" : "plus"} size={14} />
            </button>
          ))}
        </div>
      ) : null}

      {/* Right-click menu — Elementor parity. */}
      {pageChrome && ctxMenu ? (
        <>
          <div
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setCtxMenu(null)
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483200,
            }}
          />
          <div
            style={{
              ...surface("md"),
              ...type.body,
              position: "fixed",
              // Keep the menu on screen when the click is near an edge.
              top: Math.min(ctxMenu.y, window.innerHeight - 300),
              left: Math.min(ctxMenu.x, window.innerWidth - 220),
              zIndex: 2147483201,
              width: 200,
              padding: 6,
              fontFamily: font,
              color: grey[80],
            }}
          >
            <div
              style={{
                ...eyebrow(),
                padding: "4px 8px 8px",
                borderBottom: hairline,
                marginBottom: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {ctxMenu.label}
            </div>
            {/* --- 3F AI surface: "Edit with AI" row (selection-scoped,
                ARCH-AI §2.1). Rendered only for AI-eligible nodes. --- */}
            {(() => {
              if (!props.ai) return null
              const ref = ctxAiRef(ctxMenu)
              if (!ref || !aiEligible(ref, props.ai)) return null
              return (
                <button
                  type="button"
                  onClick={() => {
                    openAiBox(ref)
                    setCtxMenu(null)
                  }}
                  style={menuItem()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = grey[10]
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none"
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                      color: accent.base,
                      fontWeight: 600,
                    }}
                  >
                    <UiIcon name="sparkles" size={14} />
                    <span>Edit with AI</span>
                  </span>
                  <span style={{ ...type.micro, color: grey[40] }}>⌘J</span>
                </button>
              )
            })()}
            {/* --- end 3F AI surface --- */}
            {(() => {
              const scope = ctxMenu.scope
              const canPaste =
                scope === "widget" ? clip.hasWidget : clip.hasSection

              // The style trio is universal — every scope can carry a look.
              const styleTrio = [
                { action: "copyStyle", label: "Copy Style" },
                {
                  action: "pasteStyle",
                  label: "Paste Style",
                  disabled: !clip.hasStyle,
                },
                { action: "resetStyle", label: "Reset Style" },
              ]

              // The cursor was inside one repeated item (a slide, a banner
              // tile, a testimonial): offer to duplicate or delete THAT item —
              // the thing "duplicate a content" has always meant here.
              const itemOps = ctxMenu.itemField
                ? [
                    {
                      action: "duplicateItem",
                      label: `Duplicate ${ctxMenu.itemLabel}`,
                    },
                    {
                      action: "deleteItem",
                      label: `Delete ${ctxMenu.itemLabel}`,
                      danger: true,
                    },
                    { action: "sepItem", label: "-" },
                  ]
                : []

              // A theme ELEMENT (a heading inside a hero, say) is a field of its
              // section, not a free-standing object: it cannot be duplicated or
              // deleted on its own. Offering those would be a lie. Its appearance
              // CAN be copied around, so that is what it gets. Chrome regions
              // (header/footer) are singletons — same deal.
              const items =
                scope === "element" || scope === "chromeElement"
                  ? [
                      { action: "edit", label: "Edit Element" },
                      { action: "sep1", label: "-" },
                      ...itemOps,
                      ...styleTrio,
                    ]
                  : scope === "chrome"
                    ? [
                        { action: "edit", label: `Edit ${ctxMenu.label}` },
                        { action: "sep1", label: "-" },
                        ...styleTrio,
                      ]
                    : [
                        {
                          action: "edit",
                          label: scope === "widget" ? "Edit Widget" : "Edit Section",
                        },
                        ...(scope === "section" ? itemOps : []),
                        { action: "duplicate", label: "Duplicate", hint: "⌘D" },
                        { action: "copy", label: "Copy", hint: "⌘C" },
                        {
                          action: "paste",
                          label: "Paste",
                          hint: "⌘V",
                          disabled: !canPaste,
                        },
                        { action: "sep1", label: "-" },
                        ...styleTrio,
                        { action: "sep2", label: "-" },
                        { action: "delete", label: "Delete", danger: true },
                      ]
              return items as {
                action: string
                label: string
                hint?: string
                disabled?: boolean
                danger?: boolean
              }[]
            })().map((item) =>
              item.label === "-" ? (
                <div
                  key={item.action}
                  style={{
                    borderTop: hairline,
                    margin: "6px 0",
                  }}
                />
              ) : (
                <button
                  key={item.action}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    /* Phase 2B sender migration: STRUCTURAL rows dispatch
                       the same commands the shell's context handlers
                       execute; everything else (edit/copy/section-paste/
                       style trio) keeps the legacy ctxAction route —
                       those are selection + clipboard side-effects the
                       shell owns, not registry commands. */
                    const a = item.action
                    const scope = ctxMenu.scope
                    const i = ctxMenu.index
                    if (
                      (a === "duplicateItem" || a === "deleteItem") &&
                      ctxMenu.itemField != null &&
                      ctxMenu.itemIndex != null
                    ) {
                      postCommandToShell({
                        name: a === "duplicateItem" ? "item.duplicate" : "item.remove",
                        args: {
                          index: i,
                          field: ctxMenu.itemField,
                          itemIndex: ctxMenu.itemIndex,
                        },
                      })
                    } else if (scope === "widget" && ctxMenu.path && a === "duplicate") {
                      postCommandToShell({
                        name: "widget.duplicate",
                        args: { index: i, path: ctxMenu.path },
                      })
                    } else if (scope === "widget" && ctxMenu.path && a === "delete") {
                      postCommandToShell({
                        name: "widget.remove",
                        args: { index: i, path: ctxMenu.path },
                      })
                    } else if (scope === "widget" && ctxMenu.path && a === "paste") {
                      postCommandToShell({
                        name: "widget.paste",
                        args: { index: i, path: ctxMenu.path },
                      })
                    } else if (scope === "section" && a === "duplicate") {
                      postCommandToShell({
                        name: "section.duplicate",
                        args: { index: i },
                      })
                    } else if (scope === "section" && a === "delete") {
                      postCommandToShell({
                        name: "section.remove",
                        args: { index: i },
                      })
                    } else {
                      postToShell({
                        type: "cms:ctxAction",
                        action: a,
                        scope,
                        index: i,
                        path: ctxMenu.path,
                        elementKey: ctxMenu.elementKey,
                        region: ctxMenu.region,
                        itemField: ctxMenu.itemField,
                        itemIndex: ctxMenu.itemIndex,
                      })
                    }
                    setCtxMenu(null)
                  }}
                  style={menuItem({
                    disabled: item.disabled,
                    danger: item.danger,
                  })}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.background = grey[10]
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none"
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {CTX_ICONS[item.action] ? (
                      <UiIcon name={CTX_ICONS[item.action]} size={14} />
                    ) : null}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </span>
                  </span>
                  {item.hint ? (
                    <span style={{ ...type.micro, color: grey[40] }}>
                      {item.hint}
                    </span>
                  ) : null}
                </button>
              )
            )}
          </div>
        </>
      ) : null}

      {/* --- 3F AI surface: the selection-anchored prompt box + its
          staged-preview outline (ARCH-AI §2). ONE instance, mounted only
          when the canvas passes the ai context; it renders nothing until
          a sparkle / Cmd+J / context-menu row opens it. --- */}
      {props.ai ? <AiPromptBox ai={props.ai} previewMode={previewMode} /> : null}
      {/* --- end 3F AI surface --- */}
    </>
  )
}
