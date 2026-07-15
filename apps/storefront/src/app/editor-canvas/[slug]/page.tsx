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
  accent,
  canvas as canvasTokens,
  chip,
  eyebrow,
  font,
  grey,
  hairline,
  ink,
  menuItem,
  motion,
  radius,
  semantic,
  shadow,
  surface,
  type,
} from "@modules/cms/editor/design"
import { UiIcon } from "@modules/cms/editor/palette-icons"
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

/* Parse a widget DOM marker into its PATH — the chain of (column, widget)
   indices from the section down to the widget. "w-0-1" is column 0 / widget 1;
   "w-0-1-2-3" is the widget at column 2 / index 3 INSIDE the inner section at
   column 0 / index 1. Always an even-length array. Null for anything else. */
function parseWidgetPath(v: string | null): number[] | null {
  const s = v ?? ""
  if (!/^w-\d+(?:-\d+)+$/.test(s)) return null
  const nums = s.slice(2).split("-").map(Number)
  if (nums.length < 2 || nums.length % 2 !== 0) return null
  return nums.every((n) => Number.isInteger(n) && n >= 0) ? nums : null
}

/* Back-compat shim: the first (column, widget) pair. */
function parseWidgetMarker(
  v: string | null
): { col: number; wi: number } | null {
  const p = parseWidgetPath(v)
  return p ? { col: p[0], wi: p[1] } : null
}

/* Parse a column marker `data-col="0"` (top level) or `data-col="0-1-2"`
   (column 2 of the inner section at column 0 / widget 1). */
function parseColPath(v: string | null): number[] | null {
  const s = (v ?? "").trim()
  if (!/^\d+(?:-\d+)*$/.test(s)) return null
  const nums = s.split("-").map(Number)
  // A column path is odd-length: [c] or [c, wi, c2] …
  if (!nums.length || nums.length % 2 === 0) return null
  return nums.every((n) => Number.isInteger(n) && n >= 0) ? nums : null
}

/** Is this widget path inside an inner section? (deeper than one level) */
const isNestedPath = (p: number[]) => p.length > 2

/* Parse a repeated-item DOM marker `data-el-item="<arrayProp>:<index>"` —
   the slide / banner tile / testimonial the cursor is inside, carried as the
   section prop array's name plus the item's ORIGINAL index in that array. */
function parseItemMarker(
  v: string | null
): { field: string; index: number } | null {
  const m = /^([A-Za-z_][A-Za-z0-9_]*):(\d+)$/.exec(v ?? "")
  return m ? { field: m[1], index: Number(m[2]) } : null
}

/* Owner-facing name for one item of a repeatable array prop. */
const ITEM_LABELS: Record<string, string> = {
  slides: "Slide",
  categories: "Banner",
  items: "Item",
  brands: "Brand",
  images: "Image",
  tabs: "Tab",
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
  // COMPUTED, not inline: the empty-section placeholder below overrides the
  // inline display:contents with a real box, and an inline-only check would
  // never see it — leaving the section unselectable exactly as before.
  const isContents =
    typeof window !== "undefined" &&
    getComputedStyle(el).display === "contents"
  let target: HTMLElement | null = isContents
    ? (el.firstElementChild as HTMLElement | null)
    : el

  // A wrapper can ALSO collapse to zero height without being display:contents —
  // when everything inside it is out of flow (the hero slider's absolutely
  // positioned slides, the deal-of-day's floated media). The section is plainly
  // there on screen, but the box we were outlining measured 1500x0 — so there
  // was nothing to hover, nothing to click, and the toolbar had nowhere to sit.
  // That is why some sections simply could not be selected at all.
  //
  // If the chosen target has no height, fall back to the tallest real child. A
  // <style> tag is never a target (it is the first child of every styled block
  // and has no box).
  const heightOf = (n: Element | null) =>
    n ? Math.round(n.getBoundingClientRect().height) : 0

  if (heightOf(target) === 0) {
    let best: HTMLElement | null = null
    let bestH = 0
    for (const child of Array.from(el.children)) {
      if (child.tagName === "STYLE") {
        continue
      }
      const h = heightOf(child)
      if (h > bestH) {
        bestH = h
        best = child as HTMLElement
      }
    }
    if (best) {
      target = best
    }
  }

  return target
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
  image_gallery: "Image Gallery",
  container: "Container / Columns",
}

/* Leading icon for each right-click menu action. A row without one is a row you
   have to READ; with one you recognise it, which is the whole point of a menu
   you open a hundred times a day. */
