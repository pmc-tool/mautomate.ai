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
  font,
  grey,
  motion,
  radius,
  type,
} from "@modules/cms/editor/design"
import {
  loadCanvasLiquid,
  buildLiquidCanvasTheme,
  canvasThemeCssHref,
  type CanvasLiquid,
  type CanvasTheme,
} from "@modules/cms/editor/liquid-canvas"
import EntranceObserver from "@modules/cms/render/EntranceObserver"
import {
  buildSectionCss,
  entranceAnimationOf,
  hasStyle,
  ENTRANCE_CSS,
  type AdvancedBag,
  type ElementStyles,
  type StyleBag,
} from "@modules/cms/render/style-engine"
import { buildDocumentHeadCss } from "@modules/cms/render/document"
import { type Device } from "@modules/cms/schema/types"

/* Canvas foundations (CANVAS P1): typed protocol, one hit-tester, one
   geometry store, one overlay layer. Parity modules — same wire format,
   same resolution rules, same affordances as the code they replaced. */
import {
  columnRefOf,
  onMessage,
  postCommandToShell,
  postToShell,
  refEq,
  sectionIndexOf,
  type NodeRef,
} from "@modules/cms/editor/canvas/protocol"
/* Drag-drop (CANVAS P5 / 3A): one payload codec, one drop resolver, the
   in-flow gap-opening placeholder. The scattered computeInsertion /
   widgetInsertPos / facade-target / dragKind versions this file carried
   are DELETED — dnd.ts is their one home. */
import {
  DropPlaceholder,
  activeDrag,
  commandForDrop,
  decodeDrag,
  dragCaps,
  dropTargetEq,
  noteDragEnd,
  noteDragStart,
  outlineTarget,
  resolveDrop,
  type DropTarget,
} from "@modules/cms/editor/canvas/dnd"
import { nid, normalizeDocument } from "@modules/cms/document/normalize"
/* --- 6B convert-to-widgets: the toolbar entry's gate (one predicate
   family with the command's own run(): facadeOf presents the section as
   its themed block exactly when conversion will accept it). --- */
import { facadeOf } from "@modules/cms/document/facade"
import { CONVERTIBLE_SECTION_TYPES } from "@modules/cms/editor/commands/registry"
import {
  hitTest,
  innermostOf,
  isNestedPath,
  ownerChromeRegion,
  ownerSectionEl,
  parseColPath,
  parseWidgetPath,
  type NodeHit,
} from "@modules/cms/editor/canvas/hit-test"
import {
  useGeometry,
  useGeometryVersion,
} from "@modules/cms/editor/canvas/geometry"
/* Hidden-node ghosts (3C), extracted to canvas/hidden (6C composition
   root): the ghost-CSS builder, the badge collector and the shared
   section/column/widget selector helpers — one definition each. */
import {
  buildHiddenGhostCss,
  collectHiddenBadges,
  colSelector,
  isHiddenOn,
  sectionId,
  widgetSelector,
} from "@modules/cms/editor/canvas/hidden"
import OverlayLayer, {
  AddSectionZone,
  SectionInsertBar,
  type ClipState,
  type CtxMenuState,
  type ElBadgeState,
  type FontPillState,
  type PickerState,
} from "@modules/cms/editor/canvas/OverlayLayer"
/* Inline editing (CANVAS P6 / 3B): one contentEditable session at a
   time, activated on the platform widgets' data-edit markers and the
   per-block inline maps (themed data-el markup). Commits ride the
   EXISTING bus commands (widget.setProps / section.setProps) with a
   per-session txn — one history entry per typing session. */
import {
  InlineEditor,
  resolveInlineTarget,
} from "@modules/cms/editor/canvas/inline"
/* --- 5B stage (ARCH-SLIDER §3): the slide-stage takeover. Mounted by
   THIS route only — the stage never exists on the live storefront, and
   the mount below is previewMode-gated, so preview stays inert. --- */
import StageMode, { type StageSel } from "@modules/cms/editor/slider/StageMode"
import {
  readSliderHost,
  sliderKindOf,
  slidesOfHost,
} from "@modules/cms/editor/slider/stage-commands"
import {
  isLayeredSlide,
  newSliderId,
  placementForTheme,
  type LayeredSlide,
} from "@modules/cms/editor/slider/model-5a"

type Section = { block_type: string; [k: string]: unknown }

/* sectionId / colSelector / widgetSelector / isHiddenOn moved to
   @modules/cms/editor/canvas/hidden (6C) — imported above. */

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

/* Marker parsers (parseWidgetPath / parseColPath / parseItemMarker /
   isNestedPath) moved verbatim to @modules/cms/editor/canvas/hit-test. */

/* How many widgets this column owns DIRECTLY. `:scope >` on purpose: a widget
   living inside an inner section in this column is not one of its own, exactly
   as the drop resolver's column-slot math (dnd.ts) already assumes. */
const directWidgetCount = (colEl: HTMLElement): number =>
  colEl.querySelectorAll(":scope > [data-w]").length

/* Owner-facing name for one item of a repeatable array prop. */
const ITEM_LABELS: Record<string, string> = {
  slides: "Slide",
  categories: "Banner",
  items: "Item",
  brands: "Brand",
  images: "Image",
  tabs: "Tab",
}

/* Palette drag payload decoding (dragKind and the drop parsers) now
   lives in @modules/cms/editor/canvas/dnd — dragCaps / decodeDrag. */

/* One NodeRef from the hit-tester's innermost node (Phase 2B): the hover
   and click paths speak NodeRef, the DOM speaks NodeHit — this is the
   one translation between them (chromeElement -> chromeEl spelling). */
function refOfNodeHit(node: NodeHit | null): NodeRef | null {
  if (!node) return null
  switch (node.t) {
    case "section":
      return { t: "section", i: node.index }
    case "column":
      return { t: "column", i: node.index, col: node.colPath }
    case "widget":
      return { t: "widget", i: node.index, path: node.path }
    case "element":
      return { t: "element", i: node.index, el: node.key }
    case "chromeElement":
      return { t: "chromeEl", region: node.region, el: node.key }
    case "chrome":
      return { t: "chrome", region: node.region }
  }
}

/* The element a section's hover/selection outline attaches to (unstyled
   sections are display:contents wrappers; zero-height boxes fall back to
   the tallest child). Moved VERBATIM to canvas/dnd.ts — the drop
   resolver's seam math measures the same boxes — and imported back. */

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
    <Comp
      {...block}
      sectionScope={sectionId(idx)}
      // EDITOR-ONLY flag, confined to the container renderer so an empty widget
      // (e.g. an image with no src) shows a visible, selectable placeholder on
      // the canvas instead of an invisible void. The live section-renderer never
      // sets it. Scoped to "container" so no other block gets an unknown prop.
      {...(block.block_type === "container" ? { editor: true } : {})}
    />
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

