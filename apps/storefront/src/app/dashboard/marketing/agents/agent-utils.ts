"use client"

import type {
  AgentPlaybook,
  AgentSlot,
  AgentSlotDay,
  MarketingAgent,
} from "@lib/merchant-admin/api"

/**
 * The agent studio's shared vocabulary.
 *
 * Every list here mirrors the backend contract in
 * apps/backend/src/modules/marketing/agents/playbook.ts. The API rejects any
 * value outside these sets (and any unknown playbook key), so this file is the
 * single place the UI's options are declared.
 */

export const POST_TYPE_OPTIONS: Array<{
  value: string
  label: string
  description: string
}> = [
  {
    value: "promo",
    label: "Promotional",
    description: "Offers, launches and product promotions.",
  },
  {
    value: "educational",
    label: "Educational",
    description: "Explain something useful to your audience.",
  },
  {
    value: "tip",
    label: "Tips",
    description: "Short, practical advice they can act on.",
  },
  {
    value: "story",
    label: "Story",
    description: "A narrative about the brand or a customer.",
  },
  {
    value: "announcement",
    label: "Announcement",
    description: "News worth telling: launches, milestones, events.",
  },
  {
    value: "question",
    label: "Engagement",
    description: "Questions and prompts that invite replies.",
  },
  {
    value: "behind_the_scenes",
    label: "Behind the scenes",
    description: "How the work gets done, and who does it.",
  },
  {
    value: "product_spotlight",
    label: "Product highlight",
    description: "One product, its detail and why it matters.",
  },
  {
    value: "ugc",
    label: "Customer voices",
    description: "Testimonials and customer-generated content.",
  },
  {
    value: "seasonal",
    label: "Seasonal",
    description: "Tied to the season, a holiday or a moment.",
  },
]

export const TONE_OPTIONS = [
  "Professional",
  "Casual",
  "Friendly",
  "Confident",
  "Playful",
  "Witty",
  "Bold",
  "Warm",
  "Inspirational",
  "Informative",
]

export const LENGTH_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
]

export const GOAL_OPTIONS = [
  "awareness",
  "traffic",
  "engagement",
  "sales",
  "loyalty",
  "recruiting",
]

/** Cadence days, in the order the chips render. "daily" is offered separately. */
export const DAY_OPTIONS: Array<{ value: AgentSlotDay; label: string; long: string }> = [
  { value: "mon", label: "Mon", long: "Monday" },
  { value: "tue", label: "Tue", long: "Tuesday" },
  { value: "wed", label: "Wed", long: "Wednesday" },
  { value: "thu", label: "Thu", long: "Thursday" },
  { value: "fri", label: "Fri", long: "Friday" },
  { value: "sat", label: "Sat", long: "Saturday" },
  { value: "sun", label: "Sun", long: "Sunday" },
]

export const TIME_OPTIONS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
]

/**
 * A short, sane timezone list plus whatever the browser reports, so the store's
 * own zone is always offered and pre-selected.
 */
export function timezoneOptions(): string[] {
  const base = [
    "UTC",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/Madrid",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Asia/Dubai",
    "Asia/Dhaka",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ]
  const local = browserTimezone()
  return Array.from(new Set([local, ...base]))
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** The capability gate, worded for a merchant. */
export const MEDIA_REQUIRED_REASON =
  "Requires an image on every post, and agent posts are text-only today. Coming soon."

export function postTypeLabel(value: string): string {
  return (
    POST_TYPE_OPTIONS.find((t) => t.value === value)?.label ||
    value.replace(/_/g, " ")
  )
}

export function dayLabel(day: string): string {
  if (day === "daily") return "Every day"
  return DAY_OPTIONS.find((d) => d.value === day)?.label || day
}

/** The playbook's cadence, whichever way it was stored. */
export function playbookSlots(playbook: AgentPlaybook | null): AgentSlot[] {
  return playbook?.cadence?.slots ?? []
}

/**
 * "3 posts a week — Mon, Wed, Fri at 09:00". Falls back to a plain slot count
 * when the slots do not share one time.
 */
export function cadenceSummary(playbook: AgentPlaybook | null): string {
  const slots = playbookSlots(playbook)
  if (!slots.length) {
    return "No cadence yet — generate on demand"
  }

  const perWeek = slots.reduce(
    (sum, s) => sum + (s.day === "daily" ? 7 : 1),
    0
  )
  const perDay = playbook?.daily_post_count ?? 1
  const posts = perWeek * perDay
  const noun = posts === 1 ? "post" : "posts"

  const days = Array.from(new Set(slots.map((s) => dayLabel(s.day))))
  const times = Array.from(new Set(slots.map((s) => s.time))).sort()

  const when =
    times.length === 1
      ? `${days.join(", ")} at ${times[0]}`
      : `${days.join(", ")} at ${times.join(", ")}`

  return `${posts} ${noun} a week — ${when}`
}

export function modeLabel(playbook: AgentPlaybook | null): string {
  return playbook?.mode === "auto" ? "Auto-publish" : "Needs approval"
}

export function agentPlatforms(agent: MarketingAgent): string[] {
  return agent.playbook?.platforms ?? []
}

/** "2 hours ago" for last-run stamps. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ]
  let value = seconds
  for (const [size, unit] of units) {
    if (value < size) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        -Math.floor(value),
        unit
      )
    }
    value = value / size
  }
  return ""
}

/**
 * Step 2's free-text brand context.
 *
 * The playbook REJECTS unknown keys, so the business description and the target
 * audience cannot live there. They belong on the agent's `instructions`, which
 * is exactly what the generator feeds the model as its standing instructions
 * (see agents/agent-runner.ts). We compose them into one deterministic document
 * and parse them back out, so the wizard round-trips without losing anything a
 * merchant typed elsewhere.
 */
const ABOUT_HEADING = "About the business:"
const AUDIENCE_HEADING = "Target audience:"

export function composeInstructions(about: string, audience: string): string | null {
  const parts: string[] = []
  if (about.trim()) parts.push(`${ABOUT_HEADING}\n${about.trim()}`)
  if (audience.trim()) parts.push(`${AUDIENCE_HEADING}\n${audience.trim()}`)
  return parts.length ? parts.join("\n\n") : null
}

export function parseInstructions(instructions: string | null): {
  about: string
  audience: string
} {
  const text = instructions ?? ""
  if (!text.trim()) return { about: "", audience: "" }

  const aboutIdx = text.indexOf(ABOUT_HEADING)
  const audienceIdx = text.indexOf(AUDIENCE_HEADING)

  // Not written by this wizard: keep every character, in the About box.
  if (aboutIdx === -1 && audienceIdx === -1) {
    return { about: text.trim(), audience: "" }
  }

  const about =
    aboutIdx === -1
      ? ""
      : text
          .slice(
            aboutIdx + ABOUT_HEADING.length,
            audienceIdx > aboutIdx ? audienceIdx : undefined
          )
          .trim()
  const audience =
    audienceIdx === -1
      ? ""
      : text.slice(audienceIdx + AUDIENCE_HEADING.length).trim()

  return { about, audience }
}

/** Comma / newline separated text into a clean string list. */
export function toList(value: string, separator: "comma" | "line"): string[] {
  return value
    .split(separator === "comma" ? /[,\n]/ : /\n/)
    .map((v) => v.trim())
    .filter(Boolean)
}

export function fromList(
  value: string[] | undefined | null,
  separator: "comma" | "line"
): string {
  return (value ?? []).join(separator === "comma" ? ", " : "\n")
}
