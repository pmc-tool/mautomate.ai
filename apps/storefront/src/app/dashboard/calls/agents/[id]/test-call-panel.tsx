"use client"

import React, { useEffect, useRef, useState } from "react"
import { Phone, XMarkMini } from "@medusajs/icons"
import { SectionCard } from "@components/merchant-admin/section-card"
import {
  startAgentTestCall,
  endAgentTestCall,
  ApiError,
} from "@lib/merchant-admin/api"

type CallState = "idle" | "connecting" | "live" | "ending" | "ended" | "error"

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
  disabled,
  disabledReason,
}: {
  token: string | null
  agentId: string
  disabled?: boolean
  disabledReason?: string
}) {
  const [state, setState] = useState<CallState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [botDispatched, setBotDispatched] = useState(true)

  // Live refs (kept out of state so listeners always see the latest).
  const callObjRef = useRef<any>(null)
  const callIdRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Tear the call down on unmount so a navigation never strands a live room.
  useEffect(() => {
    return () => {
      void teardown(false)
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

    let session: { call_id: string; room_url: string; token: string; bot_dispatched: boolean }
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

    setBotDispatched(session.bot_dispatched)
    callIdRef.current = session.call_id

    // LAZY-load daily-js only when a call actually starts.
    let DailyIframe: any
    try {
      const mod = await import("@daily-co/daily-js")
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

  return (
    <SectionCard
      title="Talk to your agent"
      description="Start a live voice call in your browser to hear and test this agent, exactly as your customers would."
    >
      {/* Hidden sink for the agent's remote audio. */}
      <audio ref={audioRef} className="hidden" />

      {disabled && (
        <p className="mb-3 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {disabledReason || "Save the agent before starting a test call."}
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-base border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {live && !botDispatched && (
        <p className="mb-3 rounded-base border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          You are connected, but the AI agent did not join — the voice service
          may be offline. You can still verify the connection.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {state === "idle" || state === "ended" || state === "error" ? (
          <button
            onClick={start}
            disabled={!token || disabled}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Phone className="h-4 w-4" />
            {state === "ended" || state === "error" ? "Call again" : "Start test call"}
          </button>
        ) : null}

        {connecting && (
          <span className="inline-flex items-center gap-2 text-sm text-grey-60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Connecting…
          </span>
        )}

        {live && (
          <>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
            <button
              onClick={toggleMute}
              className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-5"
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              onClick={end}
              className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <XMarkMini className="h-4 w-4" />
              End
            </button>
          </>
        )}

        {state === "ending" && (
          <span className="text-sm text-grey-60">Ending…</span>
        )}
        {state === "ended" && (
          <span className="text-sm text-grey-50">Call ended.</span>
        )}
      </div>

      <p className="mt-3 text-xs text-grey-50">
        This uses your microphone. Your browser will ask for permission the first
        time.
      </p>
    </SectionCard>
  )
}

export default TestCallPanel
