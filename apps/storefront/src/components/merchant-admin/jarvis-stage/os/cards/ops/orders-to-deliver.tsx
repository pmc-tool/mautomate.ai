"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Hero,
  Pill,
  Eyebrow,
  ActionChip,
  StateEmpty,
  StateError,
  Skeleton,
  orderTone,
  titleCase,
  fmtMoney,
  timeAgo,
} from "./_ui"

type Row = {
  order_no?: string | number
  customer?: string | null
  total?: number
  currency?: string | null
  placed_at?: string | null
  fulfillment_state?: string | null
}
type Data = { count?: number; orders?: Row[]; error?: string } | null

function OrderRow({ r }: { r: Row }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: `1px solid ${os.hairline}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 2 }}>
        <span
          style={{
            ...t.bodyStrong,
            color: os.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          #{r.order_no ?? "—"}
          {r.customer ? <span style={{ ...t.body, color: os.muted }}>  ·  {r.customer}</span> : null}
        </span>
        <span style={{ ...t.micro, color: os.faint }}>{timeAgo(r.placed_at)}</span>
      </div>
      <span style={{ ...t.bodyStrong, color: os.text, flex: "0 0 auto" }}>
        {fmtMoney(r.total, r.currency)}
      </span>
      <Pill tone={orderTone(r.fulfillment_state)}>
        {titleCase(r.fulfillment_state) || "Awaiting"}
      </Pill>
    </div>
  )
}

export function OrdersToDeliverBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.error) return <StateError message={data.error} />

  const orders = data.orders ?? []
  const count = data.count ?? orders.length

  if (!count) {
    return <StateEmpty title="Nothing to ship" hint="Every paid order is already on its way." />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero value={count} label="Orders to deliver" accent sub="Paid, waiting to ship" />
      <div>
        <Eyebrow>Ship queue</Eyebrow>
        <div style={{ marginTop: 4 }}>
          {orders.map((r, i) => (
            <OrderRow key={i} r={r} />
          ))}
        </div>
      </div>
      <div>
        <ActionChip
          label="Fulfil these orders"
          onClick={() => send("Help me fulfil the orders that are waiting to ship")}
        />
      </div>
    </div>
  )
}

registerCardBody("orders_to_deliver", OrdersToDeliverBody as CardBody)
