"use client"

import React, { useEffect, useRef, useState } from "react"
import { Phone, XMarkMini } from "@medusajs/icons"
import {
  startAgentTestCall,
  endAgentTestCall,
  ApiError,
} from "@lib/merchant-admin/api"

type CallState = "idle" | "connecting" | "live" | "ending" | "ended" | "error"

// Presentation helper: initials for the agent avatar circle.
function agentInitials(name?: string): string {
  return (
    (name || "")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AI"
  )
}

/**
 * TestCallPanel — "Talk to your agent".
 *
 * A self-contained client widget that lets a merchant have a live voice
 * conversation with their AI agent in the browser (Daily WebRTC). On click it
 * asks the backend for a room + token (backend also dispatches the bot), then
 * LAZY-loads @daily-co/daily-js (so it never bloats the main bundle), joins the
 * room audio-only, and attaches the agent's remote audio track to an <audio>
 * element so the merchant can hear it. Includes mute + End controls and a
 * friendly message if the browser blocks the microphone.
 */
export function TestCallPanel({
  token,
  agentId,
  agentName,
  disabled,
  disabledReason,
}: {
  token: string | null
  agentId: string
  /** Presentation only — used for the avatar initials. */
  agentName?: string
  disabled?: boolean
  disabledReason?: string
}) {
  const [state, setState] = useState<CallState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [botDispatched, setBotDispatched] = useState(true)
  const [agentReady, setAgentReady] = useState(false)

  // Live refs (kept out of state so listeners always see the latest).
  const callObjRef = useRef<any>(null)
  const callIdRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // INSTANT PICKUP — pre-warm a session (room + bot) the moment the panel
  // mounts, so clicking Talk only has to join: the agent answers in ~1-2s
  // instead of ~4-5s. The bot waits alone in the room and self-expires
  // (unbilled) if never joined; we also end it on unmount. The freshness
  // window stays safely inside the bot's server-side join timeout.
  const PREWARM_FRESH_MS = 240_000
  const prewarmRef = useRef<{
    session: { call_id: string; room_url: string; token: string; bot_dispatched: boolean }
    at: number
  } | null>(null)
  const dailyModRef = useRef<Promise<any> | null>(null)

  useEffect(() => {
    if (!token || disabled) return
    let cancelled = false
    // Preload the voice engine off the click path.
    dailyModRef.current = import("@daily-co/daily-js").catch(() => null)
    ;(async () => {
      try {
        const session = await startAgentTestCall(token, agentId)
        if (cancelled) {
          // Panel closed before the warm-up finished — release it.
          void endAgentTestCall(token, agentId, session.call_id).catch(() => {})
          return
        }
        prewarmRef.current = { session, at: Date.now() }
        setAgentReady(true)
        // Drop the "standing by" signal when the pre-warm goes stale.
        setTimeout(() => {
          if (prewarmRef.current && Date.now() - prewarmRef.current.at >= PREWARM_FRESH_MS) {
            setAgentReady(false)
          }
        }, PREWARM_FRESH_MS + 1000)
      } catch {
        // Pre-warm is pure optimization — clicking Talk still works cold.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, disabled])

  // Tear the call down on unmount so a navigation never strands a live room,
  // and release an unused pre-warmed bot so it doesn't idle out the window.
  useEffect(() => {
    return () => {
      void teardown(false)
      const pw = prewarmRef.current
      prewarmRef.current = null
      if (pw && token) {
        void endAgentTestCall(token, agentId, pw.session.call_id).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const attachRemoteAudio = (track: MediaStreamTrack) => {
    if (!audioRef.current) return
    const stream = new MediaStream([track])
    audioRef.current.srcObject = stream
    audioRef.current.autoplay = true
    void audioRef.current.play().catch(() => {
      // Autoplay can be blocked until a user gesture; the click that started
      // the call counts, so this is rarely hit — swallow if it is.
    })
  }

  const teardown = async (notifyBackend: boolean) => {
    const co = callObjRef.current
    callObjRef.current = null
    if (co) {
      try {
        await co.leave()
      } catch {
        /* noop */
      }
      try {
        await co.destroy()
      } catch {
        /* noop */
      }
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null
    }
    const cid = callIdRef.current
    callIdRef.current = null
    if (notifyBackend && token && cid) {
      try {
        await endAgentTestCall(token, agentId, cid)
      } catch {
        /* best-effort; the call still expires on its own */
      }
    }
  }

  const start = async () => {
    if (!token || disabled) return
    setError(null)
    setMuted(false)
    setState("connecting")

    // Use the pre-warmed session when it's still fresh (the bot is already
    // waiting in the room); otherwise release it and start cold.
    let session: { call_id: string; room_url: string; token: string; bot_dispatched: boolean }
    const pw = prewarmRef.current
    prewarmRef.current = null
    setAgentReady(false)
    if (pw && Date.now() - pw.at < PREWARM_FRESH_MS) {
      session = pw.session
    } else {
      if (pw) {
        void endAgentTestCall(token, agentId, pw.session.call_id).catch(() => {})
      }
      try {
        session = await startAgentTestCall(token, agentId)
      } catch (e) {
        setState("error")
        setError(
          e instanceof ApiError || e instanceof Error
            ? e.message
            : "Could not start the test call."
        )
        return
      }
    }

    setBotDispatched(session.bot_dispatched)
    callIdRef.current = session.call_id

    // The voice engine is usually preloaded at mount; this await is then free.
    let DailyIframe: any
    try {
      const mod =
        (await (dailyModRef.current || import("@daily-co/daily-js"))) ||
        (await import("@daily-co/daily-js"))
      DailyIframe = mod.default ?? mod
    } catch (e) {
      setState("error")
      setError("Could not load the voice engine. Please refresh and try again.")
      await teardown(true)
      return
    }

    let co: any
    try {
      co = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      })
      callObjRef.current = co

      co.on("track-started", (ev: any) => {
        if (!ev?.participant || ev.participant.local) return
        if (ev.track?.kind === "audio") {
          attachRemoteAudio(ev.track)
        }
      })
      co.on("left-meeting", () => {
        setState((s) => (s === "ending" || s === "ended" ? s : "ended"))
      })
      co.on("error", (ev: any) => {
        setState("error")
        setError(ev?.errorMsg || "The call ran into a problem.")
      })
      // Mic / camera permission problems surface here.
      co.on("camera-error", () => {
        setState("error")
        setError(
          "We could not access your microphone. Please allow mic access in your browser and try again."
        )
        void teardown(true)
      })

      await co.join({ url: session.room_url, token: session.token })
      setState("live")
    } catch (e: any) {
      const name = e?.name || ""
      if (name === "NotAllowedError" || /permission|denied|mic/i.test(String(e?.message))) {
        setError(
          "We could not access your microphone. Please allow mic access in your browser and try again."
        )
      } else {
        setError(e?.message || "Could not connect the call.")
      }
      setState("error")
      await teardown(true)
    }
  }

  const toggleMute = () => {
    const co = callObjRef.current
    if (!co) return
    const next = !muted
    try {
      co.setLocalAudio(!next)
      setMuted(next)
    } catch {
      /* noop */
    }
  }

  const end = async () => {
    setState("ending")
    await teardown(true)
    setState("ended")
  }

  const live = state === "live"
  const connecting = state === "connecting"
  const canStart = state === "idle" || state === "ended" || state === "error"

  const statusLine = live ? (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      Live — say hello
    </span>
  ) : connecting ? (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-amber-700">
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
      Connecting…
    </span>
  ) : state === "ending" ? (
    <span className="text-sm text-grey-60">Ending…</span>
  ) : state === "ended" ? (
    <span className="text-sm text-grey-50">Call ended.</span>
  ) : agentReady && state === "idle" ? (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Agent standing by
    </span>
  ) : (
    <span className="text-sm text-grey-50">
      {disabled ? "Not ready yet" : "Ready when you are"}
    </span>
  )

  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      {/* Local keyframes for the live "waveform" pulse. */}
      <style>{`
        @keyframes tcp-wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>

      {/* Hidden sink for the agent's remote audio. */}
      <audio ref={audioRef} className="hidden" />

      <div className="border-b border-grey-10 px-5 py-4">
        <h2 className="text-sm font-semibold text-grey-90">Talk to your agent</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-grey-50">
          A live browser call — hear and test this agent exactly as your customers would.
        </p>
      </div>

      <div className="flex flex-col items-center bg-grey-5 px-5 py-8">
        {/* Avatar */}
        <div className="relative">
          {live && (
            <span className="absolute -inset-2 animate-ping rounded-full bg-emerald-400 opacity-20" />
          )}
          <div
            className={
              "relative flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white transition-colors " +
              (live ? "bg-emerald-600" : "bg-grey-90")
            }
          >
            {agentInitials(agentName)}
          </div>
        </div>

        {/* Waveform while live, status line otherwise stacked below. */}
        <div className="mt-4 flex h-6 items-center justify-center">
          {live ? (
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-emerald-500"
                  style={{
                    height: "20px",
                    animation: "tcp-wave 1.1s ease-in-out infinite",
                    animationDelay: `${i * 130}ms`,
                  }}
                />
              ))}
            </div>
          ) : (
            statusLine
          )}
        </div>
        {live && <div className="mt-2">{statusLine}</div>}

        {/* Call controls */}
        <div className="mt-6 flex items-end gap-6">
          {canStart && (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={start}
                disabled={!token || disabled}
                aria-label={state === "ended" || state === "error" ? "Call again" : "Start test call"}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md transition-all hover:bg-emerald-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Phone className="h-6 w-6" />
              </button>
              <span className="text-xs font-medium text-grey-60">
                {state === "ended" || state === "error" ? "Call again" : "Talk"}
              </span>
            </div>
          )}

          {connecting && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-grey-20 text-grey-50">
                <Phone className="h-6 w-6 animate-pulse" />
              </div>
              <span className="text-xs font-medium text-grey-50">Connecting</span>
            </div>
          )}

          {live && (
            <>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                  className={
                    "flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold transition-colors " +
                    (muted
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-grey-20 bg-white text-grey-70 hover:bg-grey-5")
                  }
                >
                  {muted ? "Off" : "Mic"}
                </button>
                <span className="text-xs font-medium text-grey-60">
                  {muted ? "Unmute" : "Mute"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={end}
                  aria-label="End call"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition-all hover:bg-rose-600 hover:shadow-lg"
                >
                  <XMarkMini className="h-6 w-6" />
                </button>
                <span className="text-xs font-medium text-grey-60">End</span>
              </div>
            </>
          )}

          {state === "ending" && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-grey-20 text-grey-50">
                <XMarkMini className="h-6 w-6" />
              </div>
              <span className="text-xs font-medium text-grey-50">Ending</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        {disabled && (
          <p className="rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {disabledReason || "Save the agent before starting a test call."}
          </p>
        )}

        {error && (
          <p className="rounded-base border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {live && !botDispatched && (
          <p className="rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            You are connected, but the AI agent did not join — the voice service
            may be offline. You can still verify the connection.
          </p>
        )}

        <p className="text-xs text-grey-50">
          This uses your microphone. Your browser will ask for permission the first
          time.
        </p>
      </div>
    </div>
  )
}

export default TestCallPanel
