"use client"

/* ------------------------------------------------------------------ */
/* Schema-driven control panel                                          */
/*                                                                     */
/* Renders the editing controls for a block from its declared           */
/* BlockSchema — proper typed widgets (text, textarea, range, color,    */
/* select, image, url, object, list/repeater) grouped into sections.    */
/* This REPLACES the old guess-from-JSON FieldEditor.                   */
/*                                                                     */
/* Every colour, radius, size and weight below comes from the shared    */
/* editor design system (./design) — the same ramp the merchant         */
/* dashboard ships, with ONE accent (the ember). No local hexes.        */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef, useState } from "react"
import type { BlockSchema, Device, FieldDef } from "@modules/cms/schema/types"
// 3C (ARCH-CANVAS P7): per-device visibility routing. The Advanced tab keeps
// its three familiar hide toggles, but reads resolve DUAL-SHAPE (legacy
// hideOn* trio OR the spec advanced.hide bag) and every write normalizes the
// bag to the spec shape via writeHide — edit-time only, published pages
// untouched until the merchant actually edits visibility.
import {
  HIDE_FIELD_DEVICE,
  isHiddenOnDevice,
  writeHide,
} from "@modules/cms/schema/types"
import { useCatalog } from "@modules/cms/editor/CatalogContext"
import MediaPicker from "@modules/cms/editor/MediaPicker"
import VideoField from "@modules/cms/editor/VideoField"
import { UNIVERSAL_STYLE } from "@modules/cms/schema/universal/style"
import { UNIVERSAL_ADVANCED } from "@modules/cms/schema/universal/advanced"
import {
  nodeContractFor,
  type NodeContractKind,
} from "@modules/cms/schema/universal/node-contracts"
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
  // 3E — control vocabulary (link picker, icon picker, hover state tabs).
  LinkControl,
  IconPickerControl,
  StateTabs,
  HOVERABLE_STYLE_KEYS,
} from "@modules/cms/editor/style-controls"
import type { Tokens, StyleState } from "@modules/cms/editor/style-controls"
import { IconButton, UiIcon } from "@modules/cms/editor/palette-icons"
import { AiFieldButton } from "@modules/cms/editor/AiFieldButton"
import {
  accent,
  button,
  eyebrow,
  field as fieldStyle,
  font,
  grey,
  hairline,
  motion,
  radius,
  semantic,
  shadow,
  surface,
  type,
} from "@modules/cms/editor/design"

/* ----------------------------- styles ----------------------------- */
const label: React.CSSProperties = {
  ...type.micro,
  fontFamily: font,
  display: "block",
  color: grey[50],
  margin: "12px 0 6px",
}
const input: React.CSSProperties = {
  ...fieldStyle(),
  boxSizing: "border-box",
  height: "auto",
  padding: "8px 10px",
}
const help: React.CSSProperties = {
  ...type.label,
  fontFamily: font,
  color: grey[40],
  marginTop: 4,
}
const groupBox: React.CSSProperties = {
  ...surface(),
  borderRadius: radius.md,
  padding: "12px",
  margin: "8px 0",
  background: grey[5],
}
const itemBox: React.CSSProperties = {
  ...surface(),
  borderRadius: radius.md,
  margin: "8px 0",
  overflow: "hidden",
}
const smallBtn: React.CSSProperties = {
  ...button("secondary", "sm"),
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
    ...type.label,
    fontFamily: font,
    border: hairline,
    background: grey[0],
    color: grey[70],
    borderRadius: radius.sm,
    minWidth: 28,
    height: 26,
    cursor: "pointer",
    padding: "0 6px",
    transition: `background ${motion.fast}, border-color ${motion.fast}`,
  }
  const keepSel = (e: React.MouseEvent) => e.preventDefault()
  return (
    <div style={{ border: `1px solid ${grey[30]}`, borderRadius: radius.md, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: 6, borderBottom: hairline, background: grey[5], flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("bold")} style={tb}><b>B</b></button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("italic")} style={{ ...tb, fontStyle: "italic" }}>I</button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("formatBlock", "<h2>")} style={tb}>H2</button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("formatBlock", "<p>")} style={tb}>P</button>
        <button type="button" onMouseDown={keepSel} onClick={() => cmd("insertUnorderedList")} style={tb}>List</button>
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
        <span style={{ width: 1, alignSelf: "stretch", background: grey[20], margin: "0 2px" }} />
        <label
          title="Text color"
          onMouseDown={saveSel}
          style={{ ...tb, display: "inline-flex", alignItems: "center", gap: 4, padding: "0 6px" }}
        >
          <span style={{ fontWeight: 600 }}>A</span>
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
        <span style={{ width: 1, alignSelf: "stretch", background: grey[20], margin: "0 2px" }} />
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
        style={{ ...type.body, fontFamily: font, color: grey[90], minHeight: 80, padding: "8px 10px", outline: "none" }}
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
/** The block being edited — an image's slot depends far more on WHICH BLOCK it
 *  lives in than on the field's name. A hero slide's field is literally called
 *  "Background image", and treating that as an abstract background produced a
 *  gradient blur instead of a hero photo. */
