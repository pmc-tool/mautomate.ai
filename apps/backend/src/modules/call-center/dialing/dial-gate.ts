import type { MedusaContainer } from "@medusajs/framework/types"

import { CALL_CENTER_MODULE } from ".."
import { ConsentService } from "../consent/consent-service"

/**
 * DialGate — the deterministic pre-dial gate.
 *
 * Every outbound attempt passes through here before a CallTask is created (by the
 * campaign runner) or a call is placed. It composes three independent checks:
 *
 *   1. Call window   — is the customer-local clock inside allowed calling hours?
 *   2. Concurrency   — is the tenant already at its live-call cap?
 *   3. Consent / DNC — is this number allowed to be called for this purpose?
 *
 * DEFERRALS vs HARD SKIPS — a crucial distinction the caller relies on:
 *   - Call-window and concurrency failures are DEFERRALS: `ok:false` with a
 *     reason, but the number is fine to call later. The caller should reschedule.
 *   - A consent/DNC denial is a HARD SKIP: the number must NOT be dialed at all.
 *   The `reason` code lets the caller tell them apart (see CanDialResult).
 *
 * Everything here is no-throw: an unexpected error in a dependency is swallowed
 * and surfaced as a conservative `ok:false` deferral so a transient fault never
 * lets a call slip past the gate nor crashes the sweep.
 */

/** Call statuses that count as an active line against the concurrency cap. */
const ACTIVE_CALL_STATUSES = ["queued", "dialing", "in_progress"]

/** Backoff schedule (ms offsets) applied per retry attempt: +3h, +1d, +1d. */
const RETRY_BACKOFF_MS = [
  3 * 60 * 60 * 1000, // attempt 0 -> +3h
  24 * 60 * 60 * 1000, // attempt 1 -> +1d
  24 * 60 * 60 * 1000, // attempt 2 -> +1d
]

/** Outcome of `canDial`. `deferred` distinguishes a reschedule from a hard skip. */
export type CanDialResult = {
  ok: boolean
  /** Stable machine reason when `ok` is false. */
  reason?:
    | "outside_call_window"
    | "concurrency_cap_reached"
    | "consent_denied"
    | "gate_error"
  /**
   * True when the failure is a transient DEFERRAL (window / concurrency): the
   * caller should reschedule and try again later. False (or absent) means a HARD
   * skip — do not dial this number.
   */
  deferred?: boolean
  /** Human-readable explanation for logs. */
  message?: string
}

/** Options for `canDial`. */
export type CanDialOptions = {
  /** Concurrency cap for the tenant (usually the campaign's `concurrency`). */
  cap: number
  /** "now" override, primarily for testing. Defaults to `new Date()`. */
  now?: Date
  /** Customer-local timezone for the call-window check. Defaults to Asia/Dhaka. */
  tz?: string
  /** Inclusive start hour (local) of the call window. Defaults to 10. */
  startHour?: number
  /** Exclusive end hour (local) of the call window. Defaults to 19. */
  endHour?: number
}

