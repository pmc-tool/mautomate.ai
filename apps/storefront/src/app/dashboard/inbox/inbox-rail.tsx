"use client"

import React from "react"
import {
  BarsThree,
  ChatBubbleLeftRight,
  CheckCircle,
  Clock,
  InboxSolid,
  Star,
  User,
  Users,
} from "@medusajs/icons"
import { cn } from "@lib/util/cn"
import type { InboxCounts } from "@lib/merchant-admin/api"
import { CHANNELS } from "./inbox-utils"

export type InboxView =
  | "needs_you"
  | "unassigned"
  | "mine"
  | "starred"
  | "open"
  | "closed"
  | "all"

type ViewDef = {
  id: InboxView
  label: string
  icon: React.ComponentType<{ className?: string }>
  hint: string
  /** Counts above zero are worth chasing, so their badge is loud, not grey. */
  urgent?: boolean
}

/**
 * The views a merchant actually works in, in the order they work in them.
 *
 * "Needs you" comes first on purpose. The AI answers almost everything; the only
 * threads that genuinely need a human are the ones it handed back. That queue —
 * not the channel a message happened to arrive on — is the merchant's job list,
 * so it is the landing view and the only badge that shouts.
 */
export const VIEWS: ViewDef[] = [
  {
    id: "needs_you",
    label: "Needs you",
    icon: Clock,
    hint: "The AI handed these back and nobody has picked them up",
    urgent: true,
  },
  {
    id: "unassigned",
    label: "Unassigned",
    icon: Users,
    hint: "Open threads no one on your team has claimed",
  },
  {
    id: "mine",
    label: "Assigned to me",
    icon: User,
    hint: "Threads you took over",
  },
  { id: "starred", label: "Starred", icon: Star, hint: "Threads you starred" },
  {
    id: "open",
    label: "All open",
    icon: ChatBubbleLeftRight,
    hint: "Every open thread, AI-handled ones included",
  },
  { id: "closed", label: "Closed", icon: CheckCircle, hint: "Resolved threads" },
  { id: "all", label: "Everything", icon: InboxSolid, hint: "Every thread ever" },
]

function countFor(counts: InboxCounts | null, view: InboxView): number {
  if (!counts) return 0
  return counts.views[view] ?? 0
}

function RailButton({
  active,
  label,
  hint,
  count,
  urgent,
  icon: Icon,
  iconClass,
  onClick,
}: {
  active: boolean
  label: string
  hint?: string
  count: number
  urgent?: boolean
  icon: React.ComponentType<{ className?: string }>
  iconClass?: string
  onClick: () => void
}) {
  const loud = !!urgent && count > 0 && !active

  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-base px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-grey-90",
        active
          ? "bg-grey-90 text-white"
          : "text-grey-60 hover:bg-grey-10 hover:text-grey-90"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-white"
            : (iconClass ?? "text-grey-40 group-hover:text-grey-90")
        )}
      />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            active
              ? "bg-white/20 text-white"
              : loud
                ? "bg-rose-600 text-white"
                : "bg-grey-10 text-grey-60"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}

/**
 * The inbox rail: it takes the place of the main dashboard navigation while the
 * merchant is in the inbox, and hands it back on demand through "Menu". That
 * swap is the whole point — the inbox gets a full column of width that the
 * dashboard nav was holding, which is what turns three cramped panes into four
 * comfortable ones.
 */
export function InboxRail({
  counts,
  view,
  channel,
  onView,
  onChannel,
  onOpenMenu,
}: {
  counts: InboxCounts | null
  view: InboxView
  channel: string
  onView: (view: InboxView) => void
  onChannel: (channel: string) => void
  onOpenMenu: () => void
}) {
  const channelTotal = counts?.views.all ?? 0

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-grey-20 bg-white lg:flex">
      <div className="flex items-center gap-2 border-b border-grey-10 px-3 py-3">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border border-grey-20 text-grey-60 transition-colors hover:bg-grey-10 hover:text-grey-90"
          aria-label="Open the dashboard menu"
        >
          <BarsThree className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-grey-90">Inbox</p>
          <p className="truncate text-[11px] text-grey-50">
            Every channel, one place
          </p>
        </div>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
        aria-label="Inbox views"
      >
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-grey-40">
          Views
        </p>
        <div className="space-y-0.5">
          {VIEWS.map((v) => (
            <RailButton
              key={v.id}
              active={view === v.id}
              label={v.label}
              hint={v.hint}
              count={countFor(counts, v.id)}
              urgent={v.urgent}
              icon={v.icon}
              onClick={() => onView(v.id)}
            />
          ))}
        </div>

        <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wide text-grey-40">
          Channels
        </p>
        <div className="space-y-0.5">
          <RailButton
            active={channel === ""}
            label="All channels"
            count={channelTotal}
            icon={InboxSolid}
            onClick={() => onChannel("")}
          />
          {CHANNELS.map((c) => {
            const count = counts?.channels[c.id] ?? 0
            return (
              <RailButton
                key={c.id}
                active={channel === c.id}
                label={c.label}
                count={count}
                icon={c.icon}
                iconClass={count > 0 ? c.color : "text-grey-30"}
                onClick={() => onChannel(channel === c.id ? "" : c.id)}
              />
            )
          })}
        </div>
      </nav>

      <p className="border-t border-grey-10 px-4 py-3 text-[11px] leading-relaxed text-grey-40">
        A channel with no threads yet still shows here — connect it under
        Marketing and its conversations land in this inbox.
      </p>
    </aside>
  )
}
