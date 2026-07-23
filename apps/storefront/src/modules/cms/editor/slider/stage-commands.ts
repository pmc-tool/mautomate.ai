/* ------------------------------------------------------------------ */
/* Slider stage — pure document operations (Phase 5B, ARCH-SLIDER §3.3) */
/*                                                                      */
/* The bodies of every `slider.*` registry command. All pure, all       */
/* immutable, all returning the next content array or null (guarded     */
/* no-op — nothing applied, nothing recorded), exactly the registry's   */
/* run() contract.                                                      */
/*                                                                      */
/* HOST LOCATION: a hero_slider lives in one of three shapes — a flat   */
/* legacy section (block_type: "hero_slider"), the Phase-1 facade       */
/* (flush 1-col container holding the widget), or a widget anywhere in  */
/* a container's column tree (§2.1's in-column case). One walker finds  */
/* the FIRST hero_slider host in a section and rewrites it immutably.   */
/* Slide/layer edits never change the top-level widget COUNT, so a      */
/* facade's `flush` collapse marker is untouched by construction (the   */
/* runItemAction precedent — content-class writes).                     */
/*                                                                      */
/* TARGETING is by id, never index (ARCH-SLIDER §3.3): filmstrip or     */
/* rail reorders can never invalidate a queued command or a selection.  */
/* ------------------------------------------------------------------ */

import {
  isLayeredSlide,
  upgradeFieldsSlide,
  type FieldsSlide,
  type LayerFrame,
  type LayeredSlide,
  type SlideBackground,
  type SliderAnchor,
  type SliderLayer,
  type SliderPlacement,
} from "./model-5a"
import type { Device } from "@modules/cms/schema/types"

type Section = { block_type: string; [k: string]: unknown }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/* --------------------------- host walking --------------------------- */

/** The first hero_slider host object in a section: the section itself
 *  (flat legacy shape) or a widget in the column tree (facade included —
 *  a facade is just a 1-col container). Null when the section has none. */
export function readSliderHost(
  content: Section[] | null | undefined,
  index: number
): Record<string, unknown> | null {
  const sec = content?.[index]
  if (!isObj(sec)) return null
  if (sec.block_type === "hero_slider") return sec
  return findInColumns(sec.columns)
}

function findInColumns(cols: unknown): Record<string, unknown> | null {
  if (!Array.isArray(cols)) return null
  for (const col of cols) {
    if (!isObj(col)) continue
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    for (const w of ws) {
      if (!isObj(w)) continue
      if (w.widget_type === "hero_slider") return w
      if (w.widget_type === "inner_section") {
        const hit = findInColumns(w.columns)
        if (hit) return hit
      }
    }
  }
  return null
}

/** Immutably replace the located host: `fn` maps the host object to its
 *  next value (null = guarded no-op). Returns the next content or null. */
export function mapSliderHost(
  content: Section[],
  index: number,
  fn: (host: Record<string, unknown>) => Record<string, unknown> | null
): Section[] | null {
  const sec = content?.[index]
  if (!isObj(sec)) return null
  if (sec.block_type === "hero_slider") {
    const next = fn(sec)
    return next ? content.map((b, i) => (i === index ? (next as Section) : b)) : null
  }
  const nextCols = mapColumns(sec.columns, fn)
  if (!nextCols) return null
  return content.map((b, i) =>
    i === index ? ({ ...sec, columns: nextCols } as Section) : b
  )
}

function mapColumns(
  cols: unknown,
  fn: (host: Record<string, unknown>) => Record<string, unknown> | null
): unknown[] | null {
  if (!Array.isArray(cols)) return null
  for (let ci = 0; ci < cols.length; ci++) {
    const col = cols[ci]
    if (!isObj(col)) continue
    const ws = Array.isArray(col.widgets) ? col.widgets : []
    for (let wi = 0; wi < ws.length; wi++) {
      const w = ws[wi]
      if (!isObj(w)) continue
      if (w.widget_type === "hero_slider") {
        const next = fn(w)
        if (!next) return null
        return cols.map((c, i) =>
          i === ci
            ? { ...col, widgets: ws.map((x, j) => (j === wi ? next : x)) }
            : c
        )
      }
      if (w.widget_type === "inner_section") {
        const inner = mapColumns(w.columns, fn)
        if (inner) {
          return cols.map((c, i) =>
            i === ci
              ? {
                  ...col,
                  widgets: ws.map((x, j) =>
                    j === wi ? { ...w, columns: inner } : x
                  ),
                }
              : c
          )
        }
      }
    }
  }
  return null
}

/* ---------------------------- read helpers --------------------------- */

export function slidesOfHost(host: Record<string, unknown> | null): unknown[] {
  return host && Array.isArray(host.slides) ? (host.slides as unknown[]) : []
}

