import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { generatePost } from "../content/content-service"
import { meterAction } from "../../platform/integration/metering-guard"
import {
  AUTONOMOUS_KINDS,
  type AgentCadence,
  type AgentPlaybook,
  type AgentRuntime,
  type AgentSlot,
  isTextCapablePlatform,
} from "./playbook"

/**
 * agents/agent-runner — the autonomy engine behind `jobs/marketing-agent-tick`.
 *
 * WHAT IT DOES, per tenant, per tick:
 *   1. loads active agents of kind content|social whose playbook carries a
 *      cadence (a `schedule_id` pointing at a marketing_schedule, or an inline
 *      `cadence`),
 *   2. resolves which cadence SLOTS fell due inside the tick window, in the
 *      cadence's own TIMEZONE (DST-correct — see `resolveDueSlots`),
 *   3. SKIPS a slot that already has a post (stateless dedup — see `slotKey`),
 *   4. generates brand-grounded copy through the existing content engine,
 *      metered on the tenant's AI credits,
 *   5. places the post: mode "approval" -> post "needs_approval" + targets
 *      "pending" (lands in the merchant's review kanban); mode "auto" -> post
 *      "scheduled" + targets "scheduled" at the slot time, which is EXACTLY what
 *      the existing publish sweep (jobs/marketing-publish) claims and ships.
 *      No second publisher exists.
 *
 * STATELESSNESS: nothing about "what already ran" is stored. Dedup is derived
 * from the posts themselves (agent_id + the target's scheduled_at, compared in
 * the cadence timezone), so the tick is safe to run repeatedly, concurrently,
 * and after a downtime catch-up.
 *
 * NO-THROW: every agent is isolated; a failing agent is logged and the sweep
 * continues.
 */

/** Resolve the marketing module service (generated CRUD). Typed loosely on purpose. */
const resolveMk = (container: MedusaContainer): any =>
  container.resolve(MARKETING_MODULE)

/**
 * How far back each tick looks for due slots. The job runs every 5 minutes; a
 * 30-minute lookback means a late, restarted, or briefly-dead scheduler still
 * picks up the slots it missed (catch-up), and the overlap between consecutive
 * ticks is harmless because dedup is stateless and slot-exact.
 */
export const LOOKBACK_MINUTES = 30

/** How many recent posts are fed back into the prompt as "do not repeat these". */
const VARIETY_WINDOW = 10

/** How many of an agent's posts we scan for dedup / daily caps. */
const HISTORY_SCAN = 200

export type AgentTickSummary = {
  agents: number
  slots: number
  generated: number
  skipped_duplicate: number
  skipped_capped: number
  skipped_no_credits: number
  errors: number
}

const emptySummary = (): AgentTickSummary => ({
  agents: 0,
  slots: 0,
  generated: 0,
  skipped_duplicate: 0,
  skipped_capped: 0,
  skipped_no_credits: 0,
  errors: 0,
})

// ---------------------------------------------------------------------------
// Timezone-correct slot resolution
// ---------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>()

const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  let fmt = formatterCache.get(timezone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    formatterCache.set(timezone, fmt)
  }
  return fmt
}

export type ZonedStamp = {
  /** "mon".."sun" in the target timezone. */
  day: string
  /** "YYYY-MM-DD" local calendar date in the target timezone. */
  date: string
  /** "HH:MM" local wall clock in the target timezone. */
  time: string
}

/**
 * Project a UTC instant onto its wall clock in `timezone`. This is the ONLY
 * timezone primitive used: we never do arithmetic on local times (the classic
 * DST bug), we walk real instants and ask what the wall clock reads there. A
 * DST-skipped local time therefore simply never matches (correct: it does not
 * exist), and offsets/DST are handled by the ICU database, not by us.
 */
export const zonedStamp = (timezone: string, at: Date): ZonedStamp => {
  const parts = formatterFor(timezone).formatToParts(at)
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? ""
  const hour = get("hour") === "24" ? "00" : get("hour")
  return {
    day: get("weekday").toLowerCase().slice(0, 3),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  }
}

