"use client"

import { useEffect, useRef, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  field,
  font,
  grey,
  hairline,
  iconButton,
  menuItem,
  motion,
  semantic,
  surface,
  type,
} from "@modules/cms/editor/design"

/** One-tap copy actions on a single field — the AI affordance next to every text control. */
const ACTIONS: { key: string; label: string }[] = [
  { key: "rewrite", label: "Rewrite" },
  { key: "shorten", label: "Make shorter" },
  { key: "lengthen", label: "Make longer" },
  { key: "premium", label: "Sound premium" },
  { key: "friendly", label: "Sound friendly" },
  { key: "urgent", label: "Add urgency" },
  { key: "grammar", label: "Fix grammar" },
  { key: "bangla", label: "Translate to Bangla" },
  { key: "english", label: "Translate to English" },
]

export function AiFieldButton({
  value,
  label,
  html,
  onResult,
}: {
  value: string
  label: string
  /** True for richText fields — the AI must preserve HTML. */
  html?: boolean
  onResult: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const run = async (action: string, customText?: string) => {
    setBusy(true)
    setErr(null)
    try {
      const key = new URLSearchParams(window.location.search).get("key") ?? ""
      const r = await fetch(`/api/puck/ai-text?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value ?? "",
          label,
          action,
          custom: customText ?? "",
          html: !!html,
        }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok || !b?.text) throw new Error(b?.error || "AI request failed")
      onResult(String(b.text))
      setOpen(false)
      setCustom("")
    } catch (e: any) {
      setErr(e?.message || "Failed")
    } finally {
      setBusy(false)
    }
  }

  const goDisabled = busy || !custom.trim()

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        title="Edit this with AI"
        aria-label="Edit this with AI"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        style={{
          ...iconButton("sm"),
          width: 28,
          borderColor: busy ? grey[20] : accent.base,
          background: busy ? grey[20] : accent.tint,
          color: busy ? grey[40] : accent.base,
          cursor: busy ? "default" : "pointer",
          transition: motion.fast,
        }}
      >
        <UiIcon name="sparkles" size={14} />
      </button>

      {open && (
        <div
          style={{
            ...surface("md"),
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            width: 216,
            fontFamily: font,
            overflow: "hidden",
          }}
        >
          <div style={{ maxHeight: 232, overflowY: "auto", padding: 4 }}>
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => run(a.key)}
                disabled={busy}
                style={{ ...menuItem({ disabled: busy }), justifyContent: "flex-start" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = grey[10])}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div style={{ borderTop: hairline, padding: 8, display: "flex", gap: 6 }}>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  e.preventDefault()
                  run("custom", custom.trim())
                }
              }}
              placeholder="Or tell it what to do…"
              style={{ ...field(), ...type.label, height: 28, flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              disabled={goDisabled}
              onClick={() => run("custom", custom.trim())}
              style={{
                ...button("accent", "sm"),
                ...(goDisabled
                  ? { background: grey[20], color: grey[40], cursor: "default" }
                  : {}),
              }}
            >
              Go
            </button>
          </div>
          {err && (
            <div
              style={{
                ...type.label,
                fontFamily: font,
                color: semantic.dangerFg,
                background: semantic.dangerBg,
                borderTop: `1px solid ${semantic.dangerBorder}`,
                padding: "6px 10px 8px",
              }}
            >
              {err}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
