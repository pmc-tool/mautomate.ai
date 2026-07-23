"use client"

/* ------------------------------------------------------------------ */
/* AiPromptBox — the Canva-style selection-anchored AI surface          */
/* (Phase 3 seat 3F; ARCH-AI §2 anatomy, §3 tiers, §4 bus binding,      */
/* §12/§4.3 failure states).                                            */
/*                                                                     */
/* ONE instance, mounted by OverlayLayer when the canvas passes the     */
/* `ai` context. It opens from the node-toolbar sparkle, Cmd+J and the  */
/* context-menu row (events.ts wire); anchors under the pinned node's   */
/* rect via the geometry store (flips above when off-viewport, clamps   */
/* to the canvas width, max 440px); runs ONLY node-scoped tiers          */
/* against /api/puck/ai-node; and lands every result as a STAGED        */
/* `ai.apply` bus command — ember-dashed preview outline, Apply         */
/* promotes to one labeled history entry, Discard reverts with zero     */
/* history residue (executor stagePreview/promote/discard).             */
/*                                                                     */
/* Every failure is an explicit UI state (§4.3) — never a silent catch: */
/* insufficient_credits / over_budget / invalid_patch / cannot /        */
/* provider_down / stream_drop / stale_node.                            */
/* ------------------------------------------------------------------ */

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  accent,
  button,
  eyebrow,
  font,
  grey,
  hairline,
  motion,
  radius,
  semantic,
  shadow,
  surface,
  type,
  zLayer,
} from "@modules/cms/editor/design"
import { UiIcon } from "@modules/cms/editor/palette-icons"

import {
  postCommandToShell,
  postToShell,
  refEq,
  type NodeRef,
} from "./canvas/protocol"
import { useGeometryVersion } from "./canvas/geometry"
import {
  domTargetOf,
  stageFromDotSet,
  targetOf,
  type AiOverlayContext,
  type AiTarget,
} from "./ai/targets"
import { aiCapsFor, type AiChipDef, type AiPriceKey } from "./ai/chips"
import {
  getBalance,
  getPrices,
  loadAiMeta,
  runMicroStream,
  runNodeTier,
  type AiFailure,
} from "./ai/client"
import { onAiOpen } from "./ai/events"

/* ---------------- run + phase model ---------------------------------- */

type TierKind = "microField" | "microItem" | "node"

type RunSpec = {
  ref: NodeRef
  chip: AiChipDef | null
  tierKind: TierKind
  action: string
  custom: string
  variant: number
  priceKey: AiPriceKey
  verb: string // progress verb + past-tense label seed
}

type Phase =
  | { k: "idle" }
  | { k: "ready" }
  | { k: "running"; spec: RunSpec; streamed: string; slow: boolean }
  | {
      k: "preview"
      spec: RunSpec
      label: string
      note: string
      credits: number
      balance: number | null
      cached: boolean
      staleSel: boolean
      /** What the staged command targeted (outline anchor). */
      stagedRef: NodeRef
    }
  | { k: "fail"; f: AiFailure; spec: RunSpec | null }
  | { k: "image"; label: string }

const W_MAX = 440

const priceOf = (key: AiPriceKey): number | null => {
  const p = getPrices()
  if (!p) return null
  const v = p[key]
  return typeof v === "number" ? v : null
}

const busRefOf = (ref: NodeRef): NodeRef => {
  // Element + item results write through their SECTION's props; widget
  // results ride the widget ref (registry aiMergeRef supports both).
  // 5C: slider slide/layer results reduce onto the hero_slider SECTION
  // the same way (ARCH-AI §4.2) — the dot paths staged by targets.ts
  // resolve slide/layer ids to CURRENT indices inside the section.
  if (
    ref.t === "element" ||
    ref.t === "item" ||
    ref.t === "sliderSlide" ||
    ref.t === "sliderLayer"
  ) {
    return { t: "section", i: ref.i }
  }
  return ref
}

