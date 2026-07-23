"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t } from "../../tokens"
import {
  Hero,
  Pill,
  Eyebrow,
  BarList,
  StateEmpty,
  StateError,
  StateUnavailable,
  Skeleton,
  titleCase,
  fmtNum,
  type Tone,
} from "../ops/_ui"

type Topic = { topic?: string | null; count?: number }
type Data =
  | {
      available?: boolean
      calls_today?: number
      by_status?: Record<string, number>
      top_topics?: Topic[]
      note?: string
    }
  | null

const statusToTone = (s: string): Tone => {
  switch (s.toLowerCase()) {
    case "completed":
    case "answered":
      return "ok"
    case "in_progress":
    case "ringing":
      return "run"
    case "missed":
    case "failed":
      return "error"
    default:
      return "idle"
  }
}

export function CallTopicsBody({ data, status }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message={data.note || "The call center isn't enabled yet."} />
  }

  const calls = Number(data.calls_today) || 0
  if (!calls) {
    return <StateEmpty title="No calls today" hint="Nobody has called since midnight." />
  }

  const topics = (data.top_topics ?? []).map((tp) => ({
    label: titleCase(tp.topic) || "Other",
    value: Number(tp.count) || 0,
  }))
  const statuses = Object.entries(data.by_status ?? {})

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Hero value={fmtNum(calls)} label="Calls today" accent />

      {statuses.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {statuses.map(([s, n]) => (
            <Pill key={s} tone={statusToTone(s)}>
              {titleCase(s)} · {fmtNum(n)}
            </Pill>
          ))}
        </div>
      )}

      <div>
        <Eyebrow>What callers asked</Eyebrow>
        <div style={{ marginTop: 6 }}>
          <BarList items={topics} emptyLabel="No topics captured yet" />
        </div>
      </div>
    </div>
  )
}

registerCardBody("call_topics", CallTopicsBody as CardBody)
