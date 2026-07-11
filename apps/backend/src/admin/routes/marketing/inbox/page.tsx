import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ArrowRight,
  ChatBubbleLeftRight,
  CheckCircleSolid,
  Clock,
  MagnifyingGlass,
  ShoppingBag,
  Sparkles,
  Star,
  StarSolid,
  User,
  XCircle,
} from "@medusajs/icons"
import {
  Avatar,
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Select,
  Tabs,
  Text,
  Textarea,
  clx,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { BrandBadge, BrandGlyph } from "../_components/brand-icons"
import { EmptyState } from "../_components/ui-kit"

// ---------------------------------------------------------------------------
// Types (kept inline — this screen must stay self-contained)
// ---------------------------------------------------------------------------

type Contact = {
  id: string
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  customer_id: string | null
  tags?: string[] | null
}

type ConversationDto = {
  id: string
  channel: string
  status: string
  starred: boolean
  unread_count: number
  last_message_at: string | null
  assigned_user_id: string | null
  contact: Contact | null
  preview: string | null
}

type MessageDto = {
  id: string
  direction: "inbound" | "outbound"
  author: "contact" | "agent" | "ai" | "system"
  body: string | null
  media: string[] | null
  sent_at: string | null
  delivery_status: string | null
}

type RecentOrder = {
  id: string
  display_id: number
  total: number
  currency_code: string
  status: string
  created_at: string
}

type Customer360 = {
  matched: boolean
  customer: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    has_account: boolean
  } | null
  order_count: number
  total_spent: number
  currency_code: string
  recent_orders: RecentOrder[]
}

type ListResponse = {
  conversations: ConversationDto[]
  count: number
}

type DetailResponse = {
  conversation: ConversationDto
  messages: MessageDto[]
  customer360: Customer360
}

// ---------------------------------------------------------------------------
// Fetch helper — credentials included so the admin session cookie rides along
// ---------------------------------------------------------------------------

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.message || body?.error || ""
    } catch (_e) {
      // response had no JSON body — fall through with the status text
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Small presentation helpers
// ---------------------------------------------------------------------------

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  messenger: "#0084FF",
  facebook: "#1877F2",
  sms: "#8B5CF6",
  email: "#F59E0B",
  web: "#0EA5E9",
  telegram: "#229ED9",
}

const channelColor = (channel: string): string =>
  CHANNEL_COLORS[channel?.toLowerCase()] || "#6B7280"

const channelLabel = (channel: string): string =>
  channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : "Channel"

const contactName = (c: Contact | null): string => {
  if (!c) {
    return "Web visitor"
  }
  return c.display_name || c.phone || c.email || "Web visitor"
}

const initialOf = (name: string): string =>
  (name.trim().charAt(0) || "?").toUpperCase()

const relativeTime = (iso: string | null): string => {
  if (!iso) {
    return ""
  }
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) {
    return ""
  }
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) {
    return "now"
  }
  if (min < 60) {
    return `${min}m`
  }
  const hr = Math.round(min / 60)
  if (hr < 24) {
    return `${hr}h`
  }
  const day = Math.round(hr / 24)
  if (day < 7) {
    return `${day}d`
  }
  return new Date(iso).toLocaleDateString()
}

