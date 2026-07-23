"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { SetupResumeCard } from "./setup-resume"

/**
 * Pixi — P1 dashboard panel (read + write-with-confirm, streaming).
 *
 * A persistent assistant docked bottom-right of the whole dashboard. It talks to
 * POST /merchant/jarvis over a streamed (SSE-framed) response so the merchant
 * watches Pixi work live: a "thinking" pulse, each tool call ticking as it
 * runs, then the grounded answer.
 *
 * When Pixi is asked to CHANGE something it never does it silently — the run
 * emits a `confirm` frame carrying a signed, tenant-bound plan token, and the
 * panel renders a confirmation card. Soft actions are one tap; money/irreversible
 * actions require typing a short word. Approving posts the token to
 * POST /merchant/jarvis/apply, which is the only place a change actually runs.
 * Reversible actions come back with an Undo.
 *
 * The panel renders no launcher of its own — <JarvisLauncher/> owns the single
 * floating pill. The contract between the two is four window events:
 * "jarvis:open" (open this panel), "jarvis:voice" (open the voice stage),
 * "jarvis:panel-state" { open } (broadcast whenever our open state changes) and
 * "jarvis:attention" { count } (broadcast whenever the attention count changes).
 */

type Tool = { id: string; label: string; state: "running" | "done" | "error" }
type Confirm = {
  id: string
  action: string
  tier: "soft" | "hard"
  requireText?: string | null
  summary: string
  details?: Record<string, unknown>
  token: string
  status: "pending" | "applying" | "done" | "dismissed"
  error?: string
  resultMsg?: string
  undo?: { token: string; label: string } | null
  undoing?: boolean
  undone?: boolean
  // A replayed confirmation whose plan token has expired. Rendered as a
  // read-only "proposed" summary with a "Do it now" re-ask, never applied.
  proposed?: boolean
}
type Turn = {
  role: "user" | "assistant"
  text?: string
  tools?: Tool[]
  confirms?: Confirm[]
  error?: string
  thinking?: boolean
}
type AttentionItem = {
  id: string
  severity: "blocker" | "warn" | "info"
  title: string
  detail: string
  cta?: { label: string; prompt?: string; href?: string }
}

const EMBER = "#F26522"
const DANGER = "#C43640"
const OK = "#12925A"

const GREETING =
  "Hi — I'm Pixi. Ask me about your shop, or tell me to do something: set up delivery, publish a product, change a price, fulfil or refund an order. I read live data, and I'll always show you a confirmation before anything changes."

