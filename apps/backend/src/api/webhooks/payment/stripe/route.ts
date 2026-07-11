import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getLedger } from "../../../../modules/platform/credits/metering"
import { gatewayForCountry, webhookIdempotencyKey } from "../../../../modules/platform/billing/provider"
import { EncryptedConfigService } from "../../../../modules/platform/secure-config"

/**
 * POST /webhooks/payment/stripe
 *
 * Stripe webhook endpoint for credit top-ups. Verifies the signature,
 * extracts tenant_id + credits from the Checkout Session metadata, and
 * idempotently credits the tenant's wallet.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const rawBody = (req as any).rawBody as Buffer | string | undefined
  if (!rawBody) {
    return res.status(400).json({ message: "raw body required for signature verification" })
  }

  const cfg = new EncryptedConfigService(req.scope)
  const gateway = gatewayForCountry("US", cfg) // Stripe is the only webhook parser currently wired
  const result = await gateway.parseWebhook(
    Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody,
    Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v ?? "")]))
  )

  if (!result.ok) {
    return res.status(400).json({ message: result.error || "webhook_parse_failed" })
  }

  const event = result.data!
  if (event.type !== "checkout.session.completed" || !event.tenant_id || !event.credits) {
    return res.status(200).json({ received: true, processed: false, type: event.type })
  }

  const ledger = getLedger(req.scope)
  try {
    await ledger.credit(event.tenant_id, event.credits, {
      type: "topup",
      idempotencyKey: webhookIdempotencyKey({ provider: event.provider, external_event_id: event.external_event_id }),
      meta: { description: `Stripe top-up ($${event.amount_usd ?? "?"})` },
    })
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "ledger_credit_failed" })
  }

  res.status(200).json({ received: true, processed: true, tenant_id: event.tenant_id, credits: event.credits })
}