export function findSlide(
  host: Record<string, unknown> | null,
  slideId: string
): LayeredSlide | null {
  const s = slidesOfHost(host).find(
    (v) => isLayeredSlide(v) && v.id === slideId
  )
  return (s as LayeredSlide | undefined) ?? null
}

export function findLayer(
  slide: LayeredSlide | null,
  layerId: string
): SliderLayer | null {
  return slide?.layers.find((l) => l.id === layerId) ?? null
}

/** "layered" when any slide carries layers, "fields" when the section
 *  hosts a hero_slider still in the sealed fields shape, null otherwise. */
export function sliderKindOf(
  content: Section[] | null | undefined,
  index: number
): "layered" | "fields" | null {
  const host = readSliderHost(content, index)
  if (!host) return null
  const slides = slidesOfHost(host)
  if (!slides.length) return null
  return slides.some(isLayeredSlide) ? "layered" : "fields"
}

/* --------------------------- write plumbing --------------------------- */

/** Replace one layered slide (by id) inside the host's slides array. */
function mapSlide(
  content: Section[],
  index: number,
  slideId: string,
  fn: (slide: LayeredSlide) => LayeredSlide | null
): Section[] | null {
  return mapSliderHost(content, index, (host) => {
    const slides = slidesOfHost(host)
    const si = slides.findIndex((v) => isLayeredSlide(v) && v.id === slideId)
    if (si < 0) return null
    const next = fn(slides[si] as LayeredSlide)
    if (!next) return null
    return { ...host, slides: slides.map((v, i) => (i === si ? next : v)) }
  })
}

function mapLayer(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  fn: (layer: SliderLayer, li: number, slide: LayeredSlide) => SliderLayer | null
): Section[] | null {
  return mapSlide(content, index, slideId, (slide) => {
    const li = slide.layers.findIndex((l) => l.id === layerId)
    if (li < 0) return null
    const next = fn(slide.layers[li], li, slide)
    if (!next) return null
    return {
      ...slide,
      layers: slide.layers.map((l, i) => (i === li ? next : l)),
    }
  })
}

const VALID_ANCHORS: readonly SliderAnchor[] = [
  "tl",
  "tc",
  "tr",
  "cl",
  "cc",
  "cr",
  "bl",
  "bc",
  "br",
]

const isDim = (v: unknown): v is number | "auto" =>
  v === "auto" || (typeof v === "number" && Number.isFinite(v))

export function isLayerFrame(v: unknown): v is LayerFrame {
  return (
    isObj(v) &&
    VALID_ANCHORS.includes(v.anchor as SliderAnchor) &&
    typeof v.x === "number" &&
    Number.isFinite(v.x) &&
    typeof v.y === "number" &&
    Number.isFinite(v.y) &&
    isDim(v.w) &&
    isDim(v.h)
  )
}

/* ------------------------------ slide ops ----------------------------- */

export function slideAdd(
  content: Section[],
  index: number,
  slide: unknown,
  at?: number
): Section[] | null {
  if (!isLayeredSlide(slide)) return null
  return mapSliderHost(content, index, (host) => {
    const slides = slidesOfHost(host)
    if (slides.some((v) => isObj(v) && (v as { id?: unknown }).id === slide.id)) {
      return null // id collision — refuse rather than corrupt targeting
    }
    const i =
      at == null ? slides.length : Math.max(0, Math.min(at, slides.length))
    return {
      ...host,
      slides: [
        ...slides.slice(0, i),
        structuredClone(slide),
        ...slides.slice(i),
      ],
    }
  })
}

/** Clone after the source. Layer ids are KEPT (commands address the
 *  (slideId, layerId) pair, unique by construction); the slide id must be
 *  new and is computed at DISPATCH time (`newId`) so redo replays
 *  deterministically and the shell can select the clone. */
export function slideDuplicate(
  content: Section[],
  index: number,
  slideId: string,
  newId: string
): Section[] | null {
  if (typeof newId !== "string" || !newId) return null
  return mapSliderHost(content, index, (host) => {
    const slides = slidesOfHost(host)
    const si = slides.findIndex((v) => isLayeredSlide(v) && v.id === slideId)
    if (si < 0) return null
    if (slides.some((v) => isObj(v) && (v as { id?: unknown }).id === newId)) {
      return null
    }
    const clone = structuredClone(slides[si]) as LayeredSlide
    clone.id = newId
    return {
      ...host,
      slides: [...slides.slice(0, si + 1), clone, ...slides.slice(si + 1)],
    }
  })
}

/** Last-slide delete is refused (delete the section instead — the
 *  item.remove precedent). */
export function slideRemove(
  content: Section[],
  index: number,
  slideId: string
): Section[] | null {
  return mapSliderHost(content, index, (host) => {
    const slides = slidesOfHost(host)
    if (slides.length <= 1) return null
    const si = slides.findIndex((v) => isLayeredSlide(v) && v.id === slideId)
    if (si < 0) return null
    return { ...host, slides: slides.filter((_, i) => i !== si) }
  })
}

