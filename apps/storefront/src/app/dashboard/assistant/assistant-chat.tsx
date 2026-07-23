"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Sidebar } from "@components/merchant-admin/sidebar"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { Plus, Trash, PencilSquare, XMark, BarsThree } from "@medusajs/icons"

/**
 * Assistant — the full-page home of Pixi.
 *
 * This is the same assistant as the docked panel (@components/merchant-admin/
 * jarvis-panel), but given a room of its own: a ChatGPT-style two-pane layout
 * with saved conversations on the left and the live transcript on the right.
 *
 * The streaming + confirm machinery is intentionally identical to the panel —
 * the exact SSE-over-POST frame parser, the thinking/tool/confirm/message/done/
 * error handler, the ConfirmCard with soft one-tap and hard typed confirmation,
 * apply/undo, and approve-all-soft. It is copied rather than shared so the
 * shipped, verified panel is never touched. Both surfaces therefore behave and
 * read as one product.
 *
 * What the page adds on top of the panel: conversation persistence. Every turn
 * carries a `conversation_id` so the backend stores it; the sidebar lists past
 * chats (newest first, grouped by day), and loading one replays its history.
 * Replayed tool calls render as completed chips and replayed confirmations
 * render as static "proposed" summaries — their plan tokens have expired, so
 * only confirmations that arrive live over the stream are ever actionable.
 */

type ToolState = "running" | "done" | "error"
type Tool = { id: string; label: string; state: ToolState }
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
  // A replayed confirmation from stored history. Its token is expired, so it is
  // shown as a read-only "proposed" summary, never an actionable card.
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
type ConversationMeta = { id: string; title: string; updated_at: string }
type StoredMessage = {
  role: "user" | "assistant"
  content: string
  meta?: {
    tools?: { label?: string; name?: string }[]
    confirms?: { summary?: string; action?: string; tier?: string }[]
  } | null
  created_at: string
}
type AttentionItem = {
  id: string
  severity: "blocker" | "warn" | "info"
  title: string
  detail: string
  cta?: { label: string; prompt?: string; href?: string }
}

const INK = "#0F1319"
const EMBER = "#F26522"
const DANGER = "#C43640"
const OK = "#12925A"

const GREETING =
  "Hi — I'm Pixi. Ask me about your shop, or tell me to do something: set up delivery, publish a product, change a price, fulfil or refund an order. I read live data, and I'll always show you a confirmation before anything changes."

const SUGGESTIONS = [
  "How's my shop doing?",
  "Is my store ready to sell?",
  "Show my recent orders",
  "What needs my attention today?",
]

/* --------------------------- history → transcript ------------------------ */

function buildTurns(messages: StoredMessage[]): Turn[] {
  return messages.map((m, i) => {
    if (m.role === "user") {
      return { role: "user", text: m.content }
    }
    const tools: Tool[] = (m.meta?.tools ?? []).map((t, j) => ({
      id: `h${i}-t${j}`,
      label: t.label || t.name || "Step",
      state: "done",
    }))
    const confirms: Confirm[] = (m.meta?.confirms ?? []).map((c, j) => ({
      id: `h${i}-c${j}`,
      action: c.action || "",
      tier: c.tier === "hard" ? "hard" : "soft",
      summary: c.summary || "Proposed change",
      token: "",
      status: "pending",
      proposed: true,
    }))
    return {
      role: "assistant",
      text: m.content || undefined,
      tools,
      confirms,
    }
  })
}

/* ------------------------------ date grouping ---------------------------- */

type Grouped = {
  today: ConversationMeta[]
  yesterday: ConversationMeta[]
  week: ConversationMeta[]
  older: ConversationMeta[]
}

function groupByDay(list: ConversationMeta[]): Grouped {
  const now = new Date()
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()
  const startOfYesterday = startOfToday - 86400000
  const start7 = startOfToday - 6 * 86400000
  const g: Grouped = { today: [], yesterday: [], week: [], older: [] }
  const sorted = [...list].sort((a, b) => {
    const at = a.updated_at ? Date.parse(a.updated_at) : 0
    const bt = b.updated_at ? Date.parse(b.updated_at) : 0
    return bt - at
  })
  for (const c of sorted) {
    const t = c.updated_at ? Date.parse(c.updated_at) : 0
    if (t >= startOfToday) g.today.push(c)
    else if (t >= startOfYesterday) g.yesterday.push(c)
    else if (t >= start7) g.week.push(c)
    else g.older.push(c)
  }
  return g
}

