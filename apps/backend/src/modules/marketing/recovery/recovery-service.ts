import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
/**
 * recovery/recovery-service — the abandoned-cart recovery engine.
 *
 * A scheduled sweep enrolls stale carts (has email, no order, idle past the
 * threshold) into `marketing_cart_recovery`, then steps each enrolled row
 * through a 3-email escalation (gentle → nudge → incentive). Mirrors the
 * publish runner's claim-first pattern: a due row is CLAIMED (flipped to
 * "processing") BEFORE any work so a second concurrent worker skips it.
 *
 * DOUBLE GATE (inert by default — this deploys to a LIVE store):
 *   1. Master flag: no-op unless MARKETING_ENABLED === "1".
 *   2. Per-automation toggle: no-op unless the durable setting
 *      `automation_abandoned_cart` is explicitly enabled (defaults OFF).
 *
 * Every path is defensive: a single malformed cart/row is caught and does not
 * abort the rest of the sweep. Nothing throws out of the public entrypoints.
 */

import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"
import { getCommerceGateway } from "../gateway"
import { resolveBrandName, resolveStoreUrl } from "../brand"
import { sendEmail } from "../email/send-service"
import { cartRecoveryEmail } from "../email/templates"
import { SettingsService } from "../settings/settings-service"

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

/** Per-automation durable toggle key (defaults OFF). */
const AUTOMATION_KEY = "automation_abandoned_cart"

/** Percentage off revealed at the final (incentive) step. */
const RECOVERY_DISCOUNT_PCT = Number(
  process.env.MARKETING_RECOVERY_DISCOUNT_PCT ?? 10
)

/** Hours between successful escalation steps. */
const STEP_HOURS = Number(process.env.MARKETING_RECOVERY_STEP_HOURS ?? 24)

/** Only enroll carts idle (no update) for at least this many minutes. */
const IDLE_MIN = Number(process.env.MARKETING_RECOVERY_IDLE_MIN ?? 60)

/** Hours until the incentive discount code expires. */
const DISCOUNT_EXPIRES_HOURS = 72

/** Number of due rows stepped per sweep. */
const STEP_BATCH = 50

/** Number of carts enrolled per sweep. */
const ENROLL_BATCH = 100

/** Backoff ceiling in minutes — attempt N waits min(2^N, 60) minutes. */
const MAX_BACKOFF_MINUTES = 60

export type RecoverySweepResult = {
  enrolled: number
  stepped: number
  recovered: number
  failed: number
}

/** Compute the next retry time: now + min(2^attempts, 60) minutes. */
const backoffFrom = (now: Date, attempts: number): Date => {
  const minutes = Math.min(Math.pow(2, attempts), MAX_BACKOFF_MINUTES)
  return new Date(now.getTime() + minutes * 60 * 1000)
}

/** Format a numeric price into a display string in the cart's currency. */
const formatPrice = (
  amount: number | null | undefined,
  currency: string | null | undefined
): string | undefined => {
  if (amount == null || Number.isNaN(Number(amount))) {
    return undefined
  }
  try {
    if (currency) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(Number(amount))
    }
  } catch {
    // Fall through to a plain numeric string on an unknown currency code.
  }
  return String(amount)
}

/**
 * Enroll idle abandoned carts into `marketing_cart_recovery`. For each cart not
 * already enrolled, best-effort find-or-create a contact by email, then create
 * a step-0 "active" row due immediately. Never throws.
 */
export const enrollAbandonedCarts = async (
  container: MedusaContainer,
  opts: { tenantId: string; idleSinceMinutes: number; limit: number }
): Promise<{ enrolled: number }> => {
  const mk: any = container.resolve(MARKETING_MODULE)
  const tenantId = opts.tenantId
  let enrolled = 0

  let carts: any[] = []
  try {
    const gateway = getCommerceGateway(container)
    carts = await gateway.listAbandonedCarts(tenantId, {
      idleSinceMinutes: opts.idleSinceMinutes,
      limit: opts.limit,
    })
  } catch {
    return { enrolled }
  }

  for (const cart of carts ?? []) {
    try {
      const cartId = cart?.id
      const email = cart?.email
      if (!cartId || !email) {
        continue
      }

      // Skip carts already enrolled (unique per (tenant, cart)).
      const existing = await mk.listMarketingCartRecoveries({
        tenant_id: tenantId,
        cart_id: cartId,
      })
      if (Array.isArray(existing) && existing.length > 0) {
        continue
      }

      // Best-effort find-or-create the contact behind this email.
      let contactId: string | null = null
      try {
        const contacts = await mk.listMarketingContacts(
          { tenant_id: tenantId, email },
          { take: 1 }
        )
        const found = Array.isArray(contacts) ? contacts[0] : null
        if (found?.id) {
          contactId = found.id
        } else {
          const created = await mk.createMarketingContacts({
            tenant_id: tenantId,
            email,
            customer_id: cart?.customer_id ?? null,
            primary_channel: "email",
          } as any)
          const row = Array.isArray(created) ? created[0] : created
          contactId = row?.id ?? null
        }
      } catch {
        // Contact identity is best-effort — enroll without it if needed.
        contactId = null
      }

      await mk.createMarketingCartRecoveries({
        tenant_id: tenantId,
        cart_id: cartId,
        contact_id: contactId,
        email,
        customer_id: cart?.customer_id ?? null,
        step: 0,
        status: "active",
        next_run_at: new Date(),
        cart_total: cart?.total ?? null,
        currency_code: cart?.currency_code ?? null,
      } as any)
      enrolled += 1
    } catch {
      // Malformed/duplicate cart — skip and continue the rest.
      continue
    }
  }

  return { enrolled }
}

