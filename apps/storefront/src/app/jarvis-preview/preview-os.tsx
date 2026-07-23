"use client"

/* ------------------------------------------------------------------ */
/* Pixi OS — PUBLIC PREVIEW HARNESS (demo / QA, no auth, no backend). */
/*                                                                     */
/* Mounts the REAL Pixi OS surface (Surface + MaCore + CardHost +       */
/* SignalLines + Dock + every registered card body) but drives it from a    */
/* SCRIPTED MOCK CONVERSATION instead of the SSE stream. It composes the      */
/* same card-store reducer and provides the SAME OSContext the real           */
/* JarvisOSProvider does, so every visual component is reused verbatim.         */
/* Nothing here touches the real provider or the dashboard path.                 */
/* ------------------------------------------------------------------ */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import {
  OSContext,
  type FeedEntry,
} from "@components/merchant-admin/jarvis-stage/os/os-provider"
import { Surface } from "@components/merchant-admin/jarvis-stage/os/jarvis-os"
import {
  cardReducer,
  initialCardStore,
  activeCards,
  dockCards,
  type Card,
  type ConfirmState,
} from "@components/merchant-admin/jarvis-stage/os/card-store"
import type { JarvisState } from "@components/merchant-admin/jarvis-stage/jarvis-core"
import {
  os,
  type as t,
  radius,
  accent,
  motion,
} from "@components/merchant-admin/jarvis-stage/os/tokens"
// Register every bespoke card body (side-effect) — same import the real OS uses.
import "@components/merchant-admin/jarvis-stage/os/cards/register"

/* ----------------------------- mock data ---------------------------- */

const H = 3600_000
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
const soon = () => Math.floor(Date.now() / 1000) + 3600 // plan-token exp (demo)

type ReadSpec = { tool: string; label: string; data: unknown }
type WriteSpec = { tool: string; label: string; confirm: ConfirmState }

function buildReads(): ReadSpec[] {
  return [
    {
      tool: "store_overview",
      label: "Reading your store overview",
      data: {
        store_name: "Dear Wish",
        country: "us",
        currency: "usd",
        ready_to_sell: true,
        product_count: 128,
        order_count: 342,
        active_theme: "learts-liquid",
      },
    },
    {
      tool: "sales_summary",
      label: "Summarising the last 30 days of sales",
      data: { days: 30, orders: 342, revenue: 18420, aov: 53.8, currency: "usd" },
    },
    {
      tool: "needs_attention",
      label: "Checking what needs your attention",
      data: {
        ready_to_sell: true,
        items: [
          {
            id: "a1",
            severity: "blocker",
            title: "3 paid orders awaiting fulfilment",
            detail: "Orders #1041, #1042 and #1043 are paid but not shipped.",
            cta: { label: "Fulfil them", prompt: "Show me the orders I need to fulfil" },
          },
          {
            id: "a2",
            severity: "warn",
            title: "2 products are low on stock",
            detail: "Aurora Pendant and Linen Throw are running low.",
            cta: { label: "See low stock", prompt: "What is low on stock?" },
          },
          {
            id: "a3",
            severity: "info",
            title: "A customer is waiting on a reply",
            detail: "Maya asked about international shipping 2 hours ago.",
            cta: { label: "Who needs a human?", prompt: "Which customers need a human?" },
          },
        ],
      },
    },
    {
      tool: "low_stock",
      label: "Finding low-stock products",
      data: {
        threshold: 5,
        count: 3,
        items: [
          { product: "Aurora Pendant", variant: "Gold / M", available: 3 },
          { product: "Linen Throw", variant: "Sand", available: 1 },
          { product: "Ceramic Mug", variant: "Default", available: 0 },
        ],
      },
    },
    {
      tool: "list_recent_orders",
      label: "Pulling your recent orders",
      data: {
        count: 342,
        orders: [
          { order_no: 1043, payment: "captured", fulfillment: "not_fulfilled", total: 129.9, currency: "usd", customer: "Maya Rahman", country: "us", placed_at: iso(2 * H) },
          { order_no: 1042, payment: "captured", fulfillment: "fulfilled", total: 64, currency: "usd", customer: "James Lee", placed_at: iso(5 * H) },
          { order_no: 1041, payment: "authorized", fulfillment: "not_fulfilled", total: 212.5, currency: "usd", customer: "Guest", placed_at: iso(26 * H) },
          { order_no: 1040, payment: "refunded", fulfillment: "canceled", total: 38, currency: "usd", customer: "Ana Costa", placed_at: iso(50 * H) },
        ],
      },
    },
    {
      tool: "search_products",
      label: "Searching your catalog",
      data: {
        count: 128,
        products: [
          { title: "Aurora Pendant", status: "published", variants: 3, variant_names: ["Gold / M", "Silver / M", "Gold / L"] },
          { title: "Linen Throw", status: "published", variants: 2, variant_names: ["Sand", "Charcoal"] },
          { title: "Ceramic Mug", status: "draft", variants: 1, variant_names: ["Default"] },
        ],
      },
    },
    {
      tool: "visitor_report",
      label: "Reading your visitor analytics",
      data: {
        available: true,
        days: 7,
        visitors: 2480,
        pageviews: 9120,
        visits: 3010,
        active_now: 12,
        top_pages: [
          { page: "/", views: 3400 },
          { page: "/products/aurora-pendant", views: 1250 },
          { page: "/collections/new", views: 880 },
        ],
        top_sources: [
          { source: "google", visits: 1400 },
          { source: "instagram", visits: 760 },
          { source: "direct", visits: 520 },
        ],
      },
    },
    {
      tool: "ad_report",
      label: "Reading your ad performance",
      data: {
        available: true,
        days: 30,
        connected: true,
        spend: 1240.5,
        impressions: 210400,
        clicks: 5820,
        conversions: 187,
        roas: 3.42,
        currency: "usd",
        per_campaign: [
          { name: "Retargeting — Warm", status: "active", spend: 640, conversions: 120, roas: 4.1 },
          { name: "Prospecting — Broad", status: "active", spend: 420.5, conversions: 52, roas: 2.6 },
          { name: "Catalog — DPA", status: "paused", spend: 180, conversions: 15, roas: 2.1 },
        ],
      },
    },
  ]
}

