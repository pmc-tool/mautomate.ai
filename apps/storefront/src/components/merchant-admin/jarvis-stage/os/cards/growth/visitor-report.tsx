"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"
import {
  Hero,
  Eyebrow,
  StatGrid,
  BarList,
  StateError,
  StateUnavailable,
  Skeleton,
  fmtNum,
} from "../ops/_ui"

type Page = { page?: string | null; views?: number }
type Source = { source?: string | null; visits?: number }
type Data =
  | {
      available?: boolean
      days?: number
      visitors?: number
      pageviews?: number
      visits?: number
      active_now?: number
      top_pages?: Page[]
      top_sources?: Source[]
      note?: string
    }
  | null

export function VisitorReportBody({ data, status }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={4} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message={data.note || "Traffic analytics aren't set up yet."} />
  }

  const visitors = Number(data.visitors) || 0
  const days = Number(data.days) || 7
  const active = Number(data.active_now) || 0
  const pages = (data.top_pages ?? []).map((p) => ({
    label: String(p.page ?? "/"),
    value: Number(p.views) || 0,
  }))
  const sources = (data.top_sources ?? []).map((s) => ({
    label: s.source || "direct",
    value: Number(s.visits) || 0,
  }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Hero
        value={fmtNum(visitors)}
        label={`Visitors · last ${days} day${days === 1 ? "" : "s"}`}
        accent
        sub={
          active > 0 ? (
            <span style={{ color: os.successFg }}>{fmtNum(active)} active right now</span>
          ) : (
            "Nobody browsing right now"
          )
        }
      />

      <StatGrid
        items={[
          { label: "Pageviews", value: fmtNum(data.pageviews) },
          { label: "Visits", value: fmtNum(data.visits) },
          { label: "Active now", value: fmtNum(active), tone: active > 0 ? "ok" : undefined },
        ]}
      />

      <div>
        <Eyebrow>Top pages</Eyebrow>
        <div style={{ marginTop: 6 }}>
          <BarList items={pages} emptyLabel="No page views yet" />
        </div>
      </div>

      <div>
        <Eyebrow>Traffic sources</Eyebrow>
        <div style={{ marginTop: 6 }}>
          <BarList items={sources} emptyLabel="No referrers yet" />
        </div>
      </div>
    </div>
  )
}

registerCardBody("visitor_report", VisitorReportBody as CardBody)
