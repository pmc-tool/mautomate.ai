"use client"

/* ------------------------------------------------------------------ */
/* Insights cards — shared primitives.                                  */
/*                                                                     */
/* Small, token-only building blocks reused by the 9 bespoke read/insight */
/* bodies: money/number/date formatters, big Stat, status Pill + tone maps, */
/* proportion Bar, KV Row, severity Dot, CTA button, Empty + Error notes.    */
/* Tokens ONLY — no hardcoded colors, no card frame (CardShell owns that).    */
/* ------------------------------------------------------------------ */

import React from "react"
import { os, type as t, radius, semantic, accent, font } from "../../tokens"

/* ------------------------------- format -------------------------------- */

/** Money arrives in WHOLE currency units (spec §2). */
export function fmtMoney(value: unknown, currency?: string): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!isFinite(n)) return "—"
  const cur = (currency || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n)
  } catch {
    return cur + " " + n.toLocaleString()
  }
}

export function fmtNum(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value)
  if (!isFinite(n)) return "—"
  return n.toLocaleString()
}

export function fmtDate(iso: unknown): string {
  if (!iso) return "—"
  const d = new Date(String(iso))
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function fmtWhen(iso: unknown): string {
  if (!iso) return "—"
  const d = new Date(String(iso))
  if (isNaN(d.getTime())) return "—"
  const diff = Date.now() - d.getTime()
  const day = 86400000
  if (diff < 0) return fmtDate(iso)
  if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "m ago"
  if (diff < day) return Math.round(diff / 3600000) + "h ago"
  if (diff < 7 * day) return Math.round(diff / day) + "d ago"
  return fmtDate(iso)
}

export function humanize(s: unknown): string {
  if (s === null || s === undefined || s === "") return "—"
  return String(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

/* -------------------------------- tone --------------------------------- */

export type Tone = "success" | "warn" | "danger" | "info" | "neutral" | "ember"

export function toneColors(tone: Tone): { fg: string; bg: string; border: string } {
  switch (tone) {
    case "success":
      return { fg: semantic.successFg, bg: semantic.successBg, border: semantic.successBorder }
    case "warn":
      return { fg: semantic.warnFg, bg: semantic.warnBg, border: semantic.warnBorder }
    case "danger":
      return { fg: semantic.dangerFg, bg: semantic.dangerBg, border: semantic.dangerBorder }
    case "info":
      return { fg: semantic.infoFg, bg: semantic.infoBg, border: os.hairlineStrong }
    case "ember":
      return { fg: accent.active, bg: os.emberSoft, border: os.emberHairlineFocus }
    default:
      return { fg: os.muted, bg: os.glass, border: os.hairline }
  }
}

export function paymentTone(status: unknown): Tone {
  const s = String(status || "").toLowerCase()
  if (/refund/.test(s)) return "danger"
  if (/partial/.test(s)) return "warn"
  if (/captured|paid/.test(s)) return "success"
  if (/await|authoriz|not_paid|pending/.test(s)) return "warn"
  return "neutral"
}

export function fulfillmentTone(status: unknown): Tone {
  const s = String(status || "").toLowerCase()
  if (/cancel/.test(s)) return "danger"
  if (/^not_|not_fulfil|await|partial|pending/.test(s)) return "warn"
  if (/ship|deliver|fulfil/.test(s)) return "success"
  return "neutral"
}

/* ----------------------------- primitives ------------------------------ */

export function Stat({
  label,
  value,
  ember,
}: {
  label: string
  value: React.ReactNode
  ember?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ ...t.micro, color: os.muted }}>{label}</span>
      <span
        style={{
          fontFamily: font,
          fontSize: 25,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: ember ? os.emberDeep : os.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const c = toneColors(tone)
  return (
    <span
      style={{
        ...t.micro,
        color: c.fg,
        background: c.bg,
        border: "1px solid " + c.border,
        borderRadius: radius.pill,
        padding: "3px 8px",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  )
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid " + os.hairline,
      }}
    >
      <span style={{ ...t.label, color: os.muted, flex: "0 0 auto" }}>{label}</span>
      <span style={{ ...t.bodyStrong, color: os.textDim, textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  )
}

export function Bar({ value, max, tone = "ember" }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const c = toneColors(tone)
  return (
    <div style={{ height: 8, borderRadius: radius.pill, background: os.hairline, overflow: "hidden", width: "100%" }}>
      <div
        style={{
          height: "100%",
          width: (pct * 100).toFixed(1) + "%",
          background: tone === "ember" ? os.emberDeep : c.fg,
          borderRadius: radius.pill,
          transition: "width 240ms",
        }}
      />
    </div>
  )
}

export function Dot({ tone }: { tone: Tone }) {
  const c = toneColors(tone)
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: 999,
        background: c.fg,
        flex: "0 0 auto",
        display: "inline-block",
        marginTop: 5,
      }}
    />
  )
}

export function CtaButton({
  label,
  onClick,
  primary,
}: {
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        ...t.label,
        fontFamily: font,
        minHeight: 40,
        padding: "0 14px",
        borderRadius: radius.pill,
        cursor: "pointer",
        whiteSpace: "nowrap",
        border: "1px solid " + (primary ? os.emberHairlineFocus : os.hairline),
        background: primary ? os.emberSoft : os.glass,
        color: primary ? accent.active : os.textDim,
        transition: "background 120ms, border-color 120ms",
      }}
    >
      {label}
    </button>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...t.body, color: os.muted, padding: "12px 2px", textAlign: "center" }}>{children}</div>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ...t.body,
        color: semantic.dangerFg,
        background: semantic.dangerBg,
        border: "1px solid " + semantic.dangerBorder,
        borderRadius: radius.md,
        padding: "9px 11px",
      }}
    >
      {children}
    </div>
  )
}

/** Row-tap affordance shared by list bodies. */
export function tapRow(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    padding: 0,
    fontFamily: font,
  }
}
