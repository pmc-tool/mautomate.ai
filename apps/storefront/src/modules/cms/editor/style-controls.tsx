"use client"

/* ------------------------------------------------------------------ */
/* Style/Advanced field controls — one widget per universal FieldType   */
/*                                                                     */
/* These render the Style + Advanced tabs of SchemaPanel. Each control   */
/* is self-contained and defensive (undefined value => empty state) and  */
/* emits EXACTLY the value shape that render/style-engine.ts             */
/* (buildSectionCss) already understands. Responsiveness is handled one  */
/* level up by SchemaPanel: it resolves the per-device leaf, hands it to */
/* a control as `value`, and re-wraps the control's `onChange` output    */
/* into a ResponsiveValue — so every control here is device-agnostic.    */
/*                                                                     */
/* Emitted value shapes (must match buildSectionCss):                    */
/*   DimensionsControl  -> { top?, right?, bottom?, left?, unit } | undefined */
/*   UnitNumberControl  -> { value: number, unit: string } | undefined        */
/*   TypographyControl  -> { fontSize?, lineHeight?, letterSpacing?,           */
/*                           fontWeight?, textTransform?, fontFamily?,          */
/*                           textAlign? } (fontSize/letterSpacing are           */
/*                           { value, unit }) | undefined                       */
/*   BackgroundControl  -> { type, color? } | { type, gradient?,                */
/*                           gradientFrom?, gradientTo?, gradientAngle? } |      */
/*                           { type, image? } | undefined                       */
/*   BorderControl      -> { style?, width?: { value, unit }, color? } | undefined */
/*   BoxShadowControl   -> { x?, y?, blur?, spread?, color?, inset? } | undefined  */
/*   ChooseControl      -> string                                               */
/*   CodeControl        -> string                                               */
/* ------------------------------------------------------------------ */

import React, { useState } from "react"
import type { FieldDef } from "@modules/cms/schema/types"

/* ----------------------------- styles ----------------------------- */
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  fontSize: 13,
  fontFamily: "inherit",
  color: "#111827",
  background: "#fff",
  outline: "none",
}
const miniInput: React.CSSProperties = {
  ...input,
  padding: "6px 7px",
  fontSize: 12,
  textAlign: "center",
}
const miniSelect: React.CSSProperties = {
  ...input,
  padding: "6px 7px",
  fontSize: 12,
  width: "auto",
  flex: "0 0 auto",
}
const caption: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#9ca3af",
  textAlign: "center",
  marginBottom: 2,
}
const subLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#6b7280",
  margin: "8px 0 4px",
}
const groupBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 9,
  padding: "8px 10px",
  background: "#fafafa",
}
const smallBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 6,
  fontSize: 12,
  padding: "5px 9px",
  cursor: "pointer",
  color: "#374151",
}

/* --------------------------- tiny helpers ------------------------- */

/** Narrow any value to a plain (non-array) object, else an empty object. */
function asObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {}
}

/** Parse an <input> string to a finite number, or undefined when blank/NaN. */
function toNum(raw: string): number | undefined {
  if (raw.trim() === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** True when a number is a usable value (present + finite). */
function hasNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n)
}

/* ------------------------------------------------------------------ */
/* Global-token linking (Phase 5 — link-to-global-token)                */
/*                                                                     */
/* A color/font control can either hold a RAW value (a hex string / a   */
/* font stack) or be LINKED to a global theme token. A linked value is   */
/* stored as the object `{ ref: <tokenId> }`:                            */
/*   colors → ref ∈ "primary|heading|text|dark|border|bg"                */
/*   fonts  → ref ∈ "body|heading"                                       */
/* render/style-engine.ts maps `{ ref }` to `var(--ff-<id>)` (colors) /  */
/* `var(--ff-font-<id>)` (fonts), so editing the theme cascades live to   */
/* every linked section. A plain string keeps behaving exactly as today. */
/* ------------------------------------------------------------------ */

/** One resolved theme token offered to a linkable control. */
export type TokenDef = { id: string; name: string; value: string }
/** The token lists a linkable control may bind to (colors + fonts). */
export type Tokens = { colors: TokenDef[]; fonts: TokenDef[] }
/** A LINKED value — bound to a global theme token by its id. */
export type TokenRef = { ref: string }

