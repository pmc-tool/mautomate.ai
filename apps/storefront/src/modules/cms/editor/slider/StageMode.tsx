"use client"

/* ------------------------------------------------------------------ */
/* Slider stage — the takeover (Phase 5B, ARCH-SLIDER §3)               */
/*                                                                      */
/* Mounted by the editor CANVAS route only (never the live storefront,  */
/* never preview mode — the mount site guards both). The canvas         */
/* scroll-locks to the slider section, everything else dims under a     */
/* scrim, and the stage chrome mounts: filmstrip (top), layer rail      */
/* (left), and the on-slide overlay — drag to position, 8-point resize, */
/* snap guides + center lines, anchor inference on drop. Esc exits.     */
/*                                                                      */
/* EVERY GESTURE = ONE COMMAND (§3.3): drags are transient local state; */
/* pointerup commits a single id-targeted slider.* envelope through     */
/* postCommandToShell, so undo granularity is one gesture and the       */
/* shell's history/autosave/revisions need zero new plumbing.           */
/*                                                                      */
/* WYSIWYG source: the stage overlays the RENDERED slide — it reads     */
/* seat 5A's [data-slide]/[data-layer] markers (slider-html's stable    */
/* data markers, §2.1) for real geometry; the platform renderer paints  */
/* beneath in the canvas (liquid-canvas, editor:true). The ghost        */
/* fallback below survives only as a degraded path for a slide the      */
/* renderer refused (e.g. all layers sanitized away); the switch is     */
/* automatic (marker found → marker rect).                              */
/* ------------------------------------------------------------------ */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { sanitizeHtml } from "@lib/util/sanitize-html"
import { resolveResponsive, type Device } from "@modules/cms/schema/types"
import { postCommandToShell, postToShell } from "@modules/cms/editor/canvas/protocol"
import type { CommandName } from "@modules/cms/editor/commands/registry"
import { accent, font, ink, radius, zLayer, zAbove } from "@modules/cms/editor/design"
import {
  defaultLayerOf,
  defaultSlide,
  isLayeredSlide,
  newSliderId,
  layerDisplayName,
  type LayerFrame,
  type LayeredSlide,
  type SliderLayer,
  type SliderLayerType,
} from "./model-5a"
import { readSliderHost, slidesOfHost } from "./stage-commands"
import {
  ALL_HANDLES,
  SIDE_HANDLES,
  applyResize,
  frameToRect,
  handleCursor,
  inferAnchor,
  nudgeFrame,
  rectToFrame,
  snapRect,
  type Guide,
  type HandleId,
  type Rect,
} from "./stage-interactions"
import Filmstrip, { FILMSTRIP_H } from "./Filmstrip"
import LayerRail, { RAIL_W } from "./LayerRail"

type Section = { block_type: string; [k: string]: unknown }

export type StageSel = { slideId: string | null; layerId: string | null }

const SCRIM = "rgba(8, 10, 14, 0.62)"

type DragState = {
  layerId: string
  mode: "move" | HandleId
  sx: number
  sy: number
  startRect: Rect
  frame: LayerFrame
  moved: boolean
  alt: boolean
}

