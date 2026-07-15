"use client"

import { useMemo, useRef, useState } from "react"
import { listBlockSchemas } from "@modules/cms/schema"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  field,
  font,
  grey,
  hairline,
  hairlineDark,
  iconButton,
  ink,
  radius,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"

type Msg = { role: "user" | "ai"; text: string; error?: boolean }

/**
 * AI page editor panel (P1) — chat that edits the current page. Sends the
 * page's blocks + a compact schema catalog to the server gateway; applies the
 * returned, server-validated patches through the editor's own undo pipeline.
 * Every AI edit is one Cmd/Ctrl+Z from gone; Publish stays human.
 */
export function AiPanel({
  editorKey,
  brand,
  blocks,
  onApply,
  onClose,
}: {
  editorKey: string
  brand: string
  blocks: unknown[]
  onApply: (patches: any[]) => number
  onClose: () => void
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: "Tell me what to change on this page — for example: \"Make the hero about our summer sale with 20% off\", \"Add a testimonials section under the hero\", or \"Rewrite all the copy to sound more premium\".",
    },
  ])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Compact schema catalog: block types + field names/types (options trimmed).
  const catalog = useMemo(
    () =>
      listBlockSchemas().map((s) => ({
        type: s.type,
        label: s.label,
        fields: (s.fields ?? []).map((f: any) => ({
          name: f.name,
          type: f.type,
          ...(f.options ? { options: f.options.map((o: any) => o.value).slice(0, 12) } : {}),
          ...(f.fields
            ? { fields: f.fields.map((sf: any) => ({ name: sf.name, type: sf.type })) }
            : {}),
        })),
      })),
    []
  )

  const scroll = () =>
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    })

  const send = async () => {
    const instruction = input.trim()
    if (!instruction || busy) return
    setInput("")
    setMsgs((m) => [...m, { role: "user", text: instruction }])
    setBusy(true)
    scroll()
    try {
      const r = await fetch(`/api/puck/ai-edit?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          blocks,
          catalog,
          brand,
          // Last few turns, so the AI remembers what we were talking about.
          history: msgs.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || "AI request failed")
      const patches = Array.isArray(body?.patches) ? body.patches : []
      const applied = patches.length ? onApply(patches) : 0
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text:
            (body?.summary || "Done.") +
            (applied
              ? `\n\nApplied ${applied} change${applied === 1 ? "" : "s"} to the page — press Cmd/Ctrl+Z to undo.`
              : "\n\nNo changes were applied."),
        },
      ])
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "ai", error: true, text: e?.message || "Something went wrong. The page was not changed." },
      ])
    } finally {
      setBusy(false)
      scroll()
    }
  }

  const disabled = busy || !input.trim()

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 19, 25, 0.35)", display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: "94vw", height: "100%", fontFamily: font, background: grey[0], boxShadow: shadow.lg, display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "12px 16px", borderBottom: hairlineDark, display: "flex", alignItems: "center", justifyContent: "space-between", background: ink.base }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: accent.base, display: "inline-flex" }}>
              <UiIcon name="sparkles" size={16} />
            </span>
            <span style={{ ...type.title, fontFamily: font, color: ink.text }}>AI editor</span>
            <span style={{ ...type.micro, fontFamily: font, color: accent.base, border: `1px solid ${accent.base}`, borderRadius: radius.sm, padding: "2px 6px" }}>
              Beta
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ ...iconButton("sm", true), border: 0, background: "none", color: ink.muted }}>
            <UiIcon name="x" size={16} />
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                ...type.body,
                fontFamily: font,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                whiteSpace: "pre-line",
                padding: "8px 12px",
                borderRadius: radius.lg,
                border: m.error ? `1px solid ${semantic.dangerBorder}` : hairline,
                borderColor: m.role === "user" ? ink.base : undefined,
                background: m.role === "user" ? ink.base : m.error ? semantic.dangerBg : grey[5],
                color: m.role === "user" ? ink.text : m.error ? semantic.dangerFg : grey[90],
              }}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div style={{ ...type.body, fontFamily: font, alignSelf: "flex-start", color: grey[40], padding: "6px 2px" }}>
              Editing your page…
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: hairline, display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Describe the change… (Enter to send)"
            rows={2}
            style={{ ...field(), flex: 1, height: "auto", padding: "8px 10px", resize: "none" }}
          />
          <button
            onClick={send}
            disabled={disabled}
            style={{
              ...button("accent"),
              alignSelf: "flex-end",
              ...(disabled ? { background: grey[20], color: grey[40], cursor: "default" } : {}),
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
