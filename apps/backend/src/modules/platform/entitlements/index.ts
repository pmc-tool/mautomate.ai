/**
 * Entitlements — the single source of truth for what each plan may do.
 *
 * Three rails doctrine (monetization plan, 2026-07-26): subscriptions sell
 * capability + capacity, credits sell consumption, one-time card sells
 * services. This module answers ONLY the capability/capacity questions.
 *
 * Rules encoded here:
 *  - Deny by default: an unknown plan key resolves to trial-level access.
 *  - R6 asymmetry: gates on PAID tenants fail OPEN on infra errors; gates on
 *    trial tenants fail CLOSED.
 *  - Enforcement is per-gate switchable: ENTITLEMENTS_ENFORCE=1 turns every
 *    gate on; ENTITLEMENTS_ENFORCE_<KEY>=1|0 overrides a single gate either
 *    way. A gate that is not enforced LOGS the would-be denial and allows
 *    (shadow mode) — that log stream is the P1 acceptance evidence.
 *  - The platform_package row's products/seats/domains limits override the
 *    code matrix when set, so the super-admin package editor keeps working.
 */

export type PlanKey = "free_trial" | "starter" | "growth" | "pro" | "scale"

export type FeatureKey =
  | "ai_generation" // image / video / logo / ad-copy generation
  | "jarvis_voice" // live merchant voice (not the simulator)
  | "call_center_live" // Ava web voice, live
  | "call_center_phone" // real phone number attach
  | "ads" // launching ad campaigns (wizard preview is always allowed)
  | "ads_autopilot"
  | "whatsapp" // WhatsApp channel connect
  | "custom_domain"
  | "badge_removal"

export type LimitKey =
  | "products"
  | "seats"
  | "domains"
  | "social_accounts"
  | "messaging_channels"
  | "journeys_active"
  | "emails_month"
  | "storage_mb"
  | "scheduled_posts"

/** null = unlimited */
type Limits = Record<LimitKey, number | null>

type PlanEntitlements = { limits: Limits; features: FeatureKey[] }

const PLAN_ORDER: PlanKey[] = ["free_trial", "starter", "growth", "pro", "scale"]

export const PLAN_LABEL: Record<PlanKey, string> = {
  free_trial: "Free Trial",
  starter: "Launch",
  growth: "Grow",
  pro: "Pro",
  scale: "Scale",
}

const MATRIX: Record<PlanKey, PlanEntitlements> = {
  free_trial: {
    limits: {
      products: 25,
      seats: 1,
      domains: 0,
      social_accounts: 2,
      messaging_channels: 1,
      journeys_active: 1,
      emails_month: 50,
      storage_mb: 500,
      scheduled_posts: 10,
    },
    // ai_generation in trial is granted dynamically after the first credit
    // purchase (the $5 unlock, P2) — see resolveEntitlements.
    features: [],
  },
  starter: {
    limits: {
      products: 100,
      seats: 2,
      domains: 0,
      social_accounts: 3,
      messaging_channels: 2,
      journeys_active: 2,
      emails_month: 1_000,
      storage_mb: 5_120,
      scheduled_posts: null,
    },
    features: ["ai_generation"],
  },
  growth: {
    limits: {
      products: 1_000,
      seats: 5,
      domains: 1,
      social_accounts: 10,
      messaging_channels: null,
      journeys_active: 10,
      emails_month: 10_000,
      storage_mb: 25_600,
      scheduled_posts: null,
    },
    features: [
      "ai_generation",
      "jarvis_voice",
      "ads",
      "whatsapp",
      "custom_domain",
      "badge_removal",
    ],
  },
  pro: {
    limits: {
      products: 10_000,
      seats: 15,
      domains: 3,
      social_accounts: 25,
      messaging_channels: null,
      journeys_active: 30,
      emails_month: 50_000,
      storage_mb: 102_400,
      scheduled_posts: null,
    },
    features: [
      "ai_generation",
      "jarvis_voice",
      "ads",
      "ads_autopilot",
      "whatsapp",
      "custom_domain",
      "badge_removal",
      "call_center_live",
      "call_center_phone",
    ],
  },
  scale: {
    limits: {
      products: null,
      seats: null,
      domains: 10,
      social_accounts: null,
      messaging_channels: null,
      journeys_active: null,
      emails_month: 250_000,
      storage_mb: 512_000,
      scheduled_posts: null,
    },
    features: [
      "ai_generation",
      "jarvis_voice",
      "ads",
      "ads_autopilot",
      "whatsapp",
      "custom_domain",
      "badge_removal",
      "call_center_live",
      "call_center_phone",
    ],
  },
}

