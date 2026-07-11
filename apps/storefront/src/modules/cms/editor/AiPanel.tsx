"use client"

import { useMemo, useRef, useState } from "react"
import { listBlockSchemas } from "@modules/cms/schema"

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

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.35)", display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: "94vw", height: "100%", background: "#fff", boxShadow: "-8px 0 28px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#26292c" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#f0abfc", display: "inline-block" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>AI editor</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: "#f0abfc", border: "1px solid rgba(240,171,252,0.4)", borderRadius: 4, padding: "2px 6px" }}>
              BETA
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                whiteSpace: "pre-line",
                fontSize: 13,
                lineHeight: 1.5,
                padding: "9px 12px",
                borderRadius: 10,
                background: m.role === "user" ? "#26292c" : m.error ? "#fef2f2" : "#f4f4f5",
                color: m.role === "user" ? "#fff" : m.error ? "#b91c1c" : "#18181b",
              }}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#9ca3af", padding: "6px 2px" }}>
              Editing your page…
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #eef0f3", display: "flex", gap: 8 }}>
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
            style={{ flex: 1, resize: "none", border: "1px solid #e4e4e7", borderRadius: 8, padding: "9px 11px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            style={{
              alignSelf: "flex-end",
              border: 0,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              background: busy || !input.trim() ? "#e4e4e7" : "#d004d4",
              color: busy || !input.trim() ? "#a1a1aa" : "#fff",
              cursor: busy || !input.trim() ? "default" : "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
