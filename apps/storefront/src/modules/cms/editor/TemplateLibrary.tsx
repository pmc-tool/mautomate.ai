"use client"

/* ------------------------------------------------------------------ */
/* Template Library — the Elementor-grade, full-screen library.        */
/*                                                                     */
/* Every card is a LIVE render of the template's blocks through the     */
/* store's ACTIVE Liquid theme — the exact pipeline the editor canvas   */
/* uses (loadCanvasLiquid + parseAndRenderSync per section), so a       */
/* preview inherently "matches the website". The rendered HTML is       */
/* composed into a sandboxed <iframe srcdoc> at 1200px and scaled down  */
/* to the card with a CSS transform. Rendering is LAZY (Intersection-   */
/* Observer, only when a card scrolls into view) and cached per         */
/* template id, so a 40-template library costs nothing until looked at. */
/*                                                                     */
/* When the store runs a compiled React theme (no uploadable bundle),   */
/* loadCanvasLiquid returns null — cards fall back to a section-outline */
/* view (block icons + labels) and the library stays fully usable.      */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PaletteIcon, UiIcon } from "@modules/cms/editor/palette-icons"
import { listBlockSchemas } from "@modules/cms/schema"
import { renderSliderHtml } from "@modules/cms/render/slider-html"
import {
  loadCanvasLiquid,
  canvasThemeCssHref,
  type CanvasLiquid,
} from "@modules/cms/editor/liquid-canvas"
import {
  buildDocumentHeadCss,
  buildDocumentSections,
  makeWidgetRenderer,
  planSection,
  wrapSectionHtml,
} from "@modules/cms/render/document"
import {
  injectTabProducts,
  renderContainerHtml,
} from "@modules/cms/render/container-html"
import {
  accent,
  button,
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
  surface,
  type,
} from "@modules/cms/editor/design"

type Tpl = {
  id: string
  name: string
  category: string
  scope?: string
  /** 4C: set on scope:"preset" rows (per-widget style presets). */
  widget_type?: string | null
  blocks: number
  is_global?: boolean
  created_at?: string
  data: { blocks?: unknown[] }
}

/* ---------------- Preview rendering (mirrors liquid-canvas) ---------------- */

/** The theme frame width every preview renders at before scaling down. */
const FRAME_W = 1200
/** Height of the preview area on a grid card. */
const CARD_PREVIEW_H = 200

/** Per-block height estimates for the srcdoc frame (the frame gets no
 *  allow-scripts, so it can never report its real height back). */
const BLOCK_H: Record<string, number> = {
  hero_slider: 720,
  promo_banner_grid: 520,
  product_tabs: 860,
  deal_of_day: 620,
  category_showcase: 560,
  brand_strip: 220,
  rich_text: 380,
  image_with_text: 560,
  newsletter: 320,
  instagram_grid: 480,
  testimonials: 460,
  image_gallery: 560,
  container: 480,
}

function estimateHeight(blocks: unknown[]): number {
  let h = 0
  for (const b of blocks as any[]) h += BLOCK_H[b?.block_type] ?? 480
  return Math.min(Math.max(h, 480), 9000)
}

function blockTypesOf(t: Tpl): string[] {
  const out: string[] = []
  for (const b of (t.data?.blocks ?? []) as any[]) {
    const bt = typeof b?.block_type === "string" ? b.block_type : null
    if (bt && !out.includes(bt)) out.push(bt)
  }
  return out
}

/**
 * Render a template's blocks to a self-contained HTML document, entirely
 * through the SHARED document composer: `buildDocumentSections` builds the
 * per-section context entries (settings flattening, style scope, wrap_class /
 * wrap_css) exactly like production, `planSection` makes the flat-vs-container
 * decision, `makeWidgetRenderer` renders commerce widgets inside containers,
 * and `wrapSectionHtml` emits the styled-section wrap — so a preview card can
 * never lie about what Insert gives. Per-block try/catch: one bad block never
 * kills the whole card. Returns null when NOTHING rendered (caller shows the
 * outline fallback).
 */
