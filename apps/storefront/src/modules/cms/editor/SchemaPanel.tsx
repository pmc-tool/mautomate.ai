"use client"

/* ------------------------------------------------------------------ */
/* Schema-driven control panel                                          */
/*                                                                     */
/* Renders the editing controls for a block from its declared           */
/* BlockSchema — proper typed widgets (text, textarea, range, color,    */
/* select, image, url, object, list/repeater) grouped into sections.    */
/* This REPLACES the old guess-from-JSON FieldEditor.                   */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef, useState } from "react"
import type { BlockSchema, Device, FieldDef } from "@modules/cms/schema/types"
import { useCatalog } from "@modules/cms/editor/CatalogContext"
import MediaPicker from "@modules/cms/editor/MediaPicker"
import { UNIVERSAL_STYLE } from "@modules/cms/schema/universal/style"
import { UNIVERSAL_ADVANCED } from "@modules/cms/schema/universal/advanced"
import ResponsiveFieldWrapper from "@modules/cms/editor/ResponsiveFieldWrapper"
import {
  DimensionsControl,
  UnitNumberControl,
  TypographyControl,
  BackgroundControl,
  BorderControl,
  BoxShadowControl,
  ChooseControl,
  CodeControl,
  ColorControl,
} from "@modules/cms/editor/style-controls"
import type { Tokens } from "@modules/cms/editor/style-controls"
import { IconButton, UiIcon } from "@modules/cms/editor/palette-icons"

/* ----------------------------- styles ----------------------------- */
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#6b7280",
  margin: "12px 0 5px",
}
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
const help: React.CSSProperties = { fontSize: 11, color: "#9ca3af", marginTop: 3 }
const groupBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 9,
  padding: "10px 12px",
  margin: "8px 0",
  background: "#fafafa",
}
const itemBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 9,
  margin: "8px 0",
  background: "#fff",
  overflow: "hidden",
}
const smallBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 6,
  fontSize: 12,
  padding: "3px 9px",
  cursor: "pointer",
  color: "#374151",
}

/* --------------------------- rich text ---------------------------- */
function RichTextControl({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Remember the last in-editor selection so controls that steal focus (the
  // native color picker + size <select>) can restore it before applying.
  const savedRange = useRef<Range | null>(null)
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== (value || "")) {
      el.innerHTML = value || ""
    }
  }, [value])
  const saveSel = () => {
    const sel = window.getSelection()
    if (
      sel &&
      sel.rangeCount > 0 &&
      ref.current &&
      ref.current.contains(sel.anchorNode)
    ) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }
  const restoreSel = () => {
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }
  const cmd = (c: string, arg?: string) => {
    document.execCommand(c, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }
  // Style-producing commands (color/size/align): emit inline CSS via
  // styleWithCSS so the output stays on the sanitizer's style allow-list,
  // then flip it back so bold/italic keep emitting <b>/<i> elements.
  const styleCmd = (c: string, arg?: string) => {
    ref.current?.focus()
    restoreSel()
    document.execCommand("styleWithCSS", false, "true")
    document.execCommand(c, false, arg)
    document.execCommand("styleWithCSS", false, "false")
    if (ref.current) onChange(ref.current.innerHTML)
  }
  const tb: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 5,
    minWidth: 28,
    height: 26,
    cursor: "pointer",
    fontSize: 12,
    padding: "0 6px",
  }
  const keepSel = (e: React.MouseEvent) => e.preventDefault()
  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: 7, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 3, padding: 5, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("bold")} style={tb}><b>B</b></button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("italic")} style={{ ...tb, fontStyle: "italic" }}>I</button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("formatBlock", "<h2>")} style={tb}>H2</button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("formatBlock", "<p>")} style={tb}>P</button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("insertUnorderedList")} style={tb}>• List</button>
        <button
          type="button"
          onMouseDown={keepSel}
          onClick={() => {
            const u = window.prompt("Link URL:")
            if (u) cmd("createLink", u)
          }}
          style={tb}
        >
          Link
        </button>
        <span style={{ width: 1, alignSelf: "stretch", background: "#e5e7eb", margin: "0 2px" }} />
        <label
          title="Text color"
          onMouseDown={saveSel}
          style={{ ...tb, display: "inline-flex", alignItems: "center", gap: 4, padding: "0 6px" }}
        >
          <span style={{ fontWeight: 700 }}>A</span>
          <input
            type="color"
            aria-label="Text color"
            onChange={(e) => styleCmd("foreColor", e.target.value)}
            style={{ width: 16, height: 16, border: "none", background: "none", padding: 0, cursor: "pointer" }}
          />
        </label>
        <select
          title="Font size"
          aria-label="Font size"
          value=""
          onMouseDown={saveSel}
          onChange={(e) => {
            if (e.target.value) styleCmd("fontSize", e.target.value)
            e.currentTarget.value = ""
          }}
          style={{ ...tb, padding: "0 4px" }}
        >
          <option value="">Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Medium</option>
          <option value="5">Large</option>
          <option value="6">X-Large</option>
          <option value="7">Huge</option>
        </select>
        <span style={{ width: 1, alignSelf: "stretch", background: "#e5e7eb", margin: "0 2px" }} />
        <button type="button" title="Align left" onMouseDown={keepSel} onClick={() => styleCmd("justifyLeft")} style={tb}>L</button>
        <button type="button" title="Align center" onMouseDown={keepSel} onClick={() => styleCmd("justifyCenter")} style={tb}>C</button>
        <button type="button" title="Align right" onMouseDown={keepSel} onClick={() => styleCmd("justifyRight")} style={tb}>R</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (ref.current) onChange(ref.current.innerHTML)
        }}
        onKeyUp={saveSel}
        onMouseUp={saveSel}
        style={{ minHeight: 80, padding: "8px 10px", fontSize: 13, outline: "none", lineHeight: 1.5 }}
      />
    </div>
  )
}

