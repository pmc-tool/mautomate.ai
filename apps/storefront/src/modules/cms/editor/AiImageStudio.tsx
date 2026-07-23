"use client"

/* AI Image Studio — the "Generate with AI" experience inside the media picker.
 *
 * Design principles:
 *  - GUIDED, not a bare prompt box: pick the shape (visual, aspect-correct
 *    chips), pick a mood, describe it — with example prompts one click away.
 *  - The right pane always shows WHAT YOU WILL GET: an aspect-correct frame
 *    before generating, staged progress while working, and results rendered at
 *    their true aspect ratio (a wide hero looks wide, a logo sits on a
 *    checkerboard so its transparency is visible).
 *  - Nothing is lost: every batch stays in the session strip, so merchants can
 *    generate, compare, and go back to an earlier result.
 *
 * All chrome comes from the editor design system — one ramp, one scale, one
 * accent (the ember). No local colours.
 */

import React, { useEffect, useRef, useState } from "react"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  eyebrow,
  field,
  font,
  grey,
  hairline,
  motion,
  radius,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"

type ProductOpt = { id: string; label: string; thumbnail?: string | null }

const KINDS: {
  k: string
  label: string
  w: number
  h: number
  hint: string
  transparent?: boolean
}[] = [
  { k: "hero", label: "Hero", w: 1344, h: 768, hint: "Wide, with space for your headline." },
  { k: "banner", label: "Banner", w: 1536, h: 640, hint: "Ultra-wide promo strip with room for text." },
  { k: "product", label: "Product", w: 1024, h: 1024, hint: "Studio shot on a clean white background." },
  { k: "lifestyle", label: "Lifestyle", w: 1216, h: 832, hint: "Natural, in-context brand photo." },
  { k: "background", label: "Backdrop", w: 1536, h: 640, hint: "A real surface to place things on." },
  { k: "square", label: "Square", w: 1024, h: 1024, hint: "Tiles, galleries and grids." },
  { k: "portrait", label: "Portrait", w: 832, h: 1216, hint: "Tall format, people and posters." },
  { k: "logo", label: "Logo", w: 1024, h: 1024, hint: "Transparent PNG mark, edge to edge.", transparent: true },
  { k: "custom", label: "Custom", w: 1200, h: 630, hint: "Exactly the size you type — any banner, any slot." },
]

const PHOTO_STYLES = [
  { k: "", label: "Auto", frag: "" },
  { k: "studio", label: "Studio clean", frag: ", clean studio setting, seamless backdrop, soft even lighting" },
  { k: "warm", label: "Warm & cozy", frag: ", warm golden-hour tones, cozy inviting atmosphere" },
  { k: "airy", label: "Bright & airy", frag: ", bright airy feel, soft daylight, light neutral tones" },
  { k: "moody", label: "Dark & moody", frag: ", dark moody lighting, deep shadows, dramatic contrast" },
  { k: "outdoor", label: "Natural", frag: ", natural outdoor setting, organic textures, daylight" },
  { k: "luxury", label: "Luxury", frag: ", luxurious premium editorial look, elegant styling" },
]

const LOGO_STYLES = [
  { k: "", label: "Auto", frag: "" },
  { k: "minimal", label: "Minimal", frag: ", ultra minimal, one simple bold shape" },
  { k: "geometric", label: "Geometric", frag: ", geometric construction, precise clean lines" },
  { k: "emblem", label: "Emblem", frag: ", badge emblem style, contained in a circle" },
  { k: "playful", label: "Playful", frag: ", playful rounded friendly shapes" },
  { k: "tech", label: "Modern tech", frag: ", modern tech look, sharp angular shapes" },
]

