"use client"

/* ------------------------------------------------------------------ */
/* JarvisOS — the full-screen orchestration surface.                    */
/*                                                                     */
/* Composites: the light MaCore emblem (ambient, full-bleed) at the         */
/* centre; a pointer-events:none SignalLines overlay; two CardHost rails      */
/* flanking the orb; the CommandFeed; an answer caption; the ask bar +          */
/* suggestion chips + capability family strip; and the bottom Dock. All state    */
/* flows from JarvisOSProvider. Reuses the existing launcher window-event         */
/* contract (jarvis:open / jarvis:panel-state / close) via jarvis-os-mount.tsx.    */
/* ------------------------------------------------------------------ */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import type { JarvisState } from "../jarvis-core"
import { MaCore } from "./ma-core"
import { useJarvisDesign } from "./design"
import { JarvisOSProvider, useJarvisOS, useOrbSignal } from "./os-provider"
import { CardHost } from "./card-host"
import { SignalLines } from "./signal-lines"
import { Dock } from "./dock"
import { CommandFeed } from "./command-feed"
import { FAMILIES, SUGGESTIONS } from "./tool-catalog"
import { Icon } from "./icons"
import { os, type as t, radius, motion, accent, osChip } from "./tokens"
import { RichMessage } from "./rich-message"
// Load any Wave 2 bespoke card bodies for their registerCardBody() side-effects.
import "./cards/register"

const GUTTER = 360

/* --------------------------- orb layer ------------------------------ */
/* When real-time voice is connected the orb pulses to the LIVE analyser level  */
/* (from OrbSignalContext, kept off the card grid's render path); otherwise a    */
/* self-contained ~15fps synthetic level breathes the orb. */
function OrbLayer({
  orbRef,
  inline,
}: {
  orbRef: React.RefObject<HTMLDivElement | null>
  inline?: boolean
}) {
  const { orbState } = useJarvisOS()
  const [design] = useJarvisDesign()
  const orb = useOrbSignal()
  const [synthetic, setSynthetic] = useState(0.06)
  const stateRef = useRef<JarvisState>(orbState)
  stateRef.current = orbState

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    let raf = 0
    let last = 0
    const start = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 66) return // ~15fps
      last = now
      const st = stateRef.current
      const base =
        st === "thinking" ? 0.34 : st === "listening" ? 0.16 : st === "speaking" ? 0.28 : 0.06
      if (reduce) {
        setSynthetic(Math.min(0.2, base))
        return
      }
      const wob = 0.12 * (0.5 + 0.5 * Math.sin((now - start) / 320))
      setSynthetic(Math.min(1, base + (st === "idle" ? 0.02 : wob)))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Live voice wins; otherwise the synthetic breath.
  const level = orb.connected ? orb.level : synthetic

  return (
    <div
      ref={orbRef}
      style={{ position: inline ? "absolute" : "fixed", inset: 0, zIndex: 0 }}
    >
      {/* a faint warm radial behind the core seats it on the light field */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(90% 70% at 50% 44%, rgba(242,101,34,0.06) 0%, rgba(250,214,177,0.05) 34%, rgba(246,245,243,0) 62%)",
          pointerEvents: "none",
        }}
      />
      <MaCore state={orbState} level={level} design={design} />
    </div>
  )
}

/* --------------------------- answer caption ------------------------- */
/* Rendered in NORMAL FLOW directly above the ask bar (never absolute), so the
   reply can never bleed behind the ask bar or the family strip. The text lives
   in a BOUNDED, centered, frosted card and is CLAMPED to two lines. */