/** Per-row outcome for the sweep's counters. */
export type StepOutcome = "recovered" | "stepped" | "failed"

/**
 * Execute one recovery row end to end: reload the cart, and either mark it
 * recovered (order placed / cart gone) or send the next escalation email.
 * Returns the outcome for the caller's counters. Never throws.
 */
export const stepRecovery = async (
  container: MedusaContainer,
  row: any
): Promise<StepOutcome> => {
  const mk: any = container.resolve(MARKETING_MODULE)
  const tenantId = row?.tenant_id ?? currentTenantId()
  const now = new Date()

  try {
    // 1. Reload the cart. Missing or completed => the cart is recovered.
    let cart: any = null
    try {
      const gateway = getCommerceGateway(container)
      cart = await gateway.getCart(tenantId, row.cart_id)
    } catch {
      cart = null
    }

    if (!cart || cart.completed_at) {
      await mk.updateMarketingCartRecoveries({
        id: row.id,
        status: "recovered",
        recovered_at: now,
        next_run_at: null,
      } as any)
      return "recovered"
    }

    // 2. Advance to the next step (1/2/3) and build the resume link.
    const next = Number(row?.step ?? 0) + 1
    const storeUrl = await resolveStoreUrl(container, tenantId)
    let cartUrl = `${storeUrl}/recover?cart_id=${encodeURIComponent(
      row.cart_id
    )}`

    // 3. On the final step, mint a one-time incentive discount.
    let discountCode: string | undefined
    let discountText: string | undefined
    if (next >= 3) {
      try {
        const gateway = getCommerceGateway(container)
        const discount = await gateway.createRecoveryDiscount(tenantId, {
          percentage: RECOVERY_DISCOUNT_PCT,
          expiresInHours: DISCOUNT_EXPIRES_HOURS,
          currencyCode: row?.currency_code ?? undefined,
          codePrefix: "COMEBACK",
        })
        if (discount?.code) {
          discountCode = discount.code
          cartUrl += `&code=${encodeURIComponent(discount.code)}`
          discountText = `${RECOVERY_DISCOUNT_PCT}% off — expires in ${DISCOUNT_EXPIRES_HOURS}h`
        }
      } catch {
        // Promotions unavailable — send the final email without a code.
      }
    }

    // 4. Render the escalation email.
    const brandName = await resolveBrandName(container, tenantId)
    const { subject, html } = cartRecoveryEmail({
      brandName,
      step: next as 1 | 2 | 3,
      items: (cart.items ?? []).map((item: any) => ({
        title: item?.title ?? "",
        image: item?.thumbnail ?? undefined,
        price: formatPrice(item?.unit_price, cart?.currency_code),
      })),
      cartUrl,
      discountCode,
      discountText,
    })

    // 5. Send (tracked + recorded by the send-service).
    const sendResult = await sendEmail(container, {
      tenantId,
      to: row.email,
      contactId: row?.contact_id ?? null,
      subject,
      html,
      campaignId: "cart_recovery",
    })

    // 6a. Send failed => bounded backoff / exhaust attempts.
    if (!sendResult.ok) {
      const attempts = Number(row?.attempts ?? 0) + 1
      const maxAttempts = Number(row?.max_attempts ?? 3)
      const canRetry = attempts < maxAttempts
      await mk.updateMarketingCartRecoveries({
        id: row.id,
        attempts,
        status: canRetry ? "active" : "failed",
        next_run_at: canRetry ? backoffFrom(now, attempts) : null,
        error: sendResult.error ?? "send failed",
      } as any)
      return "failed"
    }

    // 6b. Sent => advance. Re-arm the next step, or complete after step 3.
    await mk.updateMarketingCartRecoveries({
      id: row.id,
      step: next,
      last_email_send_id: sendResult.sendId ?? null,
      discount_code: discountCode ?? row?.discount_code ?? null,
      status: next >= 3 ? "completed" : "active",
      next_run_at:
        next < 3
          ? new Date(now.getTime() + STEP_HOURS * 60 * 60 * 1000)
          : null,
      error: null,
    } as any)
    return "stepped"
  } catch (e: any) {
    // Absolute backstop — mark the row failed without aborting the sweep.
    try {
      await mk.updateMarketingCartRecoveries({
        id: row.id,
        status: "failed",
        error: e?.message ? String(e.message) : "unexpected error",
        next_run_at: null,
      } as any)
    } catch {
      // Best-effort — leave it "processing"; the next sweep can heal it.
    }
    return "failed"
  }
}

