"use client"

import { useEffect, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  button,
  eyebrow,
  field,
  font,
  grey,
  hairline,
  iconButton,
  motion,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"

type Tpl = { id: string; name: string; category: string; blocks: number; is_global?: boolean; data: { blocks?: unknown[] } }

/**
 * Template library (Phase 7). Save the current page as a reusable template and
 * insert any saved template into the page. Tenant-scoped, server-persisted.
 */
export function TemplateLibrary({
  slug,
  locale,
  editorKey,
  currentBlocks,
  onInsert,
  onClose,
}: {
  slug: string
  locale: string
  editorKey: string
  currentBlocks: unknown[]
  onInsert: (blocks: unknown[]) => void
  onClose: () => void
}) {
  const [list, setList] = useState<Tpl[] | null>(null)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    fetch(`/api/puck/templates?key=${encodeURIComponent(editorKey)}`)
      .then((r) => r.json())
      .then((b) => setList(Array.isArray(b?.templates) ? b.templates : []))
      .catch(() => setErr("Couldn't load templates."))
  }
  useEffect(load, [editorKey])

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`/api/puck/templates?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scope: "page", data: { blocks: currentBlocks } }),
      })
      if (!r.ok) throw new Error()
      setName("")
      load()
    } catch {
      setErr("Save failed.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return
    await fetch(`/api/puck/templates?id=${encodeURIComponent(id)}&key=${encodeURIComponent(editorKey)}`, { method: "DELETE" }).catch(() => {})
    load()
  }

  const note: React.CSSProperties = { ...type.body, fontFamily: font, color: grey[50] }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 19, 25, 0.45)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: "92vw", height: "100%", background: grey[0], boxShadow: shadow.lg, display: "flex", flexDirection: "column", fontFamily: font }}>
        <div style={{ padding: "16px 20px", borderBottom: hairline, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...type.heading, fontFamily: font, color: grey[90] }}>Templates</div>
          <button onClick={onClose} aria-label="Close" style={{ ...iconButton("sm"), border: 0, background: "none", color: grey[50] }}>
            <UiIcon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", borderBottom: hairline, background: grey[5] }}>
          <div style={{ ...eyebrow(), marginBottom: 8 }}>Save current page</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" style={{ ...field(), flex: 1 }} />
            <button onClick={save} disabled={busy || !name.trim()} style={{ ...button("accent", "sm"), opacity: busy || !name.trim() ? 0.5 : 1, cursor: busy || !name.trim() ? "default" : "pointer" }}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {err && <div style={{ ...type.body, fontFamily: font, padding: 16, color: semantic.dangerFg }}>{err}</div>}
          {list === null && <div style={{ ...note, padding: 16 }}>Loading…</div>}
          {list && list.length === 0 && <div style={{ ...note, padding: 20 }}>No saved templates yet. Save the current page above to start your library.</div>}
          {list && [
            { label: "Library", items: list.filter((t) => t.is_global) },
            { label: "My templates", items: list.filter((t) => !t.is_global) },
          ].filter((g) => g.items.length > 0).map((g) => (
            <div key={g.label}>
              <div style={{ ...eyebrow(), padding: "12px 20px 4px" }}>
                {g.label}
              </div>
              {g.items.map((t) => (
                <div key={t.id} style={{ padding: "12px 20px", borderBottom: hairline, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...type.bodyStrong, fontFamily: font, color: grey[90] }}>{t.name}</div>
                    <div style={{ ...type.label, fontFamily: font, color: grey[50] }}>{t.category} · {t.blocks} block{t.blocks === 1 ? "" : "s"}</div>
                  </div>
                  <button onClick={() => { onInsert(t.data?.blocks ?? []); onClose() }} style={button("secondary", "sm")}>Insert</button>
                  {!t.is_global && (
                    <button onClick={() => remove(t.id)} title="Delete" aria-label="Delete template" style={{ ...iconButton("sm"), border: 0, background: "none", color: grey[40], transition: `color ${motion.fast}` }}>
                      <UiIcon name="trash" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
