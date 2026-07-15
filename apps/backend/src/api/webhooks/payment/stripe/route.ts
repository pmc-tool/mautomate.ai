import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getLedger } from "../../../../modules/platform/credits/metering"
import {
  gatewayForCountry,
  webhookIdempotencyKey,
} from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { TIERS } from "../../../../modules/platform/pricing/price-book"

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
  const gateway = gatewayForCountry("US", cfg)
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
    subMeta: { customer?: string; subscription?: string }
  ) => {
    const tier = planFor(planKey)
    if (!tier) return { granted: 0 }

    const tenant = await tenantOf(tenantId)
    // Plan credits EXPIRE at the end of the paid period. Purchased credits are
    // a different lot and are never touched by this.
    const expiresAt = periodEnd ?? new Date(Date.now() + 31 * 86400_000)

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

    await ledger.credit(tenantId, tier.included_credits, {
      type: "grant",
      source: "plan",
      expiresAt,
      idempotencyKey: idem, // one grant per Stripe event, ever
      meta: { reason: "plan_allowance", plan: tier.key, period_end: expiresAt.toISOString() },
    })
    return { granted: tier.included_credits }
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
        // A subscription checkout carries a plan; a top-up carries credits.
        if (event.plan_key) {
          const { granted } = await applyPlan(event.tenant_id, event.plan_key, event.period_end, {
            customer: event.stripe_customer_id,
            subscription: event.stripe_subscription_id,
          })
          return res.status(200).json({
            received: true,
            processed: true,
            kind: "subscription_started",
            plan: event.plan_key,
            credits: granted,
          })
        }
        if (event.credits) {
          await ledger.credit(event.tenant_id, event.credits, {
            type: "topup",
            source: "topup", // PURCHASED — never expires
            idempotencyKey: idem,
            meta: { description: `Stripe top-up ($${event.amount_usd ?? "?"})` },
          })
          return res.status(200).json({
            received: true,
            processed: true,
            kind: "topup",
            credits: event.credits,
          })
        }
        break
      }

      case "invoice.paid": {
        if (!event.tenant_id) break
        const { granted } = await applyPlan(event.tenant_id, event.plan_key, event.period_end, {
          customer: event.stripe_customer_id,
          subscription: event.stripe_subscription_id,
        })
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
        return res.status(200).json({ received: true, processed: true, kind: "payment_failed" })
      }

      case "customer.subscription.deleted": {
        if (!event.tenant_id) break
        const tenant = await tenantOf(event.tenant_id)
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
