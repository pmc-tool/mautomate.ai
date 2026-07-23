"use client"

/* ------------------------------------------------------------------ */
/* Shared body primitives for the OPS + GROWTH bespoke cards.           */
/*                                                                     */
/* Tokens-only, dependency-free. Every OPS/GROWTH card body composes     */
/* these so the whole queue/analytics set reads as one system: hero        */
/* numbers, stat grids, tone pills, inline-SVG bar lists and deltas, and     */
/* the four graceful states (loading / empty / error / unavailable).          */
/* Nothing here draws a card frame — bodies live inside CardShell.             */
/* ------------------------------------------------------------------ */

import React from "react"
import { os, type as t, radius, statusTone } from "../../tokens"

export type Tone = "run" | "ok" | "warn" | "error" | "idle"

/* ------------------------------- format --------------------------------- */

export function fmtNum(n: unknown): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return "0"
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function fmtMoney(n: unknown, currency?: string | null): string {
  const v = Number(n) || 0
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(v)
    } catch {
      /* unknown currency code — fall through */
    }
  }
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function fmtPct(n: unknown): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${Math.round(v)}%`
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function titleCase(s?: string | null): string {
  if (!s) return ""
  return String(s)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

/* ----------------------------- tone mapping ----------------------------- */

export function orderTone(state?: string | null): Tone {
  switch (String(state ?? "").toLowerCase()) {
    case "delivered":
    case "shipped":
      return "ok"
    case "partially_fulfilled":
    case "partially_shipped":
      return "run"
    case "canceled":
    case "cancelled":
      return "error"
    default:
      return "warn"
  }
}

export function emailTone(status?: string | null): Tone {
  switch (String(status ?? "").toLowerCase()) {
    case "opened":
    case "clicked":
    case "delivered":
      return "ok"
    case "sent":
      return "run"
    case "bounced":
    case "failed":
    case "complained":
      return "error"
    default:
      return "idle"
  }
}

/* ------------------------------- atoms ---------------------------------- */

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = statusTone(tone)
  return (
    <span
      style={{
        ...t.micro,
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: radius.pill,
        padding: "2px 8px",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      {children}
    </span>
  )
}

export function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <span style={{ ...t.micro, color: os.muted }}>{children}</span>
      {right != null && <span style={{ ...t.micro, color: os.faint }}>{right}</span>}
    </div>
  )
}

export function Hero({
  value,
  label,
  sub,
  accent,
}: {
  value: React.ReactNode
  label: string
  sub?: React.ReactNode
  accent?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ ...t.micro, color: os.muted }}>{label}</span>
      <span
        style={{
          fontSize: 34,
          fontWeight: 650,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: accent ? os.emberDeep : os.text,
        }}
      >
        {value}
      </span>
      {sub != null && <span style={{ ...t.label, color: os.muted }}>{sub}</span>}
    </div>
  )
}

export function StatGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; tone?: Tone }[]
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(84px, 1fr))`,
        gap: 10,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "9px 11px",
            background: os.glass,
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.md,
          }}
        >
          <span style={{ ...t.micro, color: os.muted }}>{it.label}</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.15,
              color: it.tone ? statusTone(it.tone).fg : os.text,
            }}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Horizontal inline-SVG-free bar list (div fills). Value on the right. */
export function BarList({
  items,
  emptyLabel = "Nothing yet",
}: {
  items: { label: string; value: number; sub?: string; tone?: Tone }[]
  emptyLabel?: string
}) {
  if (!items.length) {
    return <span style={{ ...t.body, color: os.faint }}>{emptyLabel}</span>
  }
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0))
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((it, i) => {
        const pct = Math.max(3, Math.round(((Number(it.value) || 0) / max) * 100))
        const fill = it.tone ? statusTone(it.tone).fg : os.emberDeep
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span
                style={{
                  ...t.label,
                  color: os.textDim,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.label}
              </span>
              <span style={{ ...t.bodyStrong, color: os.text, flex: "0 0 auto" }}>
                {fmtNum(it.value)}
                {it.sub ? <span style={{ ...t.micro, color: os.faint }}> {it.sub}</span> : null}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: radius.pill,
                background: os.hairline,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: radius.pill,
                  background: fill,
                  opacity: it.tone ? 1 : 0.85,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Up/down delta chip. Positive is good by default; pass invert for cost-like. */
export function Delta({
  change,
  pct,
  invert = false,
}: {
  change: number
  pct: number | null
  invert?: boolean
}) {
  const flat = !change
  const up = change > 0
  const good = flat ? null : invert ? !up : up
  const color = good == null ? os.muted : good ? os.successFg : os.danger
  const arrow = flat ? "→" : up ? "▲" : "▼"
  return (
    <span
      style={{
        ...t.label,
        color,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flex: "0 0 auto",
      }}
    >
      <span style={{ fontSize: 10 }}>{arrow}</span>
      {pct == null ? (flat ? "no change" : "new") : `${Math.abs(pct)}%`}
    </span>
  )
}

/* ------------------------------- states --------------------------------- */

export function StateEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0" }}>
      <span style={{ ...t.bodyStrong, color: os.textDim }}>{title}</span>
      {hint && <span style={{ ...t.body, color: os.faint }}>{hint}</span>}
    </div>
  )
}

export function StateError({ message }: { message?: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "9px 11px",
        borderRadius: radius.md,
        background: statusTone("error").bg,
        border: `1px solid ${statusTone("error").border}`,
      }}
    >
      <span style={{ ...t.body, color: os.danger }}>
        {message || "Something went wrong reading this."}
      </span>
    </div>
  )
}

export function StateUnavailable({ message }: { message?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0" }}>
      <span style={{ ...t.bodyStrong, color: os.textDim }}>Not set up yet</span>
      <span style={{ ...t.body, color: os.faint }}>
        {message || "This isn't enabled on your store yet."}
      </span>
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ height: 30, width: "45%", borderRadius: radius.md, background: os.hairline }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: `${90 - i * 12}%`,
            borderRadius: radius.pill,
            background: os.hairline,
          }}
        />
      ))}
    </div>
  )
}

/** A tappable pill button that re-enters the chat loop. */
export function ActionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...t.label,
        display: "inline-flex",
        alignItems: "center",
        minHeight: 34,
        padding: "0 12px",
        borderRadius: radius.pill,
        background: os.emberSoft,
        border: `1px solid ${os.emberHairline}`,
        color: os.emberDeep,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  )
}