export default function StageMode({
  index,
  content,
  device: canvasDevice,
  sel,
  onSelectSlide,
  onSelectLayer,
  onExit,
  externalChrome = false,
  lockedIds,
}: {
  index: number
  content: Section[]
  /** The page editor's device. Seeds the stage; the stage then owns its
   *  OWN device (ARCH-SLIDER §3.4 — RevSlider's editor is its own
   *  responsive world; the page header's buttons do not drive it). */
  device: Device
  sel: StageSel
  onSelectSlide: (slideId: string) => void
  onSelectLayer: (layerId: string | null) => void
  onExit: () => void
  /** 7A — the SHELL is drawing the stage chrome (top toolbar / right
   *  LAYER OPTIONS sidebar / bottom layer list) outside this iframe, so
   *  the in-canvas filmstrip + layer rail must stand down and the whole
   *  iframe becomes the slide's working area. A GATE, not a delete: with
   *  the default `false` this component still renders its own chrome, so
   *  a stage mounted without the 7A shell is unchanged. */
  externalChrome?: boolean
  /** 7A — session lock set owned by the shell's bottom layer list. When
   *  supplied it REPLACES the internal (rail-driven) set, so the padlock
   *  the user sees in the shell is the one this overlay enforces. Never
   *  document state: locks are a workbench affordance, not content. */
  lockedIds?: readonly string[]
}) {
  /* --- stage-owned responsive device (the RevSlider model) -----------
     The stage edits ONE device's frames at a time and switches with its
     own control; the page header's device buttons are hidden while the
     stage is up. Seeded from the page editor, then independent. */
  const [device, setDevice] = useState<Device>(canvasDevice)
  useEffect(() => {
    setDevice(canvasDevice)
  }, [canvasDevice])
  /* The device the PAGE was on when the stage opened — restored on exit so
     leaving the stage does not strand the editor in a phone viewport. */
  const entryDeviceRef = useRef<Device>(canvasDevice)
  /* Switching the stage device resizes the canvas iframe (shell-side), which
     is what makes the preview real: the slider's per-device frames and
     visibility are @media rules keyed on the VIEWPORT (slider-css.ts), so
     only a genuinely narrow viewport renders the mobile art direction. */
  const changeDevice = useCallback((d: Device) => {
    setDevice(d)
    postToShell({ type: "cms:stageDevice", device: d })
  }, [])
  useEffect(() => {
    const entry = entryDeviceRef.current
    return () => {
      postToShell({ type: "cms:stageDevice", device: entry })
    }
  }, [])

  /* ------------------------------ model ------------------------------ */

  const host = readSliderHost(content, index)
  const rawSlides = slidesOfHost(host)
  const layered = useMemo(
    () => rawSlides.filter(isLayeredSlide) as LayeredSlide[],
    [rawSlides]
  )
  const fieldsCount = rawSlides.length - layered.length
  const activeSlide =
    layered.find((s) => s.id === sel.slideId) ?? layered[0] ?? null

  /* The section (and its layered slides) can vanish under the stage —
     undo of the upgrade, section delete from the History panel. Exit. */
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  useEffect(() => {
    if (!activeSlide) onExitRef.current()
  }, [activeSlide])

  /* Keep the shell's slide selection honest when the active id drifts. */
  const onSelectSlideRef = useRef(onSelectSlide)
  onSelectSlideRef.current = onSelectSlide
  useEffect(() => {
    if (activeSlide && sel.slideId !== activeSlide.id) {
      onSelectSlideRef.current(activeSlide.id)
    }
  }, [activeSlide, sel.slideId])

  /* --------------------------- measurement --------------------------- */

  const [stageRect, setStageRect] = useState<Rect | null>(null)
  const [fallbackSurface, setFallbackSurface] = useState(false)
  const [tick, setTick] = useState(0)

  /* 7A: with the shell owning the chrome there is no in-iframe rail or
     filmstrip to dodge — the iframe IS the centre region the shell sized,
     so the slide gets the whole box back (this is what un-boxes the stage
     and lets the mobile 390px frame work at all). */
  const railVisible =
    !externalChrome &&
    (typeof window !== "undefined" ? window.innerWidth >= 900 : true)
  const railW = railVisible ? RAIL_W : 0
  const topInset = externalChrome ? 0 : FILMSTRIP_H

  useEffect(() => {
    if (!activeSlide) return
    let raf = 0
    const measure = () => {
      const sectionEl = document.querySelector(`[data-cms-idx="${index}"]`)
      const slideEl = sectionEl?.querySelector(
        `[data-slide="${cssEscape(activeSlide.id)}"]`
      )
      const target =
        (slideEl as HTMLElement | null) ?? firstBox(sectionEl as HTMLElement | null)
      const r = target?.getBoundingClientRect()
      if (r && r.width > 160 && r.height > 80) {
        setFallbackSurface(!slideEl)
        // Bring the slide into the working area under the filmstrip.
        const top = topInset + 24
        if (Math.abs(r.top - top) > 4 && document.documentElement.scrollHeight >
            window.innerHeight) {
          window.scrollTo({ top: window.scrollY + r.top - top })
        }
        const r2 = target!.getBoundingClientRect()
        setStageRect(rectIfChanged({
          left: r2.left,
          top: r2.top,
          width: r2.width,
          height: r2.height,
        }))
      } else {
        /* Degraded path: no measurable platform markup beneath (renderer
           refused the slide / section hidden) — stage a centered surface
           so slides can be art-directed anyway. */
        setFallbackSurface(true)
        const availL = railW + 32
        const availT = topInset + 32
        const availW = Math.max(320, window.innerWidth - availL - 32)
        const availH = Math.max(240, window.innerHeight - availT - 32)
        const aspect = device === "mobile" ? 4 / 5 : 16 / 7
        let w = availW
        let h = w / aspect
        if (h > availH) {
          h = availH
          w = h * aspect
        }
        setStageRect(rectIfChanged({
          left: availL + (availW - w) / 2,
          top: availT + (availH - h) / 2,
          width: w,
          height: h,
        }))
      }
    }
    raf = requestAnimationFrame(measure)
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener("resize", onResize)
    /* 6C (P0 fix) — "(rendered slide unavailable)" on a just-upgraded
       fields hero. The canvas re-renders a section's themed HTML
       ASYNCHRONOUSLY after slider.upgradeSlide commits, so on stage entry
       this measure ran ONCE against the pre-upgrade markup: no
       [data-slide] node yet → fallbackSurface stuck true and the stage
       showed the layout-preview ghost even after the real rendered slide
       landed. Nothing in the dep list changes when the section's inner
       DOM is swapped in (content updated BEFORE entry), so watch the DOM
       itself: re-measure (rAF-coalesced) when the section's subtree
       changes. childList-only on purpose — the 5C entrance replay toggles
       ffs-js/ffs-in CLASSES on these nodes, and observing attributes
       would loop it. rectIfChanged keeps the frequent no-op mutations
       (overlay chips etc.) from re-rendering the stage. */
    const sectionEl = document.querySelector(`[data-cms-idx="${index}"]`)
    let mo: MutationObserver | null = null
    if (sectionEl) {
      mo = new MutationObserver(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(measure)
      })
      mo.observe(sectionEl, { childList: true, subtree: true })
    }
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      mo?.disconnect()
    }
  }, [index, content, device, activeSlide, tick, railW, topInset])

  /* Scroll lock while staged (§3.1 — the takeover). */
  useEffect(() => {
    const de = document.documentElement
    const prev = de.style.overflow
    de.style.overflow = "hidden"
    return () => {
      de.style.overflow = prev
    }
  }, [])

  /* 5C — preview-entrance replay on slide switch (EDITOR-ONLY). The
     editor render has no runtime, so the stage plays the runtime's part:
     add `ffs-js` to the root (arming SLIDER_ENTRANCE_CSS's hidden state),
     clear `ffs-in`, then stamp it per layer after its data-ffs-delay —
     exactly public/ffslider.js's contract. Cleanup disarms `ffs-js` and
     restores `ffs-in` so nothing on the canvas is ever left hidden; a
     content re-render rebuilds the DOM without the classes anyway (the
     no-JS-never-hides discipline holds in the editor too). */
  useEffect(() => {
    if (!activeSlide || fallbackSurface) return
    const root = document.querySelector<HTMLElement>(
      `[data-cms-idx="${index}"] .ffs`
    )
    const slideEl = root?.querySelector<HTMLElement>(
      `[data-slide="${cssEscape(activeSlide.id)}"]`
    )
    if (!root || !slideEl) return
    const layers = Array.from(
      slideEl.querySelectorAll<HTMLElement>("[data-ffs-anim]")
    )
    if (!layers.length) return
    root.classList.add("ffs-js")
    layers.forEach((el) => el.classList.remove("ffs-in"))
    // Reflow so the cleared state paints before the entrances re-stamp.
    void slideEl.offsetWidth
    const timers = layers.map((el) => {
      const delay = Math.max(0, Number(el.getAttribute("data-ffs-delay")) || 0)
      return window.setTimeout(() => el.classList.add("ffs-in"), delay + 40)
    })
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      layers.forEach((el) => el.classList.add("ffs-in"))
      root.classList.remove("ffs-js")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, activeSlide?.id, fallbackSurface])

  /* ----------------------- transient interaction --------------------- */

  const [transient, setTransient] = useState<{ layerId: string; rect: Rect } | null>(null)
  const transientRef = useRef<{ layerId: string; rect: Rect } | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [railLocked, setLocked] = useState<ReadonlySet<string>>(new Set())
  /* 7A: shell-owned locks win when the shell drives the chrome; the rail's
     own set survives for the in-canvas path. */
  const locked = useMemo<ReadonlySet<string>>(
    () => (lockedIds ? new Set(lockedIds) : railLocked),
    [lockedIds, railLocked]
  )
  const dragRef = useRef<DragState | null>(null)

  const W = stageRect?.width ?? 0
  const H = stageRect?.height ?? 0

  const resolvedFrame = useCallback(
    (l: SliderLayer): LayerFrame =>
      resolveResponsive<LayerFrame>(l.frame, device) ??
      ({ anchor: "cc", x: 0, y: 0, w: "auto", h: "auto" } as LayerFrame),
    [device]
  )

  /** A layer's current rect (stage-relative): rendered marker if the
   *  platform markup is beneath, else computed from the model frame. */
  const rectOf = useCallback(
    (l: SliderLayer): Rect => {
      if (stageRect && activeSlide) {
        const el = document.querySelector(
          `[data-cms-idx="${index}"] [data-slide="${cssEscape(activeSlide.id)}"] [data-layer="${cssEscape(l.id)}"]`
        )
        const r = el?.getBoundingClientRect()
        if (r && (r.width > 0 || r.height > 0)) {
          return {
            left: r.left - stageRect.left,
            top: r.top - stageRect.top,
            width: r.width,
            height: r.height,
          }
        }
      }
      return frameToRect(resolvedFrame(l), W, H)
    },
    [index, activeSlide, stageRect, W, H, resolvedFrame]
  )

  const dispatchFrame = useCallback(
    (layerId: string, frame: LayerFrame, txn?: string) => {
      if (!activeSlide) return
      postCommandToShell({
        name: "slider.setLayerFrame",
        args: { index, slideId: activeSlide.id, layerId, device, frame },
        ...(txn ? { txn } : {}),
      })
    },
    [index, activeSlide, device]
  )

  const beginDrag = (
    e: React.PointerEvent,
    l: SliderLayer,
    mode: DragState["mode"]
  ) => {
    if (!stageRect) return
    onSelectLayer(l.id)
    if (locked.has(l.id)) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      layerId: l.id,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      startRect: rectOf(l),
      frame: resolvedFrame(l),
      moved: false,
      alt: e.altKey,
    }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d || !activeSlide) return
      const dx = ev.clientX - d.sx
      const dy = ev.clientY - d.sy
      if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return
      d.moved = true
      d.alt = ev.altKey
      let rect: Rect
      let g: Guide[] = []
      if (d.mode === "move") {
        const raw = {
          ...d.startRect,
          left: d.startRect.left + dx,
          top: d.startRect.top + dy,
        }
        const others = activeSlide.layers
          .filter((x) => x.id !== d.layerId)
          .map(rectOf)
        const snapped = snapRect(raw, W, H, others, { disabled: ev.altKey })
        rect = snapped.rect
        g = snapped.guides
      } else {
        rect = applyResize(d.startRect, d.mode, dx, dy)
      }
      transientRef.current = { layerId: d.layerId, rect }
      setTransient(transientRef.current)
      setGuides(g)
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      const d = dragRef.current
      const t = transientRef.current
      dragRef.current = null
      transientRef.current = null
      setGuides([])
      setTransient(null)
      if (!d) return
      if (d.moved && t && t.layerId === d.layerId && W > 0 && H > 0) {
        const cur = d.frame
        if (d.mode === "move") {
          const anchor = inferAnchor(t.rect, W, H)
          dispatchFrame(
            d.layerId,
            rectToFrame(t.rect, W, H, anchor, {
              w: cur.w === "auto",
              h: cur.h === "auto",
            })
          )
        } else {
          const affectsW = d.mode.includes("e") || d.mode.includes("w")
          const affectsH = d.mode.includes("n") || d.mode.includes("s")
          dispatchFrame(
            d.layerId,
            rectToFrame(t.rect, W, H, cur.anchor, {
              w: cur.w === "auto" && !affectsW,
              h: cur.h === "auto" && !affectsH,
            })
          )
        }
      }
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
  }

  /* ----------------------------- keyboard ----------------------------- */

  const kbRef = useRef({
    sel,
    activeSlide,
    device,
    W,
    H,
    locked,
    resolvedFrame,
    dispatchFrame,
    onExit,
    onSelectLayer,
    index,
  })
  kbRef.current = {
    sel,
    activeSlide,
    device,
    W,
    H,
    locked,
    resolvedFrame,
    dispatchFrame,
    onExit,
    onSelectLayer,
    index,
  }
  const nudgeTxnRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> | null }>({
    id: "",
    timer: null,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = kbRef.current
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return
      }
      /* The stage owns the keyboard while mounted: stop the canvas's own
         window handlers (delete-section, clipboard, palette keys) from
         double-acting on the same press. Capture phase beats them. */
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (dragRef.current) {
          dragRef.current = null
          setTransient(null)
          setGuides([])
        } else {
          k.onExit()
        }
        return
      }
      const layer =
        k.activeSlide?.layers.find((l) => l.id === k.sel.layerId) ?? null
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      if (e.key in arrows) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (!layer || k.locked.has(layer.id) || !k.W || !k.H) return
        const mult = e.shiftKey ? 10 : 1
        const [dx, dy] = arrows[e.key]
        // A burst of nudges is one gesture: same txn while keys keep
        // coming, sealed 600 ms after the last press.
        const t = nudgeTxnRef.current
        if (!t.id) t.id = `nudge-${layer.id}-${Date.now()}`
        if (t.timer) clearTimeout(t.timer)
        t.timer = setTimeout(() => {
          nudgeTxnRef.current = { id: "", timer: null }
        }, 600)
        k.dispatchFrame(
          layer.id,
          nudgeFrame(k.resolvedFrame(layer), dx * mult, dy * mult, k.W, k.H),
          t.id
        )
        return
      }
      const meta = e.metaKey || e.ctrlKey
      if (!k.activeSlide) return
      if (!meta && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (layer) {
          postCommandToShell({
            name: "slider.removeLayer",
            args: { index: k.index, slideId: k.activeSlide.id, layerId: layer.id },
          })
        }
        return
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (layer) {
          postCommandToShell({
            name: "slider.duplicateLayer",
            args: {
              index: k.index,
              slideId: k.activeSlide.id,
              layerId: layer.id,
              newId: newSliderId("ly"),
            },
          })
        }
        return
      }
      if (meta && (e.key === "[" || e.key === "]")) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (layer) {
          const li = k.activeSlide.layers.findIndex((l) => l.id === layer.id)
          postCommandToShell({
            name: "slider.reorderLayers",
            args: {
              index: k.index,
              slideId: k.activeSlide.id,
              layerId: layer.id,
              to: e.key === "[" ? li - 1 : li + 1,
            },
          })
        }
        return
      }
      /* Cmd-C/V/X and Cmd-Z fall through: undo/redo must keep reaching the
         canvas's forwarder — the stage's commands live in the same
         history. */
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  /* ------------------------- command shortcuts ------------------------ */

  const cmd = useCallback(
    (name: CommandName, args: Record<string, unknown>) =>
      postCommandToShell({ name, args }),
    []
  )

  if (!activeSlide || !stageRect) return null

  /* ------------------------------ render ------------------------------ */

  return (
    <div data-cms-overlay="1" style={{ fontFamily: font }}>
      {/* Scrim — four panes around the stage cut-out. Click = exit, EXCEPT
          under the 7A shell chrome: there the iframe is the stage's own
          centre region, so the scrim is most of what the user sees and a
          stray click beside the slide must not tear the takeover down —
          the top bar's explicit Back (and Esc) own the exit. */}
      {scrimPanes(stageRect).map((p, i) => (
        <div
          key={i}
          onClick={externalChrome ? undefined : onExit}
          style={{
            position: "fixed",
            ...p,
            background: SCRIM,
            zIndex: zLayer.canvasMenu,
          }}
        />
      ))}

      {/* The stage drives slide visibility in the editor (§2.3 — no
          autoplay here; the editor render carries no runtime). Wired to
          5A's REAL markup: slides are `.ffs-slide` under the `.ffs` root
          (only slide 0 renders with `ffs-active`), non-active slides sit
          at opacity:0 — and in transition:"slide" mode at opacity:1 but
          translated off-canvas — so the staged slide must be FORCED into
          the ffs-active presentation (opacity/transform/z-index), not
          merely un-hidden. !important beats the transition-mode rules'
          higher specificity; boxes stay measurable for the overlay. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
[data-cms-idx="${index}"] .ffs .ffs-slide{opacity:0 !important;transform:none !important;pointer-events:none !important;z-index:0 !important;transition:none !important}
[data-cms-idx="${index}"] .ffs .ffs-slide[data-slide="${cssEscape(activeSlide.id)}"]{opacity:1 !important;z-index:1 !important}
`,
        }}
      />

      {/* The stage box over the slide. */}
      <div
        style={{
          position: "fixed",
          left: stageRect.left,
          top: stageRect.top,
          width: stageRect.width,
          height: stageRect.height,
          zIndex: zAbove(zLayer.canvasMenu),
          outline: `1px solid ${accent.base}`,
          overflow: "hidden",
          cursor: "default",
        }}
        onPointerDown={(e) => {
          // Empty-stage click clears the layer selection.
          if (e.target === e.currentTarget) onSelectLayer(null)
        }}
      >
        {/* Fallback slide surface (background + ghosts) — degraded path
            only; normally 5A's platform renderer paints underneath. */}
        {fallbackSurface ? <SlideSurface slide={activeSlide} /> : null}

        {/* Layer boxes — the manipulation overlay. */}
        {activeSlide.layers.map((l) => {
          const r =
            transient?.layerId === l.id ? transient.rect : rectOf(l)
          const selected = sel.layerId === l.id
          const isLocked = locked.has(l.id)
          const hiddenHere = device !== "desktop" && l.hidden?.[device] === true
          const handles: readonly HandleId[] = selected && !isLocked
            ? l.type === "text"
              ? SIDE_HANDLES
              : ALL_HANDLES
            : []
          return (
            <div
              key={l.id}
              title={layerDisplayName(l)}
              onPointerDown={(e) => beginDrag(e, l, "move")}
              onPointerEnter={() => setHoverId(l.id)}
              onPointerLeave={() => setHoverId((h) => (h === l.id ? null : h))}
              style={{
                position: "absolute",
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                boxSizing: "border-box",
                cursor: isLocked ? "default" : "move",
                outline: selected
                  ? `2px solid ${accent.base}`
                  : hoverId === l.id
                    ? `1px solid ${accent.base}`
                    : "1px dashed rgba(242,101,34,0.35)",
                opacity: hiddenHere ? 0.4 : 1,
                touchAction: "none",
                userSelect: "none",
              }}
            >
              {fallbackSurface ? <LayerGhost layer={l} stageW={W} /> : null}
              {handles.map((h) => (
                <div
                  key={h}
                  onPointerDown={(e) => beginDrag(e, l, h)}
                  style={{
                    position: "absolute",
                    ...handlePos(h),
                    width: 9,
                    height: 9,
                    marginLeft: -4.5,
                    marginTop: -4.5,
                    background: "#fff",
                    border: `1.5px solid ${accent.base}`,
                    borderRadius: 2,
                    cursor: handleCursor(h),
                    touchAction: "none",
                  }}
                />
              ))}
              {selected ? (
                <div
                  style={{
                    position: "absolute",
                    top: -22,
                    left: 0,
                    padding: "2px 6px",
                    font: `600 10px/1.4 ${font}`,
                    color: ink.text,
                    background: ink.base,
                    borderRadius: radius.sm,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {layerDisplayName(l)}
                  {hiddenHere ? ` — hidden on ${device}` : ""}
                </div>
              ) : null}
            </div>
          )
        })}

        {/* Snap guides: center lines, edges, safe area, layer lines. */}
        {guides.map((g, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              pointerEvents: "none",
              background:
                g.kind === "center" ? accent.base : "rgba(242,101,34,0.55)",
              ...(g.axis === "v"
                ? { left: g.pos, top: 0, width: 1, height: "100%" }
                : { top: g.pos, left: 0, height: 1, width: "100%" }),
            }}
          />
        ))}
      </div>

      {/* Device badge under the stage. */}
      <div
        style={{
          position: "fixed",
          left: stageRect.left,
          top: stageRect.top + stageRect.height + 8,
          zIndex: zAbove(zLayer.canvasMenu),
          font: `500 11px/1.4 ${font}`,
          color: ink.muted,
        }}
      >
        Editing {device} frames
        {fallbackSurface ? " — layout preview (rendered slide unavailable)" : ""}
      </div>

      {/* Chrome — 7A: only when the SHELL has not claimed it. The shell's
          full-screen takeover renders the same three surfaces (slides,
          layers, device switch) outside the iframe, where they get the
          whole viewport instead of the width the editing panel left over.
          Gated, not removed: `externalChrome` defaults false. */}
      {externalChrome ? null : (
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: zLayer.canvasPicker }}>
        <div style={{ pointerEvents: "auto" }}>
          {/* The layer rail hides itself on narrow preview viewports, so the
              device switch reappears as a compact bar — the stage must never
              become a one-way trip into a phone-width canvas. */}
          {!railVisible ? (
            <div
              data-cms-overlay="1"
              style={{
                position: "fixed",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 2,
                padding: 3,
                background: ink.base,
                borderRadius: radius.md,
                boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
                zIndex: zAbove(zLayer.canvasMenu),
              }}
            >
              {(["desktop", "tablet", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  title={`Edit ${d} frames`}
                  onClick={() => changeDevice(d)}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    border: 0,
                    borderRadius: radius.sm,
                    cursor: "pointer",
                    font: `600 10px/1 ${font}`,
                    textTransform: "capitalize",
                    background: device === d ? accent.base : "transparent",
                    color: device === d ? "#fff" : ink.muted,
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          ) : null}
          <Filmstrip
            slides={layered}
            activeId={activeSlide.id}
            fieldsCount={fieldsCount}
            onActivate={(id) => {
              setTransient(null)
              onSelectSlide(id)
            }}
            onAdd={() =>
              cmd("slider.addSlide", {
                index,
                slide: defaultSlide(newSliderId("sd")),
              })
            }
            onDuplicate={(slideId) =>
              cmd("slider.duplicateSlide", {
                index,
                slideId,
                newId: newSliderId("sd"),
              })
            }
            onRemove={(slideId) => cmd("slider.removeSlide", { index, slideId })}
            onReorder={(slideId, to) =>
              cmd("slider.reorderSlides", { index, slideId, to })
            }
            onRename={(slideId, name) =>
              cmd("slider.setSlideProps", { index, slideId, props: { name } })
            }
            onExit={onExit}
          />
          {railVisible ? (
            <LayerRail
              layers={activeSlide.layers}
              selectedId={sel.layerId}
              device={device}
              onDeviceChange={changeDevice}
              onSetHidden={(layerId, dev, hidden) => {
                const l = activeSlide.layers.find((x) => x.id === layerId)
                if (!l) return
                cmd("slider.setLayerProps", {
                  index,
                  slideId: activeSlide.id,
                  layerId,
                  hidden: { ...(l.hidden ?? {}), [dev]: hidden },
                })
              }}
              locked={locked}
              onSelect={onSelectLayer}
              onAdd={(type: SliderLayerType) =>
                cmd("slider.addLayer", {
                  index,
                  slideId: activeSlide.id,
                  layer: defaultLayerOf(type, newSliderId("ly")),
                })
              }
              onReorder={(layerId, to) =>
                cmd("slider.reorderLayers", { index, slideId: activeSlide.id, layerId, to })
              }
              onToggleHidden={(layerId) => {
                if (device === "desktop") return
                const l = activeSlide.layers.find((x) => x.id === layerId)
                if (!l) return
                cmd("slider.setLayerProps", {
                  index,
                  slideId: activeSlide.id,
                  layerId,
                  hidden: { ...(l.hidden ?? {}), [device]: !l.hidden?.[device] },
                })
              }}
              onToggleLock={(layerId) =>
                setLocked((prev) => {
                  const next = new Set(prev)
                  if (next.has(layerId)) next.delete(layerId)
                  else next.add(layerId)
                  return next
                })
              }
              onRename={(layerId, name) =>
                cmd("slider.setLayerProps", {
                  index,
                  slideId: activeSlide.id,
                  layerId,
                  name,
                })
              }
              onRemove={(layerId) =>
                cmd("slider.removeLayer", { index, slideId: activeSlide.id, layerId })
              }
            />
          ) : null}
        </div>
      </div>
      )}
    </div>
  )
}

