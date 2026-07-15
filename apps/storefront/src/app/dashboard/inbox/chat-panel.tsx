"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowPath,
  ChatBubbleLeftRight,
  CheckCircle,
  Clock,
  ExclamationCircle,
  PaperPlane,
  Phone,
  Robot,
  SidebarRight,
  Sparkles,
  Star,
  StarSolid,
  User,
  XCircle,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type {
  CannedResponse,
  InboxConversation,
  InboxMessage,
  InboxStatus,
} from "@lib/merchant-admin/api"
import {
  ChannelIcon,
  channelMeta,
  contactName,
  dayKey,
  dayLabel,
  formatAmount,
  handlerMeta,
  handoffCopy,
  initial,
  isInternalMessage,
  messageTime,
} from "./inbox-utils"

const STATUS_ACTIONS: {
  id: InboxStatus
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "open", label: "Open", icon: ChatBubbleLeftRight },
  { id: "snoozed", label: "Snooze", icon: Clock },
  { id: "closed", label: "Close", icon: CheckCircle },
]

/** A product the assistant recommended, attached to the message as `media`. */
type ProductCardMedia = {
  type: "product"
  id: string
  title: string | null
  handle: string | null
  thumbnail: string | null
  price: number | null
  currency_code: string | null
  in_stock: boolean
}

function productsOf(media: unknown): ProductCardMedia[] {
  if (!Array.isArray(media)) return []
  return media.filter(
    (m): m is ProductCardMedia =>
      !!m && typeof m === "object" && (m as any).type === "product"
  )
}

function ProductChip({ product }: { product: ProductCardMedia }) {
  const price =
    product.price != null
      ? formatAmount(product.price, product.currency_code)
      : null

  return (
    <div className="flex items-center gap-2 rounded-base border border-grey-20 bg-white p-1.5">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-base bg-grey-10">
        {product.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-grey-90">
          {product.title ?? "Product"}
        </p>
        <p className="text-[11px] text-grey-50">
          {price ?? "—"}
          {!product.in_stock && " · out of stock"}
        </p>
      </div>
    </div>
  )
}

function authorLabel(message: InboxMessage, name: string): string {
  if (message.author === "ai") return "AI assistant"
  if (message.author === "agent") return "You and your team"
  if (message.author === "system") return "System"
  return name
}

function MessageBubble({
  message,
  name,
}: {
  message: InboxMessage
  name: string
}) {
  if (isInternalMessage(message)) {
    return (
      <div className="my-4 flex justify-center">
        <div className="max-w-md rounded-full border border-grey-20 bg-grey-10 px-3 py-1 text-center text-xs text-grey-60">
          {message.body}
          <span className="ml-2 text-grey-40">{messageTime(message.sent_at)}</span>
        </div>
      </div>
    )
  }

  const isContact = message.author === "contact"
  const isAi = message.author === "ai"
  const failed = message.delivery_status === "failed"
  const notDelivered = message.delivery_status === "no_channel_credential"

  return (
    <div
      className={cn(
        "mb-4 flex max-w-[85%] gap-2.5 sm:max-w-[70%]",
        isContact ? "mr-auto" : "ml-auto flex-row-reverse"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isContact && "bg-grey-10 text-grey-60",
          isAi && "bg-sky-100 text-sky-700",
          !isContact && !isAi && "bg-grey-90 text-white"
        )}
      >
        {isAi ? <Robot className="h-3.5 w-3.5" /> : initial(isContact ? name : "A")}
      </span>

      <div className="min-w-0">
        <div
          className={cn(
            "flex items-center gap-2",
            !isContact && "flex-row-reverse"
          )}
        >
          <span className="text-xs font-medium text-grey-60">
            {authorLabel(message, name)}
          </span>
          <span className="text-[11px] text-grey-40">
            {messageTime(message.sent_at)}
          </span>
        </div>
        {!!message.body && (
          <div
            className={cn(
              "mt-1 whitespace-pre-wrap break-words rounded-large px-3.5 py-2 text-sm leading-relaxed",
              isContact && "rounded-tl-sm border border-grey-20 bg-white text-grey-90",
              isAi && "rounded-tr-sm bg-sky-50 text-sky-900",
              !isContact && !isAi && "rounded-tr-sm bg-grey-90 text-white"
            )}
          >
            {message.body}
          </div>
        )}

        {/* The shopper sees these as rich cards in the widget. The merchant has to
            see the same thing — otherwise the AI's "Here's what I found:" reads
            as a message that recommended nothing at all. */}
        {productsOf(message.media).length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {productsOf(message.media).map((product) => (
              <ProductChip key={product.id} product={product} />
            ))}
          </div>
        )}
        {(failed || notDelivered) && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px]",
              !isContact && "justify-end",
              failed ? "text-rose-600" : "text-amber-700"
            )}
          >
            <ExclamationCircle className="h-3 w-3" />
            {failed
              ? "Delivery failed"
              : "Saved to the thread, but no connected account could deliver it"}
          </p>
        )}
      </div>
    </div>
  )
}

