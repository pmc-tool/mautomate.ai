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
  StateEmpty,
  StateError,
  StateUnavailable,
  Skeleton,
  emailTone,
  titleCase,
  timeAgo,
  fmtNum,
} from "./_ui"

type Recent = {
  subject?: string | null
  to?: string | null
  status?: string | null
  sent_at?: string | null
}
type Data =
  | {
      available?: boolean
      date?: string
      sent?: number
      delivered?: number
      opened?: number
      clicked?: number
      failed?: number
      total?: number
      recent?: Recent[]
      error?: string
      note?: string
    }
  | null

export function TodaysEmailBody({ data, status }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message="Email sending isn't set up on this store yet." />
  }
  if (data.error && !data.total) return <StateError message={data.error} />

  const total = Number(data.total) || 0
  const sent = Number(data.sent) || 0

  if (!total) {
    return <StateEmpty title="No email sent today" hint="Nothing has gone out since midnight." />
  }

  const recent = data.recent ?? []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Hero value={fmtNum(sent)} label="Emails sent today" accent sub={data.date ?? undefined} />

      <StatGrid
        items={[
          { label: "Delivered", value: fmtNum(data.delivered), tone: "ok" },
          { label: "Opened", value: fmtNum(data.opened) },
          { label: "Clicked", value: fmtNum(data.clicked) },
          {
            label: "Failed",
            value: fmtNum(data.failed),
            tone: (Number(data.failed) || 0) > 0 ? "error" : undefined,
          },
        ]}
      />

      {recent.length > 0 && (
        <div>
          <Eyebrow>Latest sends</Eyebrow>
          <div style={{ marginTop: 4 }}>
            {recent.map((r, i) => (
              <div
                key={i}
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
                    {r.subject || "(no subject)"}
                  </span>
                  <span
                    style={{
                      ...t.micro,
                      color: os.faint,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.to || "—"} · {timeAgo(r.sent_at)}
                  </span>
                </div>
                <Pill tone={emailTone(r.status)}>{titleCase(r.status) || "Sent"}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

registerCardBody("todays_email", TodaysEmailBody as CardBody)
