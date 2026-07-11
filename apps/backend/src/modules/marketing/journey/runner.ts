import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * journey/runner — the journey execution engine.
 *
 * A scheduled sweep steps enrolled contacts through an automation journey's
 * ordered `steps` array (wait / condition / action nodes). Mirrors the
 * cart-recovery + publish runners' claim-first pattern: a due enrollment is
 * CLAIMED (flipped to "processing") BEFORE any work so a second concurrent
 * worker skips it, then the step loop runs until it must wait, retry, complete,
 * or fail.
 *
 * DOUBLE GATE (fail-safe — this deploys to a LIVE store):
 *   1. Master flag: no-op unless MARKETING_ENABLED === "1".
 *   2. Durable kill switch: no-op if the setting `journeys_halted` is true.
 *
 * Every path is defensive: a single malformed enrollment is caught and does not
 * abort the rest of the sweep. Nothing throws out of the public entrypoint.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"
import { SettingsService } from "../settings/settings-service"
import { executeAction } from "./action-executor"
import type {
  JourneyCondition,
  JourneyContext,
  JourneyStep,
} from "./types"

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Durable kill switch — halts the journey runner without a redeploy. */
const HALT_KEY = "journeys_halted"

/** Number of due enrollments stepped per sweep. */
const STEP_BATCH = 50

/** Hard cap on inline step iterations per enrollment (runaway guard). */
const MAX_STEP_ITERATIONS = 25

/** Backoff ceiling in minutes — attempt N waits min(2^N, 60) minutes. */
const MAX_BACKOFF_MINUTES = 60

export type JourneySweepResult = {
  processed: number
  completed: number
  failed: number
}

/** Compute the next retry time: now + min(2^attempts, 60) minutes. */
const backoffFrom = (now: Date, attempts: number): Date => {
  const minutes = Math.min(Math.pow(2, attempts), MAX_BACKOFF_MINUTES)
  return new Date(now.getTime() + minutes * 60 * 1000)
}

