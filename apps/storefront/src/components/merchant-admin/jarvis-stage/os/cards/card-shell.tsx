"use client"

/* ------------------------------------------------------------------ */
/* CardShell — the ONE frame every card wears.                          */
/*                                                                     */
/* Header (tool icon + title + status badge + minimize/dismiss), a body   */
/* slot (KeyValueBody, a bespoke Wave 2 body, or ConfirmCard), and an       */
/* optional footer. Bespoke bodies NEVER re-implement this chrome — they      */
/* only fill the body. The shell also carries the data-attributes the         */
/* SignalLines overlay reads to anchor its conduits.                           */
/*                                                                     */
/* Canvas v2: the header doubles as the DRAG handle and a bottom-right         */
/* corner is the RESIZE handle (both opt-in via props, desktop `free` mode      */
/* only). `fill` makes the shell fill its absolutely-positioned wrapper; `touch` */
/* enlarges controls to >= 44px for the mobile `stack` mode.                     */
/* ------------------------------------------------------------------ */

import React from "react"
import type { Card } from "../card-store"
import type { RegistryEntry } from "../card-registry"
import { Icon } from "../icons"
import { useJarvisDesign } from "../design"
import {
  os,
  type as t,
  radius,
  motion,
  glassSurface,
  osIconButton,
  statusTone,
} from "../tokens"

/** v2 status dot colour by lifecycle tone. */
const V2_DOT: Record<ReturnType<typeof statusMeta>["tone"], string> = {
  run: os.ember,
  ok: "#4C9A6E",
  warn: "#B54708",
  error: os.danger,
  idle: os.faint,
}

function statusMeta(card: Card): { label: string; tone: Parameters<typeof statusTone>[0] } {
  switch (card.status) {
    case "spawning":
    case "loading":
      return { label: "Working", tone: "run" }
    case "ready":
      return { label: "Ready", tone: "ok" }
    case "proposed":
      return { label: card.confirm?.tier === "hard" ? "Confirm" : "Review", tone: "warn" }
    case "applying":
      return { label: "Applying", tone: "run" }
    case "done":
      return { label: "Done", tone: "ok" }
    case "error":
      return { label: "Error", tone: "error" }
    case "expired":
      return { label: "Expired", tone: "idle" }
    default:
      return { label: "", tone: "idle" }
  }
}

function HeaderButton({
  label,
  size,
  onClick,
  children,
}: {
  label: string
  size: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Stop the header's drag pointerdown from firing when a control is hit.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={osIconButton(size)}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = os.text
        e.currentTarget.style.borderColor = os.hairlineStrong
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = os.muted
        e.currentTarget.style.borderColor = os.hairline
      }}
    >
      {children}
    </button>
  )
}

