"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius, semantic } from "../../tokens"
import { Empty, ErrorNote, fmtNum, tapRow, toneColors, type Tone } from "./_shared"

type StockItem = { product?: string; variant?: string; available?: number }
type Data = { threshold?: number; count?: number; items?: StockItem[]; error?: string }

function qtyTone(n: number): Tone {
  if (n <= 0) return "danger"
  return "warn"
}

function QtyPill({ n }: { n: number }) {
  const c = toneColors(qtyTone(n))
  return (
    <span
      style={{
        ...t.micro,
        color: c.fg,
        background: c.bg,
        border: "1px solid " + c.border,
        borderRadius: radius.pill,
        padding: "3px 9px",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      {n <= 0 ? "Out of stock" : fmtNum(n) + " left"}
    </span>
  )
}

export function LowStockBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't read your stock.</Empty>
  if (!data) return <Empty>No stock data.</Empty>
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>

  const items = Array.isArray(data.items) ? data.items : []
  if (items.length === 0) {
    return (
      <div
        style={{
          ...t.body,
          color: semantic.successFg,
          background: semantic.successBg,
          border: "1px solid " + semantic.successBorder,
          borderRadius: radius.lg,
          padding: "12px",
          textAlign: "center",
        }}
      >
        Nothing low on stock{typeof data.threshold === "number" ? " (at or below " + data.threshold + ")" : ""}.
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={() => send('Restock \"' + (it.product || '') + '\"')}
          style={{ ...tapRow(), display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid " + os.hairline }}
        >
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ ...t.bodyStrong, color: os.text, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {it.product || "Product"}
            </span>
            {it.variant && it.variant !== "Default" && (
              <span style={{ ...t.label, color: os.muted }}>{it.variant}</span>
            )}
          </span>
          <QtyPill n={Number(it.available ?? 0)} />
        </button>
      ))}
    </div>
  )
}

registerCardBody("low_stock", LowStockBody as CardBody)
