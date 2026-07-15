"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  eyebrow,
  font,
  grey,
  hairline,
  menuItem,
  radius,
  shadow,
  type,
} from "@modules/cms/editor/design"

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
        background: "rgba(15, 19, 25, 0.5)",
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
          fontFamily: font,
          background: grey[0],
          border: hairline,
          borderRadius: radius.lg,
          boxShadow: shadow.lg,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: hairline }}>
          <span style={{ color: grey[40], display: "inline-flex" }}>
            <UiIcon name="search" size={16} />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions and pages…"
            style={{
              ...type.title,
              fontWeight: 400,
              fontFamily: font,
              flex: 1,
              border: "none",
              outline: "none",
              color: grey[90],
              background: "transparent",
            }}
          />
          <kbd style={{ ...type.micro, fontFamily: font, color: grey[50], border: hairline, borderRadius: radius.sm, padding: "2px 6px" }}>Esc</kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: 400, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <div style={{ ...type.body, fontFamily: font, padding: "20px 16px", color: grey[40] }}>No matches.</div>
          )}
          {groups.map((g) => (
            <div key={g.cat}>
              <div style={{ ...eyebrow(), padding: "8px 16px 4px" }}>
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
                    ...menuItem(),
                    height: 34,
                    borderRadius: 0,
                    padding: "0 16px",
                    background: index === active ? accent.tint : "transparent",
                    color: index === active ? grey[90] : grey[80],
                  }}
                >
                  <span>{cmd.label}</span>
                  {cmd.hint && (
                    <span style={{ ...type.label, fontFamily: font, color: grey[50] }}>{cmd.hint}</span>
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