/** The cheapest plan that includes a feature — powers upsell payloads. */
export const requiredPlanFor = (feature: FeatureKey): PlanKey => {
  for (const key of PLAN_ORDER) {
    if (MATRIX[key].features.includes(feature)) return key
  }
  return "scale"
}

const requiredPlanForLimit = (limit: LimitKey, needed: number): PlanKey => {
  for (const key of PLAN_ORDER) {
    const v = MATRIX[key].limits[limit]
    if (v === null || v >= needed) return key
  }
  return "scale"
}

export const TRIAL_DAYS = 14
export const GRACE_DAYS = 7

/** Lifecycle state derived from package + clock (P2). */
export type TenantState = "trial" | "grace" | "paused" | "paid"

export type TrialInfo = {
  state: TenantState
  ends_at: string | null
  days_left: number | null
}

/**
 * Where the trial stands. The clock starts at tenant.created_at and can be
 * overridden by meta.trial_ends_at (used to give pre-existing trials a fresh
 * 14-day clock at rollout).
 */
export const trialInfo = (
  tenant: {
    package?: string | null
    created_at?: string | Date | null
    meta?: Record<string, any> | null
  },
  now: Date = new Date()
): TrialInfo => {
  if (tenant?.package && tenant.package !== "free_trial") {
    return { state: "paid", ends_at: null, days_left: null }
  }
  const override = tenant?.meta?.trial_ends_at
    ? new Date(tenant.meta.trial_ends_at)
    : null
  const created = tenant?.created_at ? new Date(tenant.created_at) : now
  const ends =
    override && !isNaN(override.getTime())
      ? override
      : new Date(created.getTime() + TRIAL_DAYS * 86_400_000)
  const graceEnds = new Date(ends.getTime() + GRACE_DAYS * 86_400_000)
  const state: TenantState =
    now < ends ? "trial" : now < graceEnds ? "grace" : "paused"
  const daysLeft = Math.max(
    0,
    Math.ceil((ends.getTime() - now.getTime()) / 86_400_000)
  )
  return { state, ends_at: ends.toISOString(), days_left: daysLeft }
}

export type Entitlements = {
  plan: PlanKey
  paid: boolean
  state: TenantState
  limits: Limits
  features: FeatureKey[]
}

/**
 * Resolve a tenant's entitlements from its package key. `tenant` is the row
 * resolveMerchant already loaded; `pkg` (optional) is the platform_package row
 * whose products/seats/domains columns override the matrix when set.
 *
 * opts.hasPurchasedCredits — the trial "$5 AI unlock": a trial tenant that has
 * bought credits at least once gains ai_generation (voice stays plan-gated,
 * per the three-rails rule). In grace/paused, AI features drop entirely.
 */
export const resolveEntitlements = (
  tenant: {
    package?: string | null
    created_at?: string | Date | null
    meta?: Record<string, any> | null
  },
  pkg?: {
    products_limit?: number | null
    seats_limit?: number | null
    domains_limit?: number | null
  } | null,
  opts?: { hasPurchasedCredits?: boolean; now?: Date }
): Entitlements => {
  const raw = String(tenant?.package ?? "")
  const plan: PlanKey = (PLAN_ORDER as string[]).includes(raw)
    ? (raw as PlanKey)
    : "free_trial" // deny by default
  const base = MATRIX[plan]
  const limits: Limits = { ...base.limits }
  if (pkg) {
    if (pkg.products_limit != null) limits.products = pkg.products_limit
    if (pkg.seats_limit != null) limits.seats = pkg.seats_limit
    if (pkg.domains_limit != null) limits.domains = pkg.domains_limit
  }
  const info = trialInfo(tenant, opts?.now)
  let features = [...base.features]
  if (plan === "free_trial") {
    if (info.state === "trial" && opts?.hasPurchasedCredits) {
      features.push("ai_generation")
    }
    if (info.state !== "trial") {
      // Grace/paused: build access remains (via routes that allow it), AI is off.
      features = []
    }
  }
  return { plan, paid: plan !== "free_trial", state: info.state, limits, features }
}