const CTX_ICONS: Record<string, string> = {
  edit: "brush",
  duplicate: "duplicate",
  duplicateItem: "duplicate",
  copy: "copy",
  paste: "paste",
  copyStyle: "brush",
  pasteStyle: "paste",
  resetStyle: "reset",
  delete: "trash",
  deleteItem: "trash",
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
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = danger
            ? semantic.dangerBg
            : ink.text
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = danger
          ? semantic.dangerBorder
          : ink.muted
      }}
      style={{
        ...type.label,
        fontFamily: font,
        minWidth: wide ? undefined : 24,
        height: 24,
        padding: wide ? "0 8px" : 0,
        border: 0,
        borderRadius: radius.sm,
        background: "transparent",
        color: danger ? semantic.dangerBorder : ink.muted,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
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
  borderRadius: radius.pill,
  border: 0,
  background: bg,
  color: accent.on,
  cursor: "pointer",
  boxShadow: shadow.sm,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
})


/**
 * The add-section affordance, BETWEEN sections.
 *
 * `AddSectionZone` only exists once, after the last section. On a real page —
 * thirty-odd sections, ~18,000px — that is somewhere below the footer, and a
 * merchant who wants a section in the MIDDLE of their page has no way to say so:
 * they add at the bottom and then drag it up past thirty neighbours.
 *
 * So every seam between sections gets its own insert bar: invisible until you
 * approach it, then a line with the same two doors as the zone at the bottom —
 * a plus for a fresh container, a template icon for a saved layout — both
 * inserting AT THIS SEAM.
 */
function SectionInsertBar({ index }: { index: number }) {
  const [hot, setHot] = useState(false)
  const [structure, setStructure] = useState(false)
  const post = (msg: Record<string, unknown>) =>
    window.parent?.postMessage(msg, "*")

  const dot = (bg: string): React.CSSProperties => ({
    border: 0,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    background: bg,
    color: accent.on,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadow.sm,
    pointerEvents: "auto",
  })

  return (
    // ZERO HEIGHT, always. The first version grew from 12px to 34px on hover —
    // which reflowed every section below it, so the page visibly jumped as the
    // pointer crossed a seam. An affordance must never move the thing it is
    // pointing at. The hit strip and the buttons are therefore absolutely
    // positioned OUT of flow, and the seam itself occupies no space.
    <div style={{ position: "relative", height: 0 }}>
      <div
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => {
          setHot(false)
          setStructure(false)
        }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -11,
          height: 22,
          // Under the section toolbar (2147483100) on purpose: where they
          // overlap, the toolbar you are already using stays on top.
          zIndex: 2147482000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
        }}
      >
        {hot ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 10,
                height: 2,
                background: accent.base,
                opacity: 0.3,
              }}
            />
            {!structure ? (
              // CENTRED. The section below owns both ends of its top edge — the
              // name badge sits top-LEFT, the toolbar (Edit / duplicate / delete)
              // top-RIGHT. Offsetting left dodged the toolbar and landed straight
              // on the badge. The middle is the only lane nothing else claims.
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 6,
                  pointerEvents: "auto",
                }}
              >
                <button
                  title="Add a section here"
                  onClick={() => {
                    // Arm this seam. Whatever the merchant reaches for next — a
                    // column structure below, or a section from the Elements
                    // palette — lands HERE, not at the bottom of the page.
                    post({ type: "cms:setAddTarget", index })
                    setStructure(true)
                  }}
                  style={dot(accent.base)}
                >
                  <UiIcon name="plus" size={14} />
                </button>
                <button
                  title="Insert a template here"
                  onClick={() => post({ type: "cms:openTemplates", at: index })}
                  style={dot(grey[60])}
                >
                  <UiIcon name="template" size={14} />
                </button>
              </div>
            ) : (
              <div
                style={{
                  ...surface("md"),
                  position: "relative",
                  display: "flex",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: radius.md,
                  pointerEvents: "auto",
                }}
              >
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    title={`${n} column${n > 1 ? "s" : ""}`}
                    onClick={() => {
                      post({ type: "cms:insertContainerAt", index, cols: n })
                      setStructure(false)
                    }}
                    style={{
                      border: hairline,
                      borderRadius: radius.sm,
                      background: grey[5],
                      padding: 4,
                      cursor: "pointer",
                      display: "flex",
                      gap: 2,
                    }}
                  >
                    {Array.from({ length: n }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: Math.max(8, 34 / n),
                          height: 16,
                          background: grey[30],
                          borderRadius: 1,
                          display: "inline-block",
                        }}
                      />
                    ))}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

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
        border: `2px dashed ${grey[20]}`,
        borderRadius: radius.lg,
        textAlign: "center",
        fontFamily: font,
        background: grey[0],
      }}
    >
      {view === "choose" ? (
        <>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
            <button title="Add new section" onClick={() => setView("structure")} style={zoneBtn(accent.base)}>
              <UiIcon name="plus" size={18} />
            </button>
            <button title="Add template" onClick={() => post({ type: "cms:openTemplates" })} style={zoneBtn(grey[60])}>
              <UiIcon name="template" size={18} />
            </button>
          </div>
          <div style={{ ...type.body, fontStyle: "italic", color: grey[40] }}>Drag widget here</div>
        </>
      ) : (
        <>
          <div style={{ ...type.title, color: grey[70], marginBottom: 16 }}>
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
                  border: hairline,
                  borderRadius: radius.md,
                  background: grey[5],
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  gap: 4,
                }}
              >
                {Array.from({ length: n }).map((_, i) => (
                  <span
                    key={i}
                    style={{ width: Math.max(14, 60 / n), height: 34, background: grey[30], borderRadius: radius.sm, display: "inline-block" }}
                  />
                ))}
              </button>
            ))}
          </div>
          <button
            onClick={() => setView("choose")}
            style={{ ...type.label, fontFamily: font, marginTop: 12, border: 0, background: "none", color: grey[50], cursor: "pointer" }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  )
}

