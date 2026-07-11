"use client"

/* ------------------------------------------------------------------ */
/* Generic recursive field editor                                       */
/*                                                                     */
/* Renders editable inputs for any block's data object (strings, numbers,*/
/* booleans, arrays, nested objects) so every block is editable without  */
/* a bespoke form per block. Image-like keys get a URL input + preview.  */
/* ------------------------------------------------------------------ */

import React from "react"

const IMAGE_KEY = /image|logo|avatar|cover|photo|thumb|icon|src|img/i
const LONG_KEY = /body|description|content|html|text|excerpt|quote|message/i

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#6b7280",
  margin: "10px 0 4px",
}
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  color: "#111827",
  background: "#fff",
}
const groupStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "8px 10px",
  margin: "6px 0",
  background: "#fafafa",
}

const prettyLabel = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

function ValueEditor({
  name,
  value,
  onChange,
}: {
  name: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  // String
  if (typeof value === "string") {
    if (IMAGE_KEY.test(name)) {
      return (
        <div>
          <input
            style={inputStyle}
            value={value}
            placeholder="Image URL"
            onChange={(e) => onChange(e.target.value)}
          />
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              style={{
                marginTop: 6,
                maxHeight: 64,
                maxWidth: "100%",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
      )
    }
    if (LONG_KEY.test(name) || value.length > 60) {
      return (
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
    return (
      <input style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} />
    )
  }

  // Number
  if (typeof value === "number") {
    return (
      <input
        type="number"
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    )
  }

  // Boolean
  if (typeof value === "boolean") {
    return (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {value ? "On" : "Off"}
      </label>
    )
  }

  // Array
  if (Array.isArray(value)) {
    return (
      <div>
        {value.map((item, i) => (
          <div key={i} style={groupStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
                Item {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                style={{
                  border: "1px solid #fecaca",
                  background: "#fff",
                  color: "#b91c1c",
                  borderRadius: 5,
                  fontSize: 11,
                  padding: "2px 8px",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
            <ValueEditor
              name={name}
              value={item}
              onChange={(v) => onChange(value.map((it, idx) => (idx === i ? v : it)))}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const template = value[0]
            const blank =
              template && typeof template === "object" && !Array.isArray(template)
                ? Object.fromEntries(
                    Object.entries(template as Record<string, unknown>).map(([k, v]) => [
                      k,
                      typeof v === "string"
                        ? ""
                        : typeof v === "number"
                        ? 0
                        : typeof v === "boolean"
                        ? false
                        : Array.isArray(v)
                        ? []
                        : v,
                    ])
                  )
                : typeof template === "string"
                ? ""
                : template ?? ""
            onChange([...value, blank])
          }}
          style={{
            width: "100%",
            border: "1px dashed #93c5fd",
            background: "#eff6ff",
            color: "#1d4ed8",
            borderRadius: 6,
            fontSize: 12,
            padding: "6px",
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          + Add item
        </button>
      </div>
    )
  }

  // Object
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    return (
      <div style={groupStyle}>
        {Object.keys(obj).map((k) => (
          <div key={k}>
            <label style={labelStyle}>{prettyLabel(k)}</label>
            <ValueEditor
              name={k}
              value={obj[k]}
              onChange={(v) => onChange({ ...obj, [k]: v })}
            />
          </div>
        ))}
      </div>
    )
  }

  // null / undefined — offer a text input
  return (
    <input
      style={inputStyle}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Edit a block's data object. Hides internal keys (block_type/schema_version). */
export default function FieldEditor({
  data,
  onChange,
}: {
  data: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  const keys = Object.keys(data).filter(
    (k) => k !== "block_type" && k !== "schema_version" && k !== "id"
  )
  if (keys.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        This block has no editable fields.
      </p>
    )
  }
  return (
    <div>
      {keys.map((k) => (
        <div key={k}>
          <label style={labelStyle}>{prettyLabel(k)}</label>
          <ValueEditor
            name={k}
            value={data[k]}
            onChange={(v) => onChange({ ...data, [k]: v })}
          />
        </div>
      ))}
    </div>
  )
}