function buildWrites(): WriteSpec[] {
  return [
    {
      tool: "create_discount",
      label: "Proposing a discount code",
      confirm: {
        tier: "hard",
        requireText: "CREATE",
        summary:
          "Create the discount code WELCOME15 — 15% off the whole order, up to 500 uses.",
        details: {
          code: "WELCOME15",
          type: "percentage",
          value: 15,
          currency: "USD",
          applies_to: "order_total",
          usage_limit: 500,
          expires_at: iso(-30 * 24 * H), // 30 days in the FUTURE
        },
        token: "mock-plan-create-discount",
        exp: soon(),
      },
    },
    {
      tool: "refund_order",
      label: "Proposing a refund",
      confirm: {
        tier: "hard",
        requireText: "REFUND",
        summary: "Refund USD 40 to Maya Rahman on order #1043.",
        details: {
          order_no: "1043",
          amount: 40,
          currency: "USD",
          partial: true,
          note: "Damaged item on arrival — partial refund",
        },
        token: "mock-plan-refund-order",
        exp: soon(),
      },
    },
  ]
}

function buildSendReads(): ReadSpec[] {
  const all = buildReads()
  return [all[0], all[1], all[2]] // overview, sales, needs-attention
}

function buildExtras(): ReadSpec[] {
  return [
    { tool: "list_discounts", label: "Listing discounts", data: { active: 2, discounts: [{ code: "WELCOME15", value: "15% off", uses: 42 }, { code: "FREESHIP", value: "Free shipping", uses: 18 }] } },
    { tool: "list_campaigns", label: "Listing campaigns", data: { count: 2, campaigns: [{ name: "Spring Launch", status: "active" }, { name: "Retargeting", status: "paused" }] } },
    { tool: "list_collections", label: "Listing collections", data: { count: 5, collections: [{ title: "New Arrivals", products: 24 }, { title: "Best Sellers", products: 18 }] } },
    { tool: "list_themes", label: "Listing themes", data: { active: "learts-liquid", themes: [{ name: "Learts", active: true }, { name: "Cignet", active: false }] } },
  ]
}

const FINAL_ANSWER =
  "Here is your **morning read** — revenue is up and traffic looks healthy. Two things need a decision from you:\n\n- The `WELCOME15` discount you asked for\n- A partial refund on order #1043\n\nChanging your store name is something you do yourself — [click here](/dashboard/settings/store) to open Store Details, or [finish store setup](/dashboard/setup) first."

