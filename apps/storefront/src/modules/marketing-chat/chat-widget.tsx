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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

const POLL_INTERVAL_MS = 4000
/**
 * While the bot is composing, poll hard. At the idle 4s cadence an answer that
 * was ready in 900ms could still sit unseen for another 3 — which is what made
 * replies feel like they arrived out of nowhere, long after the dots gave up.
 */
const REPLY_POLL_INTERVAL_MS = 1000
/** Stop the dots eventually. A spinner with no end is a lie, not a loader. */
const REPLY_TIMEOUT_MS = 45000

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

/**
 * A product the assistant looked up while answering. The backend attaches these
 * to the message itself (`media`), so they survive a reload and are rendered as
 * cards rather than described in prose.
 */
type ProductCard = {
  type: "product"
  id: string
  title: string | null
  handle: string | null
  thumbnail: string | null
  /** Major units — 1000 means $1,000. */
  price: number | null
  currency_code: string | null
  in_stock: boolean
}

/** A verified order, as a status card. Only sent after the identity gate passes. */
type OrderCard = {
  type: "order"
  order_number: number | null
  placed_at: string | null
  stage:
    | "canceled"
    | "delivered"
    | "shipped"
    | "packed"
    | "preparing"
    | "awaiting_payment"
  headline: string
  detail: string
  total: number | null
  currency_code: string | null
  tracking: { number: string | null; url: string | null }[]
  items: { title: string | null; quantity: number | null }[]
}

type ChatMessage = {
  id: string
  direction: "inbound" | "outbound"
  author: string
  body: string
  media?: unknown
  sent_at: string
}

const productsOf = (media: unknown): ProductCard[] => {
  if (!Array.isArray(media)) {
    return []
  }
  return media.filter(
    (m): m is ProductCard =>
      !!m && typeof m === "object" && (m as any).type === "product"
  )
}

const ordersOf = (media: unknown): OrderCard[] => {
  if (!Array.isArray(media)) {
    return []
  }
  return media.filter(
    (m): m is OrderCard =>
      !!m && typeof m === "object" && (m as any).type === "order"
  )
}

/** The four steps every parcel walks. `canceled` and `awaiting_payment` sit outside it. */
const ORDER_STEPS: { key: OrderCard["stage"]; label: string }[] = [
  { key: "preparing", label: "Confirmed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
]

const STAGE_TONE: Record<OrderCard["stage"], string> = {
  canceled: "#b42318",
  delivered: "#067647",
  shipped: "#175cd3",
  packed: "#175cd3",
  preparing: "#475467",
  awaiting_payment: "#b54708",
}

const formatPrice = (
  amount: number | null,
  currency: string | null
): string | null => {
  if (amount == null) {
    return null
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount} ${(currency || "").toUpperCase()}`.trim()
  }
}

/**
 * The storefront is country-scoped (/us/products/...). The widget is mounted
 * inside that tree, so the country is simply the first path segment — and if the
 * page is somehow not under one, the link still resolves through the store's
 * default region.
 */
const productHref = (handle: string): string => {
  if (typeof window === "undefined") {
    return `/products/${handle}`
  }
  const first = window.location.pathname.split("/").filter(Boolean)[0]
  const country = first && first.length === 2 ? first : null
  return country ? `/${country}/products/${handle}` : `/products/${handle}`
}

/**
 * Models write markdown even when told not to, and a chat bubble renders it as
 * literal asterisks — "**Sample Product** is **$1,000**". Strip the syntax it
 * actually reaches for, and render the emphasis rather than the punctuation.
 */
const renderText = (body: string): React.ReactNode => {
  const cleaned = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`{1,3}/g, "")
  const parts = cleaned.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  return parts.map((part, i) => {
    const bold =
      (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length > 4)
    if (!bold) {
      return <React.Fragment key={i}>{part}</React.Fragment>
    }
    return (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    )
  })
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
  /**
   * A token minted by the STOREFRONT SERVER proving which customer is signed in.
   * Null when nobody is logged in. The widget only ever carries it; it cannot
   * read it, forge it, or mint one — see the backend's `_identity.ts`.
   */
  identity?: string | null
}

