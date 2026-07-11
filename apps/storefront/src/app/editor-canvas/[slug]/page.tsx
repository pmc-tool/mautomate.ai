"use client"

/* ------------------------------------------------------------------ */
/* Visual editor — CANVAS (iframe content)                              */
/*                                                                     */
/* Renders the page's REAL Learts blocks (no Puck, no re-styling) under */
/* the root layout's theme CSS, so it looks EXACTLY like the live store.*/
/*                                                                     */
/* Selection must not alter layout: each section is wrapped in a        */
/* `display:contents` element (generates no box, so the Bootstrap grid  */
/* is untouched) carrying data-cms-idx. Clicks are caught in the capture */
/* phase and delegated via closest(), so inner links don't navigate. The */
/* selected section is outlined by styling its rendered element directly.*/
/* Loads its own data, then accepts live edits from the parent editor.  */
/* ------------------------------------------------------------------ */

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

import {
  getCanvasTheme,
  type CanvasTheme,
} from "@modules/cms/editor/canvas-theme"
import EntranceObserver from "@modules/cms/render/EntranceObserver"
import {
  buildSectionCss,
  buildChromeCss,
  entranceAnimationOf,
  hasStyle,
  ENTRANCE_CSS,
  type AdvancedBag,
  type ChromeRegion,
  type ElementStyles,
  type StyleBag,
} from "@modules/cms/render/style-engine"
import { buildThemeDefaultsCss } from "@modules/cms/render/theme-defaults"
import { buildThemeVars } from "@modules/cms/render/theme-vars"
import type { Device } from "@modules/cms/schema/types"

type Section = { block_type: string; [k: string]: unknown }

/* Stable-enough per-section id used for the scoped CSS class + selector. Must
   match the id passed to `buildSectionCss` so `.cms-sec-<id>` lines up with the
   wrapper's className. */
const sectionId = (idx: number): string => `sec-${idx}`

/* User-authored escape-hatch values applied to the real-box section wrapper.
   Defined identically in modules/cms/section-renderer so the editor and
   production wrappers stay byte-for-byte in parity. */