function AnswerCaption() {
  const { answer, interim, busy, orbState, navigate } = useJarvisOS()
  const [design] = useJarvisDesign()
  const v2 = design === "v2"
  const text = interim || answer
  // The live merchant transcript stays plain (it's speech, not markdown); the
  // settled mA reply renders as safe markdown with clickable in-app links.
  const isReply = !interim && !!answer
  const active =
    busy ||
    orbState === "listening" ||
    orbState === "thinking" ||
    orbState === "speaking"

  // Keep the bar calm when there is nothing to say and nothing happening.
  if (!text && !active) return null

  const label =
    orbState === "listening"
      ? "Listening"
      : orbState === "thinking" || busy
      ? "Working"
      : orbState === "speaking"
      ? "mAutomate"
      : "Ready when you are"

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 16px 2px",
      }}
    >
      <div
        style={
          v2
            ? {
                // v2: a quiet caption in the field — no box. The footer behind
                // it is opaque, so legibility holds without card chrome.
                width: "min(640px, 100%)",
                textAlign: "center",
                padding: text ? "4px 16px 2px" : "2px 16px",
              }
            : {
                width: "min(640px, 100%)",
                textAlign: "center",
                background: os.glassSolid,
                border: `1px solid ${os.hairline}`,
                borderRadius: radius.lg,
                padding: text ? "9px 16px 10px" : "7px 16px",
                backdropFilter: os.blur,
                WebkitBackdropFilter: os.blur,
                boxShadow: os.cardShadow,
              }
        }
      >
        {(!v2 || active || !text) && (
          <div
            style={{
              ...t.micro,
              color: interim ? os.cyan : os.faint,
              marginBottom: text ? 4 : 0,
            }}
          >
            {label}
          </div>
        )}
        {text && isReply && (
          // Reply: safe markdown + clickable in-app links. Left-aligned so
          // lists/links read naturally; height-capped + scrollable so a link on
          // a later line stays reachable without letting the caption grow tall.
          <div
            style={{
              textAlign: "left",
              maxHeight: 132,
              overflowY: "auto",
              fontSize: 14,
            }}
          >
            <RichMessage
              text={text}
              navigate={navigate}
              color={os.text}
              style={{ fontSize: 14, lineHeight: 1.5 }}
            />
          </div>
        )}
        {text && !isReply && (
          <p
            style={{
              ...t.body,
              fontSize: 14,
              lineHeight: 1.45,
              color: os.cyan,
              margin: 0,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {text}
          </p>
        )}
      </div>
    </div>
  )
}

