"use client"

/* ------------------------------------------------------------------ */
/* Video field control (visual editor)                                  */
/*                                                                     */
/* Parity with the image studio: the primary action is generating a     */
/* clip with AI from a PRODUCT photo or a library image; pasting a       */
/* YouTube/Vimeo/mp4 link is the small secondary option. Talks to        */
/* /api/puck/ai-video (SVD image-to-video / prompt-to-video).            */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useCatalog } from "@modules/cms/editor/CatalogContext"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  field,
  font,
  grey,
  hairline,
  radius,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"

const isMp4 = (u: string) => /\.mp4(\?|#|$)/i.test(u) || /\/ai-video-/.test(u)

/* ------------------------------ field ------------------------------ */

export default function VideoField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [studio, setStudio] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const v = value ?? ""
  const hasVideo = v.length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {isMp4(v) ? (
        <video
          src={v}
          muted
          loop
          playsInline
          controls
          style={{
            width: "100%",
            borderRadius: radius.md,
            border: hairline,
            background: grey[90],
            maxHeight: 170,
            objectFit: "cover",
          }}
        />
      ) : hasVideo ? (
        <div style={{ ...type.label, color: grey[60], wordBreak: "break-all" }}>{v}</div>
      ) : null}

      {/* PRIMARY action: generate with AI */}
      <button
        type="button"
        style={{ ...button("accent"), justifyContent: "center", padding: "11px 14px" }}
        onClick={() => setStudio(true)}
      >
        <UiIcon name="sparkles" size={15} />
        {hasVideo ? "Replace with an AI video" : "Create a video with AI"}
      </button>

      {/* SECONDARY: paste a link (hidden behind a quiet toggle so the field is
          not link-first) */}
      {showLink || (hasVideo && !isMp4(v)) ? (
        <input
          style={field()}
          value={v}
          placeholder="YouTube / Vimeo / .mp4 link"
          onChange={(e) => onChange(e.target.value)}
          autoFocus={showLink}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowLink(true)}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: grey[50],
            ...type.label,
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          or paste a YouTube / Vimeo / .mp4 link
        </button>
      )}

      {studio && (
        <AiVideoStudio
          onClose={() => setStudio(false)}
          onUse={(u) => {
            onChange(u)
            setStudio(false)
          }}
        />
      )}
    </div>
  )
}

/* --------------------------- AI studio --------------------------- */

type Orientation = "landscape" | "portrait" | "square"
type Mode = "animate" | "prompt"
type Source = "products" | "library" | "upload" | "url"

const ORIENTATIONS: { k: Orientation; label: string }[] = [
  { k: "landscape", label: "Landscape" },
  { k: "portrait", label: "Portrait" },
  { k: "square", label: "Square" },
]

const MOTIONS: { k: number; label: string; hint: string }[] = [
  { k: 50, label: "Subtle", hint: "gentle drift" },
  { k: 90, label: "Balanced", hint: "natural motion" },
  { k: 160, label: "Dynamic", hint: "lots of movement" },
]

const EXAMPLES = [
  "a steaming cup of coffee on a cafe table, morning light",
  "waves rolling onto a quiet beach at golden hour",
  "a luxury watch rotating slowly on a marble surface",
  "silk fabric drifting gently in the wind",
]

const STAGES = [
  "Warming up the studio…",
  "Composing the first frame…",
  "Bringing it to life…",
  "Rendering the motion…",
  "Almost there…",
]

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 19, 25, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100000,
  padding: 20,
  fontFamily: font,
}