// ---------------------------------------------------------------- enforcement

/** Whether a specific gate is enforced (vs shadow/log-only). */
export const gateEnforced = (key: FeatureKey | LimitKey): boolean => {
  const per = process.env[`ENTITLEMENTS_ENFORCE_${key.toUpperCase()}`]
  if (per === "1") return true
  if (per === "0") return false
  return process.env.ENTITLEMENTS_ENFORCE === "1"
}

export type GateResult =
  | { allowed: true }
  | {
      allowed: false
      code: "entitlement_locked" | "limit_reached"
      feature?: FeatureKey
      limit?: LimitKey
      max?: number
      used?: number
      required_plan: PlanKey
      required_plan_label: string
      message: string
    }

const shadowLog = (
  tenantId: string,
  gate: string,
  detail: Record<string, unknown>
): void => {
  // The P1 acceptance signal: grep for [entitlement-shadow] after a week —
  // zero would-be denials for paying merchants means enforcement is safe.
  console.warn(
    `[entitlement-shadow] tenant=${tenantId} gate=${gate} would_deny ${JSON.stringify(detail)}`
  )
}

/**
 * Feature gate. In shadow mode a denial is logged and allowed. R6: this
 * function never throws — an internal error resolves to allow for paid
 * tenants and deny for trials (fail open for payers, closed for trials).
 */
export const checkFeature = (
  tenantId: string,
  ent: Entitlements,
  feature: FeatureKey
): GateResult => {
  try {
    if (ent.features.includes(feature)) return { allowed: true }
    const required = requiredPlanFor(feature)
    const denial: GateResult = {
      allowed: false,
      code: "entitlement_locked",
      feature,
      required_plan: required,
      required_plan_label: PLAN_LABEL[required],
      message: `This feature comes with the ${PLAN_LABEL[required]} plan. Upgrade to unlock it.`,
    }
    if (!gateEnforced(feature)) {
      shadowLog(tenantId, feature, { plan: ent.plan })
      return { allowed: true }
    }
    return denial
  } catch {
    return ent.paid
      ? { allowed: true }
      : {
          allowed: false,
          code: "entitlement_locked",
          feature,
          required_plan: "starter",
          required_plan_label: PLAN_LABEL.starter,
          message: "This feature needs a paid plan.",
        }
  }
}

/**
 * Capacity gate: may the tenant add one more (or `adding` more) of `limit`
 * given `used` existing? Same shadow/enforce + R6 semantics as checkFeature.
 */
export const checkLimit = (
  tenantId: string,
  ent: Entitlements,
  limit: LimitKey,
  used: number,
  adding = 1
): GateResult => {
  try {
    const max = ent.limits[limit]
    if (max === null || used + adding <= max) return { allowed: true }
    const required = requiredPlanForLimit(limit, used + adding)
    const denial: GateResult = {
      allowed: false,
      code: "limit_reached",
      limit,
      max,
      used,
      required_plan: required,
      required_plan_label: PLAN_LABEL[required],
      message: `Your ${PLAN_LABEL[ent.plan]} plan includes ${max} ${limit.replace(/_/g, " ")}. Upgrade to ${PLAN_LABEL[required]} for more.`,
    }
    if (!gateEnforced(limit)) {
      shadowLog(tenantId, limit, { plan: ent.plan, used, max })
      return { allowed: true }
    }
    return denial
  } catch {
    return ent.paid
      ? { allowed: true }
      : {
          allowed: false,
          code: "limit_reached",
          limit,
          required_plan: "starter",
          required_plan_label: PLAN_LABEL.starter,
          message: "This needs a paid plan.",
        }
  }
}

/** Standard 403 body for a denial — dashboards key off `code` to render the
 *  upgrade modal with the exact plan that fixes it. */
