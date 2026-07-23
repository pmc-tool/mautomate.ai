"use client"

/* ------------------------------------------------------------------ */
/* JarvisOSProvider — the brain.                                        */
/*                                                                     */
/* Owns the card store (reducer), the conversation history, the command  */
/* feed, the answer caption, and the derived orb state; runs the SSE loop  */
/* and maps every event onto card-store actions. The orb, CardHost rails,   */
/* SignalLines overlay, Dock, ask bar and feed all read this ONE context.     */
/* ------------------------------------------------------------------ */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { useJarvisVoice } from "@lib/merchant-admin/use-jarvis-voice"
import {
  useJarvisRealtimeVoice,
  type RealtimeStatus,
  type PendingRow,
} from "@lib/merchant-admin/use-jarvis-realtime-voice"
import type { JarvisState } from "../jarvis-core"
import {
  cardReducer,
  initialCardStore,
  activeCards,
  dockCards,
  type Card,
  type CardStoreState,
} from "./card-store"
import { runJarvisStream, type ChatTurn } from "./use-jarvis-stream"
import { WRITE_TOOLS } from "./tool-catalog"
import { getCardEntry } from "./card-registry"

/* Client-side tool classification (spec §2.6): the write list is authoritative
   for choosing the card kind at the tool_call phase (which carries no kind). */
const WRITE_SET = new Set<string>(WRITE_TOOLS as readonly string[])
const isWriteName = (n?: string): boolean => !!n && WRITE_SET.has(n)
const toolLabel = (n?: string): string =>
  n ? getCardEntry(n).title : "Working"

export type FeedEntry = {
  id: string
  kind: "prompt" | "tool" | "answer" | "error"
  text: string
  at: number
  state?: "running" | "done" | "error"
}

/**
 * The real-time voice surface, exposed on the OS context so the ask bar can
 * render the voice on/off toggle + connect/retry affordances and the orb can
 * pulse to the live voice. OPTIONAL: the public preview harness builds its own
 * OSContext value without it, so consumers must treat `rt` as possibly absent.
 *
 * NO AUTOPLAY: voice is OFF by default and never connects when the surface
 * opens. `voiceOn` is the user-controlled gate — flip it via `toggleVoice`
 * (or `setVoiceOn`) and only then does the hook start the Daily call. Turning
 * it off tears the call down. `toggleMic` remains a secondary mute of an
 * already-connected call.
 * NOTE: the fast-moving 0..1 orb `level` is deliberately NOT here — it flows
 * through the separate OrbSignalContext so cards never re-render at ~30fps.
 */
export type OSRealtimeVoice = {
  status: RealtimeStatus
  /** User-controlled voice-session gate. FALSE by default (no autoplay). */
  voiceOn: boolean
  /** Turn the always-on listening session on/off (connect/disconnect). */
  toggleVoice: () => void
  /** Set the voice-session gate explicitly. */
  setVoiceOn: (v: boolean) => void
  micLive: boolean
  toggleMic: () => void
  orbState: JarvisState
  interim: string
  reply: string
  soundBlocked: boolean
  enableSound: () => void
  micDenied: boolean
  retry: () => void
}

type OSContextValue = {
  store: CardStoreState
  cards: Card[]
  dock: Card[]
  focusId: string | null
  busy: boolean
  answer: string
  feed: FeedEntry[]
  orbState: JarvisState
  interim: string
  voice: {
    supported: boolean
    listening: boolean
    speaking: boolean
    handsFree: boolean
    toggleListening: () => void
    setHandsFree: (v: boolean) => void
    stopSpeaking: () => void
  }
  /** Embedded always-on real-time voice (absent in the mock preview). */
  rt?: OSRealtimeVoice
  send: (text: string) => void
  stop: () => void
  applyConfirm: (card: Card, typed: string) => void
  applyUndo: (card: Card) => void
  focusCard: (id: string) => void
  minimizeCard: (id: string) => void
  dismissCard: (id: string) => void
  setCapacity: (n: number) => void
  navigate: (href: string) => void
}