const INITIAL_PROMPT = "How is my store doing today? Anything I need to deal with?"

/* --------------------------- demo toolbar --------------------------- */

function ToolbarButton({
  label,
  active,
  primary,
  onClick,
}: {
  label: string
  active?: boolean
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...t.label,
        height: 30,
        padding: "0 12px",
        borderRadius: radius.pill,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
        border: `1px solid ${active || primary ? accent.base : os.hairline}`,
        background: primary ? accent.base : active ? os.emberSoft : "rgba(255,255,255,0.9)",
        color: primary ? "#fff" : active ? os.emberDeep : os.textDim,
        transition: `all ${motion.fast}`,
      }}
    >
      {label}
    </button>
  )
}

function DemoToolbar({
  orbState,
  busy,
  onReplay,
  onSpawn,
  onOrb,
}: {
  orbState: JarvisState
  busy: boolean
  onReplay: () => void
  onSpawn: () => void
  onOrb: (s: JarvisState) => void
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: radius.pill,
        background: "rgba(255,255,255,0.82)",
        border: `1px solid ${os.hairline}`,
        boxShadow: os.cardShadow,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        maxWidth: "94vw",
        overflowX: "auto",
      }}
    >
      <span style={{ ...t.micro, color: os.faint, paddingLeft: 4, flex: "0 0 auto" }}>
        Preview harness
      </span>
      <ToolbarButton label="Replay" primary onClick={onReplay} />
      <ToolbarButton label="Spawn more cards" onClick={onSpawn} />
      <span style={{ width: 1, height: 18, background: os.hairline, flex: "0 0 auto" }} />
      <span style={{ ...t.micro, color: os.faint, flex: "0 0 auto" }}>Core</span>
      <ToolbarButton label="Idle" active={orbState === "idle" && !busy} onClick={() => onOrb("idle")} />
      <ToolbarButton label="Thinking" active={orbState === "thinking"} onClick={() => onOrb("thinking")} />
      <ToolbarButton label="Listening" active={orbState === "listening"} onClick={() => onOrb("listening")} />
    </div>
  )
}

/* ------------------------- the preview brain ------------------------ */

