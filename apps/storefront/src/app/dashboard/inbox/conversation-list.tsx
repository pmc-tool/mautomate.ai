"use client"

import React from "react"
import {
  ArrowPath,
  ChatBubbleLeftRight,
  ExclamationCircle,
  MagnifyingGlass,
  Star,
  StarSolid,
  User,
  Users,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type { InboxConversation } from "@lib/merchant-admin/api"
import {
  CHANNELS,
  ChannelIcon,
  channelMeta,
  contactName,
  handlerMeta,
  initial,
  timeAgo,
} from "./inbox-utils"

export type AssignmentFilter = "all" | "mine" | "unassigned" | "starred"
export type SortOrder = "newest" | "oldest"

export type InboxFilters = {
  channel: string
  status: string
  assignment: AssignmentFilter
  unreadOnly: boolean
  search: string
  sort: SortOrder
}

const ASSIGNMENTS: {
  id: AssignmentFilter
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "all", label: "All", icon: ChatBubbleLeftRight },
  { id: "mine", label: "Mine", icon: User },
  { id: "unassigned", label: "Unassigned", icon: Users },
  { id: "starred", label: "Starred", icon: Star },
]

const STATUSES = [
  { id: "", label: "All" },
  { id: "open", label: "Open" },
  { id: "snoozed", label: "Snoozed" },
  { id: "closed", label: "Closed" },
]

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-grey-90 bg-grey-90 text-white"
          : "border-grey-20 bg-white text-grey-60 hover:border-grey-30 hover:text-grey-90"
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  )
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
        className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-grey-90"
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
          <span className="flex items-center justify-between gap-2">
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

          <span className="mt-0.5 block text-xs text-grey-50">
            {channel.label}
            {conversation.status !== "open" ? ` · ${conversation.status}` : ""}
          </span>

          <span
            className={cn(
              "mt-1 block truncate text-xs",
              unread ? "text-grey-80" : "text-grey-50"
            )}
          >
            {conversation.preview || "No messages yet"}
          </span>

          <span className="mt-1.5 flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                handler.bg,
                handler.text
              )}
            >
              <HandlerIcon className="h-3 w-3" />
              {handler.label}
            </span>
            {(conversation.unread_count ?? 0) > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-grey-90 px-1 text-[10px] font-semibold text-white">
                {conversation.unread_count}
              </span>
            )}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleStar}
        className="absolute right-3 top-11 rounded-base p-1 text-grey-40 transition-colors hover:bg-grey-10 hover:text-amber-600"
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
  onFiltersChange,
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
  onFiltersChange: (next: InboxFilters) => void
  onSelect: (id: string) => void
  onToggleStar: (id: string) => void
  onRetry: () => void
}) {
  const set = <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value })

  return (
    <div className="flex h-full w-full flex-col border-r border-grey-20 bg-white lg:w-80 lg:shrink-0">
      <div className="border-b border-grey-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-grey-90">
            Conversations
            <span className="ml-2 rounded-full bg-grey-10 px-1.5 py-0.5 text-xs font-medium text-grey-60">
              {totalCount}
            </span>
          </h2>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-base p-1.5 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
            aria-label="Refresh conversations"
          >
            <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        <div className="relative mt-3">
          <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-40" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search name, email or phone"
            className="w-full rounded-base border border-grey-20 py-2 pl-8 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-40 focus:outline-none focus:ring-2 focus:ring-grey-10"
          />
        </div>
      </div>

      <div className="space-y-2 border-b border-grey-10 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={filters.channel === ""}
            onClick={() => set("channel", "")}
          >
            All channels
          </Chip>
          {CHANNELS.map((c) => {
            const Icon = c.icon
            const active = filters.channel === c.id
            return (
              <Chip
                key={c.id}
                active={active}
                onClick={() => set("channel", active ? "" : c.id)}
              >
                <Icon className={cn("h-3 w-3", active ? "text-white" : c.color)} />
                {c.label}
              </Chip>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ASSIGNMENTS.map((a) => {
            const Icon = a.icon
            return (
              <Chip
                key={a.id}
                active={filters.assignment === a.id}
                onClick={() => set("assignment", a.id)}
              >
                <Icon className="h-3 w-3" />
                {a.label}
              </Chip>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Chip
              key={s.id || "all"}
              active={filters.status === s.id}
              onClick={() => set("status", s.id)}
            >
              {s.label}
            </Chip>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <select
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value as SortOrder)}
            className="rounded-base border border-grey-20 bg-white px-2 py-1 text-xs font-medium text-grey-70 focus:border-grey-40 focus:outline-none"
            aria-label="Sort conversations"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-grey-60">
            Unread only
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => set("unreadOnly", e.target.checked)}
              className="h-4 w-4 rounded-base border-grey-30 text-grey-90 focus:ring-grey-90"
            />
          </label>
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
          <div className="p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-grey-10 text-grey-50">
              <ChatBubbleLeftRight className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-grey-90">
              No conversations here
            </p>
            <p className="mt-1 text-xs leading-relaxed text-grey-50">
              Threads land in this inbox when a visitor writes in through the
              website chat widget, or when a channel you connected under
              Marketing (WhatsApp, Messenger, Instagram, Telegram) receives a
              message. Clear the filters above if you expected to see one.
            </p>
          </div>
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
