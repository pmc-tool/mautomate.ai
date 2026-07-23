"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { useJarvisVoice } from "@lib/merchant-admin/use-jarvis-voice"
import { JarvisCore, JarvisActivity, JarvisState } from "./jarvis-core"

/**
 * JarvisStage — the full-screen, immersive voice experience.
 *
 * A cinematic overlay that puts the living <JarvisCore/> orb front and centre
 * and wires it to the real Pixi run:
 *   - MIC: getUserMedia → an AnalyserNode computes a smoothed 0..1 amplitude
 *     that drives the orb's inward ripples / scale / jitter while listening.
 *   - VOICE: useJarvisVoice supplies free browser STT (its transcript is sent)
 *     and TTS (replies are read aloud).
 *   - STREAM: POST /merchant/jarvis, SSE-framed exactly like the text panel —
 *     `tool` frames light up the orbiting constellation, `message` streams a
 *     caption + speaks, `confirm` raises a minimal glowing affordance that
 *     applies via POST /merchant/jarvis/apply.
 *
 * The orb's visual state is DERIVED, never set by hand: listening while the mic
 * is open, speaking while a reply streams or TTS plays, thinking while tools
 * run, otherwise idle.
 */

const EMBER = "#F26522"
const CYAN = "#4DD8E6"
const WARM = "#F5F1EC"
const DANGER = "#E0645E"

type Confirm = {
  id: string
  tier: "soft" | "hard"
  requireText?: string | null
  summary: string
  token: string
  status: "pending" | "applying" | "done" | "error"
  message?: string
}

type Msg = { role: "user" | "assistant"; content: string }

