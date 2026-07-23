"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Hero,
  ActionChip,
  StateError,
  StateUnavailable,
  Skeleton,
  fmtNum,
} from "./_ui"

type Data =
  | { available?: boolean; open?: number; unread?: number; error?: string }
  | null

export function InboxStatusBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={2} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message="The inbox isn't connected on this store yet." />
  }

  const open = Number(data.open) || 0
  const unread = Number(data.unread) || 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            flex: "1 1 120px",
            padding: "12px 14px",
            background: os.glass,
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.lg,
          }}
        >
          <Hero value={fmtNum(unread)} label="Unread" accent={unread > 0} />
        </div>
        <div
          style={{
            flex: "1 1 120px",
            padding: "12px 14px",
            background: os.glass,
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.lg,
          }}
        >
          <Hero value={fmtNum(open)} label="Open threads" />
        </div>
      </div>
      <span style={{ ...t.body, color: os.muted }}>
        {unread > 0
          ? `${unread} conversation${unread === 1 ? "" : "s"} with unread messages.`
          : "You're all caught up on unread messages."}
      </span>
      {data.error ? (
        <span style={{ ...t.micro, color: os.faint }}>Some data may be incomplete.</span>
      ) : null}
      <div>
        <ActionChip
          label="Who needs a reply?"
          onClick={() => send("Show me the conversations that need a human reply")}
        />
      </div>
    </div>
  )
}

registerCardBody("inbox_status", InboxStatusBody as CardBody)