/** Does a slot fire at this local stamp? */
const slotMatches = (slot: AgentSlot, stamp: ZonedStamp): boolean =>
  slot.time === stamp.time && (slot.day === "daily" || slot.day === stamp.day)

export type DueSlot = {
  /** The exact UTC instant the slot fired at (minute precision). */
  at: Date
  slot: AgentSlot
  stamp: ZonedStamp
}

/**
 * Every slot of `cadence` that fired inside (now - lookback, now], resolved in
 * the cadence timezone. Implemented as a minute-by-minute scan of real instants
 * — slots have minute granularity, so this cannot miss or double-count a slot,
 * and it is exact across DST transitions in both directions.
 */
export const resolveDueSlots = (
  cadence: AgentCadence,
  now: Date,
  lookbackMinutes: number = LOOKBACK_MINUTES
): DueSlot[] => {
  const due: DueSlot[] = []
  const base = Math.floor(now.getTime() / 60000) * 60000

  for (let i = lookbackMinutes; i >= 0; i--) {
    const at = new Date(base - i * 60000)
    const stamp = zonedStamp(cadence.timezone, at)
    for (const slot of cadence.slots) {
      if (slotMatches(slot, stamp)) {
        due.push({ at, slot, stamp })
      }
    }
  }
  return due
}

/**
 * The stateless dedup key for a slot: the agent's post is "already placed" when
 * one of its targets is scheduled at the same LOCAL date + time in the cadence
 * timezone. Comparing local stamps (rather than raw instants) also makes the
 * DST fall-back repeated hour place exactly one post, not two.
 */
const slotKey = (stamp: ZonedStamp): string => `${stamp.date}T${stamp.time}`

// ---------------------------------------------------------------------------
// Agent history (dedup + daily cap + variety) — one read per agent per tick
// ---------------------------------------------------------------------------

export type AgentHistory = {
  /** slotKey() of every already-placed slot for this agent. */
  placedSlots: Set<string>
  /** local date -> number of posts already placed that day. */
  perDay: Map<string, number>
  /** Bodies/titles of the most recent posts, newest first. */
  recent: string[]
  /** Total posts this agent has produced (drives topic rotation). */
  total: number
}

/**
 * Read the agent's own posts and derive everything the tick needs. This is the
 * whole of the tick's "memory": the posts ARE the state.
 */
