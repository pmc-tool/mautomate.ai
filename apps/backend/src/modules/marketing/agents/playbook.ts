import { MedusaError } from "@medusajs/framework/utils"

import { getPublishProvider, listPublishProviders } from "../publish"

/**
 * agents/playbook — the CONTRACT for an autonomous marketing agent.
 *
 * A `marketing_agent.playbook` is a free JSON column; this module is the single
 * definition of what may legally live in it, shared by the merchant API (which
 * validates merchant input) and the marketing-agent-tick job (which executes
 * it). Nothing else may write the column.
 *
 * PLAYBOOK SHAPE
 * {
 *   "platforms":        string[]            // REQUIRED, >= 1. Registered publish
 *                                           // adapters whose capabilities.media
 *                                           // !== "required" (see CAPABILITY GATE).
 *   "mode":             "approval"|"auto",  // REQUIRED. approval -> the generated
 *                                           // post lands in the review kanban as
 *                                           // "needs_approval"; auto -> it is
 *                                           // "scheduled" and the existing publish
 *                                           // sweep ships it at the slot time.
 *   "schedule_id":      string?,            // a marketing_schedule to take the cadence from
 *   "cadence":          {                   // OR an inline cadence (one of the two is
 *      "timezone": string,                  // required for the agent to be autonomous)
 *      "slots": Slot[]
 *   }?,
 *   "topics":           string[]?,          // rotated round-robin across slots
 *   "post_types":       string[]?,          // promo | educational | story | tip |
 *                                           // announcement | question | ugc |
 *                                           // behind_the_scenes | product_spotlight |
 *                                           // seasonal
 *   "tone":             string?,            // nudge layered on the brand voice
 *   "creativity":       number?,            // 1..10 (maps to prompt guidance)
 *   "hashtag_count":    number?,            // 0..30
 *   "cta_templates":    string[]?,          // one is picked per post
 *   "goals":            string[]?,          // e.g. ["traffic","awareness"]
 *   "length":           "short"|"medium"|"long"?,
 *   "daily_post_count": number?,            // 1..20, hard cap per local calendar day
 *   "campaign_id":      string?,
 *   "product_ids":      string[]?           // ground copy in these products
 *   "_runtime":         {...}               // RESERVED, server-written (see below)
 * }
 *
 * SLOT SHAPE (also the shape of `marketing_schedule.slots`)
 * { "day": "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"|"daily",
 *   "time": "HH:MM",                        // 24h, wall-clock in the cadence timezone
 *   "platforms": string[]?                  // optional per-slot narrowing
 * }
 *
 * CAPABILITY GATE: `publish/providers/instagram` declares media "required" and
 * rejects text-only posts, and generated agent posts are text-only today. A
 * playbook (or schedule platform_filter) naming such a platform is REJECTED at
 * the API boundary rather than silently producing posts that can never publish.
 *
 * `_runtime` is server-owned observability state (last_run_at / last_error /
 * counters) surfaced by the agents list route. It is STRIPPED from merchant
 * input and preserved across updates. It is NEVER read for dedup or scheduling
 * decisions — the tick is fully stateless (see agent-runner).
 */

export const SLOT_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
  "daily",
] as const
export type SlotDay = (typeof SLOT_DAYS)[number]

export const AGENT_MODES = ["approval", "auto"] as const
export type AgentMode = (typeof AGENT_MODES)[number]

export const POST_TYPES = [
  "promo",
  "educational",
  "story",
  "tip",
  "announcement",
  "question",
  "ugc",
  "behind_the_scenes",
  "product_spotlight",
  "seasonal",
] as const

export const LENGTHS = ["short", "medium", "long"] as const

/** Agent kinds that the autonomy loop drives. */
export const AUTONOMOUS_KINDS = ["content", "social"] as const

export type AgentSlot = {
  day: SlotDay
  time: string
  platforms?: string[]
}

export type AgentCadence = {
  timezone: string
  slots: AgentSlot[]
}

/** Server-written runtime state. Never supplied by, or trusted from, a client. */
export type AgentRuntime = {
  last_run_at?: string
  last_generated_at?: string
  last_post_id?: string
  last_error?: string | null
  last_error_at?: string | null
  generated_count?: number
  skipped_reason?: string | null
}

