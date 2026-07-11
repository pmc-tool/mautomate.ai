"use client"

import { useEffect, useState } from "react"

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

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15,23,42,0.45)",
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
          background: "#fff",
          boxShadow: "-8px 0 28px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #eef0f3",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>
            Version history
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "none",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {err && (
            <div style={{ padding: 16, color: "#b91c1c", fontSize: 13 }}>{err}</div>
          )}
          {versions === null && (
            <div style={{ padding: 16, color: "#64748b", fontSize: 13 }}>Loading…</div>
          )}
          {versions && versions.length === 0 && (
            <div style={{ padding: 20, color: "#64748b", fontSize: 13 }}>
              No published versions yet. Once you Publish, each version appears
              here and you can restore any of them.
            </div>
          )}
          {versions &&
            versions.map((v) => (
              <div
                key={v.version}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    background: v.is_live ? "#ecfdf5" : "#eef2ff",
                    color: v.is_live ? "#059669" : "#4f46e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  v{v.version}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#0f172a",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Version {v.version}
                    {v.is_live && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#059669",
                          background: "#ecfdf5",
                          borderRadius: 10,
                          padding: "1px 7px",
                        }}
                      >
                        Live
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {relTime(v.created_at)}
                    {v.published_by ? ` · ${v.published_by}` : ""}
                  </div>
                </div>
                {!v.is_live && (
                  <button
                    onClick={() => restore(v.version)}
                    disabled={busy === v.version}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#0f172a",
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      borderRadius: 6,
                      padding: "5px 11px",
                      cursor: busy === v.version ? "default" : "pointer",
                      opacity: busy === v.version ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
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