/* ----------------------------- fragments ------------------------------ */

/** setStageRect updater: keep the previous rect object when the new
 *  measurement is the same box (sub-half-pixel), so the 6C mutation-
 *  observer re-measures (which fire on ANY subtree childList change)
 *  never re-render the stage for a no-op. */
const rectIfChanged =
  (next: Rect) =>
  (prev: Rect | null): Rect =>
    prev &&
    Math.abs(prev.left - next.left) < 0.5 &&
    Math.abs(prev.top - next.top) < 0.5 &&
    Math.abs(prev.width - next.width) < 0.5 &&
    Math.abs(prev.height - next.height) < 0.5
      ? prev
      : next

/** First descendant with a real box (the section wrapper itself is
 *  display:contents and measures empty). */
function firstBox(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const r = root.getBoundingClientRect()
  if (r.width > 0 && r.height > 0) return root
  for (const child of Array.from(root.children)) {
    const hit = firstBox(child as HTMLElement)
    if (hit) return hit
  }
  return null
}

function scrimPanes(r: Rect): React.CSSProperties[] {
  return [
    { left: 0, top: 0, right: 0, height: Math.max(0, r.top) },
    {
      left: 0,
      top: r.top,
      width: Math.max(0, r.left),
      height: r.height,
    },
    {
      left: r.left + r.width,
      top: r.top,
      right: 0,
      height: r.height,
    },
    { left: 0, top: r.top + r.height, right: 0, bottom: 0 },
  ]
}