export function slideReorder(
  content: Section[],
  index: number,
  slideId: string,
  to: number
): Section[] | null {
  return mapSliderHost(content, index, (host) => {
    const slides = slidesOfHost(host)
    const from = slides.findIndex((v) => isLayeredSlide(v) && v.id === slideId)
    if (from < 0) return null
    const dest = Math.max(0, Math.min(to, slides.length - 1))
    if (dest === from) return null
    const next = slides.slice()
    const [moved] = next.splice(from, 1)
    next.splice(dest, 0, moved)
    return { ...host, slides: next }
  })
}

export function slideSetBackground(
  content: Section[],
  index: number,
  slideId: string,
  background: unknown
): Section[] | null {
  if (!isObj(background)) return null
  return mapSlide(content, index, slideId, (slide) => ({
    ...slide,
    background: structuredClone(background) as unknown as SlideBackground,
  }))
}

/** Slide-level scalars only (rename / autoplay override / click-through).
 *  Whitelisted so a stray payload can never smuggle `layers` or `id`. */
export function slideSetProps(
  content: Section[],
  index: number,
  slideId: string,
  props: unknown
): Section[] | null {
  if (!isObj(props)) return null
  return mapSlide(content, index, slideId, (slide) => {
    const next: LayeredSlide = { ...slide }
    let touched = false
    if ("name" in props) {
      const v = props.name
      if (typeof v === "string" && v.trim()) next.name = v
      else delete next.name
      touched = true
    }
    if ("duration_ms" in props) {
      const v = props.duration_ms
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        next.duration_ms = v
      } else delete next.duration_ms
      touched = true
    }
    if ("link" in props) {
      const v = props.link
      if (typeof v === "string" && v) next.link = v
      else delete next.link
      touched = true
    }
    return touched ? next : null
  })
}

/* ------------------------------ layer ops ----------------------------- */

export function layerAdd(
  content: Section[],
  index: number,
  slideId: string,
  layer: unknown,
  at?: number
): Section[] | null {
  if (
    !isObj(layer) ||
    typeof layer.id !== "string" ||
    !layer.id ||
    !isObj(layer.frame) ||
    !isLayerFrame((layer.frame as { base?: unknown }).base)
  ) {
    return null
  }
  return mapSlide(content, index, slideId, (slide) => {
    if (slide.layers.some((l) => l.id === layer.id)) return null
    const i =
      at == null
        ? slide.layers.length
        : Math.max(0, Math.min(at, slide.layers.length))
    const next = slide.layers.slice()
    next.splice(i, 0, structuredClone(layer) as unknown as SliderLayer)
    return { ...slide, layers: next }
  })
}

export function layerRemove(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string
): Section[] | null {
  return mapSlide(content, index, slideId, (slide) => {
    if (!slide.layers.some((l) => l.id === layerId)) return null
    return { ...slide, layers: slide.layers.filter((l) => l.id !== layerId) }
  })
}

export function layerDuplicate(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  newId: string
): Section[] | null {
  if (typeof newId !== "string" || !newId) return null
  return mapSlide(content, index, slideId, (slide) => {
    const li = slide.layers.findIndex((l) => l.id === layerId)
    if (li < 0 || slide.layers.some((l) => l.id === newId)) return null
    const clone = structuredClone(slide.layers[li])
    clone.id = newId
    // Nudge the clone 2% down-right so it is visibly a second object.
    const base = clone.frame?.base
    if (base && isLayerFrame(base)) {
      clone.frame = { ...clone.frame, base: { ...base, x: base.x + 2, y: base.y + 2 } }
    }
    const next = slide.layers.slice()
    next.splice(li + 1, 0, clone)
    return { ...slide, layers: next }
  })
}

/** Restack: array order IS paint order (§1.3 — no stored z-index). */
export function layerReorder(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  to: number
): Section[] | null {
  return mapSlide(content, index, slideId, (slide) => {
    const from = slide.layers.findIndex((l) => l.id === layerId)
    if (from < 0) return null
    const dest = Math.max(0, Math.min(to, slide.layers.length - 1))
    if (dest === from) return null
    const next = slide.layers.slice()
    const [moved] = next.splice(from, 1)
    next.splice(dest, 0, moved)
    return { ...slide, layers: next }
  })
}

/** One drag/resize/nudge gesture = ONE frame write for ONE device.
 *  desktop → `frame.base`; tablet/mobile → the override slot (the whole
 *  frame is one responsive leaf — §1.3's atomic-per-device rule). */
