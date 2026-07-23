"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, semantic } from "../../tokens"
import { Dot, CtaButton, Empty, type Tone } from "./_shared"

type Cta = { label?: string; prompt?: string; href?: string }
type Item = {
  id?: string
  severity?: "blocker" | "warn" | "info"
  title?: string
  detail?: string
  cta?: Cta
}
type Data = {
  ready_to_sell?: boolean
  items?: Item[]
}

const SEV_TONE: Record<string, Tone> = { blocker: "danger", warn: "warn", info: "info" }

export function NeedsAttentionBody({ data, status, send, navigate }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't check what needs attention.</Empty>
  if (!data) return <Empty>Nothing to show.</Empty>

  const items = Array.isArray(data.items) ? data.items : []

  if (items.length === 0) {
    return (
      <div
        style={{
          ...t.body,
          color: semantic.successFg,
          background: semantic.successBg,
          border: "1px solid " + semantic.successBorder,
          borderRadius: 10,
          padding: "12px 12px",
          textAlign: "center",
        }}
      >
        All clear — nothing needs your attention right now.
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item, i) => {
        const tone = SEV_TONE[item.severity || "info"] || "info"
        const cta = item.cta
        return (
          <div key={item.id || i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid " + os.hairline }}>
            <Dot tone={tone} />
            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ ...t.bodyStrong, color: os.text }}>{item.title || "Needs attention"}</span>
              {item.detail && <span style={{ ...t.label, color: os.muted, lineHeight: 1.45 }}>{item.detail}</span>}
              {cta && (cta.prompt || cta.href) && (
                <div style={{ marginTop: 4 }}>
                  <CtaButton
                    label={cta.label || "Fix this"}
                    primary={item.severity === "blocker"}
                    onClick={() => {
                      if (cta.href) navigate(cta.href)
                      else if (cta.prompt) send(cta.prompt)
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

registerCardBody("needs_attention", NeedsAttentionBody as CardBody)