export const gatePayload = (denial: Exclude<GateResult, { allowed: true }>) => ({
  message: denial.message,
  code: denial.code,
  feature: denial.feature ?? null,
  limit: denial.limit ?? null,
  max: denial.max ?? null,
  used: denial.used ?? null,
  required_plan: denial.required_plan,
  required_plan_label: denial.required_plan_label,
})

// ---------------------------------------------------------- voice gate (P3)

/**
 * Live voice is subscription-gated, full stop (profit rule R3): no plan, no
 * live STT/TTS — trials get the simulator. Unlike other gates, the TRIAL
 * denial here is UNCONDITIONAL (not shadow-able): this is the explicit
 * business rule, and there are no paying customers on trial to false-positive.
 * PAID tiers below the feature's plan follow the normal shadow/enforce flags,
 * so existing sub-tier voice users are grandfathered until enforcement flips.
 */
export const checkVoiceGate = async (
  container: { resolve: (key: string) => any },
  tenantId: string,
  feature: Extract<
    FeatureKey,
    "jarvis_voice" | "call_center_live" | "call_center_phone"
  >
): Promise<GateResult> => {
  try {
    const svc: any = container.resolve("platform")
    const tenant = await svc.retrieveTenant(tenantId)
    const pkg =
      (
        await svc
          .listPlatformPackages({ key: tenant.package }, { take: 1 })
          .catch(() => [])
      )[0] ?? null
    const ent = resolveEntitlements(tenant, pkg)
    if (!ent.paid) {
      const required = requiredPlanFor(feature)
      return {
        allowed: false,
        code: "entitlement_locked",
        feature,
        required_plan: required,
        required_plan_label: PLAN_LABEL[required],
        message: `Live voice comes with the ${PLAN_LABEL[required]} plan. Watch the demo to see it in action, then upgrade to turn it on for real.`,
      }
    }
    return checkFeature(tenantId, ent, feature)
  } catch {
    // R6: a broken gate never takes live voice down for anyone paid; and if
    // we cannot even resolve the tenant, failing open is the lesser harm.
    return { allowed: true }
  }
}

// -------------------------------------------------- AI-generation gate (P2)

/**
 * The generation actions locked in trial until the first credit purchase
 * (the "$5 unlock"). Text/copy/page-edit actions stay open — they are the
 * cheap hook; these are the expensive ones.
 */
export const GENERATION_ACTIONS = new Set([
  "ai_image",
  "ai_video",
  "ai_logo",
  "ai_ad_campaign",
])

/**
 * Self-contained gate for AI generation, callable from ANY route that can
 * name the tenant (merchant routes AND editor-token CMS routes). Loads the
 * tenant + package + purchase history itself.
 *
 * R6: an internal error resolves to allow — a broken gate must never take
 * paid generation down; the trial leak in that failure mode costs cents.
 */
export const checkAiGeneration = async (
  container: { resolve: (key: string) => any },
  tenantId: string
): Promise<GateResult> => {
  try {
    const svc: any = container.resolve("platform")
    const tenant = await svc.retrieveTenant(tenantId)
    const pkg =
      (
        await svc
          .listPlatformPackages({ key: tenant.package }, { take: 1 })
          .catch(() => [])
      )[0] ?? null
    let hasPurchased = false
    if (tenant.package === "free_trial") {
      const lots = await svc
        .listCreditLots({ tenant_id: tenantId, source: "topup" }, { take: 1 })
        .catch(() => [])
      hasPurchased =
        (Array.isArray(lots) ? lots : [lots]).filter(Boolean).length > 0
    }
    const ent = resolveEntitlements(tenant, pkg, {
      hasPurchasedCredits: hasPurchased,
    })
    const gate = checkFeature(tenantId, ent, "ai_generation")
    if (!gate.allowed && ent.plan === "free_trial") {
      // Trial-specific upsell copy: the $5 unlock, not a plan pitch.
      return {
        ...gate,
        message:
          ent.state === "trial"
            ? "AI generation is locked during the trial. Add AI credits (from $5) to unlock it right away - your credits never expire."
            : "Your trial has ended - pick a plan to keep using AI features.",
      }
    }
    return gate
  } catch {
    return { allowed: true }
  }
}
