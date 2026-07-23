import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PLATFORM_MODULE } from "../../../modules/platform"
import { validateSlug } from "../../../modules/platform/abuse/quota"
import { provisionTenantWorkflow } from "../../../workflows/platform/provision-tenant"
import { createMerchantIdentity } from "../_provision-helpers"
import jwt from "jsonwebtoken"
import { notifyMerchant } from "../../../modules/platform/notify"
import { attributeSignupReferral } from "../../../modules/platform/partners/merchant-referral"
import { gatewayForCountry } from "../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../modules/platform/secure-config"

/**
 * POST /platform/signup — public self-serve store creation (shared-pooled model).
 *
 * Every tenant lives in the SAME Medusa backend, isolated by sales channel +
 * publishable API key. No per-tenant instance, database, or process is created,
 * so provisioning is fast (~2-5s) and cost is flat regardless of tenant count.
 *
 * TRIAL / CARD-FIRST BILLING:
 * If the visitor picks a PAID plan, we DO NOT hand them the paid plan for free.
 * The store is provisioned on `free_trial`, and `admin_url` is pointed at the
 * Paddle checkout for that plan's 7-day trial (card captured, $0 charged now,
 * the plan price auto-charged after 7 days). The paid plan is only applied when
 * Paddle confirms the card (webhook → applyPlan). If the visitor abandons the
 * card step they simply remain on the free trial — never a free paid plan.
 * Picking the free plan keeps the old cardless straight-to-dashboard flow.
 */
const ROOT = process.env.PLATFORM_ROOT_DOMAIN ?? "mautomate.ai"
const PACKAGES = ["free_trial", "starter", "growth", "pro", "scale"]
const TRIAL_DAYS = 7
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const recent = new Map<string, number[]>()
const PER_IP_HOUR = 5