export type AgentPlaybook = {
  platforms: string[]
  mode: AgentMode
  schedule_id?: string
  cadence?: AgentCadence
  topics?: string[]
  post_types?: string[]
  tone?: string
  creativity?: number
  hashtag_count?: number
  cta_templates?: string[]
  goals?: string[]
  length?: (typeof LENGTHS)[number]
  daily_post_count?: number
  campaign_id?: string
  product_ids?: string[]
  _runtime?: AgentRuntime
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

const invalid = (message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

/**
 * A platform an agent may target: it has a registered publish adapter AND that
 * adapter does not require media (agent posts are text-only today).
 */
export const isTextCapablePlatform = (platform: string): boolean => {
  const provider = getPublishProvider(platform)
  return !!provider && provider.capabilities.media !== "required"
}

/** Every platform an agent may legally target. */
export const listTextCapablePlatforms = (): string[] =>
  listPublishProviders()
    .filter((p) => p.capabilities.media !== "required")
    .map((p) => p.platform)

/**
 * Validate a list of platforms for agent use. Throws INVALID_DATA naming the
 * offending platform: unknown, or media-required (the capability gate).
 */
export const validateAgentPlatforms = (
  value: unknown,
  field = "playbook.platforms"
): string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(`\`${field}\` must be a non-empty array of platform names.`)
  }
  const platforms = (value as unknown[]).map((p) => String(p ?? "").trim())
  const supported = listTextCapablePlatforms()

  for (const platform of platforms) {
    if (!platform) {
      invalid(`\`${field}\` contains an empty platform name.`)
    }
    const provider = getPublishProvider(platform)
    if (!provider) {
      invalid(
        `\`${field}\`: "${platform}" is not a supported platform. Supported: ${supported.join(
          ", "
        )}.`
      )
    }
    if (provider!.capabilities.media === "required") {
      invalid(
        `\`${field}\`: "${platform}" requires an image or video on every post, and agent-generated posts are text-only, so an agent posting to ${platform} could never publish. Remove "${platform}" (supported: ${supported.join(
          ", "
        )}).`
      )
    }
  }

  return Array.from(new Set(platforms))
}

/** Validate an IANA timezone. Throws INVALID_DATA when the runtime rejects it. */
export const validateTimezone = (
  value: unknown,
  field = "timezone"
): string => {
  const tz = typeof value === "string" && value.trim() ? value.trim() : "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
  } catch {
    invalid(`\`${field}\`: "${tz}" is not a valid IANA timezone (e.g. "Europe/London").`)
  }
  return tz
}

/**
 * Validate a slots array: [{ day, time, platforms? }]. Times are 24h "HH:MM"
 * wall-clock in the cadence timezone.
 */
export const validateSlots = (
  value: unknown,
  field = "slots"
): AgentSlot[] => {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(
      `\`${field}\` must be a non-empty array of { day: "mon".."sun"|"daily", time: "HH:MM" }.`
    )
  }
  if ((value as unknown[]).length > 100) {
    invalid(`\`${field}\` may contain at most 100 slots.`)
  }

  const slots: AgentSlot[] = []
  for (const raw of value as unknown[]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      invalid(`\`${field}\` entries must be objects: { day, time, platforms? }.`)
    }
    const entry = raw as Record<string, unknown>
    const day = String(entry.day ?? "").trim().toLowerCase()
    if (!(SLOT_DAYS as readonly string[]).includes(day)) {
      invalid(
        `\`${field}\`: "${day}" is not a valid day. Expected one of: ${SLOT_DAYS.join(
          ", "
        )}.`
      )
    }
    const time = String(entry.time ?? "").trim()
    if (!TIME_RE.test(time)) {
      invalid(
        `\`${field}\`: "${time}" is not a valid time. Expected 24-hour "HH:MM" (e.g. "09:00").`
      )
    }
    const slot: AgentSlot = { day: day as SlotDay, time }
    if (entry.platforms !== undefined && entry.platforms !== null) {
      slot.platforms = validateAgentPlatforms(
        entry.platforms,
        `${field}[].platforms`
      )
    }
    slots.push(slot)
  }
  return slots
}

/** Coerce + bound a numeric field. */
const num = (
  value: unknown,
  field: string,
  min: number,
  max: number
): number => {
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max) {
    invalid(`\`${field}\` must be a number between ${min} and ${max}.`)
  }
  return Math.round(n)
}

/** Coerce a list of non-empty strings, bounded in length. */
const strList = (value: unknown, field: string, max: number): string[] => {
  if (!Array.isArray(value)) {
    invalid(`\`${field}\` must be an array of strings.`)
  }
  const out = (value as unknown[])
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0)
  if (out.length > max) {
    invalid(`\`${field}\` may contain at most ${max} entries.`)
  }
  return out
}