const BlockTypeCtx = React.createContext<string>("")

/** What KIND of image belongs in this slot — drives size, framing, transparency. */
function slotFor(blockType?: string, name?: string, label?: string): string {
  const s = `${name ?? ""} ${label ?? ""}`.toLowerCase()

  // Field-level intent always wins for these two.
  if (/logo|brand mark|favicon/.test(s)) return "logo"
  if (/avatar|author|portrait|person|headshot/.test(s)) return "portrait"

  // The block decides. This is the reliable signal.
  switch (blockType) {
    case "hero_slider":
      return "hero"
    case "deal_of_day":
      return "product"
    case "image_with_text":
      return "lifestyle"
    case "brand_strip":
      return "logo"
    case "testimonials":
      return "portrait"
    case "promo_banner_grid":
      // The big "sale" banner is wide; the category tiles are square.
      return /sale|promo|banner/.test(s) ? "banner" : "square"
    case "instagram_grid":
    case "image_gallery":
    case "category_showcase":
    case "product_tabs":
      return "square"
  }

  // No block context (chrome/theme fields) — fall back to the field wording.
  if (/hero|slide/.test(s)) return "hero"
  if (/banner|promo|sale/.test(s)) return "banner"
  if (/product|item photo/.test(s)) return "product"
  if (/lifestyle|about|story/.test(s)) return "lifestyle"
  if (/pattern|texture|backdrop/.test(s)) return "background"
  return "square"
}

