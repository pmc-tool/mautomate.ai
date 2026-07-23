import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../../_helpers"
import { PLATFORM_MODULE } from "../../../../modules/platform"
import { gatewayForCountry } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"
import {
  MOBILE_APP_PUBLISH_PRICES,
  isPublishTier,
} from "../../../../modules/platform/mobile-app/prices"

/**
 * POST /merchant/mobile-app/checkout  { tier: "play" | "full" }
 *
 * Start a REAL one-time Stripe Checkout for the done-for-you app-store
 * publishing service.
 *
 * SECURITY INVARIANT (mirrors the credit top-up underpayment fix): the client
 * sends ONLY the tier. The amount charged is ALWAYS derived server-side from the
 * tier's price constant — a client-supplied amount is never read. The Stripe
 * webhook independently re-verifies the paid amount against the same constant
 * before recording the order as paid, so a forged session can't unlock the
 * service cheaply.
 *
 * Tenant-bound (metadata: tenant_id + our order ref), tenant-scoped, fail-closed.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const tier = body.tier
  if (!isPublishTier(tier)) {
    return res.status(400).json({ message: 'tier must be "play" or "full"' })
  }

  const price = MOBILE_APP_PUBLISH_PRICES[tier]
  const amountUsd = price.launch_usd // SERVER-DERIVED, never from the client

  const platform: any = req.scope.resolve(PLATFORM_MODULE)

  // Record the intent BEFORE payment. It flips to "paid" only in the webhook,
  // once Stripe confirms the money and the amount matches — so a merchant can
  // never be marked paid for a service they didn't pay for.
  const [order] = await platform.createMobileAppOrders([
    {
      tenant_id: ctx.tenant.id,
      kind: "publish",
      tier,
      regular_price_usd: price.regular_usd,
      expected_amount_usd: amountUsd,
      status: "awaiting_payment",
      meta: { requested_by: ctx.merchant.id, service: "mobile_app_publish" },
    },
  ])

  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry(ctx.tenant.billing_country ?? "US", cfg)

  if (!(await gateway.isConfigured()) || !gateway.createPurchaseCheckout) {
    await platform.updateMobileAppOrders({ id: order.id, status: "cancelled" })
    return res.status(503).json({
      message: "Card payments aren't switched on yet. Please contact support.",
    })
  }

  const base = process.env.MERCHANT_APP_URL || `https://${ctx.tenant.slug}.mautomate.ai`
  const checkout = await gateway.createPurchaseCheckout({
    tenant_id: ctx.tenant.id,
    kind: "mobile_app_publish",
    ref: order.id,
    description: `${price.label} — mAutomate app publishing`,
    amount_usd: amountUsd,
    success_url: `${base}/dashboard/mobile-app?published=1`,
    cancel_url: `${base}/dashboard/mobile-app?cancelled=1`,
  })

  if (!checkout.ok) {
    await platform.updateMobileAppOrders({ id: order.id, status: "cancelled" })
    return res.status(502).json({ message: checkout.error ?? "could not start checkout" })
  }

  res.json({
    checkout_url: checkout.data!.url,
    order_id: order.id,
    tier,
    amount_usd: amountUsd,
  })
}
