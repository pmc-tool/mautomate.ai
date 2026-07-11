import type { MedusaContainer } from "@medusajs/framework/types"

import { CALL_CENTER_MODULE } from "../modules/call-center"
import { getCurrentTenantId } from "../lib/tenant-context"
import { runForEachTenant } from "./_marketing-tenant-sweep"

/**
 * call-center-reconcile (scheduled sweep, every 5 minutes).
 *
 * The DURABLE OUTBOX / RECONCILIATION safety net the plan requires. Webhooks
 * and in-flight dispatches CAN be missed (provider webhook dropped, process
 * restart mid-call, network blip). This sweep is the self-healing backstop that
 * converges our persisted state back to reality so nothing hangs forever:
 *
 *   (a) STUCK CALLS — Calls left in a non-terminal state (`dialing` /
 *       `in_progress`) longer than STUCK_CALL_MINUTES that carry a
 *       `provider_call_id`:
 *         - If Twilio creds are set, GET the authoritative call status from
 *           Twilio (no-throw fetch) and reconcile our Call.status. The write is
 *           IDEMPOTENT / COALESCE: we only advance a still-non-terminal call to
 *           the mapped status and NEVER overwrite an already-terminal call.
 *         - If Twilio is unset or unreachable, any call older than
 *           HARD_TIMEOUT_MINUTES is force-marked `failed` so it cannot hang
 *           forever.
 *
 *   (b) STUCK TASKS — CallTasks left in `claimed` longer than
 *       CLAIMED_TIMEOUT_MINUTES (a crash between claim and dispatch strands
 *       them). They are RELEASED back to `scheduled` for the dialer to retry,
 *       or DEAD-LETTERED to `failed` once `attempts >= max_attempts`.
 *
 * MASTER SAFETY FLAG: the whole sweep is a no-op unless
 * CALL_CENTER_ENABLED === "true". Everything is no-throw; a summary is logged.
 *
 * This job iterates over every active tenant and runs the tenant-specific
 * reconciliation inside the request-scoped tenant context.
 *
 * NOTE: reconciliation intentionally runs even when the durable outbound halt
 * is engaged — halting stops NEW dialing, but existing in-flight state must
 * still be healed.
 */

/** A call in dialing/in_progress longer than this is considered stuck. */
const STUCK_CALL_MINUTES = 15

/** Absolute ceiling: a stuck call this old is force-failed if unverifiable. */
const HARD_TIMEOUT_MINUTES = 60

/** A task in `claimed` longer than this is considered stranded. */
const CLAIMED_TIMEOUT_MINUTES = 15

/** Bound how many rows we touch per sweep (safety). */
const BATCH_LIMIT = 100

/** No-throw, timeout-bounded fetch. */
const REQUEST_TIMEOUT_MS = 5000

/** Our terminal Call statuses — never overwritten by reconciliation. */
const TERMINAL_CALL_STATUSES = [
  "completed",
  "failed",
  "no_answer",
  "voicemail",
  "canceled",
]

/**
 * Map a Twilio call status to our Call.status. Returns null for statuses that
 * are still non-terminal on Twilio's side (leave our record as-is).
 */
function mapTwilioStatus(twilioStatus: string | null): string | null {
  switch (twilioStatus) {
    case "completed":
      return "completed"
    case "busy":
    case "failed":
      return "failed"
    case "no-answer":
      return "no_answer"
    case "canceled":
      return "canceled"
    case "in-progress":
      return "in_progress"
    // queued / ringing / initiated -> still dialing, nothing to reconcile yet.
    default:
      return null
  }
}

/**
 * No-throw GET of a Twilio call's status. Returns the raw Twilio status string
 * or null on any missing-cred / network / non-2xx / parse error.
 */
async function fetchTwilioCallStatus(
  callSid: string
): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    return null
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}.json`
  const auth = Buffer.from(`${sid}:${token}`).toString("base64")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { authorization: `Basic ${auth}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      return null
    }
    const body: any = await res.json()
    return typeof body?.status === "string" ? body.status : null
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "[call-center] reconcile: Twilio status fetch failed:",
      e
    )
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default async function callCenterReconcileJob(
  container: MedusaContainer
): Promise<void> {
  // Master kill-switch: inert unless explicitly enabled.
  if (process.env.CALL_CENTER_ENABLED !== "true") {
    return
  }

  const summary = await runForEachTenant(
    container,
    "call-center reconcile",
    (c) => runReconcileForTenant(c, getCurrentTenantId()!)
  )

  // eslint-disable-next-line no-console
  console.log(
    `[call-center] reconcile: platform sweep complete — calls reconciled=${summary.callsReconciled}, calls force-failed=${summary.callsForceFailed}, tasks released=${summary.tasksReleased}, tasks dead-lettered=${summary.tasksDeadLettered}.`
  )
}

