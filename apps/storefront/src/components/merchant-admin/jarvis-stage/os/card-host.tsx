"use client"

/* ------------------------------------------------------------------ */
/* CardHost — the CARD CANVAS v2 (accumulate · drag · resize · adaptive). */
/*                                                                     */
/* Cards ACCUMULATE across commands (the store no longer wipes on a new     */
/* turn) and live on an absolute-position PACKING CANVAS that never overlaps   */
/* — a skyline/shelf packer (packing.ts) seeds each new card into the first     */
/* free cell while reserving the centre ORB-GUTTER so nothing covers the mA      */
/* core. Drag a card by its header to reposition; drag the corner to resize;      */
/* both re-pack the rest. A ResizeObserver drives two modes: `free` (desktop,      */
/* drag+resize) and `stack` (<= 900px: one full-width scrollable column, no drag). */
/*                                                                                  */
/* The card-store owns lifecycle (status/minimized/dismissed/slot/turn); this      */
/* component owns SPATIAL layout via a local canvas-layout store (use-canvas-        */
/* layout.ts) — os-provider deliberately exposes no dispatch for positions, so       */
/* the interactive board is a self-contained projection of activeCards() here.        */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useJarvisOS } from "./os-provider"
import { getCardEntry, type CardBodyProps } from "./card-registry"
import type { Card } from "./card-store"
import { CardShell } from "./cards/card-shell"
import { ConfirmCard } from "./cards/confirm-card"
import { KeyValueBody } from "./cards/key-value-body"
import { os, type as t, radius, motion } from "./tokens"
import { useCanvasLayout } from "./use-canvas-layout"
import {
  type Geom,
  computeBlocked,
  maxPlaceableWidth,
  toPx,
  pxToCell,
  pxToSize,
  contentRows,
} from "./packing"

const NARROW = 900
const GAP = 14
const ROW_H = 8
const COL_TARGET = 116 // aim for ~116px columns; clamp count to keep them legible
const MIN_CARD_PX = 132 // resize floor

type Mode = "free" | "stack"
type ViewState = { mode: Mode; geom: Geom; cap: number }

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function sameGeom(a: Geom, b: Geom): boolean {
  return (
    a.cols === b.cols &&
    Math.abs(a.colW - b.colW) < 0.5 &&
    a.rowH === b.rowH &&
    a.gap === b.gap &&
    a.maxPlaceable === b.maxPlaceable &&
    a.blocked.length === b.blocked.length &&
    a.blocked.join(",") === b.blocked.join(",")
  )
}

function computeView(width: number, height: number, gutter: number): ViewState {
  if (width <= NARROW) {
    return {
      mode: "stack",
      geom: {
        cols: 1,
        colW: Math.max(0, width - 2 * GAP),
        rowH: ROW_H,
        gap: GAP,
        blocked: [],
        maxPlaceable: 1,
      },
      cap: 12,
    }
  }
  const cols = clamp(Math.round(width / COL_TARGET), 8, 16)
  const colW = (width - (cols + 1) * GAP) / cols
  const blocked = computeBlocked(width, gutter, cols, colW, GAP)
  const maxPlaceable = maxPlaceableWidth(cols, blocked)
  const rows = Math.max(1, Math.floor((height - 24) / 240))
  const cap = clamp(2 * rows + 1, 4, 12)
  return {
    mode: "free",
    geom: { cols, colW, rowH: ROW_H, gap: GAP, blocked, maxPlaceable },
    cap,
  }
}

/* ------------------------------ card body --------------------------- */

function LoadingBody({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: `2px solid ${os.emberHairline}`,
          borderTopColor: os.ember,
          animation: "jvspin .7s linear infinite",
        }}
      />
      <span style={{ color: os.muted, fontSize: 13 }}>Fetching {label.toLowerCase()}…</span>
      <style>{`@keyframes jvspin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){ .jvspin{animation:none} }`}</style>
    </div>
  )
}

function CardView({
  card,
  focused,
  fill,
  touch,
  dragging,
  onFocus,
  onDragStart,
  onResizeStart,
}: {
  card: Card
  focused: boolean
  fill: boolean
  touch: boolean
  dragging: boolean
  onFocus: () => void
  onDragStart?: (e: React.PointerEvent) => void
  onResizeStart?: (e: React.PointerEvent) => void
}) {
  const { minimizeCard, dismissCard, applyConfirm, applyUndo, send, navigate } =
    useJarvisOS()
  const entry = getCardEntry(card.tool)

  let body: React.ReactNode
  if (card.kind === "write") {
    body = (
      <ConfirmCard
        card={card}
        onApply={(typed) => applyConfirm(card, typed)}
        onUndo={() => applyUndo(card)}
        onDismiss={() => dismissCard(card.id)}
      />
    )
  } else {
    const Body = entry.Body ?? KeyValueBody
    const props: CardBodyProps = {
      data: card.data,
      status: card.status,
      toolName: card.tool,
      callId: card.id,
      args: card.args,
      send,
      navigate,
    }
    body =
      card.status === "loading" ? (
        <LoadingBody label={entry.title} />
      ) : (
        <Body {...props} />
      )
  }

  return (
    <CardShell
      card={card}
      entry={entry}
      focused={focused}
      fill={fill}
      touch={touch}
      dragging={dragging}
      onFocus={onFocus}
      onMinimize={() => minimizeCard(card.id)}
      onDismiss={() => dismissCard(card.id)}
      onDragStart={onDragStart}
      onResizeStart={onResizeStart}
    >
      {body}
    </CardShell>
  )
}