function AiVideoStudio({
  onClose,
  onUse,
}: {
  onClose: () => void
  onUse: (url: string) => void
}) {
  const sp = useSearchParams()
  const editorKey = sp?.get("key") ?? ""
  const { products } = useCatalog()
  const productImgs = (products ?? []).filter((p: any) => p.thumbnail)

  const [mode, setMode] = useState<Mode>("animate")
  const [source, setSource] = useState<Source>(productImgs.length ? "products" : "library")
  const [orientation, setOrientation] = useState<Orientation>("landscape")
  const [motion, setMotion] = useState<number>(90)
  const [prompt, setPrompt] = useState("")
  const [selected, setSelected] = useState<string>("")
  const [urlInput, setUrlInput] = useState("")
  const [library, setLibrary] = useState<{ url: string }[] | null>(null)
  const [uploading, setUploading] = useState(false)

  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Lazy-load the tenant's image library the first time it's opened.
  useEffect(() => {
    if (mode !== "animate" || source !== "library" || library !== null) return
    fetch(`/api/puck/media?key=${encodeURIComponent(editorKey)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((d) => {
        const imgs = (Array.isArray(d?.media) ? d.media : [])
          .filter((m: any) => !m.mime_type || String(m.mime_type).startsWith("image/"))
          .map((m: any) => ({ url: m.url }))
        setLibrary(imgs)
      })
      .catch(() => setLibrary([]))
  }, [mode, source, library, editorKey])

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current)
    }
  }, [])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const r = String(reader.result)
          const c = r.indexOf(",")
          resolve(c >= 0 ? r.slice(c + 1) : r)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const r = await fetch(`/api/puck/media?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, contentBase64 }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.media?.url) throw new Error(d?.message || d?.error || "Upload failed")
      setSelected(d.media.url)
      setLibrary(null) // refresh library next open
    } catch (e2: any) {
      setErr(e2?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const chosenImage = source === "url" ? urlInput.trim() : selected
  const canGo =
    !busy && (mode === "prompt" ? prompt.trim().length >= 3 : chosenImage.length > 0)

  async function generate() {
    setErr(null)
    setResult(null)
    setBusy(true)
    setStage(0)
    stageTimer.current = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 6000)
    try {
      const body =
        mode === "prompt"
          ? { mode, prompt: prompt.trim(), orientation, motion }
          : { mode: "animate", image: chosenImage, orientation, motion }
      const r = await fetch(`/api/puck/ai-video?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || "Video generation failed.")
      if (!d?.url) throw new Error("No clip was returned.")
      setResult(d.url)
    } catch (e: any) {
      setErr(e?.message || "Something went wrong. Try again.")
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current)
      setBusy(false)
    }
  }

  const ratio = orientation === "portrait" ? 9 / 16 : orientation === "square" ? 1 : 16 / 9

  const SRC_TABS: { k: Source; label: string }[] = [
    { k: "products", label: "Products" },
    { k: "library", label: "My images" },
    { k: "upload", label: "Upload" },
    { k: "url", label: "Paste URL" },
  ]

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
    gap: 8,
    maxHeight: 210,
    overflowY: "auto",
    paddingRight: 2,
  }
  const tile = (on: boolean): React.CSSProperties => ({
    padding: 0,
    border: `2px solid ${on ? accent.base : grey[20]}`,
    borderRadius: radius.md,
    overflow: "hidden",
    cursor: "pointer",
    aspectRatio: "1",
    background: grey[10],
  })
  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: grey[0],
          border: hairline,
          borderRadius: radius.lg,
          width: "min(680px, 100%)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: shadow.lg,
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: hairline,
          }}
        >
          <span style={{ ...type.title }}>Create a video with AI</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: grey[50], display: "flex" }}
          >
            <UiIcon name="x" size={16} />
          </button>
        </div>

        {/* mode tabs */}
        <div style={{ display: "flex", borderBottom: hairline, padding: "0 16px" }}>
          {([
            { k: "animate", label: "Animate a photo" },
            { k: "prompt", label: "Describe a video" },
          ] as { k: Mode; label: string }[]).map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => {
                setMode(m.k)
                setResult(null)
                setErr(null)
              }}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${mode === m.k ? accent.base : "transparent"}`,
                color: mode === m.k ? grey[90] : grey[50],
                padding: "12px 14px 10px",
                cursor: "pointer",
                ...type.bodyStrong,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* body */}
        <div style={{ padding: 16, overflowY: "auto" }}>
          {result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <video
                src={result}
                autoPlay
                muted
                loop
                playsInline
                controls
                style={{
                  width: "100%",
                  borderRadius: radius.md,
                  border: hairline,
                  background: grey[90],
                  aspectRatio: String(ratio),
                  objectFit: "cover",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={{ ...button("accent"), flex: 1, justifyContent: "center" }}
                  onClick={() => onUse(result)}
                >
                  <UiIcon name="check" size={14} />
                  Use this video
                </button>
                <button
                  type="button"
                  style={{ ...button("secondary") }}
                  onClick={() => {
                    setResult(null)
                    generate()
                  }}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : busy ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "36px 0" }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: String(ratio),
                  maxHeight: 240,
                  borderRadius: radius.md,
                  background: `linear-gradient(90deg, ${grey[10]} 25%, ${grey[5]} 37%, ${grey[10]} 63%)`,
                  backgroundSize: "800px 100%",
                  animation: "aivShimmer 1.4s ease infinite",
                }}
              />
              <div style={{ ...type.body, color: grey[60] }}>{STAGES[stage]}</div>
              <div style={{ ...type.label, color: grey[40] }}>A clip takes about a minute — hang tight.</div>
              <style>{`@keyframes aivShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {mode === "animate" ? (
                <>
                  <div style={{ ...type.body, color: grey[70] }}>
                    Pick a product photo or image and we&apos;ll bring it to life with
                    lifelike motion — about a 4-second clip. No typing needed; just
                    choose how much it moves below.
                  </div>

                  {/* source sub-tabs */}
                  <div style={{ display: "flex", gap: 4, background: grey[5], padding: 4, borderRadius: radius.md }}>
                    {SRC_TABS.map((s) => {
                      const on = source === s.k
                      return (
                        <button
                          key={s.k}
                          type="button"
                          onClick={() => {
                            setSource(s.k)
                            if (s.k !== "url") setUrlInput("")
                          }}
                          style={{
                            flex: 1,
                            appearance: "none",
                            border: "none",
                            borderRadius: radius.sm,
                            background: on ? grey[0] : "transparent",
                            boxShadow: on ? shadow.sm : "none",
                            color: on ? grey[90] : grey[50],
                            padding: "7px 4px",
                            cursor: "pointer",
                            ...type.label,
                          }}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* selected preview */}
                  {chosenImage && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={chosenImage}
                        alt=""
                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: radius.md, border: hairline }}
                      />
                      <span style={{ ...type.label, color: semantic.successFg }}>
                        Selected — ready to animate.
                      </span>
                    </div>
                  )}

                  {source === "products" &&
                    (productImgs.length === 0 ? (
                      <div style={{ ...type.body, color: grey[40] }}>
                        No product photos yet. Add a product with an image, or use
                        &quot;My images&quot; / &quot;Upload&quot;.
                      </div>
                    ) : (
                      <div style={grid}>
                        {productImgs.map((p: any) => {
                          const on = selected === p.thumbnail
                          return (
                            <button key={p.id} type="button" onClick={() => { setSelected(on ? "" : p.thumbnail) }} style={tile(on)} title={p.label}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.thumbnail} alt={p.label} style={imgStyle} />
                            </button>
                          )
                        })}
                      </div>
                    ))}

                  {source === "library" &&
                    (library === null ? (
                      <div style={{ ...type.body, color: grey[40] }}>Loading your images…</div>
                    ) : library.length === 0 ? (
                      <div style={{ ...type.body, color: grey[40] }}>
                        No images in your library yet. Try &quot;Products&quot; or
                        &quot;Upload&quot;.
                      </div>
                    ) : (
                      <div style={grid}>
                        {library.map((m) => {
                          const on = selected === m.url
                          return (
                            <button key={m.url} type="button" onClick={() => setSelected(on ? "" : m.url)} style={tile(on)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.url} alt="" style={imgStyle} />
                            </button>
                          )
                        })}
                      </div>
                    ))}

                  {source === "upload" && (
                    <label style={{ ...button("secondary"), justifyContent: "center", cursor: "pointer" }}>
                      <UiIcon name="plus" size={14} />
                      {uploading ? "Uploading…" : "Choose an image to upload"}
                      <input type="file" accept="image/*" onChange={onUpload} disabled={uploading} style={{ display: "none" }} />
                    </label>
                  )}

                  {source === "url" && (
                    <input
                      style={field()}
                      value={urlInput}
                      placeholder="Paste an image URL to animate"
                      onChange={(e) => setUrlInput(e.target.value)}
                    />
                  )}
                </>
              ) : (
                <>
                  <div style={{ ...type.body, color: grey[70] }}>
                    Describe the video you want and AI will create it from scratch.
                  </div>
                  <textarea
                    style={{ ...field(), minHeight: 78, resize: "vertical", lineHeight: 1.5 }}
                    value={prompt}
                    placeholder="e.g. a scented candle glowing on a cozy wooden table…"
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setPrompt(ex)}
                        style={{
                          ...type.label,
                          border: hairline,
                          background: grey[5],
                          color: grey[60],
                          borderRadius: radius.pill,
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                      >
                        {ex.length > 34 ? ex.slice(0, 34) + "…" : ex}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* shape */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ ...type.micro, color: grey[50] }}>Shape</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {ORIENTATIONS.map((o) => {
                    const on = orientation === o.k
                    return (
                      <button
                        key={o.k}
                        type="button"
                        onClick={() => setOrientation(o.k)}
                        style={{
                          flex: 1,
                          border: `1px solid ${on ? accent.base : grey[20]}`,
                          background: on ? accent.tint : grey[0],
                          color: on ? accent.active : grey[60],
                          borderRadius: radius.md,
                          padding: "8px 6px",
                          cursor: "pointer",
                          ...type.label,
                        }}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* motion */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ ...type.micro, color: grey[50] }}>Motion</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {MOTIONS.map((m) => {
                    const on = motion === m.k
                    return (
                      <button
                        key={m.k}
                        type="button"
                        onClick={() => setMotion(m.k)}
                        title={m.hint}
                        style={{
                          flex: 1,
                          border: `1px solid ${on ? accent.base : grey[20]}`,
                          background: on ? accent.tint : grey[0],
                          color: on ? accent.active : grey[60],
                          borderRadius: radius.md,
                          padding: "8px 6px",
                          cursor: "pointer",
                          ...type.label,
                        }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {err && (
                <div
                  style={{
                    ...type.label,
                    color: semantic.dangerFg,
                    background: semantic.dangerBg,
                    border: `1px solid ${semantic.dangerBorder}`,
                    borderRadius: radius.md,
                    padding: "8px 10px",
                  }}
                >
                  {err}
                </div>
              )}

              <button
                type="button"
                disabled={!canGo}
                onClick={generate}
                style={{
                  ...button("accent"),
                  justifyContent: "center",
                  opacity: canGo ? 1 : 0.5,
                  cursor: canGo ? "pointer" : "not-allowed",
                }}
              >
                <UiIcon name="sparkles" size={14} />
                Generate video
              </button>
              <div style={{ ...type.label, color: grey[40], textAlign: "center" }}>Uses 60 credits per clip.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
