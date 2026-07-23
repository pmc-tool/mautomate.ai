"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Hero,
  Pill,
  StatGrid,
  ActionChip,
  StateError,
  StateUnavailable,
  Skeleton,
  fmtNum,
} from "../ops/_ui"

type Data =
  | {
      available?: boolean
      agents?: number
      published?: number
      phone_numbers?: number
      calls_today?: number
      ready?: boolean
      guidance?: string
      error?: string
    }
  | null

export function CallCenterStatusBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message={data.guidance || "The call center isn't enabled yet."} />
  }
  if (data.error) return <StateError message={data.error} />

  const ready = !!data.ready
  const agents = Number(data.agents) || 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Hero
          value={agents === 0 ? "Not set up" : ready ? "Live" : "In setup"}
          label="AI call center"
          accent={ready}
        />
        <Pill tone={ready ? "ok" : agents === 0 ? "idle" : "warn"}>
          {ready ? "Taking calls" : agents === 0 ? "No agent" : "Unpublished"}
        </Pill>
      </div>

      <StatGrid
        items={[
          { label: "Agents", value: fmtNum(data.agents) },
          { label: "Published", value: fmtNum(data.published), tone: (Number(data.published) || 0) > 0 ? "ok" : undefined },
          { label: "Numbers", value: fmtNum(data.phone_numbers) },
          { label: "Calls today", value: fmtNum(data.calls_today) },
        ]}
      />

      {data.guidance ? (
        <span style={{ ...t.body, color: os.muted }}>{data.guidance}</span>
      ) : null}

      {!ready ? (
        <div>
          <ActionChip
            label={agents === 0 ? "Set up my voice agent" : "Finish call center setup"}
            onClick={() =>
              send(
                agents === 0
                  ? "Help me set up an AI voice agent for my store"
                  : "What's left to get my call center taking calls?"
              )
            }
          />
        </div>
      ) : null}
    </div>
  )
}

registerCardBody("call_center_status", CallCenterStatusBody as CardBody)