function userClasses(advanced?: AdvancedBag): string {
  const v = advanced?.cssClasses
  return typeof v === "string" ? v.trim() : ""
}
function anchorIdOf(advanced?: AdvancedBag): string | undefined {
  const v = advanced?.anchorId
  if (typeof v !== "string") {
    return undefined
  }
  const t = v.trim().replace(/^#+/, "")
  return t || undefined
}

/* Parse a widget DOM marker `data-w="w-<col>-<wi>"` into its indices
   (Composer W1). Returns null for anything that doesn't match exactly. */
function parseWidgetMarker(
  v: string | null
): { col: number; wi: number } | null {
  const m = /^w-(\d+)-(\d+)$/.exec(v ?? "")
  return m ? { col: Number(m[1]), wi: Number(m[2]) } : null
}

/* Palette drag payload MIME types (Composer W3) — the shared DnD contract
   with the parent editor's palette. Same-origin iframe, so native HTML5 DnD
   events fire here while the drag source lives in the parent document. */
const BLOCK_MIME = "application/x-ff-block"
const WIDGET_MIME = "application/x-ff-widget"

/* What kind of palette drag (if any) a DataTransfer carries. During dragover
   the payload itself is protected, but `types` is always readable. */
function dragKind(dt: DataTransfer | null): "block" | "widget" | null {
  const types = Array.from(dt?.types ?? [])
  if (types.includes(BLOCK_MIME)) return "block"
  if (types.includes(WIDGET_MIME)) return "widget"
  return null
}

/* The `advanced` hide-flag key for a given previewed device. */
const HIDE_KEY: Record<Device, string> = {
  desktop: "hideOnDesktop",
  tablet: "hideOnTablet",
  mobile: "hideOnMobile",
}

/* Is this section flagged hidden on `device`? (reads its `advanced` bag) */
function isHiddenOn(block: Section, device: Device): boolean {
  const adv = block.advanced as AdvancedBag | undefined
  return !!adv && adv[HIDE_KEY[device]] === true
}

/* The element a section's hover/selection outline attaches to. An unstyled
   section is a `display:contents` wrapper (no box) so we outline its first real
   child, exactly as before; a styled section is a real box so we outline it
   directly. */
function outlineTarget(w: Element | null | undefined): HTMLElement | null {
  if (!w) {
    return null
  }
  const el = w as HTMLElement
  return el.style.display === "contents"
    ? (el.firstElementChild as HTMLElement | null)
    : el
}

/* One section, memoized so only the section whose object reference changed
   re-renders (targeted update). Unchanged sections — incl. the autoplaying
   hero — are left completely untouched while you edit. */
const SectionItem = React.memo(function SectionItem({
  idx,
  block,
  blocks,
}: {
  idx: number
  block: Section
  /** The ACTIVE theme's client block renderers (FIX 1). Stable per theme. */
  blocks: Record<string, React.ComponentType<any>>
}) {
  const Comp = blocks[block.block_type]
  // `sectionScope` mirrors production (section-renderer): the stable
  // "sec-<idx>" scope the `container` block uses to scope its per-WIDGET CSS
  // ([data-scope] on its root). Every other block ignores it.
  const inner = Comp ? (
    <Comp {...block} sectionScope={sectionId(idx)} />
  ) : (
    <LiveDataPlaceholder type={block.block_type} />
  )
  // HYBRID: a section with real style becomes a normal block box carrying the
  // scoped `cms-sec-<id>` class; a section with NO style stays `display:contents`
  // (generates no box) so the Bootstrap/Learts grid is byte-identical to today.
  const styled = hasStyle(
    block.style as StyleBag | undefined,
    block.advanced as AdvancedBag | undefined,
    block.elementStyles as ElementStyles | undefined
  )
  if (styled) {
    // Mirror production: append the user's CSS classes + set the anchor id.
    const advanced = block.advanced as AdvancedBag | undefined
    const className = [`cms-sec-${sectionId(idx)}`, userClasses(advanced)]
      .filter(Boolean)
      .join(" ")
    return (
      <div
        data-cms-idx={idx}
        id={anchorIdOf(advanced)}
        className={className}
        // Entrance-on-scroll hook (parity with section-renderer). The editor
        // triggers it normally — it is a real preview of the animation.
        data-anim={entranceAnimationOf(advanced)}
      >
        {inner}
      </div>
    )
  }
  return (
    <div data-cms-idx={idx} style={{ display: "contents" }}>
      {inner}
    </div>
  )
})

const LABELS: Record<string, string> = {}

// Owner-facing names for the on-canvas hover label.
const SECTION_LABELS: Record<string, string> = {
  hero_slider: "Hero Slider",
  promo_banner_grid: "Promo Banner Grid",
  product_tabs: "Product Tabs",
  deal_of_day: "Deal of the Day",
  category_showcase: "Category Showcase",
  brand_strip: "Brand Strip",
  rich_text: "Rich Text",
  image_with_text: "Image With Text",
  newsletter: "Newsletter",
  instagram_grid: "Instagram Grid",
  testimonials: "Testimonials",
  container: "Container / Columns",
}

/** A single button in the on-canvas floating toolbar. */
function CanvasToolBtn({
  title,
  onClick,
  children,
  disabled,
  danger,
  wide,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      style={{
        minWidth: wide ? undefined : 24,
        height: 24,
        padding: wide ? "0 8px" : 0,
        border: 0,
        borderRadius: 4,
        background: "transparent",
        color: danger ? "#b91c1c" : "#0c0d0e",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  )
}

const zoneBtn = (bg: string): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  border: 0,
  background: bg,
  color: "#fff",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
})

/** Persistent Elementor-style add-section zone: plus -> structure picker. */
function AddSectionZone({ count }: { count: number }) {
  const [view, setView] = useState<"choose" | "structure">("choose")
  const post = (msg: Record<string, unknown>) =>
    window.parent?.postMessage(msg, "*")
  return (
    <div
      style={{
        margin: "28px auto 48px",
        maxWidth: 880,
        padding: "36px 24px",
        border: "2px dashed #d5d8dc",
        borderRadius: 6,
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#fff",
      }}
    >
      {view === "choose" ? (
        <>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
            <button title="Add new section" onClick={() => setView("structure")} style={zoneBtn("#d004d4")}>
              +
            </button>
            <button title="Add template" onClick={() => post({ type: "cms:openTemplates" })} style={zoneBtn("#69727d")}>
              ▤
            </button>
          </div>
          <div style={{ fontSize: 13, fontStyle: "italic", color: "#9ca3af" }}>Drag widget here</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#515962", marginBottom: 14 }}>
            Select your structure
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                title={n + (n > 1 ? " columns" : " column")}
                onClick={() => {
                  post({ type: "cms:insertContainerAt", index: count, cols: n })
                  setView("choose")
                }}
                style={{
                  border: "1px solid #e6e8ea",
                  borderRadius: 4,
                  background: "#f9fafa",
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  gap: 3,
                }}
              >
                {Array.from({ length: n }).map((_, i) => (
                  <span
                    key={i}
                    style={{ width: Math.max(14, 60 / n), height: 34, background: "#d5d8dc", borderRadius: 2, display: "inline-block" }}
                  />
                ))}
              </button>
            ))}
          </div>
          <button
            onClick={() => setView("choose")}
            style={{ marginTop: 12, border: 0, background: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  )
}

function LiveDataPlaceholder({ type }: { type: string }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        margin: "8px auto",
        maxWidth: 1140,
        border: "1px dashed #cbd5e1",
        borderRadius: 10,
        background: "#f8fafc",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#475569",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {LABELS[type] ?? type}
      </div>
      <div style={{ fontSize: 13, marginTop: 6, color: "#94a3b8" }}>
        Shows live products on the storefront. Edit its settings in the panel.
      </div>
    </div>
  )
}

export default function EditorCanvas() {
  const params = useParams<{ slug: string }>()
  const search = useSearchParams()
  const slug = params?.slug ?? "home"
  const key = search.get("key") || ""
  const locale = search.get("locale") || "en"

  const [content, setContent] = useState<Section[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [chrome, setChrome] = useState<{
    header?: any
    topbar?: any
    footer?: any
    theme?: any
    categories?: any[]
  }>({})
  // The store's ACTIVE theme identity, resolved server-side by /api/puck/chrome
  // (same priority as the live storefront). Drives which theme chrome + block
  // renderers the canvas uses (FIX 1) and the base color/font tokens (FIX 3).
  const [activeTheme, setActiveTheme] = useState<string>("")
  const [themeTokens, setThemeTokens] = useState<any>(null)
  // The store's brand name (tenant name in multi-tenant, else "Forever Finds"),
  // resolved by /api/puck/chrome. Fed to the active theme's footer view so the
  // canvas footer copy/logo alt matches the live storefront (WYSIWYG parity).
  const [brandName, setBrandName] = useState<string>("")
  const [selectedChrome, setSelectedChrome] = useState<string | null>(null)
  // Which section the pointer is over (drives the hover outline + toolbar).
  const [hovered, setHovered] = useState<number | null>(null)
  // Edit-pencil badge over the hovered/selected [data-el] element (Elementor).
  const [elBadge, setElBadge] = useState<{ top: number; right: number; sel: boolean } | null>(null)
  // Preview mode: hide every editor affordance so the page renders clean —
  // an accurate preview of UNSAVED changes (the canvas renders live state).
  const [previewMode, setPreviewMode] = useState(false)
  // Element-level selection (E1): the specific [data-el] element inside a
  // section the user is styling, and the one currently hovered. Kept separate
  // from the section selection above so their outlines are visually distinct.
  const [selectedEl, setSelectedEl] = useState<{
    index: number
    key: string
  } | null>(null)
  const [hoveredEl, setHoveredEl] = useState<{
    index: number
    key: string
  } | null>(null)
  // Widget-level selection (Composer W1): the specific [data-w] widget inside
  // a container section being edited / hovered. Kept separate from the section
  // and element selections so its (emerald) outline is visually distinct.
  const [selectedW, setSelectedW] = useState<{
    index: number
    col: number
    wi: number
  } | null>(null)
  const [hoveredW, setHoveredW] = useState<{
    index: number
    col: number
    wi: number
  } | null>(null)
  // Chrome element-level selection (F1): the specific [data-el] element inside a
  // chrome region ([data-cms-chrome]) the user is styling / hovering. Kept
  // separate from the section element selection so their outlines don't clash.
  const [selectedChromeEl, setSelectedChromeEl] = useState<{
    region: string
    key: string
  } | null>(null)
  const [hoveredChromeEl, setHoveredChromeEl] = useState<{
    region: string
    key: string
  } | null>(null)
  // Palette drag-and-drop (Composer W3): the live section insertion indicator
  // (a horizontal line at the boundary the drop would insert at) and the
  // container column currently hot for a widget drop (inset highlight).
  const [dropLine, setDropLine] = useState<{
    index: number
    top: number
  } | null>(null)
  const [dropCol, setDropCol] = useState<{
    index: number
    col: number
    wi: number
    lineTop: number | null
    rect: { top: number; left: number; width: number; height: number }
  } | null>(null)
  // Bumped on scroll/resize/content change to re-measure overlay rects.
  const [measureTick, setMeasureTick] = useState(0)
  // The device currently previewed, derived from the iframe's own width using
  // the SAME breakpoints as the style-engine media queries (<=767 mobile,
  // <=1024 tablet, else desktop). The parent editor's Desktop/Tablet/Mobile
  // toggle resizes this iframe, so this tracks the toggle without needing a
  // dedicated message, and matches exactly which @media rules are active.
  const [device, setDevice] = useState<Device>("desktop")
  const rootRef = useRef<HTMLDivElement>(null)

  // Load the global chrome (header/topbar/footer + categories) for the full
  // page preview.
  useEffect(() => {
    let active = true
    fetch(`/api/puck/chrome?lang=${locale}&key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => {
        if (!active) return
        setChrome({
          header: d.header,
          topbar: d.topbar,
          footer: d.footer,
          theme: d.theme,
          categories: d.categories ?? [],
        })
        setActiveTheme(typeof d.active_theme === "string" ? d.active_theme : "")
        setThemeTokens(d.theme_tokens ?? null)
        setBrandName(typeof d.brand_name === "string" ? d.brand_name : "")
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [locale, key])

  // Initial load (self-sufficient so the canvas renders standalone too).
  useEffect(() => {
    let active = true
    fetch(`/api/puck/load?slug=${slug}&lang=${locale}&key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { data: { content: [] } }))
      .then((d) => {
        if (!active) return
        const items = (d?.data?.content ?? []) as { type: string; props?: Record<string, unknown> }[]
        setContent(
          items.map((c) => {
            const { id, ...rest } = c.props ?? {}
            return { block_type: c.type, ...rest }
          })
        )
      })
      .catch(() => active && setContent([]))
    return () => {
      active = false
    }
  }, [slug, locale, key])

  // Live edits + selection from the parent editor.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m !== "object") return
      // Full replace — initial load + structural changes (add/remove/reorder).
      if (m.type === "cms:data" && Array.isArray(m.content)) setContent(m.content)
      // Targeted patch — a single section edited; only that index's object is
      // replaced, so only its memoized component re-renders.
      if (m.type === "cms:patch" && typeof m.index === "number" && m.section) {
        setContent((c) =>
          c ? c.map((b, i) => (i === m.index ? (m.section as Section) : b)) : c
        )
      }
      if (m.type === "cms:previewMode") {
        setPreviewMode(!!m.on)
        setHovered(null)
        setHoveredEl(null)
        setHoveredChromeEl(null)
        setHoveredW(null)
      }
      if (m.type === "cms:select") {
        const idx = typeof m.index === "number" ? m.index : null
        setSelected(idx)
        setSelectedChrome(null)
        setSelectedEl(null) // selecting the section clears any element selection
        setSelectedChromeEl(null)
        setSelectedW(null)
        // Scroll the selected section into view (it may be off-screen).
        if (idx != null) {
          requestAnimationFrame(() => {
            const w = rootRef.current?.querySelector(`[data-cms-idx="${idx}"]`)
            outlineTarget(w)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
          })
        }
      }
      // Element-level selection driven from the parent (e.g. after "back to
      // section" clears it, or to re-focus an element). null clears it.
      if (m.type === "cms:selectElement") {
        const idx = typeof m.index === "number" ? m.index : null
        const key = typeof m.elementKey === "string" ? m.elementKey : null
        if (idx != null && key) {
          setSelectedEl({ index: idx, key })
          setSelected(null)
          setSelectedChrome(null)
          setSelectedChromeEl(null)
          setSelectedW(null)
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-idx="${idx}"] [data-el="${key}"]`
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelectedEl(null)
        }
      }
      // Chrome element-level selection driven from the parent (e.g. to re-focus
      // an element, or null to clear). Mirrors cms:selectElement for sections.
      if (m.type === "cms:selectChromeElement") {
        const region = typeof m.region === "string" ? m.region : null
        const key = typeof m.elementKey === "string" ? m.elementKey : null
        if (region && key) {
          setSelectedChromeEl({ region, key })
          setSelected(null)
          setSelectedChrome(null)
          setSelectedEl(null)
          setSelectedW(null)
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-chrome="${region}"] [data-el="${key}"]`
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelectedChromeEl(null)
        }
      }
      // Live chrome edits + chrome selection from the parent.
      if (m.type === "cms:chrome" && typeof m.key === "string") {
        setChrome((c) => ({ ...c, [m.key]: m.data }))
      }
      if (m.type === "cms:selectChrome") {
        setSelectedChrome(typeof m.key === "string" ? m.key : null)
        setSelected(null)
        setSelectedEl(null)
        setSelectedChromeEl(null)
        setSelectedW(null)
      }
      // Widget-level selection driven from the parent (Composer W1) — e.g. a
      // widget row clicked in the container's columns manager, or a freshly
      // added widget. Outlines + scrolls the [data-w] widget into view; null
      // clears it. Mirrors cms:selectElement.
      if (m.type === "cms:selectWidget") {
        const idx = typeof m.index === "number" ? m.index : null
        const col = typeof m.col === "number" ? m.col : null
        const wi = typeof m.wi === "number" ? m.wi : null
        if (idx != null && col != null && wi != null) {
          setSelectedW({ index: idx, col, wi })
          setSelected(null)
          setSelectedChrome(null)
          setSelectedEl(null)
          setSelectedChromeEl(null)
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-idx="${idx}"] [data-w="w-${col}-${wi}"]`
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelectedW(null)
        }
      }
    }
    window.addEventListener("message", onMsg)
    window.parent?.postMessage({ type: "cms:ready" }, "*")
    return () => window.removeEventListener("message", onMsg)
  }, [])

  // Outline the selected section's REAL rendered element (the display:contents
  // wrapper has no box, so we style its first element child instead).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const wrappers = root.querySelectorAll<HTMLElement>("[data-cms-idx]")
    wrappers.forEach((w) => {
      const el = outlineTarget(w)
      if (!el) return
      const idx = Number(w.dataset.cmsIdx)
      const isSel = idx === selected
      const isHov = idx === hovered && !isSel
      el.style.outline = isSel
        ? "2px solid #d004d4"
        : isHov
        ? "1px solid #f0abfc"
        : ""
      el.style.outlineOffset = isSel || isHov ? "-2px" : ""
    })
  }, [selected, hovered, content])

  // Outline the selected / hovered ELEMENT ([data-el]) inside a section. Uses a
  // distinct colour from the section outline (magenta vs blue) so element-level
  // selection reads clearly, and a lighter hover hint so [data-el] elements feel
  // clickable. Runs over every [data-el]; unmatched ones are cleared.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>("[data-el]")
    let badge: { top: number; right: number; sel: boolean } | null = null
    els.forEach((el) => {
      const w = el.closest("[data-cms-idx]") as HTMLElement | null
      const key = el.getAttribute("data-el")
      let isSel = false
      let isHov = false
      if (w) {
        // Element inside a section — matched against the section selection.
        const idx = Number(w.dataset.cmsIdx)
        isSel =
          !!selectedEl && idx === selectedEl.index && key === selectedEl.key
        isHov =
          !isSel &&
          !!hoveredEl &&
          idx === hoveredEl.index &&
          key === hoveredEl.key
      } else {
        // Element inside a chrome region ([data-cms-chrome]) — matched against
        // the chrome element selection (same magenta treatment as sections).
        const cw = el.closest("[data-cms-chrome]") as HTMLElement | null
        const region = cw?.getAttribute("data-cms-chrome") ?? null
        isSel =
          !!selectedChromeEl &&
          region === selectedChromeEl.region &&
          key === selectedChromeEl.key
        isHov =
          !isSel &&
          !!hoveredChromeEl &&
          region === hoveredChromeEl.region &&
          key === hoveredChromeEl.key
      }
      el.style.outline = isSel
        ? "2px solid #d004d4"
        : isHov
        ? "1px solid #f0abfc"
        : ""
      el.style.outlineOffset = isSel || isHov ? "-2px" : ""
      if (isSel || isHov) {
        const r = el.getBoundingClientRect()
        badge = { top: r.top, right: r.right, sel: isSel }
      }
    })
    setElBadge(badge)
  }, [selectedEl, hoveredEl, selectedChromeEl, hoveredChromeEl, content, chrome, measureTick])

  // Outline the selected / hovered WIDGET ([data-w]) inside a container
  // section (Composer W1). Uses a third distinct colour (emerald) so widget
  // selection reads clearly against sections (blue) and elements (magenta).
  // Runs over every [data-w]; unmatched ones are cleared.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>("[data-w]")
    els.forEach((el) => {
      const w = el.closest("[data-cms-idx]") as HTMLElement | null
      const parsed = parseWidgetMarker(el.getAttribute("data-w"))
      let isSel = false
      let isHov = false
      if (w && parsed) {
        const idx = Number(w.dataset.cmsIdx)
        isSel =
          !!selectedW &&
          idx === selectedW.index &&
          parsed.col === selectedW.col &&
          parsed.wi === selectedW.wi
        isHov =
          !isSel &&
          !!hoveredW &&
          idx === hoveredW.index &&
          parsed.col === hoveredW.col &&
          parsed.wi === hoveredW.wi
      }
      el.style.outline = isSel
        ? "2px solid #d004d4"
        : isHov
        ? "1px solid #f0abfc"
        : ""
      el.style.outlineOffset = isSel || isHov ? "-2px" : ""
    })
  }, [selectedW, hoveredW, content])

  // Re-measure the overlay rects when the canvas scrolls or resizes.
  useEffect(() => {
    const onMove = () => setMeasureTick((t) => t + 1)
    window.addEventListener("scroll", onMove, true)
    window.addEventListener("resize", onMove)
    return () => {
      window.removeEventListener("scroll", onMove, true)
      window.removeEventListener("resize", onMove)
    }
  }, [])

  // Track the previewed device from the iframe's own viewport width.
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      setDevice(w <= 767 ? "mobile" : w <= 1024 ? "tablet" : "desktop")
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [])

  // After content or device changes, force a post-commit re-measure so the
  // hidden-section badges (and the toolbar overlay) read fresh DOM rects.
  useEffect(() => {
    setMeasureTick((t) => t + 1)
  }, [content, device])

  // Forward undo/redo keystrokes to the parent editor (keyboard focus can be
  // inside this iframe). Ignore when typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== "z") return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return
      e.preventDefault()
      window.parent?.postMessage(
        { type: e.shiftKey ? "cms:redo" : "cms:undo" },
        "*"
      )
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // The section the overlay toolbar attaches to: hovered, else selected.
  const activeIdx = hovered != null ? hovered : selected
  const activeRect = useMemo<DOMRect | null>(() => {
    if (activeIdx == null || !rootRef.current) return null
    const w = rootRef.current.querySelector(`[data-cms-idx="${activeIdx}"]`)
    const el = outlineTarget(w)
    return el ? el.getBoundingClientRect() : null
    // measureTick forces a re-measure on scroll/resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, content, measureTick])

  // Scoped per-section CSS for every styled section, generated by the SAME
  // engine as production (section-renderer) so editor and live can never drift.
  // `buildSectionCss` returns "" for un-styled sections, so this is empty today
  // (nothing writes style/advanced yet) and the page stays byte-identical.
  const sectionCss = useMemo(() => {
    if (!content) return ""
    return content
      .map((block, i) =>
        buildSectionCss(
          sectionId(i),
          block.style as StyleBag | undefined,
          block.advanced as AdvancedBag | undefined,
          block.elementStyles as ElementStyles | undefined
        )
      )
      .join("")
  }, [content])

  // Entrance-on-scroll (F3): mount the observer + static CSS only when some
  // section actually uses an entrance animation, exactly like production
  // (section-renderer). Animations trigger normally in the editor — it is a
  // real preview. `content` is passed as the observer's `watch` so newly added
  // or re-rendered [data-anim] wrappers are re-observed (never stuck hidden).
  const hasEntrance = useMemo(() => {
    if (!content) return false
    return content.some(
      (block) => !!entranceAnimationOf(block.advanced as AdvancedBag | undefined)
    )
  }, [content])

  // Scoped per-region chrome CSS (header / top bar / footer), generated by the
  // SAME engine as production so editor and live can never drift. Scopes to the
  // stable `.cms-chrome-<region>` class + `[data-el]` descendants. Returns "" for
  // un-styled regions, so this is empty when no chrome style is set and the
  // header/footer stay byte-identical to today.
  const chromeCss = useMemo(() => {
    const regions: ChromeRegion[] = ["topbar", "header", "footer"]
    return regions
      .map((region) => {
        const c = (chrome as Record<string, any>)[region]
        if (!c) return ""
        return buildChromeCss(
          region,
          c.style as StyleBag | undefined,
          c.advanced as AdvancedBag | undefined,
          c.elementStyles as ElementStyles | undefined
        )
      })
      .join("")
  }, [chrome])

  // Site-wide component defaults (F2b) — same low-specificity base layer the
  // root layout emits in production. "" when the owner set none.
  const themeDefaultsCss = useMemo(
    () => (chrome.theme ? buildThemeDefaultsCss(chrome.theme) : ""),
    [chrome]
  )

  // The ACTIVE theme's client chrome + block renderers (FIX 1). Resolved by id
  // from the client-safe canvas registry (falls back to Learts for unknown ids,
  // exactly like getThemeById on the server). Stable per theme, so passing
  // `canvasTheme.blocks` to each memoized SectionItem doesn't cause re-renders.
  const canvasTheme: CanvasTheme = useMemo(
    () => getCanvasTheme(activeTheme),
    [activeTheme]
  )

  // Theme color/font vars (FIX 3): the active theme's manifest tokens are the
  // base palette; CMS `theme` overrides only where the owner customized. Built
  // by the SAME shared helper the root layout uses, so the two stay identical.
  const themeVars = useMemo(
    () => buildThemeVars(chrome.theme, themeTokens),
    [chrome.theme, themeTokens]
  )

  // Editor-only visibility override. The shared style-engine injects a real
  // `display:none` for the section hidden on the CURRENT width (its @media rule
  // is the only hide active at this width). In the EDITOR we must keep it
  // selectable, so we neutralize that `display:none` with an `!important`
  // override and dim the box instead — production (section-renderer) keeps the
  // real `display:none`.
  const hiddenCss = useMemo(() => {
    if (!content) return ""
    return content
      .map((block, i) =>
        isHiddenOn(block, device)
          ? `.cms-sec-${sectionId(i)}{display:block!important;opacity:.4!important}`
          : ""
      )
      .join("")
  }, [content, device])

  // Rects for every section hidden on the previewed device, so we can render a
  // "Hidden on <device>" badge over each (measured like the toolbar overlay).
  const hiddenBadges = useMemo<{ idx: number; rect: DOMRect }[]>(() => {
    if (!content || !rootRef.current) return []
    const root = rootRef.current
    const out: { idx: number; rect: DOMRect }[] = []
    content.forEach((block, i) => {
      if (!isHiddenOn(block, device)) return
      const el = outlineTarget(root.querySelector(`[data-cms-idx="${i}"]`))
      if (el) out.push({ idx: i, rect: el.getBoundingClientRect() })
    })
    return out
    // measureTick forces a re-measure on scroll/resize/content/device change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, device, measureTick])

  // Preview mode: strip every editor outline once so the page renders clean.
  useEffect(() => {
    if (!previewMode) return
    const root = rootRef.current
    if (!root) return
    root
      .querySelectorAll<HTMLElement>("[data-cms-idx],[data-el],[data-w],[data-cms-chrome]")
      .forEach((el) => {
        el.style.outline = ""
        el.style.outlineOffset = ""
      })
  }, [previewMode, content])

  const handleMouseMove = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    // Pointer over the floating toolbar overlay: keep the current hover instead
    // of clearing it (clearing unmounts the toolbar under the cursor -> blink).
    if (t.closest?.("[data-cms-overlay]")) return
    if (previewMode) return
    const w = t.closest("[data-cms-idx]") as HTMLElement | null
    const idx = w ? Number(w.dataset.cmsIdx) : null
    setHovered((h) => (h === idx ? h : idx))
    // Track the hovered [data-el] element (within a section) for its outline.
    const elw = t.closest("[data-el]") as HTMLElement | null
    const key = elw?.getAttribute("data-el") ?? null
    const elIdx =
      elw && idx != null && w?.contains(elw) ? idx : null
    setHoveredEl((h) => {
      if (elIdx == null || !key) return h == null ? h : null
      return h && h.index === elIdx && h.key === key ? h : { index: elIdx, key }
    })
    // Track the hovered [data-el] element inside a chrome region ([data-cms-chrome]
    // but NOT inside a section) for its outline.
    const cw = elw && !w ? (t.closest("[data-cms-chrome]") as HTMLElement | null) : null
    const region = cw?.getAttribute("data-cms-chrome") ?? null
    setHoveredChromeEl((h) => {
      if (!region || !key || !cw?.contains(elw!)) return h == null ? h : null
      return h && h.region === region && h.key === key ? h : { region, key }
    })
    // Track the hovered [data-w] widget (within a section) for its outline.
    const ww = t.closest("[data-w]") as HTMLElement | null
    const wParsed =
      ww && idx != null && w?.contains(ww)
        ? parseWidgetMarker(ww.getAttribute("data-w"))
        : null
    setHoveredW((h) => {
      if (!wParsed || idx == null) return h == null ? h : null
      return h &&
        h.index === idx &&
        h.col === wParsed.col &&
        h.wi === wParsed.wi
        ? h
        : { index: idx, col: wParsed.col, wi: wParsed.wi }
    })
  }

  // Fire a canvas toolbar action up to the parent editor.
  const canvasAction = (action: string, index: number) =>
    window.parent?.postMessage({ type: "cms:action", action, index }, "*")

  /* ------------- Palette drag-and-drop (Composer W3) ------------- */

  // Where a section dropped at `clientY` would insert: before the first
  // section whose midpoint the pointer is above (0..N). `top` is the viewport
  // Y of that boundary, for the indicator line.
  const computeInsertion = (clientY: number): { index: number; top: number } => {
    const root = rootRef.current
    const wrappers = root
      ? Array.from(root.querySelectorAll<HTMLElement>("[data-cms-idx]"))
      : []
    let lastBottom = 0
    let count = 0
    for (const w of wrappers) {
      const el = outlineTarget(w)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        return { index: Number(w.dataset.cmsIdx), top: rect.top }
      }
      lastBottom = rect.bottom
      count = Number(w.dataset.cmsIdx) + 1
    }
    return { index: count, top: lastBottom }
  }

  // The container column (and its section) under a dragged widget card, read
  // from the dragover/drop target via the data-col marker Container renders.
  const columnAt = (
    target: EventTarget | null
  ): { index: number; col: number; el: HTMLElement } | null => {
    const t = target as HTMLElement | null
    const colEl = t?.closest?.("[data-col]") as HTMLElement | null
    const secEl = colEl?.closest("[data-cms-idx]") as HTMLElement | null
    if (!colEl || !secEl) return null
    const index = Number(secEl.dataset.cmsIdx)
    const col = Number(colEl.dataset.col)
    if (!Number.isInteger(index) || !Number.isInteger(col)) return null
    return { index, col, el: colEl }
  }

  /** Insertion position within a column: before the first widget whose
   *  midpoint the pointer is above (Elementor-style). */
  const widgetInsertPos = (colEl: HTMLElement, clientY: number) => {
    const kids = Array.from(colEl.querySelectorAll<HTMLElement>(":scope > [data-w]"))
    let wi = kids.length
    let lineTop: number | null =
      kids.length === 0 ? null : colEl.getBoundingClientRect().top + 4
    for (let i = 0; i < kids.length; i++) {
      const kr = kids[i].getBoundingClientRect()
      if (clientY < kr.top + kr.height / 2) {
        wi = i
        lineTop = kr.top
        break
      }
      lineTop = kr.bottom
    }
    return { wi, lineTop }
  }

  /** Small dark chip as the drag image (WS5 polish). */
  const setDragGhost = (e: React.DragEvent, label: string) => {
    try {
      const el = document.createElement("div")
      el.textContent = label
      Object.assign(el.style, {
        position: "fixed", top: "-1000px", left: "-1000px", padding: "6px 12px",
        background: "#26292c", color: "#fff", font: "600 12px system-ui, sans-serif",
        borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      })
      document.body.appendChild(el)
      e.dataTransfer.setDragImage(el, 12, 12)
      setTimeout(() => document.body.removeChild(el), 0)
    } catch {}
  }

  const clearDropHints = () => {
    setDropLine((d) => (d == null ? d : null))
    setDropCol((d) => (d == null ? d : null))
  }

  const handleDragOver = (e: React.DragEvent) => {
    const kind = dragKind(e.dataTransfer)
    if (!kind) return
    // Required so the browser fires `drop` on this target.
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    // Edge auto-scroll while dragging (WS5): tall pages stay reachable.
    if (e.clientY < 70) window.scrollBy(0, -18)
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 18)
    if (kind === "block") {
      setDropCol((d) => (d == null ? d : null))
      const pos = computeInsertion(e.clientY)
      setDropLine((d) =>
        d && d.index === pos.index && d.top === pos.top ? d : pos
      )
      return
    }
    // Widget drag: container columns are the primary target; anywhere else
    // acts like a section drop — the widget auto-wraps in a new container.
    const hit = columnAt(e.target)
    if (!hit) {
      setDropCol((d) => (d == null ? d : null))
      const pos = computeInsertion(e.clientY)
      setDropLine((d) =>
        d && d.index === pos.index && d.top === pos.top ? d : pos
      )
      return
    }
    setDropLine((d) => (d == null ? d : null))
    setDropCol(() => {
      const r = hit.el.getBoundingClientRect()
      const pos = widgetInsertPos(hit.el, e.clientY)
      return {
        index: hit.index,
        col: hit.col,
        wi: pos.wi,
        lineTop: pos.lineTop,
        rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      }
    })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when the drag actually leaves the canvas root (dragleave also
    // fires on every internal element boundary).
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    clearDropHints()
  }

  const handleDrop = (e: React.DragEvent) => {
    const kind = dragKind(e.dataTransfer)
    if (!kind) return
    e.preventDefault()
    e.stopPropagation()
    try {
      if (kind === "block") {
        const payload = JSON.parse(e.dataTransfer.getData(BLOCK_MIME) || "{}")
        const pos = computeInsertion(e.clientY)
        if (typeof payload.reorderFrom === "number") {
          const to = payload.reorderFrom < pos.index ? pos.index - 1 : pos.index
          window.parent?.postMessage(
            { type: "cms:moveSection", from: payload.reorderFrom, to },
            "*"
          )
        } else if (typeof payload.block_type === "string" && payload.block_type) {
          window.parent?.postMessage(
            {
              type: "cms:insertAt",
              index: pos.index,
              block_type: payload.block_type,
              ...(typeof payload.presetIndex === "number"
                ? { presetIndex: payload.presetIndex }
                : {}),
            },
            "*"
          )
        }
      } else {
        const payload = JSON.parse(e.dataTransfer.getData(WIDGET_MIME) || "{}")
        const hit = columnAt(e.target)
        const target = hit
          ? { index: hit.index, col: hit.col, wi: widgetInsertPos(hit.el, e.clientY).wi }
          : dropCol
        if (
          target &&
          typeof payload.widget_type === "string" &&
          payload.widget_type
        ) {
          window.parent?.postMessage(
            {
              type: "cms:insertWidgetAt",
              index: target.index,
              col: target.col,
              wi: target.wi,
              widget_type: payload.widget_type,
            },
            "*"
          )
        } else if (
          typeof payload.widget_type === "string" &&
          payload.widget_type
        ) {
          // No column under the drop: auto-wrap the widget in a new 1-column
          // container at this position (Elementor drop-anywhere).
          const pos = computeInsertion(e.clientY)
          window.parent?.postMessage(
            {
              type: "cms:insertWidgetAsSection",
              index: pos.index,
              widget_type: payload.widget_type,
            },
            "*"
          )
        }
      }
    } catch {
      // Malformed payload — ignore the drop.
    }
    clearDropHints()
  }

  const handleClickCapture = (e: React.MouseEvent) => {
    if (previewMode) {
      e.preventDefault()
      return
    }
    const t = e.target as HTMLElement
    const bodyEl = t.closest("[data-cms-idx]") as HTMLElement | null
    const chromeEl = t.closest("[data-cms-chrome]") as HTMLElement | null

    // WIDGET-LEVEL (Composer W1): a click inside a [data-w] widget WITHIN a
    // container section selects that widget for editing — highest priority,
    // above the element/link handling below, so e.g. a button widget (an
    // <a data-w="w-0-1">) is selectable without navigating.
    const wEl = t.closest("[data-w]") as HTMLElement | null
    if (wEl && bodyEl && bodyEl.contains(wEl)) {
      const parsed = parseWidgetMarker(wEl.getAttribute("data-w"))
      if (parsed) {
        e.preventDefault()
        e.stopPropagation()
        const idx = Number(bodyEl.dataset.cmsIdx)
        setSelectedW({ index: idx, col: parsed.col, wi: parsed.wi })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedEl(null)
        setSelectedChromeEl(null)
        window.parent?.postMessage(
          { type: "cms:clickedWidget", index: idx, col: parsed.col, wi: parsed.wi },
          "*"
        )
        return
      }
    }

    // ELEMENT-LEVEL (E1): a click inside a [data-el] element WITHIN a section
    // selects that element for styling instead of the section — and takes
    // priority over the link/section handling below, so e.g. the hero button
    // (an <a data-el="button">) is selectable without navigating.
    const elEl = t.closest("[data-el]") as HTMLElement | null
    if (elEl && bodyEl && bodyEl.contains(elEl)) {
      e.preventDefault()
      e.stopPropagation()
      const idx = Number(bodyEl.dataset.cmsIdx)
      const elementKey = elEl.getAttribute("data-el") || ""
      if (elementKey) {
        setSelectedEl({ index: idx, key: elementKey })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedChromeEl(null)
        setSelectedW(null)
        window.parent?.postMessage(
          { type: "cms:clickedElement", index: idx, elementKey },
          "*"
        )
        return
      }
    }

    // CHROME ELEMENT-LEVEL (F1): a click inside a [data-el] element WITHIN a
    // chrome region ([data-cms-chrome]) selects that element for styling — same
    // priority as section elements (above the link/region handling below), so
    // e.g. clicking a nav item styles the "menu" element instead of navigating.
    if (elEl && chromeEl && chromeEl.contains(elEl)) {
      e.preventDefault()
      e.stopPropagation()
      const region = chromeEl.getAttribute("data-cms-chrome") || ""
      const elementKey = elEl.getAttribute("data-el") || ""
      if (region && elementKey) {
        setSelectedChromeEl({ region, key: elementKey })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedEl(null)
        setSelectedW(null)
        window.parent?.postMessage(
          { type: "cms:clickedChromeElement", region, elementKey },
          "*"
        )
        return
      }
    }

    // Clicking a real link (e.g. a header nav item) asks the parent to open that
    // page for editing if it's a CMS page — otherwise the parent falls back to
    // selecting the containing section/chrome so the click is never dead.
    const anchor = t.closest("a") as HTMLAnchorElement | null
    const href = anchor?.getAttribute("href")
    if (anchor && href && href !== "#") {
      e.preventDefault()
      e.stopPropagation()
      window.parent?.postMessage(
        {
          type: "cms:linkClick",
          href,
          index: bodyEl ? Number(bodyEl.dataset.cmsIdx) : null,
          chromeKey: chromeEl?.getAttribute("data-cms-chrome") ?? null,
        },
        "*"
      )
      return
    }

    if (bodyEl) {
      e.preventDefault()
      e.stopPropagation()
      const idx = Number(bodyEl.dataset.cmsIdx)
      setSelected(idx)
      setSelectedChrome(null)
      setSelectedEl(null)
      setSelectedChromeEl(null)
      setSelectedW(null)
      window.parent?.postMessage({ type: "cms:clicked", index: idx }, "*")
      return
    }
    if (chromeEl) {
      e.preventDefault()
      e.stopPropagation()
      const k = chromeEl.getAttribute("data-cms-chrome")
      setSelectedChrome(k)
      setSelected(null)
      setSelectedEl(null)
      setSelectedChromeEl(null)
      setSelectedW(null)
      window.parent?.postMessage({ type: "cms:clickedChrome", key: k }, "*")
    }
  }

  if (!content) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading…</div>
  }

  const chromeOutline = (k: string): React.CSSProperties | undefined =>
    selectedChrome === k ? { outline: "2px solid #d004d4", outlineOffset: -2 } : undefined

  const activeBlock =
    activeIdx != null && content[activeIdx] ? content[activeIdx] : null

  // The active theme's client header component (FIX 1).
  const ThemeHeader = canvasTheme.Header
  // The active theme's client footer view — the presentational half of its
  // async server footer, fed the chrome data the canvas already has. Learts
  // maps to the shared CanvasFooter (brand is ignored there).
  const ThemeFooter = canvasTheme.Footer

  return (
    <div
      ref={rootRef}
      onClickCapture={handleClickCapture}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHovered(null)
        setHoveredEl(null)
        setHoveredChromeEl(null)
        setHoveredW(null)
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ cursor: previewMode ? "default" : "pointer" }}
    >
      {/* Live theme tokens — the active theme's base palette + owner overrides;
          editing colors/fonts cascades instantly. Emitted once the chrome load
          resolves the active theme (FIX 3). */}
      {themeTokens || chrome.theme ? (
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
      ) : null}

      {/* Site-wide component defaults (F2b) — same low-specificity base layer
          the root layout emits in production. "" when the owner set none. */}
      {themeDefaultsCss ? (
        <style dangerouslySetInnerHTML={{ __html: themeDefaultsCss }} />
      ) : null}

      {/* Per-section scoped style (base + responsive @media), generated by the
          shared style-engine. Empty today, so it renders nothing. */}
      {sectionCss ? (
        <style dangerouslySetInnerHTML={{ __html: sectionCss }} />
      ) : null}

      {/* Entrance-on-scroll (F3): static CSS + observer, only when a section
          uses it. No-JS-safe: hiding is gated on the observer's html.ff-io. */}
      {hasEntrance ? (
        <>
          <style dangerouslySetInnerHTML={{ __html: ENTRANCE_CSS }} />
          <EntranceObserver watch={content} />
        </>
      ) : null}

      {/* Per-region scoped chrome style (header/topbar/footer), generated by the
          shared style-engine. Empty today, so it renders nothing. */}
      {chromeCss ? (
        <style dangerouslySetInnerHTML={{ __html: chromeCss }} />
      ) : null}

      {/* Editor-only: undo the style-engine's real display:none for sections
          hidden on the previewed device, so the author can still select them
          (they render dimmed + badged instead). Never emitted in production. */}
      {hiddenCss ? (
        <style dangerouslySetInnerHTML={{ __html: hiddenCss }} />
      ) : null}

      {/* "Hidden on <device>" badges over each section hidden at this size. */}
      {hiddenBadges.length ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147482000,
            pointerEvents: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {hiddenBadges.map(({ idx, rect }) => (
            <div
              key={`cms-hidden-${idx}`}
              style={{
                position: "absolute",
                top: Math.max(2, rect.top + 6),
                left: Math.max(6, rect.left + 6),
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#7c3aed",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              <span aria-hidden>⦸</span>
              Hidden on {device}
            </div>
          ))}
        </div>
      ) : null}

      {/* Palette drag (W3): insertion indicator line at the boundary a dropped
          section would insert at. Suppressed on an empty page — the empty-state
          drop target below lights up instead. */}
      {dropLine && content.length > 0 ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483200,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: Math.max(0, dropLine.top - 1.5),
              transition: "top 90ms ease",
              left: 0,
              right: 0,
              height: 3,
              borderRadius: 2,
              background: "#2563eb",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.65), 0 1px 6px rgba(37,99,235,0.55)",
              transition: "top 120ms ease",
            }}
          />
        </div>
      ) : null}

      {/* Palette drag (W3): inset highlight over the container column a
          dragged widget card would drop into (emerald = widget colour). */}
      {dropCol ? (
        <div
          style={{
            position: "fixed",
            top: dropCol.rect.top,
            left: dropCol.rect.left,
            width: dropCol.rect.width,
            height: dropCol.rect.height,
            zIndex: 2147483200,
            pointerEvents: "none",
            outline: "2px solid #d004d4",
            outlineOffset: -2,
            background: "rgba(208, 4, 212, 0.05)",
            borderRadius: 4,
          }}
        />
      ) : null}
      {dropCol && dropCol.lineTop != null ? (
        <div
          style={{
            position: "fixed",
            top: dropCol.lineTop - 1.5,
            left: dropCol.rect.left + 6,
            width: dropCol.rect.width - 12,
            height: 3,
            borderRadius: 2,
            background: "#d004d4",
            boxShadow: "0 0 8px rgba(208, 4, 212, 0.5)",
            zIndex: 2147483201,
            pointerEvents: "none",
            transition: "top 90ms ease",
          }}
        />
      ) : null}

      {/* On-canvas hover/selection overlay: section label + floating toolbar. */}
      {!previewMode && activeRect && activeIdx != null && activeBlock ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483000,
            pointerEvents: "none",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: Math.max(0, activeRect.top),
              left: Math.max(0, activeRect.left),
              transform: "translateY(-100%)",
              background: "#f0abfc",
              color: "#0c0d0e",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: "4px 4px 0 0",
              whiteSpace: "nowrap",
            }}
          >
            {SECTION_LABELS[activeBlock.block_type] ?? activeBlock.block_type}
          </div>
          <div
            data-cms-overlay="1"
            style={{
              position: "absolute",
              top: Math.max(2, activeRect.top - 13),
              left: activeRect.left + activeRect.width / 2,
              transform: "translateX(-50%)",
              display: "flex",
              gap: 2,
              background: "#f0abfc",
              borderRadius: 3,
              padding: 3,
              pointerEvents: "auto",
              boxShadow: "0 2px 10px rgba(0,0,0,0.28)",
            }}
          >
            <div
              draggable
              title="Drag to reorder"
              onDragStart={(e) => {
                e.dataTransfer.setData(BLOCK_MIME, JSON.stringify({ reorderFrom: activeIdx }))
                e.dataTransfer.effectAllowed = "move"
                setDragGhost(e, SECTION_LABELS[activeBlock.block_type] ?? activeBlock.block_type)
              }}
              style={{ display: "flex", alignItems: "center", padding: "0 5px", color: "#0c0d0e", fontSize: 14, cursor: "grab", userSelect: "none" }}
            >
              ⠿
            </div>
            <CanvasToolBtn
              title="Move up"
              disabled={activeIdx === 0}
              onClick={() => canvasAction("up", activeIdx)}
            >
              ↑
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Move down"
              disabled={activeIdx === content.length - 1}
              onClick={() => canvasAction("down", activeIdx)}
            >
              ↓
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Duplicate"
              onClick={() => canvasAction("duplicate", activeIdx)}
            >
              ⧉
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Edit"
              wide
              onClick={() => canvasAction("edit", activeIdx)}
            >
              Edit
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Add section below"
              onClick={() => canvasAction("addBelow", activeIdx)}
            >
              +
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Delete"
              danger
              onClick={() => canvasAction("delete", activeIdx)}
            >
              ✕
            </CanvasToolBtn>
          </div>
        </div>
      ) : null}

      {!previewMode && elBadge ? (
        <div
          style={{
            position: "fixed",
            top: Math.max(0, elBadge.top),
            left: elBadge.right,
            transform: "translate(-100%, -100%)",
            zIndex: 2147483100,
            pointerEvents: "none",
            background: elBadge.sel ? "#d004d4" : "#f0abfc",
            color: elBadge.sel ? "#fff" : "#0c0d0e",
            width: 20,
            height: 20,
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          }}
        >
          ✎
        </div>
      ) : null}
      {/* Header (editable chrome) — the ACTIVE theme's own client header, so the
          canvas chrome matches the live storefront for this store's theme. */}
      <div data-cms-chrome="header" style={chromeOutline("header")}>
        <ThemeHeader
          cartCount={0}
          categories={(chrome.categories ?? []) as any}
          topbar={chrome.topbar ?? null}
          header={chrome.header ?? null}
          locale={locale === "bn" ? "bn" : "en"}
        />
      </div>

      {/* Page body — under the active theme's body className (FIX 1). */}
      <div className={canvasTheme.bodyClassName}>
        {content.map((block, i) => (
          <SectionItem key={i} idx={i} block={block} blocks={canvasTheme.blocks} />
        ))}
        {!previewMode && (
        <style>{`
          .ff-container-col:empty {
            min-height: 84px;
            border: 1px dashed #babfc5;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(240, 171, 252, 0.05);
          }
          .ff-container-col:empty::after {
            content: "Drag widget here";
            font: italic 500 12px system-ui, sans-serif;
            color: #9ca3af;
          }
        `}</style>
        )}
        {content.length === 0 && (
          <div
            style={{
              margin: "56px auto",
              maxWidth: 720,
              padding: "72px 32px",
              textAlign: "center",
              fontFamily: "system-ui, sans-serif",
              border: `2px dashed ${dropLine ? "#2563eb" : "#cbd5e1"}`,
              borderRadius: 12,
              background: dropLine ? "#eff6ff" : "#f8fafc",
              color: dropLine ? "#1d4ed8" : "#64748b",
              fontSize: 14,
              fontWeight: 600,
              transition:
                "border-color 120ms ease, background 120ms ease, color 120ms ease",
            }}
          >
            Drag a section here — or use + Add section
          </div>
        )}
        {!previewMode && <AddSectionZone count={content.length} />}
      </div>

      {/* Footer (editable chrome) — the ACTIVE theme's own client footer view,
          so the canvas footer matches the live storefront for this theme. */}
      {chrome.footer ? (
        <div data-cms-chrome="footer" style={chromeOutline("footer")}>
          <ThemeFooter
            footer={chrome.footer}
            categories={chrome.categories}
            brand={brandName || "Your store"}
          />
        </div>
      ) : null}
    </div>
  )
}