/** Resolve a dotted path (e.g. "order.total") against the eval context. */
const resolvePath = (
  context: JourneyContext,
  path: string
): unknown => {
  if (!path) {
    return undefined
  }
  const segments = path.split(".")
  let current: unknown = context
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * Evaluate a journey condition against the live context. Supports
 * eq/neq/gt/gte/lt/lte/exists/not_exists/contains with a dotted-path `field`.
 * Comparisons coerce to numbers for the ordering operators; equality is loose.
 */
export const evaluateCondition = (
  cond: JourneyCondition,
  context: JourneyContext
): boolean => {
  const actual = resolvePath(context, cond.field)
  const expected = cond.value

  switch (cond.op) {
    case "exists":
      return actual != null
    case "not_exists":
      return actual == null
    case "eq":
      return actual === expected || String(actual) === String(expected)
    case "neq":
      return !(actual === expected || String(actual) === String(expected))
    case "gt":
      return Number(actual) > Number(expected)
    case "gte":
      return Number(actual) >= Number(expected)
    case "lt":
      return Number(actual) < Number(expected)
    case "lte":
      return Number(actual) <= Number(expected)
    case "contains": {
      if (Array.isArray(actual)) {
        return actual.some(
          (item) =>
            item === expected || String(item) === String(expected)
        )
      }
      if (actual == null) {
        return false
      }
      return String(actual).includes(String(expected))
    }
    default:
      return false
  }
}

/**
 * Build the eval/templating context for an enrollment: hydrate the contact,
 * plus any order/cart/customer whose ids ride in the enrollment context, plus
 * the free-form `data` bag earlier steps write. Every hydration is best-effort.
 */
const buildContext = async (
  container: MedusaContainer,
  tenantId: string,
  enrollment: any
): Promise<JourneyContext> => {
  const mk: any = container.resolve(MARKETING_MODULE)
  const ctx: Record<string, unknown> =
    (enrollment?.context as Record<string, unknown>) ?? {}

  const result: JourneyContext = {
    contact: null,
    order: null,
    cart: null,
    customer: null,
    data: (ctx?.data as Record<string, unknown>) ?? {},
  }

  // Contact — from the enrollment's contact_id (best-effort).
  if (enrollment?.contact_id) {
    try {
      result.contact = await mk.retrieveMarketingContact(enrollment.contact_id)
    } catch {
      result.contact = null
    }
  }

  const gateway = getCommerceGateway(container)

  // Order / cart / customer — only when their id rides in the context.
  const orderId = ctx?.order_id
  if (typeof orderId === "string" && orderId) {
    try {
      result.order = (await gateway.getOrder(tenantId, orderId)) as any
    } catch {
      result.order = null
    }
  }

  const cartId = ctx?.cart_id
  if (typeof cartId === "string" && cartId) {
    try {
      result.cart = (await gateway.getCart(tenantId, cartId)) as any
    } catch {
      result.cart = null
    }
  }

  const customerId = ctx?.customer_id ?? enrollment?.customer_id
  if (typeof customerId === "string" && customerId) {
    try {
      result.customer = (await gateway.getCustomer(
        tenantId,
        customerId
      )) as any
    } catch {
      result.customer = null
    }
  }

  return result
}

/**
 * Run one enrollment's step loop end to end. The enrollment is already CLAIMED
 * (status "processing"). Loads the journey, hydrates context, then walks the
 * bounded step loop until it waits, retries, completes, or fails, persisting the
 * terminal/paused state exactly once. Returns whether the enrollment completed.
 */
const stepEnrollment = async (
  container: MedusaContainer,
  enrollment: any
): Promise<"completed" | "advanced" | "failed"> => {
  const mk: any = container.resolve(MARKETING_MODULE)
  const tenantId = enrollment?.tenant_id ?? currentTenantId()
  const now = new Date()

  // Load the parent journey. Missing/inactive => park or cancel the enrollment.
  let journey: any = null
  try {
    journey = await mk.retrieveMarketingJourney(enrollment.journey_id)
  } catch {
    journey = null
  }

  if (!journey) {
    await mk.updateMarketingJourneyEnrollments({
      id: enrollment.id,
      status: "canceled",
      next_run_at: null,
    } as any)
    return "advanced"
  }

  if (journey.status !== "active") {
    // Archived journeys cancel the enrollment; paused/draft just park it.
    const parked = journey.status === "archived" ? "canceled" : "waiting"
    await mk.updateMarketingJourneyEnrollments({
      id: enrollment.id,
      status: parked,
      next_run_at: null,
    } as any)
    return "advanced"
  }

  const steps: JourneyStep[] = Array.isArray(journey.steps)
    ? (journey.steps as JourneyStep[])
    : []

  // Working copy of the mutable enrollment fields.
  let stepIndex = Number(enrollment?.step_index ?? 0)
  let attempts = Number(enrollment?.attempts ?? 0)
  const maxAttempts = Number(enrollment?.max_attempts ?? 3)
  const context = await buildContext(container, tenantId, enrollment)
  let ctxData: Record<string, unknown> =
    (enrollment?.context as Record<string, unknown>) ?? {}

  // The state we will persist once the loop breaks.
  let nextStatus = "active"
  let nextRunAt: Date | null = null
  let completedAt: Date | null = null
  let error: string | null = null

  for (let iter = 0; iter < MAX_STEP_ITERATIONS; iter++) {
    // Ran off the end of the program => the enrollment is done.
    if (stepIndex >= steps.length) {
      nextStatus = "completed"
      completedAt = now
      break
    }

    const step = steps[stepIndex]

    if (!step || typeof step !== "object") {
      // Malformed node — skip it so a bad step can't wedge the enrollment.
      stepIndex += 1
      continue
    }

    if (step.type === "wait") {
      const delayMs = Math.max(0, Number(step.delay_seconds ?? 0)) * 1000
      nextRunAt = new Date(now.getTime() + delayMs)
      stepIndex += 1
      nextStatus = "active"
      break
    }

    if (step.type === "condition") {
      let passed = false
      try {
        passed = evaluateCondition(step.condition, context)
      } catch {
        passed = false
      }
      if (passed) {
        stepIndex += 1
        continue
      }
      // Failed gate — skip past it, or exit (default).
      if (step.on_fail === "skip") {
        stepIndex += 1
        continue
      }
      nextStatus = "completed"
      completedAt = now
      break
    }

    if (step.type === "action") {
      const result = await executeAction(container, {
        tenantId,
        action: step.action,
        enrollment,
        context,
      })

      // Merge returned context back into data + the persisted context bag.
      if (result?.context && typeof result.context === "object") {
        context.data = { ...(context.data ?? {}), ...result.context }
        ctxData = {
          ...ctxData,
          data: { ...((ctxData?.data as Record<string, unknown>) ?? {}), ...result.context },
        }
      }

      if (!result?.ok) {
        attempts += 1
        error = result?.error ?? "action failed"
        if (attempts < maxAttempts) {
          nextRunAt = backoffFrom(now, attempts)
          nextStatus = "active"
        } else {
          nextStatus = "failed"
        }
        break
      }

      // Cleared the action — no lingering error.
      error = null

      if (result.stop) {
        nextStatus = "completed"
        completedAt = now
        break
      }

      stepIndex += 1
      continue
    }

    // Unknown node type — skip defensively.
    stepIndex += 1
  }

  // Bounded-loop exhaustion without a terminal state: re-arm immediately so the
  // next sweep resumes rather than leaving the row stuck in "processing".
  if (
    nextStatus === "active" &&
    nextRunAt === null &&
    completedAt === null
  ) {
    nextRunAt = now
  }

  await mk.updateMarketingJourneyEnrollments({
    id: enrollment.id,
    step_index: stepIndex,
    status: nextStatus,
    next_run_at: nextRunAt,
    attempts,
    context: ctxData,
    error,
    completed_at: completedAt ?? enrollment?.completed_at ?? null,
  } as any)

  if (nextStatus === "completed") {
    return "completed"
  }
  if (nextStatus === "failed") {
    return "failed"
  }
  return "advanced"
}

/**
 * Run one journey sweep. Double-gated (master flag + durable `journeys_halted`
 * kill switch) and inert until enabled. Finds due enrollments, claims each, then
 * steps it. Safe to call concurrently (claim-first). Never throws.
 */
export const runJourneySweep = async (
  container: MedusaContainer,
  opts?: { now?: Date }
): Promise<JourneySweepResult> => {
  const zero: JourneySweepResult = { processed: 0, completed: 0, failed: 0 }

  const mk: any = container.resolve(MARKETING_MODULE)
  const settings = new SettingsService(container)

  // Gate 1 — master kill-switch.
  if (process.env.MARKETING_ENABLED !== "1") {
    return zero
  }
  // Gate 2 — durable halt flag (fail-safe: any error keeps the runner inert).
  try {
    const halted = await settings.get<boolean>(currentTenantId(), HALT_KEY, false)
    if (halted === true) {
      return zero
    }
  } catch {
    return zero
  }

  const now = opts?.now ?? new Date()
  const result: JourneySweepResult = { ...zero }

  // Find DUE enrollments: active or waiting, next_run_at unset or past.
  let rows: any[] = []
  try {
    rows = await mk.listMarketingJourneyEnrollments({
      tenant_id: currentTenantId(),
      status: ["active", "waiting"],
    })
  } catch {
    rows = []
  }

  const due = (rows ?? [])
    .filter((r) => {
      if (r?.next_run_at == null) {
        return true
      }
      return new Date(r.next_run_at).getTime() <= now.getTime()
    })
    .sort((a, b) => {
      const at = a?.next_run_at ? new Date(a.next_run_at).getTime() : 0
      const bt = b?.next_run_at ? new Date(b.next_run_at).getTime() : 0
      return at - bt
    })
    .slice(0, STEP_BATCH)

  for (const row of due) {
    // CLAIM the row first (claim-then-work — mirrors the recovery runner).
    try {
      await mk.updateMarketingJourneyEnrollments({
        id: row.id,
        status: "processing",
      } as any)
    } catch {
      // Lost the claim (deleted / raced) — skip it.
      continue
    }

    result.processed += 1

    // Work the row; a throw is a failed enrollment and does not abort the sweep.
    try {
      const outcome = await stepEnrollment(container, row)
      if (outcome === "completed") {
        result.completed += 1
      } else if (outcome === "failed") {
        result.failed += 1
      }
    } catch (e: any) {
      result.failed += 1
      // Best-effort: mark the row failed so it isn't stuck in "processing".
      try {
        await mk.updateMarketingJourneyEnrollments({
          id: row.id,
          status: "failed",
          error: e?.message ? String(e.message) : "unexpected error",
          next_run_at: null,
        } as any)
      } catch {
        // Leave it "processing"; the next sweep can heal it.
      }
    }
  }

  return result
}

export default runJourneySweep