const EXAMPLES: Record<string, string[]> = {
  hero: [
    "outdoor gear on a mountain trail at sunrise",
    "cozy handmade home decor on a rustic wooden table",
    "fresh skincare bottles with soft water reflections",
  ],
  banner: [
    "summer sale mood with tropical leaves and soft shadows",
    "minimal festive gift boxes with warm bokeh lights",
    "fresh vegetables scattered on a light stone counter",
  ],
  product: ["a ceramic coffee mug", "a brown leather wallet", "a scented soy candle in a glass jar"],
  lifestyle: [
    "someone enjoying morning coffee by a bright window",
    "hands wrapping a gift in kraft paper",
    "a family cooking together in a warm kitchen",
  ],
  background: ["soft natural linen fabric", "light marble countertop", "warm oak wood surface"],
  square: ["a stack of folded pastel towels", "assorted fresh pastries on a plate", "minimal desk setup with a plant"],
  portrait: ["smiling young woman in natural light", "barista pouring latte art, cafe setting", "tailor measuring fabric in a workshop"],
  logo: ["a mountain peak", "a leaf inside a circle", "a needle and thread"],
}

/** In "My images" mode the text box describes the SCENE, not the image —
 *  so the examples must be scenes too. */
const SCENE_EXAMPLES = [
  "on a light marble counter, warm morning light",
  "on a rustic wooden table, soft plants behind",
  "on a pastel podium, soft studio glow",
]

/** "Edit current" re-imagines the LOOK of the existing image (img2img). */
const REMIX_EXAMPLES = [
  "warm golden-hour light, cozy mood",
  "clean bright studio look",
  "dark premium editorial mood",
]
const REMIX_STRENGTHS = [
  { k: 0.35, label: "Subtle" },
  { k: 0.55, label: "Balanced" },
  { k: 0.75, label: "Strong" },
]

const STAGES_DESCRIBE = ["Composing your image…", "Adding light and detail…", "Finishing touches…"]
const STAGES_PRODUCT = [
  "Cutting your images out of their backgrounds…",
  "Building the scene behind them…",
  "Arranging them with natural shadows…",
]
const STAGES_REMIX = ["Reading your image…", "Re-imagining the look…", "Almost there…"]

type Batch = {
  id: number
  urls: string[]
  prompt: string
  kind: string
  transparent: boolean
  remix?: boolean
  note?: string
}

/** Transparency checkerboard — built from the grey ramp, like everything else. */
const CHECKER = `repeating-conic-gradient(${grey[10]} 0% 25%, ${grey[0]} 0% 50%) 50% / 16px 16px`

/** Skeleton shimmer while a generation is in flight. */
const SHIMMER = `linear-gradient(90deg, ${grey[10]} 25%, ${grey[5]} 37%, ${grey[10]} 63%) 0 0 / 800px 100%`