export default function AiPromptBox({
  ai,
  previewMode,
}: {
  ai: AiOverlayContext
  previewMode: boolean
}) {
  const [pin, setPin] = useState<NodeRef | null>(null)
  const [phase, setPhase] = useState<Phase>({ k: "idle" })
  const [input, setInput] = useState("")
  const [submenu, setSubmenu] = useState<string | null>(null)
  const [hintChip, setHintChip] = useState<AiChipDef | null>(null)
  const [demand, setDemand] = useState(false)
  const [, force] = useState(0)

  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [boxH, setBoxH] = useState(200)

  /* Latest context for async result handlers (the canvas re-renders the
   * bag every content change; results must resolve against the LATEST). */
  const aiRef = useRef(ai)
  aiRef.current = ai
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const pinRef = useRef(pin)
  pinRef.current = pin

  const geomVersion = useGeometryVersion(ai.geom)

  const open = phase.k !== "idle" && pin != null && !previewMode

  const target: AiTarget | null = useMemo(
    () => (pin ? targetOf(pin, ai) : null),
    // content/chrome identity changes re-resolve the node.
    [pin, ai.content, ai.chrome] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const caps = target ? aiCapsFor(target) : null

  /* ---------------- open/close wiring -------------------------------- */

  const reallyClose = () => {
    setPin(null)
    setPhase({ k: "idle" })
    setInput("")
    setSubmenu(null)
    setDemand(false)
  }

  /** Close request honoring §2.1: a pending preview demands Apply/Discard
   *  first — a paid result is never silently dropped. */
  const requestClose = () => {
    const p = phaseRef.current
    if (p.k === "preview") {
      setDemand(true)
      return
    }
    if (p.k === "running") return // short-lived; the result needs a home
    reallyClose()
  }

  const openOn = (ref: NodeRef) => {
    const p = phaseRef.current
    if (p.k === "preview") {
      setDemand(true)
      return
    }
    if (p.k === "running") return
    setPin(ref)
    setPhase({ k: "ready" })
    setInput("")
    setSubmenu(null)
    setDemand(false)
    void loadAiMeta().then(() => force((n) => n + 1))
    window.setTimeout(() => inputRef.current?.focus(), 30)
  }

  // Open intents: sparkle + context-menu row (events wire).
  useEffect(() => onAiOpen(openOn), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+J with a node selected (ARCH-AI §2.1), guarded against typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j" && !typing) {
        const sel = aiRef.current.sel
        if (sel) {
          e.preventDefault()
          openOn(sel)
        }
        return
      }
      if (e.key === "Escape" && phaseRef.current.k !== "idle") {
        requestClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Click-away (capture, so theme handlers can't swallow it).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return
      requestClose()
    }
    document.addEventListener("mousedown", onDown, true)
    return () => document.removeEventListener("mousedown", onDown, true)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Selection change closes an idle box; a running/preview box notes it
  // (the stale_node contract renders "Apply to <label>?" — §4.3).
  useEffect(() => {
    if (!pin) return
    if (refEq(ai.sel, pin)) return
    const p = phaseRef.current
    if (p.k === "ready") reallyClose()
    else if (p.k === "preview" && !p.staleSel) {
      setPhase({ ...p, staleSel: true })
    }
  }, [ai.sel]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- execution ---------------------------------------- */

  const ghostRef = useRef<{ el: HTMLElement; orig: string } | null>(null)
  const restoreGhost = () => {
    const g = ghostRef.current
    ghostRef.current = null
    if (g) {
      try {
        g.el.textContent = g.orig
      } catch {}
    }
  }

  const failStale = (spec: RunSpec, credits: number) =>
    setPhase({
      k: "fail",
      spec: null,
      f: {
        kind: "stale_node",
        message:
          credits > 0
            ? `This part changed while the AI was working — the result was discarded. ${credits} credit${credits === 1 ? "" : "s"} were used.`
            : "This part changed while the AI was working — the result was discarded. Nothing was billed.",
        credits,
      },
    })

  const execRun = async (spec: RunSpec) => {
    const ctx = aiRef.current
    const t = targetOf(spec.ref, ctx)
    if (!t) return failStale(spec, 0)

    // Pre-flight wallet gate (§3.8): the 402 as a state, not an error.
    const price = priceOf(spec.priceKey)
    const bal = getBalance()
    if (price != null && bal != null && bal < price) {
      setPhase({
        k: "fail",
        spec,
        f: {
          kind: "insufficient_credits",
          message: `Needs ${price} credit${price === 1 ? "" : "s"} — top up in Billing.`,
        },
      })
      return
    }

    setPhase({ k: "running", spec, streamed: "", slow: false })
    const slowTimer = window.setTimeout(() => {
      setPhase((p) => (p.k === "running" ? { ...p, slow: true } : p))
    }, 1400)

    try {
      if (spec.tierKind === "microField") {
        const f = t.field
        if (!f) return failStale(spec, 0)
        // Streaming ghost (§4.4): display-only mid-stream text on simple
        // single-text targets; the document mutates only via the staged
        // patch after `done`. A dropped stream restores and touches nothing.
        if (!f.html) {
          const el = domTargetOf(spec.ref)
          if (el && el.childElementCount === 0) {
            ghostRef.current = { el, orig: el.textContent ?? "" }
          }
        }
        const r = await runMicroStream(
          {
            text: f.value,
            label: f.label,
            action: spec.action,
            custom: spec.custom,
            html: f.html,
            brand: ctx.brand || undefined,
            variant_nonce: spec.variant,
          },
          (acc) => {
            const g = ghostRef.current
            if (g) {
              try {
                g.el.textContent = acc
              } catch {}
            }
            setPhase((p) => (p.k === "running" ? { ...p, streamed: acc } : p))
          }
        )
        restoreGhost()
        if (!r.ok) return setPhase({ k: "fail", f: r.f, spec })
        return stageText(spec, r.text, r.credits, r.balance, r.cached)
      }

      // JSON tiers: item micro + Tier 2 node. The payload is the ONE
      // owning node + block-types-only outline — nothing page-wide (§3.3).
      const section = t.section
      if (!section || t.sectionIndex == null || !t.blockType) {
        return failStale(spec, 0)
      }
      const r = await runNodeTier({
        tier: spec.tierKind === "microItem" ? "micro" : "node",
        block_type: t.blockType,
        node: section as Record<string, unknown>,
        ...(spec.tierKind === "microItem" && t.itemPath
          ? { item_path: t.itemPath }
          : {}),
        ...(spec.custom ? { custom: spec.custom } : { action: spec.action }),
        ...(spec.tierKind === "node"
          ? {
              page_types: ctx.content.map((b) => b.block_type).slice(0, 40),
              selected_index: t.sectionIndex,
            }
          : {}),
        brand: ctx.brand || undefined,
        variant_nonce: spec.variant,
      })
      if (!r.ok) return setPhase({ k: "fail", f: r.f, spec })
      return stageDot(spec, r.set, r.note, r.credits, r.balance, r.cached)
    } finally {
      window.clearTimeout(slowTimer)
      restoreGhost()
    }
  }

  /** Stage a Tier-1 text result as `ai.apply {ref,set,before,staged}`. */
  const stageText = (
    spec: RunSpec,
    text: string,
    credits: number,
    balance: number | null,
    cached: boolean
  ) => {
    const ctx = aiRef.current
    const t = targetOf(spec.ref, ctx)
    if (!t || !t.field) return failStale(spec, credits)
    const label = `AI: ${spec.verb} ${t.label}`
    const stagedRef = busRefOf(spec.ref)

    if (t.kind === "chromeEl" && t.chromeRegion && t.chromeData) {
      // Chrome rides its own bus command; the executor stages chrome
      // regions the same way (ARCH-AI §4.2 / executor chromeTouched).
      postCommandToShell({
        name: "chrome.setProps",
        args: {
          region: t.chromeRegion,
          data: { ...t.chromeData, [t.field.path]: text },
          staged: true,
        },
        label,
      })
    } else {
      const host =
        spec.ref.t === "widget"
          ? (t.widget as Record<string, unknown>)
          : (t.section as Record<string, unknown> | null)
      if (!host) return failStale(spec, credits)
      // 5C: field paths may be DOT paths now (slider layers bind
      // "slides.<i>.layers.<j>.props.<key>"). stageFromDotSet turns them
      // into the top-level {set, before} the bus merge needs; for the
      // classic single-segment paths its output is byte-identical to the
      // old flat write.
      const staged = stageFromDotSet(host, { [t.field.path]: text })
      if (!staged) return failStale(spec, credits)
      postCommandToShell({
        name: "ai.apply",
        args: {
          ref: stagedRef,
          set: staged.set,
          before: staged.before,
          staged: true,
        },
        label,
      })
    }
    setPhase({
      k: "preview",
      spec,
      label,
      note: "",
      credits,
      balance,
      cached,
      staleSel: !refEq(ctx.sel, spec.ref),
      stagedRef,
    })
    setDemand(false)
  }

  /** Stage a JSON-tier changed-paths result: dot paths are merged into
   *  top-level root values against the CURRENT node (targets.ts), so the
   *  bus command's `before` inverts exactly what the merge replaces. */
  const stageDot = (
    spec: RunSpec,
    dotSet: Record<string, unknown>,
    note: string,
    credits: number,
    balance: number | null,
    cached: boolean
  ) => {
    const ctx = aiRef.current
    const t = targetOf(spec.ref, ctx)
    if (!t || !t.section || t.sectionIndex == null) return failStale(spec, credits)
    const staged = stageFromDotSet(t.section as Record<string, unknown>, dotSet)
    if (!staged) return failStale(spec, credits)
    const label = `AI: ${spec.verb} ${t.label}`
    const stagedRef: NodeRef = { t: "section", i: t.sectionIndex }
    postCommandToShell({
      name: "ai.apply",
      args: { ref: stagedRef, set: staged.set, before: staged.before, staged: true },
      label,
    })
    setPhase({
      k: "preview",
      spec,
      label,
      note,
      credits,
      balance,
      cached,
      staleSel: !refEq(ctx.sel, spec.ref),
      stagedRef,
    })
    setDemand(false)
  }

  /* ---------------- preview resolution (§2.4) ------------------------- */

  const applyPreview = () => {
    const p = phaseRef.current
    if (p.k !== "preview") return
    postToShell({ type: "cms:aiStage", op: "promote", label: p.label })
    reallyClose()
  }

  const discardPreview = (thenReady = true) => {
    const p = phaseRef.current
    if (p.k !== "preview") return
    postToShell({ type: "cms:aiStage", op: "discard" })
    setDemand(false)
    if (thenReady) setPhase({ k: "ready" })
  }

  const regenerate = () => {
    const p = phaseRef.current
    if (p.k !== "preview") return
    postToShell({ type: "cms:aiStage", op: "discard" })
    setDemand(false)
    void execRun({ ...p.spec, variant: p.spec.variant + 1 })
  }

  /* ---------------- chip + free-prompt dispatch ----------------------- */

  const runChip = (chip: AiChipDef, action?: string) => {
    if (!pin || !target || !caps) return
    if (chip.image) {
      // Image work stays in the studio (§2.3): hand the node to the panel
      // (the shell's image flow) and say so — the box never inlines image UX.
      if (pin.t === "widget") {
        postToShell({ type: "cms:clickedWidget", index: pin.i, path: pin.path })
      } else if (pin.t === "section") {
        postToShell({ type: "cms:clicked", index: pin.i })
      }
      /* 6C zoo deletion: the cms:aiImage deep-link is gone — the shell
         never handled it, and the clicked/select intent above already
         opens the panel on the node (the studio's real door). */
      setPhase({ k: "image", label: target.label })
      return
    }
    const tierKind: TierKind =
      chip.tier === 2 ? "node" : target.itemPath ? "microItem" : "microField"
    void execRun({
      ref: pin,
      chip,
      tierKind,
      action: action ?? chip.action,
      custom: "",
      variant: 0,
      priceKey: chip.priceKey,
      verb: chip.past,
    })
  }

  const runFreePrompt = () => {
    if (!pin || !target || !caps || caps.freePrompt === "none") return
    const text = input.trim()
    if (!text) return
    const scoped =
      target.kind === "element" && !target.field && pin.t === "element"
        ? `Only change the "${pin.el.replace(/[_-]+/g, " ")}" part of this section: ${text}`
        : text
    const micro = caps.freePrompt === "micro"
    void execRun({
      ref: pin,
      chip: null,
      tierKind: micro ? (target.itemPath ? "microItem" : "microField") : "node",
      action: "custom",
      custom: scoped,
      variant: 0,
      priceKey: micro ? "ai_text" : "ai_node_edit",
      verb: "edited",
    })
    setInput("")
  }

  /* ---------------- geometry ------------------------------------------ */

  const rect = useMemo(() => {
    if (!open || !pin) return null
    const el = domTargetOf(pin)
    return el ? ai.geom.rectOf(el) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pin, geomVersion, ai.content, ai.chrome])

  const previewRect = useMemo(() => {
    if (phase.k !== "preview") return null
    const el = domTargetOf(phase.stagedRef)
    return el ? ai.geom.rectOf(el) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, geomVersion, ai.content, ai.chrome])

  useLayoutEffect(() => {
    if (open && boxRef.current) setBoxH(boxRef.current.offsetHeight)
  })

  if (!open || !target || !caps) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(W_MAX, vw - 16)
  const left = rect
    ? Math.max(8, Math.min(rect.left, vw - width - 8))
    : Math.max(8, (vw - width) / 2)
  let top: number
  if (rect) {
    top = rect.bottom + 8
    if (top + boxH > vh - 8) top = Math.max(8, rect.top - boxH - 8)
  } else {
    top = vh - boxH - 16
  }

  /* ---------------- render helpers ------------------------------------ */

  const balance = getBalance()
  const chipPrice = (c: AiChipDef) => priceOf(c.priceKey)
  const chipShort = (c: AiChipDef) => {
    const p = chipPrice(c)
    return p != null && balance != null && balance < p
  }

  const footerHint = (() => {
    if (phase.k === "preview") {
      const cr = phase.cached
        ? "Cached — free"
        : `Used ${phase.credits} credit${phase.credits === 1 ? "" : "s"}`
      return `${cr}${phase.balance != null ? ` · ${phase.balance} left` : ""}`
    }
    if (phase.k === "running") return null
    const c = hintChip
    const freeKey: AiPriceKey = caps.freePrompt === "micro" ? "ai_text" : "ai_node_edit"
    const p = c ? chipPrice(c) : caps.freePrompt !== "none" ? priceOf(freeKey) : null
    const name = c ? c.label : caps.freePrompt !== "none" ? "Send" : ""
    const parts: string[] = []
    if (name && p != null) parts.push(`${name} · ${p} cr`)
    if (balance != null) parts.push(`${balance} credits left`)
    return parts.length ? parts.join("  ·  ") : null
  })()

  const chipStyle = (disabled: boolean): React.CSSProperties => ({
    ...type.label,
    fontFamily: font,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 24,
    padding: "0 9px",
    borderRadius: radius.pill,
    border: `1px solid ${disabled ? grey[20] : accent.tintStrong}`,
    background: disabled ? grey[10] : accent.tint,
    color: disabled ? grey[40] : accent.active,
    cursor: disabled ? "default" : "pointer",
    whiteSpace: "nowrap",
    transition: `background ${motion.fast}, border-color ${motion.fast}`,
  })

  const busy = phase.k === "running"

  return (
    <>
      {/* Ember-dashed outline over the AI-touched region (§2.4 step 2). */}
      {phase.k === "preview" && previewRect ? (
        <div
          data-cms-overlay="1"
          style={{
            position: "fixed",
            top: previewRect.top - 3,
            left: previewRect.left - 3,
            width: previewRect.width + 6,
            height: previewRect.height + 6,
            border: `2px dashed ${accent.base}`,
            borderRadius: radius.sm,
            background: accent.soft,
            zIndex: zLayer.canvasSeam,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              ...type.micro,
              fontFamily: font,
              position: "absolute",
              top: -9,
              left: 10,
              padding: "1px 7px",
              borderRadius: radius.pill,
              background: accent.base,
              color: accent.on,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <UiIcon name="sparkles" size={10} />
            AI preview
          </span>
        </div>
      ) : null}

      <div
        ref={boxRef}
        data-cms-overlay="1"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          ...surface("lg"),
          position: "fixed",
          top,
          left,
          width,
          zIndex: zLayer.canvasPicker,
          padding: 10,
          fontFamily: font,
          borderColor: demand ? accent.base : grey[20],
          transition: `border-color ${motion.fast}`,
        }}
      >
        {/* (1) Node identity line — WHAT the AI will touch (§2.2). */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ color: accent.base, display: "inline-flex" }}>
            <UiIcon name="sparkles" size={14} />
          </span>
          <span style={{ ...type.bodyStrong, color: grey[90], whiteSpace: "nowrap" }}>
            {target.label}
          </span>
          {target.excerpt ? (
            <span
              style={{
                ...type.label,
                color: grey[40],
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              “{target.excerpt}”
            </span>
          ) : null}
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={requestClose}
            style={{
              marginLeft: "auto",
              border: 0,
              background: "none",
              color: grey[50],
              cursor: "pointer",
              display: "inline-flex",
              padding: 2,
            }}
          >
            <UiIcon name="x" size={13} />
          </button>
        </div>

        {/* Site-wide banner (chrome family, §5.2). */}
        {caps.banner ? (
          <div
            style={{
              ...type.label,
              color: semantic.warnFg,
              background: semantic.warnBg,
              border: `1px solid ${semantic.warnBorder}`,
              borderRadius: radius.md,
              padding: "4px 8px",
              marginBottom: 8,
            }}
          >
            {caps.banner}
          </div>
        ) : null}

        {demand ? (
          <div
            style={{
              ...type.label,
              color: accent.active,
              background: accent.tint,
              border: `1px solid ${accent.tintStrong}`,
              borderRadius: radius.md,
              padding: "4px 8px",
              marginBottom: 8,
            }}
          >
            Apply or discard this AI change first — it&apos;s already paid for.
          </div>
        ) : null}

        {/* (2) Chips row — the per-node-type matrix (§2.3). */}
        {(phase.k === "ready" || phase.k === "fail") && caps.chips.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {caps.chips.map((c) => {
              const short = chipShort(c)
              const p = chipPrice(c)
              return (
                <div key={c.id} style={{ position: "relative" }}>
                  <button
                    type="button"
                    disabled={short || busy}
                    title={
                      short
                        ? `Needs ${p} credit${p === 1 ? "" : "s"} — top up in Billing`
                        : c.label
                    }
                    onClick={() =>
                      c.submenu ? setSubmenu((s) => (s === c.id ? null : c.id)) : runChip(c)
                    }
                    onMouseEnter={() => setHintChip(c)}
                    onMouseLeave={() => setHintChip((h) => (h === c ? null : h))}
                    style={chipStyle(short || busy)}
                  >
                    {c.label}
                    {p != null ? (
                      <span style={{ fontWeight: 500, opacity: 0.75 }}>· {p} cr</span>
                    ) : null}
                    {c.submenu ? <UiIcon name="chevron-down" size={11} /> : null}
                  </button>
                  {submenu === c.id && c.submenu ? (
                    <div
                      style={{
                        ...surface("md"),
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 2,
                        padding: 4,
                        minWidth: 120,
                      }}
                    >
                      {c.submenu.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSubmenu(null)
                            runChip(c, s.action)
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = grey[10])}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          style={{
                            ...type.label,
                            fontFamily: font,
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            border: 0,
                            borderRadius: radius.sm,
                            background: "none",
                            padding: "5px 8px",
                            color: grey[80],
                            cursor: "pointer",
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Running: progress + streamed text (§2.2 / §4.4). */}
        {phase.k === "running" ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...type.label, color: grey[50], display: "flex", gap: 6, alignItems: "center" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: accent.base,
                  animation: "cmsAiPulse 900ms ease-in-out infinite",
                }}
              />
              {phase.spec.tierKind === "microField"
                ? "Writing…"
                : phase.slow
                  ? "Writing…"
                  : "Reading the section…"}
            </div>
            {phase.streamed ? (
              <div
                style={{
                  ...type.body,
                  color: grey[70],
                  background: grey[5],
                  border: hairline,
                  borderRadius: radius.md,
                  padding: "6px 8px",
                  marginTop: 6,
                  maxHeight: 84,
                  overflow: "hidden",
                }}
              >
                {phase.streamed}
              </div>
            ) : null}
            <style>{`@keyframes cmsAiPulse{0%,100%{opacity:.35}50%{opacity:1}}`}</style>
          </div>
        ) : null}

        {/* Preview review state (§2.4 step 2-3). */}
        {phase.k === "preview" ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...type.label, color: grey[70], marginBottom: 8 }}>
              {phase.staleSel
                ? `Preview applied — apply to ${target.label}?`
                : "Preview applied on the canvas."}
              {phase.note ? (
                <span style={{ color: grey[50] }}> {phase.note}</span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={applyPreview} style={{ ...button("accent", "sm") }}>
                Apply
              </button>
              <button type="button" onClick={regenerate} style={{ ...button("secondary", "sm") }}>
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => discardPreview(true)}
                style={{ ...button("ghost", "sm") }}
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}

        {/* The image hand-off note. */}
        {phase.k === "image" ? (
          <div
            style={{
              ...type.label,
              color: semantic.infoFg,
              background: semantic.infoBg,
              borderRadius: radius.md,
              padding: "6px 8px",
              marginBottom: 8,
            }}
          >
            Image work opens in the studio — use “Generate with AI” on the image
            field in the panel.
          </div>
        ) : null}

        {/* The SIX failure states, each explicit (§4.3/§12). */}
        {phase.k === "fail" ? (
          <div style={{ marginBottom: 8 }}>
            {phase.f.kind === "cannot" ? (
              <div
                style={{
                  ...type.label,
                  color: semantic.infoFg,
                  background: semantic.infoBg,
                  borderRadius: radius.md,
                  padding: "6px 8px",
                }}
              >
                {phase.f.message}
              </div>
            ) : (
              <div
                style={{
                  ...type.label,
                  color:
                    phase.f.kind === "insufficient_credits" ||
                    phase.f.kind === "over_budget" ||
                    phase.f.kind === "stale_node"
                      ? semantic.warnFg
                      : semantic.dangerFg,
                  background:
                    phase.f.kind === "insufficient_credits" ||
                    phase.f.kind === "over_budget" ||
                    phase.f.kind === "stale_node"
                      ? semantic.warnBg
                      : semantic.dangerBg,
                  borderRadius: radius.md,
                  padding: "6px 8px",
                }}
              >
                {phase.f.message}
              </div>
            )}
            {(phase.f.kind === "invalid_patch" ||
              phase.f.kind === "provider_down" ||
              phase.f.kind === "stream_drop") &&
            phase.spec ? (
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => phase.spec && void execRun(phase.spec)}
                  style={{ ...button("secondary", "sm") }}
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* (3) Free prompt — single-line grow, Enter sends (§2.2). */}
        {caps.freePrompt !== "none" && phase.k !== "preview" && phase.k !== "running" ? (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              rows={Math.min(4, Math.max(1, input.split("\n").length))}
              placeholder={caps.placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  runFreePrompt()
                }
              }}
              style={{
                ...type.body,
                fontFamily: font,
                flex: 1,
                minWidth: 0,
                resize: "none",
                padding: "6px 10px",
                color: grey[90],
                background: "#fff",
                border: `1px solid ${grey[30]}`,
                borderRadius: radius.md,
                outline: "none",
                lineHeight: 1.5,
              }}
            />
            <button
              type="button"
              disabled={!input.trim() || busy}
              onClick={runFreePrompt}
              style={{
                ...button("accent", "sm"),
                ...(!input.trim() || busy
                  ? { background: grey[20], color: grey[40], cursor: "default" }
                  : {}),
              }}
            >
              <UiIcon name="sparkles" size={13} />
              Go
            </button>
          </div>
        ) : null}

        {/* (4) Footer: credit price BEFORE, spend + balance AFTER (§3.8). */}
        {footerHint ? (
          <div style={{ ...eyebrow(), marginTop: 8, color: grey[40] }}>{footerHint}</div>
        ) : null}
      </div>
    </>
  )
}