/**
 * Validate a merchant-supplied playbook. Unknown keys are REJECTED (no arbitrary
 * junk lands in the column). `_runtime` from the client is ignored; the caller's
 * `previous` playbook's `_runtime` is carried forward.
 */
export const validatePlaybook = (
  raw: unknown,
  previous?: unknown
): AgentPlaybook => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    invalid("`playbook` must be an object.")
  }
  const b = raw as Record<string, unknown>

  const KNOWN = new Set([
    "platforms",
    "mode",
    "schedule_id",
    "cadence",
    "topics",
    "post_types",
    "tone",
    "creativity",
    "hashtag_count",
    "cta_templates",
    "goals",
    "length",
    "daily_post_count",
    "campaign_id",
    "product_ids",
    "_runtime",
  ])
  const unknown = Object.keys(b).filter((k) => !KNOWN.has(k))
  if (unknown.length) {
    invalid(
      `\`playbook\` has unsupported field(s): ${unknown.join(
        ", "
      )}. Allowed: ${Array.from(KNOWN)
        .filter((k) => k !== "_runtime")
        .join(", ")}.`
    )
  }

  const platforms = validateAgentPlatforms(b.platforms)

  const mode = String(b.mode ?? "").trim()
  if (!(AGENT_MODES as readonly string[]).includes(mode)) {
    invalid(
      `\`playbook.mode\` is required and must be one of: ${AGENT_MODES.join(", ")}.`
    )
  }

  const out: AgentPlaybook = { platforms, mode: mode as AgentMode }

  if (b.schedule_id !== undefined && b.schedule_id !== null) {
    const id = String(b.schedule_id).trim()
    if (!id) {
      invalid("`playbook.schedule_id` cannot be empty.")
    }
    out.schedule_id = id
  }

  if (b.cadence !== undefined && b.cadence !== null) {
    const c = b.cadence
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      invalid("`playbook.cadence` must be an object: { timezone, slots }.")
    }
    const cad = c as Record<string, unknown>
    out.cadence = {
      timezone: validateTimezone(cad.timezone, "playbook.cadence.timezone"),
      slots: validateSlots(cad.slots, "playbook.cadence.slots"),
    }
  }

  if (b.topics !== undefined && b.topics !== null) {
    out.topics = strList(b.topics, "playbook.topics", 50)
  }
  if (b.post_types !== undefined && b.post_types !== null) {
    const types = strList(b.post_types, "playbook.post_types", 20)
    for (const t of types) {
      if (!(POST_TYPES as readonly string[]).includes(t)) {
        invalid(
          `\`playbook.post_types\`: "${t}" is not supported. Expected one of: ${POST_TYPES.join(
            ", "
          )}.`
        )
      }
    }
    out.post_types = types
  }
  if (b.tone !== undefined && b.tone !== null) {
    const tone = String(b.tone).trim()
    if (tone) {
      out.tone = tone.slice(0, 200)
    }
  }
  if (b.creativity !== undefined && b.creativity !== null) {
    out.creativity = num(b.creativity, "playbook.creativity", 1, 10)
  }
  if (b.hashtag_count !== undefined && b.hashtag_count !== null) {
    out.hashtag_count = num(b.hashtag_count, "playbook.hashtag_count", 0, 30)
  }
  if (b.cta_templates !== undefined && b.cta_templates !== null) {
    out.cta_templates = strList(b.cta_templates, "playbook.cta_templates", 20)
  }
  if (b.goals !== undefined && b.goals !== null) {
    out.goals = strList(b.goals, "playbook.goals", 10)
  }
  if (b.length !== undefined && b.length !== null) {
    const length = String(b.length).trim()
    if (!(LENGTHS as readonly string[]).includes(length)) {
      invalid(`\`playbook.length\` must be one of: ${LENGTHS.join(", ")}.`)
    }
    out.length = length as (typeof LENGTHS)[number]
  }
  if (b.daily_post_count !== undefined && b.daily_post_count !== null) {
    out.daily_post_count = num(
      b.daily_post_count,
      "playbook.daily_post_count",
      1,
      20
    )
  }
  if (b.campaign_id !== undefined && b.campaign_id !== null) {
    const id = String(b.campaign_id).trim()
    if (id) {
      out.campaign_id = id
    }
  }
  if (b.product_ids !== undefined && b.product_ids !== null) {
    out.product_ids = strList(b.product_ids, "playbook.product_ids", 50)
  }

  // Carry forward server-owned runtime state; never accept it from the client.
  const prevRuntime = (previous as any)?._runtime
  if (prevRuntime && typeof prevRuntime === "object") {
    out._runtime = prevRuntime as AgentRuntime
  }

  return out
}
