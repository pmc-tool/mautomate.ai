"use client"

/* ------------------------------------------------------------------ */
/* CommandFeed — the live Activity stream (top-left).                   */
/*                                                                     */
/* A frosted light-glass panel that logs the turn as it happens: the        */
/* merchant's prompt (YOU) as a neutral bubble, each tool as it runs ->       */
/* settles with a tasteful status indicator, and Pixi's reply (mA) as an     */
/* ember-tinted bubble rendered as SAFE MARKDOWN with clickable in-app links.   */
/* It reads the provider feed, auto-scrolls, and new items fade in. Collapsible; */
/* on narrow screens the whole panel folds away (see .jv-os-feed).              */
/* ------------------------------------------------------------------ */

import React, { useEffect, useRef, useState } from "react"
import { useJarvisOS, type FeedEntry } from "./os-provider"
import { useJarvisDesign } from "./design"
import { os, type as t, radius, statusTone } from "./tokens"
import { RichMessage } from "./rich-message"

/* Relative timestamp — compact, no ticker (recomputed on each feed change). */
function ago(at?: number): string {
  if (!at) return ""
  const s = Math.max(0, (Date.now() - at) / 1000)
  if (s < 45) return "now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function CommandFeed() {
  const { feed, busy, navigate } = useJarvisOS()
  const [design] = useJarvisDesign()
  const v2 = design === "v2"
  const [open, setOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed, open])

  const recent = feed.slice(-14)

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 16,
        width: "min(288px, 42vw)",
        maxHeight: "46vh",
        display: "flex",
        flexDirection: "column",
        background: os.glass,
        border: `1px solid ${os.hairline}`,
        borderRadius: radius.lg,
        boxShadow: os.cardShadow,
        backdropFilter: os.blur,
        WebkitBackdropFilter: os.blur,
        zIndex: 25,
        overflow: "hidden",
      }}
      className="jv-os-feed"
    >
      <style>{`
        @keyframes jvFeedIn{
          from{ opacity:0; transform:translateY(4px); }
          to{ opacity:1; transform:translateY(0); }
        }
        @keyframes jvFeedSpin{ to{ transform:rotate(360deg); } }
        .jv-feed-row{ animation: jvFeedIn 220ms ${"cubic-bezier(.22,.61,.36,1)"} both; }
        .jv-feed-spin{ animation: jvFeedSpin 720ms linear infinite; transform-origin:center; }
        .jv-feed-scroll::-webkit-scrollbar{ width:6px; }
        .jv-feed-scroll::-webkit-scrollbar-thumb{
          background:${os.hairlineStrong}; border-radius:999px;
        }
        @media (prefers-reduced-motion: reduce){
          .jv-feed-row{ animation:none; }
          .jv-feed-spin{ animation:none; }
        }
      `}</style>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          borderBottom: open ? `1px solid ${os.hairline}` : "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span
          className={busy ? "jv-feed-spin" : undefined}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: busy ? "transparent" : os.faint,
            border: busy ? `1.6px solid ${os.ember}` : "none",
            borderTopColor: busy ? "transparent" : undefined,
            boxShadow: busy ? `0 0 8px ${os.emberRing}` : "none",
            flex: "0 0 auto",
          }}
        />
        <span style={{ ...t.micro, color: os.muted, flex: 1 }}>Activity</span>
        <span
          style={{
            ...t.micro,
            color: os.faint,
            padding: "2px 7px",
            borderRadius: radius.pill,
            border: `1px solid ${os.hairline}`,
          }}
        >
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div
          ref={scrollRef}
          className="jv-feed-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 9,
            padding: "12px 12px 14px",
            overflowY: "auto",
          }}
        >
          {recent.length === 0 && (
            <span style={{ ...t.label, color: os.faint }}>
              No activity yet. Ask Pixi to get started.
            </span>
          )}
          {recent.map((f) => (
            <FeedRow key={f.id} entry={f} navigate={navigate} v2={v2} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------- rows ------------------------------- */
function FeedRow({
  entry,
  navigate,
  v2 = false,
}: {
  entry: FeedEntry
  navigate: (href: string) => void
  v2?: boolean
}) {
  // v2: relative timestamps only once they say something ("3m" carries
  // information; a column of "now" is noise).
  const when = ago(entry.at)
  const showWhen = !v2 || (when && when !== "now")

  /* Merchant prompt — a neutral bubble aligned to the right (the "You" side).
     Kept in BOTH designs (the boxed prompt read better than a bare quote). */
  if (entry.kind === "prompt") {
    return (
      <div
        className="jv-feed-row"
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...t.micro, color: os.cyan }}>You</span>
          <span style={{ ...t.micro, color: os.faint }}>{ago(entry.at)}</span>
        </div>
        <div
          style={{
            ...t.label,
            color: os.textDim,
            background: os.glassSolid,
            border: `1px solid ${os.hairline}`,
            borderRadius: radius.md,
            borderTopRightRadius: 3,
            padding: "7px 10px",
            maxWidth: "88%",
            wordBreak: "break-word",
            boxShadow: "0 1px 2px rgba(31,26,20,0.04)",
          }}
        >
          {entry.text}
        </div>
      </div>
    )
  }

  /* Pixi reply — an ember-tinted bubble; markdown + clickable in-app links. */
  if (entry.kind === "answer") {
    return (
      <div
        className="jv-feed-row"
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              ...t.micro,
              color: os.ember,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: os.ember,
                boxShadow: `0 0 6px ${os.emberRing}`,
              }}
            />
            mA
          </span>
          {showWhen && (
            <span style={{ ...t.micro, color: os.faint }}>{when}</span>
          )}
        </div>
        <div
          style={{
            background: os.emberSoft,
            border: `1px solid ${os.emberHairline}`,
            borderRadius: radius.md,
            borderTopLeftRadius: 3,
            padding: "8px 10px",
            maxWidth: "94%",
          }}
        >
          <RichMessage
            text={entry.text}
            navigate={navigate}
            color={os.textDim}
            compact
            style={{ ...t.label, fontWeight: 400, lineHeight: 1.5 }}
          />
        </div>
      </div>
    )
  }

  /* Error line. */
  if (entry.kind === "error") {
    const tone = statusTone("error")
    return (
      <div
        className="jv-feed-row"
        style={{
          ...t.label,
          color: tone.fg,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          borderRadius: radius.md,
          padding: "7px 10px",
        }}
      >
        {entry.text}
      </div>
    )
  }

  /* Tool activity — status indicator + label + timestamp. */
  const state = entry.state ?? "running"
  const tone =
    state === "done" ? statusTone("ok") : state === "error" ? statusTone("error") : statusTone("run")

  return (
    <div
      className="jv-feed-row"
      style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 1 }}
    >
      <ToolStatusIcon state={state} tone={tone} />
      <span style={{ ...t.label, color: state === "running" ? os.textDim : os.muted, flex: 1, minWidth: 0 }}>
        {entry.text}
      </span>
      {showWhen && (
        <span style={{ ...t.micro, color: os.faint, flex: "0 0 auto" }}>{when}</span>
      )}
    </div>
  )
}

function ToolStatusIcon({
  state,
  tone,
}: {
  state: "running" | "done" | "error"
  tone: { fg: string; bg: string; border: string }
}) {
  const box: React.CSSProperties = {
    width: 16,
    height: 16,
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  }
  if (state === "running") {
    // Ember spinner ring.
    return (
      <span style={box}>
        <svg className="jv-feed-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={os.emberSoft} strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke={tone.fg} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  if (state === "error") {
    return (
      <span
        style={{
          ...box,
          borderRadius: "50%",
          background: tone.bg,
          border: `1px solid ${tone.border}`,
        }}
      >
        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={tone.fg} strokeWidth={3} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </span>
    )
  }
  // done — success check.
  return (
    <span
      style={{
        ...box,
        borderRadius: "50%",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={tone.fg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}
