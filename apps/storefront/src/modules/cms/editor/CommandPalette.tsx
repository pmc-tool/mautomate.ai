"use client"

import { useEffect, useMemo, useRef, useState } from "react"

export type Command = {
  id: string
  label: string
  category: string
  hint?: string
  keywords?: string
  run: () => void
}

/**
 * Command palette / Finder (Phase 3) — Elementor-style Cmd/K launcher. Fuzzy
 * search over every editor action + every page, grouped by category, full
 * keyboard control (↑ ↓ Enter Esc). Self-contained; the editor supplies the
 * command list and opens/closes it.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean
  onClose: () => void
  commands: Command[]
}) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ("")
      setActive(0)
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [open])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return commands
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ""} ${c.category}`.toLowerCase().includes(term)
    )
  }, [q, commands])

  useEffect(() => setActive(0), [q])

  // Group preserving first-seen category order.
  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, { cmd: Command; index: number }[]>()
    filtered.forEach((cmd, index) => {
      if (!map.has(cmd.category)) {
        map.set(cmd.category, [])
        order.push(cmd.category)
      }
      map.get(cmd.category)!.push({ cmd, index })
    })
    return order.map((cat) => ({ cat, items: map.get(cat)! }))
  }, [filtered])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const c = filtered[active]
      if (c) {
        onClose()
        c.run()
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10001,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        style={{
          width: 560,
          maxWidth: "92vw",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #eef0f3" }}>
          <span style={{ color: "#94a3b8", fontSize: 16 }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions and pages…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "#0f172a",
              background: "transparent",
            }}
          />
          <kbd style={{ fontSize: 11, color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: 4, padding: "1px 6px" }}>Esc</kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: 400, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "18px 16px", color: "#94a3b8", fontSize: 13 }}>No matches.</div>
          )}
          {groups.map((g) => (
            <div key={g.cat}>
              <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#94a3b8" }}>
                {g.cat}
              </div>
              {g.items.map(({ cmd, index }) => (
                <div
                  key={cmd.id}
                  data-cmd-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    onClose()
                    cmd.run()
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "9px 16px",
                    cursor: "pointer",
                    background: index === active ? "#eef2ff" : "transparent",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#0f172a" }}>{cmd.label}</span>
                  {cmd.hint && (
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{cmd.hint}</span>
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
