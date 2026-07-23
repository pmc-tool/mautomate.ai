"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"
import {
  Pill,
  CtaButton,
  Empty,
  fmtMoney,
  fmtWhen,
  humanize,
  paymentTone,
  fulfillmentTone,
  tapRow,
} from "./_shared"

type Order = {
  order_no?: string | number
  status?: string
  payment?: string
  fulfillment?: string
  total?: number
  currency?: string
  customer?: string | null
  country?: string | null
  placed_at?: string
}
type Data = { orders?: Order[]; count?: number }

export function ListRecentOrdersBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't load your orders.</Empty>
  if (!data) return <Empty>No order data.</Empty>
  const orders = Array.isArray(data.orders) ? data.orders : []
  if (orders.length === 0) return <Empty>No orders yet.</Empty>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {orders.map((o, i) => (
        <button
          key={i}
          type="button"
          onClick={() => send('Show me order #' + String(o.order_no ?? ''))}
          style={{ ...tapRow(), padding: "9px 0", borderBottom: "1px solid " + os.hairline }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <span style={{ ...t.bodyStrong, color: os.text }}>#{String(o.order_no ?? "—")}</span>
            <span style={{ ...t.bodyStrong, color: os.text }}>{fmtMoney(o.total ?? 0, o.currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ ...t.label, color: os.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.customer || "Guest"}
              {o.placed_at ? " · " + fmtWhen(o.placed_at) : ""}
            </span>
            <span style={{ display: "flex", gap: 5, flex: "0 0 auto" }}>
              <Pill tone={paymentTone(o.payment)}>{humanize(o.payment)}</Pill>
              <Pill tone={fulfillmentTone(o.fulfillment)}>{humanize(o.fulfillment)}</Pill>
            </span>
          </div>
        </button>
      ))}
      <div style={{ marginTop: 8 }}>
        <CtaButton label="More orders" onClick={() => send("Show me my 25 most recent orders")} />
      </div>
    </div>
  )
}

registerCardBody("list_recent_orders", ListRecentOrdersBody as CardBody)