/* ------------------------------ the host ---------------------------- */

export function CardHost({ gutter }: { gutter: number }) {
  const { cards, focusId, setCapacity } = useJarvisOS()
  const [layout, dispatchLayout] = useCanvasLayout()
  const wrapRef = useRef<HTMLDivElement>(null)

  const [view, setView] = useState<ViewState>(() =>
    computeView(1200, 700, gutter)
  )
  const viewRef = useRef(view)
  viewRef.current = view

  // live refs for the pointer handlers (which live outside the render closure)
  const geomRef = useRef(view.geom)
  geomRef.current = view.geom
  const layoutsRef = useRef(layout.layouts)
  layoutsRef.current = layout.layouts

  /* ------------------- measure -> mode / geom / capacity ------------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const next = computeView(el.clientWidth, el.clientHeight, gutter)
      setCapacity(next.cap)
      const prev = viewRef.current
      if (prev.mode === next.mode && prev.cap === next.cap && sameGeom(prev.geom, next.geom))
        return
      setView(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [gutter, setCapacity])

  /* ------------------- reconcile active cards -> layout -------------- */
  const cardHints = useMemo(
    () => cards.map((c) => ({ id: c.id, kind: c.kind })),
    [cards]
  )
  const hintsKey = useMemo(
    () => cardHints.map((c) => `${c.id}:${c.kind}`).join("|"),
    [cardHints]
  )
  const prevGeomRef = useRef<Geom | null>(null)
  useEffect(() => {
    const geom = view.geom
    const prev = prevGeomRef.current
    const geomChanged = !prev || !sameGeom(prev, geom)
    prevGeomRef.current = geom
    dispatchLayout({ type: "RECONCILE", cards: cardHints, geom, geomChanged })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsKey, view])

  /* ------------------------------ drag ------------------------------- */
  const dragRef = useRef<{
    id: string
    pointerId: number
    sx: number
    sy: number
    ox: number
    oy: number
    moved: boolean
    ctrl: AbortController
  } | null>(null)
  const [drag, setDrag] = useState<{ id: string; left: number; top: number } | null>(null)
  const justDraggedRef = useRef(false)

  const dragMove = useCallback((ev: PointerEvent) => {
    const d = dragRef.current
    if (!d || ev.pointerId !== d.pointerId) return
    const dx = ev.clientX - d.sx
    const dy = ev.clientY - d.sy
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
    setDrag({ id: d.id, left: Math.max(0, d.ox + dx), top: Math.max(0, d.oy + dy) })
  }, [])

  const dragEnd = useCallback(
    (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      d.ctrl.abort()
      dragRef.current = null
      if (d.moved) {
        const g = geomRef.current
        const left = Math.max(0, d.ox + (ev.clientX - d.sx))
        const top = Math.max(0, d.oy + (ev.clientY - d.sy))
        const cell = pxToCell(left, top, g)
        dispatchLayout({ type: "MOVE_CARD", id: d.id, x: cell.x, y: cell.y })
        justDraggedRef.current = true
        setTimeout(() => {
          justDraggedRef.current = false
        }, 0)
      }
      setDrag(null)
    },
    [dispatchLayout]
  )

  const startDrag = useCallback(
    (e: React.PointerEvent, card: Card) => {
      if (viewRef.current.mode !== "free") return
      if ((e.target as HTMLElement).closest("button")) return
      const rect = layoutsRef.current[card.id]
      if (!rect) return
      const box = toPx(rect, geomRef.current)
      const ctrl = new AbortController()
      dragRef.current = {
        id: card.id,
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        ox: box.left,
        oy: box.top,
        moved: false,
        ctrl,
      }
      setDrag({ id: card.id, left: box.left, top: box.top })
      window.addEventListener("pointermove", dragMove, { signal: ctrl.signal })
      window.addEventListener("pointerup", dragEnd, { signal: ctrl.signal })
      window.addEventListener("pointercancel", dragEnd, { signal: ctrl.signal })
      e.preventDefault()
    },
    [dragMove, dragEnd]
  )

  /* ----------------------------- resize ------------------------------ */
  const resizeRef = useRef<{
    id: string
    pointerId: number
    sx: number
    sy: number
    ow: number
    oh: number
    ctrl: AbortController
  } | null>(null)
  const [resize, setResize] = useState<{ id: string; width: number; height: number } | null>(
    null
  )

  const resizeMove = useCallback((ev: PointerEvent) => {
    const r = resizeRef.current
    if (!r || ev.pointerId !== r.pointerId) return
    const w = Math.max(MIN_CARD_PX, r.ow + (ev.clientX - r.sx))
    const h = Math.max(MIN_CARD_PX, r.oh + (ev.clientY - r.sy))
    setResize({ id: r.id, width: w, height: h })
  }, [])

  const resizeEnd = useCallback(
    (ev: PointerEvent) => {
      const r = resizeRef.current
      if (!r) return
      r.ctrl.abort()
      resizeRef.current = null
      const g = geomRef.current
      const w = Math.max(MIN_CARD_PX, r.ow + (ev.clientX - r.sx))
      const h = Math.max(MIN_CARD_PX, r.oh + (ev.clientY - r.sy))
      const size = pxToSize(w, h, g)
      dispatchLayout({ type: "RESIZE_CARD", id: r.id, w: size.w, h: size.h })
      setResize(null)
    },
    [dispatchLayout]
  )

  const startResize = useCallback(
    (e: React.PointerEvent, card: Card) => {
      if (viewRef.current.mode !== "free") return
      const rect = layoutsRef.current[card.id]
      if (!rect) return
      const box = toPx(rect, geomRef.current)
      const ctrl = new AbortController()
      resizeRef.current = {
        id: card.id,
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        ow: box.width,
        oh: box.height,
        ctrl,
      }
      setResize({ id: card.id, width: box.width, height: box.height })
      window.addEventListener("pointermove", resizeMove, { signal: ctrl.signal })
      window.addEventListener("pointerup", resizeEnd, { signal: ctrl.signal })
      window.addEventListener("pointercancel", resizeEnd, { signal: ctrl.signal })
      e.preventDefault()
    },
    [resizeMove, resizeEnd]
  )

  const { focusCard } = useJarvisOS()
  const makeFocus = useCallback(
    (id: string) => () => {
      if (justDraggedRef.current) return
      focusCard(id)
    },
    [focusCard]
  )

  /* ------------------------------ render ----------------------------- */

  // MOBILE: single full-width scrollable column, ordered by turn then slot.
  if (view.mode === "stack") {
    const ordered = cards
      .slice()
      .sort((a, b) => (a.turn !== b.turn ? a.turn - b.turn : a.slot - b.slot))
    return (
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          zIndex: 20,
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "8px 12px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {ordered.map((c) => (
          <div key={c.id} style={{ width: "100%" }}>
            <CardView
              card={c}
              focused={c.id === focusId}
              fill={false}
              touch
              dragging={false}
              onFocus={makeFocus(c.id)}
            />
          </div>
        ))}
      </div>
    )
  }

  // DESKTOP: absolute packing canvas.
  const geom = view.geom
  const rows = contentRows(layout.layouts)
  const canvasHeight = rows * (geom.rowH + geom.gap) + geom.gap * 2

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        zIndex: 20,
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        padding: 0,
      }}
    >
      {cards.length > 1 && (
        <button
          type="button"
          onClick={() => dispatchLayout({ type: "AUTO_ARRANGE" })}
          title="Tidy the board"
          style={{
            position: "sticky",
            top: 6,
            float: "right",
            marginRight: 10,
            zIndex: 5,
            ...t.micro,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            padding: "0 11px",
            borderRadius: radius.pill,
            background: os.glass,
            border: `1px solid ${os.hairline}`,
            color: os.muted,
            cursor: "pointer",
            backdropFilter: os.blur,
            WebkitBackdropFilter: os.blur,
            boxShadow: "0 1px 2px rgba(31,26,20,0.05)",
          }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          Tidy
        </button>
      )}

      <div style={{ position: "relative", width: "100%", minHeight: canvasHeight }}>
        {cards.map((c) => {
          const rect = layout.layouts[c.id]
          if (!rect) return null
          const box = toPx(rect, geom)
          const isDragging = drag?.id === c.id
          const isResizing = resize?.id === c.id
          const left = isDragging ? drag!.left : box.left
          const top = isDragging ? drag!.top : box.top
          const width = isResizing ? resize!.width : box.width
          const height = isResizing ? resize!.height : box.height
          const active = isDragging || isResizing
          return (
            <div
              key={c.id}
              style={{
                position: "absolute",
                left,
                top,
                width,
                height,
                zIndex: active ? 30 : c.id === focusId ? 3 : 1,
                transition: active
                  ? "none"
                  : `left ${motion.base}, top ${motion.base}, width ${motion.base}, height ${motion.base}`,
              }}
            >
              <CardView
                card={c}
                focused={c.id === focusId}
                fill
                touch={false}
                dragging={active}
                onFocus={makeFocus(c.id)}
                onDragStart={(e) => startDrag(e, c)}
                onResizeStart={(e) => startResize(e, c)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
