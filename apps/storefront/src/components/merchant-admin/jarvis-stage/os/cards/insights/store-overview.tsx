"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"
import { Stat, Pill, Row, CtaButton, Empty, humanize, fmtNum, type Tone } from "./_shared"

type Data = {
  store_name?: string | null
  country?: string | null
  currency?: string | null
  ready_to_sell?: boolean | null
  product_count?: number
  order_count?: number
  active_theme?: string | null
}

function readiness(v: boolean | null | undefined): { tone: Tone; label: string } {
  if (v === true) return { tone: "success", label: "Ready to sell" }
  if (v === false) return { tone: "warn", label: "Not ready" }
  return { tone: "neutral", label: "Setup unknown" }
}

export function StoreOverviewBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't load your store.</Empty>
  if (!data) return <Empty>No store data.</Empty>

  const r = readiness(data.ready_to_sell)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ ...t.heading, color: os.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.store_name || "Your store"}
        </span>
        <Pill tone={r.tone}>{r.label}</Pill>
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        <Stat label="Products" value={fmtNum(data.product_count ?? 0)} />
        <Stat label="Orders" value={fmtNum(data.order_count ?? 0)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <Row label="Country" value={data.country ? String(data.country).toUpperCase() : "—"} />
        <Row label="Currency" value={data.currency ? String(data.currency).toUpperCase() : "—"} />
        <Row label="Theme" value={data.active_theme ? humanize(data.active_theme) : "—"} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {data.ready_to_sell === false && (
          <CtaButton label="What's left to set up?" primary onClick={() => send("What's left to set up on my store?")} />
        )}
        <CtaButton label="Recent orders" onClick={() => send("Show me my recent orders")} />
      </div>
    </div>
  )
}

registerCardBody("store_overview", StoreOverviewBody as CardBody)