export function JarvisStage({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { token } = useMerchantAuth()

  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const [activities, setActivities] = useState<JarvisActivity[]>([])
  const [confirms, setConfirms] = useState<Confirm[]>([])
  const [confirmText, setConfirmText] = useState<Record<string, string>>({})
  const [input, setInput] = useState("")
  const [level, setLevel] = useState(0)
  const [closing, setClosing] = useState(false)
  const [micDenied, setMicDenied] = useState(false)
  // TRUE when the browser's autoplay policy rejected el.play() for the bot's
  // audio sink — we surface a real "tap to enable sound" gesture so the merchant
  // is never left in silence with no recourse.
  const [soundBlocked, setSoundBlocked] = useState(false)

  // REAL VOICE (Daily WebRTC → pipecat → Pixi). `voiceMode` decides which
  // pipeline is live: "connecting" while we spin up the room, "real" once the
  // bot has joined, "browser" if the real pipeline fails and we fall back to
  // the browser Web-Speech path below. Everything real-voice runs inside
  // effects/handlers wrapped in try/catch — never on the render path — so a
  // failure degrades to the browser flow instead of breaking the dashboard.
  const [voiceMode, setVoiceMode] = useState<"connecting" | "real" | "browser" | "failed">(
    "connecting"
  )
  const [dailyStatus, setDailyStatus] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "error"
  >("idle")
  const [micLive, setMicLive] = useState(true)
  const [realState, setRealState] = useState<JarvisState>("idle")
  const [liveInterim, setLiveInterim] = useState("")

  const abortRef = useRef<AbortController | null>(null)
  const historyRef = useRef<Msg[]>([])
  const speakNextRef = useRef(false)

  // Web Audio mic analyser (visual amplitude, independent of SpeechRecognition).
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const micLevelRef = useRef(0)

  // Daily call object + session, kept in refs so event listeners always see the
  // latest without re-subscribing.
  const dailyCallRef = useRef<any>(null)
  const dailyCallIdRef = useRef<string | null>(null)
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null)
  const dailyAudioCtxRef = useRef<AudioContext | null>(null)
  const startingRef = useRef(false)
  const realModeRef = useRef(false)
  // Two analysers — LOCAL mic + REMOTE bot — each producing a smoothed 0..1 RMS
  // that drives the orb's level, so the orb pulses to the real Pixi voice.
  const localAnalyserRef = useRef<AnalyserNode | null>(null)
  const localDataRef = useRef<Uint8Array | null>(null)
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null)
  const remoteDataRef = useRef<Uint8Array | null>(null)
  const realLocalLevelRef = useRef(0)
  const realRemoteLevelRef = useRef(0)
  const lastLocalAtRef = useRef(0)
  const lastRemoteAtRef = useRef(0)

  const voice = useJarvisVoice({
    onTranscript: (t) => {
      speakNextRef.current = true
      send(t)
    },
  })

  // Mirror reactive values into refs for the amplitude rAF (which must not
  // re-subscribe every render).
  const listeningRef = useRef(false)
  const speakingRef = useRef(false)
  const busyRef = useRef(false)
  const hasReplyRef = useRef(false)
  const voiceModeRef = useRef<"connecting" | "real" | "browser" | "failed">("connecting")
  const soundBlockedRef = useRef(false)
  listeningRef.current = voice.listening
  speakingRef.current = voice.speaking
  busyRef.current = busy
  hasReplyRef.current = !!reply
  voiceModeRef.current = voiceMode
  soundBlockedRef.current = soundBlocked

  /* ------------------------- amplitude loop ------------------------- */
  // One rAF turns the mic analyser (while listening) or a synthetic waveform
  // (while speaking) into the 0..1 `level` fed to the orb.
  useEffect(() => {
    if (!open) return
    let raf = 0
    let alive = true
    let last = 0
    const tick = (now: number) => {
      if (!alive) return

      // ---- REAL VOICE: drive the orb from BOTH real analysers ----
      // Whichever side (mic vs bot) is louder wins; the orb state follows the
      // real turn-taking rather than a synthetic wave.
      if (realModeRef.current) {
        const lr = rmsFromAnalyser(localAnalyserRef.current, localDataRef.current)
        const rr = rmsFromAnalyser(
          remoteAnalyserRef.current,
          remoteDataRef.current
        )
        // Exponential smoothing keeps the orb from strobing on every frame.
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
          // Merchant just finished; bot hasn't answered yet — the between-turns
          // "thinking" beat.
          st = "thinking"
          target = 0.16
        } else {
          st = "idle"
          target = 0
        }

        if (now - last > 33) {
          last = now
          setLevel((prev) => (Math.abs(prev - target) > 0.015 ? target : prev))
          setRealState((prev) => (prev !== st ? st : prev))
        }
        raf = requestAnimationFrame(tick)
        return
      }

      // ---- BROWSER FALLBACK: mic analyser + synthetic speaking wave ----
      // Read the mic RMS whenever the analyser exists.
      const an = analyserRef.current
      const buf = dataRef.current
      if (an && buf) {
        an.getByteTimeDomainData(buf as any)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        micLevelRef.current = Math.min(1, rms * 3.2)
      } else {
        micLevelRef.current *= 0.9
      }

      let target = 0
      if (listeningRef.current) {
        target = micLevelRef.current
      } else if (speakingRef.current || (busyRef.current && hasReplyRef.current)) {
        // Synthetic "talking" motion so the orb visibly vibrates as it speaks.
        const t = now / 1000
        target =
          0.32 +
          0.24 * Math.abs(Math.sin(t * 7.5)) +
          0.12 * Math.abs(Math.sin(t * 13.3 + 1.1))
      }
      // Throttle React updates: only commit meaningful deltas (~30fps).
      if (now - last > 33) {
        last = now
        setLevel((prev) => (Math.abs(prev - target) > 0.015 ? target : prev))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [open])

  /* ----------------------- mic acquisition ------------------------- */
  // BROWSER-FALLBACK ONLY. When a Daily session is (or is becoming) active,
  // Daily must EXCLUSIVELY own the microphone — a second getUserMedia here
  // captures the same device and leaves Daily publishing a silent track (the
  // pipecat VAD never fires → "caller idle"). So this hard-returns without ever
  // touching getUserMedia whenever real voice is live or a call object exists.
  const ensureMic = useCallback(async (): Promise<boolean> => {
    if (realModeRef.current || dailyCallRef.current) return false
    if (analyserRef.current) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext
      const actx: AudioContext = new Ctx()
      const src = actx.createMediaStreamSource(stream)
      const analyser = actx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      src.connect(analyser)
      audioCtxRef.current = actx
      analyserRef.current = analyser
      dataRef.current = new Uint8Array(analyser.frequencyBinCount)
      setMicDenied(false)
      return true
    } catch {
      setMicDenied(true)
      return false
    }
  }, [])

  const releaseMic = useCallback(() => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {
      /* noop */
    }
    try {
      audioCtxRef.current?.close()
    } catch {
      /* noop */
    }
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    dataRef.current = null
    micLevelRef.current = 0
  }, [])

  /* ---------------------- REAL VOICE (Daily) ----------------------- */
  // (Re)start playback of the bot's audio sink and resolve the autoplay policy
  // HONESTLY: on success we clear the "sound blocked" affordance; on a rejected
  // play() we RAISE it so the merchant gets a real-gesture way to enable sound.
  // Never swallow the rejection into a black hole.
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
            // Autoplay blocked — the async track-started callback is no longer
            // in the user-gesture context. Surface the fallback control.
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

  // Attach the bot's remote audio track to the hidden <audio> sink so the
  // merchant hears Pixi (exactly the test-call-panel pattern).
  const attachRemoteAudio = useCallback(
    (track: MediaStreamTrack) => {
      const el = remoteAudioElRef.current
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
    [tryPlayRemote]
  )

  // A REAL user gesture (the fallback button or the merchant's first tap inside
  // the stage) — guaranteed to satisfy the autoplay policy. Resume every audio
  // context we own and (re)start the sink. Idempotent + never throws.
  const enableSound = useCallback(async () => {
    try {
      await dailyAudioCtxRef.current?.resume?.()
    } catch {
      /* noop */
    }
    try {
      await audioCtxRef.current?.resume?.()
    } catch {
      /* noop */
    }
    await tryPlayRemote()
  }, [tryPlayRemote])

  // Wire a track into a Web Audio AnalyserNode. We only READ from the analyser
  // (never connect it to the destination), so this never echoes the mic or
  // double-plays the bot.
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

  // Full teardown of the Daily side. Safe to call repeatedly; never throws.
  const stopRealVoice = useCallback(
    (notifyBackend: boolean) => {
      realModeRef.current = false
      setSoundBlocked(false)
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
      // Analysers + their audio context.
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
      if (notifyBackend && token && cid) {
        // Best-effort: the session also expires server-side on its own.
        try {
          void fetch("/merchant/jarvis/voice/stop", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ call_id: cid }),
            keepalive: true,
          }).catch(() => {})
        } catch {
          /* noop */
        }
      }
    },
    [token]
  )

  // Spin up the real pipeline. Returns true on success; on ANY failure it tears
  // down whatever it created and returns false so the caller falls back to the
  // browser Web-Speech flow.
  const startRealVoice = useCallback(async (): Promise<boolean> => {
    if (!token) return false
    let logged = false
    try {
      const resp = await fetch("/merchant/jarvis/voice/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
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
      // from a prior mount/StrictMode remount before creating ours.
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
        setDailyStatus((s) => (s === "error" ? s : "idle"))
      })
      co.on("network-connection", (ev: any) => {
        try {
          const t = ev?.event || ev?.type
          if (t === "interrupted") setDailyStatus("reconnecting")
          else if (t === "connected") setDailyStatus("connected")
        } catch {
          /* noop */
        }
      })
      co.on("error", () => {
        setDailyStatus("error")
      })
      co.on("camera-error", () => {
        setMicDenied(true)
      })

      // Mark real mode BEFORE anything can call ensureMic(), so getUserMedia can
      // never race in and steal the mic from Daily.
      realModeRef.current = true

      try {
        await co.join({ url: room_url, token: roomToken })
      } catch (err) {
        console.error("[jarvis-voice] real voice failed (join):", err)
        logged = true
        throw err
      }

      // Daily now exclusively owns the mic. Make certain the local audio track is
      // actually published + un-muted so the merchant's voice reaches the bot
      // (createCallObject with audioSource:true normally publishes, but we assert
      // it explicitly — this is the track the pipecat VAD listens to).
      try {
        co.setLocalAudio(true)
      } catch {
        /* noop */
      }

      // RACE FIX: the bot usually joins the room BEFORE the merchant, so its
      // audio track can already exist at join time and the track-started event
      // may have fired before our listener was live. Sweep the current
      // participants and attach any remote audio track we already hold.
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
      setDailyStatus("connected")
      setVoiceMode("real")
      return true
    } catch (err) {
      // Roll back anything we created; do NOT notify backend if we never got a
      // call_id joined — but if we did create a room, tell it to release.
      if (!logged) {
        console.error("[jarvis-voice] real voice failed:", err)
      }
      stopRealVoice(true)
      return false
    }
  }, [token, wireAnalyser, attachRemoteAudio, stopRealVoice])

  // Explicit user retry after a failed connect. Re-runs the real pipeline; on
  // failure it returns to the visible "failed" state (never the ghost browser
  // voice). Guarded by startingRef so double-taps cannot stack call objects.
  const retryRealVoice = useCallback(async () => {
    if (startingRef.current) return
    startingRef.current = true
    setVoiceMode("connecting")
    setDailyStatus("connecting")
    setRealState("idle")
    setLiveInterim("")
    setSoundBlocked(false)
    try {
      const ok = await startRealVoice()
      if (!ok) {
        setVoiceMode("failed")
        setDailyStatus("error")
      }
    } finally {
      startingRef.current = false
    }
  }, [startRealVoice])

  // Parse transcript captions from Daily app-messages, defensively — the exact
  // schema depends on the pipeline, so we probe a few common shapes and never
  // throw. If none match, captions simply stay minimal in voice mode.
  function handleAppMessage(ev: any) {
    try {
      const raw = ev?.data
      if (!raw || typeof raw !== "object") return
      const type = String(raw.type || raw.event || raw.label || "")
      const body = raw.data && typeof raw.data === "object" ? raw.data : raw
      const text = body.text ?? body.transcript ?? body.content ?? ""
      if (!text || typeof text !== "string") return
      const isFinal = body.final !== false && raw.final !== false
      if (/user|input|stt|transcription/i.test(type) && !/bot|assistant|tts/i.test(type)) {
        if (isFinal) setLiveInterim("")
        else setLiveInterim(text)
      } else if (/bot|assistant|tts|llm|output/i.test(type)) {
        setReply(text)
        setLiveInterim("")
      }
    } catch {
      /* captions are best-effort */
    }
  }

  // When the stage OPENS: try the real pipeline; fall back to browser voice.
  useEffect(() => {
    if (!open || !token) return
    let cancelled = false
    startingRef.current = true
    setVoiceMode("connecting")
    setDailyStatus("connecting")
    setRealState("idle")
    setLiveInterim("")
    setSoundBlocked(false)
    ;(async () => {
      const ok = await startRealVoice()
      if (cancelled) {
        // Stage closed mid-connect — release whatever we built.
        if (ok) stopRealVoice(true)
        return
      }
      if (!ok) {
        // Do NOT silently fall back to the browser Web-Speech voice — it makes a
        // "ghost" robotic voice and hides the real failure. Surface a clear,
        // diagnosable "failed" state with an explicit retry instead (the console
        // error above says which step broke).
        setVoiceMode("failed")
        setDailyStatus("error")
      }
      startingRef.current = false
    })()
    return () => {
      cancelled = true
      stopRealVoice(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token])

  // While a real voice session is live, poll for actions Pixi proposed over
  // voice that await the merchant's confirmation (the voice confirm gate).
  useEffect(() => {
    if (!open || voiceMode !== "real" || !token) return
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
        setConfirms((prev) => {
          const next = prev.slice()
          for (const r of rows) {
            if (!r?.token || next.some((c) => c.token === r.token)) continue
            next.push({
              id: r.id || String(r.token).slice(0, 12),
              tier: r.tier === "hard" ? "hard" : "soft",
              requireText: r.require_text ?? null,
              summary: r.summary || "Confirm this change?",
              token: r.token,
              status: "pending",
            })
          }
          return next
        })
      } catch {
        /* transient — next tick retries */
      }
    }
    poll()
    const iv = window.setInterval(poll, 3000)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [open, voiceMode, token])

  const onMic = useCallback(async () => {
    // If the real pipeline failed, the mic doubles as a retry — never silently
    // start the browser "ghost" voice on a fallback.
    if (voiceModeRef.current === "failed") {
      void retryRealVoice()
      return
    }
    // Any tap on the mic is a real gesture — opportunistically unlock the bot's
    // audio sink so the merchant hears Pixi even if autoplay was blocked.
    void enableSound()
    // REAL VOICE: the mic button mutes/unmutes the live Daily audio.
    if (voiceModeRef.current === "real" && dailyCallRef.current) {
      try {
        const co = dailyCallRef.current
        const next = !micLive
        co.setLocalAudio?.(next)
        setMicLive(next)
      } catch {
        /* noop */
      }
      return
    }
    // BROWSER FALLBACK: original Web-Speech toggle.
    if (voice.listening) {
      voice.stopListening()
      return
    }
    const ok = await ensureMic()
    // resume a suspended context (autoplay policy) before we read from it
    try {
      await audioCtxRef.current?.resume()
    } catch {
      /* noop */
    }
    if (ok || voice.supported) voice.startListening()
  }, [voice, ensureMic, micLive, enableSound, retryRealVoice])

  /* ------------------------- SSE streaming ------------------------- */
  const send = useCallback(
    async (preset?: string) => {
      const message = (preset ?? input).trim()
      if (!message || busyRef.current || !token) return
      setInput("")
      setReply("")
      setActivities([])
      setConfirms([])
      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, content: message },
      ].slice(-8)

      const ac = new AbortController()
      abortRef.current = ac
      setBusy(true)

      try {
        const resp = await fetch("/merchant/jarvis", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            history: historyRef.current.slice(0, -1),
          }),
          signal: ac.signal,
        })
        if (!resp.ok || !resp.body) throw new Error("request failed")
        const reader = resp.body.getReader()
        const dec = new TextDecoder()
        let buf = ""
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, i)
            buf = buf.slice(i + 2)
            let ev = "message"
            let data = ""
            for (const line of frame.split("\n")) {
              if (line.startsWith("event:")) ev = line.slice(6).trim()
              else if (line.startsWith("data:")) data += line.slice(5).trim()
            }
            let payload: any = {}
            try {
              payload = data ? JSON.parse(data) : {}
            } catch {
              payload = {}
            }
            handleEvent(ev, payload)
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setReply("Something went wrong. Try again in a moment.")
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, token]
  )

  function handleEvent(ev: string, p: any) {
    if (ev === "tool") {
      setActivities((prev) => {
        const next = prev.slice()
        const idx = next.findIndex((x) => x.id === p.id)
        const row: JarvisActivity = {
          id: p.id,
          label: p.label || p.name || "working",
          // the constellation only distinguishes running vs settled
          state: p.state === "running" ? "running" : "done",
        }
        if (idx >= 0) next[idx] = row
        else next.push(row)
        return next
      })
    } else if (ev === "confirm") {
      setConfirms((prev) => {
        if (prev.some((c) => c.token === p.token)) return prev
        return [
          ...prev,
          {
            id: p.id || String(p.token).slice(0, 12),
            tier: p.tier === "hard" ? "hard" : "soft",
            requireText: p.require_text ?? null,
            summary: p.summary || "Confirm this change?",
            token: p.token,
            status: "pending",
          },
        ]
      })
    } else if (ev === "message") {
      const text = p.text || ""
      setReply(text)
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant" as const, content: text },
      ].slice(-8)
      if (speakNextRef.current || voice.handsFree) voice.speak(text)
      speakNextRef.current = false
    } else if (ev === "error") {
      setReply(p.message || "Something went wrong.")
    }
    // "thinking" / "done" need no explicit handling — the derived core state
    // reads `busy` + activities + reply.
  }

  async function applyConfirm(c: Confirm) {
    const typed = confirmText[c.id] ?? ""
    setConfirms((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, status: "applying", message: undefined } : x
      )
    )
    try {
      const resp = await fetch("/merchant/jarvis/apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: c.token, confirm_text: typed }),
      })
      const data: any = await resp.json().catch(() => ({}))
      if (resp.ok && data.ok) {
        setConfirms((prev) =>
          prev.map((x) =>
            x.id === c.id
              ? { ...x, status: "done", message: data.message || "Done." }
              : x
          )
        )
        if (data.message && voice.handsFree) voice.speak(data.message)
      } else {
        setConfirms((prev) =>
          prev.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  status: "error",
                  message: data.message || "That didn't go through.",
                }
              : x
          )
        )
      }
    } catch {
      setConfirms((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, status: "error", message: "Network error — try again." }
            : x
        )
      )
    }
  }

  /* --------------------- derived core state ------------------------ */
  // In real-voice mode the orb state comes straight from the live analysers
  // (set in the rAF); while connecting we show a "thinking" pulse; otherwise we
  // fall back to the browser-voice derivation.
  const coreState: JarvisState =
    voiceMode === "real"
      ? realState
      : voiceMode === "connecting"
      ? "thinking"
      : voice.listening
      ? "listening"
      : busy && reply
      ? "speaking"
      : voice.speaking
      ? "speaking"
      : busy
      ? "thinking"
      : "idle"

  /* ----------------------- exit choreography ----------------------- */
  const requestClose = useCallback(() => {
    abortRef.current?.abort()
    voice.stopListening()
    voice.stopSpeaking()
    stopRealVoice(true)
    setClosing(true)
    window.setTimeout(() => {
      releaseMic()
      setClosing(false)
      onClose()
    }, 520)
  }, [voice, releaseMic, onClose, stopRealVoice])

  // Esc closes; clean everything up when the stage unmounts.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, requestClose])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      releaseMic()
      stopRealVoice(true)
    },
    [releaseMic, stopRealVoice]
  )

  if (!open || !token) return null

  const activeConfirms = confirms.filter(
    (c) => c.status === "pending" || c.status === "applying" || c.status === "error"
  )
  const doneConfirm = confirms.find((c) => c.status === "done")

  // Whose words to show in the interim caption + the mic's live state depend on
  // which pipeline is running.
  const realMode = voiceMode === "real"
  const interimText = realMode ? liveInterim : voice.interim
  const micActive = realMode ? micLive : voice.listening

  const hint =
    voiceMode === "connecting"
      ? "Connecting"
      : voiceMode === "failed"
      ? "Voice offline"
      : dailyStatus === "reconnecting"
      ? "Reconnecting"
      : coreState === "listening"
      ? "Listening"
      : coreState === "thinking"
      ? "Working"
      : coreState === "speaking"
      ? "Pixi"
      : "Ready when you are"

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
      style={{
        background: "#07090D",
        opacity: closing ? 0 : 1,
        transition: "opacity 480ms cubic-bezier(0.4,0,0.2,1)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pixi"
      onPointerDown={() => {
        // The merchant's first tap ANYWHERE in the stage is a real gesture —
        // use it to unlock the bot's audio if autoplay was blocked.
        if (soundBlockedRef.current) void enableSound()
      }}
    >
      <StageStyles />

      {/* hidden sink for Pixi's remote voice (real-voice mode) */}
      <audio
        ref={remoteAudioElRef}
        className="hidden"
        aria-hidden="true"
        autoPlay
        playsInline
      />

      {/* the living orb, full-bleed */}
      <div className="absolute inset-0">
        <JarvisCore state={coreState} level={level} activities={activities} />
      </div>

      {/* top bar: state label + close */}
      <div className="relative z-10 flex items-start justify-between p-6">
        <div
          className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: "rgba(245,241,236,0.62)" }}
        >
          <span
            className="jv-stage-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: coreState === "listening" ? CYAN : EMBER,
              boxShadow: `0 0 10px ${coreState === "listening" ? CYAN : EMBER}`,
            }}
          />
          {hint}
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close Pixi"
          className="jv-stage-close flex h-10 w-10 items-center justify-center rounded-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* captions + controls, anchored bottom */}
      <div className="relative z-10 mt-auto flex flex-col items-center px-6 pb-10">
        {/* the merchant's interim speech */}
        <div className="mb-3 h-5 text-center">
          {interimText && (
            <span
              className="text-[12px] font-medium uppercase tracking-[0.34em]"
              style={{ color: "rgba(77,216,230,0.75)" }}
            >
              {interimText}
            </span>
          )}
        </div>

        {/* Pixi's streaming reply */}
        <div className="min-h-[3.5rem] max-w-2xl text-center">
          {reply ? (
            <p
              className="jv-stage-reply text-[19px] leading-relaxed"
              style={{ color: WARM }}
            >
              {cleanReply(reply)}
            </p>
          ) : (
            <p
              className="text-[15px]"
              style={{ color: "rgba(245,241,236,0.4)" }}
            >
              {micDenied
                ? "Microphone is blocked — you can still type below."
                : voiceMode === "connecting"
                ? "Connecting to Pixi…"
                : voiceMode === "failed"
                ? "Couldn’t connect voice. Tap retry below, or type instead."
                : realMode
                ? "Connected — just talk."
                : "Tap the mic and talk, or type a message."}
            </p>
          )}
        </div>

        {/* autoplay-blocked fallback: a REAL gesture to enable Pixi's voice.
            Only shown when the browser rejected playback of the bot's audio. */}
        {soundBlocked && (
          <button
            type="button"
            onClick={enableSound}
            className="jv-stage-enable-sound mt-4 flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold"
            aria-label="Enable Pixi sound"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path
                d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            Sound blocked — tap to enable
          </button>
        )}

        {/* real voice failed to connect — an explicit, diagnosable retry
            (never a silent switch to the browser "ghost" voice) */}
        {voiceMode === "failed" && (
          <button
            type="button"
            onClick={() => void retryRealVoice()}
            className="jv-stage-enable-sound mt-4 flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold"
            aria-label="Retry connecting voice"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 11A8 8 0 1 0 12 20M20 4v7h-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            Couldn’t connect voice — tap to retry
          </button>
        )}

        {/* minimal glowing confirm affordances — voice PROPOSES writes, the
            merchant confirms each here (the confirm gate) */}
        {activeConfirms.map((c) => (
          <ConfirmAffordance
            key={c.id}
            c={c}
            typed={confirmText[c.id] ?? ""}
            onType={(v) => setConfirmText((m) => ({ ...m, [c.id]: v }))}
            onConfirm={() => applyConfirm(c)}
            onDismiss={() =>
              setConfirms((prev) => prev.filter((x) => x.id !== c.id))
            }
          />
        ))}
        {activeConfirms.length === 0 && doneConfirm?.message && (
          <div
            className="mt-4 text-center text-[13px]"
            style={{ color: "rgba(77,216,230,0.85)" }}
          >
            {cleanReply(doneConfirm.message)}
          </div>
        )}

        {/* controls */}
        <div className="mt-7 flex items-center gap-4">
          {/* hands-free (browser-voice fallback only) */}
          {!realMode && voice.supported && (
            <button
              type="button"
              onClick={() => voice.setHandsFree(!voice.handsFree)}
              aria-pressed={voice.handsFree}
              aria-label="Hands-free conversation"
              className="jv-stage-ghost flex h-11 w-11 items-center justify-center rounded-full"
              style={{
                color: voice.handsFree ? EMBER : "rgba(245,241,236,0.6)",
                boxShadow: voice.handsFree
                  ? `0 0 0 1px rgba(242,101,34,0.5), 0 0 22px rgba(242,101,34,0.28)`
                  : undefined,
              }}
              title={voice.handsFree ? "Hands-free on" : "Hands-free off"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 9a6 6 0 0 1 6-6h4M4 9l-1.5-2M4 9l2-1M20 15a6 6 0 0 1-6 6h-4M20 15l1.5 2M20 15l-2 1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* the big glowing mic — mutes/unmutes in real mode, toggles STT in
              the browser fallback */}
          <button
            type="button"
            onClick={onMic}
            aria-pressed={micActive}
            aria-label={
              realMode
                ? micActive
                  ? "Mute microphone"
                  : "Unmute microphone"
                : micActive
                ? "Stop listening"
                : "Talk to Pixi"
            }
            disabled={!realMode && !voice.supported && micDenied}
            className={`jv-stage-mic flex h-16 w-16 items-center justify-center rounded-full ${
              micActive ? "jv-stage-mic-live" : ""
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path
                d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>

          {/* stop-speaking appears only while TTS plays */}
          {voice.speaking ? (
            <button
              type="button"
              onClick={() => voice.stopSpeaking()}
              aria-label="Stop speaking"
              className="jv-stage-ghost flex h-11 w-11 items-center justify-center rounded-full"
              style={{ color: "rgba(245,241,236,0.6)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden="true" />
          )}
        </div>

        {/* subtle text fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="jv-stage-input mt-6 flex w-full max-w-md items-center gap-2 rounded-full px-4 py-2.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="or type to Pixi…"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: WARM }}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label="Send"
            className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"
            style={{ color: EMBER }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

/* --------------------------- confirm affordance -------------------------- */

function ConfirmAffordance({
  c,
  typed,
  onType,
  onConfirm,
  onDismiss,
}: {
  c: Confirm
  typed: string
  onType: (v: string) => void
  onConfirm: () => void
  onDismiss: () => void
}) {
  const hard = c.tier === "hard"
  const need = String(c.requireText || "").toUpperCase()
  const ready = !hard || typed.trim().toUpperCase() === need
  const applying = c.status === "applying"
  return (
    <div className="jv-stage-confirm mt-6 w-full max-w-lg rounded-2xl px-5 py-4 text-center">
      <p className="text-[14px] leading-relaxed" style={{ color: WARM }}>
        {cleanReply(c.summary)}
      </p>
      {c.status === "error" && c.message && (
        <p className="mt-1.5 text-[12px]" style={{ color: DANGER }}>
          {c.message}
        </p>
      )}
      {hard && (
        <div className="mt-3">
          <div
            className="mb-1.5 text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "rgba(245,241,236,0.5)" }}
          >
            Type{" "}
            <span style={{ color: DANGER, fontWeight: 700 }}>{need}</span> to
            confirm
          </div>
          <input
            value={typed}
            onChange={(e) => onType(e.target.value)}
            disabled={applying}
            placeholder={need}
            autoCapitalize="characters"
            className="jv-stage-hardinput w-40 rounded-lg px-3 py-1.5 text-center text-[13px] outline-none"
            style={{ color: WARM }}
          />
        </div>
      )}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready || applying}
          className="jv-stage-confirm-btn rounded-full px-6 py-2 text-[13px] font-semibold disabled:opacity-40"
        >
          {applying ? "Working…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={applying}
          className="rounded-full px-4 py-2 text-[13px] font-medium"
          style={{ color: "rgba(245,241,236,0.5)" }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}

/* -------------------------------- helpers -------------------------------- */

// Smoothed 0..1 RMS from an analyser's time-domain data. Pure + never throws,
// so it's safe to call every animation frame from either audio side.
function rmsFromAnalyser(
  an: AnalyserNode | null,
  buf: Uint8Array | null
): number {
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

// Reply text arrives markdown-ish; the stage shows a clean spoken-style line.
function cleanReply(s: string): string {
  return String(s ?? "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function StageStyles() {
  return (
    <style>{`
      .jv-stage-close{
        color:rgba(245,241,236,0.55);
        background:rgba(245,241,236,0.04);
        border:1px solid rgba(245,241,236,0.08);
        backdrop-filter:blur(6px);
        transition:color .2s, background .2s, box-shadow .2s;
      }
      .jv-stage-close:hover{
        color:#F5F1EC;
        background:rgba(245,241,236,0.08);
        box-shadow:0 0 22px rgba(242,101,34,0.25);
      }
      .jv-stage-ghost{
        background:rgba(245,241,236,0.04);
        border:1px solid rgba(245,241,236,0.08);
        transition:color .2s, box-shadow .2s, background .2s;
      }
      .jv-stage-ghost:hover{ background:rgba(245,241,236,0.09); }
      .jv-stage-mic{
        color:#fff;
        background:radial-gradient(circle at 50% 35%, #FF8A4C 0%, #F26522 55%, #B8410F 100%);
        border:1px solid rgba(255,180,130,0.5);
        box-shadow:0 0 0 1px rgba(242,101,34,0.4), 0 8px 40px rgba(242,101,34,0.45), inset 0 0 18px rgba(255,220,190,0.35);
        transition:transform .2s, box-shadow .3s;
      }
      .jv-stage-mic:hover{ transform:translateY(-2px) scale(1.04); }
      .jv-stage-mic-live{ animation:jvStageMic 1.4s ease-in-out infinite; }
      @keyframes jvStageMic{
        0%,100%{ box-shadow:0 0 0 0 rgba(242,101,34,0.55), 0 8px 40px rgba(242,101,34,0.5), inset 0 0 18px rgba(255,220,190,0.4); }
        50%{ box-shadow:0 0 0 14px rgba(242,101,34,0), 0 8px 46px rgba(242,101,34,0.6), inset 0 0 24px rgba(255,230,200,0.55); }
      }
      .jv-stage-dot{ animation:jvStageDot 1.6s ease-in-out infinite; }
      @keyframes jvStageDot{ 0%,100%{opacity:.5} 50%{opacity:1} }
      .jv-stage-reply{ animation:jvStageFade .5s ease-out; }
      @keyframes jvStageFade{ from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)} }
      .jv-stage-input{
        background:rgba(245,241,236,0.04);
        border:1px solid rgba(245,241,236,0.10);
        transition:border-color .2s, box-shadow .2s;
      }
      .jv-stage-input:focus-within{
        border-color:rgba(242,101,34,0.55);
        box-shadow:0 0 26px rgba(242,101,34,0.18);
      }
      .jv-stage-input input::placeholder{ color:rgba(245,241,236,0.35); }
      .jv-stage-confirm{
        background:rgba(15,19,25,0.72);
        border:1px solid rgba(242,101,34,0.35);
        box-shadow:0 0 40px rgba(242,101,34,0.18), inset 0 0 30px rgba(242,101,34,0.05);
        backdrop-filter:blur(10px);
        animation:jvStageFade .4s ease-out;
      }
      .jv-stage-confirm-btn{
        color:#fff;
        background:radial-gradient(circle at 50% 30%, #FF8A4C, #F26522 70%);
        border:1px solid rgba(255,180,130,0.5);
        box-shadow:0 0 24px rgba(242,101,34,0.4);
        transition:transform .15s, box-shadow .25s;
      }
      .jv-stage-confirm-btn:not(:disabled):hover{ transform:translateY(-1px); box-shadow:0 0 32px rgba(242,101,34,0.55); }
      .jv-stage-hardinput{
        background:rgba(245,241,236,0.05);
        border:1px solid rgba(224,100,94,0.5);
      }
      .jv-stage-enable-sound{
        color:#F5F1EC;
        background:radial-gradient(circle at 50% 30%, rgba(242,101,34,0.28), rgba(242,101,34,0.14) 70%);
        border:1px solid rgba(242,101,34,0.55);
        box-shadow:0 0 26px rgba(242,101,34,0.28);
        backdrop-filter:blur(8px);
        animation:jvStageEnableSound 1.8s ease-in-out infinite;
        transition:transform .15s, box-shadow .25s;
      }
      .jv-stage-enable-sound:hover{
        transform:translateY(-1px);
        box-shadow:0 0 34px rgba(242,101,34,0.45);
      }
      @keyframes jvStageEnableSound{
        0%,100%{ box-shadow:0 0 22px rgba(242,101,34,0.22); }
        50%{ box-shadow:0 0 34px rgba(242,101,34,0.5); }
      }
      @media (prefers-reduced-motion: reduce){
        .jv-stage-mic-live,.jv-stage-dot,.jv-stage-reply,.jv-stage-confirm,.jv-stage-enable-sound{ animation:none; }
      }
    `}</style>
  )
}
