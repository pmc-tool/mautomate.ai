"use client"

/* ------------------------------------------------------------------ */
/* useJarvisRealtimeVoice — the always-on real-time voice engine.       */
/*                                                                     */
/* Extracted from components/merchant-admin/jarvis-stage/jarvis-stage.tsx  */
/* (the dark immersive stage) so the SAME Daily -> pipecat -> Pixi voice   */
/* flow can mount INSIDE the light Pixi OS. Owns: the Daily call object     */
/* (POST /merchant/jarvis/voice/start -> room + owner token + bot dispatch,     */
/* lazy import("@daily-co/daily-js"), createCallObject, join), the remote        */
/* bot-audio sink + honest autoplay handling, the local + remote RMS analysers   */
/* (a single rAF derives a 0..1 `level` and the orb `orbState`), the mute toggle  */
/* (co.setLocalAudio), the /voice/pending confirm poll, and honest failure UX     */
/* (no silent browser-voice fallback: on failure -> status "failed" + retry).     */
/*                                                                              */
/* CONFIRMED ALWAYS-ON: turn-taking (VAD / smart-turn) runs SERVER-SIDE in the   */
/* pipecat runtime; the browser never gates the mic. The mic is live the moment   */
/* the bot joins; `toggleMic` only mutes/unmutes. No click-to-talk.               */
/*                                                                              */
/* Daily permits exactly ONE global call object — a module-level lock ensures     */
/* only one mounted consumer (`enabled=true`) ever holds the live call.           */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react"
import type { JarvisState } from "@components/merchant-admin/jarvis-stage/jarvis-core"

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"

export type PendingRow = {
  id: string
  tier?: string
  require_text?: string | null
  summary?: string
  token: string
  exp?: number
  action?: string
  [k: string]: unknown
}

export type UseJarvisRealtimeVoiceOpts = {
  /** Merchant bearer token. Null until auth resolves. */
  token: string | null
  /** Auto-connect while true (the OS is open). Tears down when false. */
  enabled: boolean
  /** Raw `ev.data` from every Daily app-message — the card bridge (spec §2). */
  onAppMessage: (data: any) => void
  /** Rows from the /voice/pending confirm poll — the confirm-token bridge. */
  onPending?: (rows: PendingRow[]) => void
}

export type JarvisRealtimeVoice = {
  status: RealtimeStatus
  micLive: boolean
  toggleMic: () => void
  level: number
  orbState: JarvisState
  interim: string
  reply: string
  soundBlocked: boolean
  enableSound: () => void
  micDenied: boolean
  retry: () => void
  stop: () => void
  callObject: any
}

/* Daily permits ONE global call object; this lock guarantees a single live
   consumer even if the overlay OS and the inline assistant OS both mount. */
let VOICE_LOCK: symbol | null = null

// Smoothed 0..1 RMS from an analyser's time-domain data. Pure + never throws,
// so it's safe to call every animation frame from either audio side.
function rmsFromAnalyser(an: AnalyserNode | null, buf: Uint8Array | null): number {
  if (!an || !buf) return 0
  try {
    an.getByteTimeDomainData(buf as any)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / buf.length)
  } catch {
    return 0
  }
}

