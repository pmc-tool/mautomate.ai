"use client"

import React from "react"
import {
  ChatBubbleLeftRightSolid,
  Clock,
  Envelope,
  Facebook,
  Globe,
  Phone,
  Photo,
  Robot,
  Star,
  Telegram,
  User,
} from "@medusajs/icons"

type IconType = React.ComponentType<{ className?: string }>

export type ChannelMeta = {
  id: string
  label: string
  icon: IconType
  color: string
}

/** Every channel the backend's marketing_conversation enum can carry. */
export const CHANNELS: ChannelMeta[] = [
  { id: "web_widget", label: "Website", icon: Globe, color: "text-sky-600" },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: ChatBubbleLeftRightSolid,
    color: "text-emerald-600",
  },
  { id: "messenger", label: "Messenger", icon: Facebook, color: "text-blue-600" },
  { id: "instagram", label: "Instagram", icon: Photo, color: "text-pink-600" },
  { id: "telegram", label: "Telegram", icon: Telegram, color: "text-sky-500" },
  { id: "email", label: "Email", icon: Envelope, color: "text-grey-60" },
  { id: "review", label: "Reviews", icon: Star, color: "text-amber-600" },
  { id: "voice", label: "Calls", icon: Phone, color: "text-indigo-600" },
]

const CHANNEL_BY_ID = new Map(CHANNELS.map((c) => [c.id, c]))

const UNKNOWN_CHANNEL: ChannelMeta = {
  id: "unknown",
  label: "Unknown",
  icon: ChatBubbleLeftRightSolid,
  color: "text-grey-50",
}

export function channelMeta(channel?: string | null): ChannelMeta {
  return CHANNEL_BY_ID.get(channel ?? "") ?? UNKNOWN_CHANNEL
}

export function ChannelIcon({
  channel,
  className,
}: {
  channel?: string | null
  className?: string
}) {
  const meta = channelMeta(channel)
  const Icon = meta.icon
  return <Icon className={className ?? `h-4 w-4 ${meta.color}`} />
}

export type HandlerMeta = {
  label: string
  icon: IconType
  text: string
  bg: string
  border: string
}

/** Who currently owns a thread: the AI, the handoff queue, or a human agent. */
export const HANDLER_MODES: Record<string, HandlerMeta> = {
  ai: {
    label: "AI handling",
    icon: Robot,
    text: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  queued: {
    label: "Waiting for agent",
    icon: Clock,
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  human: {
    label: "Agent handling",
    icon: User,
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
}

export function handlerMeta(mode?: string | null): HandlerMeta {
  return HANDLER_MODES[mode ?? ""] ?? HANDLER_MODES.ai
}

export function contactName(contact?: {
  display_name: string | null
  email: string | null
  phone: string | null
} | null): string {
  if (!contact) return "Unknown contact"
  return (
    contact.display_name?.trim() ||
    contact.email?.trim() ||
    contact.phone?.trim() ||
    "Unknown contact"
  )
}

export function initial(name: string): string {
  const ch = name.trim().charAt(0)
  return ch ? ch.toUpperCase() : "?"
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const mins = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function messageTime(iso?: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function dayKey(iso?: string | null): string {
  if (!iso) return "unknown"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "unknown"
  return date.toDateString()
}

export function dayLabel(iso?: string | null): string {
  if (!iso) return "Earlier"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Earlier"
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const key = date.toDateString()
  if (key === today) return "Today"
  if (key === yesterday) return "Yesterday"
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

export function fullDateTime(iso?: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatAmount(
  amount: number,
  currency?: string | null
): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${(currency || "").toUpperCase()}`.trim()
  }
}

/**
 * An "internal" delivery_status marks a system/audit line the backend writes on
 * take-over, assignment and status changes. It is never delivered to a contact.
 */
export function isInternalMessage(message: {
  author: string
  delivery_status: string | null
}): boolean {
  return message.delivery_status === "internal" || message.author === "system"
}