export function CardShell({
  card,
  entry,
  focused,
  onMinimize,
  onDismiss,
  onFocus,
  children,
  onDragStart,
  onResizeStart,
  dragging = false,
  touch = false,
  fill = false,
}: {
  card: Card
  entry: RegistryEntry
  focused: boolean
  onMinimize: () => void
  onDismiss: () => void
  onFocus: () => void
  children: React.ReactNode
  /** Pointer-down on the header begins a drag (desktop free mode). */
  onDragStart?: (e: React.PointerEvent) => void
  /** Pointer-down on the corner begins a resize (desktop free mode). */
  onResizeStart?: (e: React.PointerEvent) => void
  /** True while THIS card is actively being dragged (kills transitions). */
  dragging?: boolean
  /** Mobile stack mode — enlarge controls to >= 44px touch targets. */
  touch?: boolean
  /** Fill the (absolutely-positioned) wrapper: height 100%, body flexes. */
  fill?: boolean
}) {
  const [design] = useJarvisDesign()
  const v2 = design === "v2"
  const meta = statusMeta(card)
  const tone = statusTone(meta.tone)
  const accentColor = entry.accent ?? os.ember
  const btnSize = touch ? 44 : 30
  const draggable = !!onDragStart
  const working =
    card.status === "spawning" || card.status === "loading" || card.status === "applying"
  // v2: the verb subline shows only while the tool is actually doing something;
  // a settled card is just icon + title + dot.
  const showSubtitle = !v2 || working || card.status === "error"

  return (
    <section
      data-jarvis-card={card.id}
      data-jarvis-focus={focused ? "1" : "0"}
      data-jarvis-loading={card.status === "loading" || card.status === "applying" ? "1" : "0"}
      onClick={focused ? undefined : onFocus}
      className={v2 ? "jv2-card" : undefined}
      style={{
        ...glassSurface(focused),
        ...(v2 && working ? { borderColor: os.emberHairlineFocus } : {}),
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: fill ? "100%" : undefined,
        cursor: focused ? "default" : "pointer",
        transition: dragging
          ? "none"
          : `box-shadow ${motion.slow}, border-color ${motion.base}, transform ${motion.base}`,
      }}
    >
      {/* header — also the drag handle in free mode */}
      <header
        onPointerDown={onDragStart}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: touch ? "12px 12px" : "10px 12px",
          borderBottom: `1px solid ${os.hairline}`,
          cursor: draggable ? (dragging ? "grabbing" : "grab") : undefined,
          touchAction: draggable ? "none" : undefined,
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.md,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: os.emberSoft,
            border: `1px solid ${os.emberHairline}`,
            color: accentColor,
            flex: "0 0 auto",
          }}
        >
          <Icon name={entry.icon} size={16} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <span
            style={{
              ...t.title,
              color: os.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.title}
          </span>
          {showSubtitle && (
            <span
              style={{
                ...t.micro,
                color: os.faint,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {card.label || card.tool}
            </span>
          )}
        </div>
        {v2 ? (
          // One quiet signal: a dot. Ember pulses while working, sage when done.
          <span
            aria-label={meta.label || undefined}
            title={meta.label || undefined}
            className={meta.tone === "run" ? "jv2-dot-run" : undefined}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: V2_DOT[meta.tone],
              flex: "0 0 auto",
              transition: `background ${motion.base}`,
            }}
          />
        ) : (
          meta.label && (
            <span
              style={{
                ...t.micro,
                color: tone.fg,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                borderRadius: radius.pill,
                padding: "3px 9px",
                flex: "0 0 auto",
              }}
            >
              {meta.label}
            </span>
          )
        )}
        <div
          className={v2 && !touch ? "jv2-card-controls" : undefined}
          style={{ display: "flex", gap: 6, flex: "0 0 auto" }}
        >
          <HeaderButton label="Minimize" size={btnSize} onClick={onMinimize}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </HeaderButton>
          <HeaderButton label="Dismiss" size={btnSize} onClick={onDismiss}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </HeaderButton>
        </div>
      </header>

      {/* body */}
      <div
        style={
          fill
            ? { padding: "12px", overflow: "auto", flex: 1, minHeight: 0 }
            : {
                padding: "12px",
                overflow: "auto",
                maxHeight: focused ? "min(56vh, 460px)" : "min(38vh, 320px)",
              }
        }
      >
        {children}
      </div>

      {/* resize handle — bottom-right corner, free mode only */}
      {onResizeStart && (
        <div
          aria-hidden="true"
          onPointerDown={(e) => {
            e.stopPropagation()
            onResizeStart(e)
          }}
          onClick={(e) => e.stopPropagation()}
          title="Resize"
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 18,
            height: 18,
            cursor: "nwse-resize",
            touchAction: "none",
            borderRight: `2px solid ${os.hairlineStrong}`,
            borderBottom: `2px solid ${os.hairlineStrong}`,
            borderBottomRightRadius: radius.md,
            opacity: 0.7,
          }}
        />
      )}
    </section>
  )
}