export function useJarvisRealtimeVoice(
  opts: UseJarvisRealtimeVoiceOpts
): JarvisRealtimeVoice {
  const { token, enabled } = opts

  const [status, setStatus] = useState<RealtimeStatus>("idle")
  const [micLive, setMicLive] = useState(true)
  const [level, setLevel] = useState(0)
  const [orbState, setOrbState] = useState<JarvisState>("idle")
  const [interim, setInterim] = useState("")
  const [reply, setReply] = useState("")
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [micDenied, setMicDenied] = useState(false)

  // Latest consumer callbacks, held in refs so listeners never re-subscribe.
  const onAppMessageRef = useRef(opts.onAppMessage)
  onAppMessageRef.current = opts.onAppMessage
  const onPendingRef = useRef(opts.onPending)
  onPendingRef.current = opts.onPending
  const tokenRef = useRef(token)
  tokenRef.current = token
  const micLiveRef = useRef(micLive)
  micLiveRef.current = micLive

  // This consumer's identity for the module-level singleton lock.
  const idRef = useRef<symbol>(Symbol("jarvis-rt"))

  // Daily call object + session, kept in refs so listeners see the latest.
  const dailyCallRef = useRef<any>(null)
  const dailyCallIdRef = useRef<string | null>(null)
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null)
  const dailyAudioCtxRef = useRef<AudioContext | null>(null)
  const startingRef = useRef(false)
  const realModeRef = useRef(false)

  // Two analysers — LOCAL mic + REMOTE bot — each a smoothed 0..1 RMS that
  // drives the orb's level so it pulses to the real Pixi voice.
  const localAnalyserRef = useRef<AnalyserNode | null>(null)
  const localDataRef = useRef<Uint8Array | null>(null)
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null)
  const remoteDataRef = useRef<Uint8Array | null>(null)
  const realLocalLevelRef = useRef(0)
  const realRemoteLevelRef = useRef(0)
  const lastLocalAtRef = useRef(0)
  const lastRemoteAtRef = useRef(0)

  /* ------------------------- audio sink helpers ------------------------- */
  // The hook owns a DETACHED <audio> sink (appended to <body>) so it is
  // drop-in for any surface and never depends on consumer JSX.
  const ensureSink = useCallback((): HTMLAudioElement | null => {
    if (typeof document === "undefined") return null
    if (remoteAudioElRef.current) return remoteAudioElRef.current
    try {
      const el = document.createElement("audio")
      el.setAttribute("aria-hidden", "true")
      el.autoplay = true
      ;(el as any).playsInline = true
      el.muted = false
      el.volume = 1
      el.style.position = "fixed"
      el.style.width = "0"
      el.style.height = "0"
      el.style.opacity = "0"
      el.style.pointerEvents = "none"
      document.body.appendChild(el)
      remoteAudioElRef.current = el
      return el
    } catch {
      return null
    }
  }, [])

  // (Re)start playback of the bot's audio sink and resolve the autoplay policy
  // HONESTLY: on success clear "sound blocked"; on a rejected play() RAISE it so
  // the merchant gets a real-gesture way to enable sound.
  const tryPlayRemote = useCallback((): Promise<boolean> => {
    const el = remoteAudioElRef.current
    if (!el) return Promise.resolve(false)
    try {
      el.muted = false
      el.volume = 1
      const p = el.play()
      if (p && typeof (p as any).then === "function") {
        return p
          .then(() => {
            setSoundBlocked(false)
            return true
          })
          .catch(() => {
            setSoundBlocked(true)
            return false
          })
      }
      setSoundBlocked(false)
      return Promise.resolve(true)
    } catch {
      setSoundBlocked(true)
      return Promise.resolve(false)
    }
  }, [])

  // Attach the bot's remote audio track to the hidden <audio> sink.
  const attachRemoteAudio = useCallback(
    (track: MediaStreamTrack) => {
      const el = ensureSink()
      if (!el) return
      try {
        el.srcObject = new MediaStream([track])
        el.autoplay = true
        el.muted = false
        el.volume = 1
        ;(el as any).playsInline = true
        void tryPlayRemote()
      } catch {
        /* noop */
      }
    },
    [ensureSink, tryPlayRemote]
  )

  // A REAL user gesture — guaranteed to satisfy the autoplay policy. Resume
  // every owned audio context and (re)start the sink. Idempotent + never throws.
  const enableSound = useCallback(async () => {
    try {
      await dailyAudioCtxRef.current?.resume?.()
    } catch {
      /* noop */
    }
    await tryPlayRemote()
  }, [tryPlayRemote])

  // Wire a track into a read-only AnalyserNode (never connected to the
  // destination, so it never echoes the mic or double-plays the bot).
  const wireAnalyser = useCallback(
    (track: MediaStreamTrack, which: "local" | "remote") => {
      try {
        if (!dailyAudioCtxRef.current) {
          const Ctx =
            (window as any).AudioContext || (window as any).webkitAudioContext
          if (!Ctx) return
          dailyAudioCtxRef.current = new Ctx()
        }
        const ctx = dailyAudioCtxRef.current!
        void ctx.resume?.().catch(() => {})
        const src = ctx.createMediaStreamSource(new MediaStream([track]))
        const an = ctx.createAnalyser()
        an.fftSize = 512
        an.smoothingTimeConstant = 0.8
        src.connect(an)
        const data = new Uint8Array(an.frequencyBinCount)
        if (which === "local") {
          localAnalyserRef.current = an
          localDataRef.current = data
        } else {
          remoteAnalyserRef.current = an
          remoteDataRef.current = data
        }
      } catch {
        /* analyser is cosmetic — never let it break the call */
      }
    },
    []
  )

  /* --------------------- app-message (captions + bridge) --------------- */
  // Every Daily app-message: forward the RAW payload to the consumer (the card
  // bridge, spec §2) AND parse transcript captions defensively for interim /
  // reply. The `jarvis_tool` type carries no text, so the caption parse ignores
  // it — only the consumer's card bridge acts on it.
  const handleAppMessage = useCallback((ev: any) => {
    const raw = ev?.data
    try {
      onAppMessageRef.current?.(raw)
    } catch {
      /* the bridge must never break the call */
    }
    try {
      if (!raw || typeof raw !== "object") return
      const type = String(raw.type || raw.event || raw.label || "")
      const body = raw.data && typeof raw.data === "object" ? raw.data : raw
      const text = body.text ?? body.transcript ?? body.content ?? ""
      if (!text || typeof text !== "string") return
      const isFinal = body.final !== false && raw.final !== false
      if (
        /user|input|stt|transcription/i.test(type) &&
        !/bot|assistant|tts/i.test(type)
      ) {
        if (isFinal) setInterim("")
        else setInterim(text)
      } else if (/bot|assistant|tts|llm|output/i.test(type)) {
        setReply(text)
        setInterim("")
      }
    } catch {
      /* captions are best-effort */
    }
  }, [])

  /* ---------------------------- teardown ------------------------------- */
  const stopRealVoice = useCallback((notifyBackend: boolean) => {
    realModeRef.current = false
    setSoundBlocked(false)
    if (VOICE_LOCK === idRef.current) VOICE_LOCK = null
    const co = dailyCallRef.current
    dailyCallRef.current = null
    if (co) {
      try {
        co.leave?.()
      } catch {
        /* noop */
      }
      try {
        co.destroy?.()
      } catch {
        /* noop */
      }
    }
    localAnalyserRef.current = null
    localDataRef.current = null
    remoteAnalyserRef.current = null
    remoteDataRef.current = null
    realLocalLevelRef.current = 0
    realRemoteLevelRef.current = 0
    try {
      dailyAudioCtxRef.current?.close()
    } catch {
      /* noop */
    }
    dailyAudioCtxRef.current = null
    if (remoteAudioElRef.current) {
      try {
        remoteAudioElRef.current.srcObject = null
      } catch {
        /* noop */
      }
    }
    const cid = dailyCallIdRef.current
    dailyCallIdRef.current = null
    const tok = tokenRef.current
    if (notifyBackend && tok && cid) {
      try {
        void fetch("/merchant/jarvis/voice/stop", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tok}`,
          },
          body: JSON.stringify({ call_id: cid }),
          keepalive: true,
        }).catch(() => {})
      } catch {
        /* noop */
      }
    }
  }, [])

  /* --------------------------- connect --------------------------------- */
  // Spin up the real pipeline. Returns true on success; on ANY failure it tears
  // down whatever it created and returns false. NEVER silently falls back to a
  // browser Web-Speech "ghost" voice — the caller surfaces "failed" + retry.
  const startRealVoice = useCallback(async (): Promise<boolean> => {
    const tok = tokenRef.current
    if (!tok) return false
    // Singleton: another surface already owns the one Daily call object.
    if (VOICE_LOCK && VOICE_LOCK !== idRef.current) return false
    VOICE_LOCK = idRef.current
    let logged = false
    try {
      const resp = await fetch("/merchant/jarvis/voice/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({}),
      })
      if (!resp.ok) {
        const err = new Error(`voice/start ${resp.status}`)
        console.error("[jarvis-voice] real voice failed (voice/start):", err)
        logged = true
        throw err
      }
      const data: any = await resp.json().catch(() => ({}))
      const room_url: string = data?.room_url
      const roomToken: string = data?.token
      const call_id: string = data?.call_id
      if (!room_url || !roomToken) {
        const err = new Error("missing room_url/token")
        console.error("[jarvis-voice] real voice failed (voice/start):", err)
        logged = true
        throw err
      }

      // Lazy-load the voice engine off the render path.
      let mod: any = null
      try {
        mod = await import("@daily-co/daily-js")
      } catch (err) {
        console.error("[jarvis-voice] real voice failed (daily import):", err)
        logged = true
        throw err
      }
      const DailyIframe = mod?.default ?? mod
      if (!DailyIframe?.createCallObject) {
        const err = new Error("daily unavailable")
        console.error("[jarvis-voice] real voice failed (daily import):", err)
        logged = true
        throw err
      }

      // Daily forbids two call objects at once (globally). Destroy any straggler
      // from a prior mount / StrictMode remount before creating ours.
      try {
        const existing = DailyIframe.getCallInstance?.()
        if (existing) await existing.destroy()
      } catch {
        /* noop */
      }

      const co = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      })
      dailyCallRef.current = co
      dailyCallIdRef.current = call_id || null
      ensureSink()

      co.on("track-started", (ev: any) => {
        try {
          if (ev?.track?.kind !== "audio") return
          if (ev.participant?.local) {
            wireAnalyser(ev.track, "local")
          } else {
            attachRemoteAudio(ev.track)
            wireAnalyser(ev.track, "remote")
          }
        } catch {
          /* noop */
        }
      })
      co.on("app-message", (ev: any) => handleAppMessage(ev))
      co.on("left-meeting", () => {
        setStatus((s) => (s === "failed" ? s : "idle"))
      })
      co.on("network-connection", (ev: any) => {
        try {
          const t = ev?.event || ev?.type
          if (t === "interrupted") setStatus("reconnecting")
          else if (t === "connected") setStatus("connected")
        } catch {
          /* noop */
        }
      })
      co.on("error", () => {
        setStatus("failed")
      })
      co.on("camera-error", () => {
        setMicDenied(true)
      })

      // Mark real mode BEFORE join so nothing can race the mic away from Daily.
      realModeRef.current = true

      try {
        await co.join({ url: room_url, token: roomToken })
      } catch (err) {
        console.error("[jarvis-voice] real voice failed (join):", err)
        logged = true
        throw err
      }

      // Daily now exclusively owns the mic. Assert the local track is published +
      // un-muted — this is the track the pipecat VAD listens to.
      try {
        co.setLocalAudio(true)
      } catch {
        /* noop */
      }

      // RACE FIX: the bot usually joins BEFORE the merchant, so its audio track
      // can already exist and track-started may have fired before our listener.
      // Sweep the current participants and attach any remote audio we hold.
      try {
        const parts: Record<string, any> = co.participants?.() || {}
        for (const key of Object.keys(parts)) {
          if (key === "local") continue
          const pp = parts[key]
          const track: MediaStreamTrack | undefined =
            pp?.tracks?.audio?.persistentTrack ||
            pp?.tracks?.audio?.track ||
            pp?.audioTrack ||
            undefined
          const playable =
            pp?.tracks?.audio?.state === "playable" ||
            pp?.tracks?.audio?.state === "sendable" ||
            !!track
          if (track && track.kind === "audio" && playable) {
            attachRemoteAudio(track)
            wireAnalyser(track, "remote")
          }
        }
      } catch {
        /* track-started still covers the normal case */
      }

      setMicLive(true)
      setStatus("connected")
      return true
    } catch (err) {
      if (!logged) console.error("[jarvis-voice] real voice failed:", err)
      stopRealVoice(true)
      return false
    }
  }, [ensureSink, wireAnalyser, attachRemoteAudio, handleAppMessage, stopRealVoice])

  /* --------------------------- mute toggle ----------------------------- */
  const toggleMic = useCallback(() => {
    const co = dailyCallRef.current
    // Any tap is a real gesture — opportunistically unlock the bot audio.
    void enableSound()
    if (!realModeRef.current || !co) return
    try {
      const next = !micLiveRef.current
      co.setLocalAudio?.(next)
      setMicLive(next)
    } catch {
      /* noop */
    }
  }, [enableSound])

  /* ----------------------------- retry --------------------------------- */
  const retry = useCallback(() => {
    if (startingRef.current) return
    startingRef.current = true
    setStatus("connecting")
    setInterim("")
    setSoundBlocked(false)
    void (async () => {
      try {
        const ok = await startRealVoice()
        if (!ok) setStatus("failed")
      } finally {
        startingRef.current = false
      }
    })()
  }, [startRealVoice])

  const stop = useCallback(() => {
    stopRealVoice(true)
    setStatus("idle")
  }, [stopRealVoice])

  /* --------------------- auto-connect on enable ------------------------ */
  useEffect(() => {
    if (!enabled || !token) {
      if (dailyCallRef.current || startingRef.current) {
        stopRealVoice(true)
        setStatus("idle")
      }
      return
    }
    let cancelled = false
    void (async () => {
      if (startingRef.current || dailyCallRef.current) return
      // Singleton: if another surface holds the call, stay idle (text still works).
      if (VOICE_LOCK && VOICE_LOCK !== idRef.current) {
        setStatus("idle")
        return
      }
      startingRef.current = true
      setStatus("connecting")
      setInterim("")
      setSoundBlocked(false)
      try {
        const ok = await startRealVoice()
        if (cancelled) {
          if (ok) stopRealVoice(true)
          return
        }
        if (!ok) setStatus("failed")
      } finally {
        startingRef.current = false
      }
    })()
    return () => {
      cancelled = true
      stopRealVoice(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token])

  /* ------------------------ /voice/pending poll ------------------------ */
  useEffect(() => {
    if (status !== "connected" || !token) return
    let alive = true
    const poll = async () => {
      try {
        const resp = await fetch("/merchant/jarvis/voice/pending", {
          headers: { authorization: `Bearer ${token}` },
        })
        if (!resp.ok) return
        const data: any = await resp.json().catch(() => ({}))
        const rows: any[] = Array.isArray(data?.pending) ? data.pending : []
        if (!alive || !rows.length) return
        onPendingRef.current?.(rows as PendingRow[])
      } catch {
        /* transient — next tick retries */
      }
    }
    void poll()
    const iv = window.setInterval(poll, 3000)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [status, token])

  /* -------------------------- amplitude loop --------------------------- */
  // One rAF turns the LOCAL mic + REMOTE bot analysers into the 0..1 `level`
  // fed to the orb, and derives the orb state from the real turn-taking.
  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let alive = true
    let last = 0
    const tick = (now: number) => {
      if (!alive) return
      if (realModeRef.current) {
        const lr = rmsFromAnalyser(localAnalyserRef.current, localDataRef.current)
        const rr = rmsFromAnalyser(remoteAnalyserRef.current, remoteDataRef.current)
        realLocalLevelRef.current = realLocalLevelRef.current * 0.7 + lr * 0.3
        realRemoteLevelRef.current = realRemoteLevelRef.current * 0.7 + rr * 0.3
        const L = realLocalLevelRef.current
        const R = realRemoteLevelRef.current

        let target = 0
        let st: JarvisState
        if (R > 0.04) {
          st = "speaking"
          target = Math.min(1, R * 3.4)
          lastRemoteAtRef.current = now
        } else if (L > 0.04) {
          st = "listening"
          target = Math.min(1, L * 3.4)
          lastLocalAtRef.current = now
        } else if (
          now - lastLocalAtRef.current < 1400 &&
          now - lastRemoteAtRef.current > 300
        ) {
          st = "thinking"
          target = 0.16
        } else {
          st = "idle"
          target = 0
        }

        if (now - last > 33) {
          last = now
          setLevel((prev) => (Math.abs(prev - target) > 0.015 ? target : prev))
          setOrbState((prev) => (prev !== st ? st : prev))
        }
      } else if (now - last > 120) {
        last = now
        setLevel((prev) => (prev > 0.01 ? prev * 0.7 : 0))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  /* ---------------------------- unmount -------------------------------- */
  useEffect(() => {
    const el = remoteAudioElRef
    return () => {
      stopRealVoice(true)
      // Remove the detached sink from <body> on final unmount.
      try {
        el.current?.parentNode?.removeChild(el.current)
      } catch {
        /* noop */
      }
      el.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    status,
    micLive,
    toggleMic,
    level,
    orbState,
    interim,
    reply,
    soundBlocked,
    enableSound,
    micDenied,
    retry,
    stop,
    callObject: dailyCallRef.current,
  }
}
