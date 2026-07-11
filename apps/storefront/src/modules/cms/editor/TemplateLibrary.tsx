"use client"

import { useEffect, useState } from "react"

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

  const btn: React.CSSProperties = { fontSize: 12, fontWeight: 500, borderRadius: 6, padding: "5px 11px", cursor: "pointer" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: "92vw", height: "100%", background: "#fff", boxShadow: "-8px 0 28px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #eef0f3", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>Templates</div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>×</button>
        </div>

        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8", marginBottom: 7 }}>Save current page</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none" }} />
            <button onClick={save} disabled={busy || !name.trim()} style={{ ...btn, background: "#2563eb", color: "#fff", border: "none", opacity: busy || !name.trim() ? 0.5 : 1 }}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {err && <div style={{ padding: 14, color: "#b91c1c", fontSize: 13 }}>{err}</div>}
          {list === null && <div style={{ padding: 16, color: "#64748b", fontSize: 13 }}>Loading…</div>}
          {list && list.length === 0 && <div style={{ padding: 18, color: "#64748b", fontSize: 13 }}>No saved templates yet. Save the current page above to start your library.</div>}
          {list && [
            { label: "Library", items: list.filter((t) => t.is_global) },
            { label: "My templates", items: list.filter((t) => !t.is_global) },
          ].filter((g) => g.items.length > 0).map((g) => (
            <div key={g.label}>
              <div style={{ padding: "10px 16px 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8" }}>
                {g.label}
              </div>
              {g.items.map((t) => (
                <div key={t.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.category} · {t.blocks} block{t.blocks === 1 ? "" : "s"}</div>
                  </div>
                  <button onClick={() => { onInsert(t.data?.blocks ?? []); onClose() }} style={{ ...btn, background: "#fff", border: "1px solid #e2e8f0", color: "#0f172a" }}>Insert</button>
                  {!t.is_global && (
                    <button onClick={() => remove(t.id)} title="Delete" style={{ ...btn, background: "none", border: "none", color: "#cbd5e1", padding: "5px 4px" }}>✕</button>
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
