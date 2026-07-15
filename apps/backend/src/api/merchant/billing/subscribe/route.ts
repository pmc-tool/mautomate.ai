import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { gatewayForCountry } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import { TIERS } from "../../../../modules/platform/pricing/price-book"
import { resolveMerchant } from "../../_helpers"

/**
 * POST /merchant/billing/subscribe — start a REAL recurring subscription.
 *
 * Returns a Stripe Checkout url. Nothing changes in our DB here: the plan is
 * only activated when Stripe confirms payment (webhook), so a merchant can
 * never end up on a paid plan they didn't pay for.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ error: "Not authorised." })
  const body = (req.body ?? {}) as { plan?: string; return_url?: string }

  const tier = TIERS.find((t) => t.key === body.plan)
  if (!tier) {
    return res.status(400).json({ error: "Unknown plan." })
  }
  if (tier.price_usd <= 0) {
    return res.status(400).json({ error: "That plan is free — no subscription needed." })
  }

  const tenant = ctx.tenant
  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry(tenant?.billing_country ?? "US", cfg)

  if (!(await gateway.isConfigured()) || !gateway.createSubscriptionCheckout) {
    return res.status(503).json({
      error: "Card payments aren't switched on yet. Please contact support.",
    })
  }

  const base = body.return_url || process.env.MERCHANT_APP_URL || "https://mautomate.ai"
  const out = await gateway.createSubscriptionCheckout({
    tenant_id: tenant.id,
    plan_key: tier.key,
    plan_name: tier.key.replace(/_/g, " "),
    amount_usd: tier.price_usd,
    success_url: `${base}/dashboard/billing?subscribed=1`,
    cancel_url: `${base}/dashboard/billing?cancelled=1`,
  })

  if (!out.ok) {
    return res.status(502).json({ error: out.error || "Could not start checkout." })
  }
  res.json({ checkout_url: out.data!.url, plan: tier.key, price_usd: tier.price_usd })
}