/* ----------------------------- ask bar ------------------------------ */
function AskBar() {
  const { send, busy, stop, rt, cards } = useJarvisOS()
  const [design] = useJarvisDesign()
  const v2 = design === "v2"
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const v = input.trim()
    if (!v) return
    send(v)
    setInput("")
  }

  const showSuggestions = cards.length === 0 && !busy

  // --- voice on/off: the mic is the PRIMARY on/off toggle for the always-on
  // listening session (NOT push-to-talk, NOT mute). Voice is OFF by default and
  // NOTHING connects until the merchant clicks to turn it on. Once on, the
  // session listens continuously (server-side VAD); clicking again turns it off
  // (disconnects). On failure the mic doubles as retry (only while voice is on).
  const status = rt?.status ?? "idle"
  const voiceOn = !!rt?.voiceOn
  const connected = status === "connected"
  const connecting = status === "connecting" || status === "reconnecting"
  const failed = status === "failed"
  const onMic = () => {
    if (!rt) return
    if (failed) rt.retry()
    else rt.toggleVoice()
  }
  const micBorder = failed
    ? os.danger
    : connected
    ? os.ember
    : voiceOn
    ? os.hairlineStrong
    : os.hairline
  const micBg = failed
    ? "rgba(180,35,24,0.08)"
    : connected
    ? "rgba(242,101,34,0.10)"
    : "rgba(15,19,25,0.03)"
  const micColor = failed ? os.danger : connected ? os.ember : os.muted
  const micLabel = failed
    ? "Couldn't connect voice — retry"
    : connecting
    ? "Connecting…"
    : connected
    ? "Turn off voice"
    : "Turn on voice"

  const statusChip =
    failed
      ? { text: "Couldn't connect voice — retry", tone: os.danger, onClick: () => rt?.retry() }
      : status === "reconnecting"
      ? { text: "Reconnecting…", tone: os.muted, onClick: undefined }
      : status === "connecting"
      ? { text: "Connecting…", tone: os.muted, onClick: undefined }
      : connected && rt?.micDenied
      ? { text: "Mic blocked — you can still type", tone: os.muted, onClick: undefined }
      : null

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "10px 16px 6px",
        zIndex: 26,
      }}
    >
      <style>{`
        .jv-os-mic-live{ animation: jvOsMicLive 1.6s ease-in-out infinite; }
        @keyframes jvOsMicLive{
          0%,100%{ box-shadow:0 0 0 0 rgba(242,101,34,0.35); }
          50%{ box-shadow:0 0 0 7px rgba(242,101,34,0); }
        }
        @media (prefers-reduced-motion: reduce){ .jv-os-mic-live{ animation:none; } }
      `}</style>
      {(rt?.soundBlocked || statusChip) && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {rt?.soundBlocked && (
            <button
              type="button"
              onClick={() => rt.enableSound()}
              style={{
                ...osChip(true),
                color: os.ember,
                borderColor: os.emberHairlineFocus,
              }}
            >
              Sound blocked — tap to enable
            </button>
          )}
          {statusChip && (
            <button
              type="button"
              onClick={statusChip.onClick}
              disabled={!statusChip.onClick}
              style={{
                ...osChip(false),
                color: statusChip.tone,
                cursor: statusChip.onClick ? "pointer" : "default",
              }}
            >
              {statusChip.text}
            </button>
          )}
        </div>
      )}

      {showSuggestions && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              style={osChip(false)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          padding: "6px 6px 6px 16px",
          background: "rgba(255,255,255,0.9)",
          border: `1px solid ${v2 ? os.hairline : os.emberHairline}`,
          borderRadius: radius.pill,
          backdropFilter: os.blur,
          WebkitBackdropFilter: os.blur,
          boxShadow: v2 ? os.cardShadow : os.cardShadowFocus,
        }}
      >
        {/* v2: "working" lives IN the bar — an ember shimmer along its top
            edge — instead of a floating status pill. */}
        {v2 && busy && (
          <span aria-hidden="true" className="jv2-bar-shimmer" />
        )}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Ask Pixi to do anything…"
          style={{
            flex: 1,
            minWidth: 0,
            height: 40,
            background: "transparent",
            border: "none",
            outline: "none",
            color: os.text,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
        {/* Voice on/off. PRIMARY action = start/stop the always-on listening
            session (server-side VAD decides turns — no push-to-talk, no mute).
            OFF by default: nothing connects until the merchant clicks. When the
            pipeline failed the mic doubles as retry. */}
        <button
          type="button"
          aria-label={micLabel}
          aria-pressed={voiceOn}
          title={micLabel}
          onClick={onMic}
          className={connected ? "jv-os-mic-live" : undefined}
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${micBorder}`,
            background: micBg,
            color: micColor,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            opacity: connecting ? 0.7 : 1,
            transition: `all ${motion.fast}`,
          }}
        >
          {!voiceOn && !failed ? (
            // voice-off glyph: mic with a slash (click to turn on)
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 9v2a3 3 0 004.5 2.6M15 11V5a3 3 0 00-5.9-.7" />
              <path d="M5 11a7 7 0 0011 5.3M12 18v3M3 3l18 18" />
            </svg>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0014 0M12 18v3" />
            </svg>
          )}
        </button>
        <button
          type="button"
          aria-label={busy ? "Stop" : "Send"}
          title={busy ? "Stop" : "Send"}
          onClick={() => (busy ? stop() : submit())}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: accent.base,
            color: "#fff",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            transition: `background ${motion.fast}`,
          }}
        >
          {busy ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

/* -------------------------- family strip ---------------------------- */
function FamilyStrip({
  onSeed,
}: {
  onSeed: (prompt: string) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "6px 16px 12px",
        justifyContent: "center",
        zIndex: 26,
      }}
    >
      {FAMILIES.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onSeed(f.prompt)}
          title={f.label}
          style={{ ...osChip(false), flex: "0 0 auto" }}
        >
          <Icon name={f.icon} size={15} color={os.ember} />
          {f.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------- surface ------------------------------ */
export function Surface({
  onClose,
  inline,
}: {
  onClose?: () => void
  inline?: boolean
}) {
  const { send, cards, navigate } = useJarvisOS()
  const [design] = useJarvisDesign()
  const v2 = design === "v2"
  const orbRef = useRef<HTMLDivElement | null>(null)

  const getOrbCenter = useCallback(() => {
    const el = orbRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    return {
      x: (typeof window !== "undefined" ? window.innerWidth : 800) / 2,
      y: (typeof window !== "undefined" ? window.innerHeight : 600) / 2,
    }
  }, [])

  return (
    <div
      role={inline ? "region" : "dialog"}
      aria-label="Pixi"
      className={v2 ? "jv-os-root jv2" : "jv-os-root"}
      style={{
        position: inline ? "relative" : "fixed",
        inset: inline ? "auto" : 0,
        width: inline ? "100%" : undefined,
        height: inline ? "100dvh" : undefined,
        zIndex: inline ? 0 : 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: os.bg,
        color: os.text,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        /* Desktop: keep the card canvas clear of the top-left ACTIVITY feed. */
        .jv-os-canvas-wrap{ padding-left: 304px; }
        @media (max-width: 900px){
          /* Mobile: full-width stack, and the floating feed folds away so it
             cannot overlap the stacked cards. */
          .jv-os-canvas-wrap{ padding-left: 0; }
          .jv-os-feed{ display: none !important; }
        }
        /* ---------------- v2 "quiet sun" design layer ---------------- */
        /* Card window controls stay hidden until the card is hovered or
           focused — a settled card is just icon + title + dot. */
        .jv2 .jv2-card-controls{ opacity: 0; transition: opacity 160ms ease; }
        .jv2 .jv2-card:hover .jv2-card-controls,
        .jv2 .jv2-card:focus-within .jv2-card-controls{ opacity: 1; }
        /* Working status dot breathes. */
        .jv2-dot-run{ animation: jv2DotPulse 1.2s ease-in-out infinite; }
        @keyframes jv2DotPulse{ 50%{ opacity: 0.35; } }
        /* "Working" = an ember light moving along the ask bar's top edge. */
        .jv2-bar-shimmer{
          position: absolute; top: -1px; left: 22px; right: 22px; height: 2px;
          border-radius: 2px; pointer-events: none;
          background: linear-gradient(90deg, transparent, #F26522, #FFC48A, #F26522, transparent);
          background-size: 220% 100%;
          animation: jv2Shimmer 1.4s linear infinite;
        }
        @keyframes jv2Shimmer{ to{ background-position: -220% 0; } }
        @media (prefers-reduced-motion: reduce){
          .jv2 .jv2-card-controls{ opacity: 1; }
          .jv2-dot-run{ animation: none; }
          .jv2-bar-shimmer{ animation: none; opacity: 0.6; }
        }
      `}</style>
      <OrbLayer orbRef={orbRef} inline={inline} />
      <SignalLines getOrbCenter={getOrbCenter} />
      <CommandFeed />

      {/* top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accent.base,
              boxShadow: `0 0 10px ${accent.base}`,
            }}
          />
          <span style={{ ...t.bodyStrong, color: os.text, letterSpacing: "0.01em" }}>
            Pixi
          </span>
          <span style={{ ...t.micro, color: os.faint }}>Core OS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(onClose || inline) && (
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={() =>
              onClose ? onClose() : navigate("/dashboard/overview")
            }
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              border: `1px solid ${os.hairline}`,
              background: os.glass,
              color: os.muted,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 2px rgba(31,26,20,0.05)",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          )}
        </div>
      </header>

      {/* main — rails flank the orb. The canvas is inset from the left on
          desktop (see .jv-os-canvas-wrap) so cards never render under the
          ACTIVITY feed. */}
      <div
        className="jv-os-canvas-wrap"
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <CardHost gutter={GUTTER} />
      </div>

      {/* bottom controls — an OPAQUE surface footer so nothing (cards / orb)
          bleeds through. Vertical stack, none overlapping:
          [answer caption] over [ask bar] over [family strip] over [dock]. */}
      <div
        style={{
          position: "relative",
          zIndex: 28,
          display: "flex",
          flexDirection: "column",
          background: os.bg,
          borderTop: v2 ? "none" : `1px solid ${os.hairline}`,
        }}
      >
        <AnswerCaption />
        <AskBar />
        {/* v2: once cards exist the family strip yields the footer to the bar
            and dock — the families come back whenever the canvas is empty. */}
        {(!v2 || cards.length === 0) && <FamilyStrip onSeed={(p) => send(p)} />}
        <Dock />
      </div>
    </div>
  )
}

export function JarvisOS({
  open = true,
  onClose,
  inline = false,
}: {
  open?: boolean
  onClose?: () => void
  /** Render in normal document flow (the /dashboard/assistant home) rather than
      as a fixed full-screen overlay. Inline is always "open". */
  inline?: boolean
}) {
  // Esc closes the overlay (never the inline home).
  useEffect(() => {
    if (inline || !open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [inline, open, onClose])

  const live = inline || open
  if (!live) return null

  return (
    // NO AUTOPLAY: the provider no longer auto-connects voice on open. Voice is
    // OFF by default and the merchant turns it on from the ask bar mic.
    <JarvisOSProvider onNavigateClose={onClose}>
      <Surface onClose={onClose} inline={inline} />
    </JarvisOSProvider>
  )
}