/* ================================ component =============================== */

export function AssistantChat() {
  const { token } = useMerchantAuth()

  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [loadingTurns, setLoadingTurns] = useState(false)

  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [cText, setCText] = useState<Record<string, string>>({})

  const [attention, setAttention] = useState<AttentionItem[]>([])
  const [attnReady, setAttnReady] = useState(false)

  // Inline conversation controls — no window.confirm / prompt anywhere.
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Mobile: the conversation rail is a slide-over.
  const [railOpen, setRailOpen] = useState(false)
  // Mobile: the main dashboard nav, borrowed on demand.
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  /* ------------------------------ data loads ----------------------------- */

  const loadConversations = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch("/merchant/jarvis/conversations", {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d?.conversations)) setConversations(d.conversations)
    } catch {
      /* the list is a convenience; a failure must not take the page down */
    }
  }, [token])

  useEffect(() => {
    if (token) void loadConversations()
  }, [token, loadConversations])

  // Proactive layer: what needs the merchant's attention, shown on the empty
  // state exactly as the panel shows it.
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
  }, [turns, activeId, loadingTurns])

  /* ---------------------------- transcript edits ------------------------- */

  const patchLast = (fn: (t: Turn) => Turn) =>
    setTurns((prev) => {
      if (!prev.length) return prev
      const next = prev.slice()
      next[next.length - 1] = fn(next[next.length - 1])
      return next
    })

  const updateConfirm = (id: string, fn: (c: Confirm) => Confirm) =>
    setTurns((prev) =>
      prev.map((t) =>
        t.confirms?.some((c) => c.id === id)
          ? { ...t, confirms: t.confirms.map((c) => (c.id === id ? fn(c) : c)) }
          : t
      )
    )

  /* --------------------------- conversation ops -------------------------- */

  const selectConversation = useCallback(
    async (id: string) => {
      if (!token || busy) return
      setActiveId(id)
      setRailOpen(false)
      setTurns([])
      setLoadingTurns(true)
      try {
        const r = await fetch(`/merchant/jarvis/conversations/${id}`, {
          headers: { authorization: `Bearer ${token}` },
        })
        if (!r.ok) throw new Error("failed")
        const d = await r.json()
        setTurns(buildTurns(Array.isArray(d?.messages) ? d.messages : []))
      } catch {
        setTurns([
          {
            role: "assistant",
            error: "Couldn't load this conversation. Try again in a moment.",
          },
        ])
      } finally {
        setLoadingTurns(false)
        setTimeout(() => taRef.current?.focus(), 60)
      }
    },
    [token, busy]
  )

  const newChat = useCallback(async () => {
    if (!token) return
    setRailOpen(false)
    try {
      const r = await fetch("/merchant/jarvis/conversations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      if (!r.ok) throw new Error("failed")
      const d = await r.json()
      if (d?.id) {
        setConversations((prev) => [
          { id: d.id, title: d.title || "New chat", updated_at: new Date().toISOString() },
          ...prev,
        ])
        setActiveId(d.id)
      }
    } catch {
      // Fall back to a blank, unsaved canvas; the first send will create one.
      setActiveId(null)
    }
    setTurns([])
    setTimeout(() => taRef.current?.focus(), 60)
  }, [token])

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const clean = title.trim()
      setRenamingId(null)
      if (!token || !clean) return
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: clean } : c))
      )
      try {
        await fetch(`/merchant/jarvis/conversations/${id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: clean }),
        })
      } catch {
        void loadConversations()
      }
    },
    [token, loadConversations]
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      setDeletingId(null)
      if (!token) return
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeId === id) {
        setActiveId(null)
        setTurns([])
      }
      try {
        await fetch(`/merchant/jarvis/conversations/${id}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        })
      } catch {
        void loadConversations()
      }
    },
    [token, activeId, loadConversations]
  )

  /* -------------------------------- send --------------------------------- */

  async function ensureConversation(): Promise<string | null> {
    if (activeId) return activeId
    if (!token) return null
    try {
      const r = await fetch("/merchant/jarvis/conversations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      if (!r.ok) return null
      const d = await r.json()
      if (!d?.id) return null
      setConversations((prev) => [
        { id: d.id, title: d.title || "New chat", updated_at: new Date().toISOString() },
        ...prev,
      ])
      setActiveId(d.id)
      return d.id
    } catch {
      return null
    }
  }

  async function send(preset?: string) {
    const message = (preset ?? input).trim()
    if (!message || busy || !token) return
    setInput("")

    const convId = await ensureConversation()

    const ac = new AbortController()
    abortRef.current = ac
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
        body: JSON.stringify({ message, conversation_id: convId }),
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
      // The first turn auto-titles server-side; refresh so the sidebar reflects
      // the new title and the freshly-bumped order.
      void loadConversations()
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
      patchLast((t) => ({
        ...t,
        error: p.message || "Something went wrong.",
        thinking: false,
      }))
    } else if (ev === "done") {
      if (p.conversation_id && !activeId) setActiveId(p.conversation_id)
      patchLast((t) => ({ ...t, thinking: false }))
    }
  }

  /* ------------------------------ apply/undo ----------------------------- */

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
      updateConfirm(c.id, (x) => ({
        ...x,
        undoing: false,
        error: "Couldn't undo that.",
      }))
    }
  }

  function onCta(item: AttentionItem) {
    setAttention((prev) => prev.filter((a) => a.id !== item.id))
    if (item.cta?.prompt) {
      void send(item.cta.prompt)
    } else if (item.cta?.href) {
      window.location.href = item.cta.href
    }
  }

  /* -------------------------------- render ------------------------------- */

  const grouped = useMemo(() => groupByDay(conversations), [conversations])
  const hasTranscript = turns.length > 0 || loadingTurns

  if (!token) return null

  return (
    <div className="flex h-full min-h-0">
      {/* The main dashboard nav, borrowed on demand on mobile. On desktop it is
          rendered persistently below so the merchant can leave the assistant. */}
      {menuOpen && <Sidebar overlay onClose={() => setMenuOpen(false)} />}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-h-0 flex-1 lg:ml-64">
        {/* ---------------------------- conversation rail ---------------------------- */}
        <ConversationRail
          grouped={grouped}
          activeId={activeId}
          railOpen={railOpen}
          renamingId={renamingId}
          renameValue={renameValue}
          deletingId={deletingId}
          busy={busy}
          onNewChat={newChat}
          onSelect={selectConversation}
          onCloseRail={() => setRailOpen(false)}
          onStartRename={(c) => {
            setRenamingId(c.id)
            setRenameValue(c.title)
            setDeletingId(null)
          }}
          onRenameValue={setRenameValue}
          onCommitRename={(id) => renameConversation(id, renameValue)}
          onCancelRename={() => setRenamingId(null)}
          onStartDelete={(id) => {
            setDeletingId(id)
            setRenamingId(null)
          }}
          onConfirmDelete={deleteConversation}
          onCancelDelete={() => setDeletingId(null)}
        />

        {/* -------------------------------- main pane -------------------------------- */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
          {/* Compact header — the mobile handles for the two rails. */}
          <div className="flex items-center gap-2 border-b border-grey-20 px-3 py-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-grey-60 hover:bg-grey-10"
            >
              <BarsThree className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-grey-70 hover:bg-grey-10"
            >
              Chats
            </button>
            <div className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-grey-90">
              <SparkIcon small />
              Pixi
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
              {!hasTranscript ? (
                <EmptyState
                  attnReady={attnReady}
                  attention={attention}
                  onSuggest={(s) => send(s)}
                  onCta={onCta}
                />
              ) : loadingTurns ? (
                <div className="flex items-center gap-2 pl-1 pt-2 text-[13px] text-grey-50">
                  <Spinner /> Loading conversation…
                </div>
              ) : (
                <div className="space-y-4">
                  {turns.map((t, i) =>
                    t.role === "user" ? (
                      <div key={i} className="flex justify-end">
                        <div
                          className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] leading-relaxed text-white"
                          style={{ background: EMBER }}
                        >
                          {t.text}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="space-y-1.5">
                        {(t.tools ?? []).map((tool) => (
                          <div
                            key={tool.id}
                            className="flex items-center gap-2 pl-1 text-[12.5px]"
                          >
                            {tool.state === "running" ? (
                              <Spinner />
                            ) : tool.state === "error" ? (
                              <span className="text-[13px]" style={{ color: DANGER }}>
                                ×
                              </span>
                            ) : (
                              <span className="text-[13px]" style={{ color: OK }}>
                                ✓
                              </span>
                            )}
                            <span className="text-grey-50">{tool.label}</span>
                          </div>
                        ))}
                        {t.thinking &&
                          !t.text &&
                          !t.error &&
                          (t.tools ?? []).length === 0 &&
                          (t.confirms ?? []).length === 0 && (
                            <div className="flex items-center gap-1.5 pl-1">
                              <Dots />
                            </div>
                          )}
                        {t.text && (
                          <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-grey-10 px-4 py-2.5 text-[14px] leading-relaxed text-grey-80">
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
                            <div className="flex max-w-[92%] items-center justify-between gap-2 rounded-xl border border-grey-20 bg-grey-5 px-3 py-2">
                              <span className="text-[12.5px] font-medium text-grey-70">
                                {pendingSoft.length} steps ready to go
                              </span>
                              <button
                                type="button"
                                onClick={() => approveAllSoft(t.confirms ?? [])}
                                disabled={batchBusy}
                                className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white transition disabled:opacity-40"
                                style={{ background: INK }}
                              >
                                {batchBusy
                                  ? "Approving…"
                                  : `Approve all ${pendingSoft.length}`}
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
                                onType={(v) =>
                                  setCText((m) => ({ ...m, [c.id]: v }))
                                }
                                onConfirm={() =>
                                  applyConfirm(c, cText[c.id] ?? "")
                                }
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
                          <div
                            className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed"
                            style={{
                              background: "rgba(196,54,64,.08)",
                              color: DANGER,
                            }}
                          >
                            {t.error}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* -------------------------------- composer -------------------------------- */}
          <div className="border-t border-grey-20 bg-white px-4 py-3 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <div className="flex items-end gap-2 rounded-2xl border border-grey-20 bg-white px-3.5 py-2.5 focus-within:border-grey-40">
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
                  className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-grey-90 placeholder:text-grey-40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-40"
                  style={{ background: EMBER }}
                >
                  <SendIcon />
                </button>
              </div>
              <div className="mt-1.5 text-center text-[11px] text-grey-40">
                Pixi reads your live shop and always asks before it changes
                anything.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================ conversation rail =========================== */

function ConversationRail({
  grouped,
  activeId,
  railOpen,
  renamingId,
  renameValue,
  deletingId,
  busy,
  onNewChat,
  onSelect,
  onCloseRail,
  onStartRename,
  onRenameValue,
  onCommitRename,
  onCancelRename,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  grouped: Grouped
  activeId: string | null
  railOpen: boolean
  renamingId: string | null
  renameValue: string
  deletingId: string | null
  busy: boolean
  onNewChat: () => void
  onSelect: (id: string) => void
  onCloseRail: () => void
  onStartRename: (c: ConversationMeta) => void
  onRenameValue: (v: string) => void
  onCommitRename: (id: string) => void
  onCancelRename: () => void
  onStartDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const empty =
    grouped.today.length +
      grouped.yesterday.length +
      grouped.week.length +
      grouped.older.length ===
    0

  const rail = (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-grey-20 bg-grey-5">
      <div className="p-3">
        <div className="mb-1 flex items-center justify-between lg:hidden">
          <span className="pl-1 text-[13px] font-semibold text-grey-90">
            Conversations
          </span>
          <button
            type="button"
            onClick={onCloseRail}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-grey-50 hover:bg-grey-10"
          >
            <XMark className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: INK }}
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {empty ? (
          <div className="px-2 pt-6 text-center text-[12.5px] leading-relaxed text-grey-40">
            No conversations yet. Start one to see it here.
          </div>
        ) : (
          <>
            <RailGroup
              label="Today"
              items={grouped.today}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              deletingId={deletingId}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onRenameValue={onRenameValue}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onStartDelete={onStartDelete}
              onConfirmDelete={onConfirmDelete}
              onCancelDelete={onCancelDelete}
            />
            <RailGroup
              label="Yesterday"
              items={grouped.yesterday}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              deletingId={deletingId}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onRenameValue={onRenameValue}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onStartDelete={onStartDelete}
              onConfirmDelete={onConfirmDelete}
              onCancelDelete={onCancelDelete}
            />
            <RailGroup
              label="Previous 7 days"
              items={grouped.week}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              deletingId={deletingId}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onRenameValue={onRenameValue}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onStartDelete={onStartDelete}
              onConfirmDelete={onConfirmDelete}
              onCancelDelete={onCancelDelete}
            />
            <RailGroup
              label="Older"
              items={grouped.older}
              activeId={activeId}
              renamingId={renamingId}
              renameValue={renameValue}
              deletingId={deletingId}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onRenameValue={onRenameValue}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onStartDelete={onStartDelete}
              onConfirmDelete={onConfirmDelete}
              onCancelDelete={onCancelDelete}
            />
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: always present. */}
      <div className="hidden lg:flex">{rail}</div>

      {/* Mobile: a slide-over. */}
      {railOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={onCloseRail}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">{rail}</div>
        </>
      )}
    </>
  )
}

function RailGroup({
  label,
  items,
  activeId,
  renamingId,
  renameValue,
  deletingId,
  onSelect,
  onStartRename,
  onRenameValue,
  onCommitRename,
  onCancelRename,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  label: string
  items: ConversationMeta[]
  activeId: string | null
  renamingId: string | null
  renameValue: string
  deletingId: string | null
  onSelect: (id: string) => void
  onStartRename: (c: ConversationMeta) => void
  onRenameValue: (v: string) => void
  onCommitRename: (id: string) => void
  onCancelRename: () => void
  onStartDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-grey-40">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map((c) => (
          <RailRow
            key={c.id}
            c={c}
            active={c.id === activeId}
            renaming={c.id === renamingId}
            renameValue={renameValue}
            deleting={c.id === deletingId}
            onSelect={() => onSelect(c.id)}
            onStartRename={() => onStartRename(c)}
            onRenameValue={onRenameValue}
            onCommitRename={() => onCommitRename(c.id)}
            onCancelRename={onCancelRename}
            onStartDelete={() => onStartDelete(c.id)}
            onConfirmDelete={() => onConfirmDelete(c.id)}
            onCancelDelete={onCancelDelete}
          />
        ))}
      </div>
    </div>
  )
}

function RailRow({
  c,
  active,
  renaming,
  renameValue,
  deleting,
  onSelect,
  onStartRename,
  onRenameValue,
  onCommitRename,
  onCancelRename,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  c: ConversationMeta
  active: boolean
  renaming: boolean
  renameValue: string
  deleting: boolean
  onSelect: () => void
  onStartRename: () => void
  onRenameValue: (v: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onStartDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  if (renaming) {
    return (
      <div className="px-1">
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameValue(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onCommitRename()
            } else if (e.key === "Escape") {
              e.preventDefault()
              onCancelRename()
            }
          }}
          className="w-full rounded-lg border border-grey-30 bg-white px-2.5 py-1.5 text-[13px] text-grey-90 focus:outline-none"
        />
      </div>
    )
  }

  if (deleting) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-grey-70">
          Delete this chat?
        </span>
        <button
          type="button"
          onClick={onConfirmDelete}
          className="rounded-md px-2 py-1 text-[12px] font-semibold text-white"
          style={{ background: DANGER }}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onCancelDelete}
          className="rounded-md px-1.5 py-1 text-[12px] font-medium text-grey-50 hover:text-grey-80"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div
      className={
        "group relative flex items-center rounded-lg pr-1 transition-colors " +
        (active ? "bg-grey-10" : "hover:bg-grey-10")
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px] font-medium text-grey-80"
      >
        {c.title || "Untitled"}
      </button>
      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onStartRename()
          }}
          aria-label="Rename"
          className="flex h-7 w-7 items-center justify-center rounded-md text-grey-40 hover:bg-grey-20 hover:text-grey-70"
        >
          <PencilSquare className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onStartDelete()
          }}
          aria-label="Delete"
          className="flex h-7 w-7 items-center justify-center rounded-md text-grey-40 hover:bg-grey-20 hover:text-grey-70"
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ============================== empty state ============================== */