/**
 * One product, as a card: photo, name, price, stock, and a way to buy.
 *
 * It links to the product page rather than adding to the cart directly — most
 * products have variants (size, colour) that have to be chosen, and silently
 * dropping an arbitrary variant into someone's cart is a worse experience than
 * one more click.
 */
/**
 * The placeholder for a product with no picture.
 *
 * It used to be the product's first letter on a big block of the brand colour —
 * a giant "L" that reads as a bug, not as a missing photo. A neutral frame with
 * an image glyph says what is actually true: this product has no image yet.
 */
const NoImage = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-grey-10 text-grey-40">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
      <path
        d="M4 17l4.5-4.5 3 3L15.5 11l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span className="text-[9px] font-medium">No image</span>
  </div>
)

/**
 * One product tile: picture on top, then name, price, and the call to action —
 * the shape every shopper already knows from a product grid.
 *
 * `wide` is the single-result layout (one big tile). Two or more products lay out
 * as a real two-column grid, so "show me what you have" looks like a catalogue
 * instead of a stack of rows.
 */
const ProductBubble = ({
  product,
  accent,
  wide,
}: {
  product: ProductCard
  accent: string
  wide: boolean
}) => {
  const price = formatPrice(product.price, product.currency_code)
  const href = product.handle ? productHref(product.handle) : null

  const card = (
    <div className="flex h-full flex-col overflow-hidden rounded-large bg-white ring-1 ring-grey-20 transition-shadow hover:shadow-md">
      <div
        className={`w-full overflow-hidden bg-grey-10 ${
          wide ? "aspect-[16/9]" : "aspect-square"
        }`}
      >
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.title ?? "Product"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <NoImage />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        {/* Two lines, then ellipsis — a truncated product name at 30 characters
            tells the shopper nothing about which product it is. */}
        <p className="line-clamp-2 text-xs font-medium leading-snug text-grey-90">
          {product.title ?? "Product"}
        </p>

        <div className="mt-auto">
          {price && (
            <p className="text-sm font-semibold text-grey-90">{price}</p>
          )}
          {!product.in_stock && (
            <p className="text-[10px] font-medium text-grey-50">Out of stock</p>
          )}
          {href && (
            <span
              className="mt-1.5 block rounded-base px-2 py-1.5 text-center text-[11px] font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {product.in_stock ? "Buy now" : "View product"}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (!href) {
    return card
  }

  return (
    <a
      href={href}
      className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-grey-90"
      aria-label={`${product.title ?? "Product"}${price ? `, ${price}` : ""}`}
    >
      {card}
    </a>
  )
}

/** The product grid: one wide tile, or a two-column catalogue. */
const ProductGrid = ({
  products,
  accent,
}: {
  products: ProductCard[]
  accent: string
}) => {
  const wide = products.length === 1
  return (
    <div className={wide ? "" : "grid grid-cols-2 gap-2"}>
      {products.map((product) => (
        <ProductBubble
          key={product.id}
          product={product}
          accent={accent}
          wide={wide}
        />
      ))}
    </div>
  )
}

/**
 * An order, as a card: one status, a progress track, what is in it, and the
 * tracking number if the carrier gave us one.
 *
 * Replaces a paragraph that used to recite internal database flags at the
 * customer — "payment has not been received, but fulfillment shows as shipped" —
 * which is not an answer to "where is my order?", it is two contradictions.
 */
const OrderBubble = ({ order }: { order: OrderCard }) => {
  const tone = STAGE_TONE[order.stage] ?? "#475467"
  const total = formatPrice(order.total, order.currency_code)
  const stepIndex = ORDER_STEPS.findIndex((s) => s.key === order.stage)
  const onTrack = stepIndex !== -1
  const placed = order.placed_at
    ? new Date(order.placed_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div className="overflow-hidden rounded-large bg-white ring-1 ring-grey-20">
      <div className="flex items-center justify-between gap-2 border-b border-grey-10 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-grey-90">
            Order #{order.order_number ?? "—"}
          </p>
          {placed && <p className="text-[10px] text-grey-50">Placed {placed}</p>}
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: tone }}
        >
          {order.headline}
        </span>
      </div>

      {onTrack && (
        <div className="flex gap-1 px-3 pt-3">
          {ORDER_STEPS.map((step, i) => (
            <div key={step.key} className="flex-1">
              <div
                className="h-1 rounded-full"
                style={{
                  backgroundColor: i <= stepIndex ? tone : "#e4e4e7",
                }}
              />
              <p
                className="mt-1 truncate text-[9px]"
                style={{
                  color: i <= stepIndex ? tone : "#a1a1aa",
                  fontWeight: i === stepIndex ? 600 : 400,
                }}
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-grey-60">{order.detail}</p>

        {order.items.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {order.items.map((item, i) => (
              <li key={i} className="truncate text-[11px] text-grey-80">
                {item.quantity ?? 1} × {item.title ?? "Item"}
              </li>
            ))}
          </ul>
        )}

        {total && (
          <p className="mt-2 text-xs font-semibold text-grey-90">{total}</p>
        )}

        {order.tracking.length > 0 && (
          <div className="mt-2 space-y-1">
            {order.tracking.map((t, i) =>
              t.url ? (
                <a
                  key={i}
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate rounded-base px-2 py-1.5 text-center text-[11px] font-semibold text-white"
                  style={{ backgroundColor: tone }}
                >
                  Track parcel · {t.number}
                </a>
              ) : (
                <p
                  key={i}
                  className="truncate rounded-base bg-grey-10 px-2 py-1.5 text-center text-[11px] font-medium text-grey-70"
                >
                  Tracking: {t.number}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ChatWidget = ({
  publicKey,
  config: initialConfig = null,
  identity = null,
}: Props) => {
  const [config, setConfig] = useState<ChatbotConfig | null>(initialConfig)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  /**
   * The bot is composing.
   *
   * NOT the same thing as `sending`. The send POST only ingests the message —
   * the backend generates the reply out of band (`void handleInboundAutoReply`,
   * so a slow LLM can never time out a webhook), and returns in ~200ms. Tying
   * the typing dots to `sending` therefore showed them for a fifth of a second,
   * dropped them while the bot was ACTUALLY thinking, and then let the answer
   * appear from nowhere on a later poll. This flag tracks the thing the shopper
   * cares about: a reply is coming. It is only cleared when one lands.
   */
  const [awaitingReply, setAwaitingReply] = useState(false)
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
    // Anything that is not the visitor's own echo IS the reply — the bot's
    // answer, an agent's, or the holding line it writes on handoff. The dots
    // stop the moment it lands, and not a tick before.
    if (incoming.some((message) => !isVisitorMessage(message))) {
      setAwaitingReply(false)
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
        // no-store: without it the browser revalidates and the server answers
        // 304, which `res.ok` treats as a failure — so replies were silently
        // discarded and the chat looked dead while the AI had already answered.
        { mode: "cors", cache: "no-store" }
      )
      if (res.status === 304) {
        return // nothing new — not an error
      }
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
        // A signed-in shopper is bound to their account from the first message,
        // so the bot knows who they are and never interrogates them.
        body: JSON.stringify({
          public_key: publicKey,
          ...(identity ? { identity } : {}),
        }),
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

  // A thread started BEFORE the shopper logged in keeps living in localStorage,
  // so it would stay anonymous forever and keep asking them to prove who they
  // are. Bind it once, as soon as we hold both a session and a signed identity.
  const identifiedRef = useRef(false)
  useEffect(() => {
    if (!identity || !open || identifiedRef.current) {
      return
    }
    let cancelled = false
    const bind = async () => {
      const token = await ensureSession()
      if (!token || cancelled || identifiedRef.current) {
        return
      }
      identifiedRef.current = true
      try {
        await fetch(`${BACKEND_URL}/marketing-chat/identify`, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_token: token, identity }),
        })
      } catch {
        // Not fatal: the bot simply stays anonymous on this thread.
      }
    }
    void bind()
    return () => {
      cancelled = true
    }
  }, [identity, open, ensureSession])

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
      pollTimerRef.current = setInterval(
        poll,
        awaitingReply ? REPLY_POLL_INTERVAL_MS : POLL_INTERVAL_MS
      )
    }

    start()

    return () => {
      cancelled = true
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [open, config, ensureSession, poll, awaitingReply])

  // The dots cannot spin forever: if nothing has come back after 45s, say so
  // plainly and let the shopper get on with their day. The message is safe —
  // it is in the merchant's inbox either way.
  useEffect(() => {
    if (!awaitingReply) {
      return
    }
    const timer = window.setTimeout(() => {
      setAwaitingReply(false)
      setNotice(
        "This is taking longer than usual. Your message was received — we will reply right here."
      )
    }, REPLY_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [awaitingReply])

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

  // Keep the newest message in view — and the typing bubble too, so the dots
  // never appear below the fold while the shopper stares at a still panel.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({
      block: "end",
      behavior: open ? "smooth" : "auto",
    })
  }, [messages, open, awaitingReply])

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
        setAwaitingReply(false)
        return
      }
      if (!res.ok) {
        throw new Error("send failed")
      }
      setNotice(null)
      // The message is in. The reply is now being written somewhere else, so
      // hand the dots over to `awaitingReply` — they must NOT go out when
      // `sending` does, which is the whole bug.
      setAwaitingReply(true)
      await poll()
    } catch {
      setNotice("Message could not be sent. Please try again.")
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setAwaitingReply(false)
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
  // The typing indicator only shows after the visitor's own message (not while
  // an initial history load is settling), so a reply always feels like a direct
  // response to what they just sent.
  const lastMessage = messages[messages.length - 1]
  const lastMessageIsVisitor = lastMessage
    ? isVisitorMessage(lastMessage)
    : false
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
                // The reply eases in. It used to be swapped into the DOM by a
                // poll tick with no transition at all, which is what made it
                // read as "a text suddenly appears" rather than as an answer.
                <div
                  key={message.id}
                  className="motion-safe:animate-enter flex justify-start gap-2"
                >
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-circle text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  >
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div className="max-w-[80%] min-w-0">
                    <div className="mb-1 text-[11px] font-medium text-grey-60">
                      {label}
                    </div>
                    {message.body?.trim() && (
                      <div className="whitespace-pre-wrap rounded-large rounded-bl-base bg-white px-3 py-2 text-sm text-grey-80 ring-1 ring-grey-20">
                        {renderText(message.body)}
                      </div>
                    )}

                    {/* The products the assistant found, as products — a photo, a
                        price, a way to buy. Prose describing a product is not a
                        product. */}
                    {productsOf(message.media).length > 0 && (
                      <div className="mt-2">
                        <ProductGrid
                          products={productsOf(message.media)}
                          accent={accent}
                        />
                      </div>
                    )}

                    {ordersOf(message.media).map((order, i) => (
                      <div key={i} className="mt-2">
                        <OrderBubble order={order} />
                      </div>
                    ))}

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

            {/*
              Typing indicator. While a reply is in flight (`sending`) and the
              last message is the visitor's own, show an animated three-dot
              bubble on the assistant side so the shopper sees the bot is
              composing instead of the panel appearing frozen. Mirrors the bot
              message layout (avatar + bubble). motion-safe so it respects
              prefers-reduced-motion.
            */}
            {(sending || awaitingReply) && lastMessageIsVisitor && (
              <div className="flex justify-start gap-2" aria-live="polite">
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-circle text-xs font-semibold text-white"
                  style={{ backgroundColor: accent }}
                  aria-hidden="true"
                >
                  {(config.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="max-w-[80%]">
                  <div className="mb-1 text-[11px] font-medium text-grey-60">
                    {config.name}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-large rounded-bl-base bg-white px-3 py-3 ring-1 ring-grey-20">
                    <span className="sr-only">Typing</span>
                    <span
                      className="h-1.5 w-1.5 rounded-circle bg-grey-40 motion-safe:animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-circle bg-grey-40 motion-safe:animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-circle bg-grey-40 motion-safe:animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
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
                className="h-10 min-w-0 flex-1 rounded-full border border-grey-20 bg-grey-5 px-4 text-sm text-grey-80 outline-none focus:border-grey-40"
                style={{ borderRadius: 9999, height: 40, boxSizing: "border-box" }}
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
