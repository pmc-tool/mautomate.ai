"use client"

import React from "react"
import type { CardBodyProps, CardBody } from "../../card-registry"
import { registerCardBody } from "../../card-registry"
import { os, type as t, radius, semantic } from "../../tokens"
import { Bar, Pill, CtaButton, Empty, humanize } from "./_shared"

type Task = {
  task?: string
  done?: boolean
  required?: boolean
  why?: string | null
  blocker?: string | null
}
type Data = {
  ready_to_sell?: boolean
  percent?: number
  required_percent?: number
  missing_required?: string[]
  tasks?: Task[]
}

function CheckGlyph({ done }: { done: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        flex: "0 0 auto",
        marginTop: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: done ? semantic.successBg : os.glass,
        border: "1px solid " + (done ? semantic.successBorder : os.hairlineStrong),
        color: done ? semantic.successFg : os.faint,
      }}
    >
      {done ? (
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12l5 5L20 6" />
        </svg>
      ) : (
        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </span>
  )
}

export function CheckReadinessBody({ data, status, send, navigate }: CardBodyProps<Data>) {
  if (status === "error") return <Empty>Couldn't check readiness.</Empty>
  if (!data) return <Empty>No readiness data.</Empty>

  const percent = Math.max(0, Math.min(100, Math.round(data.percent ?? 0)))
  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  const ready = data.ready_to_sell === true

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ ...t.micro, color: os.muted, marginBottom: 2 }}>Setup complete</div>
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: ready ? semantic.successFg : os.emberDeep }}>
            {percent}%
          </div>
        </div>
        <Pill tone={ready ? "success" : "warn"}>{ready ? "Ready to sell" : "Not ready"}</Pill>
      </div>

      <Bar value={percent} max={100} tone={ready ? "success" : "ember"} />

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {tasks.length === 0 ? (
          <Empty>No setup steps to show.</Empty>
        ) : (
          tasks.map((task, i) => {
            const done = task.done === true
            const detail = !done ? task.blocker || task.why : null
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid " + os.hairline }}>
                <CheckGlyph done={done} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ ...t.bodyStrong, color: done ? os.muted : os.text, textDecoration: done ? "line-through" : "none" }}>
                      {humanize(task.task) === "—" ? "Setup step" : humanize(task.task)}
                    </span>
                    {task.required && !done && (
                      <span style={{ ...t.micro, color: semantic.warnFg }}>Required</span>
                    )}
                  </div>
                  {detail && (
                    <div style={{ ...t.label, color: os.muted, marginTop: 2, lineHeight: 1.45 }}>{detail}</div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {!ready && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <CtaButton label="Finish setup" primary onClick={() => navigate("/dashboard/setup")} />
          <CtaButton label="What's blocking me?" onClick={() => send("What is stopping my store from selling right now?")} />
        </div>
      )}
    </div>
  )
}

registerCardBody("check_readiness", CheckReadinessBody as CardBody)
