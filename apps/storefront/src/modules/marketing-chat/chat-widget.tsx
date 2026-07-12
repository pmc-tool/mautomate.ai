"use client"

/**
 * Marketing live-chat widget — the tenant's own chatbot, on the tenant's own
 * storefront.
 *
 * MOUNTING IS DATA-DRIVEN: the storefront layout renders this ONLY when the
 * request's tenant has an ACTIVE chatbot (its `public_key` arrives via
 * /tenant-config -> the x-tenant-chatbot header -> `getChatbotPublicKey()`).
 * No env flag decides whether a store has chat — the merchant's data does. With
 * no key the component is never mounted, so it makes no requests at all.
 *
 * The public key is the tenant anchor for every call: the backend resolves it to
 * exactly one active chatbot and uses THAT bot's tenant for the conversation, so
 * a visitor on store A can only ever create/read a conversation in store A.
 *
 * API surface consumed (all anonymous, CORS, no cookies/credentials):
 *   GET  {BASE}/marketing-chat/config?public_key=…  -> { chatbot: {...appearance} }
 *   POST {BASE}/marketing-chat/session   { public_key, visitor_name? } -> { conversation_token }
 *   POST {BASE}/marketing-chat/message   { conversation_token, text }  -> { ok: true } | 429
 *   GET  {BASE}/marketing-chat/messages?conversation_token=…&since=…   -> { messages: [...] }
 *
 * The conversation token is the ONLY secret the widget holds; it is stored per
 * public key so two different bots never share a thread. Every window/localStorage
 * access is SSR-guarded, and any network failure degrades to a notice rather than
 * crashing the storefront.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

const POLL_INTERVAL_MS = 4000

type ChatbotConfig = {
  public_key: string
  name: string
  welcome_message: string | null
  bubble_message: string | null
  avatar: string | null
  color: string
  position: "left" | "right"
  show_logo: boolean
  show_datetime: boolean
  embed_width: number
  embed_height: number
  allow_emoji: boolean
  allow_attachments: boolean
  collect_email: boolean
}

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

const tokenKey = (publicKey: string) => `marketing_chat_token_${publicKey}`

const readStoredToken = (publicKey: string): string | null => {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.localStorage.getItem(tokenKey(publicKey))
  } catch {
    return null
  }
}

const persistToken = (publicKey: string, token: string) => {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.localStorage.setItem(tokenKey(publicKey), token)
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

type Props = {
  /** The tenant's active chatbot public key. Required — no key, no widget. */
  publicKey: string
  /**
   * Appearance resolved on the SERVER by the mount (chat-widget-mount), so the
   * bubble is in the SSR HTML and never flashes in. When omitted (a purely
   * client-side use) the widget fetches /marketing-chat/config itself.
   */
  config?: ChatbotConfig | null
}

