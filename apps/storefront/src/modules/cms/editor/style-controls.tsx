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
/* Chrome comes from ONE place — @modules/cms/editor/design — so these   */
/* controls are built from the same material as the merchant dashboard:  */
/* Inter, the cool-grey ramp, hairline structure, 4/6/10 radii, and a    */
/* single accent (the brand ember) spent only on the thing you are       */
/* touching right now.                                                   */
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
import MediaPicker from "@modules/cms/editor/MediaPicker"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  field as fieldStyle,
  focusRing,
  font,
  grey,
  hairline,
  iconButton,
  motion,
  radius,
  surface,
  type,
} from "@modules/cms/editor/design"
import type { FieldDef, LinkValue } from "@modules/cms/schema/types"
import { isLinkObject } from "@modules/cms/schema/types"

/* ------------------------------------------------------------------ */
/* MERCHANT DATA — not chrome.                                          */
/* These two hexes are DEFAULT VALUES written into the merchant's own    */
/* content (the <input type="color"> fallback and the gradient stops     */
/* buildSectionCss falls back to). They are part of the emitted payload, */
/* so they must stay byte-identical. Every other colour in this file      */
/* comes from the design tokens.                                         */
/* ------------------------------------------------------------------ */
const DEFAULT_COLOR = "#000000"
const DEFAULT_GRADIENT_FROM = "#ffffff"
const DEFAULT_GRADIENT_TO = "#000000"

/* ----------------------------- styles ----------------------------- */
const input: React.CSSProperties = {
  ...fieldStyle(),
  boxSizing: "border-box",
}
const miniInput: React.CSSProperties = {
  ...input,
  ...type.label,
  fontFamily: font,
  height: 28,
  padding: "0 8px",
  textAlign: "center",
}
const miniSelect: React.CSSProperties = {
  ...input,
  ...type.label,
  fontFamily: font,
  height: 28,
  padding: "0 6px",
  width: "auto",
  flex: "0 0 auto",
}
const caption: React.CSSProperties = {
  ...type.micro,
  fontFamily: font,
  color: grey[50],
  textAlign: "center",
  marginBottom: 4,
}
const subLabel: React.CSSProperties = {
  ...type.label,
  fontFamily: font,
  display: "block",
  color: grey[70],
  margin: "12px 0 6px",
}
const groupBox: React.CSSProperties = {
  ...surface(),
  padding: 12,
  background: grey[5],
}
const swatchInput: React.CSSProperties = {
  width: 32,
  height: 32,
  border: hairline,
  borderRadius: radius.sm,
  padding: 0,
  background: grey[0],
  cursor: "pointer",
  flex: "0 0 auto",
  boxShadow: "inset 0 0 0 1px rgba(16, 24, 40, 0.06)",
}
const sliderStyle: React.CSSProperties = {
  flex: 1,
  height: 3,
  accentColor: accent.base,
  background: grey[20],
  borderRadius: radius.pill,
  cursor: "pointer",
}

/* Focus is a real state here: the field the merchant is typing in gets the
   ember ring, exactly like the dashboard. Done on the element itself so no
   control has to grow a piece of React state to look focused. */
type AnyFieldEl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
const onFieldFocus = (e: React.FocusEvent<AnyFieldEl>) => {
  e.currentTarget.style.borderColor = accent.base
  e.currentTarget.style.boxShadow = focusRing
}
const onFieldBlur = (e: React.FocusEvent<AnyFieldEl>) => {
  e.currentTarget.style.borderColor = grey[30]
  e.currentTarget.style.boxShadow = "none"
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
  width: 20,
  height: 20,
  borderRadius: radius.sm,
  border: hairline,
  boxShadow: "inset 0 0 0 1px rgba(16, 24, 40, 0.06)",
  flex: "0 0 auto",
}

const linkNote: React.CSSProperties = {
  ...type.label,
  fontFamily: font,
  color: accent.base,
  display: "flex",
  alignItems: "center",
  gap: 6,
}