/* ----------------------- product / collection --------------------- */
function PickerControl({
  kind,
  value,
  onChange,
}: {
  kind: "product" | "collection"
  value: string
  onChange: (v: string) => void
}) {
  const catalog = useCatalog()
  const options = kind === "product" ? catalog.products : catalog.categories
  return (
    <select style={input} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">— none —</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ----------------------------- image ------------------------------ */
function ImageControl({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            style={{ height: 46, width: 46, borderRadius: 7, border: "1px solid #e5e7eb", objectFit: "cover", display: "block", flex: "0 0 auto" }}
          />
        ) : (
          <div style={{ height: 46, width: 46, borderRadius: 7, border: "1px dashed #d1d5db", background: "#fafafa", flex: "0 0 auto" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            style={{ ...smallBtn, borderColor: "#2563eb", color: "#2563eb" }}
            onClick={() => setOpen(true)}
          >
            Choose image
          </button>
          <button
            type="button"
            style={{ ...smallBtn, fontSize: 11 }}
            onClick={() => setShowUrl((s) => !s)}
          >
            {showUrl ? "Hide URL" : "Edit URL"}
          </button>
        </div>
      </div>
      {showUrl ? (
        <input
          style={{ ...input, marginTop: 7 }}
          value={value ?? ""}
          placeholder="Image URL"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {open ? (
        <MediaPicker
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------- single control ------------------------- */
function Control({
  field,
  value,
  props,
  onChange,
}: {
  field: FieldDef
  value: unknown
  props: Record<string, unknown>
  onChange: (v: unknown) => void
}) {
  switch (field.type) {
    case "richText":
      return <RichTextControl value={(value as string) ?? ""} onChange={onChange} />
    case "textarea":
      return (
        <textarea
          style={{ ...input, minHeight: 70, resize: "vertical" }}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "number":
      return (
        <input
          type="number"
          style={input}
          value={value as number}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      )
    case "range":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="range"
            style={{ flex: 1 }}
            value={(value as number) ?? field.min ?? 0}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span style={{ fontSize: 12, color: "#374151", minWidth: 54, textAlign: "right" }}>
            {String(value ?? field.min ?? 0)}
            {field.unit ?? ""}
          </span>
        </div>
      )
    case "boolean":
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => onChange(!value)}
            style={{
              width: 38,
              height: 21,
              borderRadius: 11,
              border: "none",
              padding: 0,
              cursor: "pointer",
              position: "relative",
              background: value ? "#2563eb" : "#cbd5e1",
              transition: "background 0.15s ease",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: value ? 19 : 2,
                width: 17,
                height: 17,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                transition: "left 0.15s ease",
              }}
            />
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{value ? "On" : "Off"}</span>
        </div>
      )
    case "select":
      return (
        <select style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case "color":
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="color"
              value={(value as string) || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: 38, height: 34, border: "1px solid #d1d5db", borderRadius: 6, padding: 0, background: "#fff", cursor: "pointer" }}
            />
            <input style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            {["#111827", "#2563eb", "#059669", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#64748b", "#ffffff"].map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onChange(c)}
                style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #e5e7eb", background: c, cursor: "pointer", padding: 0 }}
              />
            ))}
          </div>
        </div>
      )
    case "image":
      return <ImageControl value={(value as string) ?? ""} onChange={onChange} />
    case "product":
      return <PickerControl kind="product" value={(value as string) ?? ""} onChange={onChange} />
    case "collection":
      return <PickerControl kind="collection" value={(value as string) ?? ""} onChange={onChange} />
    // Design-control field types can appear in a Content schema too (e.g. the
    // header logo's height/padding/margin) — render the real controls, not a
    // stringified text box.
    case "dimensions":
      return <DimensionsControl field={field} value={value} onChange={onChange} />
    case "unitNumber":
      return <UnitNumberControl field={field} value={value} onChange={onChange} />
    case "typographyGroup":
      return <TypographyControl field={field} value={value} onChange={onChange} />
    case "background":
      return <BackgroundControl field={field} value={value} onChange={onChange} />
    case "border":
      return <BorderControl field={field} value={value} onChange={onChange} />
    case "boxShadow":
      return <BoxShadowControl field={field} value={value} onChange={onChange} />
    case "choose":
      return <ChooseControl field={field} value={value} onChange={onChange} />
    case "code":
      return <CodeControl field={field} value={value} onChange={onChange} />
    case "url":
    case "text":
    default:
      return <input style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
  }
}

/* --------------------------- list field --------------------------- */
function ListField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: unknown[]
  onChange: (v: unknown[]) => void
}) {
  const [open, setOpen] = useState<number | null>(0)
  const items = Array.isArray(value) ? value : []
  const itemLabel = field.itemLabel ?? "Item"

  const blankItem = () =>
    Object.fromEntries(
      (field.fields ?? []).map((sf) => [sf.name, sf.default ?? (sf.type === "list" ? [] : sf.type === "object" ? {} : "")])
    )

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={itemBox}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "#f9fafb", cursor: "pointer" }}
            onClick={() => setOpen((o) => (o === i ? null : i))}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              {itemLabel} {i + 1}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <IconButton
                icon="arrow-up"
                label="Move up"
                size={22}
                iconSize={12}
                onClick={(e) => { e.stopPropagation(); if (i > 0) { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n) } }}
              />
              <IconButton
                icon="arrow-down"
                label="Move down"
                size={22}
                iconSize={12}
                onClick={(e) => { e.stopPropagation(); if (i < items.length - 1) { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n) } }}
              />
              <IconButton
                icon="duplicate"
                label="Duplicate"
                size={22}
                iconSize={12}
                onClick={(e) => { e.stopPropagation(); const n = [...items]; n.splice(i + 1, 0, JSON.parse(JSON.stringify(items[i]))); onChange(n) }}
              />
              <IconButton
                icon="x"
                label="Remove"
                danger
                size={22}
                iconSize={12}
                onClick={(e) => { e.stopPropagation(); onChange(items.filter((_, idx) => idx !== i)) }}
              />
            </span>
          </div>
          {open === i && (
            <div style={{ padding: "4px 12px 12px" }}>
              <FieldList
                fields={field.fields ?? []}
                props={item as Record<string, unknown>}
                onChange={(next) => onChange(items.map((it, idx) => (idx === i ? next : it)))}
              />
            </div>
          )}
        </div>
      ))}
      {(!field.maxItems || items.length < field.maxItems) && (
        <button
          onClick={() => { onChange([...items, blankItem()]); setOpen(items.length) }}
          style={{ width: "100%", border: 0, background: "#26292c", color: "#fff", borderRadius: 3, fontSize: 12, fontWeight: 500, padding: "9px", cursor: "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          + Add {itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  )
}

/* ----------------------- render a field list ---------------------- */
function FieldList({
  fields,
  props,
  onChange,
}: {
  fields: FieldDef[]
  props: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  // Partition into groups (preserve order; ungrouped first under "").
  const groups: { name: string; fields: FieldDef[] }[] = []
  for (const f of fields) {
    if (f.hidden?.(props)) continue
    const g = f.group ?? ""
    let bucket = groups.find((x) => x.name === g)
    if (!bucket) { bucket = { name: g, fields: [] }; groups.push(bucket) }
    bucket.fields.push(f)
  }

  const set = (name: string, v: unknown) => onChange({ ...props, [name]: v })

  const renderField = (f: FieldDef) => {
    if (f.type === "object") {
      return (
        <div key={f.name}>
          <label style={label}>{f.label}</label>
          <div style={groupBox}>
            <FieldList
              fields={f.fields ?? []}
              props={(props[f.name] as Record<string, unknown>) ?? {}}
              onChange={(next) => set(f.name, next)}
            />
          </div>
        </div>
      )
    }
    if (f.type === "list") {
      return (
        <div key={f.name}>
          <label style={label}>{f.label}</label>
          <ListField field={f} value={(props[f.name] as unknown[]) ?? []} onChange={(v) => set(f.name, v)} />
        </div>
      )
    }
    return (
      <div key={f.name}>
        <label style={label}>{f.label}</label>
        <Control field={f} value={props[f.name]} props={props} onChange={(v) => set(f.name, v)} />
        {f.help ? <div style={help}>{f.help}</div> : null}
      </div>
    )
  }

  return (
    <>
      {groups.map((g) =>
        g.name ? (
          <GroupSection key={g.name} name={g.name} fields={g.fields} render={renderField} />
        ) : (
          <React.Fragment key="_ungrouped">{g.fields.map(renderField)}</React.Fragment>
        )
      )}
    </>
  )
}

/* Collapsible control section (Elementor-style accordion group). */
function GroupSection({
  name,
  fields,
  render,
}: {
  name: string
  fields: FieldDef[]
  render: (f: FieldDef) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(true)
  return (
    <div style={{ marginTop: 8, borderTop: "1px solid #f1f5f9" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: "11px 0 7px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6 }}>
          {name}
        </span>
        <span style={{ fontSize: 10, color: "#9ca3af", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
          ▸
        </span>
      </button>
      {open && <div>{fields.map(render)}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Style / Advanced dispatch — pick the right widget per FieldType      */
/* ------------------------------------------------------------------ */
function StyleControl({
  field,
  value,
  bag,
  onChange,
  tokens,
}: {
  field: FieldDef
  value: unknown
  bag: Record<string, unknown>
  onChange: (v: unknown) => void
  /** Global theme tokens offered to linkable color/font controls (P5). */
  tokens?: Tokens
}) {
  switch (field.type) {
    case "dimensions":
      return <DimensionsControl field={field} value={value} onChange={onChange} />
    case "unitNumber":
      return <UnitNumberControl field={field} value={value} onChange={onChange} />
    case "typographyGroup":
      return (
        <TypographyControl
          field={field}
          value={value}
          onChange={onChange}
          tokens={tokens}
        />
      )
    case "background":
      return <BackgroundControl field={field} value={value} onChange={onChange} />
    case "border":
      return <BorderControl field={field} value={value} onChange={onChange} />
    case "boxShadow":
      return <BoxShadowControl field={field} value={value} onChange={onChange} />
    case "choose":
      return <ChooseControl field={field} value={value} onChange={onChange} />
    case "code":
      return <CodeControl field={field} value={value} onChange={onChange} />
    // Color links to a global token when tokens are provided; otherwise it is a
    // plain color picker (backward compatible with no tokens).
    case "color":
      return (
        <ColorControl
          field={field}
          value={value}
          onChange={onChange}
          tokens={tokens}
        />
      )
    // select / boolean / text / number reuse the content controls.
    default:
      return <Control field={field} value={value} props={bag} onChange={onChange} />
  }
}

/* ------------------------------------------------------------------ */
/* Collapsible group (dependency-safe accordion)                        */
/* ------------------------------------------------------------------ */
function Accordion({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 9,
        margin: "8px 0",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          border: 0,
          background: "#f9fafb",
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#374151",
        }}
      >
        <span>{title}</span>
        <span
          aria-hidden
          style={{
            marginLeft: "auto",
            color: "#9ca3af",
            display: "inline-flex",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform .15s",
          }}
        >
          <UiIcon name="chevron" size={13} />
        </span>
      </button>
      {open ? <div style={{ padding: "4px 12px 12px" }}>{children}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Style / Advanced field list — grouped accordions over a diff bag     */
/*                                                                     */
/* Diff-only storage: only keys the user actually sets live in `bag`;   */
/* the per-field reset deletes the key. Defaults are NEVER pre-seeded.   */
/* ------------------------------------------------------------------ */
const resetBtn: React.CSSProperties = {
  marginLeft: "auto",
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#6b7280",
  borderRadius: 5,
  fontSize: 11,
  lineHeight: 1,
  padding: "3px 7px",
  cursor: "pointer",
}

function isEmptyValue(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  )
}

function StyleFieldList({
  fields,
  bag,
  onChange,
  device,
  tokens,
}: {
  fields: FieldDef[]
  bag: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  device: Device
  /** Global theme tokens forwarded to linkable color/font controls (P5). */
  tokens?: Tokens
}) {
  // Partition into groups, preserving declaration order (ungrouped first).
  const groups: { name: string; fields: FieldDef[] }[] = []
  for (const f of fields) {
    if (f.hidden?.(bag)) continue
    const g = f.group ?? ""
    let bucket = groups.find((x) => x.name === g)
    if (!bucket) {
      bucket = { name: g, fields: [] }
      groups.push(bucket)
    }
    bucket.fields.push(f)
  }

  const setKey = (name: string, next: unknown) => {
    if (isEmptyValue(next)) {
      // Remove the key entirely — keep the bag a tiny diff.
      const rest = { ...bag }
      delete rest[name]
      onChange(rest)
    } else {
      onChange({ ...bag, [name]: next })
    }
  }

  const renderField = (f: FieldDef) => {
    const has = Object.prototype.hasOwnProperty.call(bag, f.name)
    return (
      <div key={f.name}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ ...label, marginBottom: 0 }}>{f.label}</label>
          {has ? (
            <button
              type="button"
              style={resetBtn}
              title={`Reset ${f.label}`}
              onClick={() => setKey(f.name, undefined)}
            >
              ↺ Reset
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: 5 }}>
          <ResponsiveFieldWrapper
            field={f}
            value={bag[f.name]}
            device={device}
            onChange={(next) => setKey(f.name, next)}
          >
            {(deviceValue, setDeviceValue) => (
              <StyleControl
                field={f}
                value={deviceValue}
                bag={bag}
                onChange={setDeviceValue}
                tokens={tokens}
              />
            )}
          </ResponsiveFieldWrapper>
        </div>
        {f.help ? <div style={help}>{f.help}</div> : null}
      </div>
    )
  }

  return (
    <>
      {groups.map((g, gi) =>
        g.name ? (
          <Accordion key={g.name} title={g.name} defaultOpen={gi === 0}>
            {g.fields.map(renderField)}
          </Accordion>
        ) : (
          <React.Fragment key="_ungrouped">{g.fields.map(renderField)}</React.Fragment>
        )
      )}
    </>
  )
}

/* ----------------------------- tabs ------------------------------- */
type PanelTab = "content" | "style" | "advanced"

function TabHeader({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: PanelTab; label: string }[]
  active: PanelTab
  onSelect: (t: PanelTab) => void
}) {
  const ICONS: Record<string, string> = { content: "✎", style: "◐", advanced: "⚙" }
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        borderBottom: "1px solid #e6e8ea",
        marginBottom: 12,
      }}
    >
      {tabs.map((t) => {
        const on = active === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              border: 0,
              borderBottom: on ? "2px solid #93003f" : "2px solid transparent",
              marginBottom: -1,
              background: "transparent",
              color: on ? "#93003f" : "#6d7882",
              fontSize: 11,
              fontWeight: on ? 600 : 500,
              padding: "9px 4px 8px",
              cursor: "pointer",
              transition: "color .12s, border-color .12s",
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{ICONS[t.key] ?? ""}</span>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------- panel ------------------------------ */
export default function SchemaPanel({
  schema,
  props,
  onChange,
  styleBag,
  advancedBag,
  onStyleChange,
  onAdvancedChange,
  device = "desktop",
  themeTokens,
  elementMode = false,
  widgetMode = false,
  contentFields,
  contentExtra,
  blockLabel,
  elementLabel,
  onBackToSection,
}: {
  /** Content schema. Optional in element mode (there is no Content tab). */
  schema?: BlockSchema
  props?: Record<string, unknown>
  onChange?: (next: Record<string, unknown>) => void
  /** Namespaced `block.style` diff bag (only user-set keys). */
  styleBag?: Record<string, unknown>
  /** Namespaced `block.advanced` diff bag (only user-set keys). */
  advancedBag?: Record<string, unknown>
  onStyleChange?: (next: Record<string, unknown>) => void
  onAdvancedChange?: (next: Record<string, unknown>) => void
  /** Active editing device for responsive style/advanced leaves. */
  device?: Device
  /**
   * Global theme tokens (colors + fonts) offered to linkable color/font
   * controls in the Style/Advanced tabs (P5). Absent → controls behave as raw
   * value editors, exactly as before.
   */
  themeTokens?: Tokens
  /**
   * Element-editing mode (E1): drop the Content tab (element content lives in
   * the block, not here) and show a breadcrumb + back-to-section affordance.
   * Only Style + Advanced are offered, editing the per-element override bags.
   */
  elementMode?: boolean
  /**
   * Widget-editing mode (Composer W1): like element mode (breadcrumb + back)
   * but WITH a Content tab — a widget's content props live on the widget
   * itself and are described by `contentFields` (from WIDGET_SCHEMAS) rather
   * than a full BlockSchema.
   */
  widgetMode?: boolean
  /** Widget mode: the widget's CONTENT fields (WIDGET_SCHEMAS[type].fields). */
  contentFields?: FieldDef[]
  /**
   * Extra node rendered inside the Content tab after the fields — the
   * container section uses it for its columns/widgets manager.
   */
  contentExtra?: React.ReactNode
  /** Breadcrumb: the parent block's label (e.g. "Hero Slider"). */
  blockLabel?: string
  /** Breadcrumb: the selected element's label (e.g. "Heading"). */
  elementLabel?: string
  /** Return to editing the whole section (clears the element selection). */
  onBackToSection?: () => void
}) {
  const [tab, setTab] = useState<PanelTab>(elementMode ? "style" : "content")

  const contentFieldList = schema?.fields ?? contentFields
  const tabs: { key: PanelTab; label: string }[] = []
  // Content tab in section mode (block schema) and widget mode (widget
  // content fields) — element content lives in the block, so element mode
  // stays Style/Advanced-only.
  if (!elementMode && contentFieldList && onChange) {
    tabs.push({ key: "content", label: "Content" })
  }
  if (onStyleChange) tabs.push({ key: "style", label: "Style" })
  if (onAdvancedChange) tabs.push({ key: "advanced", label: "Advanced" })

  // Backward compatible (section mode): no style/advanced wiring → plain
  // Content editor, exactly as before.
  if (!elementMode && tabs.length === 1 && tabs[0].key === "content") {
    return (
      <>
        <FieldList
          fields={contentFieldList!}
          props={props ?? {}}
          onChange={onChange!}
        />
        {contentExtra}
      </>
    )
  }

  const activeTab = tabs.some((t) => t.key === tab)
    ? tab
    : tabs[0]?.key ?? "style"

  return (
    <div>
      {elementMode || widgetMode ? (
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={onBackToSection}
            style={{
              fontSize: 12,
              color: "#2563eb",
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
              marginBottom: 6,
            }}
          >
            ← Back to {blockLabel ?? "section"}
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            <span style={{ color: "#9ca3af", fontWeight: 500 }}>
              {blockLabel ?? "Section"}
            </span>
            <span style={{ color: "#d1d5db", margin: "0 6px" }}>›</span>
            {elementLabel ?? "Element"}
          </div>
        </div>
      ) : null}

      <TabHeader tabs={tabs} active={activeTab} onSelect={setTab} />

      {activeTab === "content" && contentFieldList && onChange ? (
        <>
          <FieldList
            fields={contentFieldList}
            props={props ?? {}}
            onChange={onChange}
          />
          {contentExtra}
        </>
      ) : null}

      {activeTab === "style" && onStyleChange ? (
        <StyleFieldList
          fields={UNIVERSAL_STYLE}
          bag={styleBag ?? {}}
          onChange={onStyleChange}
          device={device}
          tokens={themeTokens}
        />
      ) : null}

      {activeTab === "advanced" && onAdvancedChange ? (
        <StyleFieldList
          fields={UNIVERSAL_ADVANCED}
          bag={advancedBag ?? {}}
          onChange={onAdvancedChange}
          device={device}
          tokens={themeTokens}
        />
      ) : null}
    </div>
  )
}
