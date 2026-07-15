"use client"

import React from "react"
import {
  ArrowPath,
  ChatBubbleLeftRight,
  ExclamationCircle,
  MagnifyingGlass,
  Star,
  StarSolid,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type { InboxConversation } from "@lib/merchant-admin/api"
import { VIEWS, type InboxView } from "./inbox-rail"
import {
  CHANNELS,
  ChannelIcon,
  channelMeta,
  contactName,
  handlerMeta,
  initial,
  timeAgo,
} from "./inbox-utils"

export type SortOrder = "newest" | "oldest"

/**
 * What is left of the old filter bar. Channel, status and assignment used to be
 * three rows of chips stacked on top of this list, in a 320px column, above the
 * conversations they were meant to help you find. They now live in the rail as
 * views, so the list is a list again.
 */
export type InboxFilters = {
  unreadOnly: boolean
  search: string
  sort: SortOrder
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
  onToggleStar,
}: {
  conversation: InboxConversation
  selected: boolean
  onSelect: () => void
  onToggleStar: () => void
}) {
  const name = contactName(conversation.contact)
  const unread = (conversation.unread_count ?? 0) > 0
  const channel = channelMeta(conversation.channel)
  const handler = handlerMeta(conversation.handler_mode)
  const HandlerIcon = handler.icon
  const waiting = conversation.handler_mode === "queued"

  return (
    <div
      className={cn(
        "relative border-b border-grey-10 transition-colors",
        selected ? "bg-grey-10" : "hover:bg-grey-5"
      )}
    >
      {selected && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-grey-90" />
      )}
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 px-4 py-3 pr-10 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-grey-90"
        aria-current={selected ? "true" : undefined}
      >
        <span className="relative shrink-0">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
              unread ? "bg-grey-90 text-white" : "bg-grey-10 text-grey-60"
            )}
          >
            {initial(name)}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 shadow-borders-base">
            <ChannelIcon
              channel={conversation.channel}
              className={cn("h-3 w-3", channel.color)}
            />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                unread ? "font-semibold text-grey-90" : "font-medium text-grey-70"
              )}
            >
              {name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-grey-50">
              {timeAgo(conversation.last_message_at)}
            </span>
          </span>

          <span
            className={cn(
              "mt-1 block line-clamp-2 text-xs leading-relaxed",
              unread ? "text-grey-80" : "text-grey-50"
            )}
          >
            {conversation.preview || "No messages yet"}
          </span>

          <span className="mt-1.5 flex items-center gap-1.5">
            {/* Only the states a merchant has to act on earn a badge. "The AI is
                handling it" is the default, and a badge on every row for the
                default is just noise. */}
            {waiting && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  handler.bg,
                  handler.text
                )}
              >
                <HandlerIcon className="h-3 w-3" />
                Needs you
              </span>
            )}
            {conversation.handler_mode === "human" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                <HandlerIcon className="h-3 w-3" />
                Agent
              </span>
            )}
            {conversation.status !== "open" && (
              <span className="inline-flex items-center rounded-full bg-grey-10 px-1.5 py-0.5 text-[11px] font-medium capitalize text-grey-60">
                {conversation.status}
              </span>
            )}
            {unread && (
              <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-grey-90 px-1 text-[10px] font-semibold text-white">
                {conversation.unread_count}
              </span>
            )}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleStar}
        className="absolute right-2 top-2 rounded-base p-1 text-grey-30 transition-colors hover:bg-grey-10 hover:text-amber-600"
        aria-label={conversation.starred ? "Remove star" : "Star conversation"}
        aria-pressed={conversation.starred}
      >
        {conversation.starred ? (
          <StarSolid className="h-4 w-4 text-amber-500" />
        ) : (
          <Star className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}

export function ConversationList({
  conversations,
  totalCount,
  selectedId,
  loading,
  error,
  filters,
  view,
  channel,
  searchRef,
  onFiltersChange,
  onView,
  onChannel,
  onSelect,
  onToggleStar,
  onRetry,
}: {
  conversations: InboxConversation[]
  totalCount: number
  selectedId: string | null
  loading: boolean
  error: string | null
  filters: InboxFilters
  view: InboxView
  channel: string
  searchRef?: React.RefObject<HTMLInputElement | null>
  onFiltersChange: (next: InboxFilters) => void
  onView: (view: InboxView) => void
  onChannel: (channel: string) => void
  onSelect: (id: string) => void
  onToggleStar: (id: string) => void
  onRetry: () => void
}) {
  const set = <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value })

  const viewLabel = VIEWS.find((v) => v.id === view)?.label ?? "Inbox"

  return (
    <div className="flex h-full w-full flex-col border-r border-grey-20 bg-white lg:w-80 lg:shrink-0 2xl:w-96">
      <div className="border-b border-grey-10 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-grey-90">
              {viewLabel}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-grey-50">
              {totalCount}
            </span>
          </h2>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-base p-1.5 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
            aria-label="Refresh conversations"
          >
            <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* The rail carries views and channels on a real screen. On a phone there
            is no room for a rail, so they collapse to two selects — the same
            state, a control that fits. */}
        <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
          <select
            value={view}
            onChange={(e) => onView(e.target.value as InboxView)}
            className="rounded-base border border-grey-20 bg-white px-2 py-1.5 text-xs font-medium text-grey-70 focus:border-grey-40 focus:outline-none"
            aria-label="View"
          >
            {VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => onChannel(e.target.value)}
            className="rounded-base border border-grey-20 bg-white px-2 py-1.5 text-xs font-medium text-grey-70 focus:border-grey-40 focus:outline-none"
            aria-label="Channel"
          >
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative mt-3">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
          <input
            ref={searchRef}
            type="search"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search name, email or phone"
            className="w-full rounded-base border border-grey-20 py-2 pl-8 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-40 focus:outline-none focus:ring-2 focus:ring-grey-10"
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-grey-60">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => set("unreadOnly", e.target.checked)}
              className="h-3.5 w-3.5 rounded-base border-grey-30 text-grey-90 focus:ring-grey-90"
            />
            Unread only
          </label>
          <button
            type="button"
            onClick={() =>
              set("sort", filters.sort === "newest" ? "oldest" : "newest")
            }
            className="rounded-base px-1.5 py-0.5 text-xs font-medium text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
          >
            {filters.sort === "newest" ? "Newest first" : "Oldest first"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-6 text-center">
            <ExclamationCircle className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-2 text-sm font-medium text-grey-90">
              Could not load conversations
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
        ) : loading && conversations.length === 0 ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-grey-10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded-base bg-grey-10" />
                  <div className="h-3 w-1/2 animate-pulse rounded-base bg-grey-10" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState view={view} channel={channel} />
        ) : (
          conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c.id)}
              onToggleStar={() => onToggleStar(c.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

/** An empty view should say what would put something in it — not just "none". */
function EmptyState({ view, channel }: { view: InboxView; channel: string }) {
  const channelLabel = channel ? channelMeta(channel).label : null

  const body = channelLabel
    ? `No ${channelLabel} threads in this view. Pick "All channels" in the rail to widen the search.`
    : view === "needs_you"
      ? "Nothing is waiting on you. The AI assistant is handling every open thread — anything it cannot answer lands here."
      : view === "mine"
        ? "You have not taken over any conversation. Open a thread and choose Take over to handle it yourself."
        : view === "unassigned"
          ? "Every open thread is claimed."
          : view === "starred"
            ? "Star a conversation to keep it here."
            : view === "closed"
              ? "No conversation has been closed yet."
              : "Threads land here when a visitor writes in through the website chat, or through any channel you connected under Marketing."

  return (
    <div className="p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-grey-10 text-grey-50">
        <ChatBubbleLeftRight className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-grey-90">Nothing here</p>
      <p className="mt-1 text-xs leading-relaxed text-grey-50">{body}</p>
    </div>
  )
}