export function layerSetFrame(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  device: Device,
  frame: unknown
): Section[] | null {
  const clear = frame == null
  if (!clear && !isLayerFrame(frame)) return null
  return mapLayer(content, index, slideId, layerId, (layer) => {
    const rv = { ...(layer.frame ?? {}) } as Record<string, unknown>
    if (device === "desktop") {
      if (clear) return null // base frame is mandatory — never cleared
      rv.base = { ...(frame as LayerFrame) }
    } else if (clear) {
      if (!(device in rv)) return null
      delete rv[device]
    } else {
      rv[device] = { ...(frame as LayerFrame) }
    }
    return { ...layer, frame: rv as SliderLayer["frame"] }
  })
}

/** Layer content + identity: `props` merges onto layer.props; `name`
 *  and `hidden` write the layer-level fields. Empty-string name and
 *  all-false hidden delete their keys (diff-only, the bag discipline). */
export function layerSetProps(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  args: { props?: unknown; name?: unknown; hidden?: unknown }
): Section[] | null {
  const hasProps = isObj(args.props)
  const hasName = "name" in args && args.name !== undefined
  const hasHidden = "hidden" in args && args.hidden !== undefined
  if (!hasProps && !hasName && !hasHidden) return null
  return mapLayer(content, index, slideId, layerId, (layer) => {
    const next: SliderLayer = { ...layer }
    if (hasProps) {
      next.props = {
        ...layer.props,
        ...structuredClone(args.props as Record<string, unknown>),
      }
    }
    if (hasName) {
      const v = args.name
      if (typeof v === "string" && v.trim()) next.name = v
      else delete next.name
    }
    if (hasHidden) {
      const h = isObj(args.hidden) ? args.hidden : {}
      const bag: { tablet?: boolean; mobile?: boolean } = {}
      if (h.tablet === true) bag.tablet = true
      if (h.mobile === true) bag.mobile = true
      if (Object.keys(bag).length) next.hidden = bag
      else delete next.hidden
    }
    return next
  })
}

/** Layer appearance bags — the section/widget setBags semantics verbatim:
 *  undefined leaves a bag untouched, {} deletes the key. */
export function layerSetBags(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  bags: { style?: Record<string, unknown>; advanced?: Record<string, unknown> }
): Section[] | null {
  if (!isObj(bags)) return null
  if (bags.style === undefined && bags.advanced === undefined) return null
  return mapLayer(content, index, slideId, layerId, (layer) => {
    const next: SliderLayer = { ...layer }
    for (const k of ["style", "advanced"] as const) {
      const v = bags[k]
      if (v === undefined) continue
      if (v && Object.keys(v).length > 0) next[k] = structuredClone(v)
      else delete next[k]
    }
    return next
  })
}

/** One entrance, a delay, a duration (§4 — the whole animation model).
 *  null / "none" with defaults deletes the key. */
export function layerSetAnim(
  content: Section[],
  index: number,
  slideId: string,
  layerId: string,
  anim: unknown
): Section[] | null {
  return mapLayer(content, index, slideId, layerId, (layer) => {
    const next: SliderLayer = { ...layer }
    if (!isObj(anim) || anim.preset === "none" || anim.preset == null) {
      if (!("anim" in layer)) return null
      delete next.anim
      return next
    }
    next.anim = {
      preset: String(anim.preset),
      delay_ms: Math.max(
        0,
        Math.min(4000, Number(anim.delay_ms) || 0)
      ),
      duration_ms: Math.max(0, Number(anim.duration_ms) || 600),
      ...(anim.ease ? { ease: anim.ease } : {}),
    } as SliderLayer["anim"]
    return next
  })
}

/* ---------------------------- §5 upgrade ------------------------------ */

/**
 * Fields → layered upgrade of EVERY still-fields slide (already-layered
 * slides pass through untouched, so mixed sliders converge). Runs seat
 * 5A's pure upgrade fn with the slide's INDEX, so ids are `up-<i>` — the
 * SAME convention the renderer uses when it upgrades leftover fields
 * slides at render time (5A-NOTES §3): an editor commit and its render
 * preview carry identical ids. `idSeed` stays on the wire as the
 * command's replay token (validated non-empty for envelope stability)
 * but no longer feeds the ids; redo is byte-deterministic because both
 * the index and the optional theme `placement` hint ride the args.
 */
export function upgradeSlides(
  content: Section[],
  index: number,
  idSeed: string,
  placement?: SliderPlacement
): Section[] | null {
  if (typeof idSeed !== "string" || !idSeed) return null
  return mapSliderHost(content, index, (host) => {
    const slides = slidesOfHost(host)
    if (!slides.length) return null
    let changed = false
    const next = slides.map((s, i) => {
      if (isLayeredSlide(s) || !isObj(s)) return s
      changed = true
      return upgradeFieldsSlide(s as FieldsSlide, { index: i, placement })
    })
    return changed ? { ...host, slides: next } : null
  })
}
