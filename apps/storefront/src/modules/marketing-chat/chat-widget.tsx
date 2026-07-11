"use client"

/**
 * Marketing live-chat widget.
 *
 * A self-contained floating chat bubble that talks to the marketing backend's
 * public web-chat API (anonymous, CORS-enabled, token-gated). It renders on
 * every page via the root layout.
 *
 * Enable/disable gate:
 *   - Renders by default (always-on).
 *   - Set NEXT_PUBLIC_MARKETING_CHAT_ENABLED="0" to disable it entirely.
 *   - Any other value (including unset) keeps it enabled.
 *
 * Backend base URL:
 *   - Uses NEXT_PUBLIC_MEDUSA_BACKEND_URL (the storefront's existing public
 *     backend env var), falling back to http://localhost:9000.
 *
 * API surface consumed:
 *   POST {BASE}/marketing-chat/session   { visitor_name? } -> { conversation_token, conversation_id }
 *   POST {BASE}/marketing-chat/message   { conversation_token, text } -> { ok: true }
 *   GET  {BASE}/marketing-chat/messages?conversation_token=…&since=… -> { messages: [...] }
 *
 * All calls use { mode: "cors" } — no cookies/credentials; the token gates the
 * conversation. Every window/localStorage access is guarded so SSR never runs
 * it, and any network failure degrades to an "unavailable" state rather than
 * crashing the storefront.
 */

import { useCallback, useEffect, useRef, useState } from "react"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

const TOKEN_STORAGE_KEY = "marketing_chat_token"
const POLL_INTERVAL_MS = 4000

type ChatMessage = {
  id: string
  direction: "inbound" | "outbound"
  author: string
  body: string
  media?: string | null
  sent_at: string
}

/** Client-side optimistic message before the backend echoes it back. */
type LocalMessage = ChatMessage & { pending?: boolean }

const isEnabled = () =>
  (process.env.NEXT_PUBLIC_MARKETING_CHAT_ENABLED ?? "1") !== "0"

const readStoredToken = (): string | null => {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

const persistToken = (token: string) => {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // Ignore storage failures (private mode, quota) — chat still works in-memory.
  }
}

const formatTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/** Visitor's own messages are authored by "contact" and align right. */
const isVisitorMessage = (message: LocalMessage) =>
  message.direction === "inbound" || message.author === "contact"

