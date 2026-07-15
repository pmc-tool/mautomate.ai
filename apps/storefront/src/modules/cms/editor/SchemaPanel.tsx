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
    // Text-ish fields get the AI (sparkle) button on their label row — one-tap
    // rewrite/shorten/translate, or a custom instruction, for THIS field only.
    const aiable = f.type === "text" || f.type === "textarea" || f.type === "richText"
    return (
      <div key={f.name}>
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
              <UiIcon name="reset" size={12} />
              Reset
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: 6 }}>
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
  elementLabel,
  elementKey,
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
  /** The selected element's key — its own fields are hoisted to the top. */
  elementKey?: string
  /** Return to editing the whole section (clears the element selection). */
  onBackToSection?: () => void
}) {
  const [tab, setTab] = useState<PanelTab>("content")

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
            <span style={{ color: grey[40], fontWeight: 500 }}>
              {blockLabel ?? "Section"}
            </span>
            <span style={{ color: grey[30], margin: "0 6px" }}>›</span>
            {elementLabel ?? "Element"}
          </div>
        </div>
      ) : null}

      <TabHeader tabs={tabs} active={activeTab} onSelect={setTab} />

      {activeTab === "content" && contentFieldList && onChange ? (
        <BlockTypeCtx.Provider value={schema?.type ?? ""}>
          <FieldList
            fields={orderedContentFields}
            props={props ?? {}}
            onChange={onChange}
          />
          {contentExtra}
        </BlockTypeCtx.Provider>
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
