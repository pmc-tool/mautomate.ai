"use client"

import React from "react"
import {
  Facebook,
  X,
  Linkedin,
  Telegram,
  AtSymbol,
} from "@medusajs/icons"
import { MarketingPost, MarketingPostTarget } from "@lib/merchant-admin/api"

// The set of platforms a merchant can target. Icons are verified to exist in
// @medusajs/icons; platforms without a dedicated brand glyph fall back to a
// neutral AtSymbol.
export type PlatformMeta = {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const PLATFORMS: PlatformMeta[] = [
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "instagram", label: "Instagram", icon: AtSymbol },
  { value: "twitter", label: "X (Twitter)", icon: X },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "tiktok", label: "TikTok", icon: AtSymbol },
  { value: "telegram", label: "Telegram", icon: Telegram },
  { value: "youtube", label: "YouTube", icon: AtSymbol },
  { value: "pinterest", label: "Pinterest", icon: AtSymbol },
]

const PLATFORM_MAP: Record<string, PlatformMeta> = PLATFORMS.reduce(
  (acc, p) => {
    acc[p.value] = p
    return acc
  },
  {} as Record<string, PlatformMeta>
)

export function platformMeta(platform: string): PlatformMeta {
  return (
    PLATFORM_MAP[platform] || {
      value: platform,
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      icon: AtSymbol,
    }
  )
}

// Kanban columns. The transient/terminal statuses (publishing, failed) render
// as columns but are not drop targets. `partially_published` is folded into the
// Published column.
export type BoardColumn = {
  id: string
  label: string
  statuses: string[]
  droppable: boolean
  accent: string
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { id: "draft", label: "Draft", statuses: ["draft"], droppable: true, accent: "bg-grey-40" },
  {
    id: "needs_approval",
    label: "Needs approval",
    statuses: ["needs_approval"],
    droppable: true,
    accent: "bg-amber-400",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    statuses: ["scheduled"],
    droppable: true,
    accent: "bg-sky-400",
  },
  {
    id: "publishing",
    label: "Publishing",
    statuses: ["publishing"],
    droppable: false,
    accent: "bg-violet-400",
  },
  {
    id: "published",
    label: "Published",
    statuses: ["published", "partially_published"],
    droppable: true,
    accent: "bg-emerald-500",
  },
  { id: "failed", label: "Failed", statuses: ["failed"], droppable: false, accent: "bg-rose-500" },
]

export function columnForStatus(status: string): string {
  const col = BOARD_COLUMNS.find((c) => c.statuses.includes(status))
  return col ? col.id : "draft"
}

// Unique platforms targeted by a post, in target order.
export function postPlatforms(post: MarketingPost): string[] {
  const targets = post.targets || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of targets) {
    if (t.platform && !seen.has(t.platform)) {
      seen.add(t.platform)
      out.push(t.platform)
    }
  }
  return out
}

// Earliest scheduled_at across a post's targets (ISO string) or null.
export function earliestScheduledAt(post: MarketingPost): string | null {
  const times = (post.targets || [])
    .map((t) => t.scheduled_at)
    .filter((v): v is string => !!v)
    .sort()
  return times.length ? times[0] : null
}

export function postLabel(post: MarketingPost): string {
  return post.title?.trim() || post.body?.trim() || "Untitled post"
}

export function postSnippet(post: MarketingPost, max = 120): string {
  const text = post.body?.trim() || ""
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + "…"
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// <input type="datetime-local"> works in local time without a timezone. Convert
// an ISO string to the value the input expects, and back to ISO for the API.
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

export function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
}

// Small inline row of platform glyphs for a card.
export function PlatformIcons({
  platforms,
  className,
}: {
  platforms: string[]
  className?: string
}) {
  if (!platforms.length) return null
  return (
    <div className={"flex items-center gap-1 " + (className || "")}>
      {platforms.map((p) => {
        const meta = platformMeta(p)
        const Icon = meta.icon
        return (
          <span
            key={p}
            title={meta.label}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-grey-10 text-grey-60"
          >
            <Icon className="h-3 w-3" />
          </span>
        )
      })}
    </div>
  )
}

export type PostTarget = MarketingPostTarget