export const OSContext = createContext<OSContextValue | null>(null)

export function useJarvisOS(): OSContextValue {
  const ctx = useContext(OSContext)
  if (!ctx) throw new Error("useJarvisOS must be used within JarvisOSProvider")
  return ctx
}

/* ------------------------------------------------------------------ */
/* OrbSignalContext — the high-frequency (~30fps) voice level + orb state  */
/* for the orb ONLY. Kept apart from OSContext so the level ticking never   */
/* re-renders the card grid. Tolerates a missing provider (the preview        */
/* harness mounts the Surface without it) by returning a static default.       */
/* ------------------------------------------------------------------ */
export type OrbSignal = {
  level: number
  orbState: JarvisState
  connected: boolean
}

const OrbSignalContext = createContext<OrbSignal | null>(null)

export function useOrbSignal(): OrbSignal {
  return (
    useContext(OrbSignalContext) ?? {
      level: 0,
      orbState: "idle",
      connected: false,
    }
  )
}

export function JarvisOSProvider({
  children,
  onNavigateClose,
}: {
  children: React.ReactNode
  onNavigateClose?: () => void
  /**
   * @deprecated No longer auto-connects voice. Voice is OFF by default and only
   * starts when the user turns it on from the ask bar (`voiceOn`). Kept optional
   * for API compatibility; ignored.
   */
  voiceEnabled?: boolean
}) {
  const { token } = useMerchantAuth()
  const [store, dispatch] = useReducer(cardReducer, initialCardStore)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState("")
  const [feed, setFeed] = useState<FeedEntry[]>([])
  // NO AUTOPLAY: the real-time voice session is user-controlled and starts OFF.
  // Nothing connects (no /voice/start, no mic prompt) until the merchant turns
  // voice on from the ask bar. Typed chat + cards work fully with this false.
  const [voiceOn, setVoiceOn] = useState(false)
  const toggleVoice = useCallback(() => setVoiceOn((v) => !v), [])

  const historyRef = useRef<ChatTurn[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const storeRef = useRef(store)
  storeRef.current = store
  const busyRef = useRef(false)
  busyRef.current = busy
  const tokenRef = useRef(token)
  tokenRef.current = token
  const speakNextRef = useRef(false)

  const pushFeed = useCallback((e: FeedEntry) => {
    setFeed((prev) => [...prev.slice(-40), e])
  }, [])

  const updateFeed = useCallback((id: string, patch: Partial<FeedEntry>) => {
    setFeed((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }, [])

  /* ------------------------------- voice ------------------------------ */
  const voice = useJarvisVoice({
    onTranscript: (text) => {
      speakNextRef.current = true
      void send(text)
    },
  })

  /* ------------------- real-time voice -> card bridge ------------------ */
  // Correlate a voice WRITE's app-message (which never carries the plan token)
  // to the pending row that DOES (spec §2.5): pending_id -> card id.
  const voiceWriteByPendingId = useRef<Map<string, string>>(new Map())

  // Daily app-message -> the SAME card-store actions the text SSE path uses.
  const onVoiceMessage = useCallback(
    (data: any) => {
      if (!data || typeof data !== "object" || data.t !== "jarvis_tool") return
      if (data.phase === "call") {
        const kind = isWriteName(data.name) ? "write" : "read"
        dispatch({
          type: "TOOL_CALL",
          id: data.id,
          tool: data.name,
          label: toolLabel(data.name),
          kind,
          args: data.args,
        })
        pushFeed({
          id: `t-${data.id}`,
          kind: "tool",
          text: toolLabel(data.name),
          at: Date.now(),
          state: "running",
        })
      } else if (data.phase === "result") {
        const isWrite = data.kind === "write" || !!data.proposed
        if (!isWrite) {
          dispatch({
            type: "TOOL_RESULT",
            id: data.id,
            ok: data.ok !== false,
            data: data.data,
            error: data.error ?? null,
          })
          updateFeed(`t-${data.id}`, {
            state: data.ok === false ? "error" : "done",
          })
        } else {
          // WRITE: leave the card awaiting its plan token — the token arrives via
          // the /voice/pending poll, which flips it to a ConfirmCard (§2.5).
          dispatch({ type: "TOOL_STATE", id: data.id, state: "running" })
          if (data.pending_id != null) {
            voiceWriteByPendingId.current.set(String(data.pending_id), data.id)
          }
          updateFeed(`t-${data.id}`, { state: "done" })
        }
      }
    },
    [pushFeed, updateFeed]
  )

  // Pending confirm rows carry the plan token; dispatch CONFIRM on the matching
  // write card so the existing ConfirmCard renders (reuses the text flow).
  const onVoicePending = useCallback((rows: PendingRow[]) => {
    const s = storeRef.current
    for (const r of rows) {
      if (!r || !r.token) continue
      const action = (r.action as string) || undefined
      let cardId =
        r.id != null
          ? voiceWriteByPendingId.current.get(String(r.id))
          : undefined
      if (!cardId) {
        // Fallback: correlate by action name among still-pending write cards.
        for (const id of s.order) {
          const c = s.byId[id]
          if (
            c &&
            c.kind === "write" &&
            (c.status === "loading" || c.status === "spawning") &&
            (!action || c.tool === action)
          ) {
            cardId = id
            break
          }
        }
      }
      if (!cardId) continue
      const existing = s.byId[cardId]
      // Idempotent: don't re-fire once the same token is already proposed.
      if (existing?.confirm?.token === r.token) continue
      dispatch({
        type: "CONFIRM",
        id: cardId,
        tool: action || existing?.tool,
        label: toolLabel(action || existing?.tool),
        confirm: {
          tier: r.tier === "hard" ? "hard" : "soft",
          requireText: r.require_text ?? null,
          summary: r.summary || "Confirm this change?",
          details: {},
          token: r.token,
          exp: Number(r.exp) || Math.floor(Date.now() / 1000) + 120,
        },
      })
    }
  }, [])

  const rt = useJarvisRealtimeVoice({
    token,
    // Gated on the user's voiceOn toggle (default false) — the hook only spins
    // up the Daily call once the merchant turns voice on. On open this is
    // false, so NOTHING connects.
    enabled: voiceOn && !!token,
    onAppMessage: onVoiceMessage,
    onPending: onVoicePending,
  })

  /* ------------------------------- send ------------------------------- */
  const send = useCallback(
    async (raw: string) => {
      const message = (raw || "").trim()
      const tok = tokenRef.current
      if (!message || busyRef.current || !tok) return

      dispatch({ type: "TURN_START" })
      setAnswer("")
      pushFeed({
        id: `p-${Date.now()}`,
        kind: "prompt",
        text: message,
        at: Date.now(),
      })
      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, content: message },
      ].slice(-8)

      const ac = new AbortController()
      abortRef.current = ac
      setBusy(true)

      try {
        await runJarvisStream({
          token: tok,
          message,
          history: historyRef.current.slice(0, -1),
          signal: ac.signal,
          onToolCall: (e) => {
            dispatch({
              type: "TOOL_CALL",
              id: e.id,
              tool: e.name,
              label: e.label || e.name,
              kind: e.kind === "write" ? "write" : "read",
              args: e.args,
            })
            pushFeed({
              id: `t-${e.id}`,
              kind: "tool",
              text: e.label || e.name,
              at: Date.now(),
              state: "running",
            })
          },
          onTool: (e) => {
            // Legacy fallback: if no tool_call preceded this, spawn a card so
            // reads still render on backends without the new events.
            if (e.state === "running" && !storeRef.current.byId[e.id]) {
              dispatch({
                type: "TOOL_CALL",
                id: e.id,
                tool: e.name || "tool",
                label: e.label || e.name || "Working",
                kind: "read",
              })
              pushFeed({
                id: `t-${e.id}`,
                kind: "tool",
                text: e.label || e.name || "Working",
                at: Date.now(),
                state: "running",
              })
            }
            dispatch({ type: "TOOL_STATE", id: e.id, state: e.state })
            if (e.state !== "running")
              updateFeed(`t-${e.id}`, {
                state: e.state === "error" ? "error" : "done",
              })
          },
          onToolResult: (e) => {
            dispatch({
              type: "TOOL_RESULT",
              id: e.id,
              ok: e.ok,
              data: e.data,
              error: e.error,
            })
          },
          onConfirm: (e) => {
            dispatch({
              type: "CONFIRM",
              id: e.id,
              tool: e.name || e.action,
              label: e.label || e.name || e.action,
              confirm: {
                tier: e.tier,
                requireText: e.require_text ?? null,
                summary: e.summary || "Confirm this change?",
                details: e.details || {},
                token: e.token,
                exp: e.exp,
              },
            })
          },
          onMessage: (text) => {
            setAnswer(text)
            historyRef.current = [
              ...historyRef.current,
              { role: "assistant" as const, content: text },
            ].slice(-8)
            pushFeed({
              id: `a-${Date.now()}`,
              kind: "answer",
              text,
              at: Date.now(),
            })
            if (speakNextRef.current || voice.handsFree) voice.speak(text)
            speakNextRef.current = false
          },
          onError: (msg) => {
            setAnswer(msg)
            pushFeed({ id: `e-${Date.now()}`, kind: "error", text: msg, at: Date.now() })
          },
          onDone: () => {
            // Graceful degradation: settle any read card still "loading"
            // (backend never sent tool_result) so nothing spins forever.
            const s = storeRef.current
            for (const id of s.order) {
              const c = s.byId[id]
              if (c && c.kind === "read" && c.status === "loading") {
                dispatch({ type: "TOOL_RESULT", id, ok: true, data: c.data })
              }
            }
          },
        })
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setAnswer("Something went wrong. Try again in a moment.")
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null
        setBusy(false)
      }
    },
    [pushFeed, updateFeed, voice]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    voice.stopSpeaking()
    setBusy(false)
  }, [voice])

  /* ------------------------- confirm / apply -------------------------- */
  const applyToken = useCallback(
    async (card: Card, planToken: string, typed: string) => {
      const tok = tokenRef.current
      if (!tok) return
      dispatch({ type: "APPLY_START", id: card.id })
      try {
        const resp = await fetch("/merchant/jarvis/apply", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tok}`,
          },
          body: JSON.stringify({ token: planToken, confirm_text: typed }),
        })
        const data: any = await resp.json().catch(() => ({}))
        if (resp.ok && data.ok) {
          dispatch({
            type: "APPLY_RESULT",
            id: card.id,
            ok: true,
            message: data.message || "Done.",
            undo: data.undo ?? null,
          })
          if (data.message && voice.handsFree) voice.speak(data.message)
        } else {
          dispatch({
            type: "APPLY_RESULT",
            id: card.id,
            ok: false,
            message: data.message || "That didn't go through.",
          })
        }
      } catch {
        dispatch({
          type: "APPLY_RESULT",
          id: card.id,
          ok: false,
          message: "Network error — try again.",
        })
      }
    },
    [voice]
  )

  const applyConfirm = useCallback(
    (card: Card, typed: string) => {
      if (!card.confirm) return
      void applyToken(card, card.confirm.token, typed)
    },
    [applyToken]
  )

  const applyUndo = useCallback(
    (card: Card) => {
      const undo = card.confirm?.undo
      if (!undo) return
      void applyToken(card, undo.token, "")
    },
    [applyToken]
  )

  /* ----------------------------- actions ------------------------------ */
  const focusCard = useCallback((id: string) => dispatch({ type: "FOCUS", id }), [])
  const minimizeCard = useCallback(
    (id: string) => dispatch({ type: "MINIMIZE", id }),
    []
  )
  const dismissCard = useCallback(
    (id: string) => dispatch({ type: "DISMISS", id }),
    []
  )
  const setCapacity = useCallback(
    (n: number) => dispatch({ type: "SET_CAPACITY", maxExpanded: Math.max(1, n) }),
    []
  )
  const navigate = useCallback(
    (href: string) => {
      onNavigateClose?.()
      if (typeof window !== "undefined") window.location.assign(href)
    },
    [onNavigateClose]
  )

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

  /* --------------------------- derived orb ---------------------------- */
  // When real-time voice is live, the orb state + level come straight from the
  // hook's analysers; otherwise fall back to the text/browser-voice derivation.
  const voiceConnected = rt.status === "connected"
  const orbState: JarvisState = voiceConnected
    ? rt.orbState
    : rt.status === "connecting" || rt.status === "reconnecting"
    ? "thinking"
    : voice.listening
    ? "listening"
    : busy && answer
    ? "speaking"
    : voice.speaking
    ? "speaking"
    : busy
    ? "thinking"
    : "idle"

  // Unify captions: the merchant's live transcript (voice or browser STT) and
  // the last spoken/streamed answer.
  const mergedInterim = voiceConnected ? rt.interim || voice.interim : voice.interim
  const mergedAnswer = answer || (voiceConnected ? rt.reply : "")

  const cards = activeCards(store)
  const dock = dockCards(store)

  // Assemble the OS-context voice surface (everything the ask bar needs).
  // Deliberately excludes the fast-moving 0..1 `level` — that flows through the
  // OrbSignalContext below so the card grid is never re-rendered by it.
  const rtSurface = useMemo<OSRealtimeVoice>(
    () => ({
      status: rt.status,
      voiceOn,
      toggleVoice,
      setVoiceOn,
      micLive: rt.micLive,
      toggleMic: rt.toggleMic,
      orbState: rt.orbState,
      interim: rt.interim,
      reply: rt.reply,
      soundBlocked: rt.soundBlocked,
      enableSound: rt.enableSound,
      micDenied: rt.micDenied,
      retry: rt.retry,
    }),
    [
      rt.status,
      voiceOn,
      toggleVoice,
      rt.micLive,
      rt.toggleMic,
      rt.orbState,
      rt.interim,
      rt.reply,
      rt.soundBlocked,
      rt.enableSound,
      rt.micDenied,
      rt.retry,
    ]
  )

  const value = useMemo<OSContextValue>(
    () => ({
      store,
      cards,
      dock,
      focusId: store.focusId,
      busy,
      answer: mergedAnswer,
      feed,
      orbState,
      interim: mergedInterim,
      voice: {
        supported: voice.supported,
        listening: voice.listening,
        speaking: voice.speaking,
        handsFree: voice.handsFree,
        toggleListening: voice.toggleListening,
        setHandsFree: voice.setHandsFree,
        stopSpeaking: voice.stopSpeaking,
      },
      rt: rtSurface,
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
    [store, busy, mergedAnswer, feed, orbState, mergedInterim, rtSurface, voice.listening, voice.speaking, voice.handsFree, voice.supported]
  )

  // High-frequency orb signal — its own context so ~30fps level ticks never
  // reach the card grid.
  const orbSignal = useMemo<OrbSignal>(
    () => ({ level: rt.level, orbState, connected: voiceConnected }),
    [rt.level, orbState, voiceConnected]
  )

  return (
    <OSContext.Provider value={value}>
      <OrbSignalContext.Provider value={orbSignal}>
        {children}
      </OrbSignalContext.Provider>
    </OSContext.Provider>
  )
}