function composeDoc(
  cl: CanvasLiquid,
  blocks: unknown[],
  themeVars: string
): string | null {
  const parts: string[] = []
  let rendered = 0
  const entries = buildDocumentSections(blocks as any[])
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const bt = entry.type
    try {
      const plan = planSection(entry, cl.files, { facadeFallsBackToContainer: true })
      let html: string
      if (plan.kind === "slider") {
        // Layered heroes (Phase 5) — platform-rendered, editor mode, no runtime
        // script in a preview card. Falls through to the shared wrap path so a
        // styled hero keeps its section CSS, exactly like production.
        html = renderSliderHtml(plan.settings as any, {
          scope: entry.scope,
          editor: true,
        })
      } else       if (plan.kind === "container") {
        html = renderContainerHtml(plan.settings, {
          scope: entry.scope,
          renderSection: makeWidgetRenderer({
            files: cl.files,
            tabProducts: cl.products,
            widgetId: (t) => `w-${t}`,
            render: (src, sectionCtx) =>
              cl.engine.parseAndRenderSync(src, { ...cl.ctx, section: sectionCtx }),
          }),
        })
      } else if (plan.kind === "flat" && plan.src) {
        let flat = plan.section
        if (
          plan.type === "product_tabs" &&
          Array.isArray((flat.settings as any)?.tabs) &&
          cl.products.length
        ) {
          flat = { ...flat, settings: injectTabProducts(flat.settings, cl.products) }
        }
        html = cl.engine.parseAndRenderSync(plan.src, { ...cl.ctx, section: flat })
      } else {
        continue
      }
      parts.push(wrapSectionHtml(entry, html))
      rendered++
    } catch (e) {
      console.warn("[template-library] preview render failed for block", bt, e)
    }
  }
  if (!rendered) return null

  // The theme stylesheet is INLINED rather than <link>ed. A sandboxed srcdoc
  // frame does not load same-origin subresources, so a linked stylesheet is
  // silently dropped and every card paints blank white. The bundle already
  // carries the CSS text, so there is nothing to fetch.
  const themeCss = cl.files["assets/theme.css"]
  const styleTag = themeCss
    ? `<style>${themeCss}</style>`
    : `<link rel="stylesheet" href="${canvasThemeCssHref(cl)}">`

  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta name="viewport" content="width=${FRAME_W}">`,
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Marcellus&display=swap">',
    '<link rel="stylesheet" href="/learts/assets/css/vendor/fontawesome.min.css">',
    styleTag,
    // Brand design tokens. A template styled with "link to global token"
    // compiles to var(--ff-*), so without these the preview drops every accent
    // and lies about the colours Insert would actually produce.
    themeVars ? `<style>${themeVars}</style>` : "",
    "<style>html,body{margin:0;padding:0;overflow-x:hidden}img{max-width:100%}</style>",
    `</head><body class="${bodyClassOf(cl)}">`,
    ...parts,
    "</body></html>",
  ].join("")
}

/** Every theme namespaces its own body class (lz-body, kt-body, …) and hangs
 *  real rules off it, so hardcoding one theme's prefix leaves other themes
 *  unstyled. Read it from the theme's own layout. */
function bodyClassOf(cl: CanvasLiquid): string {
  const layout = cl.files["layout/theme.liquid"] ?? ""
  const m = layout.match(/<body[^>]*class="([^"]*)"/)
  if (!m) return "lz-body"
  // Drop Liquid expressions first — splitting on whitespace would otherwise
  // turn `template-{{ template }}` into stray "template" / "}}" tokens.
  const cls = m[1]
    .replace(/\{\{[\s\S]*?\}\}/g, "")
    .replace(/\{%[\s\S]*?%\}/g, "")
    .split(/\s+/)
    .filter((c) => c && !c.endsWith("-"))
  return cls.length ? cls.join(" ") : "lz-body"
}

/* ---------------- Category tabs ---------------- */

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hero", label: "Hero" },
  { id: "banners", label: "Banners" },
  { id: "products", label: "Products" },
  { id: "deals", label: "Deals" },
  { id: "content", label: "Content" },
  { id: "trust", label: "Trust" },
  { id: "newsletter", label: "Newsletter" },
  { id: "gallery", label: "Gallery" },
  { id: "pages", label: "Pages" },
  { id: "sections", label: "Sections" },
  { id: "mine", label: "My Templates" },
]

/** A template belongs to a tab by its stored category first, then by what
 *  blocks it actually contains (seeded categories are coarser than the rail). */
function inTab(t: Tpl, tab: string): boolean {
  if (tab === "all") return true
  if (tab === "mine") return !t.is_global
  const cat = (t.category || "").toLowerCase()
  const types = blockTypesOf(t)
  const has = (x: string) => types.includes(x)
  switch (tab) {
    case "hero":
      return cat === "hero" || has("hero_slider")
    case "banners":
      return cat === "banners" || has("promo_banner_grid")
    case "products":
      return (
        cat === "products" || cat === "commerce" || has("product_tabs") || has("category_showcase")
      )
    case "deals":
      return cat === "deals" || has("deal_of_day")
    case "content":
      return cat === "content" || has("rich_text") || has("image_with_text")
    case "trust":
      return cat === "trust" || has("testimonials") || has("brand_strip")
    case "newsletter":
      return cat === "newsletter" || has("newsletter")
    case "gallery":
      return cat === "gallery" || has("image_gallery") || has("instagram_grid")
    case "pages":
      return cat === "pages" || t.scope === "page"
    case "sections":
      // Pre-4C rows have no scope column value in the payload — they were all
      // section-shaped unless categorized as pages.
      return t.scope === "section" || (!t.scope && cat !== "pages")
    default:
      return true
  }
}

const BLOCK_LABELS: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const s of listBlockSchemas()) out[s.type] = s.label
  return out
})()

/* ---------------- Shared bits ---------------- */

const CSS = `
.tl-card { transform: translateY(0); }
.tl-card:hover { box-shadow: ${shadow.md}; }
.tl-card:hover .tl-actions, .tl-card .tl-actions:focus-within { opacity: 1; pointer-events: auto; }
@keyframes tl-shimmer { 0% { background-position: -600px 0 } 100% { background-position: 600px 0 } }
.tl-shimmer {
  background: linear-gradient(90deg, ${grey[10]} 0%, ${grey[5]} 50%, ${grey[10]} 100%);
  background-size: 1200px 100%;
  animation: tl-shimmer 1.4s ease-in-out infinite;
}
`

const catChip: React.CSSProperties = {
  ...type.micro,
  fontFamily: font,
  color: grey[60],
  background: grey[10],
  border: hairline,
  borderRadius: radius.pill,
  padding: "2px 8px",
  whiteSpace: "nowrap",
  flexShrink: 0,
}

function FallbackRows({ t, limit }: { t: Tpl; limit: number }) {
  const types = blockTypesOf(t)
  const shown = types.slice(0, limit)
  const extra = types.length - shown.length
  if (types.length === 0) {
    return (
      <div style={{ ...type.label, fontFamily: font, color: grey[40] }}>Empty template</div>
    )
  }
  return (
    <>
      {shown.map((bt) => (
        <div key={bt} style={{ display: "flex", alignItems: "center", gap: 8, color: grey[60] }}>
          <PaletteIcon type={bt} size={16} />
          <span style={{ ...type.label, fontFamily: font, color: grey[60] }}>
            {BLOCK_LABELS[bt] ?? bt}
          </span>
        </div>
      ))}
      {extra > 0 && (
        <div style={{ ...type.micro, fontFamily: font, color: grey[40] }}>+{extra} more</div>
      )}
    </>
  )
}

/** The 1200px srcdoc frame scaled down to fill a card's preview area. */
function CardFrame({ doc, frameH }: { doc: string; frameH: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setScale(el.offsetWidth / FRAME_W)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={boxRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#fff" }}
    >
      {scale > 0 && (
        <iframe
          title="Template preview"
          srcDoc={doc}
          sandbox="allow-same-origin"
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            width: FRAME_W,
            height: Math.max(frameH, Math.ceil(CARD_PREVIEW_H / scale)),
            border: 0,
            display: "block",
            background: "#fff",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  )
}

/* ---------------- Card ---------------- */

function TemplateCard({
  t,
  env,
  docFor,
  onInsert,
  onPreview,
  onDelete,
}: {
  t: Tpl
  env: CanvasLiquid | null | "pending"
  docFor: (t: Tpl) => string | null
  onInsert: () => void
  onPreview: () => void
  onDelete: (() => void) | null
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  // Lazy: render the Liquid preview only once the card has entered (or come
  // within 200px of) the viewport. Sticky — never un-renders on scroll-away.
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen) return
    const el = rootRef.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  const ready = seen && env !== "pending"
  const doc = ready && env ? docFor(t) : null

  return (
    <div
      ref={rootRef}
      className="tl-card"
      style={{
        ...surface(),
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: shadow.xs,
        transition: `box-shadow ${motion.base}`,
      }}
    >
      <div style={{ position: "relative", height: CARD_PREVIEW_H, background: grey[10] }}>
        {doc ? (
          <CardFrame doc={doc} frameH={estimateHeight(t.data?.blocks ?? [])} />
        ) : !ready ? (
          <div className="tl-shimmer" style={{ position: "absolute", inset: 0 }} />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              padding: "12px 16px",
              background: grey[5],
            }}
          >
            <FallbackRows t={t} limit={4} />
          </div>
        )}
        <div
          className="tl-actions"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "rgba(15, 19, 25, 0.44)",
            opacity: 0,
            pointerEvents: "none",
            transition: `opacity ${motion.base}`,
          }}
        >
          <button onClick={onInsert} style={button("accent", "md")}>
            Insert
          </button>
          <button onClick={onPreview} style={button("secondary", "md")}>
            Preview
          </button>
        </div>
      </div>
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderTop: hairline,
          background: "#fff",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...type.bodyStrong,
              fontFamily: font,
              color: grey[90],
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {t.name}
          </div>
          <div style={{ ...type.label, fontFamily: font, color: grey[50] }}>
            {t.blocks} section{t.blocks === 1 ? "" : "s"}
            {!t.is_global && " · Mine"}
          </div>
        </div>
        <span style={catChip}>{t.category || "Sections"}</span>
        {/* Always-visible Insert. The hover overlay alone is not discoverable —
            the preview frame covers the card, so there is no obvious way in. */}
        <button onClick={onInsert} style={{ ...button("accent", "sm"), flexShrink: 0 }}>
          Insert
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            title="Delete template"
            aria-label="Delete template"
            style={{
              ...iconButton("sm"),
              border: 0,
              background: "none",
              color: grey[40],
              transition: `color ${motion.fast}`,
            }}
          >
            <UiIcon name="trash" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------- Large preview modal ---------------- */

function PreviewModal({
  t,
  doc,
  pending,
  onInsert,
  onClose,
}: {
  t: Tpl
  doc: string | null
  pending: boolean
  onInsert: () => void
  onClose: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = w > 0 ? w / FRAME_W : 0
  const frameH = estimateHeight(t.data?.blocks ?? [])

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10020,
        background: "rgba(15, 19, 25, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${t.name}`}
        style={{
          ...surface("lg"),
          width: "min(1200px, 94vw)",
          height: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: font,
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: hairline,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                ...type.title,
                fontFamily: font,
                color: grey[90],
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t.name}
            </div>
            <span style={catChip}>{t.category || "Sections"}</span>
            <span style={{ ...type.label, fontFamily: font, color: grey[50], flexShrink: 0 }}>
              {t.blocks} section{t.blocks === 1 ? "" : "s"}
            </span>
          </div>
          <button onClick={onInsert} style={button("accent", "md")}>
            Insert
          </button>
          <button
            onClick={onClose}
            aria-label="Close preview"
            style={{ ...iconButton("md"), border: 0, background: "none", color: grey[50] }}
          >
            <UiIcon name="x" size={16} />
          </button>
        </div>
        <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", background: grey[10] }}>
          {doc && scale > 0 ? (
            <div style={{ width: "100%", height: Math.ceil(frameH * scale), overflow: "hidden" }}>
              <iframe
                title={`Preview of ${t.name}`}
                srcDoc={doc}
                sandbox="allow-same-origin"
                tabIndex={-1}
                style={{
                  width: FRAME_W,
                  height: frameH,
                  border: 0,
                  display: "block",
                  background: "#fff",
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "none",
                }}
              />
            </div>
          ) : pending ? (
            <div className="tl-shimmer" style={{ width: "100%", height: "100%" }} />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 48,
                minHeight: 320,
              }}
            >
              <FallbackRows t={t} limit={20} />
              <div
                style={{
                  ...type.label,
                  fontFamily: font,
                  color: grey[40],
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                A live preview is not available for this store&apos;s theme. Inserting works
                normally — sections take on your theme&apos;s styling on the page.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- The library ---------------- */

/**
 * Template library. Full-screen: category rail, searchable card grid with
 * live theme previews, large preview modal, and a footer strip that saves
 * the current page as a reusable template. Tenant-scoped, server-persisted.
 *
 * The three preview props are optional — without them (or on a store whose
 * theme has no uploadable bundle) cards degrade to section outlines.
 */
export function TemplateLibrary({
  slug,
  locale,
  editorKey,
  currentBlocks,
  onInsert,
  onClose,
  platformTheme = "",
  activeTheme = "",
  brandName = "",
  previewChrome = null,
  selectedBlock = null,
}: {
  slug: string
  locale: string
  editorKey: string
  currentBlocks: unknown[]
  onInsert: (blocks: unknown[]) => void
  onClose: () => void
  /**
   * 4C (ARCH-UX U5): the currently SELECTED section block, or null. When set,
   * the footer gains "Save selected section" — a scope:"section" template of
   * just that block (content + style/advanced/elementStyles bags).
   */
  selectedBlock?: Record<string, unknown> | null
  /** The store's uploaded-theme handle (chrome.platform_theme). */
  platformTheme?: string
  /** Resolved active theme id (chrome.active_theme) — theme_settings key. */
  activeTheme?: string
  brandName?: string
  /** The /api/puck/chrome payload (header/footer/categories/sample_products). */
  previewChrome?: Record<string, unknown> | null
}) {
  const [list, setList] = useState<Tpl[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState("all")
  const [query, setQuery] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<Tpl | null>(null)

  /* ---- template list ---- */
  const load = useCallback(() => {
    setErr(null)
    fetch(`/api/puck/templates?key=${encodeURIComponent(editorKey)}`)
      .then((r) => r.json())
      .then((b) =>
        setList(
          // 4C: preset rows (per-widget style presets) live on the same store
          // but are NOT insertable templates — the apply dropdown owns them.
          (Array.isArray(b?.templates) ? (b.templates as Tpl[]) : []).filter(
            (t) => t.scope !== "preset"
          )
        )
      )
      .catch(() => setErr("Couldn't load templates."))
  }, [editorKey])
  useEffect(load, [load])

  /* ---- theme render environment (once per theme handle) ----
     previewChrome/brandName are read through a ref so the parent passing a
     fresh object literal each render can never retrigger the bundle fetch. */
  const propsRef = useRef({ brandName, previewChrome, activeTheme })
  propsRef.current = { brandName, previewChrome, activeTheme }
  const [env, setEnv] = useState<CanvasLiquid | null | "pending">("pending")
  useEffect(() => {
    if (!platformTheme) {
      setEnv(null)
      return
    }
    let cancelled = false
    setEnv("pending")
    const p = propsRef.current
    const pc = (p.previewChrome ?? {}) as any
    loadCanvasLiquid(platformTheme, {
      shopName: p.brandName || "Store",
      chrome: pc,
      categories: Array.isArray(pc.categories) ? pc.categories : [],
      themeSettings: pc.theme_settings?.[p.activeTheme || ""] ?? {},
      products: Array.isArray(pc.sample_products) ? pc.sample_products : [],
    })
      .then((cl) => {
        if (cancelled) return
        if (!cl) {
          // loadCanvasLiquid swallows its own errors and returns null — say so.
          console.warn(
            `[template-library] theme bundle "${platformTheme}" unavailable — previews fall back to section outlines.`
          )
        }
        setEnv(cl)
      })
      .catch((e) => {
        if (cancelled) return
        console.warn("[template-library] theme bundle load failed", e)
        setEnv(null)
      })
    return () => {
      cancelled = true
    }
  }, [platformTheme])

  /* ---- per-template rendered documents (cached) ---- */
  const docCache = useRef(new Map<string, string | null>())
  // The store's brand tokens, from the document composer's ONE token-emission
  // seam (shared with the live route's <head> and the editor canvas), so a
  // preview resolves var(--ff-*) to the merchant's real colours.
  const themeVars = useMemo(
    () =>
      buildDocumentHeadCss(
        (previewChrome as any)?.theme ?? undefined,
        (previewChrome as any)?.theme_tokens ?? null
      ),
    [previewChrome]
  )
  const docFor = useCallback(
    (t: Tpl): string | null => {
      if (!env || env === "pending") return null
      const key = `${t.id}:${env.handle}:${env.version}`
      if (docCache.current.has(key)) return docCache.current.get(key) ?? null
      const doc = composeDoc(env, (t.data?.blocks ?? []) as unknown[], themeVars)
      docCache.current.set(key, doc)
      return doc
    },
    [env, themeVars]
  )

  /* ---- keyboard: Esc closes preview first, then the library ---- */
  const previewRef = useRef<Tpl | null>(null)
  previewRef.current = preview
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      e.preventDefault()
      if (previewRef.current) setPreview(null)
      else onCloseRef.current()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  /* ---- filtering ---- */
  const visible = useMemo(() => {
    if (!list) return []
    const q = query.trim().toLowerCase()
    return list.filter(
      (t) =>
        inTab(t, tab) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q))
    )
  }, [list, tab, query])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const tb of TABS) m[tb.id] = (list ?? []).filter((t) => inTab(t, tb.id)).length
    return m
  }, [list])

  /* ---- actions ---- */
  const insert = (t: Tpl) => {
    onInsert((t.data?.blocks ?? []) as unknown[])
    onClose()
  }

  const remove = async (t: Tpl) => {
    if (!confirm("Delete this template?")) return
    await fetch(
      `/api/puck/templates?id=${encodeURIComponent(t.id)}&key=${encodeURIComponent(editorKey)}`,
      { method: "DELETE" }
    ).catch(() => {})
    docCache.current.delete(`${t.id}`)
    load()
  }

  /**
   * Save the current page (scope:"page", every section) or just the selected
   * section (scope:"section", 4C save-selection-as-template) under My
   * Templates. Both ride the same tenant template endpoint.
   */
  const save = async (kind: "page" | "selection" = "page") => {
    if (!name.trim() || busy) return
    if (kind === "selection" && !selectedBlock) return
    setBusy(true)
    setSaveErr(null)
    try {
      const r = await fetch(`/api/puck/templates?key=${encodeURIComponent(editorKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "selection"
            ? {
                name: name.trim(),
                category: "Sections",
                scope: "section",
                data: { blocks: [selectedBlock] },
              }
            : {
                name: name.trim(),
                category: "Pages",
                scope: "page",
                data: { blocks: currentBlocks },
              }
        ),
      })
      if (!r.ok) throw new Error()
      setName("")
      setTab("mine")
      load()
    } catch {
      setSaveErr("Save failed.")
    } finally {
      setBusy(false)
    }
  }

  /* ---- rail row ---- */
  const railRow = (tb: { id: string; label: string }) => {
    const active = tab === tb.id
    return (
      <button
        key={tb.id}
        onClick={() => setTab(tb.id)}
        style={{
          ...type.bodyStrong,
          fontFamily: font,
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          height: 32,
          padding: "0 10px",
          border: 0,
          borderRadius: radius.md,
          background: active ? accent.tint : "none",
          color: active ? accent.active : grey[70],
          cursor: "pointer",
          textAlign: "left",
          marginBottom: 2,
          transition: `background ${motion.fast}, color ${motion.fast}`,
        }}
      >
        <span>{tb.label}</span>
        <span
          style={{
            ...type.micro,
            fontFamily: font,
            color: active ? accent.base : grey[40],
          }}
        >
          {counts[tb.id] ?? 0}
        </span>
      </button>
    )
  }

  const note: React.CSSProperties = { ...type.body, fontFamily: font, color: grey[50] }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Template library"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: grey[0],
        display: "flex",
        flexDirection: "column",
        fontFamily: font,
      }}
    >
      <style>{CSS}</style>

      {/* Header: identity · search · close */}
      <div
        style={{
          height: 56,
          padding: "0 20px",
          borderBottom: hairline,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: accent.base, display: "inline-flex" }}>
            <UiIcon name="template" size={18} />
          </span>
          <div style={{ ...type.heading, fontFamily: font, color: grey[90] }}>
            Template Library
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative", width: 300, maxWidth: "40vw" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: grey[40],
              display: "inline-flex",
              pointerEvents: "none",
            }}
          >
            <UiIcon name="search" size={14} />
          </span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            style={{ ...field(), paddingLeft: 30 }}
          />
        </div>
        <button
          onClick={onClose}
          aria-label="Close template library"
          style={iconButton("md")}
        >
          <UiIcon name="x" size={16} />
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Category rail */}
        <div
          style={{
            width: 200,
            borderRight: hairline,
            padding: "12px 8px",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <div style={{ ...eyebrow(), padding: "4px 10px 8px" }}>Browse</div>
          {TABS.filter((tb) => tb.id !== "mine").map(railRow)}
          <div style={{ borderTop: hairline, margin: "8px 2px" }} />
          {TABS.filter((tb) => tb.id === "mine").map(railRow)}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", background: grey[5] }}>
          {err && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: 48,
              }}
            >
              <span style={{ color: semantic.dangerFg, display: "inline-flex" }}>
                <UiIcon name="alert" size={20} />
              </span>
              <div style={{ ...note, color: semantic.dangerFg }}>{err}</div>
              <button onClick={load} style={button("secondary", "sm")}>
                Retry
              </button>
            </div>
          )}
          {!err && list === null && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
                padding: 24,
              }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="tl-shimmer"
                  style={{ height: CARD_PREVIEW_H + 54, borderRadius: radius.lg }}
                />
              ))}
            </div>
          )}
          {!err && list !== null && env === null && platformTheme !== "" && (
            <div
              style={{
                ...type.label,
                fontFamily: font,
                color: semantic.infoFg,
                background: semantic.infoBg,
                borderRadius: radius.md,
                padding: "8px 12px",
                margin: "16px 24px 0",
              }}
            >
              Live previews are unavailable for this store&apos;s theme — showing section
              outlines instead. Inserting works normally.
            </div>
          )}
          {!err && list !== null && visible.length === 0 && (
            <div style={{ ...note, padding: 48, textAlign: "center" }}>
              {tab === "mine"
                ? "No saved templates yet. Save the current page below to start your library."
                : query.trim()
                  ? "No templates match your search."
                  : "Nothing in this category yet."}
            </div>
          )}
          {!err && list !== null && visible.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
                padding: 24,
              }}
            >
              {visible.map((t) => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  env={env}
                  docFor={docFor}
                  onInsert={() => insert(t)}
                  onPreview={() => setPreview(t)}
                  onDelete={!t.is_global ? () => remove(t) : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer: save current page as a template */}
      <div
        style={{
          borderTop: hairline,
          background: grey[5],
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow()}>
            {selectedBlock
              ? "Save as a template"
              : "Save current page as a template"}
          </div>
          <div style={{ ...type.label, fontFamily: font, color: grey[50] }}>
            {selectedBlock
              ? `Save the selected section, or all ${currentBlocks.length} section${
                  currentBlocks.length === 1 ? "" : "s"
                } of “${slug}”, under My Templates.`
              : `Stores all ${currentBlocks.length} section${
                  currentBlocks.length === 1 ? "" : "s"
                } of “${slug}” under My Templates.`}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {saveErr && (
          <span style={{ ...type.label, fontFamily: font, color: semantic.dangerFg }}>
            {saveErr}
          </span>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
          }}
          placeholder="Template name"
          aria-label="Template name"
          style={{ ...field(), width: 260 }}
        />
        {selectedBlock && (
          <button
            onClick={() => save("selection")}
            disabled={busy || !name.trim()}
            title="Save only the selected section as a reusable template"
            style={{
              ...button("secondary", "md"),
              opacity: busy || !name.trim() ? 0.5 : 1,
              cursor: busy || !name.trim() ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            {busy ? "Saving…" : "Save selected section"}
          </button>
        )}
        <button
          onClick={() => save("page")}
          disabled={busy || !name.trim()}
          style={{
            ...button("accent", "md"),
            opacity: busy || !name.trim() ? 0.5 : 1,
            cursor: busy || !name.trim() ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {busy ? "Saving…" : selectedBlock ? "Save whole page" : "Save template"}
        </button>
      </div>

      {preview && (
        <PreviewModal
          t={preview}
          doc={env && env !== "pending" ? docFor(preview) : null}
          pending={env === "pending"}
          onInsert={() => insert(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