/* SECTION_LABELS + CTX_ICONS + every toolbar/pill/picker/menu component
   moved verbatim to @modules/cms/editor/canvas/OverlayLayer. */

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

  /* ---------------- ONE selection, ONE hover (Phase 2B) ----------------
     The five parallel selected* states and the five hovered* states the
     canvas used to mirror by hand (each message handler nulling the other
     four) collapsed into TWO NodeRef values (ARCH-CANVAS §4.1/§6). Every
     affordance below DERIVES from them; the legacy-shaped views keep the
     downstream code readable while the monolith shrinks. */
  const [sel, setSelRaw] = useState<NodeRef | null>(null)
  const [hover, setHoverRaw] = useState<NodeRef | null>(null)
  /** Identity-preserving setters: an equal ref keeps the same object so
   *  memo/effect deps don't churn on every mousemove. */
  const setSel = (ref: NodeRef | null) =>
    setSelRaw((s) => (refEq(s, ref) ? s : ref))
  const setHover = (ref: NodeRef | null) =>
    setHoverRaw((h) => (refEq(h, ref) ? h : ref))

  /* Legacy-shaped views (memoized so deps keep value identity). */
  const selected = sel?.t === "section" ? sel.i : null
  const selectedChrome = sel?.t === "chrome" ? sel.region : null
  const selectedEl = useMemo(
    () => (sel?.t === "element" ? { index: sel.i, key: sel.el } : null),
    [sel]
  )
  const selectedW = useMemo(
    () => (sel?.t === "widget" ? { index: sel.i, path: sel.path } : null),
    [sel]
  )
  /** NEW (Phase 2B): the selected COLUMN — the owner's ask. */
  const selectedCol = useMemo(
    () => (sel?.t === "column" ? { index: sel.i, colPath: sel.col } : null),
    [sel]
  )
  /** The section under the pointer at ANY level (widget/element/column
   *  hovers still light their section's toolbar, as before). */
  const hovered = sectionIndexOf(hover)
  const hoveredW = useMemo(
    () => (hover?.t === "widget" ? { index: hover.i, path: hover.path } : null),
    [hover]
  )
  /** The column the pointer is in: a hovered column itself, or the parent
   *  column of the hovered widget (the old hoveredCol semantics). */
  const hoveredCol = useMemo(() => columnRefOf(hover), [hover])

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
  // The RAW platform theme handle (tenant.meta.active_theme) — an uploaded
  // theme keeps its real handle here even when active_theme is downgraded to a
  // compiled React fallback for the canvas registry.
  const [platformTheme, setPlatformTheme] = useState<string>("")
  const [themeTokens, setThemeTokens] = useState<any>(null)
  // The store's brand name (tenant name in multi-tenant, else "Forever Finds"),
  // resolved by /api/puck/chrome. Fed to the active theme's footer view so the
  // canvas footer copy/logo alt matches the live storefront (WYSIWYG parity).
  const [brandName, setBrandName] = useState<string>("")
  // Liquid canvas (uploaded themes): when the active theme is an uploaded
  // theme, render the canvas through its own Liquid markup instead of the
  // fallback React blocks — a true WYSIWYG. null for React themes (untouched).
  const [liquidCanvas, setLiquidCanvas] = useState<CanvasLiquid | null>(null)
  // True while an uploaded (Liquid) theme's bundle is being fetched. Used to
  // hide the React fallback so the OLD compiled theme never flashes in first.
  const [liquidPending, setLiquidPending] = useState<boolean>(false)
  // True once the chrome/theme fetch has RESOLVED (success OR failure). The
  // /api/puck/load content fetch RACES the chrome fetch; if content wins we
  // must NOT paint it through the React fallback theme before the real
  // (Liquid) theme id is even known — that is the old-theme 'blink'.
  const [chromeLoaded, setChromeLoaded] = useState<boolean>(false)
  // True once an uploaded theme's bundle has RESOLVED but produced no canvas
  // (loadCanvasLiquid swallows its errors and returns null). Without this the
  // synchronous guard below could never release on a genuine load failure.
  const [liquidFailed, setLiquidFailed] = useState<boolean>(false)
  // Retry counter for the explicit theme-failure state (Phase 2: the React
  // fallback is deleted, so a failed bundle shows "Theme failed to load —
  // Retry" instead of silently rendering a different theme). Bumping it
  // re-runs BOTH loaders — the chrome fetch (which re-resolves the theme
  // handle when it was never known) and loadCanvasLiquid (the existing
  // bundle loader).
  const [retryTick, setRetryTick] = useState<number>(0)
  useEffect(() => {
    if (!platformTheme) {
      setLiquidCanvas(null)
      setLiquidPending(false)
      setLiquidFailed(false)
      return
    }
    let cancelled = false
    setLiquidPending(true)
    setLiquidFailed(false)
    loadCanvasLiquid(platformTheme, {
      shopName: brandName,
      chrome,
      categories: (chrome as any).categories ?? [],
      themeSettings: (chrome as any).theme_settings?.[activeTheme] ?? {},
      products: (chrome as any).sample_products ?? [],
    })
      .then((cl) => {
        if (!cancelled) {
          setLiquidCanvas(cl)
          setLiquidPending(false)
          // A null result IS the failure path (loadCanvasLiquid never throws).
          setLiquidFailed(!cl)
        }
      })
      .catch(() => {
        // A Liquid-load FAILURE must surface, not hang on a blank canvas:
        // reset the guard and leave liquidCanvas null so the explicit
        // "Theme failed to load — Retry" state renders (the React fallback
        // this used to reveal is deleted — Phase 2).
        if (!cancelled) {
          setLiquidCanvas(null)
          setLiquidPending(false)
          setLiquidFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [platformTheme, brandName, chrome, retryTick])
  // Load the uploaded theme's stylesheet + fonts into the canvas, neutralise the
  // fallback React theme's global html/body rules, and mark the body so the
  // theme's own `body.lz-*` selectors apply. Cleaned up when switching away.
  useEffect(() => {
    if (!liquidCanvas) return
    const nodes: HTMLElement[] = []
    const addLink = (href: string) => {
      const el = document.createElement("link")
      el.rel = "stylesheet"
      el.href = href
      document.head.appendChild(el)
      nodes.push(el)
    }
    addLink(
      "https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Marcellus&display=swap"
    )
    addLink("/learts/assets/css/vendor/fontawesome.min.css")
    addLink(canvasThemeCssHref(liquidCanvas))
    const style = document.createElement("style")
    style.textContent =
      "html{height:auto!important}body{height:auto!important;overflow-x:hidden;overflow-y:visible!important}"
    document.head.appendChild(style)
    nodes.push(style)
    document.body.classList.add("lz-body")
    const hadLearts = document.body.classList.contains("learts-theme")
    document.body.classList.remove("learts-theme")
    return () => {
      nodes.forEach((n) => n.remove())
      document.body.classList.remove("lz-body")
      if (hadLearts) document.body.classList.add("learts-theme")
    }
  }, [liquidCanvas])
  // (selectedChrome / hovered now derive from the sel/hover NodeRefs above.)
  // Edit-pencil badge over the hovered/selected [data-el] element (Elementor).
  const [elBadge, setElBadge] = useState<ElBadgeState | null>(null)

  /**
   * Right-click menu (Elementor's context menu).
   *
   * Everything it offers already exists as a section action in the editor — this
   * is a faster road to them, not a second implementation. Copy / Paste move a
   * whole section; Copy Style / Paste Style move ONLY the appearance, which is
   * how you make five sections match without rebuilding each one.
   */
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
  const [clip, setClip] = useState<ClipState>({
    hasSection: false,
    hasWidget: false,
    hasStyle: false,
  })

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
  const [fontPill, setFontPill] = useState<FontPillState | null>(null)
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

  /** Paint `style.fontSize` inline for live drag feedback (the overlay's font
   *  pill calls this per pointermove; releaseInlineFont removes it after the
   *  committed CSS lands). Same DOM write the drag handler used to do inline. */
  const paintInlineFont = (index: number, key: string, px: number) => {
    const node = rootRef.current?.querySelector<HTMLElement>(
      `[data-cms-idx="${index}"] [data-el="${key}"]`
    )
    if (node) node.style.fontSize = `${px}px`
  }
  // Preview mode: hide every editor affordance so the page renders clean —
  // an accurate preview of UNSAVED changes (the canvas renders live state).
  const [previewMode, setPreviewMode] = useState(false)
  // (Element / widget / column / chrome-element selection and hover all
  // derive from the sel/hover NodeRefs above — Phase 2B unification.)
  // The in-canvas widget picker, pinned to the exact insertion point that
  // opened it: section `index`, `colPath` inside it, and `wi` (splice
  // position). Held separately from hover so the target cannot drift out from
  // under the merchant while they read the list.
  const [picker, setPicker] = useState<PickerState | null>(null)
  // Drag-and-drop (CANVAS P5 / 3A): the ONE resolved drop target under the
  // pointer, from dnd.resolveDrop — seam, column slot, or facade. The
  // in-flow gap (a REAL placeholder element) is opened/moved/closed by the
  // DropPlaceholder controller; the overlay renders the target's naming
  // and outline from this same value. Esc / dragend / leave clear both.
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const dropPh = useRef<DropPlaceholder | null>(null)
  // The device currently previewed, derived from the iframe's own width using
  // the SAME breakpoints as the style-engine media queries (<=767 mobile,
  // <=1024 tablet, else desktop). The parent editor's Desktop/Tablet/Mobile
  // toggle resizes this iframe, so this tracks the toggle without needing a
  // dedicated message, and matches exactly which @media rules are active.
  const [device, setDevice] = useState<Device>("desktop")
  const rootRef = useRef<HTMLDivElement>(null)
  // ONE geometry store replaces the old `measureTick` counter: it invalidates
  // (rAF-batched) on scroll / resize / DOM mutation, and `geomVersion` is the
  // drop-in dependency the overlay memos/effects re-run on.
  const geom = useGeometry(rootRef)
  const geomVersion = useGeometryVersion(geom)

  /* ---------------- Inline editing (CANVAS P6 / 3B) ----------------
     ONE session controller (framework-free, like dnd's DropPlaceholder):
     the page routes activation, patch deferral and preview/data resets
     through it; the controller owns the DOM side (contentEditable,
     keystroke isolation, sanitize-on-commit, caret). `editingNode` is
     the session mirrored into React state so the outline pass and the
     widget toolbar re-run when a session starts/ends. */
  const contentRef = useRef<Section[] | null>(null)
  contentRef.current = content
  const [editingNode, setEditingNode] = useState<{ index: number } | null>(
    null
  )
  const inlineRef = useRef<InlineEditor | null>(null)
  if (!inlineRef.current) {
    inlineRef.current = new InlineEditor({
      getContent: () => contentRef.current,
      send: postCommandToShell,
      undo: (redo) => postToShell({ type: redo ? "cms:redo" : "cms:undo" }),
      onActiveChange: setEditingNode,
      applyPatch: (index, section) =>
        setContent((c) =>
          c ? c.map((b, i) => (i === index ? (section as Section) : b)) : c
        ),
    })
  }
  const inline = inlineRef.current

  /* --- 5B stage: takeover state -------------------------------------
     The stage is MODE, not history (§3.3): entering/exiting never touches
     the undo stack. Mutations from the stage ride cms:cmd envelopes; the
     messages below carry only selection intent + mode. Refs mirror the
     two states so handlers never close over stale values. */
  const [stage, setStage] = useState<{ index: number } | null>(null)
  const stageRef = useRef<{ index: number } | null>(null)
  /* 7A: the shell has taken the stage chrome outside the iframe (top
     toolbar / right LAYER OPTIONS sidebar / bottom layer list), so the
     in-canvas filmstrip + rail stand down and the overlay keeps the whole
     iframe. Driven by cms:stageChrome; false = the 5B in-canvas chrome. */
  const [stageChromeExternal, setStageChromeExternal] = useState(false)
  /* 7A: session lock set, owned by the shell's bottom layer list. Session
     affordance only — never document state, never history. */
  const [stageLocks, setStageLocks] = useState<string[]>([])
  const [stageSel, setStageSelState] = useState<StageSel>({
    slideId: null,
    layerId: null,
  })
  const stageSelRef = useRef<StageSel>({ slideId: null, layerId: null })
  const setStageSel = (v: StageSel) => {
    stageSelRef.current = v
    setStageSelState(v)
  }
  /** Section index waiting for its fields→layered upgrade to apply. */
  const pendingStageRef = useRef<number | null>(null)

  const enterStage = (index: number) => {
    const kind = sliderKindOf(contentRef.current, index)
    if (kind === "layered") {
      stageRef.current = { index }
      setStage(stageRef.current)
      postToShell({ type: "cms:stage", on: true, index })
      const host = readSliderHost(contentRef.current, index)
      const first = slidesOfHost(host).find(isLayeredSlide) as
        | LayeredSlide
        | undefined
      if (first) {
        setStageSel({ slideId: first.id, layerId: null })
        /* 5C: the stage's selection doubles as the canvas NodeRef sel so
           the AI prompt box (Cmd+J) resolves a slider target (ARCH-AI
           §5.1 — "5B exposes the stage's layer/slide refs to the prompt
           box mount"). */
        setSel({ t: "sliderSlide", i: index, slideId: first.id })
        postToShell({
          type: "cms:clickedSliderSlide",
          index,
          slideId: first.id,
        })
      }
    } else if (kind === "fields") {
      // "Convert to layered slide": ONE in-history command (undo restores
      // the fields shape and theme rendering — §5), then the stage opens
      // when the patched content lands back from the shell.
      pendingStageRef.current = index
      const placement = placementForTheme(platformTheme)
      postCommandToShell({
        name: "slider.upgradeSlide",
        args: {
          index,
          idSeed: newSliderId("up"),
          ...(placement ? { placement } : {}),
        },
      })
    }
  }

  /* 7A: the shell's top-bar Back needs to reach exitStage from the stable
     message listener — a ref keeps that call stale-safe, exactly like the
     other action refs in this file. */
  const exitStageRef = useRef<(() => void) | null>(null)
  const exitStage = () => {
    if (stageRef.current) {
      postToShell({ type: "cms:stage", on: false, index: stageRef.current.index })
      /* 5C: leaving the stage hands selection back to the section. */
      setSel({ t: "section", i: stageRef.current.index })
    }
    stageRef.current = null
    setStage(null)
    setStageSel({ slideId: null, layerId: null })
  }
  exitStageRef.current = exitStage

  /* --- 6B: merchant-invoked "Convert to widgets" (ARCH-CORE P5). ONE
     in-history command; node ids derive from the dispatch-time seed so
     redo replays byte-identically (the slider.upgradeSlide idSeed
     precedent above). Undo restores the themed section — and thereby the
     theme's own Liquid rendering — via the command's before-section
     inverse. Selection stays on the section: it is still the same
     section at the same index, now presenting as a real container. */
  const convertToWidgets = (index: number) => {
    postCommandToShell({
      name: "section.convertToWidgets",
      args: { index, idSeed: nid() },
    })
  }
  /* --- end 6B --- */

  // The upgrade round-trips through the shell; open the stage the moment
  // the section comes back layered.
  useEffect(() => {
    const idx = pendingStageRef.current
    if (idx == null) return
    if (sliderKindOf(content, idx) === "layered") {
      pendingStageRef.current = null
      enterStage(idx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  // Preview is inert: the stage (and all its chrome) unmounts.
  useEffect(() => {
    if (previewMode && stageRef.current) exitStage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode])
  /* --- end 5B stage -------------------------------------------------- */

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
          sample_products: Array.isArray(d.sample_products) ? d.sample_products : [],
        } as any)
        setActiveTheme(typeof d.active_theme === "string" ? d.active_theme : "")
        const resolvedPlatformTheme =
          typeof d.platform_theme === "string" && d.platform_theme
            ? d.platform_theme
            : typeof d.active_theme === "string"
              ? d.active_theme
              : ""
        setPlatformTheme(resolvedPlatformTheme)
        // Timing invariant: hide the fallback synchronously with the theme id so
        // the compiled React fallback never paints before the Liquid bundle
        // loads. `liquidPending` is otherwise only flipped in the platformTheme
        // effect, which commits ONE render too late (after the first post-fetch
        // paint). Guard only for a non-empty theme; an empty theme must reveal.
        if (resolvedPlatformTheme) {
          setLiquidPending(true)
        }
        setThemeTokens(d.theme_tokens ?? null)
        setBrandName(typeof d.brand_name === "string" ? d.brand_name : "")
        setChromeLoaded(true)
      })
      .catch(() => {
        if (active) setChromeLoaded(true)
      })
    return () => {
      active = false
    }
    // retryTick: the explicit theme-failure state's Retry re-resolves the
    // chrome too — when the theme handle itself never arrived, retrying only
    // the bundle load could never succeed.
  }, [locale, key, retryTick])

  // True once the shell's normalized cms:data has arrived (see E4 race).
  const shellDataRef = useRef(false)

  // Initial load (self-sufficient so the canvas renders standalone too).
  useEffect(() => {
    let active = true
    fetch(`/api/puck/load?slug=${slug}&lang=${locale}&key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { data: { content: [] } }))
      .then((d) => {
        if (!active || shellDataRef.current) return
        const items = (d?.data?.content ?? []) as { type: string; props?: Record<string, unknown> }[]
        // Standalone canvas normalizes exactly like the shell does, so the two
        // load paths can never disagree about the document shape.
        setContent(
          normalizeDocument(
            items.map((c) => {
              const { id, ...rest } = c.props ?? {}
              return { block_type: c.type, ...rest }
            }) as any
          ).content as any
        )
      })
      .catch(() => active && !shellDataRef.current && setContent([]))
    return () => {
      active = false
    }
  }, [slug, locale, key])

  // Live edits + selection from the parent editor — through the typed
  // protocol subscription. Field-level runtime checks are kept as-is:
  // postMessage is an untrusted boundary, types describe honest senders.
  useEffect(() => {
    const off = onMessage((m) => {
      if (m.type === "cms:clipboard") {
        setClip({
          hasSection: !!m.hasSection,
          hasWidget: !!m.hasWidget,
          hasStyle: !!m.hasStyle,
        })
      }
      // Full replace — initial load + structural changes (add/remove/reorder).
      if (m.type === "cms:data" && Array.isArray(m.content)) {
        // INLINE (3B): a structural replace invalidates the session's
        // addresses — end it first (committing what was typed).
        inlineRef.current?.stop()
        // The shell's push is the normalized truth — once it has arrived, the
        // canvas's own slower self-load must never clobber it (1C's race).
        shellDataRef.current = true
        setContent(m.content)
      }
      // Targeted patch — a single section edited; only that index's object is
      // replaced, so only its memoized component re-renders.
      if (m.type === "cms:patch" && typeof m.index === "number" && m.section) {
        // INLINE (3B, ARCH-CANVAS §6 mechanic 3): while a section is
        // being typed in, its patch must not rebuild the theme DOM under
        // the caret — the contentEditable node is the temporary source
        // of truth. The session holds the freshest section (it becomes
        // the commit base) and re-syncs it on deactivate.
        if (inlineRef.current?.deferPatch(m.index, m.section as Section)) {
          return
        }
        setContent((c) =>
          c ? c.map((b, i) => (i === m.index ? (m.section as Section) : b)) : c
        )
      }
      if (m.type === "cms:previewMode") {
        // INLINE (3B): preview renders clean — commit and end the
        // session before any affordance-stripping runs.
        if (m.on) inlineRef.current?.stop()
        setPreviewMode(!!m.on)
        setHover(null)
      }
      /* 7A: shell-owned stage chrome handshake. Pure presentation — no
         selection, no document, no history; StageMode just stops drawing
         the filmstrip/rail the shell is now drawing full-screen. */
      if (
        m.type === "cms:device" &&
        (m.device === "desktop" || m.device === "tablet" || m.device === "mobile")
      ) {
        setDeviceFromShell(m.device)
      }
      if (m.type === "cms:stageChrome") {
        setStageChromeExternal(!!m.external)
      }
      if (m.type === "cms:stageExit") {
        exitStageRef.current?.()
      }
      if (m.type === "cms:stageLocks" && Array.isArray(m.layerIds)) {
        setStageLocks(m.layerIds.filter((x): x is string => typeof x === "string"))
      }
      /* Selection mirrors from the shell (Phase 2B): the five legacy select
         messages (+ cms:selectColumn, the 2E contract) all land in the ONE
         `sel` NodeRef. Clearing semantics are unchanged: cms:select /
         cms:selectChrome with null clear EVERYTHING; the element / widget /
         chrome-element / column messages with null clear only their own
         kind (that is exactly what the old per-kind setters did). */
      if (m.type === "cms:select") {
        const idx = typeof m.index === "number" ? m.index : null
        setSel(idx != null ? { t: "section", i: idx } : null)
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
          setSel({ t: "element", i: idx, el: key })
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-idx="${idx}"] [data-el="${key}"]`
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelRaw((s) => (s?.t === "element" ? null : s))
        }
      }
      // Chrome element-level selection driven from the parent (e.g. to re-focus
      // an element, or null to clear). Mirrors cms:selectElement for sections.
      if (m.type === "cms:selectChromeElement") {
        const region = typeof m.region === "string" ? m.region : null
        const key = typeof m.elementKey === "string" ? m.elementKey : null
        if (region && key) {
          setSel({ t: "chromeEl", region, el: key })
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-chrome="${region}"] [data-el="${key}"]`
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelRaw((s) => (s?.t === "chromeEl" ? null : s))
        }
      }
      // Live chrome edits + chrome selection from the parent.
      if (m.type === "cms:chrome" && typeof m.key === "string") {
        setChrome((c) => ({ ...c, [m.key]: m.data }))
      }
      if (m.type === "cms:selectChrome") {
        setSel(
          typeof m.key === "string" && m.key
            ? { t: "chrome", region: m.key }
            : null
        )
      }
      // Widget-level selection driven from the parent (Composer W1) — e.g. a
      // widget row clicked in the container's columns manager, or a freshly
      // added widget. Outlines + scrolls the [data-w] widget into view; null
      // clears it. Mirrors cms:selectElement.
      if (m.type === "cms:selectWidget") {
        const idx = typeof m.index === "number" ? m.index : null
        const path = Array.isArray(m.path) ? (m.path as number[]) : null
        if (idx != null && path && path.length >= 2) {
          setSel({ t: "widget", i: idx, path })
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              `[data-cms-idx="${idx}"] [data-w="w-${path.join("-")}"]`
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelRaw((s) => (s?.t === "widget" ? null : s))
        }
      }
      // COLUMN selection driven from the parent (Phase 2B, INTEGRATION-2E §2):
      // a Navigator column row, or the shell mirroring a canvas column click.
      // On a collapsed facade the column has no [data-col] DOM — selection
      // still lands (the overlay falls back to the section box, 2E §4).
      if (m.type === "cms:selectColumn") {
        const idx = typeof m.index === "number" ? m.index : null
        const colPath =
          Array.isArray(m.colPath) && m.colPath.length % 2 === 1
            ? (m.colPath as number[])
            : null
        if (idx != null && colPath) {
          setSel({ t: "column", i: idx, col: colPath })
          requestAnimationFrame(() => {
            const el = rootRef.current?.querySelector(
              colSelector(idx, colPath)
            ) as HTMLElement | null
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        } else {
          setSelRaw((s) => (s?.t === "column" ? null : s))
        }
      }
      /* --- 5B stage: slider selection mirror (shell → stage). The
         executor's selection restore and the panel's back-navigation
         land here; layerId null = slide-level selection. --- */
      if (m.type === "cms:selectSliderLayer") {
        const idx = typeof m.index === "number" ? m.index : null
        if (idx == null) {
          if (stageRef.current) {
            stageSelRef.current = {
              ...stageSelRef.current,
              layerId: null,
            }
            setStageSelState(stageSelRef.current)
          }
        } else if (stageRef.current?.index === idx) {
          stageSelRef.current = {
            slideId: typeof m.slideId === "string" ? m.slideId : null,
            layerId: typeof m.layerId === "string" ? m.layerId : null,
          }
          setStageSelState(stageSelRef.current)
        }
      }
      /* --- end 5B stage --- */
    })
    postToShell({ type: "cms:ready" })
    return off
  }, [])

  /* ---------------- ONE outline pass (Phase 2B) ----------------
     Sections, columns, widgets and elements (page + chrome) all derive
     their outlines from (sel, hover) in a single effect — the THREE
     parallel effects this replaces each re-walked the DOM for one node
     kind and manually mirrored the others' state. Same ember language:
     weight, not hue, carries the meaning (2px = selected, 1px tint =
     hover); unmatched nodes are cleared. The element badge and the font
     pill are computed in the same walk (they need the same rects). */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (previewMode) return // the preview effect below scrubs everything

    const paint = (el: HTMLElement, isSel: boolean, isHov: boolean) => {
      // INLINE (3B): the node being edited carries its own thin editing
      // treatment (inline.ts owns its outline) — the selection/hover
      // pass must neither overwrite nor clear it mid-session.
      if (el.hasAttribute("data-cms-editing")) return
      el.style.outline = isSel
        ? canvasTokens.selected
        : isHov
        ? canvasTokens.hover
        : ""
      el.style.outlineOffset = isSel || isHov ? "-2px" : ""
    }
    const samePath = (
      a: number[] | null | undefined,
      b: number[] | null | undefined
    ) => !!a && !!b && a.length === b.length && a.every((n, i) => n === b[i])

    // SECTIONS. A selected COLUMN whose [data-col] does not exist in the
    // DOM (collapsed facade — pure theme markup) outlines its section
    // instead: on a facade the single implicit column IS the section box
    // (INTEGRATION-2E §4), so that is the honest thing to light up.
    const selColEl =
      sel?.t === "column"
        ? root.querySelector<HTMLElement>(colSelector(sel.i, sel.col))
        : null
    const selSecIdx =
      sel?.t === "section"
        ? sel.i
        : sel?.t === "column" && !selColEl
        ? sel.i
        : null
    // Hover parity: the section tint lights whenever the pointer is
    // ANYWHERE inside the section (a hovered widget/element/column still
    // implies its section) — exactly what the old `hovered` state carried.
    const hovSecIdx = sectionIndexOf(hover)
    root.querySelectorAll<HTMLElement>("[data-cms-idx]").forEach((w) => {
      const el = outlineTarget(w)
      if (!el) return
      const idx = Number(w.dataset.cmsIdx)
      const isSel = idx === selSecIdx
      const isHov = !isSel && hovSecIdx === idx
      paint(el, isSel, isHov)
    })

    // COLUMNS ([data-col]) — first-class selectable (Phase 2B, the owner's
    // ask). Hover outline only when the pointer is in the column ITSELF
    // (its padding / empty area) — never when it merely contains the
    // hovered widget, which would double-outline every widget hover.
    root.querySelectorAll<HTMLElement>("[data-col]").forEach((el) => {
      const w = ownerSectionEl(el)
      const colPath = parseColPath(el.getAttribute("data-col"))
      let isSel = false
      let isHov = false
      if (w && colPath) {
        const idx = Number(w.dataset.cmsIdx)
        isSel = !!(
          sel?.t === "column" &&
          sel.i === idx &&
          samePath(sel.col, colPath)
        )
        isHov =
          !isSel &&
          !!(
            hover?.t === "column" &&
            hover.i === idx &&
            samePath(hover.col, colPath)
          )
      }
      paint(el, isSel, isHov)
    })

    // WIDGETS ([data-w]).
    root.querySelectorAll<HTMLElement>("[data-w]").forEach((el) => {
      const w = ownerSectionEl(el)
      const parsed = parseWidgetPath(el.getAttribute("data-w"))
      let isSel = false
      let isHov = false
      if (w && parsed) {
        const idx = Number(w.dataset.cmsIdx)
        isSel = !!(
          sel?.t === "widget" &&
          sel.i === idx &&
          samePath(sel.path, parsed)
        )
        isHov =
          !isSel &&
          !!(
            hover?.t === "widget" &&
            hover.i === idx &&
            samePath(hover.path, parsed)
          )
      }
      paint(el, isSel, isHov)
    })

    // ELEMENTS ([data-el], page + chrome) + the badge and the font pill.
    let badge: { top: number; right: number; sel: boolean } | null = null
    let pill: { top: number; left: number; px: number } | null = null
    root.querySelectorAll<HTMLElement>("[data-el]").forEach((el) => {
      const w = ownerSectionEl(el)
      const key = el.getAttribute("data-el")
      let isSel = false
      let isHov = false
      if (w) {
        // Element inside a section — matched against the section selection.
        const idx = Number(w.dataset.cmsIdx)
        isSel = !!(sel?.t === "element" && sel.i === idx && sel.el === key)
        isHov =
          !isSel &&
          !!(hover?.t === "element" && hover.i === idx && hover.el === key)
      } else {
        // Element inside a chrome region ([data-cms-chrome]) — matched
        // against the chrome element selection (same ember treatment).
        const region = ownerChromeRegion(el)
        isSel = !!(
          sel?.t === "chromeEl" &&
          sel.region === region &&
          sel.el === key
        )
        isHov =
          !isSel &&
          !!(
            hover?.t === "chromeEl" &&
            hover.region === region &&
            hover.el === key
          )
      }
      paint(el, isSel, isHov)
      // INLINE (3B): no edit badge / size pill over an active editing
      // session — the affordances would float on the words being typed.
      if ((isSel || isHov) && !el.hasAttribute("data-cms-editing")) {
        const r = geom.rectOf(el)
        badge = { top: r.top, right: r.right, sel: isSel }
      }

      // The size handle only belongs on things made of words.
      if (isSel && !el.hasAttribute("data-cms-editing")) {
        const hasText = (el.textContent ?? "").trim().length > 0
        if (hasText) {
          const owner = `${w?.dataset.cmsIdx ?? "?"}:${key}`
          const r = geom.rectOf(el)
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
  }, [sel, hover, content, chrome, geomVersion, previewMode, editingNode])

  // (Scroll / resize re-measure now lives in the geometry store.)

  /* The shell's device wins when it has told us (cms:device). Width
     inference stays as the fallback for any canvas that never hears it —
     it is a good guess, but only a guess: the canvas box can be narrower
     than the device it stands for. */
  const [deviceFromShell, setDeviceFromShell] = useState<Device | null>(null)
  useEffect(() => {
    if (deviceFromShell) {
      setDevice(deviceFromShell)
      return
    }
    const compute = () => {
      const w = window.innerWidth
      setDevice(w <= 767 ? "mobile" : w <= 1024 ? "tablet" : "desktop")
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [deviceFromShell])

  // After content or device changes, force a post-commit re-measure so the
  // hidden-section badges (and the toolbar overlay) read fresh DOM rects.
  // (The store's MutationObserver catches most of these; this keeps the old
  // guarantee exactly — a measure ALWAYS follows a commit.)
  // observe() here too (idempotent): the root div does not exist until the
  // first content render — the mount-time attach in useGeometry sees null —
  // so the store latches onto the root the moment it first paints.
  useEffect(() => {
    if (rootRef.current) geom.observe(rootRef.current)
    geom.invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        postToShell({ type: e.shiftKey ? "cms:redo" : "cms:undo" })
        return
      }
      if (meta && (k === "c" || k === "v" || k === "d")) {
        if (k === "c" && (window.getSelection()?.toString() ?? "")) return
        e.preventDefault()
        postToShell({
          type: "cms:key",
          action: k === "c" ? "copy" : k === "v" ? "paste" : "duplicate",
        })
        return
      }
      if (!meta && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault()
        postToShell({ type: "cms:key", action: "delete" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // The section the overlay toolbar attaches to: hovered, else the section
  // of ANY current selection (widget/element/column selections keep their
  // section's toolbar mounted — clicking the hero then travelling to the
  // toolbar must not unmount it), else a toolbar the pointer is holding.
  const [heldIdx, setHeldIdx] = useState<number | null>(null)
  useEffect(() => {
    setHeldIdx(null)
  }, [content])
  const selSectionIdx = sectionIndexOf(sel)
  const activeIdx =
    hovered != null ? hovered : selSectionIdx != null ? selSectionIdx : heldIdx
  const activeRect = useMemo<DOMRect | null>(() => {
    if (activeIdx == null || !rootRef.current) return null
    const w = rootRef.current.querySelector(`[data-cms-idx="${activeIdx}"]`)
    const el = outlineTarget(w)
    return el ? geom.rectOf(el) : null
    // geomVersion forces a re-measure on scroll/resize/mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, content, geomVersion])

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
          block.elementStyles as ElementStyles | undefined,
          /* 3C: no display:none in editor CSS — hidden nodes ghost instead. */
          { hide: false }
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

  // The ACTIVE (uploaded Liquid) theme's chrome + block renderers, built from
  // the loaded bundle through the shared document composer. NULL until the
  // bundle resolves — and null on failure: the React fallback registry is
  // DELETED (Phase 2), so failure renders the explicit error state below,
  // never a silently different theme. Stable per bundle, so passing
  // `canvasTheme.blocks` to each memoized SectionItem doesn't cause re-renders.
  const canvasTheme: CanvasTheme | null = useMemo(
    () => (liquidCanvas ? buildLiquidCanvasTheme(liquidCanvas) : null),
    [liquidCanvas]
  )

  // Theme color/font vars (FIX 3): the active theme's manifest tokens are the
  // base palette; CMS `theme` overrides only where the owner customized. From
  // the document composer's ONE token-emission seam (shared with the live
  // route's <head>), so the two stay identical.
  const themeVars = useMemo(
    () => buildDocumentHeadCss(chrome.theme, themeTokens),
    [chrome.theme, themeTokens]
  )

  // Editor-only visibility ghosting (3C). The editor builds its CSS with
  // `{ hide:false }` (sectionCss above, container-html's editor
  // branch), so NO display:none exists here to counter — hidden nodes stay
  // laid out by the theme's own rules and are dimmed to 40% instead. This is
  // what makes COLUMN/WIDGET ghosts possible at all: their natural display
  // (flex items etc.) comes from theme/container CSS and cannot be guessed by
  // a counter-rule. Production keeps the real display:none.
  const hiddenCss = useMemo(
    () => (content ? buildHiddenGhostCss(content, chrome, device) : ""),
    [content, chrome, device]
  )

  // Rects + refs for every node hidden on the previewed device — sections,
  // section elements, columns, widgets (incl. nested inner sections) and
  // chrome elements — so the overlay renders a clickable "Hidden on <Device>"
  // badge over each ghost (3C; measured like the toolbar overlay).
  const hiddenBadges = useMemo<{ ref: NodeRef; rect: DOMRect }[]>(() => {
    if (!content || !rootRef.current) return []
    return collectHiddenBadges(
      content,
      chrome,
      device,
      rootRef.current,
      (el) => geom.rectOf(el),
      outlineTarget
    )
    // geomVersion forces a re-measure on scroll/resize/content/device change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, chrome, device, geomVersion])

  /** Badge click (3C): the node's OWN click path — local selection plus the
   *  same cms:clicked* message — so the shell panel opens on the node and
   *  the merchant can un-hide it from the Advanced tab. */
  const selectHidden = (ref: NodeRef) => {
    setSel(ref)
    switch (ref.t) {
      case "section":
        postToShell({ type: "cms:clicked", index: ref.i })
        break
      case "column":
        postToShell({ type: "cms:clickedColumn", index: ref.i, colPath: ref.col })
        break
      case "widget":
        postToShell({ type: "cms:clickedWidget", index: ref.i, path: ref.path })
        break
      case "element":
        postToShell({ type: "cms:clickedElement", index: ref.i, elementKey: ref.el })
        break
      case "chromeEl":
        postToShell({
          type: "cms:clickedChromeElement",
          region: ref.region,
          elementKey: ref.el,
        })
        break
      case "chrome":
        postToShell({ type: "cms:clickedChrome", key: ref.region })
        break
      default:
        break
    }
  }

  /* ---------------- Tree-level add affordances (Elementor feel) ----------
     The complaint this answers, verbatim: "inside a section there are two
     elements — if I want to add another element I cannot, there is no plus
     button." Adding was only ever possible by DRAGGING from the shell palette,
     and an empty column had no box at all to drag into. Every level of the
     tree now carries its own "+".
     All three measure the live DOM (like the toolbar and the hidden badges)
     rather than deriving geometry from `content`, so they line up with what the
     theme actually painted — including Liquid canvases the editor never sees
     the markup of. ------------------------------------------------------- */

  /** Every EMPTY container column. An empty column is otherwise invisible, so
   *  its "+" is permanent — the one case where hover is not enough. */
  const emptyCols = useMemo<
    { index: number; colPath: number[]; rect: DOMRect }[]
  >(() => {
    if (previewMode || !content || !rootRef.current) return []
    const out: { index: number; colPath: number[]; rect: DOMRect }[] = []
    rootRef.current
      .querySelectorAll<HTMLElement>("[data-col]")
      .forEach((el) => {
        if (directWidgetCount(el) > 0) return
        const sec = ownerSectionEl(el)
        const colPath = parseColPath(el.getAttribute("data-col"))
        if (!sec || !colPath) return
        const index = Number(sec.dataset.cmsIdx)
        if (!Number.isFinite(index)) return
        out.push({ index, colPath, rect: geom.rectOf(el) })
      })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, previewMode, geomVersion])

  /** The hovered column, when it already HOLDS widgets — its "+" straddles the
   *  bottom edge so it never sits on top of the content it would follow. */
  const hoverColBox = useMemo(() => {
    if (previewMode || !hoveredCol || !rootRef.current) return null
    const el = rootRef.current.querySelector<HTMLElement>(
      colSelector(hoveredCol.i, hoveredCol.col)
    )
    if (!el) return null
    const wi = directWidgetCount(el)
    // Empty columns are served by `emptyCols` above — never both.
    if (wi === 0) return null
    return {
      index: hoveredCol.i,
      colPath: hoveredCol.col,
      wi,
      rect: geom.rectOf(el),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredCol, content, previewMode, geomVersion])

  /** The selected COLUMN's box (Phase 2B): partner of the outline the
   *  unified pass paints — the overlay renders its "Column N" chip and
   *  compact toolbar from this. Falls back to the SECTION box when the
   *  column has no DOM of its own (collapsed facade: its single implicit
   *  column IS the section box, INTEGRATION-2E §4). */
  const columnBox = useMemo(() => {
    if (previewMode || !selectedCol || !rootRef.current) return null
    const root = rootRef.current
    let facade = false
    let el = root.querySelector<HTMLElement>(
      colSelector(selectedCol.index, selectedCol.colPath)
    )
    if (!el) {
      el = outlineTarget(
        root.querySelector(`[data-cms-idx="${selectedCol.index}"]`)
      )
      facade = true
      if (!el) return null
    }
    return {
      index: selectedCol.index,
      colPath: selectedCol.colPath,
      // Where the toolbar's "add widget" lands: after the column's own
      // widgets — on a facade, after the single commerce widget (wi 1,
      // the same slot the facade add-pill uses; the shell clears `flush`
      // on the structural insert).
      nextWi: facade ? 1 : directWidgetCount(el),
      facade,
      rect: geom.rectOf(el),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCol, content, previewMode, geomVersion])

  /** The widget the compact toolbar attaches to: hovered, else selected —
   *  the same "hovered beats selected" rule the section toolbar uses. */
  const widgetBox = useMemo(() => {
    // INLINE (3B): toolbars hide while an editing session is active —
    // the compact widget toolbar otherwise floats over the very words
    // being typed (ARCH-CANVAS §6 mechanic 2).
    if (editingNode) return null
    const w = hoveredW ?? selectedW
    if (previewMode || !w || !rootRef.current) return null
    const el = rootRef.current.querySelector<HTMLElement>(
      widgetSelector(w.index, w.path)
    )
    if (!el) return null
    return { index: w.index, path: w.path, rect: geom.rectOf(el) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredW, selectedW, content, previewMode, geomVersion, editingNode])

  /* Every MUTATING affordance below now dispatches a `cms:cmd` envelope
     (Phase 2B sender migration): the shell validates the name against the
     command registry and routes it through the executor — one history,
     selection and canvas-sync path. Selection intents and palette/template
     side-effects still travel their legacy messages (they are not
     registry commands). */

  /** Commit a picked widget into a column (the shell's widget.insert). */
  const insertWidget = (
    index: number,
    colPath: number[],
    wi: number,
    widgetType: string
  ) =>
    postCommandToShell({
      name: "widget.insert",
      args: { index, colPath, wi, type: widgetType },
    })

  /** Widget toolbar actions — structural ones ride the bus (the same
   *  commands the shell's context-menu wrappers execute); everything else
   *  keeps the legacy ctxAction route (clipboard/style are shell-owned). */
  const widgetAction = (action: string, index: number, path: number[]) => {
    if (action === "duplicate") {
      postCommandToShell({ name: "widget.duplicate", args: { index, path } })
    } else if (action === "delete") {
      postCommandToShell({ name: "widget.remove", args: { index, path } })
    } else {
      postToShell({
        type: "cms:ctxAction",
        action,
        scope: "widget",
        index,
        path,
      })
    }
  }

  /** Select a widget so the panel opens ITS settings (breadcrumb and all). */
  const selectWidget = (index: number, path: number[]) => {
    setSel({ t: "widget", i: index, path })
    postToShell({ type: "cms:clickedWidget", index, path })
  }

  /** Select a section (the column toolbar's "parent section" hop). */
  const selectSection = (index: number) => {
    setSel({ t: "section", i: index })
    postToShell({ type: "cms:clicked", index })
  }

  // Preview mode: strip every editor outline once so the page renders clean.
  useEffect(() => {
    if (!previewMode) return
    // A picker left open when Preview is switched on would be the one piece of
    // editor chrome still floating over a "live" page. Close it.
    setPicker(null)
    setHover(null)
    const root = rootRef.current
    if (!root) return
    root
      .querySelectorAll<HTMLElement>(
        "[data-cms-idx],[data-el],[data-w],[data-col],[data-cms-chrome]"
      )
      .forEach((el) => {
        el.style.outline = ""
        el.style.outlineOffset = ""
      })
  }, [previewMode, content])

  const handleMouseMove = (e: React.MouseEvent) => {
    // ONE hit-test resolves every level under the pointer; the containment
    // guards the old inline closest() chains applied live inside hitTest().
    const hit = hitTest(e.target)
    // Pointer over the floating toolbar overlay: keep the current hover instead
    // of clearing it (clearing unmounts the toolbar under the cursor -> blink).
    if (hit.overlay) return
    if (previewMode) return
    // ONE hover value (Phase 2B): the INNERMOST node under the pointer, by
    // the same priority ladder the click handler applies (widget beats
    // element beats column beats section; chrome element beats its region).
    // Everything the five hovered* states used to carry — the section whose
    // toolbar lights, the widget outline, the column add-pill — derives
    // from this single NodeRef (hovered / hoveredW / hoveredCol above).
    setHover(refOfNodeHit(innermostOf(hit)))
  }

  /** Section toolbar actions — structural ones ride the bus (Phase 2B);
   *  edit / addBelow stay legacy: they are selection + palette
   *  side-effects, not registry commands. */
  const canvasAction = (action: string, index: number) => {
    if (action === "up" || action === "down") {
      const to = action === "up" ? index - 1 : index + 1
      if (to < 0 || (content != null && to >= content.length)) return
      postCommandToShell({ name: "section.move", args: { from: index, to } })
    } else if (action === "duplicate") {
      postCommandToShell({ name: "section.duplicate", args: { index } })
    } else if (action === "delete") {
      postCommandToShell({ name: "section.remove", args: { index } })
    } else {
      postToShell({ type: "cms:action", action, index })
    }
  }

  /* ------------- Drag-and-drop (CANVAS P5 / 3A) ------------------------
     ONE resolver (dnd.resolveDrop) turns pointer + hit chain + drag
     capabilities into the one DropTarget; ONE commit (dnd.commandForDrop)
     turns payload + target into the bus command — the full move matrix:
     palette→(seam|column|facade), widget grip/navigator row→(same-column
     reorder | other column | other section | facade), section grip→seam.
     The gap the merchant sees is a REAL in-flow placeholder element the
     DropPlaceholder controller opens at the resolved slot. */

  const clearDropHints = () => {
    setDropTarget((d) => (d == null ? d : null))
    dropPh.current?.clear()
  }

  // Same-window drag lifecycle: mirror the payload (readable during
  // dragstart) so dragover can tell moves from inserts + size the gap to
  // the dragged node; clean up on dragend (fires on drop AND on Esc —
  // the browser cancels the drag, so `drop` never arrives) and on Esc
  // directly for shell-origin drags whose dragend fires in the shell.
  useEffect(() => {
    const onDragStart = (e: DragEvent) =>
      noteDragStart(e.dataTransfer, e.target as Element | null)
    const onDragEnd = () => {
      noteDragEnd()
      clearDropHints()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDragEnd()
    }
    window.addEventListener("dragstart", onDragStart)
    window.addEventListener("dragend", onDragEnd)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("dragstart", onDragStart)
      window.removeEventListener("dragend", onDragEnd)
      window.removeEventListener("keydown", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    const caps = dragCaps(e.dataTransfer)
    if (!caps) return
    // Preview mode is inert: no preventDefault → the browser refuses the
    // drop, and no placeholder ever opens.
    if (previewMode || !rootRef.current || !content) return
    // Required so the browser fires `drop` on this target.
    e.preventDefault()
    e.dataTransfer.dropEffect = caps.move ? "move" : "copy"
    // Edge auto-scroll while dragging (WS5): tall pages stay reachable.
    if (e.clientY < 70) window.scrollBy(0, -18)
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 18)
    const target = resolveDrop({
      root: rootRef.current,
      target: e.target,
      clientY: e.clientY,
      dt: e.dataTransfer,
      content,
    })
    setDropTarget((d) => (dropTargetEq(d, target) ? d : target))
    ;(dropPh.current ??= new DropPlaceholder()).sync(
      target,
      rootRef.current,
      activeDrag()?.height ?? 48
    )
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when the drag actually leaves the canvas root (dragleave also
    // fires on every internal element boundary).
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    clearDropHints()
  }

  const handleDrop = (e: React.DragEvent) => {
    const decoded = decodeDrag(e.dataTransfer)
    if (!decoded) return
    e.preventDefault()
    e.stopPropagation()
    if (previewMode || !rootRef.current || !content) {
      clearDropHints()
      return
    }
    // Resolve against the same layout the last dragover showed (the
    // placeholder is still in the flow), THEN close the gap, THEN commit.
    const target = resolveDrop({
      root: rootRef.current,
      target: e.target,
      clientY: e.clientY,
      dt: e.dataTransfer,
      content,
    })
    clearDropHints()
    if (!target) return
    const cmd = commandForDrop(decoded, target, content)
    if (cmd) postCommandToShell(cmd)
  }

  const handleClickCapture = (e: React.MouseEvent) => {
    if (previewMode) {
      e.preventDefault()
      return
    }
    // ONE hit-test; the priority ladder below (widget > element > chrome
    // element > COLUMN > link > section > chrome) is the inline closest()
    // version's ladder plus the Phase 2B column rung.
    const hit = hitTest(e.target)

    /* ---------------- Inline editing (CANVAS P6 / 3B) ----------------
       Clicks INSIDE the active editor reach the browser untouched
       (caret placement, word selection). Otherwise, Elementor's
       activation rule: a click on the node that is ALREADY selected
       enters inline mode — a double-click lands here too (its first
       click selects; its second finds the selection in place). Gated
       by the previewMode return above, like every mutating affordance. */
    if (inline.containsNode(e.target)) return
    const inlineTarget = resolveInlineTarget(hit, contentRef.current)
    if (inlineTarget && refEq(sel, refOfNodeHit(innermostOf(hit)))) {
      e.preventDefault()
      e.stopPropagation()
      inline.start(inlineTarget, { x: e.clientX, y: e.clientY })
      return
    }

    // WIDGET-LEVEL (Composer W1): a click inside a [data-w] widget WITHIN a
    // container section selects that widget for editing — highest priority,
    // above the element/link handling below, so e.g. a button widget (an
    // <a data-w="w-0-1">) is selectable without navigating.
    if (hit.widget) {
      e.preventDefault()
      e.stopPropagation()
      const { index: idx, path } = hit.widget
      setSel({ t: "widget", i: idx, path })
      postToShell({ type: "cms:clickedWidget", index: idx, path })
      return
    }

    // ELEMENT-LEVEL (E1): a click inside a [data-el] element WITHIN a section
    // selects that element for styling instead of the section — and takes
    // priority over the link/section handling below, so e.g. the hero button
    // (an <a data-el="button">) is selectable without navigating.
    if (hit.element) {
      e.preventDefault()
      e.stopPropagation()
      const { index: idx, key: elementKey } = hit.element
      setSel({ t: "element", i: idx, el: elementKey })
      postToShell({ type: "cms:clickedElement", index: idx, elementKey })
      return
    }

    // CHROME ELEMENT-LEVEL (F1): a click inside a [data-el] element WITHIN a
    // chrome region ([data-cms-chrome]) selects that element for styling — same
    // priority as section elements (above the link/region handling below), so
    // e.g. clicking a nav item styles the "menu" element instead of navigating.
    if (hit.chromeElement) {
      e.preventDefault()
      e.stopPropagation()
      const { region, key: elementKey } = hit.chromeElement
      setSel({ t: "chromeEl", region, el: elementKey })
      postToShell({ type: "cms:clickedChromeElement", region, elementKey })
      return
    }

    // COLUMN-LEVEL (Phase 2B — the owner's ask, verbatim: "I cannot even
    // select the column"). A click inside a [data-col] that did NOT land on
    // a widget or a theme element — the column's padding, its empty area,
    // the gaps between its widgets — selects the COLUMN. On a collapsed
    // facade there is no [data-col] in the DOM, so clicks on themed areas
    // keep resolving to element / section exactly as before.
    if (hit.column) {
      e.preventDefault()
      e.stopPropagation()
      const { index: idx, colPath } = hit.column
      setSel({ t: "column", i: idx, col: colPath })
      postToShell({ type: "cms:clickedColumn", index: idx, colPath })
      return
    }

    // Clicking a real link asks the parent to open that page for editing if
    // it's a CMS page — otherwise the parent falls back to selecting the
    // containing section so the click is never dead.
    //
    // NOT inside chrome. The header and footer are THEMSELVES the editable
    // objects, and they are made almost entirely of links (logo, nav, social),
    // so this branch swallowed nearly every click on them: the logo points at
    // "/", that resolves to the home CMS page, and the editor RELOADED instead
    // of selecting the header — which is why the panel snapped back to
    // Elements. Inside chrome, selection always wins; page navigation lives in
    // the Page dropdown.
    const chromeHit = hit.chrome
    const href = hit.anchor?.getAttribute("href")
    if (hit.anchor && href && href !== "#" && !chromeHit) {
      e.preventDefault()
      e.stopPropagation()
      postToShell({
        type: "cms:linkClick",
        href,
        index: hit.section ? hit.section.index : null,
        // Unreachable inside chrome now (the guard above) — always a page link.
        chromeKey: null,
      })
      return
    }

    if (hit.section) {
      e.preventDefault()
      e.stopPropagation()
      const idx = hit.section.index
      setSel({ t: "section", i: idx })
      postToShell({ type: "cms:clicked", index: idx })
      return
    }
    if (chromeHit) {
      e.preventDefault()
      e.stopPropagation()
      const k = chromeHit.region
      setSel({ t: "chrome", region: k })
      postToShell({ type: "cms:clickedChrome", key: k })
      return
    }

    /* GEOMETRIC FALLBACK — the header and footer are always selectable.
       Everything above resolves through the DOM chain, which is correct until
       something transparent sits on top: an editor affordance, a theme's
       absolutely-positioned nav wrapper, a decorative layer. Then the click
       resolves to a node that belongs to no editor object and DIES SILENTLY,
       which reads as "the header is not clickable". Chrome regions are fixed,
       known bands, so fall back to geometry: a click inside the region's box
       belongs to that region, whatever happens to be painted over it. */
    for (const region of ["header", "topbar", "footer"] as const) {
      const el = document.querySelector<HTMLElement>(
        `[data-cms-chrome="${region}"]`
      )
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      ) {
        e.preventDefault()
        e.stopPropagation()
        setSel({ t: "chrome", region })
        postToShell({ type: "cms:clickedChrome", key: region })
        return
      }
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

  // The theme's header / footer, from the loaded Liquid bundle (null until it
  // resolves — there is no React fallback theme to stand in).
  const ThemeHeader = canvasTheme?.Header
  const ThemeFooter = canvasTheme?.Footer

  // Is the real theme ready to paint?
  //
  // Derived SYNCHRONOUSLY rather than read from `liquidPending`, which starts
  // false and is only flipped true inside the effect above — that effect cannot
  // run until `platformTheme` has arrived, so there was exactly one paint where
  // chromeLoaded was already true, liquidPending still false and liquidCanvas
  // still null. Knowing the store HAS an uploaded theme is enough to keep the
  // loading state up, releasing on `liquidFailed` so a bundle that genuinely
  // fails moves to the explicit failure state rather than hanging on a blank
  // canvas.
  const themeNotReady =
    !chromeLoaded || (!!platformTheme && !liquidCanvas && !liquidFailed)

  // The EXPLICIT failure state (ARCH-CORE §3.1, Phase 2). The silent React
  // fallback is deleted: when the bundle cannot load (loadCanvasLiquid
  // returned null / threw, or the chrome fetch never resolved a theme
  // handle), the canvas says so and offers Retry — a WYSIWYG editor that
  // silently shows a different theme is worse than one that says it failed.
  const themeFailed = !themeNotReady && !canvasTheme

  return (
    <div
      ref={rootRef}
      onContextMenu={(e) => {
        if (previewMode) return
        // ONE hit-test; the innermost-wins ladder (widget beats element beats
        // section; chrome element beats its region) is unchanged.
        const hit = hitTest(e.target)

        // Not in a section: maybe in the header / top bar / footer (chrome).
        if (!hit.section) {
          if (!hit.chrome) return
          e.preventDefault()
          const region = hit.chrome.region
          const regionLabel =
            region === "topbar" ? "Top Bar" : region === "footer" ? "Footer" : "Header"
          if (hit.chromeElement) {
            setCtxMenu({
              x: e.clientX,
              y: e.clientY,
              index: -1,
              scope: "chromeElement",
              label: `${regionLabel} — ${hit.chromeElement.key.replace(/[_-]+/g, " ")}`,
              region,
              elementKey: hit.chromeElement.key,
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

        const idx = hit.section.index
        e.preventDefault()

        // Repeated-item context: is the cursor inside one slide / tile /
        // testimonial? Carried alongside whatever scope resolves below, so the
        // menu can offer "Duplicate Slide" on top of the element's own actions.
        const itemInfo = hit.item
          ? {
              itemField: hit.item.field,
              itemIndex: hit.item.index,
              itemLabel: `${ITEM_LABELS[hit.item.field] ?? "Item"} ${hit.item.index + 1}`,
            }
          : {}

        // Resolve the INNERMOST thing under the cursor. Right-clicking a button
        // and being offered "duplicate the whole section" is not what anybody
        // means: a widget beats an element beats the section.
        if (hit.widget) {
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            index: idx,
            scope: "widget",
            label: isNestedPath(hit.widget.path)
              ? "Widget (in inner section)"
              : "Widget",
            path: hit.widget.path,
          })
          return
        }

        if (hit.element) {
          setCtxMenu({
            x: e.clientX,
            y: e.clientY,
            index: idx,
            scope: "element",
            label: `Element — ${hit.element.key.replace(/[_-]+/g, " ")}`,
            elementKey: hit.element.key,
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
      onDoubleClickCapture={(e) => {
        // INLINE (3B): double-click activation — covers the case where
        // the selection mirror lagged the first click of the pair, so
        // Elementor's "double-click to type" always works in one gesture.
        // Preview mode is fully inert (same gate as every affordance).
        if (previewMode) return
        const hit = hitTest(e.target)
        if (hit.overlay || inline.containsNode(e.target)) return
        const t = resolveInlineTarget(hit, contentRef.current)
        if (!t) return
        e.preventDefault()
        e.stopPropagation()
        // Select what the click ladder would have (panel + overlay stay
        // in sync — the first click already posted the clicked intent),
        // then hand the node to the editor with the caret at the cursor.
        setSel(refOfNodeHit(innermostOf(hit)))
        inline.start(t, { x: e.clientX, y: e.clientY })
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
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

      {/* Per-section scoped style (base + responsive @media), generated by the
          shared style-engine. SectionItem puts the `.cms-sec-sec-<idx>` class
          on the wrapper, and the Liquid sections carry [data-el] markers, so
          per-element rules
          (`.cms-sec-<id> [data-el="button"]{padding-top:…}`) resolve against the
          theme markup identically. Gating this on the Liquid canvas being
          absent was the bug that made Style-tab edits (e.g. a button's
          padding) silently no-op on uploaded themes: the CSS was built on
          every cms:patch and then never mounted. */}
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

      {/* Editor-only (3C): ghost rules for nodes hidden on the previewed
          device — sections, elements, columns, widgets, chrome elements dim
          to 40% instead of vanishing (their display:none is suppressed via
          { hide:false } above), so the author can still select them. Never
          emitted in production. */}
      {hiddenCss ? (
        <style dangerouslySetInnerHTML={{ __html: hiddenCss }} />
      ) : null}

      {/* EVERY fixed-position editor affordance, in one layer (CANVAS P1):
          hidden badges, drop indicators, section toolbar + label, column add
          pills, widget toolbar, section add pills, widget picker, element
          badge, font pill, context menu. Mounted HERE — where the extracted
          JSX used to sit — so DOM order (and equal-z stacking) is unchanged. */}
      <OverlayLayer
        previewMode={previewMode}
        stageActive={!!stage}
        device={device}
        contentLength={content.length}
        activeIdx={activeIdx}
        onToolbarHold={setHeldIdx}
        activeBlock={activeBlock}
        activeRect={activeRect}
        hiddenBadges={hiddenBadges}
        selectHidden={selectHidden}
        emptyCols={emptyCols}
        hoverColBox={hoverColBox}
        widgetBox={widgetBox}
        columnBox={columnBox}
        selectSection={selectSection}
        dropTarget={dropTarget}
        elBadge={elBadge}
        fontPill={fontPill}
        selectedEl={selectedEl}
        fontDragRef={fontDragRef}
        fontPxRef={fontPxRef}
        setFontPill={setFontPill}
        paintInlineFont={paintInlineFont}
        releaseInlineFont={releaseInlineFont}
        picker={picker}
        setPicker={setPicker}
        insertWidget={insertWidget}
        ctxMenu={ctxMenu}
        setCtxMenu={setCtxMenu}
        clip={clip}
        canvasAction={canvasAction}
        widgetAction={widgetAction}
        selectWidget={selectWidget}
        /* 3F: selection-anchored AI surface (ARCH-AI §2). */
        ai={{ sel, content, chrome, geom, brand: brandName }}
        /* --- 5B stage: the hero toolbar's "Edit slide" / "Convert to
           layered slide" entry (ARCH-SLIDER §3.1). --- */
        sliderStage={
          !previewMode && activeIdx != null
            ? sliderKindOf(content, activeIdx)
            : null
        }
        onStageEnter={enterStage}
        /* --- 6B: "Convert to widgets" on the two convertible themed
           sections (rich_text / image_with_text — facade or flat). The
           gate mirrors the command's own acceptance: facadeOf resolves
           the themed type exactly when flushSingleCommerceWidget (or the
           flat shape) will bless the conversion. --- */
        convertToWidgets={
          !previewMode && activeBlock
            ? CONVERTIBLE_SECTION_TYPES.has(
                facadeOf(activeBlock as any).iconType
              )
            : false
        }
        onConvertToWidgets={convertToWidgets}
      />

      {/* --- 5B stage: the takeover itself (ARCH-SLIDER §3) — editor
          canvas ONLY, never preview (both gated here), scrim +
          scroll-lock + filmstrip + layer rail + drag/resize/snap
          overlay. Every gesture posts one slider.* command envelope. */}
      {stage && !previewMode && content ? (
        <StageMode
          index={stage.index}
          content={content}
          device={device}
          externalChrome={stageChromeExternal}
          lockedIds={stageChromeExternal ? stageLocks : undefined}
          sel={stageSel}
          onSelectSlide={(slideId) => {
            const s = stageRef.current
            if (!s) return
            setStageSel({ slideId, layerId: null })
            setSel({ t: "sliderSlide", i: s.index, slideId })
            postToShell({
              type: "cms:clickedSliderSlide",
              index: s.index,
              slideId,
            })
          }}
          onSelectLayer={(layerId) => {
            const s = stageRef.current
            const slideId = stageSelRef.current.slideId
            if (!s || !slideId) return
            setStageSel({ slideId, layerId })
            setSel(
              layerId
                ? { t: "sliderLayer", i: s.index, slideId, layerId }
                : { t: "sliderSlide", i: s.index, slideId }
            )
            if (layerId) {
              postToShell({
                type: "cms:clickedSliderLayer",
                index: s.index,
                slideId,
                layerId,
              })
            } else {
              postToShell({
                type: "cms:clickedSliderSlide",
                index: s.index,
                slideId,
              })
            }
          }}
          onExit={exitStage}
        />
      ) : null}
      {/* --- end 5B stage --- */}

      {/* Header (editable chrome) — the theme's own header, so the canvas
          chrome matches the live storefront. Mounted only once the Liquid
          bundle is loaded: there is no fallback header to flash in first. */}
      {ThemeHeader ? (
        <div data-cms-chrome="header" style={chromeOutline("header")}>
          <ThemeHeader
            cartCount={0}
            categories={(chrome.categories ?? []) as any}
            topbar={chrome.topbar ?? null}
            header={chrome.header ?? null}
            locale={locale === "bn" ? "bn" : "en"}
          />
        </div>
      ) : null}

      {/* While the theme's bundle is still loading nothing themed exists to
          paint. A brief blank reads as loading, not as the wrong theme. */}
      {themeNotReady ? (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9aa0a6",
            font: "500 14px/1.4 Inter, system-ui, sans-serif",
          }}
        >
          Loading theme…
        </div>
      ) : null}

      {/* THE EXPLICIT FAILURE STATE (Phase 2). The React fallback theme this
          canvas used to silently swap in is deleted — the documented
          multi-hour trap ("theme edit does nothing"). When the bundle cannot
          load, say so and offer Retry through the existing loaders. */}
      {themeFailed ? (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontFamily: font,
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ ...type.title, color: grey[70] }}>
            Theme failed to load
          </div>
          <div style={{ font: `400 13px/1.5 ${font}`, color: grey[50], maxWidth: 440 }}>
            The store&apos;s theme bundle could not be loaded, so the canvas
            cannot show this page. Your content is safe — retry, or reload the
            editor if this keeps happening.
          </div>
          <button
            type="button"
            onClick={() => {
              setLiquidFailed(false)
              setRetryTick((t) => t + 1)
            }}
            style={{
              marginTop: 6,
              padding: "9px 22px",
              font: `600 13px/1 ${font}`,
              color: "#fff",
              background: grey[90],
              border: "none",
              borderRadius: radius.md,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Page body — under the theme's body className, only once the theme
          is genuinely loaded (no fallback body exists to hide). */}
      {canvasTheme ? (
      <div className={canvasTheme.bodyClassName}>
        {content.map((block, i) => (
          <React.Fragment key={i}>
            {!previewMode && <SectionInsertBar index={i} />}
            <SectionItem idx={i} block={block} blocks={canvasTheme.blocks} />
          </React.Fragment>
        ))}
        {/* 7A: the full-screen stage shows the SLIDE, not the page it sits
            in. Collapsing every other section (and the theme chrome) puts the
            staged section at the top of the canvas box, so the centre region
            is the slide — RevSlider's framing. display:none (not visibility)
            on purpose: the layout must collapse, or the slide keeps its old
            offset and the stage has to scroll to find it. */}
        {stage && stageChromeExternal ? (
          <style>{`
            [data-cms-idx]:not([data-cms-idx="${stage.index}"]) { display: none !important; }
            [data-cms-chrome] { display: none !important; }
          `}</style>
        ) : null}
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
          /* The empty column now carries a real "+ Add widget" button (see
             emptyCols above), so the box only has to BE somewhere — the
             instruction moved onto the control itself. The old "Drag widget
             here" label sat exactly where that button lands and read as a
             second, competing affordance. */
          .ff-container-col:empty::after {
            content: "";
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
              border: `2px dashed ${dropTarget ? accent.base : grey[20]}`,
              borderRadius: radius.lg,
              background: dropTarget ? accent.tint : grey[5],
              color: dropTarget ? accent.active : grey[50],
              transition: `border-color ${motion.fast}, background ${motion.fast}, color ${motion.fast}`,
            }}
          >
            Drag a section here — or use + Add section
          </div>
        )}
        {!previewMode && <AddSectionZone count={content.length} />}
      </div>
      ) : null}

      {/* Footer (editable chrome) — the theme's own footer view, so the
          canvas footer matches the live storefront for this theme. */}
      {chrome.footer && ThemeFooter ? (
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
