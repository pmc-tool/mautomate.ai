"use client"

/* ------------------------------------------------------------------ */
/* Visual editor — PARENT                                               */
/*                                                                     */
/* An iframe of the page's REAL Learts rendering (editor-canvas) plus a  */
/* side panel. Click a section in the iframe (or the list) to select it; */
/* edit its fields in the panel; changes stream to the iframe live via   */
/* postMessage. Publish pushes through the real snapshot pipeline.       */
/* Gated by `key` (verified server-side in the load/publish routes).     */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CommandPalette } from "../../../modules/cms/editor/CommandPalette"
import { TemplateLibrary } from "../../../modules/cms/editor/TemplateLibrary"
import {
  loadPresets,
  savePreset,
  presetsForType,
  type StylePreset,
} from "../../../modules/cms/editor/presets"
import NavigatorTree from "../../../modules/cms/editor/NavigatorTree"
import NewPageModal from "../../../modules/cms/editor/NewPageModal"
import { AiPanel } from "../../../modules/cms/editor/AiPanel"
import { useParams, useSearchParams } from "next/navigation"

import FieldEditor from "@modules/cms/editor/FieldEditor"
import SchemaPanel from "@modules/cms/editor/SchemaPanel"
import type { Tokens } from "@modules/cms/editor/style-controls"
// 3E (link picker): the store's CMS pages, provided once for every
// SchemaPanel mount below — LinkControl offers them alongside the
// standard storefront routes.
import { LinkPagesProvider } from "@modules/cms/editor/style-controls"
import ContainerColumnsEditor, {
  reconcileColumns,
  type Column,
  type Widget,
} from "@modules/cms/editor/ContainerColumnsEditor"
import { CatalogProvider } from "@modules/cms/editor/CatalogContext"
import {
  PaletteIcon,
  UiIcon,
  IconButton,
} from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  eyebrow,
  field,
  font,
  grey,
  hairline,
  hairlineDark,
  iconButton,
  ink,
  motion,
  radius,
  semantic,
  shadow,
  type,
} from "@modules/cms/editor/design"
import { getBlockSchema, getWidgetSchema } from "@modules/cms/schema"
import { CHROME_SCHEMAS, getChromeSchema } from "@modules/cms/schema/chrome"
/* 3C: the single device-write path + the real resolution cascade. */
import { resolveResponsive, writeResponsive } from "@modules/cms/schema/types"
import { getElementDefs, getChromeElementDefs } from "@modules/cms/render/element-registry"
import type { ElementStyles } from "@modules/cms/render/style-engine"
import {
  clipSummary,
  deepMergeBag,
  readClipboard,
  writeClip,
  type StyleClip,
} from "@modules/cms/editor/clipboard"
/* Typed shell<->canvas protocol (CANVAS P1): same wire format as the raw
   postMessage calls it replaces — every message is now typed + greppable. */
import {
  onMessage,
  postToCanvas,
} from "@modules/cms/editor/canvas/protocol"
/* Phase 1 (seat 1C): universal normalization + facade labeling, from seat
   1A's document module. flushSingleCommerceWidget is the shared facade
   predicate (flush + 1 column + 1 commerce widget → the inner widget). */
import { normalizeDocument } from "@modules/cms/document/normalize"
import { facadeOf, flushSingleCommerceWidget } from "@modules/cms/document/facade"
/* Phase 2 (seat 2C): the panel dock — five tabs re-housing the panel's
   information architecture (ARCH-UX U2). ElementsPane is the palette body
   2C extracted from ElementsPalette so the dock can host it directly. */
import Dock, { useDockTab } from "@modules/cms/editor/dock/Dock"
import PagePane from "@modules/cms/editor/dock/PagePane"
import HistoryPane from "@modules/cms/editor/dock/HistoryPane"
import FacadeSectionSettings from "@modules/cms/editor/dock/FacadeSectionSettings"
import { ElementsPane } from "@modules/cms/editor/ElementsPalette"
/* Phase 2 (seat 2E): columns carry style bags — the column form's field
   subset (derived from the universal lists, never re-authored). */
import {
  COLUMN_STYLE_FIELDS,
  COLUMN_ADVANCED_FIELDS,
} from "@modules/cms/schema/universal/column"
/* Phase 2A: the command bus. Every mutation is a named domain.verb command
   executed in ONE place (the executor); the registry's run bodies are the
   old mutators re-homed as pure functions; history is labeled per-command
   entries (chrome included, selection restored) with the pre-M3 snapshot
   path compiled in behind history.ts's runtime flag. */
import {
  applyAiPatchesPure,
  columnAtPath as columnAtPathPure,
  hasCommand,
  widgetsAtPath as widgetsAtPathPure,
  type Command,
  type CommandName,
} from "@modules/cms/editor/commands/registry"
import {
  createExecutor,
  type Executor,
  type ExecutorHost,
  type ExecuteOptions,
} from "@modules/cms/editor/commands/executor"
/* --- 5B stage: slider selection panel (ARCH-SLIDER §3.1). The stage
   itself lives in the CANVAS route; the shell's whole surface is (a) the
   slider.* cmdSink entries with selection side-effects and (b) the
   SchemaPanel mounts for sliderLayer / sliderSlide selection below. --- */
import {
  findLayer,
  findSlide,
  readSliderHost,
  slidesOfHost,
} from "@modules/cms/editor/slider/stage-commands"
import {
  layerDisplayName,
  type LayerFrame,
  type SliderLayer as StageSliderLayer,
} from "@modules/cms/editor/slider/model-5a"
/* --- 7A: the stage's chrome now lives HERE (the shell), full-screen.
   The canvas keeps only the manipulation overlay; see StageChrome's
   header for the layout and the division of labour. ------------------ */
import StageChrome, {
  BOTTOM_H as STAGE_BOTTOM_H,
  SIDEBAR_W as STAGE_SIDEBAR_W,
  SLIDESTRIP_H as STAGE_SLIDESTRIP_H,
  TOPBAR_H as STAGE_TOPBAR_H,
} from "@modules/cms/editor/slider/StageChrome"
import {
  defaultLayerOf,
  defaultSlide,
  isLayeredSlide,
  newSliderId,
  type LayeredSlide,
  type SliderLayerType,
} from "@modules/cms/editor/slider/model-5a"
/* 6C composition root: the shell's server round-trips (autosave / chrome
   save / publish / the puck wire shape), the pure canvas-link resolver,
   the theme-token builder and the panel's presentational bits — all
   extracted VERBATIM from this file into modules. */
import {
  autosaveDraft,
  fetchChrome,
  fetchPages,
  loadPageDocument,
  publishPage,
  resolveCmsLink,
  saveChromeRegion,
} from "@modules/cms/editor/shell/persist"
import { buildEditorThemeTokens } from "@modules/cms/editor/shell/theme-tokens"
import {
  FF_DEFAULT_COLORS,
  FF_DEFAULT_FONTS,
  normalizeThemeTokenOverrides,
} from "@modules/cms/render/theme-vars"
import {
  ChromeRow,
  ClipStrip,
  DEVICES,
  DEVICE_WIDTH,
  backLink,
  deviceBtn,
  presetSelect,
  styleActionBtn,
} from "@modules/cms/editor/shell/panel-bits"
import {
  FrameControls,
  LAYER_ADVANCED_FIELDS,
  LAYER_ANIM_FIELDS,
  LAYER_CONTENT_FIELDS,
  LAYER_STYLE_FIELDS,
  SLIDE_CONTENT_FIELDS,
  assembleSlideEdit,
  layerPanelProps,
  slidePanelProps,
  splitLayerEdit,
} from "@modules/cms/editor/slider/layer-panel"

type Section = { block_type: string; [k: string]: unknown }

/**
 * WHAT is selected, as one value. The panel and canvas used to juggle five
 * mutually exclusive useStates, each cleared by hand at a dozen call sites —
 * miss one and two things are "selected" at once. Selection now changes only
 * through select() below, which derives all five from this.
 */
type Sel =
  | { kind: "section"; index: number }
  | { kind: "column"; index: number; colPath: number[] } // 2E
  | { kind: "element"; index: number; key: string }
  | { kind: "widget"; index: number; path: number[] }
  | { kind: "chrome"; region: string }
  | { kind: "chromeElement"; region: string; key: string }
  /* 5B: slider stage selection (ARCH-SLIDER §3.3) — id-targeted so
     filmstrip / rail reorders never invalidate what is selected. */
  | { kind: "sliderSlide"; index: number; slideId: string }
  | { kind: "sliderLayer"; index: number; slideId: string; layerId: string }
  | null

function getEditorKeyFromCookie(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|; )ff_editor_key=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ""
}

// Where "Exit editor" returns to (the admin Site Management page).
const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const EXIT_HREF = "/dashboard/design"

