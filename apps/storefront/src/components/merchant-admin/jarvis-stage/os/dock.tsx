"use client"

/* ------------------------------------------------------------------ */
/* Dock — the bottom card manager.                                      */
/*                                                                     */
/* Overflow cards (and any card the merchant minimizes) live here as       */
/* compact, touch-friendly chips: tool icon + label + a status dot. Tapping   */
/* a chip expands that card back to primary and the store auto-minimizes the   */
/* previously-focused one (single-expanded-focus). Beyond a visible budget      */
/* the extras collapse behind a "+N" chip that opens a scrollable sheet, so      */
/* even a very long conversation stays clean.                                     */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"
import { useJarvisOS } from "./os-provider"
import { getCardEntry } from "./card-registry"
import { Icon } from "./icons"
import type { Card } from "./card-store"
import { os, type as t, radius, motion, osChip, statusTone } from "./tokens"

function dotTone(card: Card): string {
  switch (card.status) {
    case "loading":
    case "applying":
      return statusTone("run").fg
    case "ready":
    case "done":
      return statusTone("ok").fg
    case "proposed":
      return statusTone("warn").fg
    case "error":
      return statusTone("error").fg
    default:
      return os.faint
  }
}

function DockChip({ card, onClick }: { card: Card; onClick: () => void }) {
  const entry = getCardEntry(card.tool)
  return (
    <button
      type="button"
      onClick={onClick}
      title={entry.title}
      style={{ ...osChip(false), maxWidth: 200 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = os.emberHairlineFocus
        e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = os.hairline
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      <Icon name={entry.icon} size={15} color={os.muted} />
      <span
        style={{
          ...t.label,
          color: os.textDim,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.title}
      </span>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotTone(card),
          flex: "0 0 auto",
          boxShadow: `0 0 6px ${dotTone(card)}`,
        }}
      />
    </button>
  )
}

export function Dock() {
  const { dock, focusCard } = useJarvisOS()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (dock.length === 0) return null

  const VISIBLE = 6
  const shown = dock.slice(0, VISIBLE)
  const extra = dock.slice(VISIBLE)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        overflowX: "auto",
        borderTop: `1px solid ${os.hairline}`,
        background: "rgba(255,255,255,0.66)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <span
        style={{
          ...t.micro,
          color: os.faint,
          flex: "0 0 auto",
          paddingRight: 2,
        }}
      >
        Cards
      </span>
      {shown.map((c) => (
        <DockChip key={c.id} card={c} onClick={() => focusCard(c.id)} />
      ))}
      {extra.length > 0 && (
        <button
          type="button"
          onClick={() => setSheetOpen((v) => !v)}
          style={{ ...osChip(sheetOpen), flex: "0 0 auto" }}
        >
          +{extra.length}
        </button>
      )}

      {sheetOpen && extra.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 14,
            maxWidth: "min(420px, 90vw)",
            maxHeight: "50vh",
            overflowY: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: 12,
            background: os.glassSolid,
            border: `1px solid ${os.hairlineStrong}`,
            borderRadius: radius.lg,
            boxShadow: os.cardShadowFocus,
            zIndex: 40,
            transition: `opacity ${motion.base}`,
          }}
        >
          {extra.map((c) => (
            <DockChip
              key={c.id}
              card={c}
              onClick={() => {
                focusCard(c.id)
                setSheetOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
