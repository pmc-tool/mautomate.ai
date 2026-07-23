"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Phone, PhoneSolid, Spinner } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  CallTransfer,
  answerCallTransfer,
  declineCallTransfer,
  listCallTransfers,
} from "@lib/merchant-admin/api"

/**
 * IncomingCallWatcher — mounted once in the dashboard layout. Polls for
 * ringing human-transfer requests (an AI agent asked to hand a caller over)
 * and shows a ringing card anywhere in the dashboard. Answering joins the
 * caller's live room right here in the browser — no phone needed.
 */

const POLL_MS = 5000

export function IncomingCallWatcher() {
  const { token } = useMerchantAuth()
  const [ringing, setRinging] = useState<CallTransfer | null>(null)
  const [live, setLive] = useState<null | {
    transfer: CallTransfer
    room_url: string
    dailyToken: string
  }>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dismissed = useRef<Set<string>>(new Set())

  // Ring tone — synthesized (no asset), only while a card is showing.
  const audioCtxRef = useRef<AudioContext | null>(null)
  useEffect(() => {
    if (!ringing || live) return
    let stopped = false
    const Ctx =
      typeof window !== "undefined" &&
      ((window as any).AudioContext || (window as any).webkitAudioContext)
    if (!Ctx) return
    const ctx: AudioContext = audioCtxRef.current ?? new Ctx()
    audioCtxRef.current = ctx
    const ringOnce = () => {
      if (stopped || ctx.state === "closed") return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 1)
    }
    ringOnce()
    const iv = setInterval(ringOnce, 2500)
    return () => {
      stopped = true
      clearInterval(iv)
    }
  }, [ringing, live])

  const poll = useCallback(async () => {
    if (!token || live) return
    try {
      const res = await listCallTransfers(token, "ringing")
      const next = (res.transfers ?? []).find(
        (t) => !dismissed.current.has(t.id)
      )
      setRinging(next ?? null)
    } catch {
      /* polling is best-effort */
    }
  }, [token, live])

  useEffect(() => {
    if (!token) return
    poll()
    const iv = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) poll()
    }, POLL_MS)
    return () => clearInterval(iv)
  }, [token, poll])

  const answer = async () => {
    if (!token || !ringing) return
    setBusy(true)
    setError(null)
    try {
      const res = await answerCallTransfer(token, ringing.id)
      setLive({
        transfer: ringing,
        room_url: res.room_url,
        dailyToken: res.token,
      })
      setRinging(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer")
      dismissed.current.add(ringing.id)
      setTimeout(() => setRinging(null), 2500)
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    if (!token || !ringing) return
    dismissed.current.add(ringing.id)
    const id = ringing.id
    setRinging(null)
    try {
      await declineCallTransfer(token, id)
    } catch {
      /* best-effort */
    }
  }

  if (live) {
    return (
      <LiveCallWindow
        callerNumber={live.transfer.caller_number}
        roomUrl={live.room_url}
        token={live.dailyToken}
        onEnded={() => setLive(null)}
      />
    )
  }

  if (!ringing) return null

  return (
    <div className="fixed bottom-6 right-6 z-[80] w-80 rounded-large border border-grey-20 bg-white p-5 shadow-2xl">
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-200 opacity-60" />
          <PhoneSolid className="relative h-5 w-5 text-emerald-600" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-grey-90">Incoming call</p>
          <p className="truncate text-sm text-grey-50">
            {ringing.caller_number ? (
              <span className="font-mono text-[13px]">{ringing.caller_number}</span>
            ) : (
              "A customer on your store"
            )}{" "}
            — your AI agent is asking for a human.
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={answer}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-base bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? <Spinner className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          Answer
        </button>
        <button
          onClick={decline}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-base border border-grey-30 bg-white px-4 py-2.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

/** The in-browser call window once a transfer is answered (mic + audio). */
function LiveCallWindow({
  callerNumber,
  roomUrl,
  token,
  onEnded,
}: {
  callerNumber: string | null
  roomUrl: string
  token: string
  onEnded: () => void
}) {
  const [status, setStatus] = useState<"connecting" | "live" | "ended">(
    "connecting"
  )
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const callRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const join = async () => {
      try {
        const mod = await import("@daily-co/daily-js")
        if (cancelled) return
        const call = mod.default.createCallObject({
          subscribeToTracksAutomatically: true,
        })
        callRef.current = call

        const attach = () => {
          const parts: any = call.participants()
          const el = audioRef.current
          if (!el) return
          for (const key of Object.keys(parts)) {
            if (key === "local") continue
            const track = parts[key]?.tracks?.audio?.persistentTrack
            if (track) {
              el.srcObject = new MediaStream([track])
              el.play().catch(() => {})
              return
            }
          }
        }
        call.on("track-started", attach)
        call.on("participant-joined", attach)
        call.on("participant-left", attach)
        call.on("left-meeting", () => {
          setStatus("ended")
          setTimeout(onEnded, 800)
        })

        await call.join({ url: roomUrl, token })
        if (cancelled) return
        await call.setLocalAudio(true)
        setStatus("live")
        attach()
        timer = setInterval(() => setSeconds((s) => s + 1), 1000)
      } catch {
        setStatus("ended")
        setTimeout(onEnded, 1200)
      }
    }
    join()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      const call = callRef.current
      if (call) {
        try {
          call.leave().then(() => call.destroy())
        } catch {
          /* already gone */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token])

  const hangUp = () => {
    const call = callRef.current
    if (call) {
      try {
        call.leave()
      } catch {
        onEnded()
      }
    } else {
      onEnded()
    }
  }

  const toggleMute = () => {
    const call = callRef.current
    if (!call) return
    const next = !muted
    setMuted(next)
    try {
      call.setLocalAudio(!next)
    } catch {
      /* best-effort */
    }
  }

  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, "0")

  return (
    <div className="fixed bottom-6 right-6 z-[80] w-80 rounded-large border border-grey-20 bg-white p-5 shadow-2xl">
      <audio ref={audioRef} autoPlay className="hidden" />
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
          {status === "live" && (
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-100" />
          )}
          <PhoneSolid className="relative h-5 w-5 text-emerald-600" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-grey-90">
            {status === "connecting"
              ? "Connecting…"
              : status === "live"
              ? "On the line"
              : "Call ended"}
          </p>
          <p className="truncate text-sm text-grey-50">
            {callerNumber ? (
              <span className="font-mono text-[13px]">{callerNumber}</span>
            ) : (
              "Customer"
            )}
            {status === "live" && (
              <span className="ml-2 tabular-nums text-grey-40">
                {mm}:{ss}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={toggleMute}
          className="inline-flex flex-1 items-center justify-center rounded-base border border-grey-30 bg-white px-4 py-2.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={hangUp}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-base bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500"
        >
          End call
        </button>
      </div>
    </div>
  )
}