function handlePos(h: HandleId): React.CSSProperties {
  const x: Record<string, string> = { w: "0%", e: "100%" }
  const y: Record<string, string> = { n: "0%", s: "100%" }
  const hx = h.includes("e") ? x.e : h.includes("w") ? x.w : "50%"
  const hy = h.includes("n") ? y.n : h.includes("s") ? y.s : "50%"
  return { left: hx, top: hy }
}

/** Fallback slide background (degraded path — the renderer's job). */
function SlideSurface({ slide }: { slide: LayeredSlide }) {
  const bg = slide.background
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background:
      bg?.type === "color" && typeof bg.color === "string"
        ? bg.color
        : "var(--ff-primary, #1c2530)",
  }
  if (bg?.type === "image" && bg.image) {
    style.backgroundImage = `url(${JSON.stringify(bg.image)})`
    style.backgroundSize = bg.fit === "contain" ? "contain" : "cover"
    style.backgroundPosition = bg.focal
      ? `${bg.focal.x}% ${bg.focal.y}%`
      : "center"
    style.backgroundRepeat = "no-repeat"
    style.backgroundColor = "#1c2530"
  }
  const overlay =
    bg?.overlay && "color" in bg.overlay
      ? { background: bg.overlay.color, opacity: bg.overlay.opacity }
      : bg?.overlay && "gradient" in bg.overlay
        ? { background: bg.overlay.gradient }
        : null
  return (
    <>
      <div style={style} />
      {overlay ? (
        <div style={{ position: "absolute", inset: 0, ...overlay }} />
      ) : null}
    </>
  )
}