/**
 * Run one recovery sweep. Double-gated (master flag + durable per-automation
 * toggle) and inert until both are on. Pass 1 enrolls idle carts; pass 2 claims
 * and steps due rows. Safe to call concurrently (claim-first). Never throws.
 */
export const runRecoverySweep = async (
  container: MedusaContainer,
  opts?: { now?: Date }
): Promise<RecoverySweepResult> => {
  const zero: RecoverySweepResult = {
    enrolled: 0,
    stepped: 0,
    recovered: 0,
    failed: 0,
  }

  const mk: any = container.resolve(MARKETING_MODULE)
  const settings = new SettingsService(container)

  // Gate 1 — master kill-switch.
  if (process.env.MARKETING_ENABLED !== "1") {
    return zero
  }
  // Gate 2 — durable per-automation toggle (defaults OFF).
  try {
    const enabled = await settings.get<boolean>(currentTenantId(), AUTOMATION_KEY, false)
    if (enabled !== true) {
      return zero
    }
  } catch {
    // Fail-safe: a settings lookup error keeps the automation inert.
    return zero
  }

  const now = opts?.now ?? new Date()
  const result: RecoverySweepResult = { ...zero }

  // Pass 1 — enroll idle abandoned carts.
  const { enrolled } = await enrollAbandonedCarts(container, {
    tenantId: currentTenantId(),
    idleSinceMinutes: IDLE_MIN,
    limit: ENROLL_BATCH,
  })
  result.enrolled = enrolled

  // Pass 2 — find DUE active rows (next_run_at <= now), claim, then step.
  let active: any[] = []
  try {
    active = await mk.listMarketingCartRecoveries({
      tenant_id: currentTenantId(),
      status: "active",
    })
  } catch {
    active = []
  }

  const due = (active ?? [])
    .filter((r) => {
      const nra = r?.next_run_at ? new Date(r.next_run_at).getTime() : 0
      return nra <= now.getTime()
    })
    .slice(0, STEP_BATCH)

  for (const row of due) {
    // CLAIM the row first (claim-then-work — mirrors the publish runner).
    try {
      await mk.updateMarketingCartRecoveries({
        id: row.id,
        status: "processing",
      } as any)
    } catch {
      // Lost the claim (deleted / raced) — skip it.
      continue
    }

    // Work the row; a throw is a failed row and does not abort the sweep.
    try {
      const outcome = await stepRecovery(container, row)
      if (outcome === "recovered") {
        result.recovered += 1
      } else if (outcome === "stepped") {
        result.stepped += 1
      } else {
        result.failed += 1
      }
    } catch {
      result.failed += 1
    }
  }

  return result
}

/**
 * Mark any active/processing recovery rows for `email` as recovered — called
 * when an order is placed so the sequence stops immediately. Never throws.
 */
export const markRecoveredByEmail = async (
  container: MedusaContainer,
  tenantId: string,
  email: string
): Promise<void> => {
  if (!email) {
    return
  }
  const mk: any = container.resolve(MARKETING_MODULE)
  const now = new Date()

  try {
    const rows = await mk.listMarketingCartRecoveries({
      tenant_id: tenantId,
      email,
      status: ["active", "processing"],
    })
    for (const row of rows ?? []) {
      try {
        await mk.updateMarketingCartRecoveries({
          id: row.id,
          status: "recovered",
          recovered_at: now,
          next_run_at: null,
        } as any)
      } catch {
        // Best-effort per row.
      }
    }
  } catch {
    // Never throw out of the recovery marker.
  }
}

export default runRecoverySweep