export const loadAgentHistory = async (
  container: MedusaContainer,
  tenantId: string,
  agentId: string,
  timezone: string
): Promise<AgentHistory> => {
  const mk = resolveMk(container)

  const posts: any[] = await mk.listMarketingPosts(
    { tenant_id: tenantId, agent_id: agentId, source: "agent" },
    { take: HISTORY_SCAN, order: { created_at: "DESC" } }
  )

  const history: AgentHistory = {
    placedSlots: new Set<string>(),
    perDay: new Map<string, number>(),
    recent: [],
    total: posts?.length ?? 0,
  }

  if (!posts?.length) {
    return history
  }

  for (const post of posts.slice(0, VARIETY_WINDOW)) {
    const text = [post?.title, post?.body]
      .filter((v) => typeof v === "string" && v.trim().length > 0)
      .join(" — ")
      .trim()
    if (text) {
      history.recent.push(text)
    }
  }

  const targets: any[] = await mk.listMarketingPostTargets(
    { tenant_id: tenantId, post_id: posts.map((p) => p.id) },
    { take: HISTORY_SCAN * 5 }
  )

  // One slot per POST (a post fans out to N platform targets at the same time).
  const seenPost = new Set<string>()
  for (const target of targets ?? []) {
    if (!target?.scheduled_at || seenPost.has(target.post_id)) {
      continue
    }
    seenPost.add(target.post_id)
    const stamp = zonedStamp(timezone, new Date(target.scheduled_at))
    const key = slotKey(stamp)
    history.placedSlots.add(key)
    history.perDay.set(stamp.date, (history.perDay.get(stamp.date) ?? 0) + 1)
  }

  return history
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const creativityGuidance = (creativity?: number): string | null => {
  if (!creativity) {
    return null
  }
  if (creativity <= 3) {
    return "Stay conservative and factual: clear, safe, on-message copy."
  }
  if (creativity <= 7) {
    return "Be engaging and fresh, but stay grounded in the facts you were given."
  }
  return "Be bold and original with the angle and hook, while staying truthful to the facts you were given."
}

/**
 * Build the brief the content engine writes from. Everything the merchant
 * configured on the playbook becomes an explicit instruction, plus the agent's
 * own instructions, plus the anti-repetition list (variety).
 */
export const buildAgentPrompt = (input: {
  agentName: string
  instructions?: string | null
  playbook: AgentPlaybook
  topic?: string | null
  postType?: string | null
  cta?: string | null
  platforms: string[]
  recent: string[]
  stamp: ZonedStamp
}): string => {
  const { playbook } = input
  const lines: string[] = []

  lines.push(
    `You are "${input.agentName}", the autonomous social media manager for this store. Write the next scheduled post.`
  )

  if (input.instructions?.trim()) {
    lines.push("")
    lines.push(`Your standing instructions: ${input.instructions.trim()}`)
  }

  lines.push("")
  lines.push(
    `This post is for the ${input.stamp.day} ${input.stamp.time} slot (local store time) and will go out on: ${input.platforms.join(
      ", "
    )}.`
  )

  if (input.topic) {
    lines.push(`Topic for this post: ${input.topic}.`)
  }
  if (input.postType) {
    lines.push(`Post type: ${input.postType.replace(/_/g, " ")}.`)
  }
  if (playbook.goals?.length) {
    lines.push(`Marketing goals: ${playbook.goals.join(", ")}.`)
  }
  if (input.cta) {
    lines.push(`End with this call to action (adapt the wording): ${input.cta}`)
  }
  if (typeof playbook.hashtag_count === "number") {
    lines.push(
      playbook.hashtag_count === 0
        ? "Do not use any hashtags."
        : `Include exactly ${playbook.hashtag_count} relevant hashtags.`
    )
  }
  const creativity = creativityGuidance(playbook.creativity)
  if (creativity) {
    lines.push(creativity)
  }

  if (input.recent.length) {
    lines.push("")
    lines.push(
      "Do NOT repeat these recent posts — pick a different angle, hook and opening line:"
    )
    input.recent.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.slice(0, 240)}`)
    })
  }

  return lines.join("\n")
}

/** Round-robin pick from a list, or null when the list is empty. */
const rotate = <T>(list: T[] | undefined, index: number): T | null =>
  list && list.length ? list[index % list.length] : null

// ---------------------------------------------------------------------------
// Generation: one post for one slot
// ---------------------------------------------------------------------------

export type GenerateForAgentInput = {
  tenantId: string
  agent: any
  playbook: AgentPlaybook
  /** Platforms for THIS post (slot narrowing + schedule filter already applied). */
  platforms: string[]
  /** When the post is due (also the target's scheduled_at). */
  slotAt: Date
  stamp: ZonedStamp
  /** Recent post texts fed back for variety. */
  recent?: string[]
  /** Drives topic / post-type / CTA rotation. */
  rotationIndex?: number
  /** Metering idempotency key. */
  idempotencyKey: string
}

export type GenerateForAgentResult =
  | { ok: true; post: any; targets: any[]; needs_ai?: boolean }
  | { ok: false; reason: "no_credits" | "error"; message: string }

/**
 * Generate ONE agent post for ONE slot and place it according to the playbook
 * mode. Shared verbatim by the tick job and the merchant "Generate now" route,
 * so the button and the cadence produce identical posts.
 *
 * Placement:
 *   approval -> post.status "needs_approval", targets "pending" + scheduled_at
 *   auto     -> post.status "scheduled",     targets "scheduled" + scheduled_at
 *               (the existing publish sweep claims these and publishes them)
 */
export const generateForAgentSlot = async (
  container: MedusaContainer,
  input: GenerateForAgentInput
): Promise<GenerateForAgentResult> => {
  const mk = resolveMk(container)
  const { tenantId, agent, playbook, platforms, slotAt, stamp } = input

  const auto = playbook.mode === "auto"
  const rotationIndex = input.rotationIndex ?? 0

  const topic = rotate(playbook.topics, rotationIndex)
  const postType = rotate(playbook.post_types, rotationIndex)
  const cta = rotate(playbook.cta_templates, rotationIndex)

  // 1. Create the shell post + targets FIRST, so the post carries source/agent
  //    /schedule regardless of what the AI returns (generatePost writes copy
  //    into an existing post when given a postId, leaving these untouched).
  const createdPost = await mk.createMarketingPosts({
    tenant_id: tenantId,
    status: "draft",
    source: "agent",
    agent_id: agent.id,
    title: topic ? topic.slice(0, 200) : `${agent.name} — ${stamp.date} ${stamp.time}`,
    brand_voice_id: agent.brand_voice_id ?? null,
    campaign_id: playbook.campaign_id ?? null,
    product_ids: playbook.product_ids?.length ? playbook.product_ids : null,
  } as any)
  const post = Array.isArray(createdPost) ? createdPost[0] : createdPost

  try {
    await mk.createMarketingPostTargets(
      platforms.map((platform) => ({
        tenant_id: tenantId,
        post_id: post.id,
        platform,
        status: auto ? "scheduled" : "pending",
        scheduled_at: slotAt,
      })) as any
    )

    // 2. Generate the copy, metered on the tenant's AI credits. Same action key
    //    ("ai_text", 1 unit) the manual /posts/generate route uses.
    const prompt = buildAgentPrompt({
      agentName: agent.name,
      instructions: agent.instructions,
      playbook,
      topic,
      postType,
      cta,
      platforms,
      recent: input.recent ?? [],
      stamp,
    })

    const metered = await meterAction(
      container,
      tenantId,
      "ai_text",
      1,
      async () => {
        const r = await generatePost(container, {
          postId: post.id,
          tenantId,
          prompt,
          platforms,
          productIds: playbook.product_ids?.length
            ? playbook.product_ids
            : undefined,
          brandVoiceId: agent.brand_voice_id ?? undefined,
          tone: playbook.tone,
          length: playbook.length,
        })
        return { result: r, actualUnits: (r as any)?.needs_ai ? 0 : 1 }
      },
      { idempotencyKey: input.idempotencyKey }
    )

    if (!metered.ok) {
      // Out of credits: leave nothing behind, do not retry, do not spin.
      await mk.deleteMarketingPostTargets(
        (
          await mk.listMarketingPostTargets({
            tenant_id: tenantId,
            post_id: post.id,
          })
        ).map((t: any) => t.id)
      )
      await mk.deleteMarketingPosts(post.id)
      return {
        ok: false,
        reason: "no_credits",
        message:
          "Out of AI credits — the scheduled post was not generated. Top up in Billing.",
      }
    }

    const result: any = metered.result

    // 3. Place the post in its lane.
    await mk.updateMarketingPosts({
      id: post.id,
      status: auto ? "scheduled" : "needs_approval",
    } as any)

    const targets = await mk.listMarketingPostTargets({
      tenant_id: tenantId,
      post_id: post.id,
    })

    const reloaded = await mk
      .retrieveMarketingPost(post.id, { relations: ["targets"] })
      .catch(() => null)

    return {
      ok: true,
      post: reloaded ?? { ...post, status: auto ? "scheduled" : "needs_approval" },
      targets,
      needs_ai: result?.needs_ai === true,
    }
  } catch (e: any) {
    // Never leave a half-built shell behind.
    try {
      const orphans = await mk.listMarketingPostTargets({
        tenant_id: tenantId,
        post_id: post.id,
      })
      if (orphans?.length) {
        await mk.deleteMarketingPostTargets(orphans.map((t: any) => t.id))
      }
      await mk.deleteMarketingPosts(post.id)
    } catch {
      // Best-effort cleanup only.
    }
    return {
      ok: false,
      reason: "error",
      message: e?.message ?? "Agent generation failed",
    }
  }
}

// ---------------------------------------------------------------------------
// Cadence resolution + the per-tenant tick
// ---------------------------------------------------------------------------

/**
 * The cadence an agent runs on: its playbook's `schedule_id` (a shared, reusable
 * marketing_schedule) or its inline `cadence`. Returns null when the agent has
 * no cadence (it is then manual-only and the tick ignores it) or when its
 * schedule is inactive/missing.
 */
export const resolveAgentCadence = async (
  container: MedusaContainer,
  tenantId: string,
  playbook: AgentPlaybook
): Promise<{ cadence: AgentCadence; platformFilter: string[] | null } | null> => {
  if (playbook.schedule_id) {
    const mk = resolveMk(container)
    const schedule = await mk
      .retrieveMarketingSchedule(playbook.schedule_id)
      .catch(() => null)
    if (
      !schedule ||
      schedule.tenant_id !== tenantId ||
      schedule.active === false
    ) {
      return null
    }
    const slots = Array.isArray(schedule.slots) ? (schedule.slots as AgentSlot[]) : []
    if (!slots.length) {
      return null
    }
    const platformFilter = Array.isArray(schedule.platform_filter)
      ? (schedule.platform_filter as string[])
      : null
    return {
      cadence: { timezone: schedule.timezone || "UTC", slots },
      platformFilter: platformFilter?.length ? platformFilter : null,
    }
  }

  if (playbook.cadence?.slots?.length) {
    return { cadence: playbook.cadence, platformFilter: null }
  }

  return null
}

/**
 * Platforms for a given slot: the agent's platforms, narrowed by the schedule's
 * platform_filter and then by the slot's own platforms, and finally filtered to
 * platforms that can actually carry a text-only post (defence in depth — the API
 * already rejects these, but a schedule edited elsewhere must not break the run).
 */
const platformsForSlot = (
  playbook: AgentPlaybook,
  slot: AgentSlot,
  platformFilter: string[] | null
): string[] => {
  let platforms = playbook.platforms
  if (platformFilter?.length) {
    platforms = platforms.filter((p) => platformFilter.includes(p))
  }
  if (slot.platforms?.length) {
    platforms = platforms.filter((p) => slot.platforms!.includes(p))
  }
  return platforms.filter((p) => isTextCapablePlatform(p))
}

/** Persist observability state on the agent (never read back for decisions). */
const stampRuntime = async (
  container: MedusaContainer,
  agent: any,
  playbook: AgentPlaybook,
  patch: Partial<AgentRuntime>
): Promise<void> => {
  try {
    const mk = resolveMk(container)
    const runtime = { ...(playbook._runtime ?? {}), ...patch }
    await mk.updateMarketingAgents({
      id: agent.id,
      playbook: { ...playbook, _runtime: runtime },
    } as any)
  } catch {
    // Observability only — never fail a run because the stamp did not persist.
  }
}

/**
 * Run the autonomy loop for ONE tenant. The tenant id is explicit so this is
 * callable from a job, a script, or a test with no HTTP context.
 */
export const runAgentTickForTenant = async (
  container: MedusaContainer,
  tenantId: string,
  opts: { now?: Date; lookbackMinutes?: number } = {}
): Promise<AgentTickSummary> => {
  const logger: any = container.resolve("logger")
  const mk = resolveMk(container)
  const summary = emptySummary()

  const now = opts.now ?? new Date()
  const lookback = opts.lookbackMinutes ?? LOOKBACK_MINUTES

  let agents: any[] = []
  try {
    agents = await mk.listMarketingAgents(
      {
        tenant_id: tenantId,
        active: true,
        kind: AUTONOMOUS_KINDS as unknown as string[],
      },
      { take: 500 }
    )
  } catch (e) {
    logger.error(
      `[marketing] agent tick: failed to list agents for tenant ${tenantId}`,
      e as any
    )
    summary.errors += 1
    return summary
  }

  for (const agent of agents ?? []) {
    try {
      const playbook = (agent.playbook ?? null) as AgentPlaybook | null
      if (
        !playbook ||
        !Array.isArray(playbook.platforms) ||
        !playbook.platforms.length ||
        (playbook.mode !== "auto" && playbook.mode !== "approval")
      ) {
        continue
      }

      const resolved = await resolveAgentCadence(container, tenantId, playbook)
      if (!resolved) {
        continue
      }

      summary.agents += 1

      const { cadence, platformFilter } = resolved
      const due = resolveDueSlots(cadence, now, lookback)
      if (!due.length) {
        await stampRuntime(container, agent, playbook, {
          last_run_at: now.toISOString(),
        })
        continue
      }

      const history = await loadAgentHistory(
        container,
        tenantId,
        agent.id,
        cadence.timezone
      )

      let rotationIndex = history.total
      let lastError: string | null = null
      let lastPostId: string | undefined
      let generated = 0

      for (const dueSlot of due) {
        summary.slots += 1
        const key = `${dueSlot.stamp.date}T${dueSlot.stamp.time}`

        // DEDUP — stateless: the posts themselves say what already ran.
        if (history.placedSlots.has(key)) {
          summary.skipped_duplicate += 1
          continue
        }

        // Daily cap.
        if (playbook.daily_post_count) {
          const today = history.perDay.get(dueSlot.stamp.date) ?? 0
          if (today >= playbook.daily_post_count) {
            summary.skipped_capped += 1
            continue
          }
        }

        const platforms = platformsForSlot(playbook, dueSlot.slot, platformFilter)
        if (!platforms.length) {
          continue
        }

        const outcome = await generateForAgentSlot(container, {
          tenantId,
          agent,
          playbook,
          platforms,
          slotAt: dueSlot.at,
          stamp: dueSlot.stamp,
          recent: history.recent,
          rotationIndex,
          idempotencyKey: `marketing_agent_tick:${agent.id}:${dueSlot.at.toISOString()}`,
        })

        if (!outcome.ok) {
          lastError = outcome.message
          if (outcome.reason === "no_credits") {
            summary.skipped_no_credits += 1
            // Out of credits is a tenant-wide condition: stop this agent's run
            // immediately rather than burning through the remaining slots.
            break
          }
          summary.errors += 1
          logger.error(
            `[marketing] agent tick: agent ${agent.id} slot ${key} failed: ${outcome.message}`
          )
          continue
        }

        // Reflect the new post in the in-memory history so a second due slot in
        // the same tick sees it (dedup + variety + rotation stay correct).
        history.placedSlots.add(key)
        history.perDay.set(
          dueSlot.stamp.date,
          (history.perDay.get(dueSlot.stamp.date) ?? 0) + 1
        )
        const body = outcome.post?.body
        if (typeof body === "string" && body.trim()) {
          history.recent.unshift(body)
          history.recent = history.recent.slice(0, VARIETY_WINDOW)
        }
        rotationIndex += 1
        generated += 1
        lastPostId = outcome.post?.id
        summary.generated += 1

        logger.info(
          `[marketing] agent tick: agent ${agent.id} generated post ${outcome.post?.id} for slot ${key} (${playbook.mode})`
        )
      }

      await stampRuntime(container, agent, playbook, {
        last_run_at: now.toISOString(),
        ...(generated
          ? {
              last_generated_at: now.toISOString(),
              last_post_id: lastPostId,
              generated_count: (playbook._runtime?.generated_count ?? 0) + generated,
            }
          : {}),
        last_error: lastError,
        last_error_at: lastError ? now.toISOString() : null,
      })
    } catch (e: any) {
      // Failure isolation: one bad agent must not kill the tenant's sweep.
      summary.errors += 1
      logger.error(
        `[marketing] agent tick: agent ${agent?.id} failed`,
        e as any
      )
    }
  }

  return summary
}