export function JarvisPanel() {
  const { token } = useMerchantAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [cText, setCText] = useState<Record<string, string>>({})
  const [attention, setAttention] = useState<AttentionItem[]>([])
  const [attnReady, setAttnReady] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight stream when the panel unmounts, so we don't set state on
  // an unmounted component or leak an LLM run.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Proactive layer: on mount, ask what needs the merchant's attention so the
  // launcher can badge and the panel can open straight onto the top issues.
  useEffect(() => {
    if (!token) return
    let alive = true
    fetch("/merchant/jarvis/attention", {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && Array.isArray(d.items)) {
          setAttention(d.items)
          setAttnReady(true)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [token])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, open])

  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 60)
  }, [open])

  // Unified entry point: <JarvisLauncher/> owns the only floating pill and asks
  // us to open via "jarvis:open".
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("jarvis:open", onOpen)
    return () => window.removeEventListener("jarvis:open", onOpen)
  }, [])

  // Broadcast our open state so the launcher can hide its pill while the panel
  // is showing.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("jarvis:panel-state", { detail: { open } })
    )
  }, [open])

  // Broadcast the attention count so the launcher pill can badge.
  useEffect(() => {
    const count = attention.filter(
      (a) => a.severity === "blocker" || a.severity === "warn"
    ).length
    window.dispatchEvent(
      new CustomEvent("jarvis:attention", { detail: { count } })
    )
  }, [attention])

  if (!token) return null

  const patchLast = (fn: (t: Turn) => Turn) =>
    setTurns((prev) => {
      if (!prev.length) return prev
      const next = prev.slice()
      next[next.length - 1] = fn(next[next.length - 1])
      return next
    })

  // Update one confirm card by id, wherever it lives in the transcript.
  const updateConfirm = (id: string, fn: (c: Confirm) => Confirm) =>
    setTurns((prev) =>
      prev.map((t) =>
        t.confirms?.some((c) => c.id === id)
          ? { ...t, confirms: t.confirms.map((c) => (c.id === id ? fn(c) : c)) }
          : t
      )
    )

  async function send(preset?: string) {
    // `setInput` is async, so a suggestion chip must pass its text directly —
    // reading `input` here would still be "".
    const message = (preset ?? input).trim()
    if (!message || busy) return
    setInput("")
    const ac = new AbortController()
    abortRef.current = ac
    const history = turns
      .filter((t) => t.text)
      .slice(-6)
      .map((t) => ({ role: t.role, content: t.text }))
    setTurns((prev) => [
      ...prev,
      { role: "user", text: message },
      { role: "assistant", tools: [], confirms: [], thinking: true },
    ])
    setBusy(true)

    try {
      const resp = await fetch("/merchant/jarvis", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, history }),
        signal: ac.signal,
      })
      if (!resp.ok || !resp.body) {
        throw new Error("request failed")
      }
      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      // Parse SSE frames (event: X\n data: {...}\n\n) off the stream.
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
      if (e?.name === "AbortError") return
      patchLast((t) => ({
        ...t,
        thinking: false,
        error: "Something went wrong. Try again in a moment.",
      }))
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setBusy(false)
      patchLast((t) => ({ ...t, thinking: false }))
    }
  }

  function handleEvent(ev: string, p: any) {
    if (ev === "thinking") {
      patchLast((t) => ({ ...t, thinking: true }))
    } else if (ev === "tool") {
      patchLast((t) => {
        const tools = (t.tools ?? []).slice()
        const idx = tools.findIndex((x) => x.id === p.id)
        const row: Tool = { id: p.id, label: p.label || p.name, state: p.state }
        if (idx >= 0) tools[idx] = row
        else tools.push(row)
        return { ...t, tools, thinking: true }
      })
    } else if (ev === "confirm") {
      patchLast((t) => {
        const confirms = (t.confirms ?? []).slice()
        if (confirms.some((c) => c.token === p.token)) return t
        confirms.push({
          id: p.id || p.token.slice(0, 12),
          action: p.action,
          tier: p.tier === "hard" ? "hard" : "soft",
          requireText: p.require_text ?? null,
          summary: p.summary || "Confirm this change?",
          details: p.details ?? {},
          token: p.token,
          status: "pending",
        })
        return { ...t, confirms, thinking: true }
      })
    } else if (ev === "message") {
      patchLast((t) => ({ ...t, text: p.text || "", thinking: false }))
    } else if (ev === "error") {
      patchLast((t) => ({ ...t, error: p.message || "Something went wrong.", thinking: false }))
    } else if (ev === "done") {
      patchLast((t) => ({ ...t, thinking: false }))
    }
  }

  async function applyConfirm(c: Confirm, confirmText: string) {
    if (c.proposed) return
    updateConfirm(c.id, (x) => ({ ...x, status: "applying", error: undefined }))
    try {
      const resp = await fetch("/merchant/jarvis/apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: c.token, confirm_text: confirmText }),
      })
      const data: any = await resp.json().catch(() => ({}))
      if (resp.ok && data.ok) {
        updateConfirm(c.id, (x) => ({
          ...x,
          status: "done",
          resultMsg: data.message || "Done.",
          undo: data.undo || null,
        }))
      } else {
        updateConfirm(c.id, (x) => ({
          ...x,
          status: "pending",
          error: data.message || "That didn't go through.",
        }))
      }
    } catch {
      updateConfirm(c.id, (x) => ({
        ...x,
        status: "pending",
        error: "Network error — try again.",
      }))
    }
  }

  // P4 autonomy: approve every pending one-tap (soft) step of a proposed plan in
  // sequence. Money/irreversible (hard) steps are deliberately excluded — those
  // always get their own typed confirmation.
  async function approveAllSoft(items: Confirm[]) {
    const list = items.filter(
      (c) => c.status === "pending" && c.tier === "soft" && !c.proposed
    )
    if (list.length < 2 || batchBusy) return
    setBatchBusy(true)
    for (const c of list) {
      // eslint-disable-next-line no-await-in-loop
      await applyConfirm(c, "")
    }
    setBatchBusy(false)
  }

  async function applyUndo(c: Confirm) {
    const u = c.undo
    if (!u?.token) return
    updateConfirm(c.id, (x) => ({ ...x, undoing: true, error: undefined }))
    try {
      const resp = await fetch("/merchant/jarvis/apply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: u.token }),
      })
      const data: any = await resp.json().catch(() => ({}))
      if (resp.ok && data.ok) {
        updateConfirm(c.id, (x) => ({ ...x, undoing: false, undone: true, undo: null }))
      } else {
        updateConfirm(c.id, (x) => ({
          ...x,
          undoing: false,
          error: data.message || "Couldn't undo that.",
        }))
      }
    } catch {
      updateConfirm(c.id, (x) => ({ ...x, undoing: false, error: "Couldn't undo that." }))
    }
  }

  function onCta(item: AttentionItem) {
    // Dismiss this item optimistically so the badge/list reflect the action.
    setAttention((prev) => prev.filter((a) => a.id !== item.id))
    if (item.cta?.prompt) {
      send(item.cta.prompt)
    } else if (item.cta?.href) {
      window.location.href = item.cta.href
    }
  }

  const suggestions = [
    "How's my shop doing?",
    "Is my store ready to sell?",
    "Show my recent orders",
  ]

  // Closed, the panel renders nothing — the floating <JarvisLauncher/> pill is
  // the single entry point.
  return (
    <>
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-grey-20 bg-white shadow-2xl"
          style={{ height: "min(640px, calc(100vh - 3rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-grey-20 px-4 py-3" style={{ background: "#0F1319" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(242,101,34,.15)" }}>
              <SparkIcon small />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Pixi</div>
              <div className="text-[10.5px] font-medium uppercase tracking-wider" style={{ color: "#9BA3AF" }}>
                runs on your live shop · preview
              </div>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  window.dispatchEvent(new CustomEvent("jarvis:voice"))
                }}
                aria-label="Talk to Pixi by voice"
                title="Talk to Pixi by voice"
                className="flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11.5px] font-medium text-grey-40 transition hover:text-white"
              >
                <MicIcon />
                <span>Voice</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  router.push("/dashboard/assistant")
                }}
                aria-label="Full assistant"
                title="Full assistant"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-grey-40 transition hover:text-white"
              >
                <ExpandIcon />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-grey-40 transition hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {/* While the store isn't sell-ready, the way back into the setup
                wizard lives here — above everything else. */}
            <SetupResumeCard onNavigate={() => setOpen(false)} />

            {turns.length === 0 && (
              <div>
                <div className="rounded-2xl rounded-tl-sm bg-grey-10 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-grey-80">
                  {GREETING}
                </div>

                {attnReady && attention.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center gap-1.5 pl-1 text-[11px] font-semibold uppercase tracking-wider text-grey-50">
                      Needs your attention
                    </div>
                    <div className="space-y-1.5">
                      {attention.map((item) => (
                        <AttentionRow key={item.id} item={item} onCta={() => onCta(item)} />
                      ))}
                    </div>
                  </div>
                )}
                {attnReady && attention.length === 0 && (
                  <div className="mt-3 flex items-center gap-1.5 pl-1 text-[12px]" style={{ color: OK }}>
                    <span>✓</span>
                    <span className="text-grey-50">All clear — nothing needs your attention right now.</span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-70 transition hover:border-grey-30 hover:bg-grey-5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white" style={{ background: EMBER }}>
                    {t.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="space-y-1.5">
                  {(t.tools ?? []).map((tool) => (
                    <div key={tool.id} className="flex items-center gap-2 pl-1 text-[12px]">
                      {tool.state === "running" ? (
                        <Spinner />
                      ) : tool.state === "error" ? (
                        <span className="text-[13px]" style={{ color: DANGER }}>×</span>
                      ) : (
                        <span className="text-[13px]" style={{ color: OK }}>✓</span>
                      )}
                      <span className="text-grey-50">{tool.label}</span>
                    </div>
                  ))}
                  {t.thinking && !t.text && !t.error && (t.tools ?? []).length === 0 && (t.confirms ?? []).length === 0 && (
                    <div className="flex items-center gap-1.5 pl-1">
                      <Dots />
                    </div>
                  )}
                  {t.text && (
                    <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-grey-10 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-grey-80">
                      <RichText text={t.text} />
                    </div>
                  )}
                  {(() => {
                    const pendingSoft = (t.confirms ?? []).filter(
                      (c) =>
                        c.status === "pending" &&
                        c.tier === "soft" &&
                        !c.proposed
                    )
                    if (pendingSoft.length < 2) return null
                    return (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-grey-20 bg-grey-5 px-3 py-2">
                        <span className="text-[12px] font-medium text-grey-70">
                          {pendingSoft.length} steps ready to go
                        </span>
                        <button
                          type="button"
                          onClick={() => approveAllSoft(t.confirms ?? [])}
                          disabled={batchBusy}
                          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition disabled:opacity-40"
                          style={{ background: "#0F1319" }}
                        >
                          {batchBusy ? "Approving…" : `Approve all ${pendingSoft.length}`}
                        </button>
                      </div>
                    )
                  })()}
                  {(t.confirms ?? [])
                    .filter((c) => c.status !== "dismissed")
                    .map((c) =>
                      c.proposed ? (
                        <ProposedCard
                          key={c.id}
                          c={c}
                          onRedo={() =>
                            send(
                              `Please go ahead and do this now: ${c.summary.replace(
                                /\?+\s*$/,
                                ""
                              )}`
                            )
                          }
                        />
                      ) : (
                        <ConfirmCard
                          key={c.id}
                          c={c}
                          typed={cText[c.id] ?? ""}
                          onType={(v) => setCText((m) => ({ ...m, [c.id]: v }))}
                          onConfirm={() => applyConfirm(c, cText[c.id] ?? "")}
                          onDismiss={() =>
                            updateConfirm(c.id, (x) => ({
                              ...x,
                              status: "dismissed",
                            }))
                          }
                          onUndo={() => applyUndo(c)}
                        />
                      )
                    )}
                  {t.error && (
                    <div className="max-w-[92%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed" style={{ background: "rgba(196,54,64,.08)", color: DANGER }}>
                      {t.error}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-grey-20 p-2.5">
            <div className="flex items-end gap-2 rounded-xl border border-grey-20 bg-white px-3 py-2 focus-within:border-grey-40">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Ask Pixi, or tell it what to do…"
                className="max-h-28 min-h-[22px] flex-1 resize-none bg-transparent text-[13.5px] text-grey-90 placeholder:text-grey-40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-40"
                style={{ background: EMBER }}
              >
                <SendIcon />
              </button>
            </div>
            <div className="mt-1.5 text-center text-[10.5px] text-grey-40">
              Pixi always asks before it changes anything.
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------- rich text ------------------------------- */

/**
 * A tiny, dependency-free Markdown-ish renderer for assistant text. It builds
 * real React nodes (never dangerouslySetInnerHTML) and is deliberately
 * forgiving: odd or unbalanced input simply falls through as plain text, so it
 * never throws. It handles inline bold, italic, inline code,
 * [label](url) links (http/https only — otherwise the label is shown as text),
 * line breaks, and simple "- "/"* " bullet lists.
 */
function stripMarkers(input: string): string {
  return String(input ?? "")
    // keep the label of [label](http…) links, drop the URL/bracket syntax
    .replace(/\[([^\]]+?)\]\((?:https?:\/\/[^)\s]+)\)/g, "$1")
    // drop heading prefixes and the *, _, ` emphasis/code markers
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`]/g, "")
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const src = String(text ?? "")
  if (!src) return []
  try {
    const nodes: React.ReactNode[] = []
    // Order is deliberate: **bold**/__bold__ are matched BEFORE *italic*/_italic_
    // so a double marker is never mis-split into two italics. Inline `code` and
    // [label](http…) links are handled too. A lone/unmatched * or _ has no
    // closing partner, fails every branch, and is emitted verbatim as text.
    const re =
      /(\*\*|__)([\s\S]+?)\1|(\*|_)([\s\S]+?)\3|`([^`]+?)`|\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)/g
    let last = 0
    let k = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      // Defensive: never spin on a zero-width match.
      if (m[0].length === 0) {
        re.lastIndex++
        continue
      }
      if (m.index > last) nodes.push(src.slice(last, m.index))
      const key = `${keyPrefix}-${k++}`
      if (m[1] !== undefined) {
        // Recurse so mixed markers inside a bold span still parse.
        nodes.push(<strong key={key}>{renderInline(m[2], `${key}b`)}</strong>)
      } else if (m[3] !== undefined) {
        nodes.push(<em key={key}>{renderInline(m[4], `${key}i`)}</em>)
      } else if (m[5] !== undefined) {
        nodes.push(
          <code
            key={key}
            className="rounded px-1 py-0.5 font-mono text-[0.85em]"
            style={{ background: "rgba(15,19,25,.06)" }}
          >
            {m[5]}
          </code>
        )
      } else if (m[6] !== undefined) {
        nodes.push(
          <a
            key={key}
            href={m[7]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            style={{ color: EMBER }}
          >
            {m[6]}
          </a>
        )
      }
      last = re.lastIndex
    }
    if (last < src.length) nodes.push(src.slice(last))
    return nodes
  } catch {
    // Never dump raw markdown: strip the markers, keep the words readable.
    return [stripMarkers(src)]
  }
}

function RichText({ text }: { text: string }) {
  if (text == null || text === "") return null
  try {
    const lines = String(text).split(/\r?\n/)
    const blocks: React.ReactNode[] = []
    let bullets: React.ReactNode[] = []
    const flushBullets = (key: string) => {
      if (bullets.length) {
        blocks.push(
          <ul key={key} className="my-1 ml-4 list-disc space-y-0.5">
            {bullets}
          </ul>
        )
        bullets = []
      }
    }
    lines.forEach((line, i) => {
      // A "- " or "* " prefix (marker + at least one space) starts a bullet.
      const bm = /^\s*[-*]\s+(.*)$/.exec(line)
      if (bm) {
        bullets.push(<li key={`li-${i}`}>{renderInline(bm[1], `li-${i}`)}</li>)
        return
      }
      flushBullets(`ul-${i}`)
      if (line.trim() === "") {
        blocks.push(<div key={`sp-${i}`} className="h-2" aria-hidden="true" />)
        return
      }
      blocks.push(<div key={`ln-${i}`}>{renderInline(line, `ln-${i}`)}</div>)
    })
    flushBullets("ul-end")
    return <>{blocks}</>
  } catch {
    // Structural parse failed — render marker-stripped text, never raw markdown.
    return <>{stripMarkers(String(text))}</>
  }
}

/* --------------------------- proposed (replay) --------------------------- */

/**
 * A confirmation whose plan token has expired (e.g. replayed from history). It
 * can never be applied again from the saved card, so rather than a dead end it
 * offers "Do it now", which re-asks Pixi to propose the same change afresh —
 * producing a live, tappable confirmation.
 */
function ProposedCard({ c, onRedo }: { c: Confirm; onRedo: () => void }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-grey-20 bg-grey-5 px-3.5 py-2.5 text-[13px] leading-relaxed">
      <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-grey-40">
        Proposed earlier
      </div>
      <div className="text-grey-70">
        <RichText text={c.summary} />
      </div>
      <div className="mt-0.5 text-[11.5px] text-grey-40">
        Tap to set this up again.
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={onRedo}
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#0F1319" }}
        >
          Do it now
        </button>
      </div>
    </div>
  )
}

/* ------------------------------ confirm card ----------------------------- */

function ConfirmCard({
  c,
  typed,
  onType,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  c: Confirm
  typed: string
  onType: (v: string) => void
  onConfirm: () => void
  onDismiss: () => void
  onUndo: () => void
}) {
  const hard = c.tier === "hard"
  const need = String(c.requireText || "").toUpperCase()
  const ready = !hard || typed.trim().toUpperCase() === need
  const applying = c.status === "applying"

  if (c.status === "done") {
    return (
      <div
        className="max-w-[92%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={{ background: "rgba(18,146,90,.08)", border: "1px solid rgba(18,146,90,.25)" }}
      >
        <div
          className="flex items-center gap-1.5 font-semibold"
          style={{ color: OK }}
        >
          <span>✓</span>
          <span>Done</span>
        </div>
        {c.resultMsg && (
          <div className="mt-0.5 text-[12.5px] text-grey-50">
            <RichText text={c.resultMsg} />
          </div>
        )}
        {c.undone ? (
          <div className="mt-1 text-[11.5px] text-grey-50">Undone.</div>
        ) : c.undo ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={c.undoing}
            className="mt-1.5 text-[12px] font-medium underline decoration-grey-30 underline-offset-2 disabled:opacity-50"
            style={{ color: "#0F1319" }}
          >
            {c.undoing ? "Undoing…" : c.undo.label || "Undo"}
          </button>
        ) : null}
        {c.error && (
          <div className="mt-1 text-[11.5px]" style={{ color: DANGER }}>
            {c.error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="max-w-[92%] rounded-2xl rounded-tl-sm px-3.5 py-3 text-[13px] leading-relaxed"
      style={{
        background: hard ? "rgba(196,54,64,.05)" : "rgba(242,101,34,.06)",
        border: `1px solid ${hard ? "rgba(196,54,64,.3)" : "rgba(242,101,34,.28)"}`,
      }}
    >
      <div className="text-grey-90">
        <RichText text={c.summary} />
      </div>

      {c.error && (
        <div className="mt-1.5 text-[12px]" style={{ color: DANGER }}>
          {c.error}
        </div>
      )}

      {hard && (
        <div className="mt-2">
          <div className="mb-1 text-[11.5px] text-grey-50">
            Type <span className="font-semibold" style={{ color: DANGER }}>{need}</span> to confirm
          </div>
          <input
            value={typed}
            onChange={(e) => onType(e.target.value)}
            disabled={applying}
            placeholder={need}
            autoCapitalize="characters"
            className="w-full rounded-lg border border-grey-20 bg-white px-2.5 py-1.5 text-[13px] text-grey-90 focus:border-grey-40 focus:outline-none"
          />
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready || applying}
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white transition disabled:opacity-40"
          style={{ background: hard ? DANGER : "#0F1319" }}
        >
          {applying ? "Working…" : hard ? `Confirm` : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={applying}
          className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-grey-50 transition hover:text-grey-70 disabled:opacity-40"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

/* ----------------------------- attention row ----------------------------- */

function AttentionRow({ item, onCta }: { item: AttentionItem; onCta: () => void }) {
  const tone =
    item.severity === "blocker"
      ? { dot: DANGER, bg: "rgba(196,54,64,.05)", border: "rgba(196,54,64,.22)" }
      : item.severity === "warn"
      ? { dot: EMBER, bg: "rgba(242,101,34,.05)", border: "rgba(242,101,34,.22)" }
      : { dot: "#8A93A0", bg: "rgba(138,147,160,.06)", border: "rgba(138,147,160,.22)" }
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: tone.dot }} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-grey-90">{item.title}</div>
          <div className="text-[12px] leading-snug text-grey-60">{item.detail}</div>
          {item.cta && (
            <button
              type="button"
              onClick={onCta}
              className="mt-1.5 text-[12px] font-semibold underline decoration-grey-30 underline-offset-2"
              style={{ color: "#0F1319" }}
            >
              {item.cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- icons/bits ------------------------------ */

function SparkIcon({ small }: { small?: boolean }) {
  const s = small ? 15 : 22
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5l1.9 5.1c.2.6.7 1.1 1.3 1.3l5.1 1.9-5.1 1.9c-.6.2-1.1.7-1.3 1.3L12 19.1l-1.9-5.1c-.2-.6-.7-1.1-1.3-1.3L3.7 10.8l5.1-1.9c.6-.2 1.1-.7 1.3-1.3L12 2.5z"
        fill={small ? EMBER : "#fff"}
      />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor" />
    </svg>
  )
}
function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
function Spinner() {
  return (
    <svg className="jv-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,.12)" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={EMBER} strokeWidth="3" strokeLinecap="round" />
      <style>{`.jv-spin{animation:jvspin .7s linear infinite}@keyframes jvspin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  )
}
function Dots() {
  return (
    <span className="jv-dots inline-flex gap-1">
      <i /><i /><i />
      <style>{`.jv-dots i{width:5px;height:5px;border-radius:50%;background:#C0C6CF;display:inline-block;animation:jvb 1s infinite}.jv-dots i:nth-child(2){animation-delay:.15s}.jv-dots i:nth-child(3){animation-delay:.3s}@keyframes jvb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}`}</style>
    </span>
  )
}
