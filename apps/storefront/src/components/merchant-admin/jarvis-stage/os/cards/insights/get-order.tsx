"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"
import {
  Pill,
  Row,
  Empty,
  ErrorNote,
  fmtMoney,
  fmtDate,
  humanize,
  paymentTone,
  fulfillmentTone,
} from "./_shared"

type Item = { title?: string; qty?: number }
type Data = {
  order_no?: string | number
  status?: string
  payment?: string
  fulfillment?: string
  total?: number
  currency?: string
  customer?: string | null
  country?: string | null
  placed_at?: string
  ship_to?: string
  phone?: string | null
  items?: Item[]
  error?: string
}

export function GetOrderBody({ data, status }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't load that order.</Empty>
  if (!data) return <Empty>No order data.</Empty>
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>

  const items = Array.isArray(data.items) ? data.items : []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ ...t.micro, color: os.muted, marginBottom: 2 }}>Order</div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: os.text }}>
            #{String(data.order_no ?? "—")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...t.micro, color: os.muted, marginBottom: 2 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: os.emberDeep }}>
            {fmtMoney(data.total ?? 0, data.currency)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill tone={paymentTone(data.payment)}>{humanize(data.payment)}</Pill>
        <Pill tone={fulfillmentTone(data.fulfillment)}>{humanize(data.fulfillment)}</Pill>
        {data.status && <Pill tone="neutral">{humanize(data.status)}</Pill>}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <Row label="Customer" value={data.customer || "Guest"} />
        {data.ship_to && <Row label="Ship to" value={data.ship_to} />}
        {data.phone && <Row label="Phone" value={data.phone} />}
        <Row label="Placed" value={fmtDate(data.placed_at)} />
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...t.micro, color: os.muted }}>Items</span>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: "1px solid " + os.hairline }}>
              <span style={{ ...t.body, color: os.textDim, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.title || "Item"}
              </span>
              <span style={{ ...t.bodyStrong, color: os.text, flex: "0 0 auto" }}>× {Number(it.qty ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

registerCardBody("get_order", GetOrderBody as CardBody)
