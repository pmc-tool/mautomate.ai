"use client"

/* ------------------------------------------------------------------ */
/* Media Library picker (visual editor)                                 */
/*                                                                     */
/* A key-gated modal that lets an image field pick an existing media    */
/* item, upload a new one, or paste a raw URL. Talks to the storefront   */
/* proxy /api/puck/media (which forwards to the secret-gated backend     */
/* bridge). Inline styles come from the editor design system.            */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useState } from "react"
import { useCatalog } from "@modules/cms/editor/CatalogContext"
import AiImageStudio from "@modules/cms/editor/AiImageStudio"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import { useSearchParams } from "next/navigation"
import {
  accent,
  button,
  field,
  font,
  grey,
  hairline,
  iconButton,
  motion,
  radius,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"

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
  background: "rgba(15, 19, 25, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100000,
  padding: 20,
}
const modal: React.CSSProperties = {
  background: grey[0],
  border: hairline,
  borderRadius: radius.lg,
  width: "min(720px, 100%)",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: shadow.lg,
  fontFamily: font,
}
const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "16px 20px",
  borderBottom: hairline,
}
const titleStyle: React.CSSProperties = {
  ...type.heading,
  fontFamily: font,
  color: grey[90],
}
const closeBtn: React.CSSProperties = {
  ...iconButton("sm"),
  marginLeft: "auto",
  color: grey[50],
}
const body: React.CSSProperties = {
  padding: 20,
  overflowY: "auto",
}
const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 16,
  flexWrap: "wrap",
}
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
  gap: 12,
}
const tile: React.CSSProperties = {
  border: hairline,
  borderRadius: radius.md,
  overflow: "hidden",
  cursor: "pointer",
  background: grey[0],
  boxShadow: shadow.xs,
  padding: 0,
  transition: `border-color ${motion.fast}`,
}
const thumb: React.CSSProperties = {
  width: "100%",
  height: 96,
  objectFit: "cover",
  display: "block",
  background: grey[10],
}
const tileName: React.CSSProperties = {
  ...type.label,
  fontFamily: font,
  color: grey[50],
  padding: "6px 8px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  textAlign: "left",
}

/** Human labels + what the AI is told to make, per slot. */
const SLOT_INFO: Record<string, { label: string; size: string; note: string }> = {
  logo: { label: "Logo", size: "1024x1024", note: "Transparent PNG — sits on any background." },
  hero: { label: "Hero image", size: "1344x768", note: "Wide, with space for your headline." },
  banner: { label: "Banner", size: "1536x640", note: "Ultra-wide strip with room for text." },
  product: { label: "Product photo", size: "1024x1024", note: "Studio lighting on a clean white background." },
  lifestyle: { label: "Lifestyle photo", size: "1216x832", note: "Natural, in-context brand photography." },
  background: { label: "Background", size: "1536x640", note: "Soft and low-contrast, for text on top." },
  square: { label: "Image", size: "1024x1024", note: "Square — good for tiles and galleries." },
  portrait: { label: "Portrait", size: "832x1216", note: "Tall format." },
}

export default function MediaPicker({
  value,
  onChange,
  onClose,
  slot = "square",
  initialTab = "library",
}: {
  value?: string
  onChange: (url: string) => void
  onClose: () => void
  /** Where this image will be used — drives size, framing and transparency. */
  slot?: string
  /** Open straight on the AI tab (from the field's AI button). */
  initialTab?: "library" | "generate"
}) {
  const info = SLOT_INFO[slot] ?? SLOT_INFO.square
  const [tab, setTab] = useState<"library" | "generate">(initialTab)
  const { products } = useCatalog()
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

  const tabBtn = (on: boolean): React.CSSProperties => ({
    ...type.label,
    fontFamily: font,
    flex: 1,
    border: 0,
    borderBottom: `2px solid ${on ? accent.base : "transparent"}`,
    background: "transparent",
    color: on ? accent.base : grey[50],
    fontWeight: on ? 600 : 500,
    padding: "10px 6px",
    cursor: "pointer",
    transition: `color ${motion.fast}, border-color ${motion.fast}`,
  })

  return (
    <div style={overlay} onClick={onClose}>
      <div
        style={{
          ...modal,
          ...(tab === "generate" ? { width: "min(980px, 95vw)", maxWidth: "min(980px, 95vw)" } : null),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={headerRow}>
          <span style={titleStyle}>Choose image</span>
          <button style={closeBtn} onClick={onClose} title="Close" aria-label="Close" type="button">
            <UiIcon name="x" size={14} />
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: hairline, padding: "0 16px" }}>
          <button type="button" style={tabBtn(tab === "library")} onClick={() => setTab("library")}>
            Library
          </button>
          <button type="button" style={tabBtn(tab === "generate")} onClick={() => setTab("generate")}>
            Generate with AI
          </button>
        </div>

        {tab === "generate" && (
          <AiImageStudio
            slot={slot}
            editorKey={editorKey}
            products={products as any}
            onUse={(u) => pick(u)}
            currentImage={value}
          />
        )}

        <div style={{ ...body, display: tab === "library" ? undefined : "none" }}>
          <div style={toolbar}>
            <label style={button("accent")}>
              <UiIcon name="plus" size={14} />
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
              style={{ ...field(), flex: 1, minWidth: 180, width: "auto" }}
              value={urlValue}
              placeholder="…or paste an image URL"
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && urlValue.trim()) pick(urlValue.trim())
              }}
            />
            <button
              style={{ ...button("primary"), opacity: urlValue.trim() ? 1 : 0.5 }}
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
                ...type.label,
                fontFamily: font,
                color: semantic.dangerFg,
                background: semantic.dangerBg,
                border: `1px solid ${semantic.dangerBorder}`,
                borderRadius: radius.md,
                padding: "8px 10px",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div style={{ ...type.body, fontFamily: font, color: grey[50], padding: "24px 0", textAlign: "center" }}>
              Loading media…
            </div>
          ) : items.length === 0 ? (
            <div style={{ ...type.body, fontFamily: font, color: grey[40], padding: "24px 0", textAlign: "center" }}>
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
                    outline: value && value === m.url ? `2px solid ${accent.base}` : "none",
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
