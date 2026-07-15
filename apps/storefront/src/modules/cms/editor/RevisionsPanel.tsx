"use client"

import { useEffect, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  button,
  font,
  grey,
  hairline,
  iconButton,
  radius,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"

type Version = {
  version: number
  is_live: boolean
  published_by: string | null
  created_at: string
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  return d === 1 ? "yesterday" : `${d} days ago`
}

/**
 * Version history side panel (Phase 2). Lists the page's published snapshot
 * versions (newest first) with a Live badge and Restore. Restore writes the
 * chosen version into the editor's draft; the merchant reviews and re-publishes.
 */
export function RevisionsPanel({
  slug,
  locale,
  editorKey,
  onClose,
  onRestored,
}: {
  slug: string
  locale: string
  editorKey: string
  onClose: () => void
  onRestored: (version: number) => void
}) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(
      `/api/puck/versions?slug=${encodeURIComponent(slug)}&lang=${encodeURIComponent(
        locale
      )}&key=${encodeURIComponent(editorKey)}`
    )
      .then((r) => r.json())
      .then((b) => alive && setVersions(Array.isArray(b?.versions) ? b.versions : []))
      .catch(() => alive && setErr("Couldn't load version history."))
    return () => {
      alive = false
    }
  }, [slug, locale, editorKey])

  const restore = async (v: number) => {
    if (
      !confirm(
        `Restore version ${v}? It replaces your current draft — review it, then Publish to make it live.`
      )
    )
      return
    setBusy(v)
    setErr(null)
    try {
      const r = await fetch(`/api/puck/versions?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, locale, version: v }),
      })
      if (!r.ok) throw new Error()
      onRestored(v)
      onClose()
    } catch {
      setErr("Restore failed. Please try again.")
      setBusy(null)
    }
  }

  const note: React.CSSProperties = { ...type.body, fontFamily: font, color: grey[50] }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15, 19, 25, 0.45)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: "92vw",
          height: "100%",
          fontFamily: font,
          background: grey[0],
          boxShadow: shadow.lg,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: hairline,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ ...type.heading, fontFamily: font, color: grey[90] }}>
            Version history
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              ...iconButton("sm"),
              border: 0,
              background: "none",
              color: grey[50],
            }}
          >
            <UiIcon name="x" size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {err && (
            <div style={{ ...type.body, fontFamily: font, padding: 16, color: semantic.dangerFg }}>{err}</div>
          )}
          {versions === null && (
            <div style={{ ...note, padding: 16 }}>Loading…</div>
          )}
          {versions && versions.length === 0 && (
            <div style={{ ...note, padding: 20 }}>
              No published versions yet. Once you Publish, each version appears
              here and you can restore any of them.
            </div>
          )}
          {versions &&
            versions.map((v) => (
              <div
                key={v.version}
                style={{
                  padding: "12px 20px",
                  borderBottom: hairline,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    ...type.label,
                    fontFamily: font,
                    fontWeight: 600,
                    width: 32,
                    height: 32,
                    borderRadius: radius.pill,
                    background: v.is_live ? semantic.successBg : grey[10],
                    color: v.is_live ? semantic.successFg : grey[60],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  v{v.version}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      ...type.bodyStrong,
                      fontFamily: font,
                      color: grey[90],
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Version {v.version}
                    {v.is_live && (
                      <span
                        style={{
                          ...type.micro,
                          fontFamily: font,
                          color: semantic.successFg,
                          background: semantic.successBg,
                          border: `1px solid ${semantic.successBorder}`,
                          borderRadius: radius.pill,
                          padding: "1px 6px",
                        }}
                      >
                        Live
                      </span>
                    )}
                  </div>
                  <div style={{ ...type.label, fontFamily: font, color: grey[50] }}>
                    {relTime(v.created_at)}
                    {v.published_by ? ` · ${v.published_by}` : ""}
                  </div>
                </div>
                {!v.is_live && (
                  <button
                    onClick={() => restore(v.version)}
                    disabled={busy === v.version}
                    style={{
                      ...button("secondary", "sm"),
                      cursor: busy === v.version ? "default" : "pointer",
                      opacity: busy === v.version ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    <UiIcon name="reset" size={14} />
                    {busy === v.version ? "Restoring…" : "Restore"}
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