function PreviewProvider({ onReplay }: { onReplay: () => void }) {
  const [store, dispatch] = useReducer(cardReducer, initialCardStore)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState("")
  const [feed, setFeed] = useState<FeedEntry[]>([])
  const [orbState, setOrbState] = useState<JarvisState>("idle")

  const timers = useRef<number[]>([])
  const turnRef = useRef(0)

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])
  const schedule = useCallback((at: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, at))
  }, [])

  const pushFeed = useCallback(
    (e: FeedEntry) => setFeed((prev) => [...prev.slice(-40), e]),
    []
  )
  const updateFeed = useCallback(
    (id: string, patch: Partial<FeedEntry>) =>
      setFeed((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))),
    []
  )

  const runTurn = useCallback(
    (prompt: string, reads: ReadSpec[], writes: WriteSpec[]) => {
      clearTimers()
      const turn = ++turnRef.current
      const uid = (tool: string) => `t${turn}-${tool}`
      dispatch({ type: "TURN_START" })
      setAnswer("")
      setBusy(true)
      setOrbState("thinking")
      pushFeed({ id: `p-${turn}`, kind: "prompt", text: prompt, at: Date.now() })

      const GAP = 1200
      const SETTLE = 700
      let i = 0

      const spawn = (
        id: string,
        tool: string,
        label: string,
        kind: "read" | "write"
      ) => {
        dispatch({ type: "TOOL_CALL", id, tool, label, kind })
        pushFeed({ id: `f-${id}`, kind: "tool", text: label, at: Date.now(), state: "running" })
      }

      for (const r of reads) {
        const at = i * GAP
        const id = uid(r.tool)
        schedule(at, () => spawn(id, r.tool, r.label, "read"))
        schedule(at + SETTLE, () => {
          dispatch({ type: "TOOL_RESULT", id, ok: true, data: r.data })
          updateFeed(`f-${id}`, { state: "done" })
        })
        i++
      }
      for (const w of writes) {
        const at = i * GAP
        const id = uid(w.tool)
        schedule(at, () => spawn(id, w.tool, w.label, "write"))
        schedule(at + SETTLE, () => {
          dispatch({ type: "CONFIRM", id, tool: w.tool, label: w.label, confirm: w.confirm })
          updateFeed(`f-${id}`, { state: "done" })
        })
        i++
      }

      const endAt = i * GAP
      schedule(endAt, () => {
        setBusy(false)
        setOrbState("speaking")
        setAnswer(FINAL_ANSWER)
        pushFeed({ id: `a-${turn}`, kind: "answer", text: FINAL_ANSWER, at: Date.now() })
      })
      schedule(endAt + 2800, () => setOrbState("idle"))
    },
    [clearTimers, schedule, pushFeed, updateFeed]
  )

  // Kick off the scripted conversation on mount (and again on replay via remount).
  useEffect(() => {
    runTurn(INITIAL_PROMPT, buildReads(), buildWrites())
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spawnMore = useCallback(() => {
    const base = ++turnRef.current
    const extras = buildExtras()
    setOrbState("thinking")
    extras.forEach((r, k) => {
      const id = `x${base}-${k}-${r.tool}`
      schedule(k * 400, () => {
        dispatch({ type: "TOOL_CALL", id, tool: r.tool, label: r.label, kind: "read" })
        pushFeed({ id: `f-${id}`, kind: "tool", text: r.label, at: Date.now(), state: "running" })
      })
      schedule(k * 400 + 500, () => {
        dispatch({ type: "TOOL_RESULT", id, ok: true, data: r.data })
        updateFeed(`f-${id}`, { state: "done" })
      })
    })
    schedule(extras.length * 400 + 900, () => setOrbState("idle"))
  }, [schedule, pushFeed, updateFeed])

  /* ----- the OSContextValue surface (mirrors the real provider) ----- */
  const send = useCallback(
    (text: string) => runTurn(text, buildSendReads(), []),
    [runTurn]
  )
  const stop = useCallback(() => {
    clearTimers()
    setBusy(false)
    setOrbState("idle")
  }, [clearTimers])

  const applyConfirm = useCallback(
    (card: Card, _typed: string) => {
      dispatch({ type: "APPLY_START", id: card.id })
      schedule(900, () => {
        const undo =
          card.tool === "create_discount"
            ? { token: "mock-undo-discount", label: "Undo — delete this code" }
            : null
        const message =
          card.tool === "refund_order"
            ? "Refunded USD 40 to Maya Rahman on order #1043."
            : "Discount code WELCOME15 is live and usable at checkout."
        dispatch({ type: "APPLY_RESULT", id: card.id, ok: true, message, undo })
      })
    },
    [schedule]
  )
  const applyUndo = useCallback(
    (card: Card) => {
      schedule(700, () =>
        dispatch({ type: "APPLY_RESULT", id: card.id, ok: true, message: "Reverted.", undo: null })
      )
    },
    [schedule]
  )

  const focusCard = useCallback((id: string) => dispatch({ type: "FOCUS", id }), [])
  const minimizeCard = useCallback((id: string) => dispatch({ type: "MINIMIZE", id }), [])
  const dismissCard = useCallback((id: string) => dispatch({ type: "DISMISS", id }), [])
  const setCapacity = useCallback(
    (n: number) => dispatch({ type: "SET_CAPACITY", maxExpanded: Math.max(1, n) }),
    []
  )
  const navigate = useCallback((_href: string) => {
    /* preview: navigation is a no-op so the demo never leaves the surface */
  }, [])

  const cards = activeCards(store)
  const dock = dockCards(store)

  const value = useMemo(
    () => ({
      store,
      cards,
      dock,
      focusId: store.focusId,
      busy,
      answer,
      feed,
      orbState,
      interim: "",
      voice: {
        supported: false,
        listening: false,
        speaking: false,
        handsFree: false,
        toggleListening: () => {},
        setHandsFree: (_v: boolean) => {},
        stopSpeaking: () => {},
      },
      send,
      stop,
      applyConfirm,
      applyUndo,
      focusCard,
      minimizeCard,
      dismissCard,
      setCapacity,
      navigate,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, busy, answer, feed, orbState]
  )

  return (
    <OSContext.Provider value={value}>
      <Surface onClose={onReplay} />
      <DemoToolbar
        orbState={orbState}
        busy={busy}
        onReplay={onReplay}
        onSpawn={spawnMore}
        onOrb={setOrbState}
      />
    </OSContext.Provider>
  )
}

export default function JarvisPreview() {
  const [runId, setRunId] = useState(0)
  return <PreviewProvider key={runId} onReplay={() => setRunId((n) => n + 1)} />
}
