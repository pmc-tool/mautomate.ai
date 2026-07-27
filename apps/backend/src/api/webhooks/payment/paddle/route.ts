import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PaddleGateway, PLAN_BILLING_MONTHS } from "../../../../modules/platform/billing/paddle"
import { notifyMerchant } from "../../../../modules/platform/notify"

import { getLedger } from "../../../../modules/platform/credits/metering"
import {
  gatewayForCountry,
  webhookIdempotencyKey,
} from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { TIERS, CREDIT_USD } from "../../../../modules/platform/pricing/price-book"
import { accruePartnerCommission } from "../../../../modules/platform/partners/commission"
import { grantMerchantReferralReward } from "../../../../modules/platform/partners/merchant-referral"
import { fulfillMobileAppPublish } from "../../../../modules/platform/mobile-app/fulfill"
import { provisionTenantWorkflow } from "../../../../workflows/platform/provision-tenant"

/**
 * Multi-store M2: provision a PAID additional store and link it to its owner.
 * Runs only from the signed webhook (paid-first). Idempotent: if the slug's
 * tenant already exists it re-links ownership instead of failing, so Paddle
 * retries are harmless. The store starts on the "growth" package (plan
 * decision 2026-07-27: extra stores get Grow-level entitlements + credits).
 */
async function provisionAddonStore(
  scope: any,
  addon: {
    owner_merchant_id: string
    slug: string
    name: string
    subscription_id?: string
    /** webhook idempotency key — scopes the renewal credit grant */
    event_idem?: string
  }
): Promise<{ ok: boolean; tenant_id?: string; error?: string }> {
  const svc: any = scope.resolve(PLATFORM_MODULE)
  if (!addon.owner_merchant_id || !addon.slug) {
    return { ok: false, error: "addon_store payload missing owner or slug" }
  }

  const link = async (tenantId: string) => {
    const existing = await svc
      .listMerchantStores(
        { merchant_id: addon.owner_merchant_id, tenant_id: tenantId },
        { take: 1 }
      )
      .catch(() => [])
    if (!(Array.isArray(existing) ? existing : [existing]).filter(Boolean).length) {
      await svc.createMerchantStores([
        {
          merchant_id: addon.owner_merchant_id,
          tenant_id: tenantId,
          role: "owner",
        },
      ])
    }
  }

  // Replay/idempotency: the store may already exist from a prior delivery —
  // which is ALSO the monthly renewal case (recurring transactions carry the
  // same custom_data). A renewal re-grants the store's monthly allowance
  // (1,500 Grow-level credits, expiring with the period), idempotent on the
  // Paddle event id so retries can never double-grant.
  const [existingTenant] = await svc
    .listTenants({ slug: addon.slug }, { take: 1 })
    .catch(() => [])
  if (existingTenant?.id) {
    await link(existingTenant.id)
    if (addon.event_idem) {
      await getLedger(scope)
        .credit(existingTenant.id, 1500, {
          type: "grant",
          source: "plan",
          expiresAt: new Date(Date.now() + 35 * 86400_000),
          idempotencyKey: addon.event_idem,
          meta: { reason: "addon_store_allowance" },
        })
        .catch(() => undefined)
    }
    return { ok: true, tenant_id: existingTenant.id }
  }

  // Inherit the owner's country/currency defaults (their primary store's).
  let ownerCountry: string | undefined
  try {
    const owner = await svc.retrieveMerchant(addon.owner_merchant_id)
    const primary = await svc.retrieveTenant(owner.tenant_id)
    ownerCountry = primary?.billing_country ?? undefined
  } catch {
    ownerCountry = undefined
  }

  const growCredits = 1500
  const { result, errors } = await provisionTenantWorkflow(scope).run({
    input: {
      slug: addon.slug,
      name: addon.name || addon.slug,
      package: "growth",
      trial_credits: growCredits,
      billing_country: ownerCountry,
    },
    throwOnError: false,
  })
  if (errors?.length) {
    return {
      ok: false,
      error: errors.map((e: any) => String(e?.error?.message ?? e?.error ?? e)).join("; "),
    }
  }
  const tenantId = (result as any)?.tenant_id
  if (!tenantId) return { ok: false, error: "provisioning returned no tenant_id" }

  await link(tenantId)
  await svc
    .updateTenants({
      id: tenantId,
      status: "live",
      meta: {
        addon_store: true,
        paddle_subscription_id: addon.subscription_id ?? null,
        owner_merchant_id: addon.owner_merchant_id,
      },
    })
    .catch(() => undefined)
  return { ok: true, tenant_id: tenantId }
}

