"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * useJarvisVoice — a featherweight voice layer for the Pixi chat.
 *
 * Speech-to-text via the browser's SpeechRecognition and text-to-speech via
 * speechSynthesis — no server, no per-minute cost, no new VM service.
 *
 * speechSynthesis is famously flaky; this hook works around the well-known
 * Chrome/Safari bugs so replies are actually audible:
 *   - voices load ASYNC — we wait for `voiceschanged` and pick an English voice;
 *   - `cancel()` immediately followed by `speak()` swallows the new utterance —
 *     we cancel, then speak on a short timeout;
 *   - the utterance is garbage-collected mid-sentence if only a local var holds
 *     it (the "cuts out / ghosty" symptom) — we keep it in a ref;
 *   - Chrome silently pauses speech after ~15s — we `resume()` on an interval;
 *   - engines get "stuck" after a cancel — we `resume()` before speaking.
 *
 * Actions still go through the confirm card — voice only turns the mic into text
 * and reads the reply aloud; it never confirms anything on its own.
 */

type Opts = { onTranscript: (text: string) => void; lang?: string }

export function useJarvisVoice({ onTranscript, lang = "en-US" }: Opts) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [interim, setInterim] = useState("")
  const [handsFree, setHandsFree] = useState(false)

  const recRef = useRef<any>(null)
  const handsFreeRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null) // keep alive vs GC
  const resumeTimerRef = useRef<any>(null)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])
  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  // Detect support + load synthesis voices (async on most browsers).
  useEffect(() => {
    if (typeof window === "undefined") return
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const synth = window.speechSynthesis
    setSupported(!!SR && !!synth)
    if (!synth) return
    const loadVoices = () => {
      const v = synth.getVoices()
      if (v && v.length) voicesRef.current = v
    }
    loadVoices()
    synth.addEventListener?.("voiceschanged", loadVoices)
    // Some engines only populate after a tick.
    const t = setTimeout(loadVoices, 250)
    return () => {
      synth.removeEventListener?.("voiceschanged", loadVoices)
      clearTimeout(t)
    }
  }, [])

  const pickVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const v = voicesRef.current.length
      ? voicesRef.current
      : (typeof window !== "undefined" && window.speechSynthesis?.getVoices()) || []
    if (!v.length) return undefined
    const want = lang.toLowerCase()
    return (
      v.find((x) => x.lang?.toLowerCase() === want) ||
      v.find((x) => x.lang?.toLowerCase().startsWith("en")) ||
      v.find((x) => /google|samantha|microsoft/i.test(x.name)) ||
      v[0]
    )
  }, [lang])

  const clearResumeTimer = () => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }

  const stopSpeaking = useCallback(() => {
    clearResumeTimer()
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* noop */
    }
    utterRef.current = null
    setSpeaking(false)
  }, [])

  const clean = (s: string) =>
    s
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[*_`#>]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined") return
      const synth = window.speechSynthesis
      const body = clean(text)
      if (!synth || !body) return

      // Clear any queued/stuck speech, then speak on a short timeout — cancel()
      // immediately followed by speak() is swallowed in Chrome.
      try {
        synth.cancel()
      } catch {
        /* noop */
      }
      clearResumeTimer()

      const u = new SpeechSynthesisUtterance(body.slice(0, 600))
      u.lang = lang
      u.rate = 1.0
      u.pitch = 1.0
      u.volume = 1.0
      const v = pickVoice()
      if (v) u.voice = v
      u.onstart = () => {
        setSpeaking(true)
        // Chrome pauses speech after ~15s; nudge it to keep going.
        clearResumeTimer()
        resumeTimerRef.current = setInterval(() => {
          try {
            if (window.speechSynthesis.speaking) window.speechSynthesis.resume()
            else clearResumeTimer()
          } catch {
            /* noop */
          }
        }, 8000)
      }
      const finish = () => {
        clearResumeTimer()
        setSpeaking(false)
        utterRef.current = null
        if (handsFreeRef.current) setTimeout(() => startListening(), 350)
      }
      u.onend = finish
      u.onerror = () => {
        clearResumeTimer()
        setSpeaking(false)
        utterRef.current = null
      }

      utterRef.current = u // hold a reference so it isn't GC'd mid-speech
      setTimeout(() => {
        try {
          synth.resume() // unstick after a prior cancel
          synth.speak(u)
        } catch {
          /* noop */
        }
      }, 120)
    },
    // startListening referenced in onend; declared below and stable via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, pickVoice]
  )

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop()
    } catch {
      /* noop */
    }
    setListening(false)
    setInterim("")
  }, [])

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    // Barge-in: silence any current speech before listening.
    stopSpeaking()

    const rec = new SR()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    let finalText = ""

    rec.onresult = (e: any) => {
      let interimText = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interimText += t
      }
      setInterim(interimText || finalText)
    }
    rec.onerror = () => {
      setListening(false)
      setInterim("")
    }
    rec.onend = () => {
      setListening(false)
      const text = finalText.trim()
      setInterim("")
      if (text) onTranscriptRef.current(text)
    }

    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }, [lang, stopSpeaking])

  const toggleListening = useCallback(() => {
    if (listening) stopListening()
    else startListening()
  }, [listening, startListening, stopListening])

  // Clean up on unmount.
  useEffect(
    () => () => {
      clearResumeTimer()
      try {
        window.speechSynthesis?.cancel()
      } catch {
        /* noop */
      }
      try {
        recRef.current?.abort?.()
      } catch {
        /* noop */
      }
    },
    []
  )

  return {
    supported,
    listening,
    speaking,
    interim,
    handsFree,
    setHandsFree,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
  }
}
