"use client"

/* ------------------------------------------------------------------ */
/* KeyValueBody — the GENERIC card renderer.                            */
/*                                                                     */
/* Guarantees every tool_result is at least legible, with zero bespoke   */
/* code: scalars render as labelled rows (numbers emphasised), arrays of   */
/* objects as compact scrollable tables, arrays of scalars as chips, and    */
/* nested objects as indented key/value groups. This is the fallback the      */
/* CardHost uses whenever a tool has no registered Body.                       */
/* ------------------------------------------------------------------ */

import React from "react"
import type { CardBodyProps } from "../card-registry"
import { os, type as t, radius } from "../tokens"

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function humanKey(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

function fmtScalar(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2)
  return String(v)
}

/** A single number that reads big (the "hero" numeric of a result). */
function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ ...t.micro, color: os.muted }}>{humanKey(label)}</span>
      <span style={{ fontSize: 22, fontWeight: 600, color: os.text, lineHeight: 1.1 }}>
        {fmtScalar(value)}
      </span>
    </div>
  )
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "5px 0",
        borderBottom: `1px solid ${os.hairline}`,
      }}
    >
      <span style={{ ...t.label, color: os.muted, flex: "0 0 auto" }}>
        {humanKey(label)}
      </span>
      <span
        style={{
          ...t.bodyStrong,
          color: os.textDim,
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {fmtScalar(value)}
      </span>
    </div>
  )
}

/** Array of objects -> a compact table using the union of keys (max 6 cols). */
function Table({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set<string>())
  ).slice(0, 6)
  return (
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                style={{
                  ...t.micro,
                  color: os.muted,
                  textAlign: "left",
                  padding: "4px 10px 6px 0",
                  borderBottom: `1px solid ${os.hairlineStrong}`,
                  whiteSpace: "nowrap",
                }}
              >
                {humanKey(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 40).map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    color: os.textDim,
                    padding: "6px 10px 6px 0",
                    borderBottom: `1px solid ${os.hairline}`,
                    whiteSpace: "nowrap",
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isPlainObject(r[c]) || Array.isArray(r[c])
                    ? JSON.stringify(r[c])
                    : fmtScalar(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 40 && (
        <div style={{ ...t.label, color: os.faint, paddingTop: 6 }}>
          +{rows.length - 40} more
        </div>
      )}
    </div>
  )
}

function Chips({ values }: { values: unknown[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {values.slice(0, 40).map((v, i) => (
        <span
          key={i}
          style={{
            ...t.label,
            color: os.textDim,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.pill,
            padding: "2px 9px",
          }}
        >
          {fmtScalar(v)}
        </span>
      ))}
    </div>
  )
}

function renderValue(key: string, value: unknown, depth: number): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0)
      return <Row key={key} label={key} value="none" />
    if (value.every((v) => isPlainObject(v)))
      return (
        <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...t.micro, color: os.muted }}>{humanKey(key)}</span>
          <Table rows={value as Record<string, unknown>[]} />
        </div>
      )
    return (
      <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...t.micro, color: os.muted }}>{humanKey(key)}</span>
        <Chips values={value} />
      </div>
    )
  }
  if (isPlainObject(value)) {
    if (depth >= 2) return <Row key={key} label={key} value={JSON.stringify(value)} />
    return (
      <div
        key={key}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          paddingLeft: 10,
          borderLeft: `2px solid ${os.emberSoft}`,
        }}
      >
        <span style={{ ...t.micro, color: os.muted, paddingBottom: 2 }}>
          {humanKey(key)}
        </span>
        {Object.entries(value).map(([k, v]) => renderValue(k, v, depth + 1))}
      </div>
    )
  }
  return <Row key={key} label={key} value={value} />
}

export function KeyValueBody({ data }: CardBodyProps) {
  if (data === null || data === undefined)
    return <span style={{ ...t.body, color: os.muted }}>No data.</span>

  // Top-level array -> table / chips.
  if (Array.isArray(data)) {
    if (data.length === 0)
      return <span style={{ ...t.body, color: os.muted }}>Nothing here.</span>
    if (data.every((v) => isPlainObject(v)))
      return <Table rows={data as Record<string, unknown>[]} />
    return <Chips values={data} />
  }

  if (!isPlainObject(data))
    return <span style={{ ...t.body, color: os.textDim }}>{fmtScalar(data)}</span>

  const entries = Object.entries(data)
  // Promote up to three leading scalar numbers into a stat row.
  const scalarNums = entries.filter(
    ([, v]) => typeof v === "number"
  ) as [string, number][]
  const heroes = scalarNums.slice(0, 3)
  const heroKeys = new Set(heroes.map(([k]) => k))
  const rest = entries.filter(([k]) => !heroKeys.has(k))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {heroes.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            paddingBottom: 4,
          }}
        >
          {heroes.map(([k, v]) => (
            <Stat key={k} label={k} value={v} />
          ))}
        </div>
      )}
      {rest.map(([k, v]) => renderValue(k, v, 0))}
    </div>
  )
}

export default KeyValueBody