async function runReconcileForTenant(
  container: MedusaContainer,
  tenantId: string
): Promise<{
  callsReconciled: number
  callsForceFailed: number
  tasksReleased: number
  tasksDeadLettered: number
}> {
  const cc: any = container.resolve(CALL_CENTER_MODULE)
  const now = Date.now()
  const stuckThreshold = new Date(now - STUCK_CALL_MINUTES * 60 * 1000)
  const hardThreshold = new Date(now - HARD_TIMEOUT_MINUTES * 60 * 1000)
  const claimedThreshold = new Date(
    now - CLAIMED_TIMEOUT_MINUTES * 60 * 1000
  )

  let callsReconciled = 0
  let callsForceFailed = 0
  let tasksReleased = 0
  let tasksDeadLettered = 0

  // (a) Heal stuck calls -----------------------------------------------------
  try {
    const stuckCalls: any[] = await cc.listCalls(
      {
        tenant_id: tenantId,
        status: ["dialing", "in_progress"],
        updated_at: { $lte: stuckThreshold },
      },
      { take: BATCH_LIMIT, order: { updated_at: "ASC" } }
    )

    for (const call of stuckCalls ?? []) {
      // Guard: never touch a call that has since become terminal.
      if (TERMINAL_CALL_STATUSES.includes(call.status)) {
        continue
      }

      if (!call.provider_call_id) {
        // No provider handle — can only force-fail once past the hard ceiling.
        if (new Date(call.updated_at) <= hardThreshold) {
          await forceFailCall(cc, call.id)
          callsForceFailed += 1
        }
        continue
      }

      const twilioStatus = await fetchTwilioCallStatus(call.provider_call_id)
      const mapped = mapTwilioStatus(twilioStatus)

      if (mapped && mapped !== call.status) {
        // Idempotent advance — only if still non-terminal (guarded above).
        try {
          const patch: Record<string, unknown> = { id: call.id, status: mapped }
          if (TERMINAL_CALL_STATUSES.includes(mapped)) {
            patch.ended_at = new Date()
          }
          await cc.updateCalls(patch)
          callsReconciled += 1
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(
            `[call-center] reconcile: failed to reconcile call ${call.id} for tenant ${tenantId}:`,
            e
          )
        }
        continue
      }

      if (mapped === null) {
        // Twilio unreachable/unset OR still non-terminal there. As a last
        // resort, force-fail anything past the hard timeout so it cannot hang.
        if (new Date(call.updated_at) <= hardThreshold) {
          await forceFailCall(cc, call.id)
          callsForceFailed += 1
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] reconcile: stuck-call sweep failed for tenant ${tenantId}:`,
      e
    )
  }

  // (b) Release stranded claimed tasks --------------------------------------
  try {
    const stuckTasks: any[] = await cc.listCallTasks(
      {
        tenant_id: tenantId,
        status: "claimed",
        updated_at: { $lte: claimedThreshold },
      },
      { take: BATCH_LIMIT, order: { updated_at: "ASC" } }
    )

    for (const task of stuckTasks ?? []) {
      const attempts = Number(task.attempts ?? 0)
      const maxAttempts = Number(task.max_attempts ?? 3)

      try {
        if (attempts >= maxAttempts) {
          // Dead-letter: exhausted its budget while stranded.
          await cc.updateCallTasks({ id: task.id, status: "failed" })
          tasksDeadLettered += 1
          // eslint-disable-next-line no-console
          console.error(
            `[call-center] reconcile: task ${task.id} for tenant ${tenantId} stranded in claimed and exhausted ${maxAttempts} attempts — dead-lettered to failed.`
          )
        } else {
          // Release back to the dialer for another attempt.
          await cc.updateCallTasks({ id: task.id, status: "scheduled" })
          tasksReleased += 1
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          `[call-center] reconcile: failed to release stranded task ${task.id} for tenant ${tenantId}:`,
          e
        )
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] reconcile: stranded-task sweep failed for tenant ${tenantId}:`,
      e
    )
  }

  return {
    callsReconciled,
    callsForceFailed,
    tasksReleased,
    tasksDeadLettered,
  }
}

/** Force a non-terminal call to `failed` (hard-timeout backstop). */
async function forceFailCall(cc: any, id: string): Promise<void> {
  try {
    await cc.updateCalls({ id, status: "failed", ended_at: new Date() })
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] reconcile: call ${id} force-failed after hard timeout (unverifiable).`
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[call-center] reconcile: failed to force-fail call ${id}:`,
      e
    )
  }
}

export const config = {
  name: "call-center-reconcile",
  schedule: "*/5 * * * *",
}
