"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Hero,
  Pill,
  Eyebrow,
  StateEmpty,
  StateError,
  Skeleton,
  fmtMoney,
  timeAgo,
} from "./_ui"

type Stuck = {
  order_no?: string | number
  customer?: string | null
  days_waiting?: number
  total?: number
  currency?: string | null
  placed_at?: string | null
}
type Canceled = {
  order_no?: string | number
  customer?: string | null
  total?: number
  currency?: string | null
  placed_at?: string | null
  fulfillment_state?: string | null
}
type Data =
  | { count?: number; stuck?: Stuck[]; canceled_fulfillments?: Canceled[]; error?: string }
  | null

function IssueRow({
  orderNo,
  customer,
  total,
  currency,
  right,
}: {
  orderNo?: string | number
  customer?: string | null
  total?: number
  currency?: string | null
  right: React.ReactNode
}) {
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
          #{orderNo ?? "—"}
          {customer ? <span style={{ ...t.body, color: os.muted }}>  ·  {customer}</span> : null}
        </span>
        <span style={{ ...t.micro, color: os.faint }}>{fmtMoney(total, currency)}</span>
      </div>
      {right}
    </div>
  )
}

export function DeliveryIssuesBody({ data, status }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.error) return <StateError message={data.error} />

  const stuck = data.stuck ?? []
  const canceled = data.canceled_fulfillments ?? []
  const count = data.count ?? stuck.length + canceled.length

  if (!count) {
    return (
      <StateEmpty title="No delivery problems" hint="No stuck or canceled shipments right now." />
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Hero value={count} label="Delivery issues" accent sub="Stuck or canceled shipments" />

      {stuck.length > 0 && (
        <div>
          <Eyebrow right={`${stuck.length}`}>Stuck · paid, not shipped</Eyebrow>
          <div style={{ marginTop: 4 }}>
            {stuck.map((r, i) => (
              <IssueRow
                key={i}
                orderNo={r.order_no}
                customer={r.customer}
                total={r.total}
                currency={r.currency}
                right={
                  <Pill tone="warn">
                    {r.days_waiting != null ? `${r.days_waiting}d waiting` : "waiting"}
                  </Pill>
                }
              />
            ))}
          </div>
        </div>
      )}

      {canceled.length > 0 && (
        <div>
          <Eyebrow right={`${canceled.length}`}>Canceled shipments</Eyebrow>
          <div style={{ marginTop: 4 }}>
            {canceled.map((r, i) => (
              <IssueRow
                key={i}
                orderNo={r.order_no}
                customer={r.customer}
                total={r.total}
                currency={r.currency}
                right={<Pill tone="error">Canceled</Pill>}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

registerCardBody("delivery_issues", DeliveryIssuesBody as CardBody)
