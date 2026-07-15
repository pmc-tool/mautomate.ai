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
import { RevisionsPanel } from "../../../modules/cms/editor/RevisionsPanel"
import { CommandPalette } from "../../../modules/cms/editor/CommandPalette"
import { TemplateLibrary } from "../../../modules/cms/editor/TemplateLibrary"
import ElementsPalette from "../../../modules/cms/editor/ElementsPalette"
import { AiPanel } from "../../../modules/cms/editor/AiPanel"
import { useParams, useSearchParams } from "next/navigation"

import FieldEditor from "@modules/cms/editor/FieldEditor"
import SchemaPanel from "@modules/cms/editor/SchemaPanel"
import type { Tokens } from "@modules/cms/editor/style-controls"
import AddSectionPicker from "@modules/cms/editor/AddSectionPicker"
import ContainerColumnsEditor, {
  newWidgetOf,
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
import {
  getBlockSchema,
  getWidgetSchema,
  defaultPropsFromSchema,
} from "@modules/cms/schema"
import { CHROME_SCHEMAS, getChromeSchema } from "@modules/cms/schema/chrome"
import { resolveCustomTokens } from "@modules/cms/schema/chrome/theme"
import { getElementDefs, getChromeElementDefs } from "@modules/cms/render/element-registry"
import type { ElementStyles } from "@modules/cms/render/style-engine"
import {
  clipSummary,
  deepMergeBag,
  readClipboard,
  writeClip,
  type StyleClip,
} from "@modules/cms/editor/clipboard"

type Section = { block_type: string; [k: string]: unknown }

/**
 * WHAT is selected, as one value. The panel and canvas used to juggle five
 * mutually exclusive useStates, each cleared by hand at a dozen call sites —
 * miss one and two things are "selected" at once. Selection now changes only
 * through select() below, which derives all five from this.
 */
type Sel =
  | { kind: "section"; index: number }
  | { kind: "element"; index: number; key: string }
  | { kind: "widget"; index: number; path: number[] }
  | { kind: "chrome"; region: string }
  | { kind: "chromeElement"; region: string; key: string }
  | null

type StylePreset = {
  name: string
  style: Record<string, unknown>
  advanced: Record<string, unknown>
}

function getEditorKeyFromCookie(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|; )ff_editor_key=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ""
}

