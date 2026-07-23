"use client"

/* ------------------------------------------------------------------ */
/* Media Library picker (visual editor)                                 */
/*                                                                     */
/* A key-gated FULL-SCREEN BOTTOM SHEET that lets an image field pick an */
/* existing media item, upload a new one, paste a raw URL, or generate    */
/* one with AI. Talks to the storefront proxy /api/puck/media (which       */
/* forwards to the secret-gated backend bridge). Inline styles come from   */
/* the editor design system.                                              */
/*                                                                     */
/* Layout: the panel is anchored to the bottom of the viewport, spans the  */
/* full width and slides up. On the Library tab it splits into a fixed     */
/* left "add image" rail and a right grid that fills the rest; on the       */
/* Generate tab the AI studio simply gets the extra room. Below ~820px the */
/* columns stack and scroll. Animation is CSS-only and honours             */
/* prefers-reduced-motion.                                                 */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useState } from "react"
import { useCatalog } from "@modules/cms/editor/CatalogContext"
import AiImageStudio from "@modules/cms/editor/AiImageStudio"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import { useSearchParams } from "next/navigation"
import {
  accent,
  button,
  ease,
  eyebrow,
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

/* Full-viewport dim scrim; the sheet is docked to the bottom edge and
   spans the full width, so the scrim only centres horizontally (irrelevant
   at 100% width) and pins to flex-end vertically. */
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 19, 25, 0.55)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 100000,
  padding: 0,
}
/* The sheet itself — full width, tall, only the TOP corners rounded. */
const sheet: React.CSSProperties = {
  background: grey[0],
  borderTop: hairline,
  borderTopLeftRadius: radius.lg,
  borderTopRightRadius: radius.lg,
  width: "100%",
  height: "92vh",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: shadow.lg,
  fontFamily: font,
}
const grabWrap: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  justifyContent: "center",
  paddingTop: 8,
  paddingBottom: 2,
}
const grabBar: React.CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: radius.pill,
  background: grey[30],
}
const headerRow: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px 12px",
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
const tabBar: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  borderBottom: hairline,
  padding: "0 16px",
}
/* The region below the tab bar that the active tab fills. */
const contentRegion: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  overflow: "hidden",
}
/* Generate tab wrapper: column so the AI studio stretches to full width;
   scrolls if its intrinsic height exceeds the sheet. */
const aiWrap: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}
/* Library tab: the two-column shell. Direction / per-column scroll /
   the narrow-viewport stacking all live in the stylesheet class so a
   media query can flip them. */
const colsBase: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}
const railInner: React.CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
}
const mainInner: React.CSSProperties = {
  padding: 16,
}
const toolbarBtn: React.CSSProperties = { width: "100%" }
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
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
  height: 110,
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

/* Bottom-sheet chrome: slide-up + scrim fade, the responsive column split,
   and the reduced-motion opt-out. Scoped by ffmedia-* class names. */
const sheetCss = `
@keyframes ffmedia-scrim-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes ffmedia-sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
.ffmedia-scrim { animation: ffmedia-scrim-in 160ms ${ease} both }
.ffmedia-sheet { animation: ffmedia-sheet-up 240ms ${ease} both }
.ffmedia-cols { flex-direction: row }
.ffmedia-rail { width: 380px; max-width: 380px; flex: 0 0 auto; border-right: ${hairline}; overflow-y: auto }
.ffmedia-main { flex: 1 1 auto; min-width: 0; overflow-y: auto }
@media (max-width: 820px) {
  .ffmedia-cols { flex-direction: column; overflow-y: auto }
  .ffmedia-rail { width: auto; max-width: none; border-right: none; border-bottom: ${hairline}; overflow-y: visible }
  .ffmedia-main { overflow-y: visible }
}
@media (prefers-reduced-motion: reduce) {
  .ffmedia-scrim, .ffmedia-sheet { animation: none !important }
}
`

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
    <div className="ffmedia-scrim" style={overlay} onClick={onClose}>
      <style>{sheetCss}</style>
      <div
        className="ffmedia-sheet"
        style={sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose image"
      >
        {/* Grab-handle affordance — the bottom-sheet cue. */}
        <div style={grabWrap}>
          <div style={grabBar} />
        </div>

        <div style={headerRow}>
          <span style={titleStyle}>Choose image</span>
          <button style={closeBtn} onClick={onClose} title="Close" aria-label="Close" type="button">
            <UiIcon name="x" size={14} />
          </button>
        </div>

        <div style={tabBar}>
          <button type="button" style={tabBtn(tab === "library")} onClick={() => setTab("library")}>
            Library
          </button>
          <button type="button" style={tabBtn(tab === "generate")} onClick={() => setTab("generate")}>
            Generate with AI
          </button>
        </div>

        <div style={contentRegion}>
          {tab === "generate" && (
            <div style={aiWrap}>
              <AiImageStudio
                slot={slot}
                editorKey={editorKey}
                products={products as any}
                onUse={(u) => pick(u)}
                currentImage={value}
              />
            </div>
          )}

          {/* Library stays mounted (display toggled) so its list + scroll
              survive a hop to the Generate tab and back. */}
          <div
            className="ffmedia-cols"
            style={{ ...colsBase, display: tab === "library" ? "flex" : "none" }}
          >
            {/* Left rail: add-an-image controls. */}
            <div className="ffmedia-rail">
              <div style={railInner}>
                <div style={{ ...eyebrow(), marginBottom: 10 }}>Add an image</div>
                <label style={{ ...button("accent"), ...toolbarBtn }}>
                  <UiIcon name="plus" size={14} />
                  {uploading ? "Uploading…" : "Upload from device"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onUpload}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                </label>

                <div style={{ ...eyebrow(), margin: "18px 0 8px" }}>Or paste a URL</div>
                <input
                  style={{ ...field() }}
                  value={urlValue}
                  placeholder="https://…"
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && urlValue.trim()) pick(urlValue.trim())
                  }}
                />
                <button
                  style={{ ...button("primary"), ...toolbarBtn, marginTop: 8, opacity: urlValue.trim() ? 1 : 0.5 }}
                  type="button"
                  disabled={!urlValue.trim()}
                  onClick={() => urlValue.trim() && pick(urlValue.trim())}
                >
                  Use URL
                </button>

                <div style={{ ...type.label, fontFamily: font, color: grey[40], marginTop: 18 }}>
                  Recommended for this slot: {info.label} · {info.size}
                </div>
              </div>
            </div>

            {/* Right area: the media grid (and its states). */}
            <div className="ffmedia-main">
              <div style={mainInner}>
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
                    No images yet. Upload one or paste a URL on the left.
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
        </div>
      </div>
    </div>
  )
}
