import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { resolveMerchant } from "../_helpers"
import { getLedger } from "../../../modules/platform/credits/metering"
import { allGateways, gatewayForCountry } from "../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../modules/platform/secure-config"

/**
 * GET /merchant/credits
 *
 * Returns the merchant's tenant credit balance and recent ledger transactions.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const ledger = getLedger(req.scope)
  const balance = await ledger.balance(ctx.tenant.id).catch(() => 0)
  const transactions = await ctx.svc.listCreditTransactions(
    { tenant_id: ctx.tenant.id },
    { take: 50, order: { created_at: "DESC" } }
  ).catch(() => [])

  res.json({
    tenant_id: ctx.tenant.id,
    balance: Number(balance),
    trial_ends_at: ctx.tenant.trial_ends_at ?? null,
    transactions: (transactions || []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount ?? 0),
      description: t.description,
      created_at: t.created_at,
    })),
  })
}

/**
 * POST /merchant/credits  { credits, amount_usd }
 *
 * Create a checkout session to buy more credits. Returns a redirect URL for the
 * gateway configured for the tenant's billing country (Stripe global, SSLCommerz
 * for Bangladesh). The gateway is fully wired only when its env keys are set.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const ctx = await resolveMerchant(req)
  if (!ctx) return res.status(401).json({ message: "not authorized" })

  const body = (req.body ?? {}) as any
  const credits = Math.max(1, Math.min(1000000, Math.floor(Number(body.credits) || 0)))
  const amountUsd = Math.max(1, Math.min(10000, Number(body.amount_usd) || Math.ceil(credits / 100)))

  if (!credits) return res.status(400).json({ message: "credits required" })

  const country = ctx.tenant.billing_country || "US"
  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry(country, cfg)
  const configured = await gateway.isConfigured()
  if (!gateway || !configured) {
    return res.status(503).json({
      message: "No payment gateway is configured for your region",
      gateway: gateway?.name,
      configured,
    })
  }

  const slug = ctx.tenant.slug
  const base = `https://${slug}.mautomate.ai`
  const result = await gateway.createTopupCheckout({
    tenant_id: ctx.tenant.id,
    credits,
    amount_usd: amountUsd,
    success_url: `${base}/merchant/credits?topup=success`,
    cancel_url: `${base}/merchant/credits?topup=cancel`,
  })

  if (!result.ok) {
    return res.status(500).json({ message: result.error || "checkout_failed" })
  }

  res.status(201).json({
    checkout_url: result.data?.url,
    checkout_id: result.data?.id,
    provider: result.data?.provider,
    credits,
    amount_usd: amountUsd,
  })
}