/**
 * The one place money turns into credits.
 *
 *   checkout.session.completed  — a top-up was paid  → PURCHASED credits (never expire)
 *                               — or a subscription started → activate plan + grant allowance
 *   invoice.paid                — the monthly renewal → grant next period's allowance
 *   invoice.payment_failed      — card declined       → past_due (the FSM takes it from there)
 *   customer.subscription.deleted — cancelled         → back to free_trial
 *
 * Everything is idempotent on Stripe's event id: a retried webhook can never
 * double-grant credits.
 */

const planFor = (key?: string) => TIERS.find((t) => t.key === key)

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const rawBody = (req as any).rawBody as Buffer | string | undefined
  if (!rawBody) {
    return res.status(400).json({ message: "raw body required for signature verification" })
  }

  const cfg = new EncryptedConfigService(req.scope)
  const gateway = new PaddleGateway(cfg)
  const result = await gateway.parseWebhook(
    Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody,
    Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v ?? "")]))
  )

  if (!result.ok) {
    return res.status(400).json({ message: result.error || "webhook_parse_failed" })
  }

  const event = result.data!
  const idem = webhookIdempotencyKey({
    provider: event.provider,
    external_event_id: event.external_event_id,
  })
  const ledger = getLedger(req.scope)
  const platform: any = req.scope.resolve(PLATFORM_MODULE)

  const tenantOf = async (id?: string) => {
    if (!id) return null
    const [t] = await platform.listTenants({ id }, { take: 1 })
    return t ?? null
  }

  /** Activate/renew a plan: set the package, the period, and grant the allowance. */
  const applyPlan = async (
    tenantId: string,
    planKey: string | undefined,
    periodEnd: Date | undefined,
    subMeta: { customer?: string; subscription?: string },
    // Months paid in this cycle (1 | 6 | 12). The per-month allowance is
    // granted for the whole paid period upfront and expires with it.
    months = 1
  ) => {
    const tier = planFor(planKey)
    if (!tier) return { granted: 0 }

    const tenant = await tenantOf(tenantId)
    // Plan credits EXPIRE at the end of the paid period. Purchased credits are
    // a different lot and are never touched by this.
    const expiresAt =
      periodEnd ?? new Date(Date.now() + 31 * Math.max(1, months) * 86400_000)

    await platform.updateTenants({
      id: tenantId,
      package: tier.key,
      status: "live",
      meta: {
        ...(tenant?.meta ?? {}),
        stripe_customer_id: subMeta.customer ?? tenant?.meta?.stripe_customer_id,
        stripe_subscription_id: subMeta.subscription ?? tenant?.meta?.stripe_subscription_id,
        current_period_end: expiresAt.toISOString(),
      },
    })

    // Allowance comes from the LIVE package row (the enforced catalog the
    // pricing pages show), not price-book TIERS - that stale list carried
    // pre-rebrand amounts and silently over-granted (growth: 5,000 vs the
    // advertised 1,500; scale: 35,000 vs 10,000).
    let perMonthCredits = tier.included_credits
    try {
      const [pkg] = await platform.listPlatformPackages(
        { key: tier.key },
        { take: 1 }
      )
      if (pkg?.included_credits != null) {
        perMonthCredits = Number(pkg.included_credits)
      }
    } catch {
      /* fall back to TIERS */
    }
    const grantCredits = perMonthCredits * Math.max(1, months)
    await ledger.credit(tenantId, grantCredits, {
      type: "grant",
      source: "plan",
      expiresAt,
      idempotencyKey: idem, // one grant per Stripe event, ever
      meta: { reason: "plan_allowance", plan: tier.key, period_end: expiresAt.toISOString() },
    })

    // Multi-store lifecycle: INCLUDED stores (created free under Scale) are
    // paid for by THIS subscription. On a Scale payment they get their
    // monthly Grow-level allowance and are revived if a downgrade paused
    // them; on a non-Scale payment (downgrade) they pause via the existing
    // suspended flow - data kept, storefront offline. Paid $49 add-on
    // stores are untouched: they carry their own subscription.
    try {
      const [ownerMerchant] = await platform.listMerchants(
        { tenant_id: tenantId },
        { take: 1 }
      )
      if (ownerMerchant?.id) {
        const grants = await platform.listMerchantStores(
          { merchant_id: ownerMerchant.id },
          { take: 50 }
        )
        for (const g of Array.isArray(grants) ? grants : []) {
          if (!g || g.tenant_id === tenantId) continue
          const t = await platform.retrieveTenant(g.tenant_id).catch(() => null)
          if (!t?.meta?.included_with_plan) continue
          if (tier.key === "scale") {
            await ledger
              .credit(t.id, 1500, {
                type: "grant",
                source: "plan",
                expiresAt,
                idempotencyKey: `${idem}:incl:${t.id}`,
                meta: { reason: "included_store_allowance" },
              })
              .catch(() => undefined)
            if (t.status === "suspended" && t.meta?.paused_reason === "scale_downgraded") {
              // jsonb meta MERGES on update - deleting a key client-side is a
              // no-op, so the flag must be nulled explicitly.
              await platform
                .updateTenants({
                  id: t.id,
                  status: "live",
                  meta: { ...(t.meta ?? {}), paused_reason: null },
                })
                .catch(() => undefined)
            }
          } else if (t.status === "live") {
            await platform
              .updateTenants({
                id: t.id,
                status: "suspended",
                meta: { ...(t.meta ?? {}), paused_reason: "scale_downgraded" },
              })
              .catch(() => undefined)
          }
        }
      }
    } catch {
      /* lifecycle sweep is best-effort; the next payment retries it */
    }

    return { granted: grantCredits }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        if (!event.tenant_id) break

        // A one-off card purchase that is NOT credits (a domain). The money is
        // in — now, and only now, do we spend real money at the registrar.
        if (
          (event.purchase_kind === "domain" ||
            event.purchase_kind === "domain_transfer") &&
          event.purchase_ref
        ) {
          const { fulfillDomainOrder } = await import(
            "../../../../modules/domains/fulfill"
          )
          const out = await fulfillDomainOrder(req.scope, event.purchase_ref)
          return res.status(200).json({
            received: true,
            processed: out.ok,
            kind: "domain_purchase",
            domain: out.domain,
            error: out.ok ? undefined : out.error,
          })
        }
        // A paid done-for-you app-store publishing service. Verify the amount
        // Stripe VERIFIED against the tier constant (never client metadata) and
        // record the paid publish order for ops. Idempotent on the order + event.
        if (event.purchase_kind === "mobile_app_publish" && event.purchase_ref) {
          const out = await fulfillMobileAppPublish(req.scope, {
            ref: event.purchase_ref,
            amountPaidUsd: event.amount_paid_usd,
            eventId: event.external_event_id,
            tenantId: event.tenant_id,
          })
          return res.status(200).json({
            received: true,
            processed: out.ok,
            kind: "mobile_app_publish",
            order_id: out.order_id,
            tier: out.tier,
            error: out.ok ? undefined : out.error,
          })
        }
        // Multi-store M2: a PAID additional store — provision it now, never
        // before. Idempotent: a replayed event finds the slug taken and links
        // ownership again harmlessly.
        if ((event as any).purchase_kind === "addon_store" && (event as any).addon_store) {
          const addon = (event as any).addon_store as {
            owner_merchant_id: string
            slug: string
            name: string
            subscription_id?: string
          }
          const out = await provisionAddonStore(req.scope, { ...addon, event_idem: idem })
          return res.status(200).json({
            received: true,
            processed: out.ok,
            kind: "addon_store",
            tenant_id: out.tenant_id,
            error: out.ok ? undefined : out.error,
          })
        }

        // A subscription checkout carries a plan; a top-up carries credits.
        if (event.plan_key) {
          const { granted } = await applyPlan(
            event.tenant_id,
            event.plan_key,
            event.period_end,
            {
              customer: event.stripe_customer_id,
              subscription: event.stripe_subscription_id,
            },
            PLAN_BILLING_MONTHS[(event as any).billing ?? ""] ?? 1
          )
          await accruePartnerCommission(req.scope, {
            tenantId: event.tenant_id,
            source: "subscription",
            sourceRef: idem,
            baseCents: Math.round(((event.amount_paid_usd ?? planFor(event.plan_key)?.price_usd) ?? 0) * 100),
            meta: { plan: event.plan_key },
          }).catch(() => undefined)
          await grantMerchantReferralReward(req.scope, {
            tenantId: event.tenant_id,
            sourceRef: idem,
          }).catch(() => undefined)
          await notifyMerchant(req.scope, { tenantId: event.tenant_id, template: "subscription_activated", data: { plan: event.plan_key, includedCredits: granted, amountUsd: planFor(event.plan_key)?.price_usd, period: (event as any).billing === "yearly" ? "yr" : (event as any).billing === "6months" ? "6 mo" : "mo" } }).catch(() => {})
          return res.status(200).json({
            received: true,
            processed: true,
            kind: "subscription_started",
            plan: event.plan_key,
            credits: granted,
          })
        }
        if (event.credits) {
          // SECURITY INVARIANT (top-up underpayment, P1): `event.credits` only
          // FLAGS this as a top-up session; the credits actually GRANTED are
          // derived from the amount Stripe VERIFIED was paid
          // (event.amount_paid_usd, from session.amount_total), NEVER from the
          // client-influenced metadata credits/amount_usd. So a session forged
          // with metadata.credits=1,000,000 while paying $1 grants only 100
          // credits. 1 credit = CREDIT_USD → credits = round(paid_usd / CREDIT_USD).
          const paidUsd = Number(event.amount_paid_usd ?? 0)
          const grantedCredits =
            paidUsd > 0 ? Math.round(paidUsd / CREDIT_USD) : 0
          if (grantedCredits <= 0) {
            // No verified charge → grant nothing (fail-closed).
            return res.status(200).json({
              received: true,
              processed: false,
              kind: "topup",
              reason: "no_verified_amount",
            })
          }
          await ledger.credit(event.tenant_id, grantedCredits, {
            type: "topup",
            source: "topup", // PURCHASED — never expires
            idempotencyKey: idem,
            meta: { description: `Stripe top-up ($${paidUsd})` },
          })
          await accruePartnerCommission(req.scope, {
            tenantId: event.tenant_id,
            source: "topup",
            sourceRef: idem,
            baseCents: Math.round(paidUsd * 100),
            meta: { credits: grantedCredits },
          }).catch(() => undefined)
          await grantMerchantReferralReward(req.scope, {
            tenantId: event.tenant_id,
            sourceRef: idem,
          }).catch(() => undefined)
          await notifyMerchant(req.scope, { tenantId: event.tenant_id, template: "topup_receipt", data: { amountUsd: paidUsd, creditsAdded: grantedCredits } }).catch(() => {})
          return res.status(200).json({
            received: true,
            processed: true,
            kind: "topup",
            credits: grantedCredits,
          })
        }
        break
      }

      case "invoice.paid": {
        if (!event.tenant_id) break
        const { granted } = await applyPlan(
          event.tenant_id,
          event.plan_key,
          event.period_end,
          {
            customer: event.stripe_customer_id,
            subscription: event.stripe_subscription_id,
          },
          PLAN_BILLING_MONTHS[(event as any).billing ?? ""] ?? 1
        )
        await accruePartnerCommission(req.scope, {
          tenantId: event.tenant_id,
          source: "renewal",
          sourceRef: idem,
          baseCents: Math.round(((event.amount_paid_usd ?? planFor(event.plan_key)?.price_usd) ?? 0) * 100),
          meta: { plan: event.plan_key },
        }).catch(() => undefined)
        await grantMerchantReferralReward(req.scope, {
          tenantId: event.tenant_id,
          sourceRef: idem,
        }).catch(() => undefined)
        await notifyMerchant(req.scope, { tenantId: event.tenant_id, template: "renewal_receipt", data: { plan: event.plan_key, amountUsd: planFor(event.plan_key)?.price_usd, includedCredits: granted } }).catch(() => {})
        return res.status(200).json({
          received: true,
          processed: true,
          kind: "renewal",
          credits: granted,
        })
      }

      case "invoice.payment_failed": {
        if (!event.tenant_id) break
        // Don't cut them off mid-sentence — the lifecycle FSM handles the grace
        // period. We only mark the state.
        await platform.updateTenants({ id: event.tenant_id, status: "past_due" })
        await notifyMerchant(req.scope, { tenantId: event.tenant_id, template: "payment_failed", data: { plan: event.plan_key } }).catch(() => {})
        return res.status(200).json({ received: true, processed: true, kind: "payment_failed" })
      }

      case "customer.subscription.deleted": {
        // Multi-store M2: cancelling an ADDON store pauses that store only —
        // via the existing suspended flow (storefront serves the offline
        // page). Data is retained; the payer's primary plan is untouched.
        if ((event as any).purchase_kind === "addon_store") {
          const slug = String((event as any).addon_store?.slug ?? "")
          if (slug) {
            const [addonTenant] = await platform
              .listTenants({ slug }, { take: 1 })
              .catch(() => [])
            if (addonTenant?.id) {
              await platform.updateTenants({
                id: addonTenant.id,
                status: "suspended",
                meta: {
                  ...(addonTenant.meta ?? {}),
                  paused_reason: "addon_subscription_cancelled",
                  cancelled_at: new Date().toISOString(),
                },
              })
            }
          }
          return res
            .status(200)
            .json({ received: true, processed: true, kind: "addon_store_cancelled" })
        }
        if (!event.tenant_id) break
        const tenant = await tenantOf(event.tenant_id)
        // Cancelling the main plan also pauses any Scale-included stores it
        // was funding (data kept; paid $49 add-ons keep their own sub).
        try {
          const [ownerMerchant] = await platform.listMerchants(
            { tenant_id: event.tenant_id },
            { take: 1 }
          )
          if (ownerMerchant?.id) {
            const grants = await platform.listMerchantStores(
              { merchant_id: ownerMerchant.id },
              { take: 50 }
            )
            for (const g of Array.isArray(grants) ? grants : []) {
              if (!g || g.tenant_id === event.tenant_id) continue
              const t = await platform.retrieveTenant(g.tenant_id).catch(() => null)
              if (t?.meta?.included_with_plan && t.status === "live") {
                await platform
                  .updateTenants({
                    id: t.id,
                    status: "suspended",
                    meta: { ...(t.meta ?? {}), paused_reason: "scale_downgraded" },
                  })
                  .catch(() => undefined)
              }
            }
          }
        } catch {
          /* best-effort */
        }
        await platform.updateTenants({
          id: event.tenant_id,
          package: "free_trial",
          meta: {
            ...(tenant?.meta ?? {}),
            stripe_subscription_id: null,
            cancelled_at: new Date().toISOString(),
          },
        })
        // Purchased credits survive a cancellation — they were paid for.
        return res.status(200).json({ received: true, processed: true, kind: "cancelled" })
      }
    }
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "webhook_apply_failed" })
  }

  res.status(200).json({ received: true, processed: false, type: event.type })
}
