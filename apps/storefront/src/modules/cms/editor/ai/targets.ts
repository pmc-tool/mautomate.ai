"use client"

/* ------------------------------------------------------------------ */
/* 3F AI surface — target resolution (ARCH-AI §2).                      */
/*                                                                     */
/* One translation layer between the canvas's NodeRef selection and     */
/* what the AI tiers need: the owning node payload (§3.2/§3.3 — never   */
/* anything page-wide), the Tier-1 field binding when the target IS one */
/* text field, the DOM element the prompt box anchors to, and the       */
/* client-side path merge that turns the server's dot-path {set,before} */
/* into the TOP-LEVEL root values the bus `ai.apply` command shallow-   */
/* merges (registry aiMergeRef spreads `set` onto the node — dot paths  */
/* are resolved HERE, against the CURRENT node, so `before` inverts     */
/* exactly what the merge replaces).                                    */
/* ------------------------------------------------------------------ */

import type { CmsSection, NodeRef } from "../canvas/protocol"
import type { GeometryStore } from "../canvas/geometry"
import { getBlockSchema, getWidgetSchema } from "../../schema"

/** Everything the prompt box needs from the canvas, in one bag.
 *  Passed into OverlayLayer as the single optional `ai` prop. */
export type AiOverlayContext = {
  sel: NodeRef | null
  content: CmsSection[]
  chrome: Record<string, unknown>
  geom: GeometryStore
  brand: string
}

/** Tier-1 field binding: this target is ONE editable text field. */
export type AiFieldBinding = {
  /** Field path on the WRITE host (widget props / section props / chrome bag). */
  path: string
  label: string
  html: boolean
  value: string
}

export type AiTargetKind =
  | "section" // themed block
  | "container"
  | "widget"
  | "element"
  | "item"
  | "chrome"
  | "chromeEl"
  /* 5C — the ARCH-AI slider reach (§5.1): stage selections. */
  | "sliderSlide"
  | "sliderLayer"

export type AiTarget = {
  ref: NodeRef
  kind: AiTargetKind
  /** Owning section (null for chrome-family). */
  sectionIndex: number | null
  section: CmsSection | null
  blockType: string | null
  /** For widget refs: the widget node + its type. */
  widget: Record<string, unknown> | null
  widgetType: string | null
  chromeRegion: string | null
  chromeData: Record<string, unknown> | null
  /** Tier-1 binding when the target is a single text field. */
  field: AiFieldBinding | null
  /** Item scope: "slides.2" (ARCH-AI §3.2 item micro). */
  itemPath: string | null
  /** 5C: the slider layer's type for sliderLayer targets (chips pick the
   *  text vs button row off it). */
  sliderLayerType: string | null
  label: string
  excerpt: string
}

/* Owner-facing section names (local copy — OverlayLayer's SECTION_LABELS
 * cannot be imported here without a module cycle: OverlayLayer -> box ->
 * chips -> targets). */
const SECTION_NAMES: Record<string, string> = {
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
  container: "Section",
}

const ITEM_NAMES: Record<string, string> = {
  slides: "Slide",
  categories: "Banner",
  items: "Item",
  brands: "Brand",
  images: "Image",
  tabs: "Tab",
}

const CHROME_NAMES: Record<string, string> = {
  topbar: "Top Bar",
  header: "Header",
  footer: "Footer",
}

/* Widget types whose whole content is ONE text field (Tier-1 targets). */
const WIDGET_TEXT_FIELD: Record<string, { path: string; label: string; html: boolean }> = {
  heading: { path: "text", label: "Heading", html: false },
  text: { path: "html", label: "Text", html: true },
  button: { path: "label", label: "Button label", html: false },
}

const str = (v: unknown): string => (typeof v === "string" ? v : "")

/** Walk a container section to the widget at an even-length [c,wi,…] path. */
export function widgetAtPath(
  section: CmsSection | null | undefined,
  path: number[]
): Record<string, unknown> | null {
  if (!section || path.length < 2 || path.length % 2 !== 0) return null
  let cols: unknown = (section as Record<string, unknown>).columns
  let node: Record<string, unknown> | null = null
  for (let k = 0; k < path.length; k += 2) {
    const col = Array.isArray(cols) ? (cols[path[k]] as Record<string, unknown> | undefined) : undefined
    const ws = col?.widgets
    const w = Array.isArray(ws) ? (ws[path[k + 1]] as Record<string, unknown> | undefined) : undefined
    if (!w || typeof w !== "object") return null
    node = w
    cols = w.columns
  }
  return node
}