const ChatWidget = ({ publicKey, config: initialConfig = null }: Props) => {
  const [config, setConfig] = useState<ChatbotConfig | null>(initialConfig)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [teaserDismissed, setTeaserDismissed] = useState(false)

  const tokenRef = useRef<string | null>(null)
  const lastSeenRef = useRef<string | undefined>(undefined)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)

  // Appearance. Skipped when the server already resolved it. A 404 here means
  // the key is not a live bot -> render nothing.
  useEffect(() => {
    if (initialConfig) {
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/marketing-chat/config?public_key=${encodeURIComponent(
            publicKey
          )}`,
          { mode: "cors" }
        )
        if (!res.ok) {
          return
        }
        const data = (await res.json()) as { chatbot?: ChatbotConfig }
        if (!cancelled && data.chatbot) {
          setConfig(data.chatbot)
        }
      } catch {
        // Backend unreachable: stay unmounted rather than show a dead bubble.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [publicKey, initialConfig])

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
            m.body.trim() === (message.body ?? "").trim()
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
      mergeMessages(data.messages ?? [])
    } catch {
      // Transient — the next tick retries. Only a failed SEND surfaces a notice.
    }
  }, [mergeMessages])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) {
      return tokenRef.current
    }
    const stored = readStoredToken(publicKey)
    if (stored) {
      tokenRef.current = stored
      return stored
    }
    try {
      const res = await fetch(`${BACKEND_URL}/marketing-chat/session`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: publicKey }),
      })
      if (!res.ok) {
        throw new Error("session failed")
      }
      const data = (await res.json()) as { conversation_token?: string }
      if (!data.conversation_token) {
        throw new Error("no token")
      }
      tokenRef.current = data.conversation_token
      persistToken(publicKey, data.conversation_token)
      setNotice(null)
      return data.conversation_token
    } catch {
      setNotice("Chat is unavailable right now. Please try again later.")
      return null
    }
  }, [publicKey])

  // Establish session + start/stop polling based on open state.
  useEffect(() => {
    if (!open || !config) {
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
  }, [open, config, ensureSession, poll])

  // Move focus into the panel on open.
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
      if (res.status === 429) {
        // The backend rate limits this public endpoint (it triggers paid AI
        // calls). Tell the visitor plainly instead of silently dropping.
        setNotice("You are sending messages too quickly. Please wait a moment.")
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        return
      }
      if (!res.ok) {
        throw new Error("send failed")
      }
      setNotice(null)
      await poll()
    } catch {
      setNotice("Message could not be sent. Please try again.")
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
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

  const panelStyle = useMemo(() => {
    if (!config) {
      return undefined
    }
    return {
      width: `min(${config.embed_width}px, calc(100vw - 2rem))`,
      height: `min(${config.embed_height}px, calc(100vh - 8rem))`,
    }
  }, [config])

  // No live chatbot (or config not loaded yet): render nothing.
  if (!config) {
    return null
  }

  const accent = config.color
  const side =
    config.position === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6"
  const align = config.position === "left" ? "items-start" : "items-end"
  const showTeaser = !open && !teaserDismissed && !!config.bubble_message

  return (
    <div
      className={`fixed bottom-4 z-[2147483000] flex flex-col ${align} ${side} sm:bottom-6`}
    >
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={config.name}
          style={panelStyle}
          className="motion-safe:animate-enter mb-3 flex flex-col overflow-hidden rounded-large bg-white shadow-2xl ring-1 ring-black/10"
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ backgroundColor: accent }}
          >
            {config.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.avatar}
                alt=""
                className="h-9 w-9 shrink-0 rounded-circle object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-circle bg-white/20 text-base font-semibold"
                aria-hidden="true"
              >
                {config.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {config.name}
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
            {messages.length === 0 && (
              <div className="mt-6 text-center text-sm text-grey-50">
                <p>
                  {config.welcome_message ??
                    "Send us a message and we will reply here."}
                </p>
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
                      {config.show_datetime && (
                        <div className="mt-1 text-right text-[10px] text-grey-40">
                          {message.pending
                            ? "Sending..."
                            : formatTime(message.sent_at)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              const label =
                message.author === "system"
                  ? "System"
                  : message.author === "agent"
                    ? "Support"
                    : config.name
              return (
                <div key={message.id} className="flex justify-start gap-2">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-circle text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  >
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[80%]">
                    <div className="mb-1 text-[11px] font-medium text-grey-60">
                      {label}
                    </div>
                    <div className="whitespace-pre-wrap rounded-large rounded-bl-base bg-white px-3 py-2 text-sm text-grey-80 ring-1 ring-grey-20">
                      {message.body}
                    </div>
                    {config.show_datetime && (
                      <div className="mt-1 text-[10px] text-grey-40">
                        {formatTime(message.sent_at)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {notice && (
              <div className="text-center text-xs text-grey-50">{notice}</div>
            )}

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
                placeholder="Type your message..."
                aria-label="Type your message"
                maxLength={2000}
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
            {config.show_logo && (
              <p className="mt-1.5 text-center text-[10px] text-grey-40">
                Powered by mAutomate
              </p>
            )}
          </div>
        </div>
      )}

      {/* Teaser (the bot's bubble_message) */}
      {showTeaser && (
        <div className="mb-2 flex max-w-[220px] items-start gap-1 rounded-large bg-white px-3 py-2 text-xs leading-snug text-grey-80 shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-left"
          >
            {config.bubble_message}
          </button>
          <button
            type="button"
            onClick={() => setTeaserDismissed(true)}
            aria-label="Dismiss message"
            className="-mr-1 -mt-1 shrink-0 p-1 text-grey-40 hover:text-grey-60"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Floating toggle bubble */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        data-marketing-chat={config.public_key}
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-circle text-white shadow-lg transition-transform motion-safe:hover:scale-105"
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
        ) : config.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.avatar} alt="" className="h-14 w-14 object-cover" />
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