export default function AiImageStudio({
  slot,
  editorKey,
  products,
  onUse,
  currentImage,
}: {
  slot: string
  editorKey: string
  products: ProductOpt[]
  onUse: (url: string) => void
  /** The image currently in the field — enables "Edit current" (img2img). */
  currentImage?: string
}) {
  const validSlot = KINDS.some((x) => x.k === slot) ? slot : "square"
  const [kind, setKind] = useState(validSlot)
  const [mode, setMode] = useState<"describe" | "product" | "remix">("describe")
  const [strength, setStrength] = useState(0.55)
  const [style, setStyle] = useState("")
  const [prompt, setPrompt] = useState("")
  // Reference images for compose mode: real products, library images, uploads.
  const [subjects, setSubjects] = useState<{ url: string; label: string }[]>([])
  const [srcTab, setSrcTab] = useState<"products" | "library">("products")
  const [libItems, setLibItems] = useState<{ url: string }[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [layout, setLayout] = useState<"left" | "right" | "center">("right")
  const [pq, setPq] = useState("")
  const [batches, setBatches] = useState<Batch[]>([])
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [savingUrl, setSavingUrl] = useState<string | null>(null)
  const batchId = useRef(1)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [customW, setCustomW] = useState(1200)
  const [customH, setCustomH] = useState(630)
  const isCustom = kind === "custom"
  const K0 = KINDS.find((x) => x.k === kind) ?? KINDS[5]
  // Custom sizes render/preview at exactly the typed dimensions.
  const K = isCustom ? { ...K0, w: Math.max(64, customW || 1200), h: Math.max(64, customH || 630) } : K0
  const isLogo = kind === "logo"
  const styles = isLogo ? LOGO_STYLES : PHOTO_STYLES
  const styleFrag = styles.find((s) => s.k === style)?.frag ?? ""
  const withPhotos = products.filter((p) => p.thumbnail)
  const absUrl = (u: string) =>
    /^(https?:|data:)/.test(u) ? u : new URL(u, window.location.origin).href

  const canRemix = !!currentImage && !isLogo
  const canGo =
    !busy &&
    prompt.trim().length > 0 &&
    (mode !== "product" || subjects.length > 0) &&
    (mode !== "remix" || !!currentImage)

  const addSubject = (url: string, label: string) => {
    setSubjects((prev) =>
      prev.length >= 4 || prev.some((s) => s.url === url) ? prev : [...prev, { url, label }]
    )
  }
  const toggleSubject = (url: string, label: string) => {
    setSubjects((prev) =>
      prev.some((s) => s.url === url) ? prev.filter((s) => s.url !== url) : prev.length >= 4 ? prev : [...prev, { url, label }]
    )
  }

  // Media library loads the first time that source is opened.
  useEffect(() => {
    if (mode !== "product" || srcTab !== "library" || libItems !== null) return
    fetch(`/api/puck/media?key=${encodeURIComponent(editorKey)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((d) => setLibItems(Array.isArray(d?.media) ? d.media : []))
      .catch(() => setLibItems([]))
  }, [mode, srcTab, libItems, editorKey])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || subjects.length >= 4) return
    setUploading(true)
    setErr(null)
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
      const r = await fetch(`/api/puck/media?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, contentBase64 }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.media?.url) throw new Error(d?.message || d?.error || "Upload failed")
      addSubject(d.media.url, file.name)
      setLibItems(null) // refresh the library next time it opens
    } catch (e2: any) {
      setErr(e2?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  // Staged progress: generation is one long call, so we narrate what the
  // pipeline is actually doing on a timer to keep the wait honest and calm.
  useEffect(() => {
    if (!busy) {
      setStage(0)
      return
    }
    const t = setInterval(() => setStage((s) => Math.min(s + 1, 2)), 9000)
    return () => clearInterval(t)
  }, [busy])

  // Product/remix modes make no sense for logos; bounce back to describe.
  useEffect(() => {
    if (isLogo && mode !== "describe") setMode("describe")
  }, [isLogo, mode])

  const run = async () => {
    if (!canGo) return
    setBusy(true)
    setErr(null)
    try {
      // Custom size: send the exact typed dimensions; the server generates at
      // the closest supported ratio and finishes at these precise pixels.
      const dims = isCustom ? { width: K.w, height: K.h } : {}
      const body =
        mode === "remix"
          ? {
              action: "remix",
              image: absUrl(currentImage!),
              prompt: prompt.trim() + styleFrag,
              strength,
              kind, // the selected shape applies to the edited output too
              ...dims,
            }
          : mode === "product"
          ? {
              action: "compose",
              kind: kind === "logo" || kind === "square" || kind === "portrait" || kind === "custom" ? "hero" : kind,
              subject_images: subjects.map((x) => absUrl(x.url)),
              prompt: prompt.trim() + styleFrag,
              layout,
              ...dims,
            }
          : {
              action: "generate",
              kind: isCustom ? "square" : kind,
              prompt: prompt.trim() + styleFrag,
              count: 1,
              has_current: !!currentImage && !isLogo,
              ...dims,
            }
      const r = await fetch(`/api/puck/ai-image?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !Array.isArray(d?.images) || !d.images.length) {
        throw new Error(d?.error || "Generation failed — please try again.")
      }
      const bk = mode === "product" ? (body as any).kind : kind
      setBatches((prev) => [
        {
          id: batchId.current++,
          urls: d.images,
          prompt: prompt.trim(),
          kind: bk,
          transparent: !!d.transparent,
          remix: !!d.remix,
          note: typeof d.note === "string" ? d.note : undefined,
        },
        ...prev,
      ])
      resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e: any) {
      setErr(e?.message || "Generation failed")
    } finally {
      setBusy(false)
    }
  }

  const use = async (url: string) => {
    if (savingUrl) return
    setSavingUrl(url)
    setErr(null)
    try {
      const r = await fetch(`/api/puck/ai-image?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", url, kind }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.url) throw new Error(d?.error || "Could not save the image")
      onUse(d.url)
    } catch (e: any) {
      setErr(e?.message || "Could not save the image")
    } finally {
      setSavingUrl(null)
    }
  }

  /* ----------------------------- chrome ----------------------------- */
  /** A selection chip: unselected = white/hairline, selected = ember tint. */
  const chipStyle = (on: boolean): React.CSSProperties => ({
    ...type.label,
    fontFamily: font,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 28,
    padding: "0 10px",
    borderRadius: radius.pill,
    border: `1px solid ${on ? accent.base : grey[30]}`,
    background: on ? accent.tint : grey[0],
    color: on ? accent.base : grey[60],
    fontWeight: on ? 600 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: motion.fast,
  })
  /** The same chip as a segmented-control cell. */
  const segStyle = (on: boolean): React.CSSProperties => ({
    ...chipStyle(on),
    flex: 1,
    height: 32,
    borderRadius: radius.md,
    padding: "0 8px",
  })
  const sectionTitle: React.CSSProperties = { ...eyebrow(), margin: "0 0 8px" }
  const hint: React.CSSProperties = { ...type.label, fontFamily: font, color: grey[50] }

  const kindAspect = (x: { w: number; h: number }) => {
    const maxW = 40
    const h = Math.max(14, Math.round((maxW * x.h) / x.w))
    return { width: maxW, height: Math.min(h, 40) }
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 420, fontFamily: font }}>
      <style>{`@keyframes ffai-shimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }`}</style>

      {/* ------------------------------ Left rail ------------------------------ */}
      <div
        style={{
          width: 320,
          flex: "0 0 auto",
          borderRight: hairline,
          overflowY: "auto",
          padding: "16px 16px 20px",
        }}
      >
        <div style={sectionTitle}>What are you making?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
          {KINDS.map((x) => {
            const on = kind === x.k
            const dims = kindAspect(x)
            return (
              <button
                key={x.k}
                type="button"
                onClick={() => {
                  setKind(x.k)
                  setStyle("")
                }}
                title={`${x.label} — ${x.w}x${x.h}`}
                style={{
                  border: `1px solid ${on ? accent.base : grey[30]}`,
                  background: on ? accent.tint : grey[0],
                  borderRadius: radius.md,
                  padding: "8px 4px 6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  transition: motion.fast,
                }}
              >
                <span
                  style={{
                    ...dims,
                    borderRadius: radius.sm,
                    border: `1px solid ${on ? accent.base : grey[30]}`,
                    background: x.transparent ? CHECKER : on ? accent.tintStrong : grey[10],
                    display: "block",
                  }}
                />
                <span
                  style={{
                    ...type.micro,
                    fontFamily: font,
                    whiteSpace: "nowrap",
                    color: on ? accent.base : grey[60],
                  }}
                >
                  {x.label}
                </span>
              </button>
            )
          })}
        </div>
        {isCustom && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0 8px" }}>
            <input
              type="number"
              min={64}
              max={4096}
              value={customW}
              onChange={(e) => setCustomW(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ ...field(), width: 76, height: 28 }}
            />
            <span style={{ ...type.body, fontFamily: font, color: grey[40] }}>×</span>
            <input
              type="number"
              min={64}
              max={4096}
              value={customH}
              onChange={(e) => setCustomH(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ ...field(), width: 76, height: 28 }}
            />
            <span style={hint}>px — exact output size</span>
          </div>
        )}
        <div style={{ ...hint, marginBottom: 16 }}>
          {K.hint} <span style={{ color: grey[40] }}>({K.w}×{K.h}{isLogo ? ", transparent" : ""})</span>
          {validSlot === kind && (
            <span style={{ color: accent.base, fontWeight: 600 }}> · Matches this field</span>
          )}
        </div>

        {!isLogo && (
          <>
            <div style={sectionTitle}>Start from</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(
                [
                  { k: "describe", t: "Describe it" },
                  { k: "product", t: "My images" },
                  ...(canRemix ? [{ k: "remix", t: "Edit current" }] : []),
                ] as { k: "describe" | "product" | "remix"; t: string }[]
              ).map((m) => (
                <button key={m.k} type="button" onClick={() => setMode(m.k)} style={segStyle(mode === m.k)}>
                  {m.t}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === "remix" && currentImage && (
          <div style={{ marginBottom: 12 }}>
            <div style={sectionTitle}>Editing this image</div>
            <div
              style={{
                background: CHECKER,
                border: hairline,
                borderRadius: radius.md,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage}
                alt=""
                style={{ width: "100%", maxHeight: 130, objectFit: "contain", display: "block" }}
              />
            </div>
            <div style={sectionTitle}>How much change?</div>
            <div style={{ display: "flex", gap: 6 }}>
              {REMIX_STRENGTHS.map((st) => (
                <button key={st.k} type="button" onClick={() => setStrength(st.k)} style={segStyle(strength === st.k)}>
                  {st.label}
                </button>
              ))}
            </div>
            <div style={{ ...hint, marginTop: 8 }}>
              Describe any change — new background, new scene, a person holding it, different lighting.
              Your product's exact design is preserved.
            </div>
          </div>
        )}

        {mode === "product" && !isLogo && (
          <div style={{ marginBottom: 12 }}>
            <div style={sectionTitle}>Your images ({subjects.length}/4)</div>
            {subjects.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {subjects.map((sub, i) => (
                  <div key={sub.url} style={{ position: "relative", width: 48 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sub.url}
                      alt=""
                      title={sub.label}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                        border: hairline,
                        borderRadius: radius.md,
                        background: grey[0],
                        display: "block",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSubjects((prev) => prev.filter((_, x) => x !== i))}
                      title="Remove"
                      aria-label="Remove"
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        borderRadius: radius.pill,
                        border: 0,
                        background: grey[80],
                        color: grey[0],
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        cursor: "pointer",
                        transition: motion.fast,
                      }}
                    >
                      <UiIcon name="x" size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button type="button" onClick={() => setSrcTab("products")} style={segStyle(srcTab === "products")}>
                Products
              </button>
              <button type="button" onClick={() => setSrcTab("library")} style={segStyle(srcTab === "library")}>
                Library
              </button>
              <label
                style={{
                  ...segStyle(false),
                  opacity: uploading || subjects.length >= 4 ? 0.5 : 1,
                }}
              >
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUpload}
                  disabled={uploading || subjects.length >= 4}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {srcTab === "products" &&
              (withPhotos.length === 0 ? (
                <div style={{ ...hint, marginBottom: 8 }}>
                  No product photos yet — use Library or Upload instead.
                </div>
              ) : (
                <>
                  <input
                    value={pq}
                    onChange={(e) => setPq(e.target.value)}
                    placeholder="Search products…"
                    style={{ ...field(), height: 28, boxSizing: "border-box", marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {withPhotos
                      .filter((p) => !pq.trim() || p.label.toLowerCase().includes(pq.toLowerCase()))
                      .slice(0, 20)
                      .map((p) => {
                        const on = subjects.some((s) => s.url === p.thumbnail)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleSubject(p.thumbnail!, p.label)}
                            title={on ? "Remove from banner" : "Add to banner"}
                            style={{
                              flex: "0 0 auto",
                              width: 66,
                              border: `1px solid ${on ? accent.base : grey[20]}`,
                              outline: on ? `2px solid ${accent.base}` : "none",
                              outlineOffset: -1,
                              borderRadius: radius.md,
                              background: on ? accent.tint : grey[0],
                              boxShadow: shadow.xs,
                              padding: 4,
                              cursor: "pointer",
                              transition: motion.fast,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.thumbnail!}
                              alt=""
                              style={{ width: "100%", height: 48, objectFit: "contain", display: "block" }}
                            />
                            <div
                              style={{
                                ...type.micro,
                                fontFamily: font,
                                textTransform: "none",
                                letterSpacing: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                                color: on ? accent.base : grey[60],
                                fontWeight: on ? 600 : 400,
                                marginTop: 4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {on ? <UiIcon name="check" size={10} /> : null}
                              {p.label}
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </>
              ))}

            {srcTab === "library" && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, minHeight: 56, alignItems: "center" }}>
                {libItems === null ? (
                  <div style={hint}>Loading your library…</div>
                ) : libItems.length === 0 ? (
                  <div style={hint}>Library is empty — upload an image instead.</div>
                ) : (
                  libItems.slice(0, 30).map((m) => {
                    const on = subjects.some((s) => s.url === m.url)
                    return (
                      <button
                        key={m.url}
                        type="button"
                        onClick={() => toggleSubject(m.url, "Library image")}
                        title={on ? "Remove from banner" : "Add to banner"}
                        style={{
                          flex: "0 0 auto",
                          width: 56,
                          height: 56,
                          border: `1px solid ${on ? accent.base : grey[20]}`,
                          outline: on ? `2px solid ${accent.base}` : "none",
                          outlineOffset: -1,
                          borderRadius: radius.md,
                          background: on ? accent.tint : grey[0],
                          boxShadow: shadow.xs,
                          padding: 4,
                          cursor: "pointer",
                          transition: motion.fast,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <div style={{ ...sectionTitle, marginTop: 12 }}>Position</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["left", "center", "right"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayout(l)}
                  style={{ ...segStyle(layout === l), textTransform: "capitalize" }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{ ...hint, marginTop: 8 }}>
              Each image is cut out of its background and arranged on the scene you describe, standing on a shared ground line with natural shadows.
            </div>
          </div>
        )}

        <div style={sectionTitle}>Mood</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {styles.map((s) => (
            <button key={s.k || "auto"} type="button" onClick={() => setStyle(s.k)} style={chipStyle(style === s.k)}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={sectionTitle}>
          {mode === "product" ? "Describe the scene" : mode === "remix" ? "Describe the change" : "Describe it"}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              run()
            }
          }}
          rows={3}
          placeholder={
            mode === "product"
              ? "Describe the scene behind your images — e.g. on a marble counter in warm morning light"
              : mode === "remix"
              ? "Describe the new look — e.g. warm golden-hour light"
              : `e.g. ${EXAMPLES[kind]?.[0] ?? "what you want to see"}`
          }
          style={{
            ...field(),
            height: "auto",
            padding: "8px 10px",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
        <div style={{ margin: "8px 0 12px" }}>
          {(mode === "product" ? SCENE_EXAMPLES : mode === "remix" ? REMIX_EXAMPLES : EXAMPLES[kind] ?? []).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              style={{
                ...type.label,
                fontFamily: font,
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                textAlign: "left",
                border: 0,
                background: "transparent",
                color: accent.base,
                padding: "4px 0",
                cursor: "pointer",
                transition: motion.fast,
              }}
            >
              <UiIcon name="sparkles" size={12} />
              {ex}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={run}
          disabled={!canGo}
          style={{
            ...button("accent"),
            width: "100%",
            ...(canGo ? {} : { background: grey[20], color: grey[40], cursor: "default" }),
          }}
        >
          {busy
            ? mode === "product"
              ? "Building banner…"
              : mode === "remix"
              ? "Re-imagining…"
              : "Generating…"
            : mode === "product"
            ? "Build my banner"
            : mode === "remix"
            ? "Re-imagine"
            : "Generate"}
        </button>
        {mode === "product" && subjects.length === 0 && (
          <div style={{ ...hint, marginTop: 8 }}>Add at least one image above first.</div>
        )}
      </div>

      {/* ------------------------------ Right pane ------------------------------ */}
      <div ref={resultsRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: grey[5] }}>
        {err && (
          <div
            style={{
              ...type.label,
              fontFamily: font,
              border: `1px solid ${semantic.dangerBorder}`,
              background: semantic.dangerBg,
              color: semantic.dangerFg,
              borderRadius: radius.md,
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            {err}
          </div>
        )}

        {busy && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...type.bodyStrong, fontFamily: font, color: grey[60], marginBottom: 12 }}>
              {(mode === "product" ? STAGES_PRODUCT : mode === "remix" ? STAGES_REMIX : STAGES_DESCRIBE)[stage]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: K.w >= K.h ? "1fr" : "1fr 1fr", gap: 12, maxWidth: 560 }}>
              {Array.from({ length: 1 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: `${K.w} / ${K.h}`,
                    borderRadius: radius.lg,
                    background: SHIMMER,
                    animation: "ffai-shimmer 1.4s linear infinite",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {!busy && batches.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
            <div
              style={{
                ...type.label,
                fontFamily: font,
                fontWeight: 600,
                width: K.w >= K.h ? 340 : 190,
                aspectRatio: `${K.w} / ${K.h}`,
                border: `2px dashed ${grey[30]}`,
                borderRadius: radius.lg,
                background: isLogo ? CHECKER : grey[0],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: grey[40],
              }}
            >
              {K.label} · {K.w}×{K.h}
            </div>
            <div style={{ ...hint, marginTop: 16, maxWidth: 320, textAlign: "center" }}>
              Your image will be created at exactly this shape, so it drops straight into the design.
              Describe it on the left, or start from one of the examples.
            </div>
          </div>
        )}

        {batches.map((b, bi) => {
          const bk = KINDS.find((x) => x.k === b.kind) ?? K
          return (
            <div key={b.id} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={eyebrow()}>{bi === 0 ? "Latest" : `Earlier`}</span>
                <span
                  style={{
                    ...hint,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  “{b.prompt}”
                </span>
              </div>
              {b.note && (
                <div
                  style={{
                    ...type.label,
                    fontFamily: font,
                    color: semantic.warnFg,
                    background: semantic.warnBg,
                    border: `1px solid ${semantic.warnBorder}`,
                    borderRadius: radius.md,
                    padding: "6px 10px",
                    marginBottom: 8,
                    maxWidth: 560,
                  }}
                >
                  {b.note}
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: bk.w > bk.h ? "1fr" : "1fr 1fr",
                  gap: 12,
                  maxWidth: 560,
                }}
              >
                {b.urls.map((u, i) => {
                  const isSaving = savingUrl === u
                  return (
                    <div
                      key={i}
                      style={{
                        border: hairline,
                        borderRadius: radius.md,
                        overflow: "hidden",
                        background: grey[0],
                        boxShadow: shadow.xs,
                      }}
                    >
                      <div style={{ background: b.transparent ? CHECKER : grey[0] }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt=""
                          style={{
                            width: "100%",
                            // Remix output keeps the source image's own shape.
                            aspectRatio: b.remix ? undefined : `${bk.w} / ${bk.h}`,
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!!savingUrl}
                        onClick={() => use(u)}
                        style={{
                          ...type.bodyStrong,
                          fontFamily: font,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          width: "100%",
                          height: 36,
                          border: 0,
                          borderTop: hairline,
                          background: isSaving ? grey[10] : grey[0],
                          color: isSaving ? grey[40] : accent.base,
                          cursor: savingUrl ? "default" : "pointer",
                          transition: motion.fast,
                        }}
                      >
                        {isSaving ? null : <UiIcon name="check" size={14} />}
                        {isSaving ? "Saving to your library…" : "Use this image"}
                      </button>
                    </div>
                  )
                })}
              </div>
              {bi === 0 && !busy && (
                <button
                  type="button"
                  onClick={run}
                  disabled={!canGo}
                  style={{
                    ...button("secondary", "sm"),
                    marginTop: 12,
                    ...(canGo ? {} : { color: grey[40], cursor: "default" }),
                  }}
                >
                  <UiIcon name="reset" size={14} />
                  Generate more like this
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