export function ChatPanel({
  conversation,
  messages,
  loading,
  error,
  notice,
  currentUserId,
  cannedResponses,
  contextCollapsed,
  composerRef,
  onSelectNone,
  onRetry,
  onSend,
  onSuggest,
  onTakeOver,
  onReturnToAi,
  onStatus,
  onToggleStar,
  onShowContext,
}: {
  conversation: InboxConversation | null
  messages: InboxMessage[]
  loading: boolean
  error: string | null
  notice: { tone: "info" | "error"; text: string } | null
  currentUserId: string | null
  cannedResponses: CannedResponse[]
  contextCollapsed: boolean
  composerRef?: React.RefObject<HTMLTextAreaElement | null>
  onSelectNone: () => void
  onRetry: () => void
  onSend: (text: string) => Promise<boolean>
  onSuggest: () => Promise<string | null>
  onTakeOver: () => Promise<void>
  onReturnToAi: () => Promise<void>
  onStatus: (status: InboxStatus) => Promise<void>
  onToggleStar: () => Promise<void>
  onShowContext: () => void
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [draftIsSuggestion, setDraftIsSuggestion] = useState(false)
  const [acting, setActing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const localInputRef = useRef<HTMLTextAreaElement>(null)
  // The page owns the keyboard shortcuts, so it needs a handle on the composer
  // to focus it. Same node either way.
  const inputRef = composerRef ?? localInputRef

  const conversationId = conversation?.id ?? null

  useEffect(() => {
    setText("")
    setDraftIsSuggestion(false)
  }, [conversationId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conversationId, messages.length])

  // "/" at the start of the composer opens the saved-reply picker.
  const cannedQuery = text.startsWith("/") ? text.slice(1).toLowerCase() : null
  const cannedMatches = useMemo(() => {
    if (cannedQuery === null) return []
    return cannedResponses
      .filter(
        (c) =>
          !cannedQuery ||
          c.shortcut.toLowerCase().includes(cannedQuery) ||
          c.title.toLowerCase().includes(cannedQuery)
      )
      .slice(0, 6)
  }, [cannedQuery, cannedResponses])

  if (!conversation) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-grey-5 p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-grey-50 shadow-borders-base">
            <ChatBubbleLeftRight className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-grey-90">
            Select a conversation
          </h3>
          <p className="mt-1 text-sm text-grey-50">
            Pick a thread on the left to read the full history, take it over from
            the AI assistant, and reply.
          </p>
        </div>
      </div>
    )
  }

  const name = contactName(conversation.contact)
  const channel = channelMeta(conversation.channel)
  const handler = handlerMeta(conversation.handler_mode)
  const HandlerIcon = handler.icon
  const handoff = handoffCopy(conversation.handoff_reason)
  const isVoice = conversation.channel === "voice"
  const mine =
    conversation.handler_mode === "human" &&
    !!currentUserId &&
    conversation.assigned_user_id === currentUserId
  const canReply = !isVoice && mine && conversation.status !== "closed"
  const canTakeOver =
    !isVoice &&
    (conversation.handler_mode === "ai" || conversation.handler_mode === "queued")

  const run = async (fn: () => Promise<void>) => {
    setActing(true)
    try {
      await fn()
    } finally {
      setActing(false)
    }
  }

  const handleSend = async () => {
    const body = text.trim()
    if (!body || !canReply || sending) return
    setSending(true)
    const ok = await onSend(body)
    setSending(false)
    if (ok) {
      setText("")
      setDraftIsSuggestion(false)
      inputRef.current?.focus()
    }
  }

  const handleSuggest = async () => {
    if (suggesting) return
    setSuggesting(true)
    const suggestion = await onSuggest()
    setSuggesting(false)
    if (suggestion) {
      setText(suggestion)
      setDraftIsSuggestion(true)
      inputRef.current?.focus()
    }
  }

  const groups: { key: string; label: string; items: InboxMessage[] }[] = []
  for (const message of messages) {
    const key = dayKey(message.sent_at)
    const last = groups[groups.length - 1]
    if (!last || last.key !== key) {
      groups.push({ key, label: dayLabel(message.sent_at), items: [message] })
    } else {
      last.items.push(message)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-grey-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-20 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onSelectNone}
            className="rounded-base p-1 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90 lg:hidden"
            aria-label="Back to conversations"
          >
            <XCircle className="h-5 w-5" />
          </button>
          <span className="relative shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-grey-90 text-sm font-semibold text-white">
              {initial(name)}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 shadow-borders-base">
              <ChannelIcon
                channel={conversation.channel}
                className={cn("h-3 w-3", channel.color)}
              />
            </span>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-grey-90">{name}</p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  conversation.status === "open" && "bg-emerald-50 text-emerald-800",
                  conversation.status === "snoozed" && "bg-amber-50 text-amber-800",
                  conversation.status === "closed" && "bg-grey-10 text-grey-70"
                )}
              >
                {conversation.status}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-grey-50">
              <span>{channel.label}</span>
              <span aria-hidden="true">·</span>
              <span className={cn("inline-flex items-center gap-1", handler.text)}>
                <HandlerIcon className="h-3 w-3" />
                {isVoice ? "Call summary" : handler.label}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {canTakeOver && (
            <button
              type="button"
              onClick={() => run(onTakeOver)}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-50"
            >
              <User className="h-4 w-4" />
              Take over
            </button>
          )}
          {!isVoice && mine && (
            <button
              type="button"
              onClick={() => run(onReturnToAi)}
              disabled={acting}
              className="flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-3 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10 hover:text-grey-90 disabled:opacity-50"
            >
              <Robot className="h-4 w-4" />
              Return to AI
            </button>
          )}

          <button
            type="button"
            onClick={() => run(onToggleStar)}
            disabled={acting}
            className="rounded-base p-1.5 text-grey-50 transition-colors hover:bg-grey-10 hover:text-amber-600 disabled:opacity-50"
            aria-label={conversation.starred ? "Remove star" : "Star conversation"}
            aria-pressed={conversation.starred}
          >
            {conversation.starred ? (
              <StarSolid className="h-4 w-4 text-amber-500" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </button>

          <div className="flex items-center gap-1 rounded-base border border-grey-20 bg-white p-0.5">
            {STATUS_ACTIONS.map((s) => {
              const Icon = s.icon
              const active = conversation.status === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => run(() => onStatus(s.id))}
                  disabled={acting || active}
                  title={`Set status to ${s.id}`}
                  className={cn(
                    "flex items-center gap-1 rounded-base px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-grey-10 text-grey-90"
                      : "text-grey-60 hover:bg-grey-10 hover:text-grey-90 disabled:opacity-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={onRetry}
            className="rounded-base p-1.5 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
            aria-label="Refresh conversation"
          >
            <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>

          {contextCollapsed && (
            <button
              type="button"
              onClick={onShowContext}
              className="hidden items-center gap-1.5 rounded-base border border-grey-20 px-2.5 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10 hover:text-grey-90 xl:flex"
            >
              <SidebarRight className="h-4 w-4" />
              Details
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 border-b px-4 py-2 text-xs",
            notice.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-sky-200 bg-sky-50 text-sky-800"
          )}
        >
          <ExclamationCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* The raw column says "ai_unavailable". That is a token for a log file, not
          a sentence for a shop owner — it names a failure without saying whose it
          is or what to do about it. Say it in words, and put the fix next to it. */}
      {handoff && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-xs",
            handoff.action
              ? "border-rose-200 bg-rose-50"
              : "border-amber-200 bg-amber-50"
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "font-semibold",
                handoff.action ? "text-rose-900" : "text-amber-900"
              )}
            >
              {handoff.title}
            </p>
            <p
              className={cn(
                "mt-0.5 leading-relaxed",
                handoff.action ? "text-rose-800" : "text-amber-800"
              )}
            >
              {handoff.detail}
            </p>
          </div>
          {handoff.action && (
            <Link
              href={handoff.action.href}
              className="shrink-0 rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-grey-80"
            >
              {handoff.action.label}
            </Link>
          )}
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <div className="mx-auto max-w-sm rounded-large border border-grey-20 bg-white p-6 text-center shadow-borders-base">
            <ExclamationCircle className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-2 text-sm font-medium text-grey-90">
              Could not load this conversation
            </p>
            <p className="mt-1 text-xs text-grey-50">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-grey-80"
            >
              Try again
            </button>
          </div>
        ) : loading && messages.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn("flex gap-2", i % 2 === 1 && "flex-row-reverse")}
              >
                <div className="h-7 w-7 animate-pulse rounded-full bg-grey-10" />
                <div className="h-12 w-56 animate-pulse rounded-large bg-grey-10" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-grey-50">
            No messages in this conversation yet.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <div className="my-4 flex justify-center">
                <span className="rounded-full border border-grey-20 bg-white px-3 py-1 text-xs text-grey-50">
                  {group.label}
                </span>
              </div>
              {group.items.map((m) => (
                <MessageBubble key={m.id} message={m} name={name} />
              ))}
            </div>
          ))
        )}
      </div>

      {isVoice ? (
        <div className="border-t border-grey-20 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-base border border-indigo-200 bg-indigo-50 px-3 py-2.5">
            <p className="flex items-center gap-2 text-xs text-indigo-900">
              <Phone className="h-4 w-4 shrink-0" />
              This is a call record from the call center. Calls are read-only in
              the inbox — open the call to hear the recording and read the full
              transcript.
            </p>
            <Link
              href="/dashboard/calls/calls"
              className="rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-grey-80"
            >
              Open calls
            </Link>
          </div>
        </div>
      ) : canReply ? (
        <div className="relative border-t border-grey-20 bg-white px-4 py-3">
          {cannedQuery !== null && cannedMatches.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 z-10 mb-2 overflow-hidden rounded-large border border-grey-20 bg-white shadow-lg">
              <p className="border-b border-grey-10 px-3 py-2 text-xs font-medium text-grey-50">
                Saved replies
              </p>
              {cannedMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setText(c.content)
                    setDraftIsSuggestion(false)
                    inputRef.current?.focus()
                  }}
                  className="block w-full border-b border-grey-10 px-3 py-2 text-left last:border-b-0 hover:bg-grey-5"
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded-base bg-grey-10 px-1.5 py-0.5 text-xs font-medium text-grey-70">
                      /{c.shortcut}
                    </span>
                    <span className="truncate text-sm font-medium text-grey-90">
                      {c.title}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-grey-50">
                    {c.content}
                  </span>
                </button>
              ))}
            </div>
          )}

          {draftIsSuggestion && (
            <p className="mb-2 flex items-center gap-1.5 rounded-base bg-sky-50 px-2.5 py-1.5 text-xs text-sky-800">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              AI draft. Edit it however you like, then send it — sending costs
              nothing extra.
            </p>
          )}

          <div className="flex items-end gap-2 rounded-large border border-grey-20 bg-white px-3 py-2 focus-within:border-grey-40">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                if (draftIsSuggestion) setDraftIsSuggestion(false)
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Write a reply. Type / to insert a saved reply."
              disabled={sending}
              className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm text-grey-90 outline-none placeholder:text-grey-40"
            />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting || sending}
              title="Draft a reply with AI"
              className="flex shrink-0 items-center gap-1 rounded-base border border-grey-20 px-2 py-1.5 text-xs font-medium text-grey-70 transition-colors hover:bg-grey-10 hover:text-grey-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {suggesting ? "Drafting" : "AI suggest"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base bg-grey-90 text-white transition-colors hover:bg-grey-80 disabled:opacity-40"
              aria-label="Send reply"
            >
              <PaperPlane className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-grey-20 bg-white px-4 py-3">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-base border px-3 py-2.5",
              handler.bg,
              handler.border
            )}
          >
            <p className={cn("flex items-center gap-2 text-xs", handler.text)}>
              <HandlerIcon className="h-4 w-4 shrink-0" />
              {conversation.status === "closed"
                ? "This conversation is closed. Reopen it to reply."
                : conversation.handler_mode === "ai"
                  ? "The AI assistant is handling this conversation. Take over to reply."
                  : conversation.handler_mode === "queued"
                    ? "This conversation is waiting for a human agent. Take over to reply."
                    : "Another agent has taken over this conversation. Only they can reply until they return it to the AI assistant."}
            </p>
            {conversation.status === "closed" ? (
              <button
                type="button"
                onClick={() => run(() => onStatus("open"))}
                disabled={acting}
                className="rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-50"
              >
                Reopen
              </button>
            ) : canTakeOver ? (
              <button
                type="button"
                onClick={() => run(onTakeOver)}
                disabled={acting}
                className="rounded-base bg-grey-90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-grey-80 disabled:opacity-50"
              >
                Take over
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
