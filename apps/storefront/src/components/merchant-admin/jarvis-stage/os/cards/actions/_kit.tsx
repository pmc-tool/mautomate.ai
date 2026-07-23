"use client"

/* ------------------------------------------------------------------ */
/* Confirm-preview kit — shared primitives for the rich WRITE previews. */
/*                                                                     */
/* Token-only (no hardcoded hex). Every primitive degrades gracefully   */
/* when a detail field is missing/null. These render INSIDE ConfirmCard, */
/* ABOVE its summary + confirm controls — never a card frame of their own.*/
/* ------------------------------------------------------------------ */

import React from "react"
import { os, type as t, radius, statusTone } from "../../tokens"

/* ---------------- value coercion (defensive) ---------------- */

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string") return v.trim() ? v.trim() : null
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return null
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x) ?? "").filter(Boolean)
  return []
}

export function money(amount: unknown, currency?: unknown): string {
  const n = num(amount)
  if (n === null) return "—"
  const s = n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  const cur = str(currency)
  return cur ? `${cur} ${s}` : s
}

export function stripHtml(html: unknown): string {
  const s = str(html)
  if (!s) return ""
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

export function wordCount(textOrHtml: unknown): number {
  const plain = stripHtml(textOrHtml)
  if (!plain) return 0
  return plain.split(/\s+/).filter(Boolean).length
}

export function dateLabel(v: unknown): string | null {
  const s = str(v)
  const n = num(v)
  const d = n !== null ? new Date(n) : s ? new Date(s) : null
  if (!d || isNaN(d.getTime())) return s
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

/* ---------------- primitives ---------------- */

export function Panel({
  eyebrow,
  accentColor,
  bar,
  children,
}: {
  eyebrow?: string
  accentColor?: string
  bar?: boolean
  children: React.ReactNode
}) {
  const ac = accentColor ?? os.muted
  return (
    <div
      style={{
        border: `1px solid ${os.hairline}`,
        borderLeft: bar ? `3px solid ${ac}` : `1px solid ${os.hairline}`,
        borderRadius: radius.md,
        background: os.glassRaised,
        overflow: "hidden",
      }}
    >
      {eyebrow != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderBottom: `1px solid ${os.hairline}`,
          }}
        >
          <span style={{ ...t.micro, color: ac }}>{eyebrow}</span>
        </div>
      )}
      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: React.ReactNode
  strong?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
      }}
    >
      <span style={{ ...t.label, color: os.muted, flex: "0 0 auto" }}>{label}</span>
      <span
        style={{
          ...(strong ? t.bodyStrong : t.body),
          color: os.textDim,
          textAlign: "right",
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  )
}

export type Tone = "ok" | "warn" | "run" | "error" | "idle"

export function Tag({ children, tone = "idle" }: { children: React.ReactNode; tone?: Tone }) {
  const st = statusTone(tone)
  return (
    <span
      style={{
        ...t.micro,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: radius.pill,
        background: st.bg,
        color: st.fg,
        border: `1px solid ${st.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  )
}

export function Chips({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it, i) => (
        <span
          key={`${it}-${i}`}
          style={{
            ...t.micro,
            textTransform: "none",
            letterSpacing: "normal",
            padding: "3px 8px",
            borderRadius: radius.pill,
            background: os.emberSoft,
            color: os.textDim,
            border: `1px solid ${os.hairline}`,
          }}
        >
          {it}
        </span>
      ))}
    </div>
  )
}

export function WarnBanner({ children }: { children: React.ReactNode }) {
  const st = statusTone("warn")
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "9px 11px",
        background: st.bg,
        border: `1px solid ${st.border}`,
        borderRadius: radius.md,
        color: st.fg,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: "0 0 auto" }}
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span style={{ ...t.label, color: st.fg }}>{children}</span>
    </div>
  )
}

/** A prominent amount / hero number. */
export function Amount({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span style={{ ...t.heading, color: tone ?? os.text, letterSpacing: "-0.01em" }}>
      {children}
    </span>
  )
}
