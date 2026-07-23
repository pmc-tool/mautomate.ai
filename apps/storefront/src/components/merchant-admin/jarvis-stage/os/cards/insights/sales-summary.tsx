"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"
import { Stat, Bar, CtaButton, Empty, ErrorNote, fmtMoney, fmtNum } from "./_shared"

type Data = {
  days?: number
  orders?: number
  revenue?: number
  aov?: number
  currency?: string
  error?: string
}

export function SalesSummaryBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't read your sales.</Empty>
  if (!data) return <Empty>No sales data.</Empty>
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>

  const days = data.days ?? 30
  const revenue = data.revenue ?? 0
  const orders = data.orders ?? 0
  const aov = data.aov ?? 0
  const cur = data.currency
  // paidCount is not returned directly, but revenue = aov * paidCount, so it is
  // recoverable when aov > 0 — an honest 'paid of placed' ratio, no fabrication.
  const paid = aov > 0 ? Math.min(orders, Math.round(revenue / aov)) : 0
  const dailyAvg = days > 0 ? revenue / days : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ ...t.micro, color: os.muted, marginBottom: 3 }}>Revenue · last {fmtNum(days)} days</div>
        <div style={{ fontFamily: "inherit", fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.025em", color: os.emberDeep }}>
          {fmtMoney(revenue, cur)}
        </div>
      </div>

      {orders > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", ...t.label, color: os.muted }}>
            <span>Paid orders</span>
            <span style={{ color: os.textDim }}>{fmtNum(paid)} of {fmtNum(orders)} placed</span>
          </div>
          <Bar value={paid} max={orders} tone={"success"} />
        </div>
      )}

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        <Stat label="Orders placed" value={fmtNum(orders)} />
        <Stat label="Avg order" value={fmtMoney(aov, cur)} />
        <Stat label="Per day" value={fmtMoney(dailyAvg, cur)} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <CtaButton label="Recent orders" onClick={() => send("Show me my recent orders")} />
        <CtaButton label="Sales this week" onClick={() => send("How were my sales in the last 7 days?")} />
      </div>
    </div>
  )
}

registerCardBody("sales_summary", SalesSummaryBody as CardBody)