/** Fallback layer preview (degraded path): a legible ghost of each layer
 *  so compositions stay workable if the renderer refused the slide. */
function LayerGhost({ layer, stageW }: { layer: SliderLayer; stageW: number }) {
  const scale = stageW > 0 ? stageW / 1200 : 1
  const color =
    typeof layer.style?.color === "string" ? (layer.style.color as string) : "#fff"
  if (layer.type === "text") {
    const tag = String((layer.props as { tag?: unknown }).tag ?? "p")
    const sizes: Record<string, number> = {
      h1: 48,
      h2: 38,
      h3: 30,
      h4: 24,
      h5: 19,
      h6: 16,
      p: 16,
    }
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          color,
          fontSize: Math.max(11, (sizes[tag] ?? 16) * scale),
          fontWeight: tag.startsWith("h") ? 700 : 400,
          lineHeight: 1.15,
          fontFamily: "var(--ff-font-heading, inherit)",
          pointerEvents: "none",
        }}
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(String((layer.props as { html?: unknown }).html ?? "")),
        }}
      />
    )
  }
  if (layer.type === "image") {
    const src = String((layer.props as { src?: unknown }).src ?? "")
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
      />
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.7)",
          font: `500 11px/1 ${font}`,
          pointerEvents: "none",
        }}
      >
        Image
      </div>
    )
  }
  if (layer.type === "button") {
    const variant = (layer.props as { variant?: unknown }).variant
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "100%",
          minHeight: "100%",
          padding: `${10 * scale}px ${22 * scale}px`,
          boxSizing: "border-box",
          font: `600 ${Math.max(11, 14 * scale)}px/1 ${font}`,
          color: variant === "outline" ? "var(--ff-primary, #fff)" : "#fff",
          background:
            variant === "outline" ? "transparent" : "var(--ff-primary, #333)",
          border:
            variant === "outline"
              ? "1.5px solid var(--ff-primary, #fff)"
              : "none",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {String((layer.props as { label?: unknown }).label ?? "Button")}
      </div>
    )
  }
  if (layer.type === "icon") {
    const size = Number((layer.props as { size?: unknown }).size) || 32
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          fontSize: Math.max(10, size * scale),
          pointerEvents: "none",
        }}
      >
        <i className={String((layer.props as { icon?: unknown }).icon ?? "fas fa-star")} />
      </div>
    )
  }
  // shape
  const bg = (layer.style as { background?: { color?: unknown } } | undefined)
    ?.background
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          bg && typeof bg.color === "string"
            ? bg.color
            : "rgba(15,17,21,0.35)",
        pointerEvents: "none",
      }}
    />
  )
}

/** CSS.escape with a conservative fallback (ids are [a-z0-9-] anyway). */
function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(s)
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, "")
}