function LiveDataPlaceholder({ type: blockType }: { type: string }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        margin: "8px auto",
        maxWidth: 1140,
        border: `1px dashed ${grey[20]}`,
        borderRadius: radius.lg,
        background: grey[5],
        textAlign: "center",
        fontFamily: font,
        color: grey[60],
      }}
    >
      <div style={{ ...type.micro }}>
        {LABELS[blockType] ?? blockType}
      </div>
      <div style={{ ...type.body, marginTop: 6, color: grey[40] }}>
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

  /**
   * Right-click menu (Elementor's context menu).
   *
   * Everything it offers already exists as a section action in the editor — this
   * is a faster road to them, not a second implementation. Copy / Paste move a
   * whole section; Copy Style / Paste Style move ONLY the appearance, which is
   * how you make five sections match without rebuilding each one.
   */
  const [ctxMenu, setCtxMenu] = useState<
    {
      x: number
      y: number
      index: number
      scope: "section" | "widget" | "element" | "chrome" | "chromeElement"
      label: string
      path?: number[]
      elementKey?: string
      region?: string
      /** Repeated-item context (slide / tile / testimonial under the cursor). */
      itemField?: string
      itemIndex?: number
      itemLabel?: string
    } | null
  >(null)
  const [clip, setClip] = useState<{
    hasSection: boolean
    hasWidget: boolean
    hasStyle: boolean
  }>({ hasSection: false, hasWidget: false, hasStyle: false })

  // A menu pinned to a viewport point must not outlive that point: scrolling or
  // Escape closes it, or it hangs over unrelated content.
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("scroll", close, true)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [ctxMenu])

  /**
   * ON-CANVAS FONT SIZE (Elementor's inline handle).
   *
   * The sidebar slider is fine, but resizing type is something you do by LOOKING
   * at the text — and the sidebar is a panel away, so you drag, glance across,
   * drag again. This puts the handle ON the words: select a text element, grab
   * the pill that appears above it, drag right to grow / left to shrink, and the
   * text resizes under your cursor in real time.
   *
   * `px` is what the element is showing right now (seeded from the computed
   * style, so an untouched heading starts at ITS size, not at some default).
   */
  const [fontPill, setFontPill] = useState<
    { top: number; left: number; px: number } | null
  >(null)
  const fontDragRef = useRef<{ startX: number; startPx: number } | null>(null)
  /** Which element the pill's number belongs to ("idx:key"), so a re-measure
   *  repositions the pill without resetting the size the user just chose. */
  const fontPillOwner = useRef<string | null>(null)
  /** The size the user has actually chosen. A ref, not state, because the
   *  measure effect runs from a closure that would otherwise read a stale value
   *  and quietly undo the last nudge. */
  const fontPxRef = useRef<number | null>(null)

  /**
   * Hand the element back to the stylesheet.
   *
   * The drag paints `style.fontSize` inline for instant feedback — but an inline
   * style BEATS the scoped rule the editor writes from the style bag. Leave it
   * behind and the element is pinned to the last dragged value forever: the +/-
   * buttons commit correctly, the CSS updates correctly, and nothing moves,
   * because the inline paint is still on top. So once the real value is stored,
   * the temporary paint is removed.
   */
  const releaseInlineFont = (index: number, key: string) => {
    const node = rootRef.current?.querySelector<HTMLElement>(
      `[data-cms-idx="${index}"] [data-el="${key}"]`
    )
    // A beat, so the editor's patched CSS has landed before the paint comes off
    // (otherwise the text visibly snaps back to its old size for one frame).
    window.setTimeout(() => node?.style.removeProperty("font-size"), 220)
  }
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
  // and element selections so its own ember outline is the only one showing.
  // A widget is addressed by its PATH (see parseWidgetPath), so a widget inside
  // an inner section is selectable/hoverable exactly like a top-level one.
  const [selectedW, setSelectedW] = useState<{
    index: number
    path: number[]
  } | null>(null)
  const [hoveredW, setHoveredW] = useState<{
    index: number
    path: number[]
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
    colPath: number[]
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
      if (e.data?.type === "cms:clipboard") {
        setClip({
          hasSection: !!e.data.hasSection,
          hasWidget: !!e.data.hasWidget,
          hasStyle: !!e.data.hasStyle,
        })
      }
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
        const path = Array.isArray(m.path) ? (m.path as number[]) : null
        if (idx != null && path && path.length >= 2) {
          setSelectedW({ index: idx, path })
          setSelected(null)
          setSelectedChrome(null)
          setSelectedEl(null)
          setSelectedChromeEl(null)
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-idx="${idx}"] [data-w="w-${path.join("-")}"]`
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
        ? canvasTokens.selected
        : isHov
        ? canvasTokens.hover
        : ""
      el.style.outlineOffset = isSel || isHov ? "-2px" : ""
    })
  }, [selected, hovered, content])

  // Outline the selected / hovered ELEMENT ([data-el]) inside a section. Same
  // ember language as sections and widgets — weight, not hue, carries the
  // meaning (2px = selected, 1px tint = hover). Runs over every [data-el];
  // unmatched ones are cleared.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>("[data-el]")
    let badge: { top: number; right: number; sel: boolean } | null = null
    let pill: { top: number; left: number; px: number } | null = null
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
        // the chrome element selection (same ember treatment as sections).
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
        ? canvasTokens.selected
        : isHov
        ? canvasTokens.hover
        : ""
      el.style.outlineOffset = isSel || isHov ? "-2px" : ""
      if (isSel || isHov) {
        const r = el.getBoundingClientRect()
        badge = { top: r.top, right: r.right, sel: isSel }
      }

      // The size handle only belongs on things made of words.
      if (isSel) {
        const hasText = (el.textContent ?? "").trim().length > 0
        if (hasText) {
          const owner = `${w?.dataset.cmsIdx ?? "?"}:${key}`
          const r = el.getBoundingClientRect()
          const sameElement = fontPillOwner.current === owner
          const px =
            sameElement && fontPxRef.current != null
              ? fontPxRef.current // keep what the user just set
              : Math.round(
                  parseFloat(window.getComputedStyle(el).fontSize) || 16
                )
          fontPillOwner.current = owner
          fontPxRef.current = px
          pill = { top: r.top, left: r.left, px }
        } else {
          fontPillOwner.current = null
          fontPxRef.current = null
          pill = null
        }
      }
    })
    setElBadge(badge)
    setFontPill(pill)
  }, [selectedEl, hoveredEl, selectedChromeEl, hoveredChromeEl, content, chrome, measureTick])

  // Outline the selected / hovered WIDGET ([data-w]) inside a container
  // section (Composer W1). Shares the ember selection language with sections
  // and elements — the innermost match is the only one drawn, so there is
  // nothing to disambiguate by hue. Unmatched ones are cleared.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = root.querySelectorAll<HTMLElement>("[data-w]")
    els.forEach((el) => {
      const w = el.closest("[data-cms-idx]") as HTMLElement | null
      const parsed = parseWidgetPath(el.getAttribute("data-w"))
      const samePath = (a: number[] | undefined, b: number[] | undefined) =>
        !!a && !!b && a.length === b.length && a.every((n, i) => n === b[i])
      let isSel = false
      let isHov = false
      if (w && parsed) {
        const idx = Number(w.dataset.cmsIdx)
        isSel =
          !!selectedW && idx === selectedW.index && samePath(parsed, selectedW.path)
        isHov =
          !isSel &&
          !!hoveredW &&
          idx === hoveredW.index &&
          samePath(parsed, hoveredW.path)
      }
      el.style.outline = isSel
        ? canvasTokens.selected
        : isHov
        ? canvasTokens.hover
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

  // Forward editing keystrokes to the parent editor (keyboard focus can be
  // inside this iframe): undo/redo, and the clipboard set (Cmd+C/V/D,
  // Delete) acting on the current selection. Ignore when typing in a field;
  // copying real selected text keeps its native meaning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return
      }
      const meta = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (meta && k === "z") {
        e.preventDefault()
        window.parent?.postMessage(
          { type: e.shiftKey ? "cms:redo" : "cms:undo" },
          "*"
        )
        return
      }
      if (meta && (k === "c" || k === "v" || k === "d")) {
        if (k === "c" && (window.getSelection()?.toString() ?? "")) return
        e.preventDefault()
        window.parent?.postMessage(
          {
            type: "cms:key",
            action: k === "c" ? "copy" : k === "v" ? "paste" : "duplicate",
          },
          "*"
        )
        return
      }
      if (!meta && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault()
        window.parent?.postMessage({ type: "cms:key", action: "delete" }, "*")
      }
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
    // The INNERMOST widget under the cursor: a widget inside an inner section
    // must hover as itself, not as the inner section that holds it.
    const ww = t.closest("[data-w]") as HTMLElement | null
    const wPath =
      ww && idx != null && w?.contains(ww)
        ? parseWidgetPath(ww.getAttribute("data-w"))
        : null
    setHoveredW((h) => {
      if (!wPath || idx == null) return h == null ? h : null
      const same =
        h &&
        h.index === idx &&
        h.path.length === wPath.length &&
        h.path.every((n, i) => n === wPath[i])
      return same ? h : { index: idx, path: wPath }
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
  ): { index: number; colPath: number[]; el: HTMLElement } | null => {
    const t = target as HTMLElement | null
    // closest() finds the INNERMOST column, so dropping into an inner section's
    // column targets that column, not the outer one holding it.
    const colEl = t?.closest?.("[data-col]") as HTMLElement | null
    const secEl = colEl?.closest("[data-cms-idx]") as HTMLElement | null
    if (!colEl || !secEl) return null
    const index = Number(secEl.dataset.cmsIdx)
    const colPath = parseColPath(colEl.getAttribute("data-col"))
    if (!Number.isInteger(index) || !colPath) return null
    return { index, colPath, el: colEl }
  }

  /** Insertion position within a column: before the first widget whose
   *  midpoint the pointer is above (Elementor-style). */
  const widgetInsertPos = (colEl: HTMLElement, clientY: number) => {
    // :scope > — a widget nested inside an inner section in this column is NOT
    // a drop sibling of this column's own widgets.
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
        background: ink.base, color: ink.text, font: `600 12px ${font}`,
        borderRadius: `${radius.md}px`, boxShadow: shadow.chip,
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
        colPath: hit.colPath,
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
          ? {
              index: hit.index,
              colPath: hit.colPath,
              wi: widgetInsertPos(hit.el, e.clientY).wi,
            }
          : dropCol
        if (
          target &&
          typeof payload.widget_type === "string" &&
          payload.widget_type
        ) {
          // An inner section cannot hold another one — one level of nesting.
          if (
            payload.widget_type === "inner_section" &&
            target.colPath.length > 1
          ) {
            clearDropHints()
            return
          }
          window.parent?.postMessage(
            {
              type: "cms:insertWidgetAt",
              index: target.index,
              colPath: target.colPath,
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
      const path = parseWidgetPath(wEl.getAttribute("data-w"))
      if (path) {
        e.preventDefault()
        e.stopPropagation()
        const idx = Number(bodyEl.dataset.cmsIdx)
        setSelectedW({ index: idx, path })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedEl(null)
        setSelectedChromeEl(null)
        window.parent?.postMessage(
          { type: "cms:clickedWidget", index: idx, path },
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
    return (
      <div style={{ ...type.body, padding: 40, fontFamily: font, color: grey[50] }}>
        Loading…
      </div>
    )
  }

  const chromeOutline = (k: string): React.CSSProperties | undefined =>
    selectedChrome === k
      ? { outline: canvasTokens.selected, outlineOffset: -2 }
      : undefined

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
      onContextMenu={(e) => {
        if (previewMode) return
        const t = e.target as HTMLElement
        const w = t.closest<HTMLElement>("[data-cms-idx]")

        // Not in a section: maybe in the header / top bar / footer (chrome).
        if (!w) {
          const cw = t.closest<HTMLElement>("[data-cms-chrome]")
          const region = cw?.getAttribute("data-cms-chrome")
          if (!cw || !region) return
          e.preventDefault()
          const regionLabel =
            region === "topbar" ? "Top Bar" : region === "footer" ? "Footer" : "Header"
          const elEl = t.closest<HTMLElement>("[data-el]")
          const elKey = elEl?.getAttribute("data-el")
          if (elEl && elKey && cw.contains(elEl)) {
            setCtxMenu({
              x: e.clientX,
              y: e.clientY,
              index: -1,
              scope: "chromeElement",
              label: `${regionLabel} — ${elKey.replace(/[_-]+/g, " ")}`,
              region,
              elementKey: elKey,
            })
            return
          }
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            index: -1,
            scope: "chrome",
            label: regionLabel,
            region,
          })
          return
        }

        const idx = Number(w.dataset.cmsIdx)
        if (!Number.isFinite(idx)) return
        e.preventDefault()

        // Repeated-item context: is the cursor inside one slide / tile /
        // testimonial? Carried alongside whatever scope resolves below, so the
        // menu can offer "Duplicate Slide" on top of the element's own actions.
        const itemEl = t.closest<HTMLElement>("[data-el-item]")
        const item =
          itemEl && w.contains(itemEl)
            ? parseItemMarker(itemEl.getAttribute("data-el-item"))
            : null
        const itemInfo = item
          ? {
              itemField: item.field,
              itemIndex: item.index,
              itemLabel: `${ITEM_LABELS[item.field] ?? "Item"} ${item.index + 1}`,
            }
          : {}

        // Resolve the INNERMOST thing under the cursor. Right-clicking a button
        // and being offered "duplicate the whole section" is not what anybody
        // means: a widget beats an element beats the section.
        const widgetEl = t.closest<HTMLElement>("[data-w]")
        const wPath = widgetEl ? parseWidgetPath(widgetEl.getAttribute("data-w")) : null
        if (widgetEl && wPath) {
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            index: idx,
            scope: "widget",
            label: isNestedPath(wPath) ? "Widget (in inner section)" : "Widget",
            path: wPath,
          })
          return
        }

        const elEl = t.closest<HTMLElement>("[data-el]")
        const elKey = elEl?.getAttribute("data-el")
        if (elEl && elKey && w.contains(elEl)) {
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            index: idx,
            scope: "element",
            label: `Element — ${elKey.replace(/[_-]+/g, " ")}`,
            elementKey: elKey,
            ...itemInfo,
          })
          return
        }

        setCtxMenu({
          x: e.clientX,
          y: e.clientY,
          index: idx,
          scope: "section",
          label: "Section",
          ...itemInfo,
        })
      }}
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
            fontFamily: font,
          }}
        >
          {hiddenBadges.map(({ idx, rect }) => (
            <div
              key={`cms-hidden-${idx}`}
              style={{
                ...chip(),
                position: "absolute",
                top: Math.max(2, rect.top + 6),
                left: Math.max(6, rect.left + 6),
                gap: 4,
                color: ink.muted,
              }}
            >
              <UiIcon name="eye" size={14} />
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
              left: 0,
              right: 0,
              height: 3,
              borderRadius: radius.sm,
              background: canvasTokens.dropLine,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.65), 0 1px 6px ${accent.ring}`,
              transition: "top 90ms ease",
            }}
          />
        </div>
      ) : null}

      {/* Palette drag (W3): inset highlight over the container column a
          dragged widget card would drop into (ember tint = the drop target). */}
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
            outline: canvasTokens.selected,
            outlineOffset: -2,
            background: canvasTokens.dropFill,
            borderRadius: radius.sm,
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
            borderRadius: radius.sm,
            background: canvasTokens.dropLine,
            boxShadow: `0 0 8px ${accent.ring}`,
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
            fontFamily: font,
          }}
        >
          <div
            style={{
              ...chip(),
              position: "absolute",
              top: Math.max(0, activeRect.top),
              left: Math.max(0, activeRect.left),
              height: 24,
              borderRadius: `0 0 ${radius.md}px 0`,
              color: ink.muted,
            }}
          >
            {SECTION_LABELS[activeBlock.block_type] ?? activeBlock.block_type}
          </div>
          <div
            data-cms-overlay="1"
            style={{
              ...chip(),
              position: "absolute",
              top: Math.max(2, activeRect.top + 6),
              left: activeRect.left + activeRect.width / 2,
              transform: "translateX(-50%)",
              height: 30,
              gap: 2,
              padding: "0 4px",
              pointerEvents: "auto",
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
              style={{ display: "flex", alignItems: "center", padding: "0 4px", color: ink.muted, cursor: "grab", userSelect: "none" }}
            >
              <UiIcon name="grip" size={14} />
            </div>
            <CanvasToolBtn
              title="Move up"
              disabled={activeIdx === 0}
              onClick={() => canvasAction("up", activeIdx)}
            >
              <UiIcon name="arrow-up" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Move down"
              disabled={activeIdx === content.length - 1}
              onClick={() => canvasAction("down", activeIdx)}
            >
              <UiIcon name="arrow-down" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Duplicate"
              onClick={() => canvasAction("duplicate", activeIdx)}
            >
              <UiIcon name="duplicate" size={14} />
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
              <UiIcon name="plus" size={14} />
            </CanvasToolBtn>
            <CanvasToolBtn
              title="Delete"
              danger
              onClick={() => canvasAction("delete", activeIdx)}
            >
              <UiIcon name="x" size={14} />
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
            background: elBadge.sel ? accent.base : ink.base,
            color: elBadge.sel ? accent.on : ink.muted,
            width: 22,
            height: 22,
            borderRadius: radius.sm,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: shadow.chip,
          }}
        >
          <UiIcon name="brush" size={14} />
        </div>
      ) : null}

      {/* On-canvas font-size handle — drag right to grow, left to shrink. */}
      {!previewMode && fontPill && selectedEl ? (
        <div
          style={{
            ...chip(),
            position: "fixed",
            top: Math.max(0, fontPill.top - 32),
            left: Math.max(0, fontPill.left),
            zIndex: 2147483100,
            height: 28,
            gap: 2,
            padding: "0 4px 0 6px",
            userSelect: "none",
          }}
        >
          <span
            title="Drag to resize the text"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
              fontDragRef.current = { startX: e.clientX, startPx: fontPill.px }
            }}
            onPointerMove={(e) => {
              const d = fontDragRef.current
              if (!d) return
              // 2px of travel per 1px of type: fine enough to land on a value,
              // coarse enough to cross a heading's range without a marathon.
              const next = Math.min(
                200,
                Math.max(8, Math.round(d.startPx + (e.clientX - d.startX) / 2))
              )
              if (next === fontPill.px) return
              fontPxRef.current = next
              setFontPill({ ...fontPill, px: next })
              // Paint it NOW so the text moves under the cursor. The editor is
              // the source of truth and will push the authoritative CSS back;
              // this is just so the drag does not feel dead.
              const node = rootRef.current?.querySelector<HTMLElement>(
                `[data-cms-idx="${selectedEl.index}"] [data-el="${selectedEl.key}"]`
              )
              if (node) node.style.fontSize = `${next}px`
            }}
            onPointerUp={(e) => {
              const d = fontDragRef.current
              fontDragRef.current = null
              if (!d) return
              ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
              // Commit through the editor so it lands in the element's style bag
              // (undo, autosave and the responsive device all keep working).
              window.parent?.postMessage(
                {
                  type: "cms:fontSize",
                  index: selectedEl.index,
                  elementKey: selectedEl.key,
                  px: fontPill.px,
                },
                "*"
              )
              releaseInlineFont(selectedEl.index, selectedEl.key)
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "ew-resize",
              padding: "0 4px",
              color: ink.muted,
              fontWeight: 600,
            }}
          >
            <UiIcon
              name="resize-h"
              size={14}
              style={{ pointerEvents: "none" }}
            />
            <span style={{ color: accent.base, pointerEvents: "none" }}>
              {fontPill.px}px
            </span>
          </span>

          {[-1, 1].map((step) => (
            <button
              key={step}
              type="button"
              title={step < 0 ? "Smaller" : "Bigger"}
              onClick={(e) => {
                e.stopPropagation()
                const next = Math.min(200, Math.max(8, fontPill.px + step))
                fontPxRef.current = next
                setFontPill({ ...fontPill, px: next })
                window.parent?.postMessage(
                  {
                    type: "cms:fontSize",
                    index: selectedEl.index,
                    elementKey: selectedEl.key,
                    px: next,
                  },
                  "*"
                )
                // Any inline paint left over from a drag would outrank the CSS
                // the editor is about to write, and the nudge would do nothing.
                releaseInlineFont(selectedEl.index, selectedEl.key)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = ink.text
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = ink.muted
              }}
              style={{
                border: 0,
                background: "transparent",
                color: ink.muted,
                width: 20,
                height: 20,
                borderRadius: radius.sm,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UiIcon name={step < 0 ? "minus" : "plus"} size={14} />
            </button>
          ))}
        </div>
      ) : null}


      {/* Right-click menu — Elementor parity. */}
      {!previewMode && ctxMenu ? (
        <>
          <div
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setCtxMenu(null)
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483200,
            }}
          />
          <div
            style={{
              ...surface("md"),
              ...type.body,
              position: "fixed",
              // Keep the menu on screen when the click is near an edge.
              top: Math.min(ctxMenu.y, window.innerHeight - 300),
              left: Math.min(ctxMenu.x, window.innerWidth - 220),
              zIndex: 2147483201,
              width: 200,
              padding: 6,
              fontFamily: font,
              color: grey[80],
            }}
          >
            <div
              style={{
                ...eyebrow(),
                padding: "4px 8px 8px",
                borderBottom: hairline,
                marginBottom: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {ctxMenu.label}
            </div>
            {(() => {
              const scope = ctxMenu.scope
              const canPaste =
                scope === "widget" ? clip.hasWidget : clip.hasSection

              // The style trio is universal — every scope can carry a look.
              const styleTrio = [
                { action: "copyStyle", label: "Copy Style" },
                {
                  action: "pasteStyle",
                  label: "Paste Style",
                  disabled: !clip.hasStyle,
                },
                { action: "resetStyle", label: "Reset Style" },
              ]

              // The cursor was inside one repeated item (a slide, a banner
              // tile, a testimonial): offer to duplicate or delete THAT item —
              // the thing "duplicate a content" has always meant here.
              const itemOps = ctxMenu.itemField
                ? [
                    {
                      action: "duplicateItem",
                      label: `Duplicate ${ctxMenu.itemLabel}`,
                    },
                    {
                      action: "deleteItem",
                      label: `Delete ${ctxMenu.itemLabel}`,
                      danger: true,
                    },
                    { action: "sepItem", label: "-" },
                  ]
                : []

              // A theme ELEMENT (a heading inside a hero, say) is a field of its
              // section, not a free-standing object: it cannot be duplicated or
              // deleted on its own. Offering those would be a lie. Its appearance
              // CAN be copied around, so that is what it gets. Chrome regions
              // (header/footer) are singletons — same deal.
              const items =
                scope === "element" || scope === "chromeElement"
                  ? [
                      { action: "edit", label: "Edit Element" },
                      { action: "sep1", label: "-" },
                      ...itemOps,
                      ...styleTrio,
                    ]
                  : scope === "chrome"
                    ? [
                        { action: "edit", label: `Edit ${ctxMenu.label}` },
                        { action: "sep1", label: "-" },
                        ...styleTrio,
                      ]
                    : [
                        {
                          action: "edit",
                          label: scope === "widget" ? "Edit Widget" : "Edit Section",
                        },
                        ...(scope === "section" ? itemOps : []),
                        { action: "duplicate", label: "Duplicate", hint: "⌘D" },
                        { action: "copy", label: "Copy", hint: "⌘C" },
                        {
                          action: "paste",
                          label: "Paste",
                          hint: "⌘V",
                          disabled: !canPaste,
                        },
                        { action: "sep1", label: "-" },
                        ...styleTrio,
                        { action: "sep2", label: "-" },
                        { action: "delete", label: "Delete", danger: true },
                      ]
              return items as {
                action: string
                label: string
                hint?: string
                disabled?: boolean
                danger?: boolean
              }[]
            })().map((item) =>
              item.label === "-" ? (
                <div
                  key={item.action}
                  style={{
                    borderTop: hairline,
                    margin: "6px 0",
                  }}
                />
              ) : (
                <button
                  key={item.action}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    window.parent?.postMessage(
                      {
                        type: "cms:ctxAction",
                        action: item.action,
                        scope: ctxMenu.scope,
                        index: ctxMenu.index,
                        path: ctxMenu.path,
                        elementKey: ctxMenu.elementKey,
                        region: ctxMenu.region,
                        itemField: ctxMenu.itemField,
                        itemIndex: ctxMenu.itemIndex,
                      },
                      "*"
                    )
                    setCtxMenu(null)
                  }}
                  style={menuItem({
                    disabled: item.disabled,
                    danger: item.danger,
                  })}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.background = grey[10]
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none"
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {CTX_ICONS[item.action] ? (
                      <UiIcon name={CTX_ICONS[item.action]} size={14} />
                    ) : null}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </span>
                  </span>
                  {item.hint ? (
                    <span style={{ ...type.micro, color: grey[40] }}>
                      {item.hint}
                    </span>
                  ) : null}
                </button>
              )
            )}
          </div>
        </>
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
          <React.Fragment key={i}>
            {!previewMode && <SectionInsertBar index={i} />}
            <SectionItem idx={i} block={block} blocks={canvasTheme.blocks} />
          </React.Fragment>
        ))}
        {!previewMode && (
        <style>{`
          /* An embedded player is a black hole for the mouse: every click lands
             inside YouTube's iframe, so the widget holding it can never be
             selected, dragged or deleted — you can only watch the video. While
             EDITING, the canvas takes the pointer back; Preview hands it over so
             the video still plays for real. */
          [data-cms-idx] iframe,
          [data-cms-chrome] iframe,
          [data-w] iframe {
            pointer-events: none;
          }
          /* A section that renders NOTHING (a category showcase with no
             categories, say) has no box — so it is invisible AND unselectable,
             which means it cannot even be deleted. It just sits in the page
             forever. Give it a body while editing so it can be seen, selected
             and removed. The important flag is required because the wrapper
             carries an INLINE display:contents that would otherwise win. */
          [data-cms-idx]:empty {
            display: block !important;
            min-height: 72px;
            margin: 8px 0;
            border: 1px dashed ${grey[20]};
            border-radius: ${radius.md}px;
            background: ${grey[5]};
          }
          [data-cms-idx]:empty::after {
            content: "Empty section — click to select, edit or delete";
            display: flex;
            align-items: center;
            justify-content: center;
            height: 72px;
            font: italic 500 12px ${font};
            color: ${grey[40]};
          }
          .ff-container-col:empty {
            min-height: 84px;
            border: 1px dashed ${grey[20]};
            border-radius: ${radius.sm}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${accent.soft};
          }
          .ff-container-col:empty::after {
            content: "Drag widget here";
            font: italic 500 12px ${font};
            color: ${grey[40]};
          }
        `}</style>
        )}
        {content.length === 0 && (
          <div
            style={{
              ...type.title,
              margin: "56px auto",
              maxWidth: 720,
              padding: "72px 32px",
              textAlign: "center",
              fontFamily: font,
              border: `2px dashed ${dropLine ? accent.base : grey[20]}`,
              borderRadius: radius.lg,
              background: dropLine ? accent.tint : grey[5],
              color: dropLine ? accent.active : grey[50],
              transition: `border-color ${motion.fast}, background ${motion.fast}, color ${motion.fast}`,
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
