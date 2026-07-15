import type { MedusaContainer } from "@medusajs/framework/types"

import { PLATFORM_MODULE } from "../index"
import { PLAN_GATES } from "../pricing/price-book"

/**
 * Plan gates — what a tenant is ALLOWED to do, separate from what they can
 * afford.
 *
 * A trial with 200 credits could still rack up a real Twilio number rental and
 * a stream of SMS before the wallet ran dry, and every one of those is money we
 * actually pay out. So the expensive, abuse-prone channels are gated on the
 * PLAN, not just the balance:
 *
 *   trial   — no phone, no SMS. AI text/images only (what sells the product).
 *   starter — SMS yes, phone number no.
 *   growth+ — everything.
 *
 * The answer is always an honest reason plus the plan that unlocks it, never a
 * silent failure.
 */
export type GateFeature = "phone" | "sms"

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: string; upgrade_to: string }

const UNLOCKED_BY: Record<GateFeature, string> = {
  phone: "growth",
  sms: "starter",
}

const FEATURE_LABEL: Record<GateFeature, string> = {
  phone: "Phone numbers and phone calls",
  sms: "SMS messages",
}

export async function checkPlanGate(
  container: MedusaContainer,
  tenantId: string,
  feature: GateFeature
): Promise<GateResult> {
  let plan = "free_trial"
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const t = await svc.retrieveTenant(tenantId).catch(() => null)
    if (t?.package) plan = t.package
  } catch {
    /* unknown plan → treat as trial, the most restrictive */
  }

  const gates = PLAN_GATES[plan] ?? PLAN_GATES.free_trial
  if (gates[feature]) return { allowed: true }

  const upgrade = UNLOCKED_BY[feature]
  return {
    allowed: false,
    reason: `${FEATURE_LABEL[feature]} aren't included in your ${plan.replace(/_/g, " ")} plan. Upgrade to ${upgrade} to switch them on.`,
    upgrade_to: upgrade,
  }
}

/** Trial image cap — protects us from a trial burning $30 of Gemini. */
export async function checkImageQuota(
  container: MedusaContainer,
  tenantId: string
): Promise<GateResult> {
  let plan = "free_trial"
  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const t = await svc.retrieveTenant(tenantId).catch(() => null)
    if (t?.package) plan = t.package
  } catch {
    /* trial */
  }
  const cap = (PLAN_GATES[plan] ?? PLAN_GATES.free_trial).images
  if (cap === null) return { allowed: true }

  try {
    const svc: any = container.resolve(PLATFORM_MODULE)
    const used = await svc.listUsageEvents(
      { tenant_id: tenantId, action: ["ai_image", "ai_logo"] },
      { take: cap + 1 }
    )
    if ((used?.length ?? 0) >= cap) {
      return {
        allowed: false,
        reason: `Your trial includes ${cap} AI images and you've used them all. Upgrade to keep generating.`,
        upgrade_to: "starter",
      }
    }
  } catch {
    /* if we can't count, don't block a paying action */
  }
  return { allowed: true }
}