const LS_STYLE_PRESETS = "ff_style_presets"

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
  // Widget-level selection (Composer W1): a specific widget inside a container
  // section's column — content[index].columns[col].widgets[wi]. Mutually
  // exclusive with the other selections. Set from cms:clickedWidget.
  // A widget is addressed by its PATH — see widgetsAtPath. [col, wi] for a
  // top-level widget; [col, wi, col2, wi2] for one inside an inner section.
  const [selectedWidget, setSelectedWidget] = useState<{
    index: number
    path: number[]
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
  const [chromeDirty, setChromeDirty] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  // Where a newly added section is inserted (null = append to the end).
  const [addTargetIndex, setAddTargetIndex] = useState<number | null>(null)
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([])
  const [undoStack, setUndoStack] = useState<Section[][]>([])
  const [redoStack, setRedoStack] = useState<Section[][]>([])
  // What the shared clipboard currently holds (gates Paste buttons). The
  // payloads live in the clipboard module (localStorage-backed, shared with
  // the canvas context menu and the keyboard). Presets are a local
  // (no-backend) library keyed by name.
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
  const lastSnapRef = useRef(0)

  /* ------------------------------------------------------------------ *
   * THE single write path for page content.
   *
   * Every mutation used to read `content` from its own render closure and
   * call setContent + patchToCanvas itself. Two writes in the same tick then
   * clobbered each other — the second was built from a stale array. That is
   * how "Paste Style" on an element could erase the very style it had just
   * pasted. contentRef is updated synchronously here, so a mutator always
   * sees the result of the previous one, whichever render its closure came
   * from. Nothing else may write content.
   * ------------------------------------------------------------------ */
  const contentRef = useRef<Section[] | null>(null)

  /** Replace content outside the commit path (load / undo / redo). */
  const setContentSynced = (next: Section[] | null) => {
    contentRef.current = next
    setContent(next)
  }

  const commit = (
    updater: (cur: Section[]) => Section[] | null | undefined,
    opts: { patch?: number } = {}
  ) => {
    const cur = contentRef.current
    if (!cur) return
    const next = updater(cur)
    if (!next || next === cur) return
    // History: rapid edits (typing) within 700ms coalesce into one entry.
    const now = Date.now()
    if (now - lastSnapRef.current >= 700) {
      lastSnapRef.current = now
      setUndoStack((s) => [...s.slice(-49), cur])
      setRedoStack([])
    }
    contentRef.current = next
    setContent(next)
    setContentDirty(true)
    // Targeted patch (only that section re-renders in the canvas) when the
    // shape allows; full sync for structural changes (add/remove/reorder).
    if (opts.patch != null && next.length === cur.length && next[opts.patch]) {
      patchToCanvas(opts.patch, next[opts.patch])
    } else {
      pushToCanvas(next)
    }
  }

  const undo = () => {
    setUndoStack((u) => {
      const cur = contentRef.current
      if (!u.length || !cur) return u
      const prev = u[u.length - 1]
      setRedoStack((r) => [...r, cur])
      setContentSynced(prev)
      pushToCanvas(prev)
      select(null)
      setContentDirty(true)
      lastSnapRef.current = 0
      return u.slice(0, -1)
    })
  }

  const redo = () => {
    setRedoStack((r) => {
      const cur = contentRef.current
      if (!r.length || !cur) return r
      const next = r[r.length - 1]
      setUndoStack((u) => [...u, cur])
      setContentSynced(next)
      pushToCanvas(next)
      select(null)
      setContentDirty(true)
      lastSnapRef.current = 0
      return r.slice(0, -1)
    })
  }

  // Load the page list for the switcher.
  useEffect(() => {
    fetch(`/api/puck/pages?key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((d: any) => setPages(Array.isArray(d?.pages) ? d.pages : []))
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
  const moveToRef = useRef<(from: number, to: number) => void>(() => {})
  const insertContainerRef = useRef<(index: number, cols: number) => void>(() => {})
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
  const insertWidgetSectionRef = useRef<(index: number, widgetType: string) => void>(() => {})
  // Resolves a canvas link click to either "open that page" or "select the
  // clicked element" — assigned after the handlers below exist.
  const navRef = useRef<
    (href: string, index: number | null, chromeKey: string | null) => void
  >(() => {})
  // Latest palette-drop insert handlers (Composer W3), so the stable message
  // listener always calls the current closures — assigned after they exist.
  const insertRef = useRef<{
    section: (index: number, type: string, presetIndex?: number) => void
    widget: (
      index: number,
      colPath: number[],
      widgetType: string,
      wi?: number
    ) => void
  }>({ section: () => {}, widget: () => {} })
  // Index of the section-list row currently being dragged (for reorder).
  const dragIndexRef = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const readyRef = useRef(false)

  // Load the editable chrome (header/topbar/footer).
  useEffect(() => {
    fetch(`/api/puck/chrome?lang=${locale}&key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => {
        setBrandName(typeof d.brand_name === "string" ? d.brand_name : "")
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
  const [showRevisions, setShowRevisions] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [brandName, setBrandName] = useState("")
  useEffect(() => {
    let active = true
    setLoadError(false)
    fetch(`/api/puck/load?slug=${slug}&lang=${locale}&key=${encodeURIComponent(key)}`)
      .then(async (r) => {
        if (r.status === 401) {
          if (active) setDenied(true)
          return { ok: false as const, d: null }
        }
        if (!r.ok) {
          return { ok: false as const, d: null }
        }
        return { ok: true as const, d: await r.json().catch(() => null) }
      })
      .then((res) => {
        if (!active) return
        if (!res.ok || res.d === null) {
          // Only flag an error if we weren't denied (denied has its own screen).
          setLoadError(true)
          return
        }
        const items = (res.d?.data?.content ?? []) as {
          type: string
          props?: Record<string, unknown>
        }[]
        setContentSynced(
          items.map((c) => {
            const { id, ...rest } = c.props ?? {}
            return { block_type: c.type, ...rest }
          })
        )
        setContentDirty(false)
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
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      try {
        setAutosave((a) => ({ ...a, status: "saving" }))
        const data = {
          root: {},
          content: content.map((sec, i) => {
            const { block_type, ...rest } = sec
            return { type: block_type, props: { id: `${block_type}-${i}`, ...rest } }
          }),
        }
        const r = await fetch(`/api/puck/autosave?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, locale, data }),
        })
        setAutosave({ status: r.ok ? "saved" : "error", at: Date.now() })
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
    iframeRef.current?.contentWindow?.postMessage({ type: "cms:data", content: next }, "*")
  }, [])

  // Targeted patch — a single section edited. Only that section re-renders in
  // the canvas (the rest, incl. the autoplaying hero, are untouched).
  const patchToCanvas = useCallback((index: number, section: Section) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "cms:patch", index, section }, "*")
  }, [])

  /**
   * THE single way selection changes. Derives all five legacy selection
   * states (mutually exclusive by construction) and, unless the change came
   * FROM the canvas (mirror: false — it already knows), tells the canvas to
   * outline + scroll to the newly selected thing.
   */
  const select = (sel: Sel, opts: { mirror?: boolean } = {}) => {
    setSelected(sel?.kind === "section" ? sel.index : null)
    setSelectedElement(
      sel?.kind === "element" ? { index: sel.index, key: sel.key } : null
    )
    setSelectedWidget(
      sel?.kind === "widget" ? { index: sel.index, path: sel.path } : null
    )
    setSelectedChrome(sel?.kind === "chrome" ? sel.region : null)
    setSelectedChromeElement(
      sel?.kind === "chromeElement"
        ? { region: sel.region, key: sel.key }
        : null
    )
    if (opts.mirror === false) return
    const post = (msg: Record<string, unknown>) =>
      iframeRef.current?.contentWindow?.postMessage(msg, "*")
    if (!sel) post({ type: "cms:select", index: null })
    else if (sel.kind === "section") post({ type: "cms:select", index: sel.index })
    else if (sel.kind === "element")
      post({ type: "cms:selectElement", index: sel.index, elementKey: sel.key })
    else if (sel.kind === "widget")
      post({ type: "cms:selectWidget", index: sel.index, path: sel.path })
    else if (sel.kind === "chrome") post({ type: "cms:selectChrome", key: sel.region })
    else if (sel.kind === "chromeElement")
      post({
        type: "cms:selectChromeElement",
        region: sel.region,
        elementKey: sel.key,
      })
  }

  // Messages from the canvas iframe.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m !== "object") return
      if (m.type === "cms:ready") {
        readyRef.current = true
        if (contentRef.current) pushToCanvas(contentRef.current)
        // A reloaded canvas has no idea what is on the clipboard.
        announceClipboard()
      }
      // Keyboard shortcut forwarded from the canvas (focus was in the iframe).
      if (m.type === "cms:key" && typeof m.action === "string") {
        keyActRef.current(m.action as any)
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

          const size = { value: px, unit: "px" }
          const prevT = bag.typography as any

          if (prevT && typeof prevT === "object" && "base" in prevT) {
            // Already responsive: write only the device being edited.
            const leafKey = device === "desktop" ? "base" : device
            const leaf = { ...((prevT as any)[leafKey] ?? prevT.base ?? {}) }
            leaf.fontSize = size
            bag.typography = { ...prevT, [leafKey]: leaf }
          } else if (device === "desktop") {
            bag.typography = { ...(prevT ?? {}), fontSize: size }
          } else {
            // First per-device override: promote to a responsive value so the
            // desktop size is preserved rather than silently overwritten.
            bag.typography = {
              base: { ...(prevT ?? {}) },
              [device]: { ...(prevT ?? {}), fontSize: size },
            }
          }

          // Make sure the panel is showing the element we are resizing (the
          // canvas already has it selected — no mirror needed).
          select({ kind: "element", index: idx, key: elKey }, { mirror: false })
          writeElementBags(idx, elKey, { style: bag })
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
      // Palette drop (Composer W3): the canvas computed a drop position for a
      // dragged section card — insert the block there directly (no picker).
      if (
        m.type === "cms:insertAt" &&
        typeof m.index === "number" &&
        typeof m.block_type === "string" &&
        m.block_type
      ) {
        insertRef.current.section(
          m.index,
          m.block_type,
          typeof m.presetIndex === "number" ? m.presetIndex : undefined
        )
      }
      // Grip drag-reorder from the canvas: move a section from -> to.
      if (
        m.type === "cms:moveSection" &&
        typeof m.from === "number" &&
        typeof m.to === "number"
      ) {
        moveToRef.current(m.from, m.to)
      }
      // Structure picker: insert an N-column container at the given index.
      if (
        m.type === "cms:insertContainerAt" &&
        typeof m.index === "number" &&
        typeof m.cols === "number"
      ) {
        insertContainerRef.current(m.index, m.cols)
      }
      // Widget dropped on open ground -> auto-wrap in a 1-column container.
      if (
        m.type === "cms:insertWidgetAsSection" &&
        typeof m.index === "number" &&
        typeof m.widget_type === "string" &&
        m.widget_type
      ) {
        insertWidgetSectionRef.current(m.index, m.widget_type)
      }
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
      // Palette drop (Composer W3): a widget card dropped on a container
      // column — append a fresh widget to content[index].columns[col].
      if (
        m.type === "cms:insertWidgetAt" &&
        typeof m.index === "number" &&
        Array.isArray(m.colPath) &&
        typeof m.widget_type === "string" &&
        m.widget_type
      ) {
        insertRef.current.widget(
          m.index,
          m.colPath as number[],
          m.widget_type,
          typeof m.wi === "number" ? m.wi : undefined
        )
      }
      // Undo/redo forwarded from the canvas iframe (keyboard focus inside it).
      if (m.type === "cms:undo") histRef.current.undo()
      if (m.type === "cms:redo") histRef.current.redo()
      // A link clicked in the canvas → open that page or select its container.
      if (m.type === "cms:linkClick" && typeof m.href === "string") {
        navRef.current(m.href, m.index ?? null, m.chromeKey ?? null)
      }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [content, pushToCanvas])

  const selectChrome = (k: string) => select({ kind: "chrome", region: k })

  /**
   * The single write path for chrome (header/topbar/footer/theme) — same
   * stale-closure discipline as commit(): chromeRef is updated synchronously
   * so sequential writes in one tick compose instead of clobbering.
   */
  const chromeRef = useRef<Record<string, Record<string, unknown>>>({})

  const updateChrome = (k: string, data: Record<string, unknown>) => {
    chromeRef.current = { ...chromeRef.current, [k]: data }
    setChrome(chromeRef.current)
    setChromeDirty((d) => new Set(d).add(k))
    iframeRef.current?.contentWindow?.postMessage({ type: "cms:chrome", key: k, data }, "*")
  }

  // Style/Advanced for a chrome region (F1): merge a namespaced diff bag onto
  // chrome[region].style / .advanced. Same diff-only storage as sections — an
  // empty bag deletes the key so an un-styled region stays byte-identical to
  // today. Routes through updateChrome so it flows into the existing cms:chrome
  // patch + chromeDirty + publish(/api/puck/chrome) pipeline unchanged.
  const updateChromeBag = (
    region: string,
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    const prev = (chromeRef.current[region] ?? {}) as Record<string, unknown>
    const updated: Record<string, unknown> = { ...prev }
    if (next && Object.keys(next).length > 0) {
      updated[bagKey] = next
    } else {
      delete updated[bagKey]
    }
    updateChrome(region, updated)
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
    updateChrome(region, updated)
    setStatus(action === "resetStyle" ? "Style reset." : "Style pasted.")
  }

  /** Write BOTH bags of a chrome element in ONE update (two sequential
   *  single-bag writes would clobber each other). undefined leaves a bag
   *  untouched; an empty bag deletes it. */
  const writeChromeElementBags = (
    region: string,
    key: string,
    bags: {
      style?: Record<string, unknown>
      advanced?: Record<string, unknown>
    }
  ) => {
    const prev = (chromeRef.current[region] ?? {}) as Record<string, unknown>
    const prevEs = (prev.elementStyles as ElementStyles | undefined) ?? {}
    const entry: Record<string, unknown> = { ...(prevEs[key] ?? {}) }
    for (const k of ["style", "advanced"] as const) {
      const v = bags[k]
      if (v === undefined) continue
      if (v && Object.keys(v).length > 0) entry[k] = v
      else delete entry[k]
    }
    const nextEs: ElementStyles = { ...prevEs }
    if (Object.keys(entry).length > 0) nextEs[key] = entry
    else delete nextEs[key]
    const updated: Record<string, unknown> = { ...prev }
    if (Object.keys(nextEs).length > 0) updated.elementStyles = nextEs
    else delete updated.elementStyles
    updateChrome(region, updated)
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
      writeChromeElementBags(region, key, { style: {}, advanced: {} })
      setStatus("Style reset.")
      return
    }
    const c = readClipboard().style
    if (!c) return
    writeChromeElementBags(region, key, {
      style: deepMergeBag(
        (entry.style as Record<string, unknown>) ?? {},
        c.style ?? {}
      ),
      advanced: deepMergeBag(
        (entry.advanced as Record<string, unknown>) ?? {},
        c.advanced ?? {}
      ),
    })
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
    commit(
      (cur) => cur.map((b, i) => (i === index ? (nextData as Section) : b)),
      { patch: index }
    )

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
    }
  ) =>
    commit(
      (cur) => {
        const sec = cur[idx]
        if (!sec) return cur
        const updated: Record<string, unknown> = { ...(sec as any) }
        for (const k of ["style", "advanced", "elementStyles"] as const) {
          const v = bags[k]
          if (v === undefined) continue
          if (v && Object.keys(v).length > 0) updated[k] = v
          else delete updated[k]
        }
        return cur.map((b, i) => (i === idx ? (updated as Section) : b))
      },
      { patch: idx }
    )

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
    }
  ) =>
    commit(
      (cur) => {
        const section = cur[idx]
        if (!section) return cur
        const prevEs = (section.elementStyles as ElementStyles | undefined) ?? {}
        const entry: Record<string, unknown> = { ...(prevEs[key] ?? {}) }
        for (const k of ["style", "advanced"] as const) {
          const v = bags[k]
          if (v === undefined) continue
          if (v && Object.keys(v).length > 0) entry[k] = v
          else delete entry[k]
        }
        const nextEs: ElementStyles = { ...prevEs }
        if (Object.keys(entry).length > 0) nextEs[key] = entry
        else delete nextEs[key]
        const updated: Record<string, unknown> = { ...(section as any) }
        if (Object.keys(nextEs).length > 0) updated.elementStyles = nextEs
        else delete updated.elementStyles
        return cur.map((b, i) => (i === idx ? (updated as Section) : b))
      },
      { patch: idx }
    )

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
  const writeWidget = (
    index: number,
    path: number[],
    nextWidget: Widget
  ) => {
    const colPath = path.slice(0, -1)
    const wi = path[path.length - 1]
    const ws = widgetsAtPath(index, colPath)
    if (!ws || !ws[wi]) return
    writeWidgetsAtPath(
      index,
      colPath,
      ws.map((w: any, i: number) => (i === wi ? nextWidget : w))
    )
  }

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
    }
  ) => {
    const ws = widgetsAtPath(index, path.slice(0, -1))
    const widget = ws?.[path[path.length - 1]]
    if (!widget) return
    const updated: Widget = { ...widget }
    for (const k of ["style", "advanced"] as const) {
      const v = bags[k]
      if (v === undefined) continue
      if (v && Object.keys(v).length > 0) (updated as any)[k] = v
      else delete (updated as any)[k]
    }
    writeWidget(index, path, updated)
  }

  const updateSelectedWidgetBag = (
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selectedWidget == null) return
    writeWidgetBags(selectedWidget.index, selectedWidget.path, { [bagKey]: next })
  }

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
    commit((c) => {
      const next = [...c]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
    // Section indices shifted — keep the moved section selected.
    if (selected === from) select({ kind: "section", index: to })
    else if (selectedWidget || selectedElement) select(null)
  }

  // Reorder by dropping a dragged section-list row onto another position.
  const moveSectionTo = (from: number, to: number) => {
    const cur = contentRef.current
    if (!cur || from === to || to < 0 || to >= cur.length) return
    commit((c) => {
      const next = [...c]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
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
    const schema = getBlockSchema(type)
    if (!schema) return
    const props =
      presetIndex != null && schema.presets?.[presetIndex]
        ? structuredClone(schema.presets[presetIndex].props)
        : defaultPropsFromSchema(schema)
    const block = { block_type: type, ...props } as Section
    const at = Math.max(0, Math.min(index, cur.length))
    commit((c) => [...c.slice(0, at), block, ...c.slice(at)])
    setAdding(false)
    setAddTargetIndex(null)
    select({ kind: "section", index: at })
  }

  // Structure picker (canvas add-section zone): insert a container with N
  // empty columns at `index`, then select it (Elementor select-your-structure).
  const insertContainerAt = (index: number, colsN: number) => {
    const cur = contentRef.current
    if (!cur) return
    const schema = getBlockSchema("container")
    if (!schema) return
    const n = Math.max(1, Math.min(4, colsN))
    const props = {
      ...defaultPropsFromSchema(schema),
      layout: String(n),
      columns: Array.from({ length: n }, () => ({ widgets: [] })),
    }
    const block = { block_type: "container", ...props } as Section
    const at = Math.max(0, Math.min(index, cur.length))
    commit((c) => [...c.slice(0, at), block, ...c.slice(at)])
    select({ kind: "section", index: at })
  }

  // A widget dropped outside any container: auto-wrap it in a new 1-column
  // container at `index` (Elementor drop-anywhere), then select the widget.
  const insertWidgetAsSection = (index: number, widgetType: string) => {
    const cur = contentRef.current
    if (!cur || !getWidgetSchema(widgetType)) return
    const schema = getBlockSchema("container")
    if (!schema) return
    const widget = newWidgetOf(widgetType)
    const props = {
      ...defaultPropsFromSchema(schema),
      layout: "1",
      columns: [{ widgets: [widget] }],
    }
    const block = { block_type: "container", ...props } as Section
    const at = Math.max(0, Math.min(index, cur.length))
    commit((c) => [...c.slice(0, at), block, ...c.slice(at)])
    selectWidget(at, [0, 0])
  }

  // Apply server-validated AI patches through the normal undo pipeline (P1).
  const applyAiPatches = (patches: any[]): number => {
    const cur = contentRef.current
    if (!cur || !Array.isArray(patches) || patches.length === 0) return 0
    const next = [...cur]
    let applied = 0
    for (const p of patches) {
      if (
        p?.op === "replace_props" &&
        typeof p.index === "number" &&
        next[p.index] &&
        p.props &&
        typeof p.props === "object"
      ) {
        const { block_type, ...rest } = next[p.index] as any
        const { block_type: _bt, ...safe } = p.props
        next[p.index] = { block_type, ...rest, ...safe } as Section
        applied++
      } else if (
        p?.op === "insert_section" &&
        typeof p.at === "number" &&
        typeof p.block_type === "string"
      ) {
        const schema = getBlockSchema(p.block_type)
        if (!schema) continue
        const at = Math.max(0, Math.min(p.at, next.length))
        next.splice(at, 0, {
          block_type: p.block_type,
          ...defaultPropsFromSchema(schema),
          ...(p.props ?? {}),
        } as Section)
        applied++
      } else if (p?.op === "remove_section" && typeof p.index === "number" && next[p.index]) {
        next.splice(p.index, 1)
        applied++
      } else if (
        p?.op === "move_section" &&
        typeof p.from === "number" &&
        typeof p.to === "number" &&
        next[p.from]
      ) {
        const [m] = next.splice(p.from, 1)
        next.splice(Math.max(0, Math.min(p.to, next.length)), 0, m)
        applied++
      }
    }
    if (!applied) return 0
    commit(() => next)
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

  // Palette widget drop (Composer W3): append a fresh widget (schema defaults)
  // to content[index].columns[col].widgets, snapshot for undo, stream the
  // section to the canvas, and select the new widget for editing.
  const insertWidgetAt = (
    index: number,
    colPath: number[],
    widgetType: string,
    wi?: number
  ) => {
    if (!contentRef.current || !getWidgetSchema(widgetType)) return
    // One level of nesting: an inner section may not be dropped into another.
    if (widgetType === "inner_section" && colPath.length > 1) {
      setStatus("An inner section can't go inside another inner section.")
      return
    }
    const existing = widgetsAtPath(index, colPath)
    if (!existing) return
    const widget = newWidgetOf(widgetType)
    // Positional drop (Elementor): splice at the insertion index, else append.
    const at =
      wi == null ? existing.length : Math.max(0, Math.min(wi, existing.length))
    writeWidgetsAtPath(index, colPath, [
      ...existing.slice(0, at),
      widget,
      ...existing.slice(at),
    ])
    selectWidget(index, [...colPath, at])
  }

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
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cms:clipboard", ...clipSummary() },
      "*"
    )
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
    commit((c) => [
      ...c.slice(0, at),
      structuredClone(clipSection) as Section,
      ...c.slice(at),
    ])
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
    writeSectionBags(i, { style, advanced, elementStyles })
    setStatus("Style pasted.")
  }

  const resetSectionStyle = (i: number) => {
    const cur = contentRef.current
    if (!cur || i < 0 || i >= cur.length) return
    writeSectionBags(i, { style: {}, advanced: {}, elementStyles: {} })
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

  /** The widgets array living at a column path, or null. */
  const widgetsAtPath = (index: number, colPath: number[]): any[] | null => {
    const sec: any = contentRef.current?.[index]
    if (!sec || !Array.isArray(colPath) || colPath.length % 2 !== 1) return null
    let cols: any = sec.columns
    for (let i = 0; i < colPath.length; i++) {
      if (!Array.isArray(cols)) return null
      const col = cols[colPath[i]]
      if (!col) return null
      const ws = Array.isArray(col.widgets) ? col.widgets : []
      if (i === colPath.length - 1) return ws
      // Descend through the inner-section widget named by the next index.
      const w = ws[colPath[++i]]
      if (!w || w.widget_type !== "inner_section") return null
      cols = w.columns
    }
    return null
  }

  /** Immutably write a widgets array back to a column path. */
  const writeWidgetsAtPath = (
    index: number,
    colPath: number[],
    widgets: any[]
  ) =>
    commit(
      (c) => {
        const sec: any = c[index]
        if (!sec || !Array.isArray(sec.columns)) return c

        // Rebuild the chain from the leaf up: replace `widgets` at the target
        // column, then rewrap each ancestor inner section on the way out.
        const rebuild = (cols: any[], depth: number): any[] | null => {
          const ci = colPath[depth]
          if (!Array.isArray(cols) || !cols[ci]) return null
          if (depth === colPath.length - 1) {
            return cols.map((cl: any, i: number) =>
              i === ci ? { ...cl, widgets } : cl
            )
          }
          const wi = colPath[depth + 1]
          const col = cols[ci]
          const ws = Array.isArray(col.widgets) ? col.widgets : []
          const inner = ws[wi]
          if (!inner || inner.widget_type !== "inner_section") return null
          const innerCols = rebuild(inner.columns ?? [], depth + 2)
          if (!innerCols) return null
          return cols.map((cl: any, i: number) =>
            i === ci
              ? {
                  ...cl,
                  widgets: ws.map((w: any, j: number) =>
                    j === wi ? { ...inner, columns: innerCols } : w
                  ),
                }
              : cl
          )
        }

        const nextCols = rebuild(sec.columns as any[], 0)
        if (!nextCols) return c
        return c.map((b, i) =>
          i === index ? ({ ...sec, columns: nextCols } as Section) : b
        )
      },
      { patch: index }
    )

  const colPathOf = (path: number[]) => path.slice(0, -1)
  const wiOf = (path: number[]) => path[path.length - 1]

  const duplicateWidget = (index: number, path: number[]) => {
    const colPath = colPathOf(path)
    const wi = wiOf(path)
    const ws = widgetsAtPath(index, colPath)
    if (!ws || !ws[wi]) return
    const next = [
      ...ws.slice(0, wi + 1),
      structuredClone(ws[wi]),
      ...ws.slice(wi + 1),
    ]
    writeWidgetsAtPath(index, colPath, next)
    select({ kind: "widget", index, path: [...colPath, wi + 1] })
    setStatus("Widget duplicated.")
  }

  const removeWidget = (index: number, path: number[]) => {
    const colPath = colPathOf(path)
    const wi = wiOf(path)
    const ws = widgetsAtPath(index, colPath)
    if (!ws || !ws[wi]) return
    writeWidgetsAtPath(index, colPath, ws.filter((_, i) => i !== wi))
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
    const ws = widgetsAtPath(index, colPath)
    if (!clipWidget || !ws) return
    // One level of nesting: an inner section may not be pasted inside another.
    if (clipWidget.widget_type === "inner_section" && colPath.length > 1) {
      setStatus("An inner section can't go inside another inner section.")
      return
    }
    const next = [
      ...ws.slice(0, wi + 1),
      structuredClone(clipWidget),
      ...ws.slice(wi + 1),
    ]
    writeWidgetsAtPath(index, colPath, next)
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
      writeWidgetBags(index, path, { style: {}, advanced: {} })
      setStatus("Style reset.")
      return
    }

    const c = readClipboard().style
    if (!c) return
    writeWidgetBags(index, path, {
      style: deepMergeBag(
        (w.style as Record<string, unknown>) ?? {},
        c.style ?? {}
      ),
      advanced: deepMergeBag(
        (w.advanced as Record<string, unknown>) ?? {},
        c.advanced ?? {}
      ),
    })
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
      writeElementBags(index, key, { style: {}, advanced: {} })
      setStatus("Style reset.")
      return
    }

    const c = readClipboard().style
    if (!c) return
    writeElementBags(index, key, {
      style: deepMergeBag(
        (entry.style as Record<string, unknown>) ?? {},
        c.style ?? {}
      ),
      advanced: deepMergeBag(
        (entry.advanced as Record<string, unknown>) ?? {},
        c.advanced ?? {}
      ),
    })
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
    const arr = sec?.[field]
    if (!Array.isArray(arr) || itemIndex < 0 || itemIndex >= arr.length) return
    if (a === "deleteItem" && arr.length <= 1) {
      setStatus(
        "That is the last item — if you don't want this section, delete the section itself."
      )
      return
    }
    commit(
      (cur) => {
        const s: any = cur[index]
        const list = s?.[field]
        if (!Array.isArray(list) || !list[itemIndex]) return cur
        const next =
          a === "duplicateItem"
            ? [
                ...list.slice(0, itemIndex + 1),
                structuredClone(list[itemIndex]),
                ...list.slice(itemIndex + 1),
              ]
            : list.filter((_: unknown, j: number) => j !== itemIndex)
        return cur.map((b, j) =>
          j === index ? ({ ...s, [field]: next } as Section) : b
        )
      },
      { patch: index }
    )
    setStatus(a === "duplicateItem" ? "Item duplicated." : "Item deleted.")
  }

  const duplicateSection = (i: number) => {
    const cur = contentRef.current
    if (!cur || i < 0 || i >= cur.length) return
    const clone = structuredClone(cur[i])
    commit((c) => [...c.slice(0, i + 1), clone, ...c.slice(i + 1)])
    select({ kind: "section", index: i + 1 })
  }

  const openAddAt = (index: number | null) => {
    setAddTargetIndex(index)
    setAdding(true)
    select(null, { mirror: false })
  }

  const removeSection = (i: number) => {
    commit((c) => c.filter((_, idx) => idx !== i))
    select(null)
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
      try {
        const cr = await fetch(`/api/puck/chrome?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: k, data: chrome[k] }),
        })
        ;(cr.ok ? saved : failed).push(k)
      } catch {
        failed.push(k)
      }
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
    const data = {
      root: {},
      content: content.map((s, i) => {
        const { block_type, ...rest } = s
        return { type: block_type, props: { id: `${block_type}-${i}`, ...rest } }
      }),
    }
    try {
      const r = await fetch(`/api/puck/publish?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, locale, data }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
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
            : `Publish failed: ${body?.message || r.status}`
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
    let path = String(href || "").split("?")[0].split("#")[0]
    if (!path) {
      selectContainer()
      return
    }
    try {
      if (/^https?:\/\//.test(path)) path = new URL(path).pathname
    } catch {
      // keep raw path
    }
    // Resolve the slug against the known page list so a 3-letter page slug
    // (e.g. "faq") is never mistaken for a country-code prefix.
    const known = new Set(["home", ...pages.map((p) => p.slug)])
    const segs = path.split("/").filter((s) => s && s !== "undefined")
    const withoutCc =
      segs.length > 1 && /^[a-z]{2,3}$/.test(segs[0])
        ? segs.slice(1).join("/")
        : null
    const full = segs.join("/")
    let slug: string
    if (!segs.length) slug = "home"
    else if (known.has(full)) slug = full
    else if (withoutCc && known.has(withoutCc)) slug = withoutCc
    else if (segs.length === 1 && /^[a-z]{2,3}$/.test(segs[0])) slug = "home"
    else slug = withoutCc ?? full
    const isCmsPage = slug === "home" || pages.some((p) => p.slug === slug)
    if (isCmsPage) {
      goToPage(slug)
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
  moveToRef.current = moveSectionTo
  insertContainerRef.current = insertContainerAt
  insertWidgetSectionRef.current = insertWidgetAsSection
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
  insertRef.current = { section: insertSectionAt, widget: insertWidgetAt }

  const selectedBlock = useMemo(
    () => (content && selected != null ? content[selected] : null),
    [content, selected]
  )

  // Hydrate the preset library from localStorage once (the clipboard module
  // hydrates itself). Announce the (possibly persisted) clipboard so the Paste
  // buttons wake up correctly.
  useEffect(() => {
    syncClip()
    try {
      const raw = window.localStorage.getItem(LS_STYLE_PRESETS)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setPresets(
            parsed
              .filter((p) => p && typeof p.name === "string")
              .map((p) => ({
                name: p.name,
                style: p.style ?? {},
                advanced: p.advanced ?? {},
              }))
          )
        }
      }
    } catch {
      // ignore malformed preset store
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
  const saveAsPreset = () => {
    if (!selectedBlock) return
    const name = window.prompt("Save style preset as:")?.trim()
    if (!name) return
    const entry: StylePreset = {
      name,
      style: (selectedBlock.style as Record<string, unknown>) ?? {},
      advanced: (selectedBlock.advanced as Record<string, unknown>) ?? {},
    }
    setPresets((p) => {
      const next = [...p.filter((x) => x.name !== name), entry]
      try {
        window.localStorage.setItem(LS_STYLE_PRESETS, JSON.stringify(next))
      } catch {
        // ignore quota/unavailable — in-memory list still updates
      }
      return next
    })
    setStatus(`Saved preset "${name}".`)
  }

  // Apply a saved preset to the selected section (merge, like paste).
  const applyPreset = (name: string) => {
    const preset = presets.find((p) => p.name === name)
    if (!preset || selected == null || !selectedBlock) return
    const curStyle = (selectedBlock.style as Record<string, unknown>) ?? {}
    const curAdv = (selectedBlock.advanced as Record<string, unknown>) ?? {}
    writeSectionBags(selected, {
      style: deepMergeBag(curStyle, preset.style ?? {}),
      advanced: deepMergeBag(curAdv, preset.advanced ?? {}),
    })
  }

  // Global theme tokens (colors + fonts) surfaced to linkable color/font
  // controls in the Style/Advanced tabs (P5 — link-to-global-token). Sourced
  // from the editable chrome.theme; fallbacks mirror the storefront's
  // buildThemeVars defaults so a swatch/label always resolves to something. A
  // linked value stores `{ ref: <id> }`; the style engine maps it to the live
  // CSS var (--ff-<id> / --ff-font-<id>), so editing the theme cascades here.
  const themeTokens = useMemo<Tokens>(() => {
    const theme = (chrome.theme ?? {}) as {
      colors?: Record<string, string>
      fonts?: Record<string, string>
      custom_colors?: unknown
      custom_fonts?: unknown
    }
    const c = theme.colors ?? {}
    const f = theme.fonts ?? {}
    // Owner-defined custom tokens (F2a) — refs are "c-<slug>", resolving to
    // the prefixed vars --ff-c-<slug> / --ff-font-c-<slug>.
    const customColors = resolveCustomTokens(theme.custom_colors).map((t) => ({
      id: `c-${t.slug}`,
      name: t.name,
      value: t.value,
    }))
    const customFonts = resolveCustomTokens(theme.custom_fonts).map((t) => ({
      id: `c-${t.slug}`,
      name: t.name,
      value: t.value,
    }))
    return {
      colors: [
        { id: "primary", name: "Primary", value: c.primary ?? "#72a499" },
        { id: "heading", name: "Heading", value: c.heading ?? "#1f1f1f" },
        { id: "text", name: "Text", value: c.text ?? "#333" },
        { id: "dark", name: "Dark", value: c.dark ?? "#1f1f1f" },
        { id: "border", name: "Border", value: c.border ?? "#e5e5e5" },
        { id: "bg", name: "Background", value: c.bg ?? "#fff" },
        ...customColors,
      ],
      fonts: [
        { id: "body", name: "Body", value: f.body ?? "Jost, sans-serif" },
        { id: "heading", name: "Heading", value: f.heading ?? "Marcellus, serif" },
        ...customFonts,
      ],
    }
  }, [chrome.theme])

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

  return (
    <CatalogProvider editorKey={key}>
    <div style={{ display: "flex", height: "100vh", fontFamily: font }}>
      {/* Canvas */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: grey[10],
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Device / responsive toggle */}
        <div
          style={{
            display: "flex",
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
          {/* Device toggle — one segmented control with device glyphs */}
          <div
            role="group"
            aria-label="Preview device"
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
                iframeRef.current?.contentWindow?.postMessage(
                  { type: "cms:previewMode", on: false },
                  "*"
                )
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
        {device !== "desktop" && (
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
            padding: device === "desktop" ? 0 : 16,
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
      {!panelCollapsed && (
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
      <aside
        style={{
          order: -2,
          width: panelCollapsed ? 0 : panelWidth,
          flexShrink: 0,
          borderRight: panelCollapsed ? "none" : hairline,
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
                  const ns = window.prompt("New page slug (e.g. about):")
                  if (ns) goToPage(ns)
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
              disabled={!undoStack.length}
              size={28}
            />
            <IconButton
              dark
              icon="redo"
              label="Redo"
              onClick={redo}
              disabled={!redoStack.length}
              size={28}
            />
            <button
              onClick={() => {
                const on = !previewMode
                setPreviewMode(on)
                setPanelCollapsed(on)
                iframeRef.current?.contentWindow?.postMessage(
                  { type: "cms:previewMode", on },
                  "*"
                )
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
            {showRevisions && (
              <RevisionsPanel
                slug={slug}
                locale={locale}
                editorKey={key}
                onClose={() => setShowRevisions(false)}
                onRestored={(v) => {
                  setReloadNonce((n) => n + 1)
                  setStatus(`Restored version ${v} — review it, then Publish to go live.`)
                }}
              />
            )}
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
                { id: "history", label: "Version history", category: "Actions", keywords: "revisions restore rollback", run: () => setShowRevisions(true) },
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
                onClose={() => {
                  setShowTemplates(false)
                  setTemplateAt(null)
                }}
                onInsert={(blocks) => {
                  const cur = contentRef.current
                  if (!cur || !Array.isArray(blocks) || blocks.length === 0) return

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

                  commit((c) => [
                    ...c.slice(0, at),
                    ...(blocks as Section[]),
                    ...c.slice(at),
                  ])
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
                <span style={{ whiteSpace: "pre-line" }}>{status}</span>
              </div>
            )
          })()}

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {loadError ? (
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
          ) : !content ? (
            <p style={{ ...type.body, color: grey[50] }}>Loading…</p>
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
                  blockLabel={trail}
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
              const blockType = section.block_type
              const def = getElementDefs(blockType).find(
                (d) => d.key === selectedElement.key
              )
              const es =
                (section.elementStyles as ElementStyles | undefined) ?? {}
              const entry = es[selectedElement.key] ?? {}
              const elSchema = getBlockSchema(blockType)
              const { block_type: _bt, schema_version: _sv, ...elData } =
                section as Record<string, unknown>
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
                    updateSectionAt(selectedElement.index, {
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
                    {...(stylable
                      ? {
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
                  <PaletteIcon type={selectedBlock.block_type} size={18} />
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
                  {BLOCK_LABELS[selectedBlock.block_type] ?? selectedBlock.block_type}
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
                {presets.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) applyPreset(e.target.value)
                    }}
                    title="Apply a saved preset"
                    style={presetSelect}
                  >
                    <option value="">Preset…</option>
                    {presets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {(() => {
                const schema = getBlockSchema(selectedBlock.block_type)
                if (schema) {
                  const { block_type, schema_version, ...data } =
                    selectedBlock as Record<string, unknown>
                  const isContainer = selectedBlock.block_type === "container"
                  return (
                    <SchemaPanel
                      schema={schema}
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
          ) : adding ? (
            <AddSectionPicker
              usedTypes={content.map((b) => b.block_type)}
              onAdd={addSection}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <ElementsPalette
              usedTypes={content.map((b) => b.block_type)}
              onAdd={addSection}
              navigator={
            <div>
              <p style={{ ...type.body, color: grey[50], marginTop: 0 }}>
                Drag to reorder sections. Click one to edit it.
              </p>
              {content.map((b, i) => (
                <SectionRow
                  key={i}
                  index={i}
                  blockType={b.block_type}
                  label={BLOCK_LABELS[b.block_type] ?? b.block_type}
                  isDragOver={dragOver === i}
                  onDragStart={() => {
                    dragIndexRef.current = i
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOver !== i) setDragOver(i)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndexRef.current != null) {
                      moveSectionTo(dragIndexRef.current, i)
                    }
                    dragIndexRef.current = null
                    setDragOver(null)
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null
                    setDragOver(null)
                  }}
                  onClick={() => selectSection(i)}
                />
              ))}

              <button
                onClick={() => setAdding(true)}
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
            />
          )}
        </div>
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
            { label: "History", icon: "clock", onClick: () => setShowRevisions(true), title: "Version history" },
            { label: "Find  ⌘K", icon: "search", onClick: () => setShowPalette(true), title: "Search (Cmd/Ctrl+K)" },
            { label: "View live", icon: "external-link", onClick: () => window.open(slug === "home" ? "/" : "/" + slug, "_blank"), title: "Open the published page in a new tab" },
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
    </CatalogProvider>
  )
}

/* ------------------------------------------------------------------ */
/* Panel list rows (W4 polish) — presentation-only wrappers that add    */
/* block icons + hover states. All handlers are passed straight through */
/* so drag-reorder / click-to-edit behavior is byte-identical.          */
/* ------------------------------------------------------------------ */

function SectionRow({
  index,
  blockType,
  label,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick,
}: {
  index: number
  blockType: string
  label: string
  isDragOver: boolean
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void
  onDragOver: (e: React.DragEvent<HTMLButtonElement>) => void
  onDrop: (e: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd: (e: React.DragEvent<HTMLButtonElement>) => void
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drag to reorder, or click to edit"
      style={{
        ...type.body,
        fontFamily: font,
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        margin: "4px 0",
        border: `1px solid ${
          isDragOver ? accent.base : hover ? grey[30] : grey[20]
        }`,
        borderRadius: radius.md,
        background: isDragOver ? accent.tint : hover ? grey[5] : grey[0],
        cursor: "grab",
        color: grey[90],
        transition: `background ${motion.fast}, border-color ${motion.fast}`,
      }}
    >
      <span
        aria-hidden
        style={{ color: grey[30], display: "inline-flex", flexShrink: 0 }}
      >
        <UiIcon name="grip" size={13} />
      </span>
      <span
        aria-hidden
        style={{
          color: hover ? accent.base : grey[50],
          display: "inline-flex",
          flexShrink: 0,
          transition: `color ${motion.fast}`,
        }}
      >
        <PaletteIcon type={blockType} size={17} />
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          ...type.label,
          marginLeft: "auto",
          color: grey[40],
          flexShrink: 0,
        }}
      >
        {index + 1}
      </span>
    </button>
  )
}

function ChromeRow({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...type.body,
        fontFamily: font,
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        margin: "4px 0",
        border: `1px solid ${hover ? grey[30] : grey[20]}`,
        borderRadius: radius.md,
        background: hover ? grey[5] : grey[0],
        cursor: "pointer",
        color: grey[90],
        transition: `background ${motion.fast}, border-color ${motion.fast}`,
      }}
    >
      <span
        aria-hidden
        style={{
          color: hover ? accent.base : grey[50],
          display: "inline-flex",
          flexShrink: 0,
          transition: `color ${motion.fast}`,
        }}
      >
        <UiIcon name={icon} size={16} strokeWidth={1.7} />
      </span>
      {label}
    </button>
  )
}

/**
 * The Copy/Paste/Reset style strip — the same three buttons in EVERY panel
 * mode (section, widget, element, header/footer, header/footer element), all
 * talking to the one shared clipboard. It used to exist only for sections;
 * an element's look could not be copied from the panel at all.
 */
function ClipStrip({
  onCopy,
  onPaste,
  onReset,
  canPaste,
}: {
  onCopy: () => void
  onPaste: () => void
  onReset: () => void
  canPaste: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
        margin: "8px 0 12px",
        paddingBottom: 12,
        borderBottom: hairline,
      }}
    >
      <button
        onClick={onCopy}
        title="Copy this item's Style + Advanced settings"
        style={styleActionBtn}
      >
        <UiIcon name="copy" size={13} />
        Copy style
      </button>
      <button
        onClick={onPaste}
        disabled={!canPaste}
        title={
          canPaste
            ? "Paste the copied Style + Advanced onto this item"
            : "Copy a style first"
        }
        style={{
          ...styleActionBtn,
          opacity: canPaste ? 1 : 0.4,
          cursor: canPaste ? "pointer" : "not-allowed",
        }}
      >
        <UiIcon name="paste" size={13} />
        Paste style
      </button>
      <button
        onClick={onReset}
        title="Clear all Style + Advanced settings on this item"
        style={{
          ...styleActionBtn,
          color: semantic.dangerFg,
          borderColor: semantic.dangerBorder,
        }}
      >
        <UiIcon name="reset" size={13} />
        Reset style
      </button>
    </div>
  )
}

/** "← Elements" / "← Back to Container" — the panel's only text links. */
const backLink: React.CSSProperties = {
  ...button("ghost", "sm"),
  height: "auto",
  padding: 0,
  marginBottom: 6,
  ...type.label,
  fontFamily: font,
  color: accent.base,
  background: "none",
}

// Compact buttons for the Copy/Paste/Reset/preset style toolbar (P6).
const styleActionBtn: React.CSSProperties = {
  ...button("secondary", "sm"),
  ...type.label,
  fontFamily: font,
  height: 26,
  padding: "0 8px",
  color: grey[70],
}

const presetSelect: React.CSSProperties = {
  ...field(),
  ...type.label,
  fontFamily: font,
  width: "auto",
  height: 26,
  padding: "0 6px",
  color: grey[70],
  cursor: "pointer",
  maxWidth: 120,
}

/* Responsive-preview device widths (px). Desktop is unconstrained (full). */
const DEVICE_WIDTH: Record<"desktop" | "tablet" | "mobile", number> = {
  desktop: 0,
  tablet: 820,
  mobile: 390,
}

const DEVICES: {
  id: "desktop" | "tablet" | "mobile"
  icon: string
  title: string
}[] = [
  { id: "desktop", icon: "monitor", title: "Desktop — full width" },
  { id: "tablet", icon: "tablet", title: "Tablet — 820px" },
  { id: "mobile", icon: "phone", title: "Mobile — 390px" },
]

/** A control on the dark ink chrome (top strip, panel footer). */
const deviceBtn: React.CSSProperties = {
  ...button("ghost", "sm"),
  border: hairlineDark,
  background: ink.raised,
  color: ink.text,
}
