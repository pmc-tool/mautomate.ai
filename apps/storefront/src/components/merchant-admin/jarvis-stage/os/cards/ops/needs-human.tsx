"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Hero,
  Pill,
  Eyebrow,
  ActionChip,
  StateEmpty,
  StateError,
  StateUnavailable,
  Skeleton,
  titleCase,
  timeAgo,
} from "./_ui"

type Thread = {
  channel?: string | null
  from?: string | null
  last_message?: string | null
  waiting_since?: string | null
  status?: string | null
}
type Data =
  | { available?: boolean; count?: number; threads?: Thread[]; error?: string }
  | null

function ChannelTag({ channel }: { channel?: string | null }) {
  return (
    <span
      style={{
        ...t.micro,
        color: os.textDim,
        background: os.glass,
        border: `1px solid ${os.hairline}`,
        borderRadius: radius.pill,
        padding: "2px 8px",
        flex: "0 0 auto",
      }}
    >
      {titleCase(channel) || "Chat"}
    </span>
  )
}

function ThreadRow({ th }: { th: Thread }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "9px 0",
        borderBottom: `1px solid ${os.hairline}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ChannelTag channel={th.channel} />
        <span
          style={{
            ...t.bodyStrong,
            color: os.text,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {th.from || "Unknown"}
        </span>
        <span style={{ ...t.micro, color: os.faint, flex: "0 0 auto" }}>
          {timeAgo(th.waiting_since)}
        </span>
      </div>
      {th.last_message ? (
        <span
          style={{
            ...t.body,
            color: os.muted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {th.last_message}
        </span>
      ) : null}
      {th.status ? (
        <div>
          <Pill tone="warn">{titleCase(th.status)}</Pill>
        </div>
      ) : null}
    </div>
  )
}

export function NeedsHumanBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.available === false) {
    return <StateUnavailable message="The inbox isn't connected on this store yet." />
  }
  if (data.error && !(data.threads && data.threads.length)) {
    return <StateError message={data.error} />
  }

  const threads = data.threads ?? []
  const count = data.count ?? threads.length

  if (!count) {
    return <StateEmpty title="Nobody's waiting" hint="No conversations need a human right now." />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero value={count} label="Waiting for a human" accent sub="Across every channel" />
      <div>
        <Eyebrow>Needs you</Eyebrow>
        <div style={{ marginTop: 4 }}>
          {threads.map((th, i) => (
            <ThreadRow key={i} th={th} />
          ))}
        </div>
      </div>
      <div>
        <ActionChip label="Open the inbox" onClick={() => send("Show me the conversations that need a reply")} />
      </div>
    </div>
  )
}

registerCardBody("needs_human", NeedsHumanBody as CardBody)