/** Element key -> a same-named top-level TEXT field of its block's schema
 *  (the pragmatic el->fieldPath map until the shared inline map lands). */
function elementField(section: CmsSection, elKey: string): AiFieldBinding | null {
  const schema = getBlockSchema(section.block_type)
  const fields: { name?: string; type?: string; label?: string }[] = Array.isArray(
    (schema as { fields?: unknown } | undefined)?.fields
  )
    ? ((schema as { fields: { name?: string; type?: string; label?: string }[] }).fields)
    : []
  const norm = (s: string) => s.toLowerCase().replace(/[-\s]+/g, "_")
  const want = norm(elKey)
  const hit = fields.find(
    (f) =>
      typeof f.name === "string" &&
      norm(f.name) === want &&
      (f.type === "text" || f.type === "textarea" || f.type === "richText")
  )
  if (!hit || !hit.name) return null
  const value = (section as Record<string, unknown>)[hit.name]
  if (typeof value !== "string") return null
  return {
    path: hit.name,
    label: hit.label || hit.name,
    html: hit.type === "richText",
    value,
  }
}

/** Strip tags + collapse whitespace for the identity-line excerpt (§2.2). */
function excerptOf(node: Record<string, unknown> | null, max = 20): string {
  if (!node) return ""
  const keys = ["title", "text", "label", "heading", "subtitle", "html", "quote"]
  let raw = ""
  for (const k of keys) {
    if (typeof node[k] === "string" && (node[k] as string).trim()) {
      raw = node[k] as string
      break
    }
  }
  if (!raw) {
    for (const v of Object.values(node)) {
      if (typeof v === "string" && v.trim() && !/^https?:|^\//.test(v)) {
        raw = v
        break
      }
    }
  }
  const clean = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** Resolve a NodeRef to the full AI target, or null when it no longer
 *  resolves (the stale_node door, ARCH-AI §4.3). */
export function targetOf(ref: NodeRef, ctx: AiOverlayContext): AiTarget | null {
  const base = {
    ref,
    widget: null as Record<string, unknown> | null,
    widgetType: null as string | null,
    chromeRegion: null as string | null,
    chromeData: null as Record<string, unknown> | null,
    field: null as AiFieldBinding | null,
    itemPath: null as string | null,
    sliderLayerType: null as string | null,
  }

  if (ref.t === "chrome" || ref.t === "chromeEl") {
    const region = ref.region
    const data = ctx.chrome?.[region]
    if (!data || typeof data !== "object") return null
    const bag = data as Record<string, unknown>
    const name = CHROME_NAMES[region] ?? region
    if (ref.t === "chromeEl") {
      const value = bag[ref.el]
      const field: AiFieldBinding | null =
        typeof value === "string"
          ? { path: ref.el, label: ref.el.replace(/[_-]+/g, " "), html: false, value }
          : null
      return {
        ...base,
        kind: "chromeEl",
        sectionIndex: null,
        section: null,
        blockType: null,
        chromeRegion: region,
        chromeData: bag,
        field,
        label: `${name} — ${ref.el.replace(/[_-]+/g, " ")}`,
        excerpt: field ? excerptOf({ v: field.value } as Record<string, unknown>) : "",
      }
    }
    return {
      ...base,
      kind: "chrome",
      sectionIndex: null,
      section: null,
      blockType: null,
      chromeRegion: region,
      chromeData: bag,
      label: name,
      excerpt: "",
    }
  }

  const i = ref.i
  const section = ctx.content?.[i] ?? null
  if (!section) return null
  const blockType = section.block_type
  const sectionName = SECTION_NAMES[blockType] ?? blockType

  if (ref.t === "section" || ref.t === "column") {
    // Column is resolved for completeness; chips exclude it (ARCH-AI §2.3).
    return {
      ...base,
      kind: blockType === "container" ? "container" : "section",
      sectionIndex: i,
      section,
      blockType,
      label: sectionName,
      excerpt: excerptOf(section as Record<string, unknown>),
    }
  }

  if (ref.t === "widget") {
    const widget = widgetAtPath(section, ref.path)
    if (!widget) return null
    const widgetType = str(widget.widget_type)
    const def = getWidgetSchema(widgetType)
    const bindDef = WIDGET_TEXT_FIELD[widgetType]
    const field: AiFieldBinding | null = bindDef
      ? {
          ...bindDef,
          value: str(widget[bindDef.path]),
        }
      : null
    return {
      ...base,
      kind: "widget",
      sectionIndex: i,
      section,
      blockType,
      widget,
      widgetType,
      field,
      label: def?.label ?? widgetType ?? "Widget",
      excerpt: excerptOf(widget),
    }
  }

  if (ref.t === "element") {
    const field = elementField(section, ref.el)
    return {
      ...base,
      kind: "element",
      sectionIndex: i,
      section,
      blockType,
      field,
      label: `${sectionName} — ${ref.el.replace(/[_-]+/g, " ")}`,
      excerpt: field ? excerptOf({ v: field.value } as Record<string, unknown>) : excerptOf(section as Record<string, unknown>),
    }
  }

  /* --- 5C — the ARCH-AI slider reach (§5.1). Slide and layer refs are
     id-addressed (stage contract); indices into `slides`/`layers` are
     computed HERE against the CURRENT node, so the dot paths staged from
     a result always resolve on what the merge will clone (stale ids →
     null → the stale_node door). Only text/button layers bind a Tier-1
     field ("layer.props are just small nodes"); image/shape/icon layers
     have no AI surface. --- */
  if (ref.t === "sliderSlide" || ref.t === "sliderLayer") {
    const slides = (section as Record<string, unknown>).slides
    if (!Array.isArray(slides)) return null
    const sIdx = slides.findIndex(
      (s) =>
        !!s &&
        typeof s === "object" &&
        (s as Record<string, unknown>).id === ref.slideId
    )
    const slide =
      sIdx >= 0 ? (slides[sIdx] as Record<string, unknown>) : null
    const layers = slide?.layers
    if (!slide || !Array.isArray(layers)) return null

    if (ref.t === "sliderSlide") {
      const firstText = layers.find(
        (l) =>
          !!l &&
          typeof l === "object" &&
          (l as Record<string, unknown>).type === "text"
      ) as Record<string, unknown> | undefined
      return {
        ...base,
        kind: "sliderSlide",
        sectionIndex: i,
        section,
        blockType,
        itemPath: `slides.${sIdx}`,
        label: `Slide ${sIdx + 1} — ${sectionName}`,
        excerpt: firstText
          ? excerptOf(firstText.props as Record<string, unknown> | null)
          : "",
      }
    }

    const lIdx = layers.findIndex(
      (l) =>
        !!l &&
        typeof l === "object" &&
        (l as Record<string, unknown>).id === ref.layerId
    )
    const layer =
      lIdx >= 0 ? (layers[lIdx] as Record<string, unknown>) : null
    if (!layer) return null
    const ltype = str(layer.type)
    const bind =
      ltype === "text"
        ? { key: "html", label: "Text", html: true }
        : ltype === "button"
          ? { key: "label", label: "Button label", html: false }
          : null
    if (!bind) return null
    const props = (layer.props ?? {}) as Record<string, unknown>
    const value = props[bind.key]
    const field: AiFieldBinding | null =
      typeof value === "string"
        ? {
            path: `slides.${sIdx}.layers.${lIdx}.props.${bind.key}`,
            label: bind.label,
            html: bind.html,
            value,
          }
        : null
    return {
      ...base,
      kind: "sliderLayer",
      sectionIndex: i,
      section,
      blockType,
      field,
      sliderLayerType: ltype,
      label: `${ltype === "button" ? "Button" : "Text layer"} — Slide ${sIdx + 1}`,
      excerpt: excerptOf(props),
    }
  }

  // item
  const items = (section as Record<string, unknown>)[ref.field]
  const item = Array.isArray(items) ? (items[ref.n] as Record<string, unknown> | undefined) : undefined
  if (!item || typeof item !== "object") return null
  return {
    ...base,
    kind: "item",
    sectionIndex: i,
    section,
    blockType,
    itemPath: `${ref.field}.${ref.n}`,
    label: `${ITEM_NAMES[ref.field] ?? "Item"} ${ref.n + 1} — ${sectionName}`,
    excerpt: excerptOf(item),
  }
}

/* ---------------- DOM anchoring (geometry store reads these) --------- */

/** The DOM element a ref's box/outline anchors to (canvas document).
 *  Mirrors the canvas's outlineTarget rules for display:contents wrappers. */
export function domTargetOf(ref: NodeRef): HTMLElement | null {
  if (typeof document === "undefined") return null
  const q = (s: string) => document.querySelector<HTMLElement>(s)
  let el: HTMLElement | null = null
  switch (ref.t) {
    case "section":
    case "item":
      el = q(`[data-cms-idx="${ref.i}"]`)
      break
    case "column":
      el =
        q(`[data-cms-idx="${ref.i}"] [data-col="${ref.col.join("-")}"]`) ??
        q(`[data-cms-idx="${ref.i}"]`)
      break
    case "widget":
      el = q(`[data-cms-idx="${ref.i}"] [data-w="w-${ref.path.join("-")}"]`)
      break
    case "element":
      el = q(`[data-cms-idx="${ref.i}"] [data-el="${ref.el}"]`)
      break
    case "chrome":
      el = q(`[data-cms-chrome="${ref.region}"]`)
      break
    case "chromeEl":
      el = q(`[data-cms-chrome="${ref.region}"] [data-el="${ref.el}"]`)
      break
    /* 5C — stage anchors: 5A's stable data markers (slider-html). Ids are
     * sanitized to [a-zA-Z0-9_-] by the renderer, selector-safe as-is. */
    case "sliderSlide":
      el = q(`[data-cms-idx="${ref.i}"] [data-slide="${ref.slideId}"]`)
      break
    case "sliderLayer":
      el = q(
        `[data-cms-idx="${ref.i}"] [data-slide="${ref.slideId}"] [data-layer="${ref.layerId}"]`
      )
      break
  }
  if (!el) return null
  // display:contents wrappers have no box — measure the tallest real child.
  if (getComputedStyle(el).display === "contents") {
    let best: HTMLElement | null = el.firstElementChild as HTMLElement | null
    let bestH = best ? best.getBoundingClientRect().height : 0
    for (const child of Array.from(el.children)) {
      if (child.tagName === "STYLE") continue
      const h = child.getBoundingClientRect().height
      if (h > bestH) {
        bestH = h
        best = child as HTMLElement
      }
    }
    return best ?? el
  }
  return el
}

/* ---------------- dot-path staging (server set -> bus set) ----------- */

const clone = <T,>(v: T): T =>
  v == null || typeof v !== "object" ? v : (JSON.parse(JSON.stringify(v)) as T)

/**
 * Turn the server's CHANGED-PATHS map into the shallow top-level
 * {set, before} the bus `ai.apply` merges (ARCH-AI §4.1): every affected
 * ROOT key is cloned from the CURRENT node, the dot paths are applied
 * inside the clone, and `before` carries the current root values — so
 * Discard/undo restores exactly what the merge replaced. Returns null
 * when a path no longer resolves (stale node).
 */
export function stageFromDotSet(
  host: Record<string, unknown>,
  dotSet: Record<string, unknown>
): { set: Record<string, unknown>; before: Record<string, unknown> } | null {
  const set: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(dotSet)) {
    const segs = path.split(".")
    const root = segs[0]
    if (!root || root === "__proto__" || root === "constructor" || root === "prototype") {
      return null
    }
    if (!(root in set)) {
      before[root] = host[root]
      set[root] = segs.length === 1 ? undefined : clone(host[root])
    }
    if (segs.length === 1) {
      set[root] = value
      continue
    }
    let cur: unknown = set[root]
    for (let k = 1; k < segs.length - 1; k++) {
      const s = segs[k]
      if (s === "__proto__" || s === "constructor" || s === "prototype") return null
      if (Array.isArray(cur)) {
        const idx = Number(s)
        if (!Number.isInteger(idx) || !(idx in cur)) return null
        cur = cur[idx]
      } else if (cur && typeof cur === "object") {
        if (!(s in (cur as Record<string, unknown>))) return null
        cur = (cur as Record<string, unknown>)[s]
      } else {
        return null
      }
    }
    const last = segs[segs.length - 1]
    if (last === "__proto__" || last === "constructor" || last === "prototype") return null
    if (Array.isArray(cur)) {
      const idx = Number(last)
      if (!Number.isInteger(idx) || idx < 0 || idx > cur.length) return null
      cur[idx] = value
    } else if (cur && typeof cur === "object") {
      ;(cur as Record<string, unknown>)[last] = value
    } else {
      return null
    }
  }
  return Object.keys(set).length ? { set, before } : null
}
