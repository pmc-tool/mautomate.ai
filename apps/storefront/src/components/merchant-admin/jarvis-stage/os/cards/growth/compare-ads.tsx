"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import { Delta, StateError, StateUnavailable, Skeleton, fmtNum } from "../ops/_ui"

type Metric = { now?: number; last?: number; change?: number; pct?: number | null }
type Data =
  | {
      available?: boolean
      window_days?: number
      spend?: Metric
      conversions?: Metric
      clicks?: Metric
      impressions?: Metric
      note?: string
    }
  | null

function CompareRow({
  label,
  m,
  invert,
}: {
  label: string
  m?: Metric
  invert?: boolean
}) {
  const now = Number(m?.now) || 0
  const last = Number(m?.last) || 0
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: `1px solid ${os.hairline}`,
      }}
    >
      <span style={{ ...t.label, color: os.muted, flex: "0 0 92px" }}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <span style={{ ...t.title, color: os.text }}>{fmtNum(now)}</span>
        <span style={{ ...t.micro, color: os.faint }}>was {fmtNum(last)}</span>
      </div>
      <Delta change={Number(m?.change) || 0} pct={m?.pct ?? null} invert={invert} />
    </div>
  )
}

export function CompareAdsBody({ data, status }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={4} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message={data.note || "No ad account connected yet."} />
  }

  const days = Number(data.window_days) || 7

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ ...t.micro, color: os.muted }}>
        {`Last ${days} days vs the ${days} before`}
      </span>
      <div>
        <CompareRow label="Conversions" m={data.conversions} />
        <CompareRow label="Clicks" m={data.clicks} />
        <CompareRow label="Impressions" m={data.impressions} />
        <CompareRow label="Spend" m={data.spend} invert />
      </div>
    </div>
  )
}

registerCardBody("compare_ads", CompareAdsBody as CardBody)
