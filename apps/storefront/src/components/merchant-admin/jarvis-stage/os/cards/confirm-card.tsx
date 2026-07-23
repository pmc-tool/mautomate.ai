"use client"

/* ------------------------------------------------------------------ */
/* ConfirmCard — the WRITE body (propose -> confirm -> apply).           */
/*                                                                     */
/* Renders the plan summary + a labelled diff of `details`, then the       */
/* affordance the tier dictates: `soft` = one-tap Confirm; `hard` = type     */
/* the exact word (require_text) before Confirm enables. Handles applying/     */
/* done (+Undo) / error / expired states. All apply/undo goes through the       */
/* provider, which POSTs the plan token to /merchant/jarvis/apply.               */
/*                                                                              */
/* RICH PREVIEWS (additive): a tool MAY register a `ConfirmPreview` via          */
/* registerConfirmPreview(tool, Preview). When present it renders ABOVE the      */
/* summary + confirm controls and REPLACES the generic key/value detail block    */
/* for that tool. When absent, the generic detail rendering is unchanged. The     */
/* preview is purely presentational — the confirm/apply/undo/tier flow below is    */
/* untouched.                                                                       */
/* ------------------------------------------------------------------ */

import React, { useEffect, useState } from "react"
import type { Card } from "../card-store"
import { getConfirmPreview } from "../card-registry"
import { os, type as t, radius, motion, accent } from "../tokens"

function detailValue(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function humanKey(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

export function ConfirmCard({
  card,
  onApply,
  onUndo,
  onDismiss,
}: {
  card: Card
  onApply: (typed: string) => void
  onUndo: () => void
  onDismiss: () => void
}) {
  const c = card.confirm
  const [typed, setTyped] = useState("")
  const [expired, setExpired] = useState(false)

  // Watch the plan token expiry (120s TTL). Once past exp, force re-ask.
  useEffect(() => {
    if (!c) return
    const check = () => {
      if (Date.now() / 1000 > c.exp) setExpired(true)
    }
    check()
    const id = window.setInterval(check, 1000)
    return () => window.clearInterval(id)
  }, [c])

  if (!c) return <span style={{ ...t.body, color: os.muted }}>No change to confirm.</span>

  const status = card.status
  const isExpired = status === "expired" || (expired && status === "proposed")
  const hard = c.tier === "hard"
  const wordReady =
    !hard || (c.requireText != null && typed.trim().toUpperCase() === c.requireText.toUpperCase())
  const applying = status === "applying"

  const details = Object.entries(c.details || {})

  // Rich per-tool preview (additive). When registered it renders above the
  // summary and supersedes the generic detail block for this tool.
  const Preview = getConfirmPreview(card.tool)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Preview && (
        <Preview
          args={card.args ?? {}}
          details={(c.details ?? {}) as Record<string, unknown>}
          tier={c.tier}
          summary={c.summary}
        />
      )}

      <p style={{ ...t.body, color: os.textDim, margin: 0 }}>{c.summary}</p>

      {!Preview && details.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "8px 10px",
            background: "rgba(15,19,25,0.03)",
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.md,
          }}
        >
          {details.map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "3px 0",
              }}
            >
              <span style={{ ...t.label, color: os.muted }}>{humanKey(k)}</span>
              <span style={{ ...t.bodyStrong, color: os.textDim, textAlign: "right" }}>
                {detailValue(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* DONE */}
      {status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ ...t.bodyStrong, color: os.successFg }}>
            {c.applyMessage || "Done."}
          </span>
          {c.undo && (
            <button
              type="button"
              onClick={onUndo}
              style={{
                ...t.label,
                alignSelf: "flex-start",
                height: 34,
                padding: "0 14px",
                borderRadius: radius.md,
                background: "transparent",
                color: os.textDim,
                border: `1px solid ${os.hairlineStrong}`,
                cursor: "pointer",
              }}
            >
              {c.undo.label || "Undo"}
            </button>
          )}
        </div>
      )}

      {/* ERROR */}
      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ ...t.bodyStrong, color: os.danger }}>
            {c.applyMessage || card.error || "That didn't go through."}
          </span>
          <button
            type="button"
            onClick={() => onApply(typed)}
            style={confirmBtn(true)}
          >
            Try again
          </button>
        </div>
      )}

      {/* EXPIRED */}
      {isExpired && (
        <span style={{ ...t.body, color: os.faint }}>
          This request timed out for safety. Ask again to retry.
        </span>
      )}

      {/* PROPOSED / APPLYING */}
      {(status === "proposed" || applying) && !isExpired && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hard && (
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ ...t.micro, color: os.muted }}>
                Type {c.requireText} to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={c.requireText ?? ""}
                autoCapitalize="characters"
                spellCheck={false}
                disabled={applying}
                style={{
                  ...t.bodyStrong,
                  height: 40,
                  padding: "0 12px",
                  letterSpacing: "0.08em",
                  color: os.text,
                  background: "#FFFFFF",
                  border: `1px solid ${wordReady ? accent.base : os.hairlineStrong}`,
                  borderRadius: radius.md,
                  outline: "none",
                  transition: `border-color ${motion.fast}`,
                }}
              />
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!wordReady || applying}
              onClick={() => onApply(typed)}
              style={confirmBtn(wordReady && !applying)}
            >
              {applying ? "Working…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={applying}
              onClick={onDismiss}
              style={{
                ...t.bodyStrong,
                height: 40,
                padding: "0 16px",
                borderRadius: radius.md,
                background: "transparent",
                color: os.muted,
                border: `1px solid ${os.hairline}`,
                cursor: applying ? "default" : "pointer",
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function confirmBtn(active: boolean): React.CSSProperties {
  return {
    ...t.bodyStrong,
    height: 40,
    padding: "0 18px",
    borderRadius: radius.md,
    background: active ? accent.base : "rgba(242,101,34,0.25)",
    color: "#fff",
    border: "1px solid transparent",
    cursor: active ? "pointer" : "default",
    opacity: active ? 1 : 0.7,
    transition: `background ${motion.fast}, opacity ${motion.fast}`,
  }
}

export default ConfirmCard