const ChatWidget = () => {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState("")
  const [unavailable, setUnavailable] = useState(false)
  const [sending, setSending] = useState(false)

  const tokenRef = useRef<string | null>(null)
  const lastSeenRef = useRef<string | undefined>(undefined)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) {
      return
    }
    setMessages((prev) => {
      const next = [...prev]
      for (const message of incoming) {
        const optimisticIdx = next.findIndex(
          (m) =>
            m.pending &&
            isVisitorMessage(m) &&
            m.body.trim() === message.body.trim()
        )
        if (optimisticIdx !== -1) {
          next[optimisticIdx] = message
          continue
        }
        if (!next.some((m) => m.id === message.id)) {
          next.push(message)
        }
      }
      next.sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      )
      const latest = next[next.length - 1]
      if (latest) {
        lastSeenRef.current = latest.sent_at
      }
      return next
    })
  }, [])

  const poll = useCallback(async () => {
    const token = tokenRef.current
    if (!token) {
      return
    }
    const params = new URLSearchParams({ conversation_token: token })
    if (lastSeenRef.current) {
      params.set("since", lastSeenRef.current)
    }
    try {
      const res = await fetch(
        `${BACKEND_URL}/marketing-chat/messages?${params.toString()}`,
        { mode: "cors" }
      )
      if (!res.ok) {
        throw new Error("poll failed")
      }
      const data = (await res.json()) as { messages?: ChatMessage[] }
      setUnavailable(false)
      mergeMessages(data.messages ?? [])
    } catch {
      setUnavailable(true)
    }
  }, [mergeMessages])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) {
      return tokenRef.current
    }
    const stored = readStoredToken()
    if (stored) {
      tokenRef.current = stored
      return stored
    }
    try {
      const res = await fetch(`${BACKEND_URL}/marketing-chat/session`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        throw new Error("session failed")
      }
      const data = (await res.json()) as { conversation_token?: string }
      if (!data.conversation_token) {
        throw new Error("no token")
      }
      tokenRef.current = data.conversation_token
      persistToken(data.conversation_token)
      setUnavailable(false)
      return data.conversation_token
    } catch {
      setUnavailable(true)
      return null
    }
  }, [])

  // Establish session + start/stop polling based on open state.
  useEffect(() => {
    if (!open) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    let cancelled = false

    const start = async () => {
      const token = await ensureSession()
      if (cancelled || !token) {
        return
      }
      await poll()
      if (cancelled) {
        return
      }
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS)
    }

    start()

    return () => {
      cancelled = true
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [open, ensureSession, poll])

  // Move focus into the panel on open; restore is handled by the toggle button.
  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => window.clearTimeout(timer)
    }
  }, [open])

  // Escape closes the panel.
  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  // Keep the newest message in view.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages, open])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) {
      return
    }
    setInput("")
    setSending(true)

    const optimistic: LocalMessage = {
      id: `local-${Date.now()}`,
      direction: "inbound",
      author: "contact",
      body: text,
      sent_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const token = await ensureSession()
      if (!token) {
        throw new Error("no session")
      }
      const res = await fetch(`${BACKEND_URL}/marketing-chat/message`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_token: token, text }),
      })
      if (!res.ok) {
        throw new Error("send failed")
      }
      setUnavailable(false)
      await poll()
    } catch {
      setUnavailable(true)
    } finally {
      setSending(false)
    }
  }, [input, sending, ensureSession, poll])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  if (!mounted || !isEnabled()) {
    return null
  }

  const accent = "var(--ff-primary, #72a499)"

  return (
    <div className="fixed bottom-4 right-4 z-[2147483000] flex flex-col items-end sm:bottom-6 sm:right-6">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Live chat"
          className="motion-safe:animate-enter mb-3 flex h-[70vh] max-h-[520px] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-large bg-white shadow-2xl ring-1 ring-black/10 sm:h-[520px] sm:w-[360px]"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ backgroundColor: accent }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-circle bg-white/20 text-base font-semibold"
              aria-hidden="true"
            >
              💬
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                Chat with us
              </p>
              <p className="truncate text-xs leading-tight text-white/80">
                We usually reply within a few minutes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-circle text-white/90 transition-colors hover:bg-white/20"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-grey-5 px-3 py-4">
            {messages.length === 0 && !unavailable && (
              <div className="mt-6 text-center text-sm text-grey-50">
                <p className="font-medium text-grey-70">👋 Hi there!</p>
                <p className="mt-1">
                  Send us a message and we&rsquo;ll get right back to you.
                </p>
              </div>
            )}

            {unavailable && messages.length === 0 && (
              <div className="mt-6 text-center text-sm text-grey-50">
                Chat is unavailable right now. Please try again later.
              </div>
            )}

            {messages.map((message) => {
              const mine = isVisitorMessage(message)
              if (mine) {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[80%]">
                      <div
                        className="rounded-large rounded-br-base px-3 py-2 text-sm text-white"
                        style={{
                          backgroundColor: accent,
                          opacity: message.pending ? 0.7 : 1,
                        }}
                      >
                        {message.body}
                      </div>
                      <div className="mt-1 text-right text-[10px] text-grey-40">
                        {message.pending ? "Sending…" : formatTime(message.sent_at)}
                      </div>
                    </div>
                  </div>
                )
              }

              const isAi = message.author === "ai"
              const label = isAi
                ? "Assistant"
                : message.author === "system"
                  ? "System"
                  : "Support"
              return (
                <div key={message.id} className="flex justify-start gap-2">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-circle text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  >
                    {label.charAt(0)}
                  </div>
                  <div className="max-w-[80%]">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-grey-60">
                        {label}
                      </span>
                      {isAi && (
                        <span
                          className="rounded-soft px-1 py-0.5 text-[9px] font-semibold uppercase leading-none text-white"
                          style={{ backgroundColor: accent }}
                        >
                          AI
                        </span>
                      )}
                    </div>
                    <div className="rounded-large rounded-bl-base bg-white px-3 py-2 text-sm text-grey-80 ring-1 ring-grey-20">
                      {message.body}
                    </div>
                    <div className="mt-1 text-[10px] text-grey-40">
                      {formatTime(message.sent_at)}
                    </div>
                  </div>
                </div>
              )
            })}

            <div ref={listEndRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-grey-20 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message…"
                aria-label="Type your message"
                className="min-w-0 flex-1 rounded-circle border border-grey-20 bg-grey-5 px-4 py-2 text-sm text-grey-80 outline-none focus:border-grey-40"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-circle text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8l12-5.5L9 14l-2.2-4.3L2 8z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle bubble */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-circle text-white shadow-lg transition-transform motion-safe:hover:scale-105"
        style={{ backgroundColor: accent }}
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 5h16v11H9l-4 3v-3H4V5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

export default ChatWidget