const clockTime = (iso: string | null): string => {
  if (!iso) {
    return ""
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ""
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const money = (amount: number, currency: string): string => {
  const code = (currency || "").toUpperCase()
  const value = (amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return code ? `${code} ${value}` : value
}

const deliveryHint = (status: string | null): string => {
  switch (status) {
    case "sent":
    case "delivered":
      return "sent"
    case "failed":
      return "failed"
    case "stored":
      return "stored"
    case "no_channel":
      return "no channel"
    default:
      return status || ""
  }
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "snoozed", label: "Snoozed" },
  { value: "closed", label: "Closed" },
]

const CHANNEL_OPTIONS = [
  "whatsapp",
  "instagram",
  "messenger",
  "facebook",
  "sms",
  "email",
  "web",
  "telegram",
]

// ---------------------------------------------------------------------------
// Channel chip
// ---------------------------------------------------------------------------

const ChannelChip = ({ channel }: { channel: string }) => (
  <BrandBadge platform={channel} label size={14} />
)

// ---------------------------------------------------------------------------
// Left pane — conversation list
// ---------------------------------------------------------------------------

const ConversationRow = ({
  conversation,
  selected,
  onSelect,
  onToggleStar,
}: {
  conversation: ConversationDto
  selected: boolean
  onSelect: () => void
  onToggleStar: () => void
}) => {
  const name = contactName(conversation.contact)
  const avatarUrl = conversation.contact?.avatar_url || undefined
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clx(
        "flex w-full items-start gap-x-3 border-b border-ui-border-base px-4 py-3 text-left transition-colors",
        "hover:bg-ui-bg-base-hover",
        selected && "bg-ui-bg-highlight hover:bg-ui-bg-highlight"
      )}
    >
      <div className="relative shrink-0">
        {avatarUrl ? (
          <Avatar src={avatarUrl} fallback={initialOf(name)} />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: channelColor(conversation.channel) }}
          >
            {initialOf(name)}
          </div>
        )}
        <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-ui-bg-base p-0.5 shadow-borders-base">
          <BrandGlyph platform={conversation.channel} size={12} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-x-2">
          <Text
            size="small"
            weight="plus"
            className="truncate text-ui-fg-base"
          >
            {name}
          </Text>
          <Text size="xsmall" className="shrink-0 text-ui-fg-muted">
            {relativeTime(conversation.last_message_at)}
          </Text>
        </div>
        <div className="mt-1 flex items-center gap-x-2">
          <ChannelChip channel={conversation.channel} />
          {conversation.unread_count > 0 && (
            <Badge size="2xsmall" color="red" rounded="full">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
        <Text
          size="xsmall"
          className="mt-1 line-clamp-1 truncate text-ui-fg-subtle"
        >
          {conversation.preview || "No messages yet"}
        </Text>
      </div>
      <IconButton
        size="small"
        variant="transparent"
        onClick={(e) => {
          e.stopPropagation()
          onToggleStar()
        }}
        aria-label={conversation.starred ? "Unstar" : "Star"}
      >
        {conversation.starred ? (
          <StarSolid className="text-ui-tag-orange-icon" />
        ) : (
          <Star className="text-ui-fg-muted" />
        )}
      </IconButton>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Center pane — message bubble
// ---------------------------------------------------------------------------

const MessageBubble = ({ message }: { message: MessageDto }) => {
  const outbound = message.direction === "outbound"
  const isAi = message.author === "ai"
  const isSystem = message.author === "system"

  if (isSystem) {
    return (
      <div className="my-2 flex justify-center">
        <Text size="xsmall" className="text-ui-fg-muted">
          {message.body}
        </Text>
      </div>
    )
  }

  return (
    <div
      className={clx(
        "flex w-full flex-col",
        outbound ? "items-end" : "items-start"
      )}
    >
      <div
        className={clx(
          "max-w-[78%] rounded-lg px-3 py-2",
          outbound
            ? isAi
              ? "bg-ui-tag-purple-bg text-ui-tag-purple-text"
              : "bg-ui-bg-interactive text-ui-fg-on-color"
            : "bg-ui-bg-component text-ui-fg-base"
        )}
      >
        {isAi && (
          <div className="mb-1 flex items-center gap-x-1">
            <Sparkles className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              AI
            </span>
          </div>
        )}
        {message.body && (
          <Text size="small" className="whitespace-pre-wrap break-words">
            {message.body}
          </Text>
        )}
        {message.media && message.media.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.media.map((url, i) => (
              <a
                key={`${message.id}-media-${i}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={url}
                  alt="attachment"
                  className="h-20 w-20 rounded-md object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display =
                      "none"
                  }}
                />
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-x-1 px-1">
        <Text size="xsmall" className="text-ui-fg-muted">
          {clockTime(message.sent_at)}
        </Text>
        {outbound && message.delivery_status && (
          <>
            <span className="text-ui-fg-muted">·</span>
            <span
              className={clx(
                "flex items-center gap-x-0.5 text-[11px]",
                message.delivery_status === "failed"
                  ? "text-ui-fg-error"
                  : "text-ui-fg-muted"
              )}
            >
              {message.delivery_status === "failed" ? (
                <XCircle className="h-3 w-3" />
              ) : (
                <CheckCircleSolid className="h-3 w-3" />
              )}
              {deliveryHint(message.delivery_status)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right pane — customer 360
// ---------------------------------------------------------------------------

const CustomerPanel = ({
  customer360,
  contact,
}: {
  customer360: Customer360 | null
  contact: Contact | null
}) => {
  if (!customer360) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Text size="small" className="text-ui-fg-muted">
          Select a conversation
        </Text>
      </div>
    )
  }

  const tags = contact?.tags || []

  if (!customer360.matched || !customer360.customer) {
    return (
      <div className="flex h-full flex-col gap-y-4 p-4">
        <div className="flex flex-col items-center gap-y-2 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ui-bg-component">
            <User className="text-ui-fg-muted" />
          </div>
          <Text size="small" weight="plus">
            No matching customer
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            This contact is not linked to a store customer yet.
          </Text>
        </div>
        <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3">
          <Text size="xsmall" className="text-ui-fg-muted">
            Contact details
          </Text>
          <Text size="small">{contact?.phone || "No phone"}</Text>
          <Text size="small">{contact?.email || "No email"}</Text>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge key={t} size="2xsmall" rounded="full">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }

  const { customer, order_count, total_spent, currency_code, recent_orders } =
    customer360

  return (
    <div className="flex h-full flex-col gap-y-4 overflow-y-auto p-4">
      <div className="flex flex-col items-center gap-y-1 text-center">
        <Avatar
          fallback={initialOf(customer.name || customer.email || "?")}
          size="large"
        />
        <Text size="base" weight="plus" className="mt-1">
          {customer.name || "Unnamed customer"}
        </Text>
        {customer.email && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {customer.email}
          </Text>
        )}
        {customer.phone && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {customer.phone}
          </Text>
        )}
        <Badge
          size="2xsmall"
          color={customer.has_account ? "green" : "grey"}
          rounded="full"
          className="mt-1"
        >
          {customer.has_account ? "Registered" : "Guest"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-ui-border-base p-3">
          <Text size="xsmall" className="text-ui-fg-muted">
            Orders
          </Text>
          <Text size="large" weight="plus">
            {order_count}
          </Text>
        </div>
        <div className="rounded-lg border border-ui-border-base p-3">
          <Text size="xsmall" className="text-ui-fg-muted">
            Spent
          </Text>
          <Text size="large" weight="plus">
            {money(total_spent, currency_code)}
          </Text>
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-1.5">
          <ShoppingBag className="text-ui-fg-muted" />
          <Text size="small" weight="plus">
            Recent orders
          </Text>
        </div>
        {recent_orders.length === 0 ? (
          <Text size="xsmall" className="text-ui-fg-muted">
            No orders yet
          </Text>
        ) : (
          recent_orders.map((o) => (
            <Link
              key={o.id}
              to={`/app/orders/${o.id}`}
              className="flex items-center justify-between rounded-lg border border-ui-border-base px-3 py-2 transition-colors hover:bg-ui-bg-base-hover"
            >
              <div className="flex flex-col">
                <Text size="small" weight="plus">
                  #{o.display_id}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {clockTime(o.created_at)}
                </Text>
              </div>
              <div className="flex flex-col items-end">
                <Text size="small">{money(o.total, o.currency_code)}</Text>
                <Badge size="2xsmall" rounded="full">
                  {o.status}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t} size="2xsmall" rounded="full">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const InboxPage = () => {
  const [conversations, setConversations] = useState<ConversationDto[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [status, setStatus] = useState("all")
  const [channel, setChannel] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [showCustomer, setShowCustomer] = useState(true)

  const selectedIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  // Debounce the search box → drives the `q` param.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ---- list fetching -------------------------------------------------------
  const buildListUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (status !== "all") {
      params.set("status", status)
    }
    if (channel !== "all") {
      params.set("channel", channel)
    }
    if (debouncedSearch.trim()) {
      params.set("q", debouncedSearch.trim())
    }
    const qs = params.toString()
    return `/admin/marketing/conversations${qs ? `?${qs}` : ""}`
  }, [status, channel, debouncedSearch])

  const loadList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setListLoading(true)
      }
      try {
        const data = await api<ListResponse>(buildListUrl())
        setConversations(data.conversations)
        setListError(null)
        // Auto-select the first conversation when nothing is selected.
        if (!selectedIdRef.current && data.conversations.length > 0) {
          setSelectedId(data.conversations[0].id)
        }
      } catch (e: any) {
        if (!opts?.silent) {
          setListError(e?.message || "Failed to load conversations")
        }
      } finally {
        if (!opts?.silent) {
          setListLoading(false)
        }
      }
    },
    [buildListUrl]
  )

  // Re-fetch on filter changes.
  useEffect(() => {
    loadList()
  }, [loadList])

  // Poll the list every ~10s.
  useEffect(() => {
    const id = setInterval(() => {
      loadList({ silent: true })
    }, 10000)
    return () => clearInterval(id)
  }, [loadList])

  // ---- detail fetching -----------------------------------------------------
  const loadDetail = useCallback(
    async (id: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setDetailLoading(true)
      }
      try {
        const data = await api<DetailResponse>(
          `/admin/marketing/conversations/${id}`
        )
        // Guard against a race: the user may have switched conversations
        // while this request was in flight.
        if (selectedIdRef.current !== id) {
          return
        }
        setDetail(data)
        setDetailError(null)
      } catch (e: any) {
        if (!opts?.silent && selectedIdRef.current === id) {
          setDetailError(e?.message || "Failed to load conversation")
        }
      } finally {
        if (!opts?.silent) {
          setDetailLoading(false)
        }
      }
    },
    []
  )

  // Load detail when the selection changes.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetail(null)
    setDraft("")
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  // Poll the open conversation's messages every ~5s.
  useEffect(() => {
    if (!selectedId) {
      return
    }
    const id = setInterval(() => {
      loadDetail(selectedId, { silent: true })
    }, 5000)
    return () => clearInterval(id)
  }, [selectedId, loadDetail])

  // Auto-scroll to the newest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" })
  }, [detail?.messages.length, selectedId])

  // ---- conversation mutations ---------------------------------------------
  const patchConversation = useCallback(
    async (
      id: string,
      body: Partial<
        Pick<ConversationDto, "status" | "starred" | "assigned_user_id">
      >
    ) => {
      // Optimistic update in the list.
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...body } : c))
      )
      setDetail((prev) =>
        prev && prev.conversation.id === id
          ? { ...prev, conversation: { ...prev.conversation, ...body } }
          : prev
      )
      try {
        const updated = await api<ConversationDto>(
          `/admin/marketing/conversations/${id}`,
          { method: "POST", body: JSON.stringify(body) }
        )
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
        )
        setDetail((prev) =>
          prev && prev.conversation.id === id
            ? { ...prev, conversation: { ...prev.conversation, ...updated } }
            : prev
        )
      } catch (e: any) {
        toast.error(e?.message || "Could not update conversation")
        loadList({ silent: true })
      }
    },
    [loadList]
  )

  const toggleStar = useCallback(
    (c: ConversationDto) => {
      patchConversation(c.id, { starred: !c.starred })
    },
    [patchConversation]
  )

  const setConversationStatus = useCallback(
    (newStatus: string) => {
      if (!selectedId) {
        return
      }
      patchConversation(selectedId, { status: newStatus })
    },
    [patchConversation, selectedId]
  )

  // ---- AI suggest ----------------------------------------------------------
  const handleSuggest = useCallback(async () => {
    if (!selectedId) {
      return
    }
    setSuggesting(true)
    try {
      const data = await api<{ suggestion: string; needs_ai: boolean }>(
        `/admin/marketing/conversations/${selectedId}/suggest`,
        { method: "POST", body: JSON.stringify({}) }
      )
      if (data.needs_ai) {
        toast.info("Connect an AI provider to generate suggestions")
      }
      if (data.suggestion) {
        setDraft(data.suggestion)
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not generate a suggestion")
    } finally {
      setSuggesting(false)
    }
  }, [selectedId])

  // ---- send ----------------------------------------------------------------
  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!selectedId || !text || sending) {
      return
    }
    setSending(true)

    const optimistic: MessageDto = {
      id: `temp-${Date.now()}`,
      direction: "outbound",
      author: "agent",
      body: text,
      media: null,
      sent_at: new Date().toISOString(),
      delivery_status: "pending",
    }
    setDetail((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev
    )
    setDraft("")

    try {
      await api<{ message: MessageDto; delivered: boolean }>(
        `/admin/marketing/conversations/${selectedId}/reply`,
        { method: "POST", body: JSON.stringify({ text }) }
      )
      await loadDetail(selectedId, { silent: true })
      loadList({ silent: true })
    } catch (e: any) {
      toast.error(e?.message || "Message could not be sent")
      // Roll the optimistic message back.
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((m) => m.id !== optimistic.id),
            }
          : prev
      )
      setDraft(text)
    } finally {
      setSending(false)
    }
  }, [draft, selectedId, sending, loadDetail, loadList])

  const onComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ---- derived -------------------------------------------------------------
  const selectedConversation =
    detail?.conversation ||
    conversations.find((c) => c.id === selectedId) ||
    null

  // -------------------------------------------------------------------------
  return (
    <Container className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <div className="flex items-center gap-x-2">
          <ChatBubbleLeftRight className="text-ui-fg-subtle" />
          <Heading level="h2">Inbox</Heading>
        </div>
        <IconButton
          size="small"
          variant="transparent"
          onClick={() => setShowCustomer((s) => !s)}
          aria-label="Toggle customer panel"
        >
          <User />
        </IconButton>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[520px] w-full">
        {/* LEFT — conversation list */}
        <div className="flex w-[320px] shrink-0 flex-col border-r border-ui-border-base">
          <div className="flex flex-col gap-y-2 border-b border-ui-border-base p-3">
            <Tabs value={status} onValueChange={setStatus}>
              <Tabs.List className="w-full">
                {STATUS_TABS.map((t) => (
                  <Tabs.Trigger
                    key={t.value}
                    value={t.value}
                    className="flex-1"
                  >
                    {t.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
            <Select value={channel} onValueChange={setChannel}>
              <Select.Trigger>
                <Select.Value placeholder="All channels" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All channels</Select.Item>
                {CHANNEL_OPTIONS.map((c) => (
                  <Select.Item key={c} value={c}>
                    {channelLabel(c)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <div className="relative">
              <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ui-fg-muted">
                <MagnifyingGlass />
              </div>
              <Input
                className="pl-8"
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex h-full items-center justify-center">
                <ArrowPath className="animate-spin text-ui-fg-muted" />
              </div>
            ) : listError ? (
              <div className="flex h-full flex-col items-center justify-center gap-y-2 p-6 text-center">
                <Text size="small" className="text-ui-fg-error">
                  {listError}
                </Text>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => loadList()}
                >
                  <ArrowPath />
                  Retry
                </Button>
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={ChatBubbleLeftRight}
                accent="blue"
                title="Your inbox is empty"
                description="Connect a channel to start receiving messages"
              />
            ) : (
              conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  selected={c.id === selectedId}
                  onSelect={() => setSelectedId(c.id)}
                  onToggleStar={() => toggleStar(c)}
                />
              ))
            )}
          </div>
        </div>

        {/* CENTER — thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedId ? (
            <EmptyState
              icon={ChatBubbleLeftRight}
              accent="blue"
              title="No conversation selected"
              description="Select a conversation from the list to get started"
            />
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between border-b border-ui-border-base px-4 py-3">
                <div className="flex min-w-0 items-center gap-x-3">
                  <div className="relative shrink-0">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{
                        backgroundColor: channelColor(
                          selectedConversation?.channel || ""
                        ),
                      }}
                    >
                      {initialOf(
                        contactName(selectedConversation?.contact || null)
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-ui-bg-base p-0.5 shadow-borders-base">
                      <BrandGlyph
                        platform={selectedConversation?.channel || ""}
                        size={12}
                      />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <Text size="small" weight="plus" className="truncate">
                      {contactName(selectedConversation?.contact || null)}
                    </Text>
                    {selectedConversation && (
                      <div className="mt-0.5">
                        <ChannelChip channel={selectedConversation.channel} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-x-1">
                  <Button
                    size="small"
                    variant={
                      selectedConversation?.status === "open"
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => setConversationStatus("open")}
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    variant={
                      selectedConversation?.status === "snoozed"
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => setConversationStatus("snoozed")}
                  >
                    <Clock />
                    Snooze
                  </Button>
                  <Button
                    size="small"
                    variant={
                      selectedConversation?.status === "closed"
                        ? "primary"
                        : "secondary"
                    }
                    onClick={() => setConversationStatus("closed")}
                  >
                    Close
                  </Button>
                  {selectedConversation && (
                    <IconButton
                      size="small"
                      variant="transparent"
                      onClick={() => toggleStar(selectedConversation)}
                      aria-label={
                        selectedConversation.starred ? "Unstar" : "Star"
                      }
                    >
                      {selectedConversation.starred ? (
                        <StarSolid className="text-ui-tag-orange-icon" />
                      ) : (
                        <Star className="text-ui-fg-muted" />
                      )}
                    </IconButton>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {detailLoading && !detail ? (
                  <div className="flex h-full items-center justify-center">
                    <ArrowPath className="animate-spin text-ui-fg-muted" />
                  </div>
                ) : detailError && !detail ? (
                  <div className="flex h-full flex-col items-center justify-center gap-y-2 text-center">
                    <Text size="small" className="text-ui-fg-error">
                      {detailError}
                    </Text>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => selectedId && loadDetail(selectedId)}
                    >
                      <ArrowPath />
                      Retry
                    </Button>
                  </div>
                ) : detail && detail.messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <Text size="small" className="text-ui-fg-muted">
                      No messages yet — say hello
                    </Text>
                  </div>
                ) : (
                  <div className="flex flex-col gap-y-3">
                    {detail?.messages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-ui-border-base p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                  rows={3}
                />
                <div className="mt-2 flex items-center justify-between">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={handleSuggest}
                    isLoading={suggesting}
                    disabled={suggesting || sending}
                  >
                    <Sparkles />
                    Suggest with AI
                  </Button>
                  <Button
                    size="small"
                    variant="primary"
                    onClick={handleSend}
                    isLoading={sending}
                    disabled={sending || !draft.trim()}
                  >
                    Send
                    <ArrowRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — customer 360 */}
        {showCustomer && selectedId && (
          <div className="flex w-[300px] shrink-0 flex-col border-l border-ui-border-base">
            <CustomerPanel
              customer360={detail?.customer360 || null}
              contact={selectedConversation?.contact || null}
            />
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Inbox",
  icon: ChatBubbleLeftRight,
})

export default InboxPage
