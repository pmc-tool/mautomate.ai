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
  getBlockSchema,
  getWidgetSchema,
  defaultPropsFromSchema,
} from "@modules/cms/schema"
import { CHROME_SCHEMAS, getChromeSchema } from "@modules/cms/schema/chrome"
import { resolveCustomTokens } from "@modules/cms/schema/chrome/theme"
import { getElementDefs, getChromeElementDefs } from "@modules/cms/render/element-registry"
import type { ElementStyles } from "@modules/cms/render/style-engine"

type Section = { block_type: string; [k: string]: unknown }

// A copied section "look" = its style + advanced bags only (never content).
// Held at module scope so it survives component re-renders; mirrored into
// localStorage (LS_COPIED_STYLE) so it also survives page navigation.
type CopiedStyle = {
  style: Record<string, unknown>
  advanced: Record<string, unknown>
}
type StylePreset = CopiedStyle & { name: string }
let copiedStyleRef: CopiedStyle | null = null
const LS_COPIED_STYLE = "ff_copied_style"

function getEditorKeyFromCookie(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|; )ff_editor_key=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ""
}

const LS_STYLE_PRESETS = "ff_style_presets"

// Deep-merge `extra` onto `base` (plain objects merge recursively; arrays and
// scalars are replaced). Used to layer a copied/preset look onto a section's
// existing bags without dropping keys it already had.
const deepMergeBag = (
  base: Record<string, unknown>,
  extra: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...(base ?? {}) }
  for (const k of Object.keys(extra ?? {})) {
    const bv = out[k]
    const ev = extra[k]
    if (
      bv &&
      ev &&
      typeof bv === "object" &&
      typeof ev === "object" &&
      !Array.isArray(bv) &&
      !Array.isArray(ev)
    ) {
      out[k] = deepMergeBag(
        bv as Record<string, unknown>,
        ev as Record<string, unknown>
      )
    } else {
      out[k] = ev
    }
  }
  return out
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
  const [selectedWidget, setSelectedWidget] = useState<{
    index: number
    col: number
    wi: number
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
  // Copy/Paste/Reset style + presets (P6). `hasCopied` only gates the Paste
  // button; the actual payload lives in copiedStyleRef + localStorage. Presets
  // are a local (no-backend) library keyed by name.
  const [hasCopied, setHasCopied] = useState(false)
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

  // Record an undo snapshot of the CURRENT content before a change. Rapid edits
  // (typing) within 700ms coalesce into a single history entry.
  const snapshot = () => {
    if (!content) return
    setContentDirty(true)
    const now = Date.now()
    if (now - lastSnapRef.current < 700) return
    lastSnapRef.current = now
    const cur = content
    setUndoStack((s) => [...s.slice(-49), cur])
    setRedoStack([])
  }

  const undo = () => {
    setUndoStack((u) => {
      if (!u.length || !content) return u
      const prev = u[u.length - 1]
      setRedoStack((r) => [...r, content])
      setContent(prev)
      pushToCanvas(prev)
      setSelected(null)
      setSelectedWidget(null)
      setContentDirty(true)
      lastSnapRef.current = 0
      return u.slice(0, -1)
    })
  }

  const redo = () => {
    setRedoStack((r) => {
      if (!r.length || !content) return r
      const next = r[r.length - 1]
      setUndoStack((u) => [...u, content])
      setContent(next)
      pushToCanvas(next)
      setSelected(null)
      setSelectedWidget(null)
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
    widget: (index: number, col: number, widgetType: string, wi?: number) => void
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
        setChrome({
          header: d.header ?? {},
          topbar: d.topbar ?? {},
          footer: d.footer ?? {},
          theme: d.theme ?? {},
        })
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
        setContent(
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

  // Messages from the canvas iframe.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m !== "object") return
      if (m.type === "cms:ready") {
        readyRef.current = true
        if (content) pushToCanvas(content)
      }
      if (m.type === "cms:clicked" && typeof m.index === "number") {
        setSelected(m.index)
        setSelectedChrome(null)
        setSelectedElement(null)
        setSelectedChromeElement(null)
        setSelectedWidget(null)
      }
      if (m.type === "cms:clickedChrome" && typeof m.key === "string") {
        setSelectedChrome(m.key)
        setSelected(null)
        setSelectedElement(null)
        setSelectedChromeElement(null)
        setSelectedWidget(null)
      }
      // Widget-level selection (Composer W1): the user clicked a [data-w]
      // widget inside a container section on the canvas. Select it for
      // editing and clear every other selection so the panel switches to
      // widget mode.
      if (
        m.type === "cms:clickedWidget" &&
        typeof m.index === "number" &&
        typeof m.col === "number" &&
        typeof m.wi === "number"
      ) {
        setSelectedWidget({ index: m.index, col: m.col, wi: m.wi })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedElement(null)
        setSelectedChromeElement(null)
      }
      // Chrome element-level selection (F1): the user clicked a [data-el] element
      // inside a chrome region on the canvas. Select it for styling and clear any
      // section / element / chrome-region selection so the panel switches to
      // chrome element mode.
      if (
        m.type === "cms:clickedChromeElement" &&
        typeof m.region === "string" &&
        m.region &&
        typeof m.elementKey === "string" &&
        m.elementKey
      ) {
        setSelectedChromeElement({ region: m.region, key: m.elementKey })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedElement(null)
        setSelectedWidget(null)
      }
      // Element-level selection (E1): the user clicked a [data-el] element
      // inside a section on the canvas. Select it for styling and clear any
      // section / chrome selection so the panel switches to element mode.
      if (
        m.type === "cms:clickedElement" &&
        typeof m.index === "number" &&
        typeof m.elementKey === "string" &&
        m.elementKey
      ) {
        setSelectedElement({ index: m.index, key: m.elementKey })
        setSelected(null)
        setSelectedChrome(null)
        setSelectedChromeElement(null)
        setSelectedWidget(null)
      }
      // Canvas floating-toolbar actions (move/duplicate/delete/edit/add).
      if (m.type === "cms:action" && typeof m.index === "number") {
        actionsRef.current[m.action]?.(m.index)
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
      if (m.type === "cms:openTemplates") {
        setShowTemplates(true)
      }
      // Palette drop (Composer W3): a widget card dropped on a container
      // column — append a fresh widget to content[index].columns[col].
      if (
        m.type === "cms:insertWidgetAt" &&
        typeof m.index === "number" &&
        typeof m.col === "number" &&
        typeof m.widget_type === "string" &&
        m.widget_type
      ) {
        insertRef.current.widget(
          m.index,
          m.col,
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

  const selectChrome = (k: string) => {
    setSelectedChrome(k)
    setSelected(null)
    setSelectedElement(null)
    setSelectedChromeElement(null)
    setSelectedWidget(null)
    iframeRef.current?.contentWindow?.postMessage({ type: "cms:selectChrome", key: k }, "*")
  }

  const updateChrome = (k: string, data: Record<string, unknown>) => {
    setChrome((c) => ({ ...c, [k]: data }))
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
    const prev = (chrome[region] ?? {}) as Record<string, unknown>
    const updated: Record<string, unknown> = { ...prev }
    if (next && Object.keys(next).length > 0) {
      updated[bagKey] = next
    } else {
      delete updated[bagKey]
    }
    updateChrome(region, updated)
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
  ) => {
    const prev = (chrome[region] ?? {}) as Record<string, unknown>
    const prevEs = (prev.elementStyles as ElementStyles | undefined) ?? {}
    const prevEntry = { ...(prevEs[key] ?? {}) }
    if (next && Object.keys(next).length > 0) {
      prevEntry[bagKey] = next
    } else {
      delete prevEntry[bagKey]
    }
    const nextEs: ElementStyles = { ...prevEs }
    if (prevEntry.style || prevEntry.advanced) {
      nextEs[key] = prevEntry
    } else {
      delete nextEs[key]
    }
    const updated: Record<string, unknown> = { ...prev }
    if (Object.keys(nextEs).length > 0) {
      updated.elementStyles = nextEs
    } else {
      delete updated.elementStyles
    }
    updateChrome(region, updated)
  }

  // Leave chrome element mode → re-select the whole chrome region (outlines it
  // on the canvas and clears the chrome element selection there).
  const backToChromeRegion = () => {
    if (selectedChromeElement == null) return
    selectChrome(selectedChromeElement.region)
  }

  const selectSection = (i: number) => {
    setSelected(i)
    setSelectedElement(null)
    setSelectedChromeElement(null)
    setSelectedWidget(null)
    iframeRef.current?.contentWindow?.postMessage({ type: "cms:select", index: i }, "*")
  }

  const updateSelected = (nextData: Record<string, unknown>) => {
    if (selected == null) return
    snapshot()
    const next = nextData as Section
    setContent((c) => (c ? c.map((b, i) => (i === selected ? next : b)) : c))
    patchToCanvas(selected, next) // targeted live update — no full re-render
  }

  // Style/Advanced (P3): merge a namespaced diff bag onto the CURRENTLY selected
  // section and stream the whole section to the canvas so buildSectionCss +
  // the hybrid wrapper render it live. Diff-only storage: an empty bag deletes
  // the key entirely so an un-styled section stays byte-identical to today.
  // Selection is unchanged (same index), so the section stays selected.
  const updateSelectedBag = (
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selected == null || !selectedBlock) return
    snapshot()
    const idx = selected
    const updated: Section = { ...selectedBlock }
    if (next && Object.keys(next).length > 0) {
      updated[bagKey] = next
    } else {
      delete updated[bagKey]
    }
    setContent((c) => (c ? c.map((b, i) => (i === idx ? updated : b)) : c))
    patchToCanvas(idx, updated) // targeted live update — re-renders with style
  }

  // Element-level (E1): merge a namespaced diff bag into the CURRENTLY selected
  // element's slot inside its section's `elementStyles[key]`. Same diff-only
  // rules as the section bags: an empty bag deletes that sub-key; an empty entry
  // deletes the element key; an empty map deletes `elementStyles` entirely so a
  // section with no element overrides stays byte-identical to today. Streams the
  // whole section to the canvas so buildSectionCss re-emits the descendant CSS.
  const updateSelectedElementBag = (
    key: string,
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selectedElement == null || !content) return
    const idx = selectedElement.index
    const section = content[idx]
    if (!section) return
    snapshot()
    const prevEs = (section.elementStyles as ElementStyles | undefined) ?? {}
    const prevEntry = { ...(prevEs[key] ?? {}) }
    if (next && Object.keys(next).length > 0) {
      prevEntry[bagKey] = next
    } else {
      delete prevEntry[bagKey]
    }
    const nextEs: ElementStyles = { ...prevEs }
    if (prevEntry.style || prevEntry.advanced) {
      nextEs[key] = prevEntry
    } else {
      delete nextEs[key]
    }
    const updated: Section = { ...section }
    if (Object.keys(nextEs).length > 0) {
      updated.elementStyles = nextEs
    } else {
      delete updated.elementStyles
    }
    setContent((c) => (c ? c.map((b, i) => (i === idx ? updated : b)) : c))
    patchToCanvas(idx, updated)
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
  const selectWidget = (index: number, col: number, wi: number) => {
    setSelectedWidget({ index, col, wi })
    setSelected(null)
    setSelectedChrome(null)
    setSelectedElement(null)
    setSelectedChromeElement(null)
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cms:selectWidget", index, col, wi },
      "*"
    )
  }

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
    col: number,
    wi: number,
    nextWidget: Widget
  ) => {
    if (!content) return
    const section = content[index]
    const cols = section?.columns as Column[] | undefined
    if (!section || !Array.isArray(cols) || !cols[col]?.widgets?.[wi]) return
    snapshot()
    const nextCols = cols.map((c, ci) =>
      ci === col
        ? {
            ...c,
            widgets: c.widgets.map((w, i) => (i === wi ? nextWidget : w)),
          }
        : c
    )
    const updated: Section = { ...section, columns: nextCols }
    setContent((c) => (c ? c.map((b, i) => (i === index ? updated : b)) : c))
    patchToCanvas(index, updated)
  }

  // Content-prop edit for the CURRENTLY selected widget (widget_type, style
  // and advanced are preserved — the panel only hands back content props).
  const updateSelectedWidget = (patch: Record<string, unknown>) => {
    if (selectedWidget == null || !content) return
    const { index, col, wi } = selectedWidget
    const widget = (content[index]?.columns as Column[] | undefined)?.[col]
      ?.widgets?.[wi]
    if (!widget) return
    writeWidget(index, col, wi, { ...widget, ...patch })
  }

  // Style/Advanced diff bag for the selected widget. Same diff-only rule as
  // sections: an empty bag deletes the key so an un-styled widget stays a
  // tiny content-only object.
  const updateSelectedWidgetBag = (
    bagKey: "style" | "advanced",
    next: Record<string, unknown>
  ) => {
    if (selectedWidget == null || !content) return
    const { index, col, wi } = selectedWidget
    const widget = (content[index]?.columns as Column[] | undefined)?.[col]
      ?.widgets?.[wi]
    if (!widget) return
    const updated: Widget = { ...widget }
    if (next && Object.keys(next).length > 0) {
      updated[bagKey] = next
    } else {
      delete updated[bagKey]
    }
    writeWidget(index, col, wi, updated)
  }

  // Columns manager (add/remove/reorder widgets) for the SELECTED container
  // section — replaces its `columns` array wholesale (already immutable).
  const setSelectedColumns = (nextCols: Column[]) => {
    if (selected == null || !content?.[selected]) return
    updateSelected({ ...content[selected], columns: nextCols })
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
    if (!content) return
    const to = from + dir
    if (to < 0 || to >= content.length) return
    snapshot()
    const next = [...content]
    ;[next[from], next[to]] = [next[to], next[from]]
    setContent(next)
    pushToCanvas(next) // structural change → full canvas sync
    setSelected((s) => (s === from ? from + dir : s))
    setSelectedWidget(null) // section indices shifted — widget path is stale
  }

  // Reorder by dropping a dragged section-list row onto another position.
  const moveSectionTo = (from: number, to: number) => {
    if (!content || from === to || to < 0 || to >= content.length) return
    snapshot()
    const next = [...content]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setContent(next)
    pushToCanvas(next)
    setSelected(to)
    setSelectedWidget(null)
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
    if (!content) return
    const schema = getBlockSchema(type)
    if (!schema) return
    snapshot()
    const props =
      presetIndex != null && schema.presets?.[presetIndex]
        ? structuredClone(schema.presets[presetIndex].props)
        : defaultPropsFromSchema(schema)
    const block = { block_type: type, ...props } as Section
    const at = Math.max(0, Math.min(index, content.length))
    const next = [...content.slice(0, at), block, ...content.slice(at)]
    setContent(next)
    pushToCanvas(next)
    setAdding(false)
    setAddTargetIndex(null)
    setSelected(at)
    setSelectedChrome(null)
    setSelectedElement(null)
    setSelectedChromeElement(null)
    setSelectedWidget(null)
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cms:select", index: at },
      "*"
    )
  }

  // Structure picker (canvas add-section zone): insert a container with N
  // empty columns at `index`, then select it (Elementor select-your-structure).
  const insertContainerAt = (index: number, colsN: number) => {
    if (!content) return
    const schema = getBlockSchema("container")
    if (!schema) return
    snapshot()
    const n = Math.max(1, Math.min(4, colsN))
    const props = {
      ...defaultPropsFromSchema(schema),
      layout: String(n),
      columns: Array.from({ length: n }, () => ({ widgets: [] })),
    }
    const block = { block_type: "container", ...props } as Section
    const at = Math.max(0, Math.min(index, content.length))
    const next = [...content.slice(0, at), block, ...content.slice(at)]
    setContent(next)
    pushToCanvas(next)
    setSelected(at)
    setSelectedChrome(null)
    setSelectedElement(null)
    setSelectedChromeElement(null)
    setSelectedWidget(null)
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cms:select", index: at },
      "*"
    )
  }

  // A widget dropped outside any container: auto-wrap it in a new 1-column
  // container at `index` (Elementor drop-anywhere), then select the widget.
  const insertWidgetAsSection = (index: number, widgetType: string) => {
    if (!content || !getWidgetSchema(widgetType)) return
    const schema = getBlockSchema("container")
    if (!schema) return
    snapshot()
    const widget = newWidgetOf(widgetType)
    const props = {
      ...defaultPropsFromSchema(schema),
      layout: "1",
      columns: [{ widgets: [widget] }],
    }
    const block = { block_type: "container", ...props } as Section
    const at = Math.max(0, Math.min(index, content.length))
    const next = [...content.slice(0, at), block, ...content.slice(at)]
    setContent(next)
    pushToCanvas(next)
    selectWidget(at, 0, 0)
  }

  // Apply server-validated AI patches through the normal undo pipeline (P1).
  const applyAiPatches = (patches: any[]): number => {
    if (!content || !Array.isArray(patches) || patches.length === 0) return 0
    snapshot()
    const next = [...content]
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
    setContent(next)
    pushToCanvas(next)
    setContentDirty(true)
    setSelected(null)
    setSelectedWidget(null)
    setSelectedElement(null)
    return applied
  }

  const addSection = (type: string, presetIndex?: number) => {
    if (!content) return
    insertSectionAt(
      addTargetIndex != null ? addTargetIndex : content.length,
      type,
      presetIndex
    )
  }

  // Palette widget drop (Composer W3): append a fresh widget (schema defaults)
  // to content[index].columns[col].widgets, snapshot for undo, stream the
  // section to the canvas, and select the new widget for editing.
  const insertWidgetAt = (
    index: number,
    col: number,
    widgetType: string,
    wi?: number
  ) => {
    if (!content || !getWidgetSchema(widgetType)) return
    const section = content[index]
    const cols = section?.columns as Column[] | undefined
    if (!section || !Array.isArray(cols) || !cols[col]) return
    snapshot()
    const widget = newWidgetOf(widgetType)
    const existing = Array.isArray(cols[col].widgets) ? cols[col].widgets : []
    // Positional drop (Elementor): splice at the insertion index, else append.
    const at = wi == null ? existing.length : Math.max(0, Math.min(wi, existing.length))
    const nextCols = cols.map((c, ci) =>
      ci === col
        ? {
            ...c,
            widgets: [...existing.slice(0, at), widget, ...existing.slice(at)],
          }
        : c
    )
    const updated: Section = { ...section, columns: nextCols }
    setContent((c) => (c ? c.map((b, i) => (i === index ? updated : b)) : c))
    patchToCanvas(index, updated)
    selectWidget(index, col, at)
  }

  const duplicateSection = (i: number) => {
    if (!content || i < 0 || i >= content.length) return
    snapshot()
    const clone = structuredClone(content[i])
    const next = [...content.slice(0, i + 1), clone, ...content.slice(i + 1)]
    setContent(next)
    pushToCanvas(next)
    setSelected(i + 1)
    setSelectedWidget(null)
    iframeRef.current?.contentWindow?.postMessage(
      { type: "cms:select", index: i + 1 },
      "*"
    )
  }

  const openAddAt = (index: number | null) => {
    setAddTargetIndex(index)
    setAdding(true)
    setSelected(null)
    setSelectedChrome(null)
    setSelectedElement(null)
    setSelectedChromeElement(null)
    setSelectedWidget(null)
  }

  const removeSection = (i: number) => {
    if (!content) return
    snapshot()
    const next = content.filter((_, idx) => idx !== i)
    setContent(next)
    pushToCanvas(next)
    setSelected(null)
    setSelectedWidget(null)
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
  actionsRef.current = {
    up: (i) => moveSection(i, -1),
    down: (i) => moveSection(i, 1),
    duplicate: duplicateSection,
    delete: removeSection,
    edit: selectSection,
    addBelow: (i) => openAddAt(i + 1),
    insert: (i) => openAddAt(i),
  }
  insertRef.current = { section: insertSectionAt, widget: insertWidgetAt }

  const selectedBlock = useMemo(
    () => (content && selected != null ? content[selected] : null),
    [content, selected]
  )

  // Hydrate the copied-style buffer + preset library from localStorage once, so
  // both survive a full page navigation (module ref alone would be lost).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_COPIED_STYLE)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object") {
          copiedStyleRef = {
            style: parsed.style ?? {},
            advanced: parsed.advanced ?? {},
          }
          setHasCopied(true)
        }
      }
    } catch {
      // ignore malformed clipboard
    }
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
  }, [])

  // Write both bags of the selected section in a SINGLE update. Calling
  // updateSelectedBag twice in a row would clobber the first change (both reads
  // share the same stale `selectedBlock` closure), so paste/reset/preset — which
  // touch style AND advanced — go through this instead. Same diff-only rule:
  // an empty bag deletes the key so an un-styled section stays byte-identical.
  const applySelectedBags = useCallback(
    (
      nextStyle: Record<string, unknown>,
      nextAdvanced: Record<string, unknown>
    ) => {
      if (selected == null || !selectedBlock) return
      snapshot()
      const idx = selected
      const updated: Section = { ...selectedBlock }
      if (nextStyle && Object.keys(nextStyle).length > 0) {
        updated.style = nextStyle
      } else {
        delete updated.style
      }
      if (nextAdvanced && Object.keys(nextAdvanced).length > 0) {
        updated.advanced = nextAdvanced
      } else {
        delete updated.advanced
      }
      setContent((c) => (c ? c.map((b, i) => (i === idx ? updated : b)) : c))
      patchToCanvas(idx, updated)
    },
    [selected, selectedBlock, patchToCanvas]
  )

  // Copy the selected section's look (style + advanced only — never content) to
  // the module ref + localStorage so it can be pasted onto any section, page.
  const copyStyle = () => {
    if (!selectedBlock) return
    const payload: CopiedStyle = {
      style: (selectedBlock.style as Record<string, unknown>) ?? {},
      advanced: (selectedBlock.advanced as Record<string, unknown>) ?? {},
    }
    copiedStyleRef = payload
    try {
      window.localStorage.setItem(LS_COPIED_STYLE, JSON.stringify(payload))
    } catch {
      // localStorage may be unavailable; the module ref still works this session
    }
    setHasCopied(true)
    setStatus("Style copied — select another section and Paste style.")
  }

  // Merge the copied look onto the selected section (visual bags only). Existing
  // keys are preserved; copied keys win on conflict.
  const pasteStyle = () => {
    const src = copiedStyleRef
    if (!src || selected == null || !selectedBlock) return
    const curStyle = (selectedBlock.style as Record<string, unknown>) ?? {}
    const curAdv = (selectedBlock.advanced as Record<string, unknown>) ?? {}
    applySelectedBags(
      deepMergeBag(curStyle, src.style ?? {}),
      deepMergeBag(curAdv, src.advanced ?? {})
    )
  }

  // Clear both visual bags on the selected section (content is untouched).
  const resetStyle = () => {
    if (selected == null || !selectedBlock) return
    if (
      !window.confirm(
        "Reset all Style & Advanced settings for this section? Content is kept."
      )
    ) {
      return
    }
    applySelectedBags({}, {})
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
    applySelectedBags(
      deepMergeBag(curStyle, preset.style ?? {}),
      deepMergeBag(curAdv, preset.advanced ?? {})
    )
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
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ color: "#b91c1c", fontSize: 16, fontWeight: 600 }}>
          This editor link is invalid or has expired.
        </div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          Open the visual editor again from the admin to get a fresh link.
        </div>
        <a
          href={EXIT_HREF}
          style={{
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 6,
            background: "#2563eb",
            color: "#fff",
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
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Canvas */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "#f3f4f6",
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
            gap: 6,
            padding: "6px 10px",
            borderBottom: "1px solid #1f2124",
            background: "#26292c",
          }}
        >
          <button
            onClick={exitEditor}
            title="Exit editor"
            style={{
              ...deviceBtn,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#e5e7eb",
              marginRight: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UiIcon name="arrow-left" size={13} />
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
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
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
                  borderRadius: 6,
                  width: 34,
                  height: 25,
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  background: device === d.id ? "#3a4046" : "transparent",
                  color: device === d.id ? "#fff" : "#9ca3af",
                  boxShadow: "none",
                  transition: "background .12s, color .12s",
                }}
              >
                <UiIcon name={d.icon} size={15} />
              </button>
            ))}
          </div>
          <span
            style={{
              fontSize: 11,
              color: dirty ? "#fbbf24" : "#9ca3af",
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
                ...deviceBtn,
                background: "#f3bafd",
                border: 0,
                color: "#0c0d0e",
                fontWeight: 700,
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
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "#e5e7eb",
              marginLeft: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UiIcon name="panel" size={13} />
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
              padding: "5px 10px",
              fontSize: 11,
              color: "#92400e",
              background: "#fffbeb",
              borderBottom: "1px solid #fde68a",
            }}
          >
            <span aria-hidden>✎</span>
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
              background: "#fff",
              borderRadius: device === "desktop" ? 0 : 10,
              boxShadow:
                device === "desktop"
                  ? "none"
                  : "0 4px 24px rgba(0,0,0,0.14)",
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
            width: 5,
            cursor: "col-resize",
            flexShrink: 0,
            background: "#e5e7eb",
          }}
        />
      )}

      {/* Panel */}
      <aside
        style={{
          order: -2,
          width: panelCollapsed ? 0 : panelWidth,
          flexShrink: 0,
          borderRight: panelCollapsed ? "none" : "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {/* Branded header — wordmark strip + page switcher / history / publish */}
        <div
          style={{
            background: "#26292c",
            padding: "10px 14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "Marcellus, Georgia, 'Times New Roman', serif",
                fontSize: 16,
                letterSpacing: 0.5,
                color: "#fff",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              mAutomate
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#f0abfc",
                border: "1px solid rgba(240, 171, 252, 0.4)",
                borderRadius: 4,
                padding: "2px 5px",
                lineHeight: 1,
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
                marginRight: "auto",
                minWidth: 0,
                maxWidth: 150,
                padding: "5px 8px",
                border: "1px solid #374151",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                background: "#1f2937",
                color: "#f9fafb",
                cursor: "pointer",
                outline: "none",
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
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.16)",
                background: previewMode ? "#f3bafd" : "rgba(255,255,255,0.07)",
                color: previewMode ? "#0c0d0e" : "#e5e7eb",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <UiIcon name="eye" size={14} />
            </button>
            <button
              onClick={() => setShowAi(true)}
              title="AI editor — edit this page by describing changes"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 12px",
                borderRadius: 7,
                border: "1px solid rgba(240,171,252,0.5)",
                background: "rgba(240,171,252,0.12)",
                color: "#f0abfc",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              AI
            </button>
            <button
              onClick={publish}
              disabled={!dirty}
              title={dirty ? "Publish your changes" : "All changes published"}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 16px",
                borderRadius: 7,
                border: 0,
                background: dirty ? "#f3bafd" : "rgba(255,255,255,0.10)",
                color: dirty ? "#0c0d0e" : "#9ca3af",
                cursor: dirty ? "pointer" : "default",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "background .15s, color .15s",
              }}
            >
              {dirty ? (
                <span
                  style={{ width: 6, height: 6, borderRadius: 3, background: "#d004d4", display: "inline-block" }}
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
                onClose={() => setShowTemplates(false)}
                onInsert={(blocks) => {
                  if (!content || !Array.isArray(blocks) || blocks.length === 0) return
                  snapshot()
                  const at = content.length
                  const next = [...content, ...(blocks as Section[])]
                  setContent(next)
                  pushToCanvas(next) // structural change -> live canvas sync
                  setContentDirty(true)
                  // Select + scroll to the first inserted section so the result
                  // is immediately visible (cms:select scrolls it into view).
                  setSelected(at)
                  setSelectedChrome(null)
                  setSelectedElement(null)
                  setSelectedChromeElement(null)
                  setSelectedWidget(null)
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: "cms:select", index: at },
                    "*"
                  )
                  setStatus(`Template added — ${blocks.length} section${blocks.length === 1 ? "" : "s"} inserted at the end of the page.`)
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
                  gap: 7,
                  margin: "10px 14px 0",
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.45,
                  background: isErr ? "#fef2f2" : "#f0fdf4",
                  border: `1px solid ${isErr ? "#fecaca" : "#bbf7d0"}`,
                  color: isErr ? "#b91c1c" : "#15803d",
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
        <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
          {loadError ? (
            <div>
              <p style={{ color: "#b91c1c", fontSize: 13, margin: "0 0 6px" }}>
                This page could not be loaded.
              </p>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 12px" }}>
                Your storefront may be offline or the link may have expired.
                Publishing is disabled until it loads.
              </p>
              <button
                onClick={() => setReloadNonce((n) => n + 1)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          ) : !content ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Loading…</p>
          ) : selectedWidget && content[selectedWidget.index] ? (
            (() => {
              const { index, col, wi } = selectedWidget
              const section = content[index]
              const widget = (section.columns as Column[] | undefined)?.[col]
                ?.widgets?.[wi]
              if (!widget) {
                return (
                  <div>
                    <button
                      onClick={backToContainer}
                      style={{
                        fontSize: 12,
                        color: "#2563eb",
                        background: "none",
                        border: 0,
                        cursor: "pointer",
                        padding: 0,
                        marginBottom: 6,
                      }}
                    >
                      ← Back to Container
                    </button>
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                      This widget no longer exists.
                    </p>
                  </div>
                )
              }
              const def = getWidgetSchema(widget.widget_type)
              const { widget_type, style, advanced, ...contentProps } = widget
              return (
                <SchemaPanel
                  widgetMode
                  blockLabel={`Container › Column ${col + 1}`}
                  elementLabel={def?.label ?? widget_type}
                  onBackToSection={backToContainer}
                  contentFields={def?.fields ?? []}
                  props={contentProps}
                  onChange={(next) => updateSelectedWidget(next)}
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
              return (
                <SchemaPanel
                  elementMode
                  blockLabel={BLOCK_LABELS[blockType] ?? blockType}
                  elementLabel={def?.label ?? selectedElement.key}
                  onBackToSection={backToSection}
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
                <SchemaPanel
                  elementMode
                  blockLabel={regionLabel}
                  elementLabel={def?.label ?? elKey}
                  onBackToSection={backToChromeRegion}
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
                  <button
                    onClick={() => {
                      setSelectedChrome(null)
                      iframeRef.current?.contentWindow?.postMessage(
                        { type: "cms:selectChrome", key: null },
                        "*"
                      )
                    }}
                    style={{ fontSize: 12, color: "#2563eb", background: "none", border: 0, cursor: "pointer", padding: 0, marginBottom: 6 }}
                  >
                    ← Elements
                  </button>
                  <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>
                    {getChromeSchema(selectedChrome)!.label}
                  </h3>
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
              <button
                onClick={() => selectSection(-1)}
                style={{
                  fontSize: 12,
                  color: "#2563eb",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: 6,
                }}
              >
                ← Elements
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  aria-hidden
                  style={{ color: "#6b7280", display: "inline-flex", flexShrink: 0 }}
                >
                  <PaletteIcon type={selectedBlock.block_type} size={18} />
                </span>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
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
                  gap: 4,
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <button
                  onClick={copyStyle}
                  title="Copy this section's Style + Advanced settings"
                  style={styleActionBtn}
                >
                  Copy style
                </button>
                <button
                  onClick={pasteStyle}
                  disabled={!hasCopied}
                  title={
                    hasCopied
                      ? "Paste copied Style + Advanced onto this section"
                      : "Copy a style first"
                  }
                  style={{
                    ...styleActionBtn,
                    opacity: hasCopied ? 1 : 0.4,
                    cursor: hasCopied ? "pointer" : "not-allowed",
                  }}
                >
                  Paste style
                </button>
                <button
                  onClick={resetStyle}
                  title="Clear all Style + Advanced settings"
                  style={{
                    ...styleActionBtn,
                    color: "#b91c1c",
                    borderColor: "#fecaca",
                  }}
                >
                  Reset style
                </button>
                <button
                  onClick={saveAsPreset}
                  title="Save this section's look as a reusable preset"
                  style={styleActionBtn}
                >
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
                              selectWidget(selected!, col, wi)
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
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>
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
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  border: "1px dashed #93c5fd",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "9px",
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                <UiIcon name="plus" size={13} />
                Add section
              </button>

              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.6, margin: "16px 0 4px" }}>
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
            background: "#26292c",
            borderTop: "1px solid #1f2124",
            flexShrink: 0,
          }}
        >
          {[
            { label: "Templates", onClick: () => setShowTemplates(true), title: "Template library" },
            { label: "History", onClick: () => setShowRevisions(true), title: "Version history" },
            { label: "Find  ⌘K", onClick: () => setShowPalette(true), title: "Search (Cmd/Ctrl+K)" },
            { label: "View live", onClick: () => window.open(slug === "home" ? "/" : "/" + slug, "_blank"), title: "Open the published page in a new tab" },
          ].map((b) => (
            <button
              key={b.label}
              onClick={b.onClick}
              title={b.title}
              style={{
                flex: 1,
                fontSize: 11,
                fontWeight: 600,
                padding: "7px 6px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#e5e7eb",
                cursor: "pointer",
              }}
            >
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
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        margin: "4px 0",
        border: `1px solid ${
          isDragOver ? "#2563eb" : hover ? "#d1d5db" : "#e5e7eb"
        }`,
        borderRadius: 8,
        background: isDragOver ? "#eff6ff" : hover ? "#f9fafb" : "#fff",
        cursor: "grab",
        fontSize: 13,
        color: "#111827",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span
        aria-hidden
        style={{ color: "#d1d5db", display: "inline-flex", flexShrink: 0 }}
      >
        <UiIcon name="grip" size={13} />
      </span>
      <span
        aria-hidden
        style={{
          color: hover ? "#2563eb" : "#6b7280",
          display: "inline-flex",
          flexShrink: 0,
          transition: "color .12s",
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
          marginLeft: "auto",
          fontSize: 11,
          fontWeight: 600,
          color: "#9ca3af",
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
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        margin: "4px 0",
        border: `1px solid ${hover ? "#d1d5db" : "#e5e7eb"}`,
        borderRadius: 8,
        background: hover ? "#f9fafb" : "#fff",
        cursor: "pointer",
        fontSize: 13,
        color: "#111827",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span
        aria-hidden
        style={{
          color: hover ? "#2563eb" : "#6b7280",
          display: "inline-flex",
          flexShrink: 0,
          transition: "color .12s",
        }}
      >
        <UiIcon name={icon} size={16} strokeWidth={1.7} />
      </span>
      {label}
    </button>
  )
}

// Compact pill buttons for the Copy/Paste/Reset/preset style toolbar (P6).
const styleActionBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  borderRadius: 5,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
}

const presetSelect: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  borderRadius: 5,
  padding: "3px 6px",
  fontSize: 11,
  fontWeight: 600,
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

const deviceBtn: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  borderRadius: 6,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
}