export class DialGate {
  private readonly container: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container = container
  }

  /**
   * withinCallWindow — quiet-hours check in the CUSTOMER-LOCAL timezone.
   *
   * Uses `Intl.DateTimeFormat` (no external deps) to resolve the local hour in
   * `tz`, then returns true when `startHour <= localHour < endHour`. On any
   * formatting error it fails CLOSED (returns false) so we never dial into what
   * might be quiet hours.
   */
  withinCallWindow(
    now: Date,
    tz = "Asia/Dhaka",
    startHour = 10,
    endHour = 19
  ): boolean {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      }).formatToParts(now)

      const hourPart = parts.find((p) => p.type === "hour")?.value
      if (hourPart === undefined) {
        return false
      }

      // Intl may emit "24" for midnight under hour12:false; normalize to 0.
      let localHour = Number(hourPart)
      if (localHour === 24) {
        localHour = 0
      }
      if (!Number.isFinite(localHour)) {
        return false
      }

      return localHour >= startHour && localHour < endHour
    } catch {
      return false
    }
  }

  /**
   * concurrencyOk — is the tenant BELOW its live-call cap?
   *
   * Counts calls currently `queued` / `dialing` / `in_progress` for the tenant
   * and returns true when that count is strictly less than `cap`. On any error it
   * fails CLOSED (returns false) so a bookkeeping fault cannot let us blow past
   * the cap. A cap of 0 or less always returns false.
   */
  async concurrencyOk(tenantId: string, cap: number): Promise<boolean> {
    if (!Number.isFinite(cap) || cap <= 0) {
      return false
    }

    try {
      const cc: any = this.container.resolve(CALL_CENTER_MODULE)
      const [, count] = await cc.listAndCountCalls({
        tenant_id: tenantId,
        status: ACTIVE_CALL_STATUSES,
      })
      return Number(count ?? 0) < cap
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[call-center] dial-gate: concurrency check failed for tenant ${tenantId}:`,
        e
      )
      return false
    }
  }

  /**
   * canDial — the composed gate: call-window + concurrency + consent/DNC.
   *
   * Evaluation order is deliberate: the two cheap, deferrable checks run first
   * (window, then concurrency) so a number that simply needs rescheduling is
   * reported as a DEFERRAL without ever touching the consent store. Only once
   * both pass do we consult ConsentService, whose denial is a HARD skip.
   *
   * No-throw: a fault in any dependency is caught and returned as a conservative
   * `gate_error` deferral (safe to retry later).
   */
  async canDial(
    tenantId: string,
    phone: string,
    purpose: "transactional" | "marketing",
    opts: CanDialOptions
  ): Promise<CanDialResult> {
    const now = opts.now ?? new Date()

    // 1. Call window (deferral).
    if (!this.withinCallWindow(now, opts.tz, opts.startHour, opts.endHour)) {
      return {
        ok: false,
        reason: "outside_call_window",
        deferred: true,
        message: `Outside call window for ${opts.tz ?? "Asia/Dhaka"}; reschedule.`,
      }
    }

    // 2. Concurrency (deferral).
    if (!(await this.concurrencyOk(tenantId, opts.cap))) {
      return {
        ok: false,
        reason: "concurrency_cap_reached",
        deferred: true,
        message: `Tenant ${tenantId} at concurrency cap (${opts.cap}); reschedule.`,
      }
    }

    // 3. Consent / DNC (HARD skip).
    try {
      const consent = await new ConsentService(this.container).isAllowed(
        tenantId,
        phone,
        purpose
      )
      if (!consent.allowed) {
        return {
          ok: false,
          reason: "consent_denied",
          deferred: false,
          message: consent.reason ?? "Consent denied / do-not-call.",
        }
      }
    } catch (e) {
      // A consent-store fault must NOT fail open. Treat as a safe deferral so we
      // retry later rather than dialing a possibly-DNC number.
      // eslint-disable-next-line no-console
      console.error(
        `[call-center] dial-gate: consent check failed for ${phone} (tenant ${tenantId}):`,
        e
      )
      return {
        ok: false,
        reason: "gate_error",
        deferred: true,
        message: "Consent check errored; deferring.",
      }
    }

    return { ok: true }
  }

  /**
   * nextRetryAt — backoff schedule for a redial.
   *
   * `attempt` is the zero-based index of the retry about to be scheduled: 0 ->
   * +3h, 1 -> +1d, 2 -> +1d. Attempts beyond the table clamp to the last (+1d)
   * step. Computed relative to `now` (defaults to the current time).
   */
  nextRetryAt(attempt: number, now: Date = new Date()): Date {
    const idx = Math.min(
      Math.max(Math.floor(Number.isFinite(attempt) ? attempt : 0), 0),
      RETRY_BACKOFF_MS.length - 1
    )
    return new Date(now.getTime() + RETRY_BACKOFF_MS[idx])
  }
}
