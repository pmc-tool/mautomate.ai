"use client"

/* ------------------------------------------------------------------ */
/* Media Library picker (visual editor)                                 */
/*                                                                     */
/* A key-gated modal that lets an image field pick an existing media    */
/* item, upload a new one, or paste a raw URL. Talks to the storefront   */
/* proxy /api/puck/media (which forwards to the secret-gated backend     */
/* bridge). Inline styles match SchemaPanel's aesthetic — no @medusajs.  */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

type MediaItem = {
  id: string
  url: string
  original_filename?: string | null
  mime_type?: string | null
  width?: number | null
  height?: number | null
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17, 24, 39, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100000,
  padding: 20,
}
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  width: "min(720px, 100%)",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  fontFamily: "inherit",
}
const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 16px",
  borderBottom: "1px solid #e5e7eb",
}
const title: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#111827",
}
const closeBtn: React.CSSProperties = {
  marginLeft: "auto",
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 6,
  fontSize: 16,
  lineHeight: 1,
  padding: "4px 9px",
  cursor: "pointer",
  color: "#374151",
}
const body: React.CSSProperties = {
  padding: 16,
  overflowY: "auto",
}
const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 14,
  flexWrap: "wrap",
}
const input: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  fontSize: 13,
  fontFamily: "inherit",
  color: "#111827",
  background: "#fff",
  outline: "none",
}
const primaryBtn: React.CSSProperties = {
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 12px",
  cursor: "pointer",
}
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 10,
}
const tile: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 9,
  overflow: "hidden",
  cursor: "pointer",
  background: "#fafafa",
  padding: 0,
}
const thumb: React.CSSProperties = {
  width: "100%",
  height: 96,
  objectFit: "cover",
  display: "block",
  background: "#f3f4f6",
}
const tileName: React.CSSProperties = {
  fontSize: 10,
  color: "#6b7280",
  padding: "5px 6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}

export default function MediaPicker({
  value,
  onChange,
  onClose,
}: {
  value?: string
  onChange: (url: string) => void
  onClose: () => void
}) {
  const searchParams = useSearchParams()
  const editorKey = searchParams.get("key") ?? ""

  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [urlValue, setUrlValue] = useState(value ?? "")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(
        `/api/puck/media?key=${encodeURIComponent(editorKey)}`,
        { cache: "no-store" }
      )
      if (!r.ok) {
        throw new Error(`Failed to load media (${r.status})`)
      }
      const data = await r.json()
      setItems(Array.isArray(data?.media) ? data.media : [])
    } catch (e: any) {
      setError(e?.message || "Failed to load media")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [editorKey])

  useEffect(() => {
    load()
  }, [load])

  const pick = (url: string) => {
    onChange(url)
    onClose()
  }

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // keep in sync with the backend

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return
    // Reject oversized files up-front with a clear message instead of letting
    // the server return a raw "request entity too large".
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That image is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please choose one under 10MB (or resize it first).`
      )
      return
    }
    setUploading(true)
    setError(null)
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result)
          const comma = result.indexOf(",")
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const r = await fetch(
        `/api/puck/media?key=${encodeURIComponent(editorKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            contentBase64,
          }),
        }
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        throw new Error(data?.message || data?.error || `Upload failed (${r.status})`)
      }
      const uploaded = data?.media as MediaItem | undefined
      if (uploaded?.url) {
        setItems((prev) => [uploaded, ...prev])
        pick(uploaded.url)
        return
      }
      await load()
    } catch (err: any) {
      setError(err?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={headerRow}>
          <span style={title}>Choose image</span>
          <button style={closeBtn} onClick={onClose} title="Close" type="button">
            ×
          </button>
        </div>

        <div style={body}>
          <div style={toolbar}>
            <label style={{ ...primaryBtn, display: "inline-block" }}>
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                onChange={onUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
            <input
              style={{ ...input, flex: 1, minWidth: 180 }}
              value={urlValue}
              placeholder="…or paste an image URL"
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlValue.trim()) pick(urlValue.trim())
              }}
            />
            <button
              style={primaryBtn}
              type="button"
              disabled={!urlValue.trim()}
              onClick={() => urlValue.trim() && pick(urlValue.trim())}
            >
              Use URL
            </button>
          </div>

          {error ? (
            <div
              style={{
                fontSize: 12,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 7,
                padding: "8px 10px",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div style={{ fontSize: 13, color: "#6b7280", padding: "24px 0", textAlign: "center" }}>
              Loading media…
            </div>
          ) : items.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9ca3af", padding: "24px 0", textAlign: "center" }}>
              No images yet. Upload one or paste a URL above.
            </div>
          ) : (
            <div style={grid}>
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  style={{
                    ...tile,
                    outline: value && value === m.url ? "2px solid #2563eb" : "none",
                  }}
                  onClick={() => pick(m.url)}
                  title={m.original_filename ?? m.url}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" style={thumb} />
                  <div style={tileName}>{m.original_filename ?? m.url}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
