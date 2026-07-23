"use client"

/* ------------------------------------------------------------------ */
/* RichMessage — a SAFE, minimal markdown renderer for Pixi replies.  */
/*                                                                     */
/* Pixi (mA) answers can contain markdown: **bold**, `code`, bullet     */
/* and numbered lists, fenced code, and — most importantly — LINKS the      */
/* merchant can click to jump to a dashboard page (e.g. when a task must be    */
/* done in Settings). We render to REACT NODES only: there is NO                */
/* dangerouslySetInnerHTML and no HTML is ever parsed, so raw HTML in the       */
/* model output is shown as inert text (XSS-safe by construction).              */
/*                                                                             */
/* LINKS:                                                                       */
/*  - An in-app href (starts with a single "/") routes through the OS           */
/*    `navigate()` seam — closes the overlay + goes to the dashboard page.      */
/*  - An external http/https href opens in a new tab with noopener noreferrer.  */
/*  - Anything else (javascript:, data:, vbscript:, //host, mailto, relative)   */
/*    is NOT linkified — the label renders as plain text. */
/* ------------------------------------------------------------------ */

import React from "react"
import { os, type as t, radius } from "./tokens"

type NavFn = (href: string) => void

/* --- href allow-list. Only in-app "/paths" and http(s) URLs are links. --- */
type SafeHref =
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string }
  | null

function safeHref(raw: string): SafeHref {
  const h = (raw || "").trim()
  if (!h) return null
  // In-app absolute path (but NOT protocol-relative "//host").
  if (h.startsWith("/") && !h.startsWith("//")) return { kind: "internal", href: h }
  // Absolute http(s) URL only — guards against javascript:/data:/vbscript:/etc.
  if (/^https?:\/\/[^\s]+$/i.test(h)) return { kind: "external", href: h }
  return null
}

/* ------------------------------ Link -------------------------------- */
function RichLink({
  label,
  href,
  navigate,
}: {
  label: React.ReactNode
  href: string
  navigate?: NavFn
}) {
  const safe = safeHref(href)
  if (!safe) {
    // Not a permitted link — render the label as inert text.
    return <>{label}</>
  }

  const linkStyle: React.CSSProperties = {
    color: os.ember,
    fontWeight: 600,
    textDecoration: "underline",
    textDecorationColor: os.emberHairlineFocus,
    textUnderlineOffset: 2,
    borderRadius: radius.sm,
    cursor: "pointer",
    wordBreak: "break-word",
  }

  if (safe.kind === "internal") {
    return (
      <a
        href={safe.href}
        onClick={(e) => {
          // In-app: route through the OS seam (closes overlay, no full reload
          // when the seam supports it). Fall back to the anchor href if absent.
          if (navigate) {
            e.preventDefault()
            navigate(safe.href)
          }
        }}
        style={linkStyle}
      >
        {label}
      </a>
    )
  }
  return (
    <a
      href={safe.href}
      target="_blank"
      rel="noopener noreferrer"
      style={linkStyle}
    >
      {label}
    </a>
  )
}

/* --------------------------- inline parse --------------------------- */
/* Matches, in priority order: markdown link, **bold**, `code`. Everything   */
/* between matches is emitted as plain text.                                  */
const INLINE_RE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+?)\*\*|`([^`]+?)`/g

function parseInline(
  text: string,
  navigate: NavFn | undefined,
  keyBase: string
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  let i = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-i${i++}`
    if (m[1] !== undefined && m[2] !== undefined) {
      // [label](href)
      out.push(
        <RichLink key={key} label={m[1]} href={m[2]} navigate={navigate} />
      )
    } else if (m[3] !== undefined) {
      out.push(
        <strong key={key} style={{ fontWeight: 700, color: os.text }}>
          {m[3]}
        </strong>
      )
    } else if (m[4] !== undefined) {
      out.push(
        <code
          key={key}
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: "0.92em",
            background: os.emberSoft,
            color: os.text,
            padding: "1px 5px",
            borderRadius: radius.sm,
            wordBreak: "break-word",
          }}
        >
          {m[4]}
        </code>
      )
    }
    last = INLINE_RE.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* ---------------------------- block parse --------------------------- */
type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; code: string }

const UL_RE = /^\s*[-*]\s+(.*)$/
const OL_RE = /^\s*\d+\.\s+(.*)$/
const FENCE_RE = /^\s*```/

function parseBlocks(src: string): Block[] {
  const lines = (src || "").replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code.
    if (FENCE_RE.test(line)) {
      const code: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        code.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // consume closing fence
      blocks.push({ type: "code", code: code.join("\n") })
      continue
    }

    // Unordered list.
    if (UL_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push(lines[i].replace(UL_RE, "$1"))
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }

    // Ordered list.
    if (OL_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(lines[i].replace(OL_RE, "$1"))
        i++
      }
      blocks.push({ type: "ol", items })
      continue
    }

    // Blank line — paragraph separator.
    if (line.trim() === "") {
      i++
      continue
    }

    // Paragraph: gather consecutive non-blank, non-special lines.
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i]) &&
      !FENCE_RE.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: "p", lines: para })
  }
  return blocks
}

/* ----------------------------- component ---------------------------- */
export function RichMessage({
  text,
  navigate,
  style,
  color,
  compact,
}: {
  text: string
  navigate?: NavFn
  /** Base text style (defaults to design `body`). */
  style?: React.CSSProperties
  /** Text color override. */
  color?: string
  /** Tighter vertical rhythm (used in the dense Activity feed). */
  compact?: boolean
}) {
  const blocks = parseBlocks(text || "")
  const gap = compact ? 4 : 8
  const baseColor = color ?? os.textDim

  return (
    <div
      style={{
        ...t.body,
        color: baseColor,
        display: "flex",
        flexDirection: "column",
        gap,
        minWidth: 0,
        ...style,
      }}
    >
      {blocks.map((b, bi) => {
        if (b.type === "code") {
          return (
            <pre
              key={`b${bi}`}
              style={{
                margin: 0,
                padding: "8px 10px",
                background: os.emberSoft,
                border: `1px solid ${os.hairline}`,
                borderRadius: radius.md,
                overflowX: "auto",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.5,
                color: os.text,
                whiteSpace: "pre",
              }}
            >
              {b.code}
            </pre>
          )
        }
        if (b.type === "ul" || b.type === "ol") {
          const Tag = b.type === "ul" ? "ul" : "ol"
          return (
            <Tag
              key={`b${bi}`}
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: compact ? 2 : 4,
              }}
            >
              {b.items.map((it, ii) => (
                <li key={ii} style={{ margin: 0 }}>
                  {parseInline(it, navigate, `b${bi}-l${ii}`)}
                </li>
              ))}
            </Tag>
          )
        }
        // paragraph — soft-break internal lines
        return (
          <p key={`b${bi}`} style={{ margin: 0, wordBreak: "break-word" }}>
            {b.lines.map((ln, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {parseInline(ln, navigate, `b${bi}-p${li}`)}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/* Single-line inline render (no block layout) — for tight one-line contexts. */
export function RichInline({
  text,
  navigate,
  color,
  style,
}: {
  text: string
  navigate?: NavFn
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <span style={{ color: color ?? os.muted, wordBreak: "break-word", ...style }}>
      {parseInline(text || "", navigate, "inl")}
    </span>
  )
}