/** True when a value is a `{ ref }` token link (vs a raw string). */
export function isRef(v: unknown): v is TokenRef {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>).ref === "string"
  )
}

const swatchBox: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  flex: "0 0 auto",
}

const linkNote: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  gap: 4,
}

/** Globe / chain toggle shown next to a linkable color/font control. */
function GlobeToggle({
  active,
  title,
  onClick,
}: {
  active: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        ...smallBtn,
        padding: "6px 8px",
        flex: "0 0 auto",
        borderColor: active ? "#2563eb" : "#d1d5db",
        color: active ? "#1d4ed8" : "#6b7280",
        background: active ? "#eff6ff" : "#fff",
      }}
    >
      {active ? "🔗" : "🌐"}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented button group (used by ChooseControl + typography align)    */
/* ------------------------------------------------------------------ */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string; icon?: string }[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 3,
        background: "#f9fafb",
      }}
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: "1 1 auto",
              minWidth: 44,
              border: "1px solid",
              borderColor: active ? "#2563eb" : "transparent",
              background: active ? "#eff6ff" : "transparent",
              color: active ? "#1d4ed8" : "#374151",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              padding: "5px 8px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reusable inline unit-number (number input + unit dropdown)           */
/* Emits { value, unit } or undefined. Shared by border width +         */
/* typography font-size / letter-spacing.                               */
/* ------------------------------------------------------------------ */
function UnitNumberInline({
  value,
  units,
  min,
  max,
  step,
  placeholder,
  onChange,
}: {
  value: any
  units: string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  onChange: (v: { value: number; unit: string } | undefined) => void
}) {
  const rec = asObj(value)
  const num = hasNum(rec.value)
    ? rec.value
    : hasNum(value)
    ? (value as number)
    : undefined
  const unit = typeof rec.unit === "string" && rec.unit ? rec.unit : units[0] ?? "px"

  const emit = (n: number | undefined, u: string) => {
    if (!hasNum(n)) {
      onChange(undefined)
      return
    }
    onChange({ value: n, unit: u })
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input
        type="number"
        style={{ ...miniInput, textAlign: "left" }}
        value={num ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => emit(toNum(e.target.value), unit)}
      />
      {units.length > 0 && (
        <select
          style={miniSelect}
          value={unit}
          onChange={(e) => emit(num, e.target.value)}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* DimensionsControl — box control (padding/margin/radius)              */
/* Value: { top?, right?, bottom?, left?, unit } | undefined            */
/* ------------------------------------------------------------------ */
const SIDE_LABELS: Record<string, string> = {
  top: "T",
  right: "R",
  bottom: "B",
  left: "L",
}

export function DimensionsControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  const sides = field.sides ?? ["top", "right", "bottom", "left"]
  const units = field.units ?? ["px"]
  const rec = asObj(value)
  const unit = typeof rec.unit === "string" && rec.unit ? rec.unit : units[0] ?? "px"
  const [linked, setLinked] = useState<boolean>(!!field.linked)

  /** Rebuild + emit from a fresh side map, dropping empties. */
  const emit = (nextSides: Record<string, number | undefined>, nextUnit: string) => {
    const cleaned: Record<string, any> = {}
    let has = false
    for (const s of sides) {
      if (hasNum(nextSides[s])) {
        cleaned[s] = nextSides[s]
        has = true
      }
    }
    if (!has) {
      onChange(undefined)
      return
    }
    cleaned.unit = nextUnit
    onChange(cleaned)
  }

  const current: Record<string, number | undefined> = {}
  for (const s of sides) current[s] = hasNum(rec[s]) ? rec[s] : undefined

  const setSide = (side: string, raw: string) => {
    const n = toNum(raw)
    const next = { ...current }
    if (linked) {
      for (const s of sides) next[s] = n
    } else {
      next[side] = n
    }
    emit(next, unit)
  }

  return (
    <div style={groupBox}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        {sides.map((s) => (
          <div key={s} style={{ flex: 1, minWidth: 0 }}>
            <div style={caption}>{SIDE_LABELS[s] ?? s}</div>
            <input
              type="number"
              style={miniInput}
              value={current[s] ?? ""}
              onChange={(e) => setSide(s, e.target.value)}
            />
          </div>
        ))}
        <button
          type="button"
          title={linked ? "Sides linked" : "Sides independent"}
          onClick={() => setLinked((l) => !l)}
          style={{
            ...smallBtn,
            padding: "6px 8px",
            borderColor: linked ? "#2563eb" : "#d1d5db",
            color: linked ? "#1d4ed8" : "#6b7280",
            background: linked ? "#eff6ff" : "#fff",
            flex: "0 0 auto",
          }}
        >
          {linked ? "🔗" : "⛓"}
        </button>
      </div>
      {units.length > 1 && (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <select
            style={miniSelect}
            value={unit}
            onChange={(e) => emit(current, e.target.value)}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* UnitNumberControl — number input + slider + unit dropdown            */
/* Value: { value: number, unit: string } | undefined                   */
/* ------------------------------------------------------------------ */
export function UnitNumberControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  const units = field.units ?? ["px"]
  const rec = asObj(value)
  const num = hasNum(rec.value)
    ? rec.value
    : hasNum(value)
    ? (value as number)
    : undefined
  const unit = typeof rec.unit === "string" && rec.unit ? rec.unit : units[0] ?? "px"
  const min = field.min ?? 0
  const max = field.max ?? 100
  const step = field.step ?? 1

  const emit = (n: number | undefined, u: string) => {
    if (!hasNum(n)) {
      onChange(undefined)
      return
    }
    onChange({ value: n, unit: u })
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        type="range"
        style={{ flex: 1, minWidth: 60 }}
        value={num ?? min}
        min={min}
        max={max}
        step={step}
        onChange={(e) => emit(Number(e.target.value), unit)}
      />
      <input
        type="number"
        style={{ ...miniInput, width: 66, flex: "0 0 auto", textAlign: "left" }}
        value={num ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => emit(toNum(e.target.value), unit)}
      />
      {units.length > 0 && (
        <select
          style={miniSelect}
          value={unit}
          onChange={(e) => emit(num, e.target.value)}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* TypographyControl — compact group of type properties                 */
/* Value: { fontSize?, lineHeight?, letterSpacing?, fontWeight?,         */
/*          textTransform?, fontFamily?, textAlign? } | undefined        */
/* fontSize + letterSpacing are { value, unit }.                         */
/* ------------------------------------------------------------------ */
const FONT_WEIGHTS = [
  { label: "Default", value: "" },
  { label: "Thin 100", value: "100" },
  { label: "Light 300", value: "300" },
  { label: "Normal 400", value: "400" },
  { label: "Medium 500", value: "500" },
  { label: "Semibold 600", value: "600" },
  { label: "Bold 700", value: "700" },
  { label: "Extrabold 800", value: "800" },
  { label: "Black 900", value: "900" },
]
const TEXT_TRANSFORMS = [
  { label: "Default", value: "" },
  { label: "None", value: "none" },
  { label: "UPPERCASE", value: "uppercase" },
  { label: "lowercase", value: "lowercase" },
  { label: "Capitalize", value: "capitalize" },
]
const TEXT_ALIGN_OPTS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
  { label: "Justify", value: "justify" },
]

/**
 * Font-family sub-control: a raw font-stack input OR a link to a global font
 * token. `value` is a plain string (raw stack) or `{ ref }` (linked). The globe
 * toggle switches between the two; unlinking seeds the raw value from the
 * token's resolved stack. Backward compatible when `fonts` is empty (no globe).
 */
function FontFamilyField({
  value,
  fonts,
  onChange,
}: {
  value: unknown
  fonts: TokenDef[]
  onChange: (v: any) => void
}) {
  const canLink = fonts.length > 0
  const linked = isRef(value)
  const activeToken = linked
    ? fonts.find((t) => t.id === (value as TokenRef).ref)
    : undefined

  if (linked) {
    const ref = (value as TokenRef).ref
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlobeToggle
            active
            title="Linked to a global font token — click to unlink"
            onClick={() => onChange(activeToken?.value ?? "")}
          />
          <select
            style={{
              ...miniSelect,
              width: "auto",
              flex: 1,
              fontFamily: activeToken?.value || "inherit",
            }}
            value={ref}
            onChange={(e) => onChange({ ref: e.target.value })}
          >
            {/* Preserve an unknown ref so it is never silently dropped. */}
            {!activeToken && <option value={ref}>{ref}</option>}
            {fonts.map((t) => (
              <option key={t.id} value={t.id} style={{ fontFamily: t.value }}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div style={linkNote}>🔗 Linked to {activeToken?.name ?? ref}</div>
      </div>
    )
  }

  const raw = typeof value === "string" ? value : ""
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {canLink && (
        <GlobeToggle
          active={false}
          title="Link to a global font token"
          onClick={() => {
            const first = fonts[0]
            if (first) onChange({ ref: first.id })
          }}
        />
      )}
      <input
        style={{ ...input, fontSize: 12, padding: "6px 8px", flex: 1 }}
        value={raw}
        placeholder='e.g. "Inter", sans-serif'
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function TypographyControl({
  field,
  value,
  onChange,
  tokens,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
  tokens?: Tokens
}) {
  const units = field.units ?? ["px", "rem", "em"]
  const rec = asObj(value)

  /** Merge one key, drop empties, emit undefined when nothing remains. */
  const setKey = (key: string, v: any) => {
    const next: Record<string, any> = { ...rec }
    const empty =
      v == null ||
      v === "" ||
      (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
    if (empty) {
      delete next[key]
    } else {
      next[key] = v
    }
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <div style={groupBox}>
      <label style={{ ...subLabel, marginTop: 0 }}>Font size</label>
      <UnitNumberInline
        value={rec.fontSize}
        units={units}
        min={0}
        placeholder="16"
        onChange={(v) => setKey("fontSize", v)}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={subLabel}>Line height</label>
          <input
            type="number"
            step={0.1}
            style={{ ...miniInput, textAlign: "left" }}
            value={rec.lineHeight ?? ""}
            placeholder="1.5"
            onChange={(e) =>
              setKey("lineHeight", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={subLabel}>Letter spacing</label>
          <UnitNumberInline
            value={rec.letterSpacing}
            units={units}
            placeholder="0"
            onChange={(v) => setKey("letterSpacing", v)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={subLabel}>Weight</label>
          <select
            style={{ ...miniSelect, width: "100%" }}
            value={rec.fontWeight ?? ""}
            onChange={(e) => setKey("fontWeight", e.target.value)}
          >
            {FONT_WEIGHTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={subLabel}>Transform</label>
          <select
            style={{ ...miniSelect, width: "100%" }}
            value={rec.textTransform ?? ""}
            onChange={(e) => setKey("textTransform", e.target.value)}
          >
            {TEXT_TRANSFORMS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label style={subLabel}>Font family</label>
      <FontFamilyField
        value={rec.fontFamily}
        fonts={tokens?.fonts ?? []}
        onChange={(v) => setKey("fontFamily", v)}
      />

      <label style={subLabel}>Text align</label>
      <Segmented
        options={TEXT_ALIGN_OPTS}
        value={rec.textAlign}
        onChange={(v) => setKey("textAlign", rec.textAlign === v ? "" : v)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BackgroundControl — color | gradient | image                         */
/* Value: { type, color? } | { type, gradient?, gradientFrom?,          */
/*          gradientTo?, gradientAngle? } | { type, image? } | undefined  */
/* ------------------------------------------------------------------ */
function ColorRow({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 38,
          height: 34,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          padding: 0,
          background: "#fff",
          cursor: "pointer",
          flex: "0 0 auto",
        }}
      />
      <input
        style={input}
        value={value ?? ""}
        placeholder={placeholder ?? "#000000"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function BackgroundControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  const rec = asObj(value)
  const allowGradient = !!field.gradient
  const allowImage = !!field.allowImage
  const type =
    typeof rec.type === "string" && rec.type ? rec.type : "color"

  const typeOptions = [
    { label: "Color", value: "color" },
    ...(allowGradient ? [{ label: "Gradient", value: "gradient" }] : []),
    ...(allowImage ? [{ label: "Image", value: "image" }] : []),
  ]

  const setType = (t: string) => {
    // Preserve gradient sub-values across type switches (engine ignores extras).
    onChange({ ...rec, type: t })
  }

  const emitColor = (color: string) => {
    if (!color.trim()) {
      onChange(undefined)
      return
    }
    onChange({ type: "color", color })
  }

  const from = typeof rec.gradientFrom === "string" ? rec.gradientFrom : ""
  const to = typeof rec.gradientTo === "string" ? rec.gradientTo : ""
  const angle = hasNum(rec.gradientAngle) ? rec.gradientAngle : 90
  const emitGradient = (nf: string, nt: string, na: number) => {
    if (!nf.trim() && !nt.trim()) {
      onChange({ type: "gradient" })
      return
    }
    const c1 = nf.trim() || "#ffffff"
    const c2 = nt.trim() || "#000000"
    onChange({
      type: "gradient",
      gradientFrom: nf,
      gradientTo: nt,
      gradientAngle: na,
      gradient: `linear-gradient(${na}deg, ${c1}, ${c2})`,
    })
  }

  const emitImage = (image: string) => {
    if (!image.trim()) {
      onChange({ type: "image" })
      return
    }
    onChange({ type: "image", image })
  }

  return (
    <div style={groupBox}>
      {typeOptions.length > 1 && (
        <div style={{ marginBottom: 8 }}>
          <Segmented options={typeOptions} value={type} onChange={setType} />
        </div>
      )}

      {type === "color" && (
        <ColorRow value={rec.color} onChange={emitColor} />
      )}

      {type === "gradient" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <label style={{ ...subLabel, marginTop: 0 }}>From</label>
            <ColorRow value={from} onChange={(c) => emitGradient(c, to, angle)} />
          </div>
          <div>
            <label style={subLabel}>To</label>
            <ColorRow value={to} onChange={(c) => emitGradient(from, c, angle)} />
          </div>
          <div>
            <label style={subLabel}>Angle ({angle}°)</label>
            <input
              type="range"
              style={{ width: "100%" }}
              min={0}
              max={360}
              step={1}
              value={angle}
              onChange={(e) => emitGradient(from, to, Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {type === "image" && (
        <input
          style={input}
          value={rec.image ?? ""}
          placeholder="Image URL (https://…)"
          onChange={(e) => emitImage(e.target.value)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BorderControl — style + width + color                                */
/* Value: { style?, width?: { value, unit }, color? } | undefined        */
/* ------------------------------------------------------------------ */
const BORDER_STYLES = [
  { label: "None", value: "none" },
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" },
]

export function BorderControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  const units = field.units ?? ["px", "em", "rem"]
  const rec = asObj(value)

  const setKey = (key: string, v: any) => {
    const next: Record<string, any> = { ...rec }
    const empty =
      v == null ||
      v === "" ||
      (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
    if (empty) {
      delete next[key]
    } else {
      next[key] = v
    }
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <div style={groupBox}>
      <label style={{ ...subLabel, marginTop: 0 }}>Style</label>
      <Segmented
        options={BORDER_STYLES}
        value={typeof rec.style === "string" ? rec.style : undefined}
        onChange={(v) => setKey("style", rec.style === v ? "" : v)}
      />

      <label style={subLabel}>Width</label>
      <UnitNumberInline
        value={rec.width}
        units={units}
        min={0}
        placeholder="1"
        onChange={(v) => setKey("width", v)}
      />

      <label style={subLabel}>Color</label>
      <ColorRow
        value={typeof rec.color === "string" ? rec.color : undefined}
        onChange={(c) => setKey("color", c)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BoxShadowControl — x / y / blur / spread + color + inset             */
/* Value: { x?, y?, blur?, spread?, color?, inset? } | undefined         */
/* ------------------------------------------------------------------ */
const SHADOW_FIELDS: { key: "x" | "y" | "blur" | "spread"; label: string }[] = [
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "blur", label: "Blur" },
  { key: "spread", label: "Spread" },
]

export function BoxShadowControl({
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  const rec = asObj(value)

  const emit = (next: Record<string, any>) => {
    const cleaned: Record<string, any> = {}
    let meaningful = false
    for (const { key } of SHADOW_FIELDS) {
      if (hasNum(next[key])) {
        cleaned[key] = next[key]
        meaningful = true
      }
    }
    if (typeof next.color === "string" && next.color.trim()) {
      cleaned.color = next.color
      meaningful = true
    }
    if (next.inset === true) {
      cleaned.inset = true
      meaningful = true
    }
    onChange(meaningful ? cleaned : undefined)
  }

  return (
    <div style={groupBox}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        {SHADOW_FIELDS.map(({ key, label }) => (
          <div key={key} style={{ flex: 1, minWidth: 0 }}>
            <div style={caption}>{label}</div>
            <input
              type="number"
              style={miniInput}
              value={hasNum(rec[key]) ? rec[key] : ""}
              onChange={(e) => emit({ ...rec, [key]: toNum(e.target.value) })}
            />
          </div>
        ))}
      </div>
      <label style={subLabel}>Color</label>
      <ColorRow
        value={typeof rec.color === "string" ? rec.color : undefined}
        onChange={(c) => emit({ ...rec, color: c })}
      />
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          cursor: "pointer",
          marginTop: 8,
          color: "#374151",
        }}
      >
        <input
          type="checkbox"
          checked={rec.inset === true}
          onChange={(e) => emit({ ...rec, inset: e.target.checked })}
        />
        Inset
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ChooseControl — segmented button group                               */
/* Value: string                                                        */
/* ------------------------------------------------------------------ */
export function ChooseControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  return (
    <Segmented
      options={field.options ?? []}
      value={typeof value === "string" ? value : undefined}
      onChange={onChange}
    />
  )
}

/* ------------------------------------------------------------------ */
/* CodeControl — monospace textarea                                     */
/* Value: string                                                        */
/* ------------------------------------------------------------------ */
export function CodeControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
}) {
  return (
    <textarea
      rows={field.rows ?? 6}
      spellCheck={false}
      style={{
        ...input,
        minHeight: 90,
        resize: "vertical",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: "pre",
      }}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/* ------------------------------------------------------------------ */
/* ColorControl — a raw color OR a link to a global color token         */
/* Value: string (raw hex) | { ref: <colorTokenId> } | undefined         */
/*                                                                     */
/* Backward compatible: with no `tokens` (and a plain string value) it   */
/* is just a color picker, identical to the content color control. When  */
/* `tokens.colors` is provided a globe toggle appears: ON binds the value */
/* to a theme token ({ ref }); OFF converts back to a raw hex, seeded     */
/* from the linked token's resolved color.                               */
/* ------------------------------------------------------------------ */
export function ColorControl({
  value,
  onChange,
  tokens,
}: {
  field: FieldDef
  value: any
  onChange: (v: any) => void
  tokens?: Tokens
}) {
  const colorTokens = tokens?.colors ?? []
  const canLink = colorTokens.length > 0
  const linked = isRef(value)
  const activeToken = linked
    ? colorTokens.find((t) => t.id === (value as TokenRef).ref)
    : undefined

  // Linked mode: a token dropdown + swatch + chain indicator.
  if (linked) {
    const ref = (value as TokenRef).ref
    const swatchColor = activeToken?.value || "#ffffff"
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlobeToggle
            active
            title="Linked to a global color token — click to unlink"
            onClick={() => onChange(activeToken?.value ?? "#000000")}
          />
          <span style={{ ...swatchBox, background: swatchColor }} />
          <select
            style={{ ...input, flex: 1 }}
            value={ref}
            onChange={(e) => onChange({ ref: e.target.value })}
          >
            {/* Preserve an unknown ref so it is never silently dropped. */}
            {!activeToken && <option value={ref}>{ref}</option>}
            {colorTokens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div style={linkNote}>🔗 Linked to {activeToken?.name ?? ref}</div>
      </div>
    )
  }

  // Raw mode: color picker (+ optional globe to switch to token linking).
  const raw = typeof value === "string" ? value : ""
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {canLink && (
        <GlobeToggle
          active={false}
          title="Link to a global color token"
          onClick={() => {
            const first = colorTokens[0]
            if (first) onChange({ ref: first.id })
          }}
        />
      )}
      <input
        type="color"
        value={raw || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 38,
          height: 34,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          padding: 0,
          background: "#fff",
          cursor: "pointer",
          flex: "0 0 auto",
        }}
      />
      <input
        style={input}
        value={raw}
        placeholder="#000000"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
