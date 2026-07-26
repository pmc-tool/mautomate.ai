"use client"

/**
 * Voice SIMULATOR (monetization plan P3).
 *
 * A fully canned demo of live voice: a scripted conversation types itself
 * out over a pulsing orb, clearly watermarked SIMULATION. Zero vendor calls
 * — no STT, no TTS, no LLM — so it costs nothing and cannot be farmed.
 * Opened via the `mautomate:voice-demo` event (the gate modal's
 * "Watch the demo" button).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type Turn = { who: "you" | "jarvis"; text: string }

const SCRIPT: Turn[] = [
  { who: "you", text: "Pixi, how did the store do today?" },
  {
    who: "jarvis",
    text: "Today you took 12 orders for $438. Three are waiting to be fulfilled - want me to prepare the shipments?",
  },
  { who: "you", text: "Yes, and how is the blue hoodie selling?" },
  {
    who: "jarvis",
    text: "The blue hoodie sold 5 units this week and stock is down to 8. At this pace it sells out in 11 days - I can draft a restock order now.",
  },
  { who: "you", text: "Do it, and push a post about the sale to Facebook." },
  {
    who: "jarvis",
    text: "Restock drafted for your approval, and the sale post is scheduled for 6 PM - your audience's peak hour. Anything else?",
  },
]

export function VoiceDemoOverlay() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [typing, setTyping] = useState("")
  const [done, setDone] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const reduced = useRef(false)

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }

  const close = useCallback(() => {
    clearTimers()
    setOpen(false)
    setTurns([])
    setTyping("")
    setDone(false)
  }, [])

  // Play the script: each turn "types" in, paced like a real conversation.
  const play = useCallback(() => {
    clearTimers()
    setTurns([])
    setTyping("")
    setDone(false)
    let at = 400
    SCRIPT.forEach((turn, i) => {
      const t = setTimeout(() => {
        if (reduced.current) {
          setTurns((prev) => [...prev, turn])
          if (i === SCRIPT.length - 1) setDone(true)
          return
        }
        // Type the text out, then commit the turn.
        const chars = turn.text.split("")
        chars.forEach((_, j) => {
          const tt = setTimeout(() => {
            setTyping(turn.text.slice(0, j + 1))
            if (j === chars.length - 1) {
              const commit = setTimeout(() => {
                setTyping("")
                setTurns((prev) => [...prev, turn])
                if (i === SCRIPT.length - 1) setDone(true)
              }, 250)
              timers.current.push(commit)
            }
          }, j * 14)
          timers.current.push(tt)
        })
      }, at)
      timers.current.push(t)
      at += 900 + turn.text.length * 14 + (turn.who === "jarvis" ? 700 : 300)
    })
  }, [])

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
    const onOpen = () => {
      setOpen(true)
      play()
    }
    window.addEventListener("mautomate:voice-demo", onOpen)
    return () => {
      window.removeEventListener("mautomate:voice-demo", onOpen)
      clearTimers()
    }
  }, [play])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-[#0B0C10] p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Voice demo (simulation)"
    >
      <div className="absolute left-4 top-4 rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
        Simulation - not a live call
      </div>
      <button
        type="button"
        onClick={close}
        className="absolute right-4 top-4 rounded-base px-3 py-1.5 text-sm text-white/70 transition-colors hover:text-white"
      >
        Close
      </button>

      {/* The orb: pure CSS pulse, no audio pipeline behind it. */}
      <div className="relative mb-8 h-28 w-28">
        <div className="absolute inset-0 animate-ping rounded-full bg-[#F26522]/20 [animation-duration:2.2s] motion-reduce:animate-none" />
        <div className="absolute inset-3 animate-pulse rounded-full bg-[#F26522]/30 [animation-duration:1.6s] motion-reduce:animate-none" />
        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[#F26522] to-[#B33A0E] shadow-[0_0_60px_rgba(242,101,34,0.45)]" />
      </div>

      <div className="flex max-h-[46vh] w-full max-w-lg flex-col gap-3 overflow-y-auto">
        {turns.map((t, i) => (
          <div
            key={i}
            className={
              t.who === "you"
                ? "self-end rounded-2xl rounded-br-sm bg-white/10 px-4 py-2.5 text-sm text-white"
                : "self-start rounded-2xl rounded-bl-sm bg-[#F26522]/15 px-4 py-2.5 text-sm text-[#FFD8C2]"
            }
          >
            {t.text}
          </div>
        ))}
        {typing && (
          <div className="self-start rounded-2xl rounded-bl-sm bg-[#F26522]/15 px-4 py-2.5 text-sm text-[#FFD8C2]">
            {typing}
          </div>
        )}
      </div>

      {done && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="max-w-md text-center text-sm text-white/70">
            This was a recording. On the Grow plan, Pixi speaks for real -
            live voice over your actual store data.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={play}
              className="rounded-base border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              Replay
            </button>
            <button
              type="button"
              onClick={() => {
                close()
                router.push("/dashboard/billing?tab=plans")
              }}
              className="rounded-base bg-[#F26522] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D9551A]"
            >
              Upgrade to unlock live voice
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