const BLOCK_LABELS: Record<string, string> = {
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

/* Facade labeling (ARCH-CORE §1.4): a flush single-commerce-widget container
   (normalizeDocument's wrapper) presents as its INNER block everywhere the
   UI names a section — "Hero Slider", not "Container / Columns". Structure
   (expansion, column/widget affordances, container fields) is untouched:
   only the name and icon change. Multi-widget / multi-column containers are
   not facades and keep container presentation. */
const displayTypeOf = (s: Section): string =>
  (flushSingleCommerceWidget(s)?.widget_type as string | undefined) ??
  s.block_type

const displayLabelOf = (s: Section): string => {
  const t = displayTypeOf(s)
  return BLOCK_LABELS[t] ?? t
}

export default function VisualEditor() {
  const params = useParams<{ slug: string }>()
  const search = useSearchParams()
  const slug = params?.slug ?? "home"
  const locale = search.get("locale") || "en"
  const [key, setKey] = useState(search.get("key") || "")

  useEffect(() => {
    if (key) return
    const fromCookie = getEditorKeyFromCookie()
    if (fromCookie) setKey(fromCookie)
  }, [key])

  const [content, setContent] = useState<Section[] | null>(null)
  /** Seam the template library was opened at (null = use the selection/end). */
  const [templateAt, setTemplateAt] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  // Element-level selection (E1): the specific [data-el] element inside a
  // section being styled. Mutually exclusive with `selected` (section) and
  // `selectedChrome`. Set from the canvas's cms:clickedElement message.
  const [selectedElement, setSelectedElement] = useState<{
    index: number
    key: string
  } | null>(null)
  // One-time: inject the "flash a field" highlight animation.
  useEffect(() => {
    if (document.getElementById("cms-field-flash-style")) return
    const st = document.createElement("style")
    st.id = "cms-field-flash-style"
    st.textContent =
      "@keyframes cms-ff{0%,100%{box-shadow:none;background:transparent}18%{box-shadow:0 0 0 2px #F26522,0 0 0 6px rgba(242,101,34,.18);background:rgba(242,101,34,.06)}}.cms-field-flash{animation:cms-ff 1.5s ease;border-radius:8px;scroll-margin:80px}"
    document.head.appendChild(st)
  }, [])
  // "Jump to field" (E1 UX): when an element is clicked in the canvas, scroll the
  // panel to that element's field and flash it — so the block's whole form stays
  // visible but the user sees exactly what they picked. A [data-el] key is a
  // design label, not always the field name, so match by name, then label, then
  // a small set of semantic aliases.
  useEffect(() => {
    if (!selectedElement?.key) return
    const key = selectedElement.key.toLowerCase()
    const ALIASES: Record<string, string[]> = {
      button: ["cta", "link", "label", "button"],
      heading: ["title", "heading"],
      title: ["title", "handle", "heading"],
      kicker: ["subtitle", "kicker", "eyebrow"],
      text: ["subtitle", "body", "description", "text", "excerpt", "content"],
      body: ["body", "description", "text"],
      image: ["image", "logo", "photo", "cover"],
      logo: ["image", "logo"],
      countdown: ["countdown_to", "countdown"],
      content: ["html", "content", "body"],
      label: ["label", "title"],
      caption: ["caption"],
      quote: ["quote"],
      author: ["author"],
      tile: ["items"],
      item: ["items", "categories", "slides", "brands", "images"],
      sale: ["sale"],
      intro: ["intro"],
      instagram: ["instagram"],
      input: ["placeholder", "input"],
      form: ["placeholder", "button"],
      grid: ["images"],
    }
    const cands = [key, ...(ALIASES[key] || [])]
    const timer = setTimeout(() => {
      let el: HTMLElement | null = null
      for (const c of cands) {
        el = document.querySelector<HTMLElement>(`[data-fk="${c}"]`)
        if (!el) {
          el =
            Array.from(document.querySelectorAll<HTMLElement>("[data-fkl]")).find(
              (x) => (x.getAttribute("data-fkl") || "").includes(c)
            ) || null
        }
        if (el) break
      }
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" })
        el.classList.add("cms-field-flash")
        window.setTimeout(() => el?.classList.remove("cms-field-flash"), 1500)
      }
    }, 70)
    return () => clearTimeout(timer)
  }, [selectedElement])
  // Widget-level selection (Composer W1): a specific widget inside a container
  // section's column — content[index].columns[col].widgets[wi]. Mutually
  // exclusive with the other selections. Set from cms:clickedWidget.
  // A widget is addressed by its PATH — see widgetsAtPath. [col, wi] for a
  // top-level widget; [col, wi, col2, wi2] for one inside an inner section.
  const [selectedWidget, setSelectedWidget] = useState<{
    index: number
    path: number[]
  } | null>(null)
  // Column-level selection (2E): a column of a container section —
  // addressed by section index + odd-length col path ([0] top-level,
  // [0,1,2] inside an inner section). Mutually exclusive with the other
  // selections. Set from the canvas's cms:clickedColumn message.
  const [selectedColumn, setSelectedColumn] = useState<{
    index: number
    colPath: number[]
  } | null>(null)
  const [chrome, setChrome] = useState<Record<string, Record<string, unknown>>>({})
  const [selectedChrome, setSelectedChrome] = useState<string | null>(null)
  // Chrome element-level selection (F1): the specific [data-el] element inside a
  // chrome region being styled (chrome[region].elementStyles[key]). Mutually
  // exclusive with section / element / chrome-region selection. Set from the
  // canvas's cms:clickedChromeElement message.
  const [selectedChromeElement, setSelectedChromeElement] = useState<{
    region: string
    key: string
  } | null>(null)
  /* 5B: slider stage selection (slide-level and layer-level). Mutually
     exclusive with the rest — select() derives them like the others. */
  const [selectedSliderSlide, setSelectedSliderSlide] = useState<{
    index: number
    slideId: string
  } | null>(null)
  const [selectedSliderLayer, setSelectedSliderLayer] = useState<{
    index: number
    slideId: string
    layerId: string
  } | null>(null)
  const [chromeDirty, setChromeDirty] = useState<Set<string>>(new Set())
  // (The old `adding` picker-takeover state is gone — the dock's Elements
  //  tab hosts the full section palette permanently, 2C §3.)
  // Where a newly added section is inserted (null = append to the end).
  const [addTargetIndex, setAddTargetIndex] = useState<number | null>(null)
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([])
  /** The in-editor "Add a new page" dialog (replaces window.prompt). */
  const [newPageOpen, setNewPageOpen] = useState(false)
  // History lives in the executor (labeled entries or the snapshot
  // fallback); this tick only re-renders the undo/redo button gating.
  const [, setHistTick] = useState(0)
  // What the shared clipboard currently holds (gates Paste buttons). The
  // payloads live in the clipboard module (localStorage-backed, shared with
  // the canvas context menu and the keyboard). Presets are server-backed
  // (scope:"preset" tenant templates) keyed by name.
  const [clip, setClip] = useState(() => clipSummary())
  const [presets, setPresets] = useState<StylePreset[]>([])
  // Unsaved-changes tracking (P0 safety): true once content OR chrome has been
  // edited since the last successful publish / load. Guards navigation + unload.
  const [contentDirty, setContentDirty] = useState(false)
  // Autosave (Phase 1): continuously persist a DRAFT to the server, independent
  // of Publish, so a merchant can never lose work to a crash / failed publish.
  const [autosave, setAutosave] = useState<{ status: "idle" | "saving" | "saved" | "error"; at: number }>({ status: "idle", at: 0 })
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Distinguish a genuine empty page from a failed load so we never overwrite
  // real content by publishing an empty page after a network error.
  const [loadError, setLoadError] = useState(false)

  /* ------------------------------------------------------------------ *
   * THE single write path for page content — now the COMMAND EXECUTOR.
   *
   * Every mutation used to read `content` from its own render closure and
   * call setContent + patchToCanvas itself. Two writes in the same tick then
   * clobbered each other — the second was built from a stale array. That is
   * how "Paste Style" on an element could erase the very style it had just
   * pasted. contentRef is updated synchronously in applyContent below, so a
   * command always sees the result of the previous one, whichever render
   * its closure came from. Nothing else may write content: every mutator is
   * a named command in @modules/cms/editor/commands/registry.ts and the
   * ONLY way it runs is execute() below (Phase 2A, ARCH-CANVAS §3.3).
   * ------------------------------------------------------------------ */
  const contentRef = useRef<Section[] | null>(null)

  /** Replace content outside the command path (load only — the history
   *  baseline; undo/redo run through the executor). */
  const setContentSynced = (next: Section[] | null) => {
    contentRef.current = next
    setContent(next)
  }

  /** Current selection as a value (the executor records it on history
   *  entries so undo restores what was selected instead of clearing). */
  const curSelRef = useRef<Sel>(null)

  /** Batch window for the executor's history JUMP (4D): between
   *  beginBatch/endBatch the N sequential undo/redo steps keep writing
   *  refs/state/dirty exactly as before but the per-step canvas
   *  postMessage is suppressed; endBatch flushes ONE full content push
   *  plus each touched chrome region. Document state is byte-identical
   *  to N sequential steps — only the canvas messaging is batched. */
  const batchRef = useRef<{
    on: boolean
    content: boolean
    chrome: Set<string>
  }>({ on: false, content: false, chrome: new Set() })

  /** Apply new content (executor host): synchronous ref write, dirty mark,
   *  targeted patch when the shape allows — exactly commit()'s rule. */
  const applyContent = (next: Section[], touched: number | null) => {
    contentRef.current = next
    setContent(next)
    setContentDirty(true)
    if (batchRef.current.on) {
      batchRef.current.content = true
      return
    }
    if (touched != null && next[touched]) {
      patchToCanvas(touched, next[touched])
    } else {
      pushToCanvas(next)
    }
  }

  /** Apply one chrome region (executor host) — the old updateChrome body.
   *  Chrome edits now flow through commands, so they JOIN the undo stack. */
  const applyChromeRegion = (region: string, data: Record<string, unknown>) => {
    chromeRef.current = { ...chromeRef.current, [region]: data }
    setChrome(chromeRef.current)
    setChromeDirty((d) => new Set(d).add(region))
    if (batchRef.current.on) {
      batchRef.current.chrome.add(region)
      return
    }
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:chrome",
      key: region,
      data,
    })
  }

  // The executor is created once; its host delegates through this ref so it
  // always calls the latest closures (same discipline as the message refs).
  const hostRef = useRef<ExecutorHost | null>(null)
  hostRef.current = {
    getContent: () => contentRef.current,
    getChrome: () => chromeRef.current,
    applyContent,
    applyChrome: applyChromeRegion,
    getSel: () => curSelRef.current,
    setSel: (s) => selRef.current(s as Sel),
    onHistoryChange: () => setHistTick((t) => t + 1),
    beginBatch: () => {
      batchRef.current = { on: true, content: false, chrome: new Set() }
    },
    endBatch: () => {
      const b = batchRef.current
      batchRef.current = { on: false, content: false, chrome: new Set() }
      if (b.content && contentRef.current) {
        pushToCanvas(contentRef.current)
      }
      b.chrome.forEach((region) => {
        postToCanvas(iframeRef.current?.contentWindow, {
          type: "cms:chrome",
          key: region,
          data: chromeRef.current[region] ?? {},
        })
      })
    },
  }
  const exeRef = useRef<Executor | null>(null)
  if (!exeRef.current) {
    exeRef.current = createExecutor({
      getContent: () => hostRef.current!.getContent(),
      getChrome: () => hostRef.current!.getChrome(),
      applyContent: (n, t) => hostRef.current!.applyContent(n, t),
      applyChrome: (r, d) => hostRef.current!.applyChrome(r, d),
      getSel: () => hostRef.current!.getSel(),
      setSel: (s) => hostRef.current!.setSel(s),
      onHistoryChange: () => hostRef.current!.onHistoryChange(),
      beginBatch: () => hostRef.current!.beginBatch?.(),
      endBatch: () => hostRef.current!.endBatch?.(),
    })
  }
  const exe = exeRef.current

  /** ONE entry for every mutation (shell wrappers + canvas cms:cmd). */
  const execute = (cmd: Command, opts?: ExecuteOptions) =>
    exe.execute(cmd, opts)

  const undo = () => exe.undo()
  const redo = () => exe.redo()

  // Load the page list for the switcher (wire in shell/persist — 6C).
  useEffect(() => {
    fetchPages(key)
      .then((p) => setPages(p))
      .catch(() => {})
  }, [key])

  // Cmd/Ctrl-K opens the command palette (Finder).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setShowPalette((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const goToPage = (s: string) => {
    if (
      dirtyRef.current &&
      !window.confirm(
        "You have unpublished changes that will be lost. Leave this page anyway?"
      )
    ) {
      return
    }
    window.location.href = `/editor/${s.replace(/^\/+/, "")}?locale=${locale}&key=${encodeURIComponent(key)}`
  }

  const exitEditor = () => {
    if (
      dirtyRef.current &&
      !window.confirm(
        "You have unpublished changes that will be lost. Leave the editor anyway?"
      )
    ) {
      return
    }
    window.location.href = EXIT_HREF
  }
  const [status, setStatus] = useState("")
  const [denied, setDenied] = useState(false)
  // Responsive preview: constrain the canvas iframe width so the real page's
  // own media queries reflow (desktop = full width, tablet/mobile = device px).
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop"
  )
  /** The slide stage is up — it owns responsive itself (its rail carries
   *  the device switch), so the page header's device buttons step aside. */
  const [staged, setStaged] = useState(false)
  /* A stale editor tab is indistinguishable from a broken editor: every
     deploy swaps the JS bundle, but an OPEN tab keeps running the old one,
     so fixes look like they never landed. Poll the server's build id and
     say so plainly instead of letting the merchant chase ghosts. */
  const [staleBuild, setStaleBuild] = useState(false)
  useEffect(() => {
    let alive = true
    let booted: string | null = null
    const check = async () => {
      try {
        const r = await fetch("/api/editor-build", { cache: "no-store" })
        if (!r.ok) return
        const j = (await r.json()) as { buildId?: string }
        const id = typeof j.buildId === "string" ? j.buildId : null
        if (!id || !alive) return
        if (booted === null) booted = id
        else if (id !== booted) setStaleBuild(true)
      } catch {
        /* offline / transient — say nothing. */
      }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  /* 7A: the staged section's index, the filmstrip toggle, and the SESSION
     lock set the stage's bottom layer list owns. Locks are a workbench
     affordance — never document state, so never a command. */
  const [stageIndex, setStageIndex] = useState<number | null>(null)
  const [stageSlidesOpen, setStageSlidesOpen] = useState(true)
  const [stageLocks, setStageLocks] = useState<ReadonlySet<string>>(new Set())
  // Resizable + collapsible editing panel (P5 polish).
  const [panelWidth, setPanelWidth] = useState(380)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  // Preview mode (eye): hide panel + canvas affordances; previews UNSAVED work.
  const [previewMode, setPreviewMode] = useState(false)
  const resizingRef = useRef(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Latest canvas-action handlers, so the (stable) message listener always
  // calls the current closures without re-subscribing.
  const actionsRef = useRef<Record<string, (i: number) => void>>({})
  /** Latest context-menu action implementations (the message closure is stale-safe). */
  const ctxRef = useRef<any>({})
  /** Latest select() for the stable message listener. */
  const selRef = useRef<(sel: Sel, opts?: { mirror?: boolean }) => void>(
    () => {}
  )
  /** Latest keyboard-shortcut dispatcher (Cmd+C / Cmd+V / Cmd+D / Delete). */
  const keyActRef = useRef<(a: "copy" | "paste" | "duplicate" | "delete") => void>(
    () => {}
  )
  // Resolves a canvas link click to either "open that page" or "select the
  // clicked element" — assigned after the handlers below exist.
  const navRef = useRef<
    (href: string, index: number | null, chromeKey: string | null) => void
  >(() => {})
  /** Command-envelope sinks (Phase 2A): commands arriving as cms:cmd whose
   *  shell wrapper carries selection/status side-effects. Assigned with the
   *  other ref wirings after the wrappers exist. */
  const cmdSinkRef = useRef<
    Record<string, (args: Record<string, unknown>) => void>
  >({})
  // Index of the section-list row currently being dragged (for reorder).
  const dragIndexRef = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const readyRef = useRef(false)
  /* 7A: the ref alone cannot wake an effect, and the stage-chrome
     handshake MUST be re-sent to a canvas that reloaded while staged
     (otherwise it comes back up drawing the old in-iframe chrome). */
  const [canvasReady, setCanvasReady] = useState(false)
  /* The canvas must not have to GUESS its device from its own width (a
     narrow centre box reads as tablet). Tell it, on every change and on
     every canvas (re)ready. */
  useEffect(() => {
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:device",
      device,
    })
  }, [device, canvasReady])

  // Load the editable chrome (header/topbar/footer). Wire in
  // shell/persist (6C); the region split + state fan-out stays here.
  useEffect(() => {
    fetchChrome(key, locale)
      .then((d: any) => {
        setBrandName(typeof d.brand_name === "string" ? d.brand_name : "")
        setChromeRaw(d && typeof d === "object" ? d : null)
        chromeRef.current = {
          header: d.header ?? {},
          topbar: d.topbar ?? {},
          footer: d.footer ?? {},
          theme: d.theme ?? {},
        }
        setChrome(chromeRef.current)
      })
      .catch(() => {})
  }, [locale, key])

  const canvasSrc = `/editor-canvas/${slug}?locale=${locale}&key=${encodeURIComponent(key)}`

  // Load the page's current blocks. Distinguishes a genuine empty page from a
  // failed load (loadError) so Publish can never overwrite real content with an
  // empty page after a network error. Reusable so the error state can Retry.
  const [reloadNonce, setReloadNonce] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAi, setShowAi] = useState(false)
  // Dock (Phase 2, 2C): one string naming WHAT is selected; null = nothing.
  // useDockTab follows it — new selection jumps to Editor, deselect falls
  // back to Elements. Re-clicking the SAME node does not re-switch (key
  // unchanged) — acceptable; a selection nonce can be added later if wanted.
  const selectionKey =
    /* 5B: slider selections rank above the rest (they are the most
       specific thing on screen while the stage is up). */
    selectedSliderLayer ? `sl:${selectedSliderLayer.index}:${selectedSliderLayer.slideId}:${selectedSliderLayer.layerId}` :
    selectedSliderSlide ? `ss:${selectedSliderSlide.index}:${selectedSliderSlide.slideId}` :
    selectedWidget ? `w:${selectedWidget.index}:${selectedWidget.path.join(".")}` :
    selectedColumn ? `col:${selectedColumn.index}:${selectedColumn.colPath.join(".")}` :
    selectedElement ? `e:${selectedElement.index}:${selectedElement.key}` :
    selectedChromeElement ? `ce:${selectedChromeElement.region}:${selectedChromeElement.key}` :
    selectedChrome ? `c:${selectedChrome}` :
    selected != null ? `s:${selected}` : null
  const [dockTab, setDockTab] = useDockTab(selectionKey)
  const [brandName, setBrandName] = useState("")
  // The raw /api/puck/chrome payload. The template library renders its preview
  // cards through the store's own Liquid theme, which needs the same inputs the
  // canvas gets (platform_theme, categories, sample_products, theme_settings).
  const [chromeRaw, setChromeRaw] = useState<Record<string, unknown> | null>(null)
  useEffect(() => {
    let active = true
    setLoadError(false)
    // Wire in shell/persist (6C): 401 → denied (its screen wins in render,
    // loadError still flags — the inline original's exact setter sequence);
    // other failures → loadError. Normalization + canvas push stay here.
    loadPageDocument(key, slug, locale)
      .then((res) => {
        if (!active) return
        if (res.kind === "denied") setDenied(true)
        if (res.kind !== "ok") {
          setLoadError(true)
          return
        }
        const items = res.items
        /* Universal normalization (ARCH-CORE §1.2) — Phase 1's one load-path
           line, deliberately OUTSIDE the command bus / history (Phase 2A
           keeps this rule). Every flat themed block becomes a flush
           single-column container BEFORE the content reaches state, the
           canvas, or history. History starts empty and only executed
           commands ever create entries, so the normalized document IS the
           history floor: undo can never reach the un-normalized shape.
           `changed` deliberately does NOT touch contentDirty — normalization
           alone must never autosave (the autosave effect gates on
           contentDirty) or publish; the normalized shape persists only once
           the merchant really edits (the executor sets dirty) or Publishes. */
        const { content: normalized } = normalizeDocument(
          items.map((c) => {
            const { id, ...rest } = c.props ?? {}
            return { block_type: c.type, ...rest }
          })
        )
        setContentSynced(normalized as Section[])
        setContentDirty(false)
        /* If the canvas booted first (cms:ready already seen), hand it the
           normalized document now — and re-assert it shortly after, because
           the canvas's own /api/puck/load fetch resolves AFTER it posts
           cms:ready and would otherwise clobber this push with the flat,
           un-normalized shape (see scheduleNormalizedReassert). */
        if (readyRef.current) {
          pushToCanvas(normalized as Section[])
          scheduleNormalizedReassert()
        }
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [slug, locale, key, reloadNonce])

  // Debounced autosave: whenever the content changes (and is dirty), save the
  // draft ~1.5s later. Independent of Publish; failures are surfaced, not fatal.
  useEffect(() => {
    if (!content || loadError || !contentDirty) return
    if (exeRef.current?.hasStage()) return // 3F: staged AI preview pending
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      try {
        setAutosave((a) => ({ ...a, status: "saving" }))
        const ok = await autosaveDraft(key, slug, locale, content)
        setAutosave({ status: ok ? "saved" : "error", at: Date.now() })
      } catch {
        setAutosave({ status: "error", at: Date.now() })
      }
    }, 1500)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [content, contentDirty, loadError, slug, locale, key])

  // Unsaved-changes guard (P0 safety): dirty === edited-since-last-publish.
  const dirty = contentDirty || chromeDirty.size > 0
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      // Legacy browsers require returnValue to be set to trigger the prompt.
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  // Global undo/redo keyboard shortcuts (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z). Uses a
  // ref so the stable listener always calls the latest undo/redo closures.
  const histRef = useRef({ undo, redo })
  histRef.current = { undo, redo }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== "z") return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return
      e.preventDefault()
      if (e.shiftKey) histRef.current.redo()
      else histRef.current.undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Clipboard keyboard shortcuts (Cmd/Ctrl+C / V / D, Delete) — the hints the
  // context menu shows are real bindings, not decoration. Typing in a field
  // and copying selected text keep their native meaning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return
      }
      const meta = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (meta && (k === "c" || k === "v" || k === "d")) {
        // Real text selected -> let the browser's own copy work.
        if (k === "c" && (window.getSelection()?.toString() ?? "")) return
        e.preventDefault()
        keyActRef.current(k === "c" ? "copy" : k === "v" ? "paste" : "duplicate")
        return
      }
      if (!meta && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault()
        keyActRef.current("delete")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Drag-to-resize the editing panel (clamped 300–640px).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const w = e.clientX
      setPanelWidth(Math.min(640, Math.max(300, w)))
    }
    const onUp = () => {
      if (resizingRef.current) {
        resizingRef.current = false
        document.body.style.userSelect = ""
      }
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [])

  // Full content sync — initial load + structural changes (reorder/add/remove).
  const pushToCanvas = useCallback((next: Section[]) => {
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:data",
      content: next,
    })
  }, [])

  // Targeted patch — a single section edited. Only that section re-renders in
  // the canvas (the rest, incl. the autoplaying hero, are untouched).
  const patchToCanvas = useCallback((index: number, section: Section) => {
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:patch",
      index,
      section,
    })
  }, [])

  /* Phase 1: the canvas is self-sufficient — it runs its OWN /api/puck/load
     fetch, and it posts cms:ready BEFORE that fetch resolves. Pre-Phase-1 that
     was harmless (its flat self-load and our push were identical); now our
     push is NORMALIZED and its late-resolving self-load would silently
     overwrite it with the flat shape, leaving wrapped sections without
     column/widget affordances until the first edit. Until the canvas guards
     that fetch (editor-canvas is unowned this phase — flagged to the
     integrator), re-assert the shell's document a moment after ready. The
     shell is the single document authority, so a full cms:data replace of
     contentRef truth is always safe and idempotent. */
  const reassertTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const scheduleNormalizedReassert = useCallback(() => {
    reassertTimersRef.current.forEach(clearTimeout)
    reassertTimersRef.current = [700, 2200].map((ms) =>
      setTimeout(() => {
        if (contentRef.current) pushToCanvas(contentRef.current)
      }, ms)
    )
  }, [pushToCanvas])
  useEffect(
    () => () => {
      reassertTimersRef.current.forEach(clearTimeout)
    },
    []
  )

  /**
   * THE single way selection changes. Derives all five legacy selection
   * states (mutually exclusive by construction) and, unless the change came
   * FROM the canvas (mirror: false — it already knows), tells the canvas to
   * outline + scroll to the newly selected thing.
   */
  const select = (sel: Sel, opts: { mirror?: boolean } = {}) => {
    curSelRef.current = sel
    setSelected(sel?.kind === "section" ? sel.index : null)
    setSelectedElement(
      sel?.kind === "element" ? { index: sel.index, key: sel.key } : null
    )
    setSelectedWidget(
      sel?.kind === "widget" ? { index: sel.index, path: sel.path } : null
    )
    setSelectedColumn(
      sel?.kind === "column"
        ? { index: sel.index, colPath: sel.colPath }
        : null
    )
    setSelectedChrome(sel?.kind === "chrome" ? sel.region : null)
    setSelectedChromeElement(
      sel?.kind === "chromeElement"
        ? { region: sel.region, key: sel.key }
        : null
    )
    /* 5B: slider stage selection derives here like every other kind. */
    setSelectedSliderSlide(
      sel?.kind === "sliderSlide"
        ? { index: sel.index, slideId: sel.slideId }
        : null
    )
    setSelectedSliderLayer(
      sel?.kind === "sliderLayer"
        ? { index: sel.index, slideId: sel.slideId, layerId: sel.layerId }
        : null
    )
    if (opts.mirror === false) return
    const post = (msg: Parameters<typeof postToCanvas>[1]) =>
      postToCanvas(iframeRef.current?.contentWindow, msg)
    if (!sel) post({ type: "cms:select", index: null })
    else if (sel.kind === "section") post({ type: "cms:select", index: sel.index })
    else if (sel.kind === "element")
      post({ type: "cms:selectElement", index: sel.index, elementKey: sel.key })
    else if (sel.kind === "widget")
      post({ type: "cms:selectWidget", index: sel.index, path: sel.path })
    else if (sel.kind === "column")
      post({
        type: "cms:selectColumn",
        index: sel.index,
        colPath: sel.colPath,
      })
    else if (sel.kind === "chrome") post({ type: "cms:selectChrome", key: sel.region })
    else if (sel.kind === "chromeElement")
      post({
        type: "cms:selectChromeElement",
        region: sel.region,
        elementKey: sel.key,
      })
    /* 5B: slider selection mirror — one message for both levels
       (layerId null = slide-level). The stage in the canvas syncs its
       own overlay selection from it. */
    else if (sel.kind === "sliderSlide")
      post({
        type: "cms:selectSliderLayer",
        index: sel.index,
        slideId: sel.slideId,
        layerId: null,
      })
    else if (sel.kind === "sliderLayer")
      post({
        type: "cms:selectSliderLayer",
        index: sel.index,
        slideId: sel.slideId,
        layerId: sel.layerId,
      })
  }

  // Messages from the canvas iframe — through the typed protocol
  // subscription. Field-level runtime checks are kept as-is: postMessage is
  // an untrusted boundary, the types describe honest senders.
  useEffect(() => {
    const off = onMessage((m) => {
      /* Phase 2A command envelope (protocol.ts appendix): the canvas's
         migrated senders arrive here as ONE message type. Commands with a
         shell wrapper (selection / status side-effects) route through it
         so behavior matches the legacy message exactly; anything else
         goes straight to the executor. Unknown names are dropped —
         postMessage is an untrusted boundary, so the runtime field checks
         stay even though the envelope is typed (6C: bridge cast removed —
         CmsCmdMsg is in the protocol union now). */
      if (m.type === "cms:cmd") {
        const env = m.cmd as {
          name?: unknown
          args?: unknown
          label?: unknown
          txn?: unknown
        } | null
        if (
          env &&
          typeof env === "object" &&
          typeof env.name === "string" &&
          env.args &&
          typeof env.args === "object" &&
          hasCommand(env.name)
        ) {
          const sink = cmdSinkRef.current[env.name]
          if (sink) {
            sink(env.args as Record<string, unknown>)
          } else {
            exeRef.current?.execute(
              {
                name: env.name,
                args: env.args as Record<string, unknown>,
                label: typeof env.label === "string" ? env.label : undefined,
                txn: typeof env.txn === "string" ? env.txn : undefined,
              },
              /* 3F: a pending AI preview applies WITHOUT history        */
              /* (executor stagePreview) — promoted or discarded via     */
              /* cms:aiStage below. Only the two AI-bearing commands may  */
              /* stage; a stray `staged` on anything else is ignored.     */
              (env.name === "ai.apply" || env.name === "chrome.setProps") &&
                (env.args as Record<string, unknown>).staged === true
                ? { staged: true }
                : undefined
            )
          }
        }
        return
      }
      /* 3F: resolve the pending staged AI preview (ARCH-AI §2.4).
         Promote = ONE labeled history entry ("AI: rewrote Heading");
         discard = restore the pre-stage document, zero history residue. */
      if (m.type === "cms:aiStage") {
        if (m.op === "promote") {
          exeRef.current?.promoteStaged(
            typeof m.label === "string" && m.label
              ? m.label.slice(0, 80)
              : "AI Edit"
          )
        } else if (m.op === "discard") {
          exeRef.current?.discardStaged()
        }
        return
      }
      if (m.type === "cms:ready") {
        readyRef.current = true
        setCanvasReady(true)
        if (contentRef.current) {
          pushToCanvas(contentRef.current)
          // Beat the canvas's own late-resolving self-load (see
          // scheduleNormalizedReassert): keep the normalized document the
          // one the canvas ends up holding.
          scheduleNormalizedReassert()
        }
        // A reloaded canvas has no idea what is on the clipboard.
        announceClipboard()
      }
      // Keyboard shortcut forwarded from the canvas (focus was in the iframe).
      // 6C: `as any` dropped — the cms:key narrowing already types `action`
      // as the exact copy/paste/duplicate/delete union keyActRef takes; the
      // runtime typeof check stays (untrusted boundary).
      if (m.type === "cms:key" && typeof m.action === "string") {
        keyActRef.current(m.action)
      }
      // The on-canvas font-size handle. The canvas paints the drag live for feel;
      // THIS is where it becomes real — written into the element's style bag, so
      // undo, autosave, and per-device (desktop/tablet/mobile) all keep working
      // exactly as they do from the sidebar. One source of truth, two ways in.
      if (
        m.type === "cms:fontSize" &&
        typeof m.index === "number" &&
        typeof m.elementKey === "string" &&
        typeof m.px === "number"
      ) {
        const idx = m.index as number
        const elKey = m.elementKey as string
        const px = Math.min(200, Math.max(8, Math.round(m.px)))
        const section = contentRef.current?.[idx]
        if (section) {
          const es = (section.elementStyles as ElementStyles | undefined) ?? {}
          const bag = { ...((es[elKey]?.style as Record<string, unknown>) ?? {}) }

          /* 3C: ONE device-write path (writeResponsive) instead of the
             bespoke promote logic. resolveResponsive uses the real cascade
             (mobile ← tablet ← base) — the same one the engine emits, so
             the handle edits what the merchant actually sees. */
          const size = { value: px, unit: "px" }
          const prevLeaf = {
            ...((resolveResponsive(bag.typography as never, device) as
              | Record<string, unknown>
              | undefined) ?? {}),
          }
          prevLeaf.fontSize = size
          const nextBag = writeResponsive(bag, "typography", device, prevLeaf)

          // Make sure the panel is showing the element we are resizing (the
          // canvas already has it selected — no mirror needed).
          select({ kind: "element", index: idx, key: elKey }, { mirror: false })
          writeElementBags(idx, elKey, { style: nextBag })
        }
        return
      }

      if (m.type === "cms:clicked" && typeof m.index === "number") {
        // A stale seam from five minutes ago must not outrank the section the
        // merchant just clicked.
        setAddTargetIndex(null)
        selRef.current({ kind: "section", index: m.index }, { mirror: false })
      }
      if (m.type === "cms:clickedChrome" && typeof m.key === "string") {
        selRef.current({ kind: "chrome", region: m.key }, { mirror: false })
      }
      // Widget-level selection (Composer W1): the user clicked a [data-w]
      // widget inside a container section on the canvas.
      if (
        m.type === "cms:clickedWidget" &&
        typeof m.index === "number" &&
        Array.isArray(m.path)
      ) {
        selRef.current(
          { kind: "widget", index: m.index, path: m.path as number[] },
          { mirror: false }
        )
      }
      // Column-level selection (2E): the user clicked a column's own area
      // inside a container section on the canvas. Typed since 2B landed the
      // message pair — the field checks stay (untrusted boundary).
      if (
        m.type === "cms:clickedColumn" &&
        typeof m.index === "number" &&
        Array.isArray(m.colPath) &&
        m.colPath.length % 2 === 1 &&
        m.colPath.every((n) => typeof n === "number")
      ) {
        selRef.current(
          { kind: "column", index: m.index, colPath: m.colPath },
          { mirror: false }
        )
      }
      /* --- 5B stage: slider selection intents + stage mode ----------- */
      // A slide became active on the stage (filmstrip / stage entry).
      if (
        m.type === "cms:clickedSliderSlide" &&
        typeof m.index === "number" &&
        typeof m.slideId === "string" &&
        m.slideId
      ) {
        selRef.current(
          { kind: "sliderSlide", index: m.index, slideId: m.slideId },
          { mirror: false }
        )
      }
      // A layer was selected on the stage (stage box / layer rail).
      if (
        m.type === "cms:clickedSliderLayer" &&
        typeof m.index === "number" &&
        typeof m.slideId === "string" &&
        m.slideId &&
        typeof m.layerId === "string" &&
        m.layerId
      ) {
        selRef.current(
          {
            kind: "sliderLayer",
            index: m.index,
            slideId: m.slideId,
            layerId: m.layerId,
          },
          { mirror: false }
        )
      }
      // Stage mode toggled. MODE, not history: entering selects nothing
      // extra (the slide intent follows separately); exiting returns the
      // selection to the section so the panel lands somewhere sensible.
      /* 5B stage: the stage owns responsive while it is up — it asks the
         shell to resize the canvas iframe so per-device @media rules fire. */
      if (
        m.type === "cms:stageDevice" &&
        (m.device === "desktop" || m.device === "tablet" || m.device === "mobile")
      ) {
        setDevice(m.device)
      }
      if (m.type === "cms:stage" && typeof m.on === "boolean") {
        setStaged(m.on)
        /* 7A: the shell needs the staged section's index to read the
           slider host for its own chrome (slides, layers). Locks are
           per-session AND per-stage — dropped on exit. */
        setStageIndex(m.on && typeof m.index === "number" ? m.index : null)
        if (!m.on) setStageLocks(new Set())
        if (!m.on && typeof m.index === "number") {
          selRef.current({ kind: "section", index: m.index })
        }
      }
      /* --- end 5B stage ---------------------------------------------- */
      // Chrome element-level selection (F1): the user clicked a [data-el]
      // element inside a chrome region on the canvas.
      if (
        m.type === "cms:clickedChromeElement" &&
        typeof m.region === "string" &&
        m.region &&
        typeof m.elementKey === "string" &&
        m.elementKey
      ) {
        selRef.current(
          { kind: "chromeElement", region: m.region, key: m.elementKey },
          { mirror: false }
        )
      }
      // Element-level selection (E1): the user clicked a [data-el] element
      // inside a section on the canvas.
      if (
        m.type === "cms:clickedElement" &&
        typeof m.index === "number" &&
        typeof m.elementKey === "string" &&
        m.elementKey
      ) {
        selRef.current(
          { kind: "element", index: m.index, key: m.elementKey },
          { mirror: false }
        )
      }
      // Canvas floating-toolbar actions (move/duplicate/delete/edit/add).
      if (m.type === "cms:action" && typeof m.index === "number") {
        actionsRef.current[m.action]?.(m.index)
      }

      // Context menu on the thing under the cursor. `scope` says WHAT was
      // right-clicked — a widget, a theme element, a chrome region or the
      // section — so "Duplicate" on a button duplicates the button, not the
      // whole section.
      if (m.type === "cms:ctxAction" && typeof m.action === "string") {
        const a = String(m.action)
        const i = typeof m.index === "number" ? (m.index as number) : -1

        // Repeated-item ops (Duplicate Slide / Delete Banner 2 …) — scope
        // independent: the marker on the item's DOM root said which array
        // prop and which original index.
        if (
          (a === "duplicateItem" || a === "deleteItem") &&
          i >= 0 &&
          typeof m.itemField === "string" &&
          typeof m.itemIndex === "number"
        ) {
          ctxRef.current.itemAction(a, i, m.itemField, m.itemIndex)
          return
        }

        if (m.scope === "widget" && Array.isArray(m.path)) {
          const path = m.path as number[]
          if (a === "edit") selRef.current({ kind: "widget", index: i, path })
          else if (a === "duplicate") ctxRef.current.duplicateWidget(i, path)
          else if (a === "delete") ctxRef.current.removeWidget(i, path)
          else if (a === "copy") ctxRef.current.copyWidget(i, path)
          else if (a === "paste") ctxRef.current.pasteWidget(i, path)
          else if (a === "copyStyle" || a === "pasteStyle" || a === "resetStyle") {
            ctxRef.current.widgetStyleAction(a, i, path)
          }
          return
        }

        if (m.scope === "element" && typeof m.elementKey === "string") {
          const key = m.elementKey as string
          if (a === "edit") {
            selRef.current({ kind: "element", index: i, key })
          } else if (a === "copyStyle" || a === "pasteStyle" || a === "resetStyle") {
            ctxRef.current.elementStyleAction(a, i, key)
          }
          return
        }

        if (m.scope === "chrome" && typeof m.region === "string") {
          if (a === "edit") selRef.current({ kind: "chrome", region: m.region })
          else if (a === "copyStyle" || a === "pasteStyle" || a === "resetStyle") {
            ctxRef.current.chromeStyleAction(a, m.region)
          }
          return
        }

        if (
          m.scope === "chromeElement" &&
          typeof m.region === "string" &&
          typeof m.elementKey === "string"
        ) {
          if (a === "edit") {
            selRef.current({
              kind: "chromeElement",
              region: m.region,
              key: m.elementKey,
            })
          } else if (a === "copyStyle" || a === "pasteStyle" || a === "resetStyle") {
            ctxRef.current.chromeElementStyleAction(a, m.region, m.elementKey)
          }
          return
        }

        if (i >= 0) actionsRef.current[a]?.(i)
        return
      }
      if (m.type === "cms:insert" && typeof m.index === "number") {
        actionsRef.current.insert?.(m.index)
      }
      /* 6C zoo deletion: the seven Batch A/B/C legacy handlers
         (cms:insertAt / insertContainerAt / insertWidgetAsSection /
         insertWidgetAt / moveSection / moveWidget / setContainerLayout)
         are DELETED — their canvas senders migrated to `cms:cmd`
         envelopes in Phase 2B, so the message types had zero senders.
         The mutations ride the command bus (cmdSinkRef below). */
      // Folder button on the add-section zone opens the template library.
      // A seam was armed on the canvas: anything added next (palette, picker)
      // lands THERE, not at the end.
      if (m.type === "cms:setAddTarget" && typeof m.index === "number") {
        setAddTargetIndex(m.index)
      }

      if (m.type === "cms:openTemplates") {
        // Opened from an insert bar between two sections -> the template lands at
        // THAT seam. Opened from the toolbar (no `at`) -> fall back to the
        // selection, as before.
        setTemplateAt(typeof m.at === "number" ? m.at : null)
        setShowTemplates(true)
      }
      // Undo/redo forwarded from the canvas iframe (keyboard focus inside it).
      if (m.type === "cms:undo") histRef.current.undo()
      if (m.type === "cms:redo") histRef.current.redo()
      // A link clicked in the canvas → open that page or select its container.
      if (m.type === "cms:linkClick" && typeof m.href === "string") {
        navRef.current(m.href, m.index ?? null, m.chromeKey ?? null)
      }
    })
    return off
  }, [content, pushToCanvas, scheduleNormalizedReassert])

  const selectChrome = (k: string) => select({ kind: "chrome", region: k })

  /**
   * The single write path for chrome (header/topbar/footer/theme) — same
   * stale-closure discipline as content: chromeRef is updated synchronously
   * (in applyChromeRegion, the executor host) so sequential writes in one
   * tick compose instead of clobbering. Phase 2A: chrome writes are now
   * COMMANDS, so header/footer edits join the same undo stack as page
   * edits — undo after a header edit undoes the header edit.
   */
  const chromeRef = useRef<Record<string, Record<string, unknown>>>({})

  const updateChrome = (
    k: string,
    data: Record<string, unknown>,
    label?: string
  ) => {
    execute({ name: "chrome.setProps", args: { region: k, data }, label })
  }

  // Style/Advanced for a chrome region (F1): merge a namespaced diff bag onto
  // chrome[region].style / .advanced. Same diff-only storage as sections — an
  // empty bag deletes the key so an un-styled region stays byte-identical to
  // today. Flows into the existing cms:chrome patch + chromeDirty +
  // publish(/api/puck/chrome) pipeline unchanged (via the executor host).
  const updateChromeBag = (
    region: string,
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    execute({
      name: "chrome.setBags",
      args: { region, bags: { [bagKey]: next } },
    })
  }

  /** Copy / paste / reset the whole-region look (style + advanced +
   *  elementStyles), through the shared clipboard. One write per action. */
  const chromeStyleAction = (
    action: "copyStyle" | "pasteStyle" | "resetStyle",
    region: string
  ) => {
    const cur = (chromeRef.current[region] ?? {}) as Record<string, unknown>
    if (action === "copyStyle") {
      writeClip(
        "style",
        structuredClone({
          source: "chrome",
          style: cur.style as Record<string, unknown> | undefined,
          advanced: cur.advanced as Record<string, unknown> | undefined,
          elementStyles: cur.elementStyles as
            | Record<string, unknown>
            | undefined,
        }) as StyleClip
      )
      syncClip()
      setStatus("Style copied.")
      return
    }
    const updated: Record<string, unknown> = { ...cur }
    if (action === "resetStyle") {
      delete updated.style
      delete updated.advanced
      delete updated.elementStyles
    } else {
      const c = readClipboard().style
      if (!c) return
      const style = deepMergeBag(
        (cur.style as Record<string, unknown>) ?? {},
        c.style ?? {}
      )
      const advanced = deepMergeBag(
        (cur.advanced as Record<string, unknown>) ?? {},
        c.advanced ?? {}
      )
      if (Object.keys(style).length) updated.style = style
      else delete updated.style
      if (Object.keys(advanced).length) updated.advanced = advanced
      else delete updated.advanced
      if (c.elementStyles && Object.keys(c.elementStyles).length) {
        updated.elementStyles = deepMergeBag(
          (cur.elementStyles as Record<string, unknown>) ?? {},
          c.elementStyles
        )
      }
    }
    updateChrome(
      region,
      updated,
      action === "resetStyle" ? "Reset Style" : "Paste Style"
    )
    setStatus(action === "resetStyle" ? "Style reset." : "Style pasted.")
  }

  /** Write BOTH bags of a chrome element in ONE update (two sequential
   *  single-bag writes would clobber each other). undefined leaves a bag
   *  untouched; an empty bag deletes it. Dispatches chromeElement.setBags —
   *  the merge itself lives in the registry. */
  const writeChromeElementBags = (
    region: string,
    key: string,
    bags: {
      style?: Record<string, unknown>
      advanced?: Record<string, unknown>
    },
    label?: string
  ) => {
    execute({
      name: "chromeElement.setBags",
      args: { region, key, bags },
      label,
    })
  }

  /** Style clipboard actions on a chrome ELEMENT ([data-el] in header/footer). */
  const chromeElementStyleAction = (
    action: "copyStyle" | "pasteStyle" | "resetStyle",
    region: string,
    key: string
  ) => {
    const prev = (chromeRef.current[region] ?? {}) as Record<string, unknown>
    const es = (prev.elementStyles as ElementStyles | undefined) ?? {}
    const entry = (es[key] ?? {}) as Record<string, unknown>
    if (action === "copyStyle") {
      writeClip(
        "style",
        structuredClone({
          source: "chromeElement",
          style: entry.style as Record<string, unknown> | undefined,
          advanced: entry.advanced as Record<string, unknown> | undefined,
        }) as StyleClip
      )
      syncClip()
      setStatus("Style copied.")
      return
    }
    if (action === "resetStyle") {
      writeChromeElementBags(
        region,
        key,
        { style: {}, advanced: {} },
        "Reset Style"
      )
      setStatus("Style reset.")
      return
    }
    const c = readClipboard().style
    if (!c) return
    writeChromeElementBags(
      region,
      key,
      {
        style: deepMergeBag(
          (entry.style as Record<string, unknown>) ?? {},
          c.style ?? {}
        ),
        advanced: deepMergeBag(
          (entry.advanced as Record<string, unknown>) ?? {},
          c.advanced ?? {}
        ),
      },
      "Paste Style"
    )
    setStatus("Style pasted.")
  }

  // Element-level for a chrome region (F1): merge a namespaced diff bag into
  // chrome[region].elementStyles[key].style / .advanced. Same diff-only rules as
  // the section element bags: an empty bag deletes that sub-key; an empty entry
  // deletes the element key; an empty map deletes `elementStyles` entirely, so a
  // region with no element overrides stays byte-identical to today.
  const updateChromeElementBag = (
    region: string,
    key: string,
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => writeChromeElementBags(region, key, { [bagKey]: next })

  // Leave chrome element mode → re-select the whole chrome region (outlines it
  // on the canvas and clears the chrome element selection there).
  const backToChromeRegion = () => {
    if (selectedChromeElement == null) return
    selectChrome(selectedChromeElement.region)
  }

  const selectSection = (i: number) =>
    select(i >= 0 ? { kind: "section", index: i } : null)

  /**
   * Update the section at `index`. Element mode needs this: the element belongs
   * to a section, and editing the element's TEXT means editing that section's
   * content — without making the user navigate back to the section first.
   */
  const updateSectionAt = (index: number, nextData: Record<string, unknown>) =>
    execute({ name: "section.setProps", args: { index, section: nextData } })

  const updateSelected = (nextData: Record<string, unknown>) => {
    if (selected == null) return
    updateSectionAt(selected, nextData)
  }

  /**
   * Write any of a section's THREE appearance bags (style / advanced /
   * elementStyles) in ONE commit. undefined leaves a bag untouched; an empty
   * bag deletes the key (diff-only storage: an un-styled section stays
   * byte-identical to a never-styled one).
   */
  const writeSectionBags = (
    idx: number,
    bags: {
      style?: Record<string, unknown>
      advanced?: Record<string, unknown>
      elementStyles?: Record<string, unknown>
    },
    label?: string
  ) => execute({ name: "section.setBags", args: { index: idx, bags }, label })

  const updateSelectedBag = (
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selected == null) return
    writeSectionBags(selected, { [bagKey]: next })
  }

  /**
   * Write BOTH bags of element `key` inside section `idx` in ONE commit.
   * undefined leaves a bag untouched; an empty bag deletes it. Removing both
   * removes the element's entry; an empty map removes `elementStyles`
   * entirely. This replaces the old one-bag-per-call writers whose sequential
   * use silently clobbered each other (the broken element Paste Style).
   */
  const writeElementBags = (
    idx: number,
    key: string,
    bags: {
      style?: Record<string, unknown>
      advanced?: Record<string, unknown>
    },
    label?: string
  ) =>
    execute({ name: "element.setBags", args: { index: idx, key, bags }, label })

  const updateSelectedElementBag = (
    key: string,
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selectedElement == null) return
    writeElementBags(selectedElement.index, key, { [bagKey]: next })
  }

  // Leave element mode → re-select the containing section (outlines it on the
  // canvas and clears the element selection there via cms:select).
  const backToSection = () => {
    if (selectedElement == null) return
    selectSection(selectedElement.index)
  }

  /* --------------- Widget-level editing (Composer W1) --------------- */

  // Select a widget (from the canvas OR the columns manager): switches the
  // panel to widget mode and mirrors the selection into the canvas so it
  // outlines + scrolls that [data-w] widget into view.
  const selectWidget = (index: number, path: number[]) =>
    select({ kind: "widget", index, path })

  // Leave widget mode → re-select the containing container section.
  const backToContainer = () => {
    if (selectedWidget == null) return
    selectSection(selectedWidget.index)
  }

  // Immutably rebuild content[index] with columns[col].widgets[wi] replaced,
  // then stream the whole section to the canvas (targeted patch, like every
  // other section edit) so buildWidgetCss re-emits the widget's CSS live.
  const writeWidget = (index: number, path: number[], nextWidget: Widget) =>
    execute({
      name: "widget.setProps",
      args: { index, path, widget: nextWidget },
    })

  // Content-prop edit for the CURRENTLY selected widget (widget_type, style
  // and advanced are preserved — the panel only hands back content props).
  const updateSelectedWidget = (patch: Record<string, unknown>) => {
    if (selectedWidget == null) return
    const { index, path } = selectedWidget
    const ws = widgetsAtPath(index, path.slice(0, -1))
    const widget = ws?.[path[path.length - 1]]
    if (!widget) return
    writeWidget(index, path, { ...widget, ...patch })
  }

  /** Write BOTH widget bags in ONE update. undefined leaves a bag untouched;
   *  an empty bag deletes the key (an un-styled widget stays content-only). */
  const writeWidgetBags = (
    index: number,
    path: number[],
    bags: {
      style?: Record<string, unknown>
      advanced?: Record<string, unknown>
    },
    label?: string
  ) => execute({ name: "widget.setBags", args: { index, path, bags }, label })

  const updateSelectedWidgetBag = (
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selectedWidget == null) return
    writeWidgetBags(selectedWidget.index, selectedWidget.path, { [bagKey]: next })
  }

  /* --------------- Column-level styling (2E) --------------- */

  /** The column object at an odd-length col path, or null. Delegates to
   *  the registry's pure body (one definition, shared with the command). */
  const columnAtPath = (index: number, colPath: number[]) =>
    contentRef.current
      ? columnAtPathPure(contentRef.current, index, colPath)
      : null

  /** Write a column's style/advanced bags. undefined leaves a bag
   *  untouched; an empty bag deletes the key (bag-less column =
   *  byte-identical render). NON-STRUCTURAL by definition: the command
   *  body never reads or clears `flush` and does not ride
   *  writeWidgetsAt (its F1 rule is about widget COUNT — not this).
   *  Dispatches column.setBags — targeted section patch, labeled
   *  history entry, per-column coalescing, exact bag-restoring undo. */
  const writeColumnBags = (
    index: number,
    colPath: number[],
    bags: {
      style?: Record<string, unknown>
      advanced?: Record<string, unknown>
    },
    label?: string
  ) =>
    execute({ name: "column.setBags", args: { index, colPath, bags }, label })

  /** The widgets array of the inner section currently selected (columns editor). */
  const setSelectedWidgetColumns = (nextCols: Column[]) => {
    if (selectedWidget == null) return
    const { index, path } = selectedWidget
    const ws = widgetsAtPath(index, path.slice(0, -1))
    const widget = ws?.[path[path.length - 1]]
    if (!widget) return
    writeWidget(index, path, { ...widget, columns: nextCols } as Widget)
  }

  // Columns manager (add/remove/reorder widgets) for the SELECTED container
  // section — replaces its `columns` array wholesale (already immutable).
  const setSelectedColumns = (nextCols: Column[]) => {
    if (selected == null) return
    const sec = contentRef.current?.[selected]
    if (!sec) return
    updateSectionAt(selected, { ...sec, columns: nextCols })
  }

  /** Same layout→columns reconciliation for an INNER section widget. */
  const reconcileInnerColumns = (
    next: Record<string, unknown>,
    current: unknown
  ): Record<string, unknown> => {
    const desired = parseInt(String(next.layout ?? ""), 10)
    const cols = Array.isArray(current) ? (current as Column[]) : []
    if (!Number.isInteger(desired) || desired < 1 || desired > 4) {
      return { ...next, columns: cols }
    }
    return { ...next, columns: reconcileColumns(cols, desired) }
  }

  // Container layout change: grow/shrink `columns` to match the new count,
  // preserving widgets (shrink concatenates removed columns' widgets into the
  // last kept column — user content is never silently deleted).
  const reconcileContainerProps = (
    next: Record<string, unknown>
  ): Record<string, unknown> => {
    const desired = parseInt(String(next.layout ?? ""), 10)
    if (!Number.isInteger(desired) || desired < 1 || desired > 4) return next
    const cols = Array.isArray(next.columns) ? (next.columns as Column[]) : []
    const reconciled = reconcileColumns(cols, desired)
    return reconciled === cols ? next : { ...next, columns: reconciled }
  }

  const moveSection = (from: number, dir: -1 | 1) => {
    const cur = contentRef.current
    if (!cur) return
    const to = from + dir
    if (to < 0 || to >= cur.length) return
    // Adjacent splice-move ≡ the old swap; one section.move command covers
    // both the arrow buttons and drag-reorder.
    if (
      !execute(
        { name: "section.move", args: { from, to } },
        { selAfter: { kind: "section", index: to } }
      )
    ) {
      return
    }
    // Section indices shifted — keep the moved section selected.
    if (selected === from) select({ kind: "section", index: to })
    else if (selectedWidget || selectedElement) select(null)
  }

  // Reorder by dropping a dragged section-list row onto another position.
  const moveSectionTo = (from: number, to: number) => {
    const cur = contentRef.current
    if (!cur || from === to || to < 0 || to >= cur.length) return
    if (
      !execute(
        { name: "section.move", args: { from, to } },
        { selAfter: { kind: "section", index: to } }
      )
    ) {
      return
    }
    select({ kind: "section", index: to }, { mirror: false })
  }

  // Insert a fresh block of `type` at `index` (clamped 0..length): schema
  // defaults or the preset, snapshot for undo, full canvas sync, select it.
  // Shared by the Add-section picker (via addSection) and palette drops
  // (cms:insertAt, Composer W3).
  const insertSectionAt = (
    index: number,
    type: string,
    presetIndex?: number
  ) => {
    const cur = contentRef.current
    if (!cur) return
    // The block construction (Elementor's section/widget wrap — Phase 1's
    // exact facade shape for commerce blocks) lives in the registry's
    // section.insert body (buildInsertSection).
    const isContainer = type === "container"
    const at = Math.max(0, Math.min(index, cur.length))
    const selAfter: Sel = isContainer
      ? { kind: "section", index: at }
      : { kind: "widget", index: at, path: [0, 0] }
    if (
      !execute(
        { name: "section.insert", args: { at: index, type, presetIndex } },
        { selAfter }
      )
    ) {
      return
    }
    setAddTargetIndex(null)
    // Select the block itself (the widget in column 0), not its wrapper, so the
    // panel opens the settings the merchant actually asked for.
    if (isContainer) {
      select({ kind: "section", index: at })
    } else {
      selectWidget(at, [0, 0])
    }
  }

  // Structure picker (canvas add-section zone): insert a container with N
  // empty columns at `index`, then select it (Elementor select-your-structure).
  const insertContainerAt = (index: number, colsN: number) => {
    const cur = contentRef.current
    if (!cur) return
    const at = Math.max(0, Math.min(index, cur.length))
    if (
      !execute(
        { name: "container.insert", args: { at: index, cols: colsN } },
        { selAfter: { kind: "section", index: at } }
      )
    ) {
      return
    }
    select({ kind: "section", index: at })
  }

  // A widget dropped outside any container: auto-wrap it in a new 1-column
  // container at `index` (Elementor drop-anywhere), then select the widget.
  const insertWidgetAsSection = (index: number, widgetType: string) => {
    const cur = contentRef.current
    if (!cur) return
    const at = Math.max(0, Math.min(index, cur.length))
    if (
      !execute(
        { name: "widget.insertWrapped", args: { at: index, type: widgetType } },
        { selAfter: { kind: "widget", index: at, path: [0, 0] } }
      )
    ) {
      return
    }
    selectWidget(at, [0, 0])
  }

  // Apply server-validated AI patches through the command bus (Phase 2A:
  // ONE labeled entry per apply — a multi-patch page edit is one undo step;
  // the mutation body lives in the registry's ai.apply, which keeps the 1V
  // F2 fixes: insert_section normalizes, replace_props routes facades).
  const applyAiPatches = (patches: any[]): number => {
    const cur = contentRef.current
    if (!cur || !Array.isArray(patches) || patches.length === 0) return 0
    // The AiPanel reports how many patches landed — compute it with the
    // same pure body the command runs (cheap; the command re-runs it).
    const { applied } = applyAiPatchesPure(cur, patches)
    if (!applied) return 0
    if (!execute({ name: "ai.apply", args: { patches }, label: "AI Edit" })) {
      return 0
    }
    select(null)
    return applied
  }

  const addSection = (type: string, presetIndex?: number) => {
    const content = contentRef.current
    if (!content) return
    // WHERE a new section lands, in order of what the merchant most recently
    // told us:
    //   1. the seam they clicked "+" on          (explicit)
    //   2. just below the section they selected  (implied — they are working there)
    //   3. the end of the page                   (nothing to go on)
    //
    // It used to be (1) or straight to the end. So picking anything from the
    // Elements palette flung it below the footer of an 18,000px page, and the
    // merchant had to drag it back up past thirty sections. Elementor keeps the
    // insertion point where YOU are; now so does this.
    const at =
      addTargetIndex != null
        ? addTargetIndex
        : selected != null && selected >= 0 && selected < content.length
          ? selected + 1
          : content.length
    insertSectionAt(at, type, presetIndex)
  }

  // Palette widget drop (Composer W3): insert a fresh widget (schema defaults)
  // into content[index].columns[col].widgets at the drop position `wi` (splice,
  // Elementor-style; append when `wi` is unset), snapshot for undo, stream the
  // section to the canvas, and select the new widget for editing.
  const insertWidgetAt = (
    index: number,
    colPath: number[],
    widgetType: string,
    wi?: number
  ) => {
    if (!contentRef.current || !getWidgetSchema(widgetType)) return
    // One level of nesting: an inner section may not be dropped into another.
    // (The registry guards this too; the wrapper keeps the user-facing why.)
    if (widgetType === "inner_section" && colPath.length > 1) {
      setStatus("An inner section can't go inside another inner section.")
      return
    }
    const existing = widgetsAtPath(index, colPath)
    if (!existing) return
    // Positional drop (Elementor): splice at the insertion index, else append.
    const at =
      wi == null ? existing.length : Math.max(0, Math.min(wi, existing.length))
    if (
      !execute(
        {
          name: "widget.insert",
          args: { index, colPath, type: widgetType, wi },
        },
        { selAfter: { kind: "widget", index, path: [...colPath, at] } }
      )
    ) {
      return
    }
    selectWidget(index, [...colPath, at])
  }

  /**
   * Move a widget WITHIN its column (Elementor drag-to-reorder). Moves the
   * EXISTING widget object — never rebuilds it from schema defaults, which
   * would silently discard the merchant's content and per-widget styling.
   * `to` is the index in the ORIGINAL array; splicing the source out first
   * shifts every later slot down by one, so compensate when moving forward.
   */
  const moveWidget = (
    index: number,
    colPath: number[],
    from: number,
    to: number
  ) => {
    if (!contentRef.current) return
    const existing = widgetsAtPath(index, colPath)
    if (!existing || from === to) return
    if (from < 0 || from >= existing.length) return
    // Same landing-slot math as the command body (`to` indexes the ORIGINAL
    // array; splicing the source out first shifts later slots down by one).
    const dest = Math.max(
      0,
      Math.min(from < to ? to - 1 : to, existing.length - 1)
    )
    if (
      !execute(
        { name: "widget.move", args: { index, colPath, from, to } },
        { selAfter: { kind: "widget", index, path: [...colPath, dest] } }
      )
    ) {
      return
    }
    selectWidget(index, [...colPath, dest])
  }

  /**
   * Change a container's column count from the canvas. Routed through the same
   * `reconcileContainerProps` the panel's Columns control uses (inside the
   * registry's container.setLayout), so the derived `columns` array (and any
   * widget-preserving merge it performs) stays the single source of truth.
   */
  const setContainerLayout = (index: number, cols: number) =>
    execute({ name: "container.setLayout", args: { index, cols } })

  /**
   * The clipboard is a shared module (localStorage-backed, one for the whole
   * editor — panel strip, context menu, keyboard). These wrappers add the two
   * things the module can't know: refresh the Paste gating (panel + canvas)
   * and narrate what happened.
   */
  const syncClip = () => {
    setClip(clipSummary())
    announceClipboard()
  }

  /** Tell the canvas what is on the clipboard, so it can grey out dead menu items. */
  const announceClipboard = () => {
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:clipboard",
      ...clipSummary(),
    })
  }

  const copySection = (i: number) => {
    const cur = contentRef.current
    if (!cur || i < 0 || i >= cur.length) return
    writeClip("section", structuredClone(cur[i]) as Record<string, unknown>)
    syncClip()
    setStatus("Section copied.")
  }

  const pasteSection = (i: number) => {
    const clipSection = readClipboard().section
    const cur = contentRef.current
    if (!cur || !clipSection) return
    const at = Math.min(Math.max(i + 1, 0), cur.length)
    // The clipboard payload rides in the args so redo replays exactly what
    // was pasted, whatever the clipboard holds later.
    if (
      !execute(
        {
          name: "section.insertRaw",
          args: { at, section: structuredClone(clipSection) },
        },
        { selAfter: { kind: "section", index: at } }
      )
    ) {
      return
    }
    select({ kind: "section", index: at })
    setStatus("Section pasted.")
  }

  const copySectionStyle = (i: number) => {
    const cur = contentRef.current
    if (!cur || i < 0 || i >= cur.length) return
    const b = cur[i] as Record<string, unknown>
    writeClip(
      "style",
      structuredClone({
        source: "section",
        style: b.style,
        advanced: b.advanced,
        elementStyles: b.elementStyles,
      }) as StyleClip
    )
    syncClip()
    setStatus("Style copied — paste it onto any section, widget or element.")
  }

  const pasteSectionStyle = (i: number) => {
    const c = readClipboard().style
    const cur = contentRef.current
    if (!cur || !c || i < 0 || i >= cur.length) return
    const b = cur[i] as Record<string, unknown>
    // Only the appearance travels — the target's CONTENT is untouched. Merge,
    // so pasting a background doesn't erase the target's font settings.
    const style = deepMergeBag(
      (b.style as Record<string, unknown>) ?? {},
      c.style ?? {}
    )
    const advanced = deepMergeBag(
      (b.advanced as Record<string, unknown>) ?? {},
      c.advanced ?? {}
    )
    const elementStyles =
      c.elementStyles && Object.keys(c.elementStyles).length
        ? deepMergeBag(
            (b.elementStyles as Record<string, unknown>) ?? {},
            c.elementStyles
          )
        : undefined
    writeSectionBags(i, { style, advanced, elementStyles }, "Paste Style")
    setStatus("Style pasted.")
  }

  const resetSectionStyle = (i: number) => {
    const cur = contentRef.current
    if (!cur || i < 0 || i >= cur.length) return
    writeSectionBags(
      i,
      { style: {}, advanced: {}, elementStyles: {} },
      "Reset Style"
    )
    setStatus("Style reset.")
  }

  /* ---------------- Context-menu actions on the thing you actually clicked ----
   *
   * "Duplicate" on a heading inside a container used to duplicate the WHOLE
   * section, because the menu only ever resolved the section. A merchant asking
   * to copy one button does not expect thirty other things to come with it.
   * These operate on the widget or the element under the cursor.
   * ------------------------------------------------------------------------ */

  /** The widgets array of content[index].columns[col], or null. */
  /* ---------------- Widgets, addressed by PATH ----------------
   *
   * A widget's PATH is the chain of (column, widget) indices from the section
   * down to it: [0,1] = column 0 / widget 1; [0,1,2,3] = the widget at column 2
   * / index 3 INSIDE the inner section at column 0 / widget 1. Everything below
   * walks that path, so a widget nested in an inner section duplicates, deletes,
   * copies, pastes and styles exactly like a top-level one — no special cases.
   *
   * A COLUMN path is odd-length ([0] or [0,1,2]); a WIDGET path is even.
   * ------------------------------------------------------------------ */

  /** The widgets array living at a column path, or null. Delegates to the
   *  registry's pure body (one definition, shared with every command).
   *  The write side — including the Phase-1 facade rule (un-collapse on
   *  STRUCTURAL top-level writes only, 1V finding F1) — lives in the
   *  registry's writeWidgetsAt and is reached only through commands. */
  const widgetsAtPath = (index: number, colPath: number[]): any[] | null =>
    contentRef.current
      ? widgetsAtPathPure(contentRef.current, index, colPath)
      : null

  const colPathOf = (path: number[]) => path.slice(0, -1)
  const wiOf = (path: number[]) => path[path.length - 1]

  const duplicateWidget = (index: number, path: number[]) => {
    const colPath = colPathOf(path)
    const wi = wiOf(path)
    if (
      !execute(
        { name: "widget.duplicate", args: { index, path } },
        { selAfter: { kind: "widget", index, path: [...colPath, wi + 1] } }
      )
    ) {
      return
    }
    select({ kind: "widget", index, path: [...colPath, wi + 1] })
    setStatus("Widget duplicated.")
  }

  const removeWidget = (index: number, path: number[]) => {
    if (
      !execute({ name: "widget.remove", args: { index, path } }, {
        selAfter: null,
      })
    ) {
      return
    }
    select(null)
    setStatus("Widget deleted.")
  }

  const copyWidget = (index: number, path: number[]) => {
    const ws = widgetsAtPath(index, colPathOf(path))
    const w = ws?.[wiOf(path)]
    if (!w) return
    writeClip("widget", structuredClone(w))
    syncClip()
    setStatus("Widget copied.")
  }

  const pasteWidget = (index: number, path: number[]) => {
    const clipWidget = readClipboard().widget
    const colPath = colPathOf(path)
    const wi = wiOf(path)
    if (!clipWidget) return
    // One level of nesting: an inner section may not be pasted inside another.
    // (The registry guards this too; the wrapper keeps the user-facing why.)
    if (clipWidget.widget_type === "inner_section" && colPath.length > 1) {
      setStatus("An inner section can't go inside another inner section.")
      return
    }
    if (
      !execute(
        {
          name: "widget.paste",
          args: { index, path, widget: structuredClone(clipWidget) },
        },
        { selAfter: { kind: "widget", index, path: [...colPath, wi + 1] } }
      )
    ) {
      return
    }
    select({ kind: "widget", index, path: [...colPath, wi + 1] })
    setStatus("Widget pasted.")
  }

  const widgetStyleAction = (
    action: "copyStyle" | "pasteStyle" | "resetStyle",
    index: number,
    path: number[]
  ) => {
    const ws = widgetsAtPath(index, colPathOf(path))
    const w = ws?.[wiOf(path)]
    if (!w) return

    if (action === "copyStyle") {
      writeClip(
        "style",
        structuredClone({
          source: "widget",
          style: w.style,
          advanced: w.advanced,
        }) as StyleClip
      )
      syncClip()
      setStatus("Style copied.")
      return
    }

    if (action === "resetStyle") {
      writeWidgetBags(index, path, { style: {}, advanced: {} }, "Reset Style")
      setStatus("Style reset.")
      return
    }

    const c = readClipboard().style
    if (!c) return
    writeWidgetBags(
      index,
      path,
      {
        style: deepMergeBag(
          (w.style as Record<string, unknown>) ?? {},
          c.style ?? {}
        ),
        advanced: deepMergeBag(
          (w.advanced as Record<string, unknown>) ?? {},
          c.advanced ?? {}
        ),
      },
      "Paste Style"
    )
    setStatus("Style pasted.")
  }

  /** Style clipboard actions on a theme ELEMENT ([data-el]) inside a section.
   *  One write per action — the old version wrote the two bags sequentially
   *  and the second write erased the first (the broken Paste Style). */
  const elementStyleAction = (
    action: "copyStyle" | "pasteStyle" | "resetStyle",
    index: number,
    key: string
  ) => {
    const sec: any = contentRef.current?.[index]
    if (!sec) return
    const es = (sec.elementStyles as ElementStyles | undefined) ?? {}
    const entry: any = es[key] ?? {}

    if (action === "copyStyle") {
      writeClip(
        "style",
        structuredClone({
          source: "element",
          style: entry.style,
          advanced: entry.advanced,
        }) as StyleClip
      )
      syncClip()
      setStatus("Style copied — paste it onto any other element.")
      return
    }

    if (action === "resetStyle") {
      writeElementBags(index, key, { style: {}, advanced: {} }, "Reset Style")
      setStatus("Style reset.")
      return
    }

    const c = readClipboard().style
    if (!c) return
    writeElementBags(
      index,
      key,
      {
        style: deepMergeBag(
          (entry.style as Record<string, unknown>) ?? {},
          c.style ?? {}
        ),
        advanced: deepMergeBag(
          (entry.advanced as Record<string, unknown>) ?? {},
          c.advanced ?? {}
        ),
      },
      "Paste Style"
    )
    setStatus("Style pasted.")
  }

  /**
   * Duplicate / delete ONE item of a section's repeatable array (a hero
   * slide, a banner tile, a testimonial). `field` and `itemIndex` come from
   * the data-el-item marker on the item's DOM root, so this works for every
   * theme without knowing anything about the block. Style is untouched:
   * element styles are keyed per element KIND and shared across items.
   */
  const itemAction = (
    a: "duplicateItem" | "deleteItem",
    index: number,
    field: string,
    itemIndex: number
  ) => {
    const sec: any = contentRef.current?.[index]
    // Facade wrapper (Phase 1 normalization): the repeatable array (slides,
    // tiles, testimonials…) lives on the INNER widget, not the container.
    // The data-el-item markers in the DOM are inside the widget's theme
    // markup, so the canvas still resolves the right section index + field.
    // (The registry's item.* body walks the same facade route.)
    const facadeW: any = sec ? flushSingleCommerceWidget(sec) : null
    const arr = (facadeW ?? sec)?.[field]
    if (!Array.isArray(arr) || itemIndex < 0 || itemIndex >= arr.length) return
    if (a === "deleteItem" && arr.length <= 1) {
      setStatus(
        "That is the last item — if you don't want this section, delete the section itself."
      )
      return
    }
    if (
      !execute({
        name: a === "duplicateItem" ? "item.duplicate" : "item.remove",
        args: { index, field, itemIndex },
      })
    ) {
      return
    }
    setStatus(a === "duplicateItem" ? "Item duplicated." : "Item deleted.")
  }

  const duplicateSection = (i: number) => {
    const cur = contentRef.current
    if (!cur || i < 0 || i >= cur.length) return
    if (
      !execute(
        { name: "section.duplicate", args: { index: i } },
        { selAfter: { kind: "section", index: i + 1 } }
      )
    ) {
      return
    }
    select({ kind: "section", index: i + 1 })
  }

  const openAddAt = (index: number | null) => {
    setAddTargetIndex(index)
    // Seam "+" (2C §7): the dock's Elements tab IS the picker now.
    // `addTargetIndex` still arms the insert position for addSection.
    setDockTab("elements")
    select(null, { mirror: false })
  }

  const removeSection = (i: number) => {
    if (
      !execute({ name: "section.remove", args: { index: i } }, {
        selAfter: null,
      })
    ) {
      return
    }
    select(null)
  }

  /** The published page's storefront path (middleware adds the country
   *  segment). Shared by "View live" (footer, publish toast) and the
   *  draft preview. */
  const livePath = slug === "home" ? "/" : "/" + slug

  /** U6 publish confidence — "Preview draft": open the storefront with
   *  ?preview_draft=<editor key>, which theme-render honors (tenant-bound
   *  token gate) by rendering the DRAFT buffer through the REAL production
   *  render path. Flush the current canvas to the draft buffer first so
   *  the tab shows exactly what the merchant is looking at — but only
   *  when dirty: normalization alone must never autosave (Phase 1 rule). */
  const previewDraft = async () => {
    if (content && !loadError && contentDirty) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      try {
        setAutosave((a) => ({ ...a, status: "saving" }))
        const ok = await autosaveDraft(key, slug, locale, content)
        setAutosave({ status: ok ? "saved" : "error", at: Date.now() })
      } catch {
        setAutosave({ status: "error", at: Date.now() })
      }
    }
    window.open(
      `${livePath}?preview_draft=${encodeURIComponent(key)}&lang=${encodeURIComponent(locale)}`,
      "_blank"
    )
  }

  const publish = async () => {
    if (!content) return
    // Never publish an empty page over real content after a failed load.
    if (loadError) {
      setStatus("Can't publish — the page didn't load. Use Retry first.")
      return
    }
    setStatus("Publishing…")

    // 1. Save any edited chrome (header/topbar/footer/theme), checking EACH
    //    result. If any fails we stop and report honestly — no false success,
    //    and we only clear the dirty flag for the ones that actually saved.
    const saved: string[] = []
    const failed: string[] = []
    for (const k of Array.from(chromeDirty)) {
      // U7 persist-only-on-edit: the theme region is stored in the explicit
      // null-inherit shape. Values equal to the legacy FF defaults (which
      // pick() strips as sentinels at render) are normalized to null here so
      // a sentinel string can never be persisted as a fake "override" — the
      // stored data always matches what actually renders.
      const data =
        k === "theme" && chrome[k]
          ? normalizeThemeTokenOverrides(chrome[k] as Record<string, unknown>)
          : chrome[k]
      const ok = await saveChromeRegion(key, k, data)
      ;(ok ? saved : failed).push(k)
    }
    if (saved.length) {
      setChromeDirty((d) => {
        const n = new Set(d)
        saved.forEach((k) => n.delete(k))
        return n
      })
    }
    if (failed.length) {
      setStatus(
        `Publish failed: couldn't save ${failed.join(", ")}. Nothing was published — please try again.`
      )
      return
    }

    // 2. Publish the page sections.
    try {
      const { ok, status: httpStatus, body } = await publishPage(
        key,
        slug,
        locale,
        content
      )
      if (!ok) {
        const errList = Array.isArray(body?.errors)
          ? body.errors
              .map((e: string) =>
                "• " +
                String(e)
                  .replace(/^section\s+\S+:\s*/i, "")
                  .replace(/_/g, " ")
              )
              .join("\n")
          : ""
        setStatus(
          errList
            ? `Publish couldn't go through — please fix:\n${errList}`
            : `Publish failed: ${body?.message || httpStatus}`
        )
        return
      }
      setContentDirty(false)
      setStatus(`Published v${body?.version ?? ""} — live on your storefront.`)
    } catch (e: any) {
      setStatus(`Publish failed: ${e?.message ?? "error"}`)
    }
  }

  // Resolve a clicked canvas link: if it points at a CMS page, open that page
  // for editing; otherwise select the containing section/chrome so the click
  // still does something useful (built-in store pages aren't editable here).
  const handleLinkClick = (
    href: string,
    index: number | null,
    chromeKey: string | null
  ) => {
    const selectContainer = () => {
      if (chromeKey) selectChrome(chromeKey)
      else if (index != null) selectSection(index)
    }
    // The slug math lives in the shell/persist module (6C); only the
    // selection/navigation side-effects stay here.
    const resolved = resolveCmsLink(href, pages.map((p) => p.slug))
    if (!resolved) {
      selectContainer()
      return
    }
    if (resolved.isCmsPage) {
      goToPage(resolved.slug)
    } else {
      selectContainer()
      setStatus(
        "That link opens a built-in store page (not a CMS page), so it can't be edited here."
      )
    }
  }
  navRef.current = handleLinkClick

  // Expose the current action closures to the stable message listener (defined
  // here, after all mutators exist, to avoid a use-before-declaration TDZ).
  selRef.current = select
  ctxRef.current = {
    duplicateWidget,
    removeWidget,
    copyWidget,
    pasteWidget,
    widgetStyleAction,
    elementStyleAction,
    chromeStyleAction,
    chromeElementStyleAction,
    itemAction,
  }

  /**
   * Keyboard clipboard (Cmd/Ctrl+C, V, D, Delete) — acts on whatever is
   * selected, whichever window has focus (the canvas forwards its keys).
   * For a theme element, Copy/Paste mean its STYLE (an element is a field of
   * its section — there is no free-standing element to copy).
   */
  keyActRef.current = (a) => {
    if (selectedWidget) {
      const { index, path } = selectedWidget
      if (a === "copy") copyWidget(index, path)
      else if (a === "paste") pasteWidget(index, path)
      else if (a === "duplicate") duplicateWidget(index, path)
      else if (a === "delete") removeWidget(index, path)
      return
    }
    if (selectedElement) {
      const { index, key } = selectedElement
      if (a === "copy") elementStyleAction("copyStyle", index, key)
      else if (a === "paste") elementStyleAction("pasteStyle", index, key)
      else {
        setStatus(
          "A theme element is part of its section — duplicate or delete the section instead."
        )
      }
      return
    }
    if (selectedChromeElement) {
      const { region, key } = selectedChromeElement
      if (a === "copy") chromeElementStyleAction("copyStyle", region, key)
      else if (a === "paste") chromeElementStyleAction("pasteStyle", region, key)
      return
    }
    if (selectedChrome) {
      if (a === "copy") chromeStyleAction("copyStyle", selectedChrome)
      else if (a === "paste") chromeStyleAction("pasteStyle", selectedChrome)
      return
    }
    if (selected != null) {
      if (a === "copy") copySection(selected)
      else if (a === "paste") pasteSection(selected)
      else if (a === "duplicate") duplicateSection(selected)
      else if (a === "delete") removeSection(selected)
      return
    }
    // Nothing selected: pasting a copied section appends to the end.
    if (a === "paste" && readClipboard().section && contentRef.current) {
      pasteSection(contentRef.current.length - 1)
    }
  }

  actionsRef.current = {
    up: (i) => moveSection(i, -1),
    down: (i) => moveSection(i, 1),
    duplicate: duplicateSection,
    delete: removeSection,
    edit: selectSection,
    addBelow: (i) => openAddAt(i + 1),
    insert: (i) => openAddAt(i),
    copy: copySection,
    paste: pasteSection,
    copyStyle: copySectionStyle,
    pasteStyle: pasteSectionStyle,
    resetStyle: resetSectionStyle,
  }
  /* Phase 2A: commands arriving over the bus (cms:cmd) whose shell wrapper
     carries selection/status side-effects route through that wrapper so a
     migrated sender behaves EXACTLY like the legacy message it replaces.
     Commands without an entry fall through to the raw executor. */
  cmdSinkRef.current = {
    "section.insert": (a) =>
      insertSectionAt(
        a.at as number,
        String(a.type),
        typeof a.presetIndex === "number" ? a.presetIndex : undefined
      ),
    "section.remove": (a) => removeSection(a.index as number),
    "section.duplicate": (a) => duplicateSection(a.index as number),
    "section.move": (a) => moveSectionTo(a.from as number, a.to as number),
    "container.insert": (a) =>
      insertContainerAt(a.at as number, a.cols as number),
    "container.setLayout": (a) =>
      setContainerLayout(a.index as number, a.cols as number),
    "widget.insert": (a) =>
      insertWidgetAt(
        a.index as number,
        a.colPath as number[],
        String(a.type),
        typeof a.wi === "number" ? a.wi : undefined
      ),
    "widget.insertWrapped": (a) =>
      insertWidgetAsSection(a.at as number, String(a.type)),
    "widget.remove": (a) => removeWidget(a.index as number, a.path as number[]),
    "widget.duplicate": (a) =>
      duplicateWidget(a.index as number, a.path as number[]),
    "widget.paste": (a) => pasteWidget(a.index as number, a.path as number[]),
    "widget.move": (a) =>
      moveWidget(
        a.index as number,
        a.colPath as number[],
        a.from as number,
        a.to as number
      ),
    /* --- 5B stage: slider.* commands whose result should be SELECTED
       (the stage's add/duplicate flows). Ids are computed at dispatch
       (they ride the args), so selAfter can target the new node and
       redo restores the same selection. Every other slider.* command
       falls through to the raw executor — no side-effects needed. --- */
    "slider.addSlide": (a) => {
      const slideId = (a.slide as { id?: unknown } | undefined)?.id
      execute(
        { name: "slider.addSlide", args: a },
        typeof slideId === "string"
          ? {
              selAfter: {
                kind: "sliderSlide",
                index: a.index as number,
                slideId,
              } satisfies Sel,
            }
          : undefined
      )
    },
    "slider.duplicateSlide": (a) =>
      execute(
        { name: "slider.duplicateSlide", args: a },
        typeof a.newId === "string"
          ? {
              selAfter: {
                kind: "sliderSlide",
                index: a.index as number,
                slideId: a.newId,
              } satisfies Sel,
            }
          : undefined
      ),
    "slider.removeSlide": (a) =>
      execute(
        { name: "slider.removeSlide", args: a },
        { selAfter: { kind: "section", index: a.index as number } satisfies Sel }
      ),
    "slider.addLayer": (a) => {
      const layerId = (a.layer as { id?: unknown } | undefined)?.id
      const targeted =
        typeof layerId === "string" && typeof a.slideId === "string"
      const ok = execute(
        { name: "slider.addLayer", args: a },
        targeted
          ? {
              selAfter: {
                kind: "sliderLayer",
                index: a.index as number,
                slideId: a.slideId as string,
                layerId: layerId as string,
              } satisfies Sel,
            }
          : undefined
      )
      /* 6C (P0 fix): selAfter only restores on REDO — the executor never
         applies it at execute time. Select the just-added layer NOW
         (Elementor/RevSlider behavior): the panel mounts its form and the
         mirror (cms:selectSliderLayer) highlights it on the stage/rail. */
      if (ok && targeted) {
        select({
          kind: "sliderLayer",
          index: a.index as number,
          slideId: a.slideId as string,
          layerId: layerId as string,
        })
      }
    },
    "slider.duplicateLayer": (a) =>
      execute(
        { name: "slider.duplicateLayer", args: a },
        typeof a.newId === "string" && typeof a.slideId === "string"
          ? {
              selAfter: {
                kind: "sliderLayer",
                index: a.index as number,
                slideId: a.slideId,
                layerId: a.newId,
              } satisfies Sel,
            }
          : undefined
      ),
    "slider.removeLayer": (a) =>
      execute(
        { name: "slider.removeLayer", args: a },
        typeof a.slideId === "string"
          ? {
              selAfter: {
                kind: "sliderSlide",
                index: a.index as number,
                slideId: a.slideId,
              } satisfies Sel,
            }
          : undefined
      ),
  }

  const selectedBlock = useMemo(
    () => (content && selected != null ? content[selected] : null),
    [content, selected]
  )

  // Hydrate the preset library from the server once (the clipboard module
  // hydrates itself). Announce the (possibly persisted) clipboard so the Paste
  // buttons wake up correctly.
  useEffect(() => {
    syncClip()
    // 4C: presets are server-backed (scope:"preset" on the tenant template
    // store). loadPresets runs the one-time silent localStorage migration
    // (ff_style_presets -> server, key removed after landing) before listing.
    let cancelled = false
    loadPresets(key).then((list) => {
      if (!cancelled) setPresets(list)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sidebar Copy/Paste/Reset style — the SAME clipboard as the context menu
  // and the keyboard. Copy here, paste from the right-click menu; copy from an
  // element's menu, paste here. One clipboard, every door.
  const copyStyle = () => {
    if (selected == null) return
    copySectionStyle(selected)
  }

  const pasteStyle = () => {
    if (selected == null) return
    pasteSectionStyle(selected)
  }

  // Clear all visual bags on the selected section (content is untouched).
  const resetStyle = () => {
    if (selected == null) return
    if (
      !window.confirm(
        "Reset all Style & Advanced settings for this section? Content is kept."
      )
    ) {
      return
    }
    resetSectionStyle(selected)
  }

  // Save the selected section's look as a named preset (upsert by name).
  // Server-backed (4C): scope:"preset" on the tenant template store, keyed
  // by the section's block type so the dropdown can filter per widget.
  const saveAsPreset = () => {
    if (!selectedBlock) return
    const name = window.prompt("Save style preset as:")?.trim()
    if (!name) return
    const els =
      (selectedBlock.elementStyles as Record<string, unknown> | undefined) ??
      undefined
    const entry: StylePreset = {
      name,
      blockType: (selectedBlock as { block_type?: string }).block_type ?? null,
      style: (selectedBlock.style as Record<string, unknown>) ?? {},
      advanced: (selectedBlock.advanced as Record<string, unknown>) ?? {},
      ...(els && Object.keys(els).length ? { elementStyles: els } : {}),
    }
    setStatus(`Saving preset "${name}"…`)
    savePreset(key, entry)
      .then((next) => {
        setPresets(next)
        setStatus(`Saved preset "${name}".`)
      })
      .catch(() => setStatus("Preset save failed."))
  }

  // Apply a saved preset to the selected section (merge, like paste).
  const applyPreset = (name: string) => {
    const preset = presets.find((p) => p.name === name)
    if (!preset || selected == null || !selectedBlock) return
    const curStyle = (selectedBlock.style as Record<string, unknown>) ?? {}
    const curAdv = (selectedBlock.advanced as Record<string, unknown>) ?? {}
    const curEls =
      (selectedBlock.elementStyles as Record<string, unknown>) ?? {}
    writeSectionBags(
      selected,
      {
        style: deepMergeBag(curStyle, preset.style ?? {}),
        advanced: deepMergeBag(curAdv, preset.advanced ?? {}),
        ...(preset.elementStyles
          ? { elementStyles: deepMergeBag(curEls, preset.elementStyles) }
          : {}),
      },
      `Apply Preset "${name}"`
    )
  }

  // Global theme tokens (colors + fonts) surfaced to linkable color/font
  // controls in the Style/Advanced tabs (P5 — link-to-global-token). Sourced
  // from the editable chrome.theme; fallbacks mirror the storefront's
  // buildThemeVars defaults so a swatch/label always resolves to something. A
  // linked value stores `{ ref: <id> }`; the style engine maps it to the live
  // CSS var (--ff-<id> / --ff-font-<id>), so editing the theme cascades here.
  const themeTokens = useMemo<Tokens>(
    () => buildEditorThemeTokens(chrome.theme),
    [chrome.theme]
  )

  if (denied) {
    return (
      <div
        style={{
          padding: 48,
          fontFamily: font,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ ...type.heading, color: semantic.dangerFg }}>
          This editor link is invalid or has expired.
        </div>
        <div style={{ ...type.title, fontWeight: 400, color: grey[50] }}>
          Open the visual editor again from the admin to get a fresh link.
        </div>
        <a
          href={EXIT_HREF}
          style={{
            ...button("accent"),
            textDecoration: "none",
          }}
        >
          Return to admin
        </a>
      </div>
    )
  }

  /* --- 7A: shell ⇄ canvas stage-chrome handshake --------------------
     The canvas must stop drawing its own filmstrip/rail the moment the
     shell takes over, and must know the lock set the shell's layer list
     owns. Both are pure presentation: no document, no history. Re-posted
     on `canvasReady` too, because a canvas reload while staged would
     otherwise come back up drawing the old in-iframe chrome. ---------- */
  useEffect(() => {
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:stageChrome",
      external: staged,
    })
  }, [staged, canvasReady])
  useEffect(() => {
    if (!staged) return
    postToCanvas(iframeRef.current?.contentWindow, {
      type: "cms:stageLocks",
      layerIds: Array.from(stageLocks),
    })
  }, [staged, stageLocks, canvasReady])

  /* --- 7A: the stage model the shell's chrome reads ------------------
     Derived, never duplicated state: the SAME document the canvas renders,
     read through the same 5B host helpers, so the chrome and the stage can
     never disagree about what exists. --------------------------------- */
  const stageSlides: LayeredSlide[] =
    staged && stageIndex != null && content
      ? (slidesOfHost(readSliderHost(content, stageIndex)).filter(
          isLayeredSlide
        ) as LayeredSlide[])
      : []
  const stageFieldsCount =
    staged && stageIndex != null && content
      ? slidesOfHost(readSliderHost(content, stageIndex)).length -
        stageSlides.length
      : 0
  const stageActiveSlideId =
    selectedSliderLayer?.slideId ?? selectedSliderSlide?.slideId ?? null
  const stageActiveSlide =
    stageSlides.find((s) => s.id === stageActiveSlideId) ?? stageSlides[0] ?? null
  const stageSelectedLayerId = selectedSliderLayer?.layerId ?? null

  /* Commands run IN THE SHELL through the 2A executor — the chrome is a
     sibling of the panel, not a guest in the iframe, so every mutation is
     a direct dispatch with no round trip. Undo granularity, autosave and
     revisions are unchanged (one command per gesture, as in 5B). */
  const stageCmd = (name: CommandName, args: Record<string, unknown>) => {
    if (stageIndex == null) return
    execute({ name, args: { index: stageIndex, ...args } })
  }
  const stageSlideCmd = (name: CommandName, args: Record<string, unknown>) => {
    if (!stageActiveSlide) return
    stageCmd(name, { slideId: stageActiveSlide.id, ...args })
  }

  /* --- 7A: the slider panel, HOISTED ------------------------------------
     Extracted VERBATIM from the Dock's `editor` prop so the SAME mount can
     be rendered in TWO places: the dock (unstaged) and the stage's right
     "LAYER OPTIONS" sidebar (staged). Re-housed, not rewritten — the stage
     gets the product's real per-layer / per-slide controls, and there is
     exactly one implementation of them to keep correct. null = the
     selection is not a slider node, so the dock falls through to its
     column / widget / section branches unchanged. --------------------- */
  const sliderPanelNode: React.ReactNode =
    content && selectedSliderLayer && content[selectedSliderLayer.index] ? (
            (() => {
              const { index, slideId, layerId } = selectedSliderLayer
              const slide = findSlide(readSliderHost(content, index), slideId)
              const layer = findLayer(slide, layerId)
              if (!slide || !layer) {
                return (
                  <div>
                    <button
                      onClick={() => select({ kind: "section", index })}
                      style={backLink}
                    >
                      <UiIcon name="arrow-left" size={12} />
                      Back to Hero Slider
                    </button>
                    <p style={{ ...type.body, color: grey[50] }}>
                      This layer no longer exists.
                    </p>
                  </div>
                )
              }
              const curFlat = layerPanelProps(layer)
              return (
                <SchemaPanel
                  widgetMode
                  nodeKind="widget"
                  blockLabel={`Hero Slider › ${slide.name || "Slide"}`}
                  elementLabel={layerDisplayName(layer as StageSliderLayer)}
                  onBackToSection={() =>
                    select({ kind: "sliderSlide", index, slideId })
                  }
                  contentFields={[
                    ...(LAYER_CONTENT_FIELDS[layer.type] ?? []),
                    ...LAYER_ANIM_FIELDS,
                  ]}
                  props={curFlat}
                  onChange={(next) => {
                    const parts = splitLayerEdit(next)
                    const cur = splitLayerEdit(curFlat)
                    if (
                      JSON.stringify(parts.props) !== JSON.stringify(cur.props)
                    ) {
                      execute({
                        name: "slider.setLayerProps",
                        args: { index, slideId, layerId, props: parts.props },
                      })
                    }
                    if (
                      JSON.stringify(parts.anim) !== JSON.stringify(cur.anim)
                    ) {
                      execute({
                        name: "slider.setLayerAnim",
                        args: { index, slideId, layerId, anim: parts.anim },
                      })
                    }
                  }}
                  contentExtra={
                    <FrameControls
                      frame={layer.frame}
                      device={device}
                      onCommit={(dev, frame: LayerFrame | null) =>
                        execute({
                          name: "slider.setLayerFrame",
                          args: { index, slideId, layerId, device: dev, frame },
                        })
                      }
                    />
                  }
                  styleFields={LAYER_STYLE_FIELDS[layer.type] ?? []}
                  advancedFields={LAYER_ADVANCED_FIELDS}
                  styleBag={(layer.style as Record<string, unknown>) ?? {}}
                  advancedBag={(layer.advanced as Record<string, unknown>) ?? {}}
                  onStyleChange={(next) =>
                    execute({
                      name: "slider.setLayerStyle",
                      args: { index, slideId, layerId, bags: { style: next } },
                    })
                  }
                  onAdvancedChange={(next) =>
                    execute({
                      name: "slider.setLayerStyle",
                      args: { index, slideId, layerId, bags: { advanced: next } },
                    })
                  }
                  device={device}
                  themeTokens={themeTokens}
                />
              )
            })()
          ) : content && selectedSliderSlide && content[selectedSliderSlide.index] ? (
            (() => {
              const { index, slideId } = selectedSliderSlide
              const slide = findSlide(readSliderHost(content, index), slideId)
              if (!slide) {
                return (
                  <div>
                    <button
                      onClick={() => select({ kind: "section", index })}
                      style={backLink}
                    >
                      <UiIcon name="arrow-left" size={12} />
                      Back to Hero Slider
                    </button>
                    <p style={{ ...type.body, color: grey[50] }}>
                      This slide no longer exists.
                    </p>
                  </div>
                )
              }
              const curFlat = slidePanelProps(slide)
              return (
                <SchemaPanel
                  widgetMode
                  blockLabel="Hero Slider"
                  elementLabel={slide.name || "Slide"}
                  onBackToSection={() => select({ kind: "section", index })}
                  contentFields={SLIDE_CONTENT_FIELDS}
                  props={curFlat}
                  onChange={(next) => {
                    const parts = assembleSlideEdit(next)
                    const cur = assembleSlideEdit(curFlat)
                    if (
                      JSON.stringify(parts.props) !== JSON.stringify(cur.props)
                    ) {
                      execute({
                        name: "slider.setSlideProps",
                        args: { index, slideId, props: parts.props },
                      })
                    }
                    if (
                      JSON.stringify(parts.background) !==
                      JSON.stringify(cur.background)
                    ) {
                      execute({
                        name: "slider.setSlideBackground",
                        args: { index, slideId, background: parts.background },
                      })
                    }
                  }}
                  styleFields={[]}
                  advancedFields={[]}
                  notice="Slide name, timing and background. Layers are edited on the stage — select one there or in the layer rail."
                  device={device}
                  themeTokens={themeTokens}
                />
              )
            })()
    ) : null

  return (
    <CatalogProvider editorKey={key}>
    <LinkPagesProvider pages={pages}>
    <div style={{ display: "flex", height: "100vh", fontFamily: font }}>
      {/* Canvas */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          /* 7A: while staged this column IS the stage's centre region —
             dark chrome all the way to the viewport edges. */
          background: staged ? ink.base : grey[10],
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Device / responsive toggle. 7A: the whole strip stands down
            while staged — the stage's own top toolbar carries Back, the
            device switch and the layer actions, full-width. */}
        <div
          style={{
            display: staged ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 12px",
            borderBottom: hairlineDark,
            background: ink.base,
          }}
        >
          <button
            onClick={exitEditor}
            title="Exit editor"
            style={{
              ...deviceBtn,
              marginRight: "auto",
            }}
          >
            <UiIcon name="arrow-left" size={14} />
            Exit
          </button>
          {/* Device toggle — one segmented control with device glyphs.
              Hidden while the slide stage is up: the stage has its own
              device switch and drives its own frames. */}
          <div
            role="group"
            aria-label="Preview device"
            hidden={staged}
            style={{
              display: "flex",
              gap: 2,
              padding: 2,
              background: ink.raised,
              border: hairlineDark,
              borderRadius: radius.md,
            }}
          >
            {DEVICES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDevice(d.id)}
                title={d.title}
                aria-label={d.title}
                style={{
                  border: 0,
                  borderRadius: radius.sm,
                  width: 32,
                  height: 24,
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  background: device === d.id ? accent.base : "transparent",
                  color: device === d.id ? accent.on : ink.muted,
                  boxShadow: "none",
                  transition: `background ${motion.fast}, color ${motion.fast}`,
                }}
              >
                <UiIcon name={d.icon} size={15} />
              </button>
            ))}
          </div>
          <span
            style={{
              ...type.label,
              color: dirty ? semantic.warnBorder : ink.muted,
              marginLeft: "auto",
              minWidth: 90,
              textAlign: "right",
            }}
          >
            {dirty || autosave.status === "saving"
              ? autosave.status === "saving"
                ? "Saving draft…"
                : autosave.status === "error"
                ? "⚠ Autosave failed — retrying"
                : autosave.at
                ? "✓ Draft saved"
                : "● Unsaved changes"
              : device === "desktop"
              ? "Full width"
              : `${DEVICE_WIDTH[device]}px`}
          </span>
          {previewMode && (
            <button
              onClick={() => {
                setPreviewMode(false)
                setPanelCollapsed(false)
                postToCanvas(iframeRef.current?.contentWindow, {
                  type: "cms:previewMode",
                  on: false,
                })
              }}
              style={{
                ...button("accent", "sm"),
                marginLeft: 8,
              }}
            >
              Exit preview
            </button>
          )}
          <button
            onClick={() => setPanelCollapsed((c) => !c)}
            title={panelCollapsed ? "Show panel" : "Hide panel"}
            style={{
              ...deviceBtn,
              marginLeft: 8,
            }}
          >
            <UiIcon name="panel" size={14} />
            {panelCollapsed ? "Show panel" : "Hide panel"}
          </button>
        </div>
        {/* Responsive-editing hint: makes it explicit that the toggle now also
            drives which device the Style/Advanced controls write to. */}
        {device !== "desktop" && !staged && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 12px",
              ...type.label,
              color: semantic.warnFg,
              background: semantic.warnBg,
              borderBottom: `1px solid ${semantic.warnBorder}`,
            }}
          >
            <UiIcon name="brush" size={14} />
            Editing {device} — Style &amp; Advanced changes apply to this size and
            down. Desktop values stay untouched.
          </div>
        )}
        {/* Scroll area — centers the constrained iframe like a device frame */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "stretch",
            /* 7A: while staged, the iframe is INSET into the centre region
               the fixed stage chrome leaves free. One source of truth for
               the geometry — StageChrome exports these constants — so the
               chrome and the canvas box can never disagree. */
            ...(staged
              ? {
                  paddingTop:
                    STAGE_TOPBAR_H +
                    (stageSlidesOpen ? STAGE_SLIDESTRIP_H : 0),
                  paddingRight: STAGE_SIDEBAR_W,
                  paddingBottom: STAGE_BOTTOM_H,
                  paddingLeft: 0,
                }
              : { padding: device === "desktop" ? 0 : 16 }),
          }}
        >
          <iframe
            ref={iframeRef}
            src={canvasSrc}
            title="Storefront canvas"
            style={{
              width:
                device === "desktop" ? "100%" : `${DEVICE_WIDTH[device]}px`,
              maxWidth: "100%",
              height: "100%",
              flexShrink: 0,
              border: 0,
              background: grey[0],
              borderRadius: device === "desktop" ? 0 : radius.lg,
              boxShadow: device === "desktop" ? "none" : shadow.md,
            }}
          />
        </div>
      </div>

      {/* Drag handle to resize the panel */}
      {!panelCollapsed && !staged && (
        <div
          onMouseDown={() => {
            resizingRef.current = true
            document.body.style.userSelect = "none"
          }}
          title="Drag to resize"
          style={{
            order: -1,
            width: 4,
            cursor: "col-resize",
            flexShrink: 0,
            background: grey[20],
          }}
        />
      )}

      {/* Panel */}
      {/* Left editing panel. 7A: fully collapsed while staged — this is
          the panel that boxed the old in-iframe stage in, and the stage's
          options now live in its own right-hand sidebar. */}
      <aside
        hidden={staged}
        style={{
          order: -2,
          width: staged || panelCollapsed ? 0 : panelWidth,
          flexShrink: 0,
          borderRight: staged || panelCollapsed ? "none" : hairline,
          display: "flex",
          flexDirection: "column",
          background: grey[0],
          overflow: "hidden",
        }}
      >
        {/* Branded header — wordmark strip + page switcher / history / publish */}
        <div
          style={{
            background: ink.base,
            padding: "12px 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                ...type.title,
                fontFamily: font,
                color: ink.text,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              mAutomate
            </span>
            <span
              style={{
                ...type.micro,
                color: accent.base,
                border: `1px solid ${accent.ring}`,
                borderRadius: radius.sm,
                padding: "2px 6px",
                lineHeight: 1.4,
              }}
            >
              Editor
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              value={slug}
              onChange={(e) => {
                const v = e.target.value
                if (v === "__new__") {
                  setNewPageOpen(true)
                } else {
                  goToPage(v)
                }
              }}
              style={{
                ...field(),
                ...type.label,
                fontFamily: font,
                marginRight: "auto",
                width: "auto",
                minWidth: 0,
                maxWidth: 150,
                height: 28,
                padding: "0 8px",
                border: hairlineDark,
                background: ink.raised,
                color: ink.text,
                cursor: "pointer",
              }}
              title="Switch page"
            >
              {!pages.find((p) => p.slug === slug) && (
                <option value={slug}>{slug}</option>
              )}
              {pages.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title} (/{p.slug === "home" ? "" : p.slug})
                </option>
              ))}
              <option value="__new__">+ New page…</option>
            </select>
            <IconButton
              dark
              icon="undo"
              label="Undo"
              onClick={undo}
              disabled={!exe.canUndo()}
              size={28}
            />
            <IconButton
              dark
              icon="redo"
              label="Redo"
              onClick={redo}
              disabled={!exe.canRedo()}
              size={28}
            />
            <button
              onClick={() => {
                const on = !previewMode
                setPreviewMode(on)
                setPanelCollapsed(on)
                postToCanvas(iframeRef.current?.contentWindow, {
                  type: "cms:previewMode",
                  on,
                })
              }}
              title={previewMode ? "Exit preview" : "Preview changes (no publish needed)"}
              aria-label="Preview changes"
              style={{
                ...iconButton("sm", true),
                ...(previewMode
                  ? {
                      background: accent.base,
                      borderColor: accent.base,
                      color: accent.on,
                    }
                  : {}),
                flexShrink: 0,
              }}
            >
              <UiIcon name="eye" size={14} />
            </button>
            <button
              onClick={() => setShowAi(true)}
              title="AI editor — edit this page by describing changes"
              style={{
                ...button("ghost", "sm"),
                border: hairlineDark,
                background: accent.soft,
                color: accent.base,
                flexShrink: 0,
              }}
            >
              <UiIcon name="sparkles" size={14} />
              AI
            </button>
            <button
              onClick={previewDraft}
              title="Preview draft — see your unpublished changes on the real storefront (new tab, only you can open it)"
              aria-label="Preview draft on the storefront"
              style={{
                ...button("ghost", "sm"),
                border: hairlineDark,
                background: "transparent",
                color: ink.muted,
                flexShrink: 0,
              }}
            >
              <UiIcon name="external-link" size={13} />
              Preview
            </button>
            <button
              onClick={publish}
              disabled={!dirty}
              title={dirty ? "Publish your changes" : "All changes published"}
              style={{
                ...button(dirty ? "accent" : "ghost", "sm"),
                ...(dirty
                  ? {}
                  : {
                      background: ink.raised,
                      borderColor: ink.hairline,
                      color: ink.muted,
                      cursor: "default",
                    }),
                flexShrink: 0,
              }}
            >
              {dirty ? (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: radius.pill,
                    background: accent.on,
                    display: "inline-block",
                  }}
                />
              ) : null}
              {dirty ? "Publish" : "Published"}
            </button>
            {/* RevisionsPanel slide-over retired (2C §8): version history
                lives in the dock's History tab (HistoryPane) — same
                endpoint, same Restore→review→Publish flow. */}
            {showAi && (
              <AiPanel
                editorKey={key}
                brand={brandName}
                blocks={content ?? []}
                onApply={applyAiPatches}
                onClose={() => setShowAi(false)}
              />
            )}
            <CommandPalette
              open={showPalette}
              onClose={() => setShowPalette(false)}
              commands={[
                { id: "publish", label: "Publish page", category: "Actions", hint: "Go live", keywords: "publish live deploy", run: () => publish() },
                { id: "history", label: "History", category: "Actions", keywords: "revisions restore rollback undo actions versions", run: () => setDockTab("history") },
                { id: "preview-draft", label: "Preview draft", category: "Actions", hint: "New tab", keywords: "preview draft live storefront unpublished", run: () => previewDraft() },
                { id: "undo", label: "Undo", category: "Actions", hint: "⌘Z", run: () => undo() },
                { id: "redo", label: "Redo", category: "Actions", hint: "⇧⌘Z", run: () => redo() },
                { id: "dev-desktop", label: "Preview: Desktop", category: "View", run: () => setDevice("desktop") },
                { id: "dev-tablet", label: "Preview: Tablet", category: "View", run: () => setDevice("tablet") },
                { id: "dev-mobile", label: "Preview: Mobile", category: "View", run: () => setDevice("mobile") },
                { id: "exit", label: "Exit editor", category: "Navigate", run: () => { window.location.href = EXIT_HREF } },
                ...pages.map((pg: { slug: string; title?: string }) => ({
                  id: "page-" + pg.slug,
                  label: "Go to: " + (pg.title || pg.slug),
                  category: "Pages",
                  keywords: pg.slug,
                  run: () => goToPage(pg.slug),
                })),
              ]}
            />
            {showTemplates && (
              <TemplateLibrary
                slug={slug}
                locale={locale}
                editorKey={key}
                currentBlocks={content ?? []}
                platformTheme={String((chromeRaw as any)?.platform_theme ?? "")}
                activeTheme={String((chromeRaw as any)?.active_theme ?? "")}
                brandName={brandName}
                previewChrome={chromeRaw}
                selectedBlock={selectedBlock as Record<string, unknown> | null}
                onClose={() => {
                  setShowTemplates(false)
                  setTemplateAt(null)
                }}
                onInsert={(blocks) => {
                  const cur = contentRef.current
                  if (!cur || !Array.isArray(blocks) || blocks.length === 0) return

                  // Phase 1: templates may carry FLAT themed blocks — the
                  // registry's template.insert body runs them through the
                  // same normalization the load path applies, so a
                  // normalized document never regrows flat sections
                  // mid-session. This is a real merchant edit, so the
                  // executor marks it dirty as commit() always did.

                  // Insert WHERE THE USER IS, not at the bottom of the document.
                  //
                  // On a real page — 30-odd sections, ~18,000px — appending to
                  // the end lands below the footer, off screen, and reads as
                  // "the template did nothing". Elementor drops a template right
                  // after whatever you have selected; so does this. With nothing
                  // selected it still falls back to the end.
                  const at =
                    templateAt != null && templateAt >= 0 && templateAt <= cur.length
                      ? templateAt
                      : selected != null && selected >= 0 && selected < cur.length
                        ? selected + 1
                        : cur.length

                  if (
                    !execute(
                      {
                        name: "template.insert",
                        args: { at, sections: blocks },
                      },
                      { selAfter: { kind: "section", index: at } }
                    )
                  ) {
                    return
                  }
                  // Select + scroll to the first inserted section so the result
                  // is immediately visible (cms:select scrolls it into view).
                  select({ kind: "section", index: at })
                  const where =
                    at === cur.length
                      ? "at the end of the page"
                      : "below the selected section"
                  setStatus(
                    `Template added — ${blocks.length} section${
                      blocks.length === 1 ? "" : "s"
                    } inserted ${where}.`
                  )
                }}
              />
            )}
          </div>
        </div>
        {status &&
          (() => {
            const isErr =
              status.startsWith("Publish failed") ||
              status.startsWith("Can't publish")
            return (
              <div
                role="status"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  margin: "12px 12px 0",
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  ...type.label,
                  background: isErr ? semantic.dangerBg : semantic.successBg,
                  border: `1px solid ${
                    isErr ? semantic.dangerBorder : semantic.successBorder
                  }`,
                  color: isErr ? semantic.dangerFg : semantic.successFg,
                  flexShrink: 0,
                }}
              >
                <UiIcon
                  name={isErr ? "alert" : "check"}
                  size={14}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <span style={{ whiteSpace: "pre-line", flex: 1 }}>{status}</span>
                {/* U6 publish confidence: Publish success → "View live"
                    (Elementor's "Have a look"). Hidden again the moment a
                    new edit makes the page dirty. */}
                {!isErr && !dirty && status.startsWith("Published v") && (
                  <button
                    onClick={() => window.open(livePath, "_blank")}
                    title="Open the published page in a new tab"
                    style={{
                      ...type.label,
                      fontFamily: font,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      border: `1px solid ${semantic.successBorder}`,
                      borderRadius: radius.sm,
                      background: "transparent",
                      color: semantic.successFg,
                      padding: "2px 8px",
                      cursor: "pointer",
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  >
                    <UiIcon name="external-link" size={12} />
                    View live
                  </button>
                )}
              </div>
            )
          })()}

        {/* Body (2C): the loadError / not-loaded branches keep the old
            wrapper div (they gate the whole panel); everything else is
            re-housed in the Dock's five tabs. Pure re-housing — no JSX
            inside the moved branches changes. */}
        {loadError ? (
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            <div>
              <p
                style={{
                  ...type.bodyStrong,
                  color: semantic.dangerFg,
                  margin: "0 0 6px",
                }}
              >
                This page could not be loaded.
              </p>
              <p style={{ ...type.label, color: grey[50], margin: "0 0 12px" }}>
                Your storefront may be offline or the link may have expired.
                Publishing is disabled until it loads.
              </p>
              <button
                onClick={() => setReloadNonce((n) => n + 1)}
                style={button("secondary", "sm")}
              >
                Retry
              </button>
            </div>
          </div>
        ) : !content ? (
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            <p style={{ ...type.body, color: grey[50] }}>Loading…</p>
          </div>
        ) : (
          <Dock
            active={dockTab}
            onSelect={setDockTab}
            hasSelection={selectionKey != null}
            elements={
              <ElementsPane
                usedTypes={content.map(displayTypeOf)}
                onAdd={addSection}
              />
            }
            editor={
          /* --- 5B stage: per-layer panel (ARCH-SLIDER §3.1) — the
             EXISTING SchemaPanel, mounted for the stage's selection:
             Content = the layer's typed props + the Anim group,
             Frame group via contentExtra, Style = a UNIVERSAL_STYLE
             subset writing the layer's own bags. All writes are
             slider.* commands (coalesced per layer for typing). --- */
          sliderPanelNode ? (
            sliderPanelNode
          ) : /* --- end 5B stage --- */
          selectedColumn && content[selectedColumn.index] ? (
            (() => {
              const { index, colPath } = selectedColumn
              const section: any = content[index]
              const facade = facadeOf(section)
              const col = columnAtPath(index, colPath)
              if (!col) {
                // Same "no longer exists" fallback as widgets.
                return (
                  <div>
                    <button
                      onClick={() => select({ kind: "section", index })}
                      style={backLink}
                    >
                      <UiIcon name="arrow-left" size={12} />
                      Back to {facade.label}
                    </button>
                    <p style={{ ...type.body, color: grey[50] }}>
                      This column no longer exists.
                    </p>
                  </div>
                )
              }

              // FACADE ROUTING (2E §4, decision (a)): on a facade the column
              // IS the section box — bags read from and write to the SECTION
              // (section.setBags), collapse intact. Un-collapsing for a style
              // edit would silently de-gutter legacy heroes (F1 re-introduced
              // through the style panel).
              const isFacade = facade.isFacade && colPath.length === 1
              const colStyleBag =
                ((isFacade ? section.style : col.style) as
                  | Record<string, unknown>
                  | undefined) ?? {}
              const colAdvancedBag =
                ((isFacade ? section.advanced : col.advanced) as
                  | Record<string, unknown>
                  | undefined) ?? {}
              const writeBag = (
                bagKey: "style" | "advanced",
                next: Record<string, unknown>
              ) => {
                if (isFacade) {
                  // Section-level bag write — the existing section.setBags
                  // path (diff-only merge host; flush untouched).
                  writeSectionBags(index, { [bagKey]: next })
                } else {
                  writeColumnBags(index, colPath, { [bagKey]: next })
                }
              }

              const colNo = colPath[colPath.length - 1] + 1
              const trail =
                colPath.length > 1
                  ? `Container › Column ${colPath[0] + 1} › Inner Section`
                  : facade.label // "Hero Slider" on a facade, "Container" otherwise
              return (
                <SchemaPanel
                  elementMode /* Style+Advanced only, breadcrumb+back */
                  blockLabel={trail}
                  crumbs={
                    colPath.length > 1
                      ? [
                          {
                            label: "Container",
                            onClick: () => select({ kind: "section", index }),
                          },
                          {
                            label: `Column ${colPath[0] + 1}`,
                            onClick: () =>
                              select({
                                kind: "column",
                                index,
                                colPath: [colPath[0]],
                              }),
                          },
                          {
                            label: "Inner Section",
                            onClick: () =>
                              selectWidget(index, [colPath[0], colPath[1]]),
                          },
                        ]
                      : [
                          {
                            label: trail,
                            onClick: () => select({ kind: "section", index }),
                          },
                        ]
                  }
                  elementLabel={`Column ${colNo}`}
                  onBackToSection={() => select({ kind: "section", index })}
                  styleFields={COLUMN_STYLE_FIELDS}
                  advancedFields={COLUMN_ADVANCED_FIELDS}
                  notice={
                    isFacade
                      ? "This block has a single implicit column, so styling here applies to the whole section."
                      : undefined
                  }
                  styleBag={colStyleBag}
                  advancedBag={colAdvancedBag}
                  onStyleChange={(next) => writeBag("style", next)}
                  onAdvancedChange={(next) => writeBag("advanced", next)}
                  device={device}
                  themeTokens={themeTokens}
                />
              )
            })()
          ) : selectedWidget && content[selectedWidget.index] ? (
            (() => {
              const { index, path } = selectedWidget
              const widget = widgetsAtPath(index, path.slice(0, -1))?.[
                path[path.length - 1]
              ] as Widget | undefined
              const col = path[path.length - 2]
              if (!widget) {
                return (
                  <div>
                    <button
                      onClick={backToContainer}
                      style={backLink}
                    >
                      <UiIcon name="arrow-left" size={12} />
                      Back to Container
                    </button>
                    <p style={{ ...type.body, color: grey[50] }}>
                      This widget no longer exists.
                    </p>
                  </div>
                )
              }
              const def = getWidgetSchema(widget.widget_type)
              const {
                widget_type,
                style,
                advanced,
                columns: widgetColumns,
                ...contentProps
              } = widget as any
              const isInner = widget_type === "inner_section"
              // "Container › Column 1" for a top-level widget; nested widgets
              // spell out where they live, e.g. "Container › Column 1 › Inner
              // Section › Column 2".
              const trail =
                path.length > 2
                  ? `Container › Column ${path[0] + 1} › Inner Section › Column ${
                      path[2] + 1
                    }`
                  : `Container › Column ${col + 1}`
              return (
                <>
                <ClipStrip
                  canPaste={clip.hasStyle}
                  onCopy={() => widgetStyleAction("copyStyle", index, path)}
                  onPaste={() => widgetStyleAction("pasteStyle", index, path)}
                  onReset={() => widgetStyleAction("resetStyle", index, path)}
                />
                <SchemaPanel
                  widgetMode
                  nodeKind={isInner ? "innerSection" : "widget"} /* 3D */
                  blockLabel={trail}
                  crumbs={
                    path.length > 2
                      ? [
                          { label: "Container", onClick: backToContainer },
                          {
                            label: `Column ${path[0] + 1}`,
                            onClick: () =>
                              select({
                                kind: "column",
                                index,
                                colPath: [path[0]],
                              }),
                          },
                          {
                            label: "Inner Section",
                            onClick: () =>
                              selectWidget(index, [path[0], path[1]]),
                          },
                          {
                            label: `Column ${path[2] + 1}`,
                            onClick: () =>
                              select({
                                kind: "column",
                                index,
                                colPath: [path[0], path[1], path[2]],
                              }),
                          },
                        ]
                      : [
                          { label: "Container", onClick: backToContainer },
                          {
                            label: `Column ${col + 1}`,
                            onClick: () =>
                              select({ kind: "column", index, colPath: [col] }),
                          },
                        ]
                  }
                  elementLabel={def?.label ?? widget_type}
                  onBackToSection={backToContainer}
                  contentFields={def?.fields ?? []}
                  props={contentProps}
                  onChange={(next) =>
                    updateSelectedWidget(
                      // An inner section's layout drives its own column count,
                      // exactly like the section-level container's does.
                      isInner
                        ? (reconcileInnerColumns(next, widgetColumns) as any)
                        : next
                    )
                  }
                  contentExtra={
                    isInner ? (
                      <ContainerColumnsEditor
                        columns={(widgetColumns as Column[]) ?? []}
                        onChange={setSelectedWidgetColumns}
                        onSelectWidget={(c2, w2) =>
                          selectWidget(index, [...path, c2, w2])
                        }
                        onSelectColumn={(c2) =>
                          select({
                            kind: "column",
                            index,
                            colPath: [...path, c2],
                          })
                        }
                      />
                    ) : undefined
                  }
                  styleBag={(style as Record<string, unknown>) ?? {}}
                  advancedBag={(advanced as Record<string, unknown>) ?? {}}
                  onStyleChange={(next) =>
                    updateSelectedWidgetBag("style", next)
                  }
                  onAdvancedChange={(next) =>
                    updateSelectedWidgetBag("advanced", next)
                  }
                  device={device}
                  themeTokens={themeTokens}
                />
                </>
              )
            })()
          ) : selectedElement && content[selectedElement.index] ? (
            (() => {
              const section = content[selectedElement.index]
              // Facade wrapper (Phase 1 normalization): the [data-el] elements
              // belong to the INNER themed widget, so element defs, the block
              // schema and the editable CONTENT resolve through it. Element
              // STYLE bags stay at SECTION level (elementStyles on the
              // wrapper — the CSS scope `.cms-sec-sec-<i> [data-el=…]` is
              // unchanged by normalization), so style read/write below is
              // untouched.
              const facadeW = flushSingleCommerceWidget(section)
              const blockType = facadeW
                ? String(facadeW.widget_type)
                : section.block_type
              const def = getElementDefs(blockType).find(
                (d) => d.key === selectedElement.key
              )
              const es =
                (section.elementStyles as ElementStyles | undefined) ?? {}
              const entry = es[selectedElement.key] ?? {}
              const elSchema = getBlockSchema(blockType)
              const { block_type: _bt, schema_version: _sv, ...sectionData } =
                section as Record<string, unknown>
              const elData = facadeW
                ? (() => {
                    const {
                      widget_type: _wt,
                      style: _ws,
                      advanced: _wa,
                      schema_version: _wsv,
                      ...rest
                    } = facadeW as Record<string, unknown>
                    return rest
                  })()
                : sectionData
              return (
                <>
                <ClipStrip
                  canPaste={clip.hasStyle}
                  onCopy={() =>
                    elementStyleAction(
                      "copyStyle",
                      selectedElement.index,
                      selectedElement.key
                    )
                  }
                  onPaste={() =>
                    elementStyleAction(
                      "pasteStyle",
                      selectedElement.index,
                      selectedElement.key
                    )
                  }
                  onReset={() =>
                    elementStyleAction(
                      "resetStyle",
                      selectedElement.index,
                      selectedElement.key
                    )
                  }
                />
                <SchemaPanel
                  elementMode
                  nodeKind="element" /* 3D */
                  blockLabel={BLOCK_LABELS[blockType] ?? blockType}
                  elementLabel={def?.label ?? selectedElement.key}
                  onBackToSection={backToSection}
                  // The element's CONTENT is the owning section's content. Passing
                  // it here is what turns element mode from a Style-only dead end
                  // (where the only way to edit the words was "← Back to Hero
                  // Slider") into a real Content / Style / Advanced panel.
                  schema={elSchema ?? undefined}
                  props={elData}
                  elementKey={selectedElement.key}
                  onChange={(next) =>
                    facadeW
                      ? // Facade: the content lives on the inner widget at
                        // [0,0] — writeWidget preserves widget_type / style /
                        // advanced and streams the section patch as usual.
                        writeWidget(selectedElement.index, [0, 0], {
                          ...(facadeW as any),
                          ...next,
                        })
                      : updateSectionAt(selectedElement.index, {
                          block_type: blockType,
                          ...(_sv != null ? { schema_version: _sv } : {}),
                          ...next,
                        })
                  }
                  styleBag={(entry.style as Record<string, unknown>) ?? {}}
                  advancedBag={
                    (entry.advanced as Record<string, unknown>) ?? {}
                  }
                  onStyleChange={(next) =>
                    updateSelectedElementBag(selectedElement.key, "style", next)
                  }
                  onAdvancedChange={(next) =>
                    updateSelectedElementBag(
                      selectedElement.key,
                      "advanced",
                      next
                    )
                  }
                  device={device}
                  themeTokens={themeTokens}
                />
                </>
              )
            })()
          ) : selectedChromeElement ? (
            (() => {
              const region = selectedChromeElement.region
              const elKey = selectedChromeElement.key
              const def = getChromeElementDefs(region).find(
                (d) => d.key === elKey
              )
              const regionData = (chrome[region] ?? {}) as Record<string, unknown>
              const es =
                (regionData.elementStyles as ElementStyles | undefined) ?? {}
              const entry = es[elKey] ?? {}
              const regionLabel = getChromeSchema(region)?.label ?? region
              return (
                <>
                <ClipStrip
                  canPaste={clip.hasStyle}
                  onCopy={() => chromeElementStyleAction("copyStyle", region, elKey)}
                  onPaste={() => chromeElementStyleAction("pasteStyle", region, elKey)}
                  onReset={() => chromeElementStyleAction("resetStyle", region, elKey)}
                />
                <SchemaPanel
                  elementMode
                  nodeKind="chromeElement" /* 3D */
                  blockLabel={regionLabel}
                  elementLabel={def?.label ?? elKey}
                  onBackToSection={backToChromeRegion}
                  // Same dead end, same fix: a header/footer element's content is
                  // the region's content, so it is editable right here.
                  schema={getChromeSchema(region) ?? undefined}
                  props={regionData}
                  elementKey={elKey}
                  onChange={(next) => updateChrome(region, next)}
                  styleBag={(entry.style as Record<string, unknown>) ?? {}}
                  advancedBag={
                    (entry.advanced as Record<string, unknown>) ?? {}
                  }
                  onStyleChange={(next) =>
                    updateChromeElementBag(region, elKey, "style", next)
                  }
                  onAdvancedChange={(next) =>
                    updateChromeElementBag(region, elKey, "advanced", next)
                  }
                  device={device}
                  themeTokens={themeTokens}
                />
                </>
              )
            })()
          ) : selectedChrome && getChromeSchema(selectedChrome) ? (
            (() => {
              // The three chrome regions (topbar/header/footer) get whole-bar
              // Style + Advanced tabs (scoped to `.cms-chrome-<region>`); `theme`
              // stays Content-only (it has no root box to style).
              const stylable =
                selectedChrome === "topbar" ||
                selectedChrome === "header" ||
                selectedChrome === "footer"
              const regionData = (chrome[selectedChrome] ?? {}) as Record<
                string,
                unknown
              >
              // U7 — the Colors & fonts region carries the explicit
              // null-inherit token model. Each built-in token field gets an
              // Inherited/Overridden chip + Reset-to-theme-default; the
              // inherited display value is EXACTLY what buildThemeVars emits
              // for null (active theme manifest token, else the FF default).
              const manifestTokens = ((chromeRaw?.theme_tokens ?? {}) as {
                colors?: Record<string, string>
                fonts?: Record<string, string>
              })
              const inheritBases =
                selectedChrome === "theme"
                  ? {
                      ...Object.fromEntries(
                        (
                          Object.keys(FF_DEFAULT_COLORS) as Array<
                            keyof typeof FF_DEFAULT_COLORS
                          >
                        ).map((k) => [
                          `colors.${k}`,
                          manifestTokens.colors?.[k] ?? FF_DEFAULT_COLORS[k],
                        ])
                      ),
                      ...Object.fromEntries(
                        (
                          Object.keys(FF_DEFAULT_FONTS) as Array<
                            keyof typeof FF_DEFAULT_FONTS
                          >
                        ).map((k) => [
                          `fonts.${k}`,
                          manifestTokens.fonts?.[k] ?? FF_DEFAULT_FONTS[k],
                        ])
                      ),
                    }
                  : undefined
              return (
                <div>
                  <button onClick={() => select(null)} style={backLink}>
                    <UiIcon name="arrow-left" size={12} />
                    Elements
                  </button>
                  <h3 style={{ ...type.title, color: grey[90], margin: "0 0 8px" }}>
                    {getChromeSchema(selectedChrome)!.label}
                  </h3>
                  {stylable ? (
                    <ClipStrip
                      canPaste={clip.hasStyle}
                      onCopy={() => chromeStyleAction("copyStyle", selectedChrome)}
                      onPaste={() => chromeStyleAction("pasteStyle", selectedChrome)}
                      onReset={() => chromeStyleAction("resetStyle", selectedChrome)}
                    />
                  ) : null}
                  <SchemaPanel
                    schema={getChromeSchema(selectedChrome)!}
                    props={regionData}
                    onChange={(next) => updateChrome(selectedChrome, next)}
                    inheritBases={inheritBases}
                    {...(stylable
                      ? {
                          nodeKind: "chrome" as const, // 3D
                          styleBag:
                            (regionData.style as Record<string, unknown>) ?? {},
                          advancedBag:
                            (regionData.advanced as Record<string, unknown>) ??
                            {},
                          onStyleChange: (next: Record<string, unknown>) =>
                            updateChromeBag(selectedChrome, "style", next),
                          onAdvancedChange: (next: Record<string, unknown>) =>
                            updateChromeBag(selectedChrome, "advanced", next),
                          device,
                          themeTokens,
                        }
                      : {})}
                  />
                </div>
              )
            })()
          ) : selectedBlock ? (
            <div>
              <button onClick={() => selectSection(-1)} style={backLink}>
                <UiIcon name="arrow-left" size={12} />
                Elements
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  aria-hidden
                  style={{ color: grey[50], display: "inline-flex", flexShrink: 0 }}
                >
                  {/* Facade-aware (Phase 1): a normalized wrapper reads as its
                      inner block — "Hero Slider", hero icon — while the fields
                      below stay the container's (layout / gap / columns). */}
                  <PaletteIcon type={displayTypeOf(selectedBlock)} size={18} />
                </span>
                <h3
                  style={{
                    ...type.title,
                    color: grey[90],
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {displayLabelOf(selectedBlock)}
                </h3>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <IconButton
                    icon="arrow-up"
                    label="Move up"
                    size={24}
                    iconSize={13}
                    onClick={() => moveSection(selected!, -1)}
                  />
                  <IconButton
                    icon="arrow-down"
                    label="Move down"
                    size={24}
                    iconSize={13}
                    onClick={() => moveSection(selected!, 1)}
                  />
                  <IconButton
                    icon="x"
                    label="Remove section"
                    danger
                    size={24}
                    iconSize={13}
                    onClick={() => removeSection(selected!)}
                  />
                </span>
              </div>
              {/* Copy / Paste / Reset style + presets (P6). Visual props only —
                  content is never transferred. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: hairline,
                }}
              >
                <button
                  onClick={copyStyle}
                  title="Copy this section's Style + Advanced settings"
                  style={styleActionBtn}
                >
                  <UiIcon name="copy" size={13} />
                  Copy style
                </button>
                <button
                  onClick={pasteStyle}
                  disabled={!clip.hasStyle}
                  title={
                    clip.hasStyle
                      ? "Paste copied Style + Advanced onto this section"
                      : "Copy a style first"
                  }
                  style={{
                    ...styleActionBtn,
                    opacity: clip.hasStyle ? 1 : 0.4,
                    cursor: clip.hasStyle ? "pointer" : "not-allowed",
                  }}
                >
                  <UiIcon name="paste" size={13} />
                  Paste style
                </button>
                <button
                  onClick={resetStyle}
                  title="Clear all Style + Advanced settings"
                  style={{
                    ...styleActionBtn,
                    color: semantic.dangerFg,
                    borderColor: semantic.dangerBorder,
                  }}
                >
                  <UiIcon name="reset" size={13} />
                  Reset style
                </button>
                <button
                  onClick={saveAsPreset}
                  title="Save this section's look as a reusable preset"
                  style={styleActionBtn}
                >
                  <UiIcon name="template" size={13} />
                  Save as preset
                </button>
                {(() => {
                  const applicable = presetsForType(
                    presets,
                    (selectedBlock as { block_type?: string } | null)
                      ?.block_type ?? null
                  )
                  if (applicable.length === 0) return null
                  return (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyPreset(e.target.value)
                      }}
                      title="Apply a saved preset"
                      style={presetSelect}
                    >
                      <option value="">Preset…</option>
                      {applicable.map((p) => (
                        <option key={p.id ?? p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )
                })()}
              </div>
              {(() => {
                // Facade (2C): a flush 1-col 1-commerce-widget wrapper leads
                // with the INNER block's form; container structure is behind
                // the quiet "Container settings" door inside the component.
                const facadeW = flushSingleCommerceWidget(selectedBlock)
                if (facadeW) {
                  const { schema_version } = selectedBlock as Record<
                    string,
                    unknown
                  >
                  return (
                    <FacadeSectionSettings
                      widget={facadeW}
                      container={selectedBlock}
                      onWidgetChange={(next) =>
                        writeWidget(selected!, [0, 0], {
                          ...(facadeW as any),
                          ...next,
                        })
                      }
                      onContainerChange={(next) =>
                        updateSelected({
                          block_type: "container",
                          ...(schema_version != null ? { schema_version } : {}),
                          ...reconcileContainerProps(next),
                        })
                      }
                      columns={(selectedBlock.columns as Column[]) ?? []}
                      onColumnsChange={setSelectedColumns}
                      onSelectWidget={(col, wi) =>
                        selectWidget(selected!, [col, wi])
                      }
                      styleBag={
                        (selectedBlock.style as Record<string, unknown>) ?? {}
                      }
                      advancedBag={
                        (selectedBlock.advanced as Record<string, unknown>) ??
                        {}
                      }
                      onStyleChange={(next) => updateSelectedBag("style", next)}
                      onAdvancedChange={(next) =>
                        updateSelectedBag("advanced", next)
                      }
                      device={device}
                      themeTokens={themeTokens}
                    />
                  )
                }
                const schema = getBlockSchema(selectedBlock.block_type)
                if (schema) {
                  const { block_type, schema_version, ...data } =
                    selectedBlock as Record<string, unknown>
                  const isContainer = selectedBlock.block_type === "container"
                  return (
                    <SchemaPanel
                      schema={schema}
                      nodeKind={isContainer ? "container" : "section"} /* 3D */
                      props={data}
                      onChange={(next) =>
                        updateSelected({
                          block_type: selectedBlock.block_type,
                          ...(schema_version != null ? { schema_version } : {}),
                          // Container: a layout change grows/shrinks `columns`
                          // in the same update, preserving widgets.
                          ...(isContainer
                            ? reconcileContainerProps(next)
                            : next),
                        })
                      }
                      contentExtra={
                        isContainer ? (
                          <ContainerColumnsEditor
                            columns={
                              (selectedBlock.columns as Column[]) ?? []
                            }
                            onChange={setSelectedColumns}
                            onSelectWidget={(col, wi) =>
                              selectWidget(selected!, [col, wi])
                            }
                            onSelectColumn={(c) =>
                              select({
                                kind: "column",
                                index: selected!,
                                colPath: [c],
                              })
                            }
                          />
                        ) : undefined
                      }
                      styleBag={
                        (selectedBlock.style as Record<string, unknown>) ?? {}
                      }
                      advancedBag={
                        (selectedBlock.advanced as Record<string, unknown>) ?? {}
                      }
                      onStyleChange={(next) => updateSelectedBag("style", next)}
                      onAdvancedChange={(next) =>
                        updateSelectedBag("advanced", next)
                      }
                      device={device}
                      themeTokens={themeTokens}
                    />
                  )
                }
                return (
                  <FieldEditor
                    data={selectedBlock as Record<string, unknown>}
                    onChange={updateSelected}
                  />
                )
              })()}
            </div>
          ) : null
            }
            navigator={
            <div>
              <p style={{ ...type.body, color: grey[50], marginTop: 0 }}>
                The whole page, outlined. Click anything to edit it; drag a
                section to reorder it.
              </p>
              <NavigatorTree
                content={content}
                selectedSection={selected}
                selectedWidget={selectedWidget}
                selectedColumn={selectedColumn}
                sectionLabel={(t) => BLOCK_LABELS[t] ?? t}
                onSelectSection={selectSection}
                onSelectWidget={selectWidget}
                onSelectColumn={(index, colPath) =>
                  select({ kind: "column", index, colPath })
                }
                dragOverIndex={dragOver}
                onSectionDragStart={(i) => () => {
                  dragIndexRef.current = i
                }}
                onSectionDragOver={(i) => (e) => {
                  e.preventDefault()
                  if (dragOver !== i) setDragOver(i)
                }}
                onSectionDrop={(i) => (e) => {
                  e.preventDefault()
                  if (dragIndexRef.current != null) {
                    moveSectionTo(dragIndexRef.current, i)
                  }
                  dragIndexRef.current = null
                  setDragOver(null)
                }}
                onSectionDragEnd={() => () => {
                  dragIndexRef.current = null
                  setDragOver(null)
                }}
              />

              <button
                onClick={() => {
                  setAddTargetIndex(null)
                  setDockTab("elements")
                }}
                style={{
                  ...button("ghost"),
                  width: "100%",
                  border: `1px dashed ${accent.tintStrong}`,
                  background: accent.tint,
                  color: accent.base,
                  marginTop: 8,
                }}
              >
                <UiIcon name="plus" size={14} />
                Add section
              </button>

              <div style={{ ...eyebrow(), margin: "16px 0 4px" }}>
                Site elements
              </div>
              {(["topbar", "header", "footer", "theme"] as const).map((k) => (
                <ChromeRow
                  key={k}
                  icon={k}
                  label={CHROME_SCHEMAS[k]?.label ?? k}
                  onClick={() => selectChrome(k)}
                />
              ))}
            </div>
            }
            page={
              <PagePane
                slug={slug}
                pages={pages}
                onGoToPage={goToPage}
                onNewPage={() => setNewPageOpen(true)}
                liveHref={slug === "home" ? "/" : "/" + slug}
              />
            }
            history={
              <HistoryPane
                slug={slug}
                locale={locale}
                editorKey={key}
                actions={{
                  done: exe.entries(),
                  undone: exe.redoEntries(),
                  onJump: (depth) => exe.jumpTo(depth),
                }}
                onRestored={(v) => {
                  setReloadNonce((n) => n + 1)
                  setStatus(
                    `Restored version ${v} — review it, then Publish to go live.`
                  )
                }}
              />
            }
          />
        )}
        {/* Panel footer — utilities strip (Elementor-style). */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: ink.base,
            borderTop: hairlineDark,
            flexShrink: 0,
          }}
        >
          {[
            { label: "Templates", icon: "template", onClick: () => setShowTemplates(true), title: "Template library" },
            { label: "History", icon: "clock", onClick: () => setDockTab("history"), title: "Version history" },
            { label: "Find  ⌘K", icon: "search", onClick: () => setShowPalette(true), title: "Search (Cmd/Ctrl+K)" },
            { label: "View live", icon: "external-link", onClick: () => window.open(livePath, "_blank"), title: "Open the published page in a new tab" },
          ].map((b) => (
            <button
              key={b.label}
              onClick={b.onClick}
              title={b.title}
              style={{
                ...deviceBtn,
                ...type.label,
                flex: 1,
                padding: "0 6px",
              }}
            >
              <UiIcon name={b.icon} size={13} />
              {b.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
    {/* --- 7A: the slide stage's full-screen chrome ------------------
        Fixed surfaces around the canvas iframe: top toolbar, optional
        slide filmstrip, bottom layer list, right LAYER OPTIONS sidebar.
        Every callback dispatches a slider.* command through the SAME 2A
        executor the panel uses — in-process, one command per gesture, so
        history / autosave / revisions need nothing new. The sidebar is the
        hoisted SchemaPanel: the product's real controls, re-housed. --- */}
    {staged && stageIndex != null ? (
      <StageChrome
        slides={stageSlides}
        activeSlide={stageActiveSlide}
        fieldsCount={stageFieldsCount}
        selectedLayerId={stageSelectedLayerId}
        device={device}
        locked={stageLocks}
        slidesOpen={stageSlidesOpen}
        onToggleSlides={() => setStageSlidesOpen((o) => !o)}
        /* Setting the shell's device resizes the iframe, and the canvas
           derives ITS device from its own viewport width — so the stage
           edits the frames of the device it is actually rendering. */
        onDevice={setDevice}
        onBack={() =>
          postToCanvas(iframeRef.current?.contentWindow, {
            type: "cms:stageExit",
          })
        }
        onSelectSlide={(slideId) =>
          select({ kind: "sliderSlide", index: stageIndex, slideId })
        }
        onAddSlide={() =>
          stageCmd("slider.addSlide", { slide: defaultSlide(newSliderId("sd")) })
        }
        onDuplicateSlide={(slideId) =>
          stageCmd("slider.duplicateSlide", {
            slideId,
            newId: newSliderId("sd"),
          })
        }
        onRemoveSlide={(slideId) => stageCmd("slider.removeSlide", { slideId })}
        onReorderSlides={(slideId, to) =>
          stageCmd("slider.reorderSlides", { slideId, to })
        }
        onSelectLayer={(layerId) =>
          stageActiveSlide &&
          select(
            layerId
              ? {
                  kind: "sliderLayer",
                  index: stageIndex,
                  slideId: stageActiveSlide.id,
                  layerId,
                }
              : {
                  kind: "sliderSlide",
                  index: stageIndex,
                  slideId: stageActiveSlide.id,
                }
          )
        }
        onAddLayer={(t: SliderLayerType) =>
          stageSlideCmd("slider.addLayer", {
            layer: defaultLayerOf(t, newSliderId("ly")),
          })
        }
        onReorderLayers={(layerId, to) =>
          stageSlideCmd("slider.reorderLayers", { layerId, to })
        }
        onToggleLayerHidden={(layerId) => {
          if (device === "desktop") return
          const l = stageActiveSlide?.layers.find((x) => x.id === layerId)
          if (!l) return
          stageSlideCmd("slider.setLayerProps", {
            layerId,
            hidden: { ...(l.hidden ?? {}), [device]: !l.hidden?.[device] },
          })
        }}
        /* Lock is session-only (never a command), and it has to reach the
           canvas — the shell owns the padlock, the canvas owns the drag. */
        onToggleLock={(layerId) =>
          setStageLocks((prev) => {
            const next = new Set(prev)
            if (next.has(layerId)) next.delete(layerId)
            else next.add(layerId)
            return next
          })
        }
        onRemoveLayer={(layerId) =>
          stageSlideCmd("slider.removeLayer", { layerId })
        }
        onDuplicateLayer={(layerId) =>
          stageSlideCmd("slider.duplicateLayer", {
            layerId,
            newId: newSliderId("ly"),
          })
        }
        onRenameLayer={(layerId, name) =>
          stageSlideCmd("slider.setLayerProps", { layerId, name })
        }
        sidebar={sliderPanelNode}
      />
    ) : null}
    {staleBuild ? (
      <div
        role="status"
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100001,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderRadius: radius.md,
          background: ink.base,
          color: ink.text,
          boxShadow: shadow.lg,
          fontFamily: font,
          ...type.label,
        }}
      >
        The editor was updated. Reload to get the latest version.
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ ...button("primary"), height: 26 }}
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setStaleBuild(false)}
          title="Dismiss"
          style={{
            ...iconButton("sm", true),
            width: 22,
            height: 22,
          }}
        >
          <UiIcon name="x" size={12} />
        </button>
      </div>
    ) : null}
    <NewPageModal
      open={newPageOpen}
      existing={pages.map((p) => p.slug)}
      onClose={() => setNewPageOpen(false)}
      onCreate={(ns) => {
        setNewPageOpen(false)
        goToPage(ns)
      }}
    />
    </LinkPagesProvider>
    </CatalogProvider>
  )
}

/* Panel list rows / ClipStrip / panel style constants / device-preview
 * constants: moved VERBATIM to @modules/cms/editor/shell/panel-bits (6C
 * composition root). SectionRow was already gone — NavigatorTree renders
 * the section rows itself. */
