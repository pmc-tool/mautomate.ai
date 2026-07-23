"use client"

import React from "react"
import type { CardBody, CardBodyProps } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius } from "../../tokens"
import {
  Pill,
  Eyebrow,
  ActionChip,
  StateError,
  Skeleton,
  titleCase,
} from "../ops/_ui"

type Domain = {
  domain?: string | null
  is_primary?: boolean
  ssl_status?: string | null
  verification_status?: string | null
  live?: boolean
}
type Data =
  | {
      default_address?: string
      custom_domains?: Domain[]
      connected?: boolean
      pending?: boolean
      guidance?: string
      error?: string
    }
  | null

export function DomainStatusBody({ data, status, send }: CardBodyProps<Data>) {
  if (status === "loading" || status === "spawning") return <Skeleton lines={3} />
  if (status === "error") return <StateError />
  if (!data) return <StateError message="No data." />
  if (data.error) return <StateError message={data.error} />

  const connected = !!data.connected
  const pending = !!data.pending
  const customs = data.custom_domains ?? []

  const headline = connected ? "Custom domain live" : pending ? "Verification pending" : "Default address"
  const tone = connected ? "ok" : pending ? "warn" : "idle"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderRadius: radius.lg,
          background: os.glass,
          border: `1px solid ${connected ? os.emberHairline : os.hairline}`,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: radius.pill,
            flex: "0 0 auto",
            background: connected ? os.successFg : pending ? os.ember : os.faint,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <span style={{ ...t.bodyStrong, color: os.text }}>{headline}</span>
          <span
            style={{
              ...t.body,
              color: os.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {data.default_address || "—"}
          </span>
        </div>
        <Pill tone={tone as any}>{connected ? "Live" : pending ? "Pending" : "Default"}</Pill>
      </div>

      {customs.length > 0 && (
        <div>
          <Eyebrow>Custom domains</Eyebrow>
          <div style={{ marginTop: 4 }}>
            {customs.map((d, i) => (
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
                    {d.domain}
                    {d.is_primary ? (
                      <span style={{ ...t.micro, color: os.faint }}>  · primary</span>
                    ) : null}
                  </span>
                  <span style={{ ...t.micro, color: os.faint }}>
                    SSL {titleCase(d.ssl_status) || "—"} · {titleCase(d.verification_status) || "unverified"}
                  </span>
                </div>
                <Pill tone={d.live ? "ok" : "warn"}>{d.live ? "Live" : "Pending"}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.guidance ? <span style={{ ...t.body, color: os.muted }}>{data.guidance}</span> : null}

      {!connected ? (
        <div>
          <ActionChip
            label="How do I connect my domain?"
            onClick={() => send("Walk me through connecting my own custom domain")}
          />
        </div>
      ) : null}
    </div>
  )
}

registerCardBody("domain_status", DomainStatusBody as CardBody)