const cors = (res: MedusaResponse) => {
  res.setHeader("Access-Control-Allow-Origin", `https://${ROOT}`)
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

export const OPTIONS = async (_req: MedusaRequest, res: MedusaResponse) => {
  cors(res)
  res.status(204).end()
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  cors(res)
  if (process.env.SIGNUP_ENABLED !== "true") {
    return res.status(404).json({ message: "signup is not open yet" })
  }

  const ip = String((req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? "unknown").trim()
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3600_000)
  if (hits.length >= PER_IP_HOUR) {
    return res.status(429).json({ message: "too many signups — try again later" })
  }

  const body = (req.body ?? {}) as any
  const slugCheck = validateSlug(String(body.slug ?? ""))
  if (!slugCheck.ok) {
    return res.status(400).json({ message: `invalid store address (${slugCheck.reason})` })
  }
  const slug = slugCheck.slug
  const name = String(body.name || slug).slice(0, 60)
  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const pkg = PACKAGES.includes(String(body.package)) ? String(body.package) : "free_trial"

  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "a valid email is required" })
  if (password.length < 8) return res.status(400).json({ message: "password must be at least 8 characters" })

  const svc = req.scope.resolve(PLATFORM_MODULE) as any

  const [taken, domainTaken, emailTaken] = await Promise.all([
    svc.listTenants({ slug }, { take: 1 }),
    svc.listTenantDomains({ domain: `${slug}.${ROOT}` }, { take: 1 }),
    svc.listMerchants({ email }),
  ])
  if (taken?.length || domainTaken?.length) {
    return res.status(409).json({ message: `${slug}.${ROOT} is already taken` })
  }
  if (emailTaken?.length) {
    return res.status(409).json({ message: `an account with ${email} already exists` })
  }

  // Look up the chosen plan (price + name) and the free-trial baseline credits.
  let planPriceUsd = 0
  let planName = pkg
  try {
    const [p] = await svc.listPlatformPackages({ key: pkg, active: true }, { take: 1 })
    if (p?.price_usd != null) planPriceUsd = Number(p.price_usd)
    if (p?.name) planName = String(p.name)
  } catch {}

  const isPaidPlan = planPriceUsd > 0

  // Credits granted at provision time. A paid plan is provisioned on free_trial
  // (card-first), so it gets the free-trial allowance now; the full plan
  // allowance is granted by the payment webhook once the card is captured.
  let provisionCredits = 300
  try {
    const [fp] = await svc.listPlatformPackages(
      { key: isPaidPlan ? "free_trial" : pkg, active: true },
      { take: 1 }
    )
    if (fp?.included_credits != null) provisionCredits = Number(fp.included_credits)
  } catch {}

  const provisionPkg = isPaidPlan ? "free_trial" : pkg

  recent.set(ip, [...hits, now])

  // Run provisioning synchronously: the request scope is not safe to use after
  // the response is sent, and the in-memory bus cannot reliably queue work.
  const { result, errors } = await provisionTenantWorkflow(req.scope).run({
    input: { slug, name, package: provisionPkg, trial_credits: provisionCredits },
    throwOnError: false,
  })

  if (errors?.length) {
    return res.status(500).json({
      message: "provisioning failed",
      errors: errors.map((e: any) => String(e?.error?.message ?? e?.error ?? e)),
    })
  }

  const tenantId = (result as any)?.tenant_id
  if (!tenantId) {
    return res.status(500).json({ message: "provisioning returned no tenant_id" })
  }

  // Partner referral attribution (?ref=CODE forwarded by the signup form).
  // Best-effort: a bad code must never fail a signup.
  const refCode = String(body.ref ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
  if (refCode) {
    try {
      await attributeSignupReferral(req.scope, { code: refCode, tenantId, email })
    } catch {}
  }

  const identity = await createMerchantIdentity(req.scope, { tenantId, email, password, name })
  if (!identity.ok) {
    await svc.updateTenants({ id: tenantId, status: "failed" }).catch(() => undefined)
    return res.status(500).json({
      message: "store created, but merchant account creation failed",
      error: identity.error,
    })
  }

  await svc.updateTenants({
    id: tenantId,
    trial_ends_at: new Date(now + TRIAL_DAYS * 864e5),
  })

  const tenant = await svc.retrieveTenant(tenantId).catch(() => null)
  await notifyMerchant(req.scope, {
    tenantId,
    to: email,
    merchantName: name,
    template: "welcome",
    data: { plan: isPaidPlan ? `${planName} (7-day trial)` : "free trial", trialDays: TRIAL_DAYS },
  }).catch(() => {})

  // Mint a short-lived session for the NEW store's merchant and hand it off in
  // the admin URL (#imp=), so "go to admin" always opens THIS store's dashboard
  // and never inherits a stale session from another store in the same browser.
  const sessionToken = jwt.sign(
    {
      actor_id: identity.merchant_id,
      actor_type: "merchant",
      auth_provider: "emailpass",
      app_metadata: { email, merchant_id: identity.merchant_id },
      user_metadata: {},
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "30m" }
  )

  const dashboardUrl = `https://merchant.${ROOT}/dashboard/overview#imp=${encodeURIComponent(
    sessionToken
  )}`

  // For a PAID plan: send the visitor to the Paddle 7-day-trial checkout FIRST
  // (card captured, $0 now). The `imp` token rides along so the checkout page
  // logs them into THIS store's dashboard after the card is confirmed. If the
  // gateway is down we fall back to the dashboard rather than blocking signup.
  let adminUrl = dashboardUrl
  let checkoutUrl: string | null = null
  if (isPaidPlan) {
    try {
      const cfg = new EncryptedConfigService(req.scope)
      const gateway = gatewayForCountry((tenant as any)?.billing_country ?? "US", cfg)
      if ((await gateway.isConfigured()) && gateway.createSubscriptionCheckout) {
        const out = await gateway.createSubscriptionCheckout({
          tenant_id: tenantId,
          plan_key: pkg,
          plan_name: planName,
          amount_usd: planPriceUsd,
          success_url: `https://merchant.${ROOT}/dashboard/overview`,
          cancel_url: `https://merchant.${ROOT}/dashboard/billing`,
        })
        if (out.ok && out.data?.url) {
          const sep = out.data.url.includes("?") ? "&" : "?"
          checkoutUrl = `${out.data.url}${sep}imp=${encodeURIComponent(sessionToken)}`
          adminUrl = checkoutUrl
        }
      }
    } catch {}
  }

  res.status(201).json({
    slug,
    name,
    email,
    status: tenant?.status ?? "live",
    store_url: `https://${slug}.${ROOT}`,
    admin_url: adminUrl,
    checkout_url: checkoutUrl,
    dashboard_url: dashboardUrl,
    trial_days: TRIAL_DAYS,
    requires_card: isPaidPlan,
    plan: pkg,
    merchant_login_url: `https://merchant.${ROOT}`,
    tenant_id: tenantId,
    merchant_id: identity.merchant_id,
    publishable_key: tenant?.publishable_key ?? null,
  })
}
