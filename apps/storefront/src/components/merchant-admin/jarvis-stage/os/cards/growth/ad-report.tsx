"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Hero,
  Pill,
  Eyebrow,
  StatGrid,
  BarList,
  StateError,
  StateUnavailable,
  Skeleton,
  titleCase,
  fmtNum,
  fmtMoney,
} from "../ops/_ui"

type Campaign = {
  name?: string | null
  status?: string | null
  spend?: number
  conversions?: number
  roas?: number | null
}
type Data =
  | {
      available?: boolean
      days?: number
      mock?: boolean
      spend?: number
      impressions?: number
      clicks?: number
      conversions?: number
      roas?: number | null
      currency?: string | null
      connected?: boolean
      per_campaign?: Campaign[]
      note?: string
    }
  | null

const fmtRoas = (r: unknown): string => {
  const v = Number(r)
  return Number.isFinite(v) && v > 0 ? `${v.toFixed(2)}x` : "—"
}

export function AdReportBody({ data, status }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={4} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message={data.note || "No ad account connected yet."} />
  }

  const days = Number(data.days) || 30
  const currency = data.currency ?? undefined
  const campaigns = (data.per_campaign ?? []).map((c) => ({
    label: c.name || "Campaign",
    value: Number(c.spend) || 0,
    sub: fmtRoas(c.roas),
  }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <Hero
          value={fmtMoney(data.spend, currency)}
          label={`Ad spend · last ${days} days`}
          accent
          sub={`ROAS ${fmtRoas(data.roas)}`}
        />
        {data.mock ? <Pill tone="idle">Sample</Pill> : data.connected ? <Pill tone="ok">Live</Pill> : null}
      </div>

      <StatGrid
        items={[
          { label: "Impressions", value: fmtNum(data.impressions) },
          { label: "Clicks", value: fmtNum(data.clicks) },
          { label: "Conversions", value: fmtNum(data.conversions), tone: (Number(data.conversions) || 0) > 0 ? "ok" : undefined },
          { label: "ROAS", value: fmtRoas(data.roas) },
        ]}
      />

      <div>
        <Eyebrow right="by spend">Campaigns</Eyebrow>
        <div style={{ marginTop: 6 }}>
          <BarList items={campaigns} emptyLabel="No campaigns running" />
        </div>
      </div>
    </div>
  )
}

registerCardBody("ad_report", AdReportBody as CardBody)
