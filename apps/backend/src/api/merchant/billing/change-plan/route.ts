import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { getLedger } from "../../../../modules/platform/credits/metering"
import { gatewayForCountry } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"

/**
 * POST /merchant/billing/change-plan  { key }
 *
 * Self-serve subscription change.
 *
 * PAID plans (price_usd > 0): NOTHING changes in our DB here. We open a real
 * Paddle checkout and return a `checkout_url`; the merchant enters a card, and
 * the plan is only activated when Paddle confirms payment (webhook →
 * applyPlan). A merchant can never land on a paid plan they didn't pay for.
 *
 * FREE plans (price_usd === 0, e.g. downgrading back to the free trial): applied
 * immediately at no charge. No upgrade grant since a free plan never has a
 * larger allowance than a paid one.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const key = String((req.body as any)?.key ?? "").trim()
  if (!key) return res.status(400).json({ message: "plan key required" })

  const billingRaw = String((req.body as any)?.billing ?? "monthly")
  const billing = ["monthly", "6months", "yearly"].includes(billingRaw)
    ? billingRaw
    : "monthly"

  const plan = (
    await ctx.svc.listPlatformPackages({ key }, { take: 1 }).catch(() => [])
  )[0]
  if (!plan) return res.status(400).json({ message: "unknown plan" })

  if (plan.key === ctx.tenant.package) {
    return res.status(400).json({ message: "You are already on this plan." })
  }

  const price = Number(plan.price_usd ?? 0)

  // ---- PAID plan: require a real card checkout. Plan applied on webhook. ----
  if (price > 0) {
    const cfg = new EncryptedConfigService(req.scope)
    const gateway = gatewayForCountry(ctx.tenant?.billing_country ?? "US", cfg)

    if (!(await gateway.isConfigured()) || !gateway.createSubscriptionCheckout) {
      return res.status(503).json({
        message:
          "Card payments aren't switched on yet. Please contact support to upgrade.",
      })
    }

    const base =
      String((req.body as any)?.return_url || "").trim() ||
      process.env.MERCHANT_APP_URL ||
      "https://merchant.mautomate.ai"

    const out = await gateway.createSubscriptionCheckout({
      tenant_id: ctx.tenant.id,
      plan_key: plan.key,
      plan_name: String(plan.name ?? plan.key),
      amount_usd: price,
      billing,
      success_url: `${base}/dashboard/billing?subscribed=1`,
      cancel_url: `${base}/dashboard/billing?cancelled=1`,
    })

    if (!out.ok) {
      return res
        .status(502)
        .json({ message: out.error || "Could not start checkout." })
    }

    return res.status(200).json({
      checkout_url: out.data!.url,
      requested_plan: {
        key: plan.key,
        name: String(plan.name ?? plan.key),
        price_usd: price,
      },
      message: `Redirecting to secure checkout for ${plan.name}…`,
    })
  }

  // ---- FREE plan (downgrade to the free trial): apply immediately. ----
  const meta: Record<string, unknown> = {
    ...((ctx.tenant.meta as Record<string, unknown>) || {}),
    package_changed_at: new Date().toISOString(),
    package_changed_from: ctx.tenant.package,
  }
  delete meta.requested_package
  delete meta.requested_package_at
  await ctx.svc.updateTenants({ id: ctx.tenant.id, package: key, meta })

  // A free plan never grants more than a paid one, so no allowance top-up here.
  void getLedger

  return res.status(200).json({
    ok: true,
    plan: {
      key: plan.key,
      name: String(plan.name ?? plan.key),
      price_usd: price,
      included_credits: Number(plan.included_credits ?? 0),
    },
    credits_granted: 0,
    message: `You're now on ${plan.name}.`,
  })
}
