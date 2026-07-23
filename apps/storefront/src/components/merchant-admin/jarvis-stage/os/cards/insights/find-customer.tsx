"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import { Stat, Empty, ErrorNote, fmtMoney, fmtDate, fmtNum, tapRow } from "./_shared"

type RecentOrder = { order_no?: string | number; total?: number; placed_at?: string }
type Data = {
  name?: string | null
  email?: string | null
  orders?: number
  total_spent?: number
  currency?: string
  recent?: RecentOrder[]
  error?: string
}

export function FindCustomerBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't look up that customer.</Empty>
  if (!data) return <Empty>No customer data.</Empty>
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>

  const recent = Array.isArray(data.recent) ? data.recent : []
  const initial = (data.name || data.email || "?").trim().charAt(0).toUpperCase() || "?"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: os.emberSoft,
            border: "1px solid " + os.emberHairline,
            color: os.emberDeep,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {initial}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...t.title, color: os.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.name || "Customer"}
          </div>
          {data.email && (
            <div style={{ ...t.label, color: os.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {data.email}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        <Stat label="Orders" value={fmtNum(data.orders ?? 0)} />
        <Stat label="Total spent" value={fmtMoney(data.total_spent ?? 0, data.currency)} ember />
      </div>

      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...t.micro, color: os.muted }}>Recent orders</span>
          {recent.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => send('Show me order #' + String(o.order_no ?? ''))}
              style={{ ...tapRow(), display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0", borderBottom: "1px solid " + os.hairline }}
            >
              <span style={{ ...t.bodyStrong, color: os.text }}>#{String(o.order_no ?? "—")}</span>
              <span style={{ ...t.label, color: os.muted }}>{fmtDate(o.placed_at)}</span>
              <span style={{ ...t.bodyStrong, color: os.textDim }}>{fmtMoney(o.total ?? 0, data.currency)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

registerCardBody("find_customer", FindCustomerBody as CardBody)