/** Link-to-global-token toggle shown next to a linkable color/font control. */
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
      aria-label={title}
      onClick={onClick}
      style={{
        ...iconButton("sm"),
        flex: "0 0 auto",
        borderColor: active ? accent.base : grey[20],
        color: active ? accent.base : grey[50],
        background: active ? accent.tint : grey[0],
      }}
    >
      <UiIcon name="external-link" size={13} />
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
        gap: 2,
        borderRadius: radius.md,
        padding: 2,
        background: grey[10],
      }}
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = grey[0]
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = "transparent"
            }}
            style={{
              ...type.label,
              fontFamily: font,
              flex: "1 1 auto",
              minWidth: 44,
              height: 26,
              border: 0,
              background: active ? grey[90] : "transparent",
              color: active ? grey[0] : grey[60],
              fontWeight: active ? 600 : 500,
              borderRadius: radius.sm,
              padding: "0 8px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: `background ${motion.fast}, color ${motion.fast}`,
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
/**
 * Sensible drag ranges per unit, so the slider is USEFUL rather than technically
 * present. A font-size slider that runs 0-100 in `rem` is a slider you can only
 * ruin text with; 0.5-8rem is the range anyone actually types.
 */
function rangeForUnit(unit: string): { min: number; max: number; step: number } {
  switch (unit) {
    case "rem":
    case "em":
      return { min: 0.5, max: 8, step: 0.05 }
    case "%":
      return { min: 50, max: 300, step: 1 }
    case "vw":
    case "vh":
      return { min: 1, max: 20, step: 0.5 }
    default:
      // px
      return { min: 8, max: 120, step: 1 }
  }
}

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

  // Font size (and letter spacing) were a number box and nothing else: to go from
  // 16 to 42 you typed, tabbed, looked, typed again. Sizing type is a VISUAL
  // decision — you want to drag until it looks right. So the slider leads, and
  // the number box stays for when you know the exact value you want.
  const r = rangeForUnit(unit)
  const lo = min ?? r.min
  const hi = max ?? r.max
  const st = step ?? r.step

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="range"
        style={{ ...sliderStyle, minWidth: 54 }}
        // An unset size must not jump to the slider's floor the moment you drag:
        // start from where the text actually is.
        value={num ?? lo}
        min={lo}
        max={hi}
        step={st}
        onChange={(e) => emit(Number(e.target.value), unit)}
      />
      <input
        type="number"
        style={{ ...miniInput, width: 64, flex: "0 0 auto", textAlign: "left" }}
        value={num ?? ""}
        min={lo}
        max={hi}
        step={st}
        placeholder={placeholder}
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
        onChange={(e) => emit(toNum(e.target.value), unit)}
      />
      {units.length > 0 && (
        <select
          style={miniSelect}
          value={unit}
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
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
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {sides.map((s) => (
          <div key={s} style={{ flex: 1, minWidth: 0 }}>
            <div style={caption}>{SIDE_LABELS[s] ?? s}</div>
            <input
              type="number"
              style={miniInput}
              value={current[s] ?? ""}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
              onChange={(e) => setSide(s, e.target.value)}
            />
          </div>
        ))}
        <button
          type="button"
          title={linked ? "Sides linked" : "Sides independent"}
          aria-label={linked ? "Sides linked" : "Sides independent"}
          onClick={() => setLinked((l) => !l)}
          style={{
            ...iconButton("sm"),
            borderColor: linked ? accent.base : grey[20],
            color: linked ? accent.base : grey[50],
            background: linked ? accent.tint : grey[0],
            flex: "0 0 auto",
          }}
        >
          <UiIcon name="resize-h" size={13} />
        </button>
      </div>
      {units.length > 1 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: hairline,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <select
            style={miniSelect}
            value={unit}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="range"
        style={{ ...sliderStyle, minWidth: 60 }}
        value={num ?? min}
        min={min}
        max={max}
        step={step}
        onChange={(e) => emit(Number(e.target.value), unit)}
      />
      <input
        type="number"
        style={{ ...miniInput, width: 64, flex: "0 0 auto", textAlign: "left" }}
        value={num ?? ""}
        min={min}
        max={max}
        step={step}
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
        onChange={(e) => emit(toNum(e.target.value), unit)}
      />
      {units.length > 0 && (
        <select
          style={miniSelect}
          value={unit}
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
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
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
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
        <div style={linkNote}>
          <UiIcon name="external-link" size={12} />
          Linked to {activeToken?.name ?? ref}
        </div>
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
        style={{ ...input, ...type.label, fontFamily: font, height: 28, flex: 1 }}
        value={raw}
        placeholder='e.g. "Inter", sans-serif'
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
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

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={subLabel}>Line height</label>
          {/* Same reasoning as font size: leading is judged by eye, not typed. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              style={{ ...sliderStyle, minWidth: 44 }}
              min={0.8}
              max={3}
              step={0.05}
              value={hasNum(rec.lineHeight) ? (rec.lineHeight as number) : 1.5}
              onChange={(e) => setKey("lineHeight", Number(e.target.value))}
            />
            <input
              type="number"
              step={0.05}
              min={0.8}
              max={3}
              style={{ ...miniInput, width: 64, flex: "0 0 auto", textAlign: "left" }}
              value={rec.lineHeight ?? ""}
              placeholder="1.5"
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
              onChange={(e) =>
                setKey("lineHeight", e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
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

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={subLabel}>Weight</label>
          <select
            style={{ ...miniSelect, width: "100%" }}
            value={rec.fontWeight ?? ""}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
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
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
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
        value={value || DEFAULT_COLOR}
        onChange={(e) => onChange(e.target.value)}
        style={swatchInput}
      />
      <input
        style={input}
        value={value ?? ""}
        placeholder={placeholder ?? DEFAULT_COLOR}
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
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

  // Background > Image offered ONE thing: a raw URL box. Everywhere else in the
  // editor an image field gives you the media library and the AI generator — but
  // a section background, the most visual choice on the page, made you go and
  // find a URL by hand. Same picker, same AI, same everywhere.
  const [pickOpen, setPickOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
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
    const c1 = nf.trim() || DEFAULT_GRADIENT_FROM
    const c2 = nt.trim() || DEFAULT_GRADIENT_TO
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
        <div style={{ marginBottom: 12 }}>
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
              style={{ ...sliderStyle, width: "100%" }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rec.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(rec.image)}
              alt=""
              style={{
                width: "100%",
                height: 84,
                objectFit: "cover",
                borderRadius: radius.md,
                border: hairline,
                background: grey[5],
              }}
            />
          ) : null}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              style={{ ...button("secondary", "sm"), flex: 1 }}
              onClick={() => setPickOpen(true)}
            >
              <UiIcon name="image" size={13} />
              Media library
            </button>
            <button
              type="button"
              style={{ ...button("secondary", "sm"), flex: 1 }}
              onClick={() => setAiOpen(true)}
            >
              <UiIcon name="sparkles" size={13} />
              Generate with AI
            </button>
            {rec.image ? (
              <button
                type="button"
                style={{ ...iconButton("sm"), flex: "0 0 auto" }}
                onClick={() => emitImage("")}
                title="Remove image"
                aria-label="Remove image"
              >
                <UiIcon name="x" size={12} />
              </button>
            ) : null}
          </div>

          <input
            style={input}
            value={rec.image ?? ""}
            placeholder="…or paste an image URL"
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            onChange={(e) => emitImage(e.target.value)}
          />

          {pickOpen ? (
            <MediaPicker
              value={typeof rec.image === "string" ? rec.image : undefined}
              onChange={(url: string) => emitImage(url)}
              onClose={() => setPickOpen(false)}
              slot="banner"
            />
          ) : null}
          {aiOpen ? (
            <MediaPicker
              value={typeof rec.image === "string" ? rec.image : undefined}
              onChange={(url: string) => emitImage(url)}
              onClose={() => setAiOpen(false)}
              slot="banner"
              initialTab="generate"
            />
          ) : null}
        </div>
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
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {SHADOW_FIELDS.map(({ key, label }) => (
          <div key={key} style={{ flex: 1, minWidth: 0 }}>
            <div style={caption}>{label}</div>
            <input
              type="number"
              style={miniInput}
              value={hasNum(rec[key]) ? rec[key] : ""}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
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
          ...type.body,
          fontFamily: font,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginTop: 12,
          color: grey[70],
        }}
      >
        <input
          type="checkbox"
          style={{ accentColor: accent.base, cursor: "pointer" }}
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
        height: "auto",
        minHeight: 90,
        padding: "8px 10px",
        resize: "vertical",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: "pre",
      }}
      value={typeof value === "string" ? value : ""}
      onFocus={onFieldFocus}
      onBlur={onFieldBlur}
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
    const swatchColor = activeToken?.value || DEFAULT_GRADIENT_FROM
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlobeToggle
            active
            title="Linked to a global color token — click to unlink"
            onClick={() => onChange(activeToken?.value ?? DEFAULT_COLOR)}
          />
          <span style={{ ...swatchBox, background: swatchColor }} />
          <select
            style={{ ...input, flex: 1 }}
            value={ref}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
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
        <div style={linkNote}>
          <UiIcon name="external-link" size={12} />
          Linked to {activeToken?.name ?? ref}
        </div>
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
        value={raw || DEFAULT_COLOR}
        onChange={(e) => onChange(e.target.value)}
        style={swatchInput}
      />
      <input
        style={input}
        value={raw}
        placeholder={DEFAULT_COLOR}
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/* ================================================================== */
/* ================================================================== */
/* 3E — CONTROL VOCABULARY (ARCH-UX U4 P1)                              */
/*   LinkControl        — URL / page-picker hybrid + new-tab + nofollow */
/*   IconPickerControl  — searchable picker over the FA5 set themes ship */
/*   StateTabs          — Normal / Hover segmented for style groups      */
/* Everything below is additive; nothing above this banner changed.      */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* LinkControl — field type "link"                                      */
/*                                                                     */
/* Value: `LinkValue` (schema/types) — backward-compatible with every    */
/* stored `href` string:                                                */
/*   string in → string out (verbatim) while no extra is set;            */
/*   the moment "new tab" or "nofollow" is on, the value becomes         */
/*   { href, target?: "_blank", rel?: "nofollow" }; turning both off     */
/*   collapses it back to the plain string.                              */
/*                                                                     */
/* Internal targets come from TWO sources:                              */
/*   1. LinkPagesContext — the store's CMS pages ({slug,title}[]), the   */
/*      same list the shell's page switcher loads from /api/puck/pages;  */
/*      the shell mounts the provider (see INTEGRATION-3E.md).           */
/*   2. STANDARD_ROUTES — the storefront routes every store has.         */
/* Catalog product/collection deep links are deferred: /api/puck/catalog */
/* returns ids without handles, so a product URL cannot be formed yet.    */
/* ------------------------------------------------------------------ */

/** One internal CMS page offered by the link picker. */
export type LinkPage = { slug: string; title: string }

/**
 * The store's CMS pages for the link picker. The editor SHELL provides this
 * (it already fetches /api/puck/pages for the page switcher); without a
 * provider the picker still offers the standard storefront routes.
 */
export const LinkPagesContext = React.createContext<LinkPage[]>([])

/**
 * Function-component wrapper for the provider (3INT). The editor shell mounts
 * THIS, not the raw `LinkPagesContext.Provider`: under the repo's dual
 * @types/react resolution a raw Context.Provider fails the app router's JSX
 * element type (TS2786), while a plain function component — the same shape as
 * CatalogProvider, which the shell already mounts — checks clean.
 */
export function LinkPagesProvider({
  pages,
  children,
}: {
  pages: LinkPage[]
  children?: React.ReactNode
}) {
  return (
    <LinkPagesContext.Provider value={pages}>
      {children}
    </LinkPagesContext.Provider>
  )
}

/** Storefront routes every store ships (base React + Liquid routes). */
const STANDARD_ROUTES: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/store" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Cart", href: "/cart" },
  { label: "Account", href: "/account" },
]

const pickerHead: React.CSSProperties = {
  ...type.micro,
  fontFamily: font,
  color: grey[50],
  padding: "8px 8px 4px",
}

const pickerRow: React.CSSProperties = {
  ...type.body,
  fontFamily: font,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
  border: 0,
  background: "none",
  borderRadius: radius.sm,
  padding: "6px 8px",
  color: grey[80],
  textAlign: "left",
  cursor: "pointer",
}

const pickerRowHref: React.CSSProperties = {
  ...type.label,
  fontFamily: font,
  color: grey[40],
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 110,
}

const checkRow: React.CSSProperties = {
  ...type.body,
  fontFamily: font,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  color: grey[70],
}

export function LinkControl({
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: LinkValue | undefined) => void
}) {
  const pages = React.useContext(LinkPagesContext)
  const [browse, setBrowse] = useState(false)
  const [query, setQuery] = useState("")

  const obj = isLinkObject(value) ? value : undefined
  const href = typeof value === "string" ? value : obj?.href ?? ""
  const newTab = obj?.target === "_blank"
  const nofollow = /\bnofollow\b/.test(obj?.rel ?? "")

  /** Single writer: collapses back to a plain string when no extra is set. */
  const emit = (nextHref: string, nextNewTab: boolean, nextNofollow: boolean) => {
    if (!nextNewTab && !nextNofollow) {
      onChange(nextHref)
      return
    }
    const next: LinkValue = { href: nextHref }
    if (nextNewTab) {
      next.target = "_blank"
    }
    if (nextNofollow) {
      next.rel = "nofollow"
    }
    onChange(next)
  }

  const q = query.trim().toLowerCase()
  const pageItems = pages
    .map((p) => ({
      label: p.title || p.slug,
      href: p.slug === "home" ? "/" : `/${String(p.slug).replace(/^\/+/, "")}`,
    }))
    .filter((p) => !q || p.label.toLowerCase().includes(q) || p.href.includes(q))
  const routeItems = STANDARD_ROUTES.filter(
    (r) => !q || r.label.toLowerCase().includes(q) || r.href.includes(q)
  )

  const pick = (h: string) => {
    emit(h, newTab, nofollow)
    setBrowse(false)
    setQuery("")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          style={input}
          value={href}
          placeholder="https://… or /page"
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
          onChange={(e) => emit(e.target.value, newTab, nofollow)}
        />
        <button
          type="button"
          title={browse ? "Close page list" : "Link to one of your pages"}
          aria-label={browse ? "Close page list" : "Link to one of your pages"}
          aria-expanded={browse}
          onClick={() => setBrowse((b) => !b)}
          style={{
            ...iconButton("sm"),
            flex: "0 0 auto",
            borderColor: browse ? accent.base : grey[20],
            color: browse ? accent.base : grey[50],
            background: browse ? accent.tint : grey[0],
          }}
        >
          <UiIcon name="search" size={13} />
        </button>
      </div>

      {browse ? (
        <div style={{ ...surface(), overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: hairline }}>
            <input
              style={{ ...input, ...type.label, height: 28 }}
              value={query}
              placeholder="Search pages…"
              autoFocus
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 216, overflowY: "auto", padding: 4 }}>
            {pageItems.length > 0 && <div style={pickerHead}>Your pages</div>}
            {pageItems.map((p) => (
              <button
                key={`p-${p.href}`}
                type="button"
                style={pickerRow}
                onMouseEnter={(e) => (e.currentTarget.style.background = grey[10])}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                onClick={() => pick(p.href)}
              >
                <span>{p.label}</span>
                <span style={pickerRowHref}>{p.href}</span>
              </button>
            ))}
            {routeItems.length > 0 && <div style={pickerHead}>Store</div>}
            {routeItems.map((r) => (
              <button
                key={`r-${r.href}`}
                type="button"
                style={pickerRow}
                onMouseEnter={(e) => (e.currentTarget.style.background = grey[10])}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                onClick={() => pick(r.href)}
              >
                <span>{r.label}</span>
                <span style={pickerRowHref}>{r.href}</span>
              </button>
            ))}
            {!pageItems.length && !routeItems.length ? (
              <div style={{ ...type.label, fontFamily: font, color: grey[40], padding: 10 }}>
                No matching pages.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <label style={checkRow}>
          <input
            type="checkbox"
            style={{ accentColor: accent.base, cursor: "pointer" }}
            checked={newTab}
            onChange={(e) => emit(href, e.target.checked, nofollow)}
          />
          Open in new tab
        </label>
        <label style={checkRow} title="Adds rel=&quot;nofollow&quot; for search engines">
          <input
            type="checkbox"
            style={{ accentColor: accent.base, cursor: "pointer" }}
            checked={nofollow}
            onChange={(e) => emit(href, newTab, e.target.checked)}
          />
          No-follow
        </label>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* IconPickerControl — field type "icon"                                */
/*                                                                     */
/* Value: the icon's full Font Awesome 5 class string ("fas fa-star",   */
/* "fab fa-instagram") — the exact string the icon widget renders as     */
/* `<i class="…">` and every theme's FA5 stylesheet understands. A raw   */
/* class input stays available, so legacy values ("fa-star") and exotic   */
/* classes keep working and are never rewritten until the merchant picks. */
/*                                                                     */
/* NO NEW ICON LIBRARY (ARCH-UX U4 P1 §2): the set below is a curated    */
/* slice of Font Awesome 5 Free 5.15.4 — the exact set the themes        */
/* already ship (public/learts/assets/css/vendor/fontawesome.min.css,     */
/* fonts under /learts/assets/fonts/fontAwesome/, shared by the Liquid    */
/* themes). For in-panel previews the control lazily injects that SAME    */
/* stylesheet into the editor document — zero new assets.                 */
/* ------------------------------------------------------------------ */

/** The theme-shipped FA5 stylesheet used for in-panel previews. */
const FA_PREVIEW_CSS = "/learts/assets/css/vendor/fontawesome.min.css"
const FA_PREVIEW_LINK_ID = "ff-fa5-preview"

/** Inject the FA5 preview stylesheet once per editor document. */
function ensureFaPreviewCss(): void {
  if (typeof document === "undefined") {
    return
  }
  if (document.getElementById(FA_PREVIEW_LINK_ID)) {
    return
  }
  const link = document.createElement("link")
  link.id = FA_PREVIEW_LINK_ID
  link.rel = "stylesheet"
  link.href = FA_PREVIEW_CSS
  document.head.appendChild(link)
}

/** Curated FA5 Free SOLID icons (class = `fas fa-<name>`). */
const FA5_SOLID =
  (
    "address-book address-card anchor archive arrow-down arrow-left arrow-right " +
    "arrow-up at award baby balance-scale ban barcode bars bath bed beer bell " +
    "bell-slash bicycle birthday-cake bolt bone book book-open bookmark box " +
    "box-open boxes brain briefcase bug building bullhorn bullseye bus " +
    "calculator calendar calendar-alt calendar-check camera camera-retro " +
    "candy-cane capsules car caret-down caret-left caret-right caret-up carrot " +
    "cart-arrow-down cart-plus cash-register chair chart-area chart-bar " +
    "chart-line chart-pie check check-circle check-double check-square cheese " +
    "chevron-down chevron-left chevron-right chevron-up child circle city " +
    "clipboard clock cloud cloud-download-alt cloud-upload-alt cocktail code " +
    "coffee cog cogs coins comment comment-alt comments compass compress cookie " +
    "cookie-bite copy couch credit-card crop crown cube cubes cut database " +
    "desktop dice dog dollar-sign dolly door-open dove download drum dumbbell " +
    "edit egg envelope envelope-open eraser euro-sign exchange-alt exclamation " +
    "exclamation-circle exclamation-triangle expand external-link-alt eye " +
    "eye-slash feather female file file-alt film filter fingerprint fire " +
    "first-aid fish flag flag-checkered flask folder folder-open frog frown " +
    "futbol gamepad gas-pump gavel gem ghost gift gifts glass-cheers glasses " +
    "globe graduation-cap guitar hamburger hammer hand-holding-heart " +
    "hand-point-right hands-helping handshake hashtag headphones heart " +
    "heart-broken heartbeat hiking history home horse hospital hotel hourglass " +
    "ice-cream id-card image images inbox industry info info-circle key " +
    "keyboard landmark laptop leaf lemon life-ring lightbulb link list " +
    "list-alt location-arrow lock lock-open luggage-cart magic magnet male map " +
    "map-marked-alt map-marker-alt map-pin medal medkit meh microphone minus " +
    "minus-circle mobile-alt money-bill money-bill-wave moon motorcycle " +
    "mountain mouse-pointer mug-hot music newspaper paint-brush paint-roller " +
    "palette paper-plane paperclip paw pen pencil-alt pepper-hot percent phone " +
    "phone-alt piggy-bank pizza-slice plane play plug plus plus-circle print " +
    "puzzle-piece question question-circle quote-left quote-right receipt " +
    "recycle redo reply ribbon road rocket ruler running search search-minus " +
    "search-plus seedling share share-alt shield-alt ship shipping-fast " +
    "shoe-prints shopping-bag shopping-basket shopping-cart shower sign-in-alt " +
    "sign-out-alt sitemap sliders-h smile snowflake socks spa star " +
    "star-half-alt stethoscope stop stopwatch store store-alt stream suitcase " +
    "sun sync sync-alt tablet-alt tag tags taxi thermometer thumbs-down " +
    "thumbs-up thumbtack ticket-alt times times-circle tint tools tooth " +
    "tractor train tram trash trash-alt tree trophy truck truck-moving tshirt " +
    "tv umbrella umbrella-beach undo university unlock upload user user-check " +
    "user-circle user-friends user-plus users utensils video volume-up wallet " +
    "warehouse water weight wifi wind wine-bottle wine-glass wrench"
  ).split(" ")

/** Curated FA5 Free BRAND icons (class = `fab fa-<name>`). */
const FA5_BRANDS =
  (
    "amazon android app-store apple behance bitcoin cc-amex cc-mastercard " +
    "cc-paypal cc-visa discord dribbble ebay etsy facebook facebook-f " +
    "facebook-messenger figma github gitlab google google-play instagram " +
    "linkedin linkedin-in medium paypal pinterest pinterest-p reddit shopify " +
    "skype slack snapchat-ghost soundcloud spotify stripe telegram-plane " +
    "tiktok tumblr twitch twitter vimeo whatsapp wordpress youtube"
  ).split(" ")

/** The searchable set: full class + searchable name. */
const FA5_ICONS: { cls: string; name: string }[] = [
  ...FA5_SOLID.map((n) => ({ cls: `fas fa-${n}`, name: n })),
  ...FA5_BRANDS.map((n) => ({ cls: `fab fa-${n}`, name: n })),
]

const iconCell: React.CSSProperties = {
  width: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: hairline,
  borderRadius: radius.sm,
  background: grey[0],
  color: grey[70],
  fontSize: 15,
  cursor: "pointer",
  padding: 0,
}

export function IconPickerControl({
  value,
  onChange,
}: {
  field: FieldDef
  value: any
  onChange: (v: string) => void
}) {
  const cls = typeof value === "string" ? value : ""
  const [browse, setBrowse] = useState(false)
  const [query, setQuery] = useState("")

  React.useEffect(() => {
    ensureFaPreviewCss()
  }, [])

  const q = query.trim().toLowerCase()
  const matches = (q
    ? FA5_ICONS.filter((i) => i.name.includes(q))
    : FA5_ICONS
  ).slice(0, 120)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            ...iconCell,
            cursor: "default",
            color: cls ? grey[80] : grey[30],
            flex: "0 0 auto",
          }}
        >
          {cls ? <i className={cls} /> : <UiIcon name="image" size={14} />}
        </span>
        <input
          style={{ ...input, ...type.label, height: 28, flex: 1 }}
          value={cls}
          placeholder="fas fa-star"
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          title={browse ? "Close icon picker" : "Browse icons"}
          aria-label={browse ? "Close icon picker" : "Browse icons"}
          aria-expanded={browse}
          onClick={() => setBrowse((b) => !b)}
          style={{
            ...iconButton("sm"),
            flex: "0 0 auto",
            borderColor: browse ? accent.base : grey[20],
            color: browse ? accent.base : grey[50],
            background: browse ? accent.tint : grey[0],
          }}
        >
          <UiIcon name="search" size={13} />
        </button>
      </div>

      {browse ? (
        <div style={{ ...surface(), overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: hairline }}>
            <input
              style={{ ...input, ...type.label, height: 28 }}
              value={query}
              placeholder="Search icons… (star, cart, facebook)"
              autoFocus
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              maxHeight: 224,
              overflowY: "auto",
              padding: 8,
            }}
          >
            {matches.map((i) => {
              const active = i.cls === cls
              return (
                <button
                  key={i.cls}
                  type="button"
                  title={i.name}
                  aria-label={i.name}
                  onClick={() => {
                    onChange(i.cls)
                    setBrowse(false)
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = grey[10]
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = grey[0]
                  }}
                  style={{
                    ...iconCell,
                    borderColor: active ? accent.base : grey[20],
                    color: active ? accent.base : grey[70],
                    background: active ? accent.tint : grey[0],
                  }}
                >
                  <i className={i.cls} aria-hidden="true" />
                </button>
              )
            })}
            {!matches.length ? (
              <div style={{ ...type.label, fontFamily: font, color: grey[40], padding: 6 }}>
                No icons match "{query}".
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* StateTabs — the Normal / Hover segmented above hoverable groups      */
/*                                                                     */
/* Pure presentational: SchemaPanel owns WHERE it mounts and how the     */
/* hover sub-bag is routed (see INTEGRATION-3E.md). The hover tab        */
/* carries an ember dot whenever the hover bag holds a value, so a       */
/* configured hover state is visible without switching tabs.             */
/* ------------------------------------------------------------------ */

/** The style keys that support a hover state (must mirror the engine's
 *  HOVER_STYLE_KEYS whitelist in render/style-engine.ts). */
export const HOVERABLE_STYLE_KEYS: readonly string[] = [
  "background",
  "color",
  "border",
  "boxShadow",
]

export type StyleState = "normal" | "hover"

export function StateTabs({
  state,
  onChange,
  hoverActive,
}: {
  state: StyleState
  onChange: (s: StyleState) => void
  /** True when the hover sub-bag holds at least one value (shows the dot). */
  hoverActive?: boolean
}) {
  const opts: { label: string; value: StyleState; dot?: boolean }[] = [
    { label: "Normal", value: "normal" },
    { label: "Hover", value: "hover", dot: hoverActive },
  ]
  return (
    <div
      role="tablist"
      aria-label="Style state"
      style={{
        display: "flex",
        gap: 2,
        borderRadius: radius.md,
        padding: 2,
        background: grey[10],
        marginBottom: 8,
      }}
    >
      {opts.map((o) => {
        const active = state === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = grey[0]
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = "transparent"
            }}
            style={{
              ...type.label,
              fontFamily: font,
              flex: "1 1 auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              height: 26,
              border: 0,
              background: active ? grey[90] : "transparent",
              color: active ? grey[0] : grey[60],
              fontWeight: active ? 600 : 500,
              borderRadius: radius.sm,
              padding: "0 8px",
              cursor: "pointer",
              transition: `background ${motion.fast}, color ${motion.fast}`,
            }}
          >
            {o.label}
            {o.dot ? (
              <span
                aria-hidden
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: radius.pill,
                  background: accent.base,
                  flex: "0 0 auto",
                }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