function ImageControl({
  value,
  onChange,
  fieldName,
  fieldLabel,
}: {
  value: string
  onChange: (v: string) => void
  fieldName?: string
  fieldLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [openAi, setOpenAi] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const blockType = React.useContext(BlockTypeCtx)
  const slot = slotFor(blockType, fieldName, fieldLabel)
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            style={{ height: 48, width: 48, borderRadius: radius.md, border: hairline, objectFit: "cover", display: "block", flex: "0 0 auto" }}
          />
        ) : (
          <div style={{ height: 48, width: 48, borderRadius: radius.md, border: `1px dashed ${grey[30]}`, background: grey[5], flex: "0 0 auto" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            style={smallBtn}
            onClick={() => setOpen(true)}
          >
            <UiIcon name="image" size={13} />
            Choose image
          </button>
          <button
            type="button"
            title="Create this image with AI"
            style={{ ...smallBtn, borderColor: accent.base, color: accent.base }}
            onClick={() => setOpenAi(true)}
          >
            <UiIcon name="sparkles" size={13} />
            Generate with AI
          </button>
          <button
            type="button"
            style={{ ...button("ghost", "sm"), color: grey[50] }}
            onClick={() => setShowUrl((s) => !s)}
          >
            {showUrl ? "Hide URL" : "Edit URL"}
          </button>
        </div>
      </div>
      {showUrl ? (
        <input
          style={{ ...input, marginTop: 8 }}
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
          slot={slot}
        />
      ) : null}
      {openAi ? (
        <MediaPicker
          value={value}
          onChange={onChange}
          onClose={() => setOpenAi(false)}
          slot={slot}
          initialTab="generate"
        />
      ) : null}
    </div>
  )
}

/* ------------------------- single control ------------------------- */
/** The preset colour swatches — the product's own ramp + the one accent. */
const SWATCHES: string[] = [
  grey[90],
  accent.base,
  semantic.successFg,
  semantic.dangerFg,
  semantic.warnFg,
  semantic.infoFg,
  grey[60],
  grey[40],
  grey[0],
]

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
    case "datetime":
      return (
        <input
          type="datetime-local"
          style={input}
          value={(() => {
            const iso = (value as string) ?? ""
            const d = new Date(iso)
            if (isNaN(d.getTime())) return ""
            const pad = (n: number) => String(n).padStart(2, "0")
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          })()}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
        />
      )
    case "richText":
      return <RichTextControl value={(value as string) ?? ""} onChange={onChange} />
    case "textarea":
      return (
        <textarea
          style={{ ...input, minHeight: 72, resize: "vertical" }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="range"
            style={{ flex: 1, accentColor: accent.base }}
            value={(value as number) ?? field.min ?? 0}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span style={{ ...type.label, fontFamily: font, color: grey[70], minWidth: 54, textAlign: "right" }}>
            {String(value ?? field.min ?? 0)}
            {field.unit ?? ""}
          </span>
        </div>
      )
    case "boolean":
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => onChange(!value)}
            style={{
              width: 38,
              height: 21,
              borderRadius: radius.pill,
              border: "none",
              padding: 0,
              cursor: "pointer",
              position: "relative",
              background: value ? accent.base : grey[30],
              transition: `background ${motion.fast}`,
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
                background: grey[0],
                boxShadow: shadow.xs,
                transition: `left ${motion.fast}`,
              }}
            />
          </button>
          <span style={{ ...type.label, fontFamily: font, color: grey[50] }}>{value ? "On" : "Off"}</span>
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
              value={(value as string) || grey[90]}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: 38, height: 34, border: `1px solid ${grey[30]}`, borderRadius: radius.md, padding: 0, background: grey[0], cursor: "pointer" }}
            />
            <input style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onChange(c)}
                style={{ width: 18, height: 18, borderRadius: radius.sm, border: hairline, background: c, cursor: "pointer", padding: 0 }}
              />
            ))}
          </div>
        </div>
      )
    case "image":
      return (
        <ImageControl
          value={(value as string) ?? ""}
          onChange={onChange}
          fieldName={field.name}
          fieldLabel={field.label}
        />
      )
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
    case "video":
      return <VideoField value={(value as string) ?? ""} onChange={onChange} />
    // 3E — link picker. "url" is a type ALIAS (ARCH-UX U4 P1 §1): every
    // existing href/url field stores the same plain strings, so aliasing it
    // here upgrades them all to the picker with zero migration.
    case "link":
    case "url":
      return <LinkControl field={field} value={value} onChange={onChange} />
    case "icon":
      return <IconPickerControl field={field} value={value} onChange={onChange} />
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
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: grey[5], cursor: "pointer" }}
            onClick={() => setOpen((o) => (o === i ? null : i))}
          >
            <span aria-hidden style={{ color: grey[40], display: "inline-flex", flexShrink: 0 }}>
              <UiIcon name="grip" size={13} />
            </span>
            <span style={{ ...type.bodyStrong, fontFamily: font, color: grey[80] }}>
              {itemLabel} {i + 1}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <IconButton
                icon="arrow-up"
                label="Move up"
                size={24}
                iconSize={13}
                onClick={(e) => { e.stopPropagation(); if (i > 0) { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n) } }}
              />
              <IconButton
                icon="arrow-down"
                label="Move down"
                size={24}
                iconSize={13}
                onClick={(e) => { e.stopPropagation(); if (i < items.length - 1) { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n) } }}
              />
              <IconButton
                icon="duplicate"
                label="Duplicate"
                size={24}
                iconSize={13}
                onClick={(e) => { e.stopPropagation(); const n = [...items]; n.splice(i + 1, 0, JSON.parse(JSON.stringify(items[i]))); onChange(n) }}
              />
              <IconButton
                icon="trash"
                label="Remove"
                danger
                size={24}
                iconSize={13}
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
          style={{ ...button("primary", "md"), width: "100%", marginTop: 8 }}
        >
          <UiIcon name="plus" size={13} />
          Add {itemLabel.toLowerCase()}
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
  inheritBases,
  basePath = "",
}: {
  fields: FieldDef[]
  props: Record<string, unknown>
  /**
   * U7 (explicit null-inherit brand tokens): map of dot-path → the value the
   * theme would supply when the field is unset ("colors.primary" → the active
   * theme's primary). A field with an entry here renders an Inherited /
   * Overridden chip and a "Reset to theme default" affordance that writes
   * `null` (= inherit). Absent → fields behave exactly as before.
   */
  inheritBases?: Record<string, string>
  /** Dot-path prefix of this list within the region ("colors." etc.). */
  basePath?: string
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
        <div key={f.name} data-fk={f.name} data-fkl={(f.label || "").toLowerCase()}>
          <label style={label}>{f.label}</label>
          <div style={groupBox}>
            <FieldList
              fields={f.fields ?? []}
              props={(props[f.name] as Record<string, unknown>) ?? {}}
              onChange={(next) => set(f.name, next)}
              inheritBases={inheritBases}
              basePath={`${basePath}${f.name}.`}
            />
          </div>
        </div>
      )
    }
    if (f.type === "list") {
      return (
        <div key={f.name} data-fk={f.name} data-fkl={(f.label || "").toLowerCase()}>
          <label style={label}>{f.label}</label>
          <ListField field={f} value={(props[f.name] as unknown[]) ?? []} onChange={(v) => set(f.name, v)} />
        </div>
      )
    }
    // U7 — brand-token fields (theme colors/fonts): explicit null = inherit
    // the theme. The chip states the truth the stored model now carries:
    // `null` → "Inherited" (control displays the theme's own value), any
    // string → "Overridden" + a Reset-to-theme-default affordance that
    // writes null. Only paths listed in `inheritBases` opt in.
    const inheritBase = inheritBases?.[`${basePath}${f.name}`]
    if (inheritBase !== undefined) {
      const raw = props[f.name]
      const overridden = raw != null && raw !== ""
      return (
        <div key={f.name} data-fk={f.name} data-fkl={(f.label || "").toLowerCase()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <label style={{ ...label, marginBottom: 0 }}>{f.label}</label>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  ...type.micro,
                  fontFamily: font,
                  padding: "1px 6px",
                  borderRadius: radius.sm,
                  border: `1px solid ${overridden ? accent.tintStrong : grey[30]}`,
                  background: overridden ? accent.tint : grey[10],
                  color: overridden ? accent.base : grey[50],
                }}
              >
                {overridden ? "Overridden" : "Inherited"}
              </span>
              {overridden && (
                <button
                  type="button"
                  title="Reset to theme default"
                  aria-label={`Reset ${f.label} to theme default`}
                  onClick={() => set(f.name, null)}
                  style={{
                    ...type.micro,
                    fontFamily: font,
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: grey[50],
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reset
                </button>
              )}
            </span>
          </div>
          <div style={{ marginTop: 6, opacity: overridden ? 1 : 0.75 }}>
            <Control
              field={f}
              value={overridden ? raw : inheritBase}
              props={props}
              onChange={(v) => set(f.name, v)}
            />
          </div>
          {f.help ? <div style={help}>{f.help}</div> : null}
        </div>
      )
    }
    // Text-ish fields get the AI (sparkle) button on their label row — one-tap
    // rewrite/shorten/translate, or a custom instruction, for THIS field only.
    const aiable = f.type === "text" || f.type === "textarea" || f.type === "richText"
    return (
      <div key={f.name} data-fk={f.name} data-fkl={(f.label || "").toLowerCase()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <label style={{ ...label, marginBottom: 0 }}>{f.label}</label>
          {aiable && (
            <AiFieldButton
              value={typeof props[f.name] === "string" ? (props[f.name] as string) : ""}
              label={f.label}
              html={f.type === "richText"}
              onResult={(text) => set(f.name, text)}
            />
          )}
        </div>
        <div style={{ marginTop: 6 }}>
          <Control field={f} value={props[f.name]} props={props} onChange={(v) => set(f.name, v)} />
        </div>
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

/* Collapsible control section (accordion group). */
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
    <div style={{ marginTop: 8, borderTop: hairline }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: "12px 0 8px",
          cursor: "pointer",
        }}
      >
        <span style={eyebrow()}>{name}</span>
        <span
          aria-hidden
          style={{
            color: grey[40],
            display: "inline-flex",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: `transform ${motion.fast}`,
          }}
        >
          <UiIcon name="chevron-down" size={13} />
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
        ...surface(),
        borderRadius: radius.md,
        margin: "8px 0",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          ...eyebrow(),
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          border: 0,
          background: grey[5],
          padding: "10px 12px",
          cursor: "pointer",
          color: grey[70],
        }}
      >
        <span>{title}</span>
        <span
          aria-hidden
          style={{
            marginLeft: "auto",
            color: grey[40],
            display: "inline-flex",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: `transform ${motion.fast}`,
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
  ...type.label,
  fontFamily: font,
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  border: hairline,
  background: grey[0],
  color: grey[50],
  borderRadius: radius.sm,
  lineHeight: 1,
  padding: "4px 8px",
  cursor: "pointer",
  transition: `color ${motion.fast}, border-color ${motion.fast}`,
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

  // 3E — hover state (ARCH-UX U4). The four HOVERABLE_STYLE_KEYS fields
  // route through a Normal/Hover toggle; hover values live in a `hover`
  // sub-bag the engine serializes to `:hover` rules (buildHoverCss). The
  // Advanced tab has no hoverable field names, so it never shows the tabs.
  const [state, setState] = useState<StyleState>("normal")
  const hoverBag = (bag.hover ?? {}) as Record<string, unknown>
  const firstHoverGroup = groups.findIndex((g) =>
    g.fields.some((f) => HOVERABLE_STYLE_KEYS.includes(f.name))
  )

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

  // Diff-only, like setKey: empty values delete their hover key, and the
  // `hover` sub-bag itself is dropped when its last key clears.
  const setHoverKey = (name: string, next: unknown) => {
    const nextHover = { ...hoverBag }
    if (isEmptyValue(next)) {
      delete nextHover[name]
    } else {
      nextHover[name] = next
    }
    if (Object.keys(nextHover).length === 0) {
      const rest = { ...bag }
      delete rest.hover
      onChange(rest)
    } else {
      onChange({ ...bag, hover: nextHover })
    }
  }

  const renderField = (f: FieldDef) => {
    // Under the Hover tab, a hoverable field reads/writes the hover sub-bag;
    // non-hoverable fields render exactly as today regardless of state.
    const hoverMode =
      state === "hover" && HOVERABLE_STYLE_KEYS.includes(f.name)
    // 3C: the per-device visibility toggles. Each legacy hide FieldDef names
    // its device; reads are dual-shape (legacy trio OR advanced.hide) and
    // writes normalize the whole bag to the spec shape (writeHide).
    const hideDevice = HIDE_FIELD_DEVICE[f.name]
    const activeBag = hoverMode ? hoverBag : bag
    const has = hideDevice
      ? isHiddenOnDevice(bag, hideDevice)
      : Object.prototype.hasOwnProperty.call(activeBag, f.name)
    const reset = () => {
      if (hideDevice) {
        onChange(writeHide(bag, hideDevice, false))
      } else if (hoverMode) {
        setHoverKey(f.name, undefined)
      } else {
        setKey(f.name, undefined)
      }
    }
    return (
      <div key={f.name} data-fk={f.name} data-fkl={(f.label || "").toLowerCase()}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ ...label, marginBottom: 0 }}>{f.label}</label>
          {has ? (
            <button
              type="button"
              style={resetBtn}
              title={`Reset ${f.label}`}
              onClick={reset}
            >
              <UiIcon name="reset" size={12} />
              Reset
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: 6 }}>
          {hideDevice ? (
            // 3C: hide toggle — value resolves through the dual-shape read so
            // legacy-authored bags show their true state; the write emits the
            // spec `hide` shape and strips the legacy keys (edit-time
            // normalization). On the canvas the node ghosts (dim + badge)
            // rather than vanishing; the storefront emits a real media-query
            // display:none.
            <StyleControl
              field={f}
              value={isHiddenOnDevice(bag, hideDevice)}
              bag={bag}
              onChange={(next) =>
                onChange(writeHide(bag, hideDevice, next === true))
              }
              tokens={tokens}
            />
          ) : hoverMode ? (
            // Hover emission is device-agnostic in v1 — no responsive wrapper
            // (f.responsive stripped so the control sees a plain leaf).
            <StyleControl
              field={{ ...f, responsive: undefined }}
              value={hoverBag[f.name]}
              bag={hoverBag}
              onChange={(next) => setHoverKey(f.name, next)}
              tokens={tokens}
            />
          ) : (
            // 3C: ALL responsive routing lives in ResponsiveFieldWrapper,
            // which funnels every edit through writeResponsive /
            // clearResponsiveOverride (schema/types.ts) — the single
            // device-write path. No control ever builds a {base,...} shape.
            <ResponsiveFieldWrapper
              field={f}
              bag={bag}
              device={device}
              onBagChange={onChange}
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
          )}
        </div>
        {f.help ? <div style={help}>{f.help}</div> : null}
      </div>
    )
  }

  return (
    <>
      {groups.map((g, gi) => {
        // The state toggle sits once, above the first hoverable group
        // (Background in the universal set).
        const stateTabs =
          gi === firstHoverGroup ? (
            <StateTabs
              state={state}
              onChange={setState}
              hoverActive={Object.keys(hoverBag).length > 0}
            />
          ) : null
        return g.name ? (
          <React.Fragment key={g.name}>
            {stateTabs}
            <Accordion title={g.name} defaultOpen={gi === 0}>
              {g.fields.map(renderField)}
            </Accordion>
          </React.Fragment>
        ) : (
          <React.Fragment key="_ungrouped">
            {stateTabs}
            {g.fields.map(renderField)}
          </React.Fragment>
        )
      })}
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
  const ICONS: Record<string, string> = {
    content: "text",
    style: "brush",
    advanced: "settings",
  }
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        borderBottom: hairline,
        marginBottom: 16,
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
              ...type.label,
              fontFamily: font,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              border: 0,
              borderBottom: `2px solid ${on ? accent.base : "transparent"}`,
              marginBottom: -1,
              background: "transparent",
              color: on ? grey[90] : grey[50],
              fontWeight: on ? 600 : 500,
              padding: "10px 4px 8px",
              cursor: "pointer",
              transition: `color ${motion.fast}, border-color ${motion.fast}`,
            }}
          >
            <span style={{ display: "inline-flex", color: on ? accent.base : grey[40] }}>
              <UiIcon name={ICONS[t.key] ?? "settings"} size={14} />
            </span>
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
  crumbs,
  elementLabel,
  elementKey,
  onBackToSection,
  styleFields,
  advancedFields,
  notice,
  nodeKind,
  inheritBases,
}: {
  /** Content schema. Optional in element mode (there is no Content tab). */
  schema?: BlockSchema
  props?: Record<string, unknown>
  onChange?: (next: Record<string, unknown>) => void
  /**
   * U7 — inheritable brand-token fields: dot-path → the theme's own value for
   * that token ("colors.primary" → active-theme primary). Listed fields get
   * the Inherited/Overridden chip + Reset-to-theme-default (writes null).
   */
  inheritBases?: Record<string, string>
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
  /** Clickable breadcrumb trail (each crumb selects its node); when present
   *  it replaces the plain `blockLabel` string in the trail render. */
  crumbs?: { label: string; onClick?: () => void }[]
  /** Breadcrumb: the selected element's label (e.g. "Heading"). */
  elementLabel?: string
  /** The selected element's key — its own fields are hoisted to the top. */
  elementKey?: string
  /** Return to editing the whole section (clears the element selection). */
  onBackToSection?: () => void
  /**
   * Field list for the Style tab. Defaults to UNIVERSAL_STYLE; a node type
   * with a restricted contract (2E: columns — COLUMN_STYLE_FIELDS from
   * schema/universal/column.ts) passes its own subset. The bag shape and
   * serialization are unchanged — only which controls are OFFERED differs.
   */
  styleFields?: FieldDef[]
  /** Field list for the Advanced tab. Defaults to UNIVERSAL_ADVANCED; columns
   *  pass COLUMN_ADVANCED_FIELDS (visibility, identity, custom CSS only). */
  advancedFields?: FieldDef[]
  /**
   * One-line contextual note rendered above the tabs (2E: the facade-column
   * routing note — "Styling applies to the whole section"). Plain content;
   * absent → nothing renders.
   */
  notice?: React.ReactNode
  /**
   * The selected node's kind (3D — ARCH-UX §1.2 node contracts). When set,
   * the Style/Advanced field sets resolve through NODE_CONTRACTS
   * (schema/universal/node-contracts.ts) — e.g. "element" offers the
   * visibility+customCss Advanced subset, "chrome" identity+customCss.
   * Explicit `styleFields` / `advancedFields` (the 2E column mount) always
   * win over the kind lookup; absent both, the full universal sets apply,
   * exactly as before — every existing mount is untouched.
   */
  nodeKind?: NodeContractKind
}) {
  const [tab, setTab] = useState<PanelTab>("content")

  // Field-set resolution order: explicit prop > nodeKind contract > universal.
  const contract = nodeKind ? nodeContractFor(nodeKind) : undefined
  const resolvedStyleFields =
    styleFields ?? contract?.styleFields ?? UNIVERSAL_STYLE
  const resolvedAdvancedFields =
    advancedFields ?? contract?.advancedFields ?? UNIVERSAL_ADVANCED

  const contentFieldList = schema?.fields ?? contentFields
  const tabs: { key: PanelTab; label: string }[] = []
  // Element mode used to be Style/Advanced ONLY, on the theory that "element
  // content lives in the block". True — but it meant that clicking a heading to
  // change its words dropped you in a panel that could not change words, and the
  // only way out was "← Back to Hero Slider". Every text edit cost a round trip.
  //
  // The element's content IS the section's content, so the section's fields are
  // shown right here, with THIS element's fields hoisted to the top.
  if (contentFieldList && onChange) {
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
          inheritBases={inheritBases}
        />
        {contentExtra}
      </>
    )
  }

  const activeTab = tabs.some((t) => t.key === tab)
    ? tab
    : tabs[0]?.key ?? "style"

  /**
   * In element mode, put the fields that belong to THIS element first.
   *
   * The panel shows the whole section's content, which is correct — a heading's
   * text lives on the section. But dumping twenty fields on someone who clicked
   * one heading is only marginally better than sending them "back". So the
   * element's own fields are hoisted to the top; the rest of the section follows
   * underneath, still reachable, no navigation required.
   */
  const orderedContentFields = (() => {
    const fields = contentFieldList ?? []
    if (!elementMode || !elementKey || !fields.length) {
      return fields
    }
    const key = elementKey.toLowerCase()
    const relevant = (f: any): boolean => {
      const k = String(f?.key ?? "").toLowerCase()
      if (!k) return false
      return k === key || k.includes(key) || key.includes(k)
    }
    const mine = fields.filter(relevant)
    if (!mine.length) {
      return fields
    }
    return [...mine, ...fields.filter((f) => !relevant(f))]
  })()

  return (
    <div style={{ fontFamily: font }}>
      {elementMode || widgetMode ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={onBackToSection}
            style={{
              ...type.label,
              fontFamily: font,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: accent.base,
              background: "none",
              border: 0,
              cursor: "pointer",
              padding: 0,
              marginBottom: 6,
            }}
          >
            <UiIcon name="arrow-left" size={12} />
            Back to {blockLabel ?? "section"}
          </button>
          <div style={{ ...type.title, fontFamily: font, color: grey[90] }}>
            {crumbs && crumbs.length ? (
              crumbs.map((c, i) => (
                <span key={i}>
                  {c.onClick ? (
                    <button
                      type="button"
                      onClick={c.onClick}
                      title={`Select ${c.label}`}
                      style={{
                        ...type.title,
                        fontFamily: font,
                        color: grey[40],
                        fontWeight: 500,
                        background: "none",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationColor: grey[20],
                        textUnderlineOffset: 3,
                      }}
                    >
                      {c.label}
                    </button>
                  ) : (
                    <span style={{ color: grey[40], fontWeight: 500 }}>
                      {c.label}
                    </span>
                  )}
                  <span style={{ color: grey[30], margin: "0 6px" }}>›</span>
                </span>
              ))
            ) : (
              <span>
                <span style={{ color: grey[40], fontWeight: 500 }}>
                  {blockLabel ?? "Section"}
                </span>
                <span style={{ color: grey[30], margin: "0 6px" }}>›</span>
              </span>
            )}
            {elementLabel ?? "Element"}
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          style={{
            ...type.label,
            fontFamily: font,
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            color: grey[60],
            background: grey[5],
            border: hairline,
            borderRadius: radius.md,
            padding: "8px 10px",
            marginBottom: 10,
          }}
        >
          <span style={{ display: "inline-flex", color: grey[40], flexShrink: 0, marginTop: 1 }}>
            <UiIcon name="alert" size={13} />
          </span>
          <span>{notice}</span>
        </div>
      ) : null}

      <TabHeader tabs={tabs} active={activeTab} onSelect={setTab} />

      {activeTab === "content" && contentFieldList && onChange ? (
        <BlockTypeCtx.Provider value={schema?.type ?? ""}>
          <FieldList
            fields={orderedContentFields}
            props={props ?? {}}
            onChange={onChange}
            inheritBases={inheritBases}
          />
          {contentExtra}
        </BlockTypeCtx.Provider>
      ) : null}

      {activeTab === "style" && onStyleChange ? (
        <StyleFieldList
          fields={resolvedStyleFields}
          bag={styleBag ?? {}}
          onChange={onStyleChange}
          device={device}
          tokens={themeTokens}
        />
      ) : null}

      {activeTab === "advanced" && onAdvancedChange ? (
        <StyleFieldList
          fields={resolvedAdvancedFields}
          bag={advancedBag ?? {}}
          onChange={onAdvancedChange}
          device={device}
          tokens={themeTokens}
        />
      ) : null}
    </div>
  )
}