function EmptyState({
  attnReady,
  attention,
  onSuggest,
  onCta,
}: {
  attnReady: boolean
  attention: AttentionItem[]
  onSuggest: (s: string) => void
  onCta: (item: AttentionItem) => void
}) {
  return (
    <div className="py-6">
      <div className="flex flex-col items-center pb-6 pt-8 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: INK }}
        >
          <SparkIcon />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold text-grey-90">
          How can I help with your shop?
        </h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-grey-50">
          {GREETING}
        </p>
      </div>

      <div className="mx-auto max-w-lg">
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggest(s)}
              className="rounded-full border border-grey-20 bg-white px-3.5 py-2 text-[12.5px] font-medium text-grey-70 transition hover:border-grey-30 hover:bg-grey-5"
            >
              {s}
            </button>
          ))}
        </div>

        {attnReady && attention.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 pl-1 text-[11px] font-semibold uppercase tracking-wider text-grey-50">
              Needs your attention
            </div>
            <div className="space-y-1.5">
              {attention.map((item) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  onCta={() => onCta(item)}
                />
              ))}
            </div>
          </div>
        )}
        {attnReady && attention.length === 0 && (
          <div
            className="mt-8 flex items-center justify-center gap-1.5 text-[12.5px]"
            style={{ color: OK }}
          >
            <span>✓</span>
            <span className="text-grey-50">
              All clear — nothing needs your attention right now.
            </span>
          </div>
        )}
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
        className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed"
        style={{
          background: "rgba(18,146,90,.08)",
          border: "1px solid rgba(18,146,90,.25)",
        }}
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
            style={{ color: INK }}
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
      className="max-w-[92%] rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed"
      style={{
        background: hard ? "rgba(196,54,64,.05)" : "rgba(242,101,34,.06)",
        border: `1px solid ${
          hard ? "rgba(196,54,64,.3)" : "rgba(242,101,34,.28)"
        }`,
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
            Type{" "}
            <span className="font-semibold" style={{ color: DANGER }}>
              {need}
            </span>{" "}
            to confirm
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
          style={{ background: hard ? DANGER : INK }}
        >
          {applying ? "Working…" : "Confirm"}
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
 * A confirmation from stored history. Its plan token expired the moment its run
 * ended, so it can never be applied again from the saved card. Rather than a
 * dead end, it offers "Do it now", which re-asks Pixi to propose the same
 * change afresh — producing a live, tappable confirmation.
 */
function ProposedCard({ c, onRedo }: { c: Confirm; onRedo: () => void }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-grey-20 bg-grey-5 px-4 py-2.5 text-[13px] leading-relaxed">
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
          style={{ background: INK }}
        >
          Do it now
        </button>
      </div>
    </div>
  )
}

/* ----------------------------- attention row ----------------------------- */

function AttentionRow({
  item,
  onCta,
}: {
  item: AttentionItem
  onCta: () => void
}) {
  const tone =
    item.severity === "blocker"
      ? { dot: DANGER, bg: "rgba(196,54,64,.05)", border: "rgba(196,54,64,.22)" }
      : item.severity === "warn"
      ? { dot: EMBER, bg: "rgba(242,101,34,.05)", border: "rgba(242,101,34,.22)" }
      : {
          dot: "#8A93A0",
          bg: "rgba(138,147,160,.06)",
          border: "rgba(138,147,160,.22)",
        }
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: tone.dot }}
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-grey-90">
            {item.title}
          </div>
          <div className="text-[12px] leading-snug text-grey-60">
            {item.detail}
          </div>
          {item.cta && (
            <button
              type="button"
              onClick={onCta}
              className="mt-1.5 text-[12px] font-semibold underline decoration-grey-30 underline-offset-2"
              style={{ color: INK }}
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
  const s = small ? 16 : 26
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5l1.9 5.1c.2.6.7 1.1 1.3 1.3l5.1 1.9-5.1 1.9c-.6.2-1.1.7-1.3 1.3L12 19.1l-1.9-5.1c-.2-.6-.7-1.1-1.3-1.3L3.7 10.8l5.1-1.9c.6-.2 1.1-.7 1.3-1.3L12 2.5z"
        fill={small ? EMBER : "#fff"}
      />
    </svg>
  )
}
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor" />
    </svg>
  )
}
function Spinner() {
  return (
    <svg
      className="jv-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,.12)" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke={EMBER}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <style>{`.jv-spin{animation:jvspin .7s linear infinite}@keyframes jvspin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  )
}
function Dots() {
  return (
    <span className="jv-dots inline-flex gap-1">
      <i />
      <i />
      <i />
      <style>{`.jv-dots i{width:5px;height:5px;border-radius:50%;background:#C0C6CF;display:inline-block;animation:jvb 1s infinite}.jv-dots i:nth-child(2){animation-delay:.15s}.jv-dots i:nth-child(3){animation-delay:.3s}@keyframes jvb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}`}</style>
    </span>
  )
}
