"use client"

/**
 * NewPageModal — the editor's own "Add a new page" dialog, replacing the
 * browser-level window.prompt() (U2 dock polish). Slugifies as you type,
 * previews the final URL, refuses duplicates, Enter creates / Escape closes.
 */

import React, { useEffect, useRef, useState } from "react"
import {
  accent,
  button,
  field,
  font,
  grey,
  radius,
  shadow,
  type,
} from "./design"

const slugify = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

export default function NewPageModal({
  open,
  existing,
  onClose,
  onCreate,
}: {
  open: boolean
  /** Slugs already taken (the pages list + reserved names). */
  existing: string[]
  onClose: () => void
  /** Called with the final, validated slug. */
  onCreate: (slug: string) => void
}) {
  const [raw, setRaw] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setRaw("")
      // Focus after the portal paints.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const slug = slugify(raw)
  const dupe = existing.includes(slug)
  const ok = slug.length > 0 && !dupe

  const create = () => {
    if (ok) onCreate(slug)
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 15, 15, 0.45)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a new page"
        style={{
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          background: "#fff",
          borderRadius: radius.lg,
          boxShadow: shadow.lg,
          padding: 20,
          fontFamily: font,
        }}
      >
        <div style={{ ...type.title, fontFamily: font, color: grey[90], marginBottom: 4 }}>
          Add a new page
        </div>
        <div style={{ ...type.label, fontFamily: font, color: grey[50], marginBottom: 14 }}>
          Pick a short address for the page. You can design it right after.
        </div>
        <input
          ref={inputRef}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              create()
            }
          }}
          placeholder="about, faq, our-story…"
          style={{ ...field(), width: "100%", boxSizing: "border-box" }}
        />
        <div
          style={{
            ...type.label,
            fontFamily: font,
            marginTop: 8,
            minHeight: 18,
            color: dupe ? accent.base : grey[40],
          }}
        >
          {dupe
            ? `“/${slug}” already exists — pick another name.`
            : slug
              ? `Will live at /${slug}`
              : "Lowercase letters, numbers and dashes."}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button type="button" onClick={onClose} style={button("secondary")}>
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={!ok}
            style={{
              ...button("primary"),
              opacity: ok ? 1 : 0.45,
              cursor: ok ? "pointer" : "default",
            }}
          >
            Create page
          </button>
        </div>
      </div>
    </div>
  )
}
