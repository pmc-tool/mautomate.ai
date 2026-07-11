import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "xendit"
const API_BASE = "https://api.xendit.co"

/**
 * Xendit payment provider — Southeast Asia hosted checkout (Indonesia,
 * Philippines) via the Invoices API. Uses the merchant's own secret API key
 * (BYO credentials from the vault).
 *
 * Flow: POST /v2/invoices to get `invoice_url`, redirect the shopper, then
 * confirm on the webhook. Xendit's webhook `x-callback-token` is a per-account
 * dashboard token that is NOT one of the credentials we collect, so we do not
 * trust the callback body. Instead we re-read the invoice server-side via
 * GET /v2/invoices/{id} and treat only PAID/SETTLED as paid.
 *
 * Amounts are in major currency units.
 */
class XenditProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  private authHeader(creds: GatewayCredentials): string {
    const token = Buffer.from(`${String(creds.secret_key)}:`).toString("base64")
    return `Basic ${token}`
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const externalId =
      ((input.data as any)?.session_id as string) ||
      `xnd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const amount = Number(input.amount)
    const currency = (input.currency_code || "IDR").toUpperCase()
    const email = input.context?.customer?.email || "customer@example.com"

    const res = await fetch(`${API_BASE}/v2/invoices`, {
      method: "POST",
      headers: {
        authorization: this.authHeader(creds),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        external_id: externalId,
        amount,
        currency,
        payer_email: email,
        description: "Order",
        success_redirect_url: this.returnUrl("success"),
        failure_redirect_url: this.returnUrl("fail"),
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || !json.invoice_url || !json.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Xendit invoice creation failed: ${json?.message || "unknown error"}`
      )
    }

    return {
      id: externalId,
      redirect_url: json.invoice_url,
      data: { external_id: externalId, invoice_id: json.id, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, any>
    const invoiceId = body.id as string | undefined
    const externalId = (body.external_id as string) || ""

    if (!invoiceId) {
      return { action: "failed", data: { session_id: externalId, amount: new BigNumber(0) } }
    }

    // Authoritative re-read of the invoice server-side.
    const res = await fetch(
      `${API_BASE}/v2/invoices/${encodeURIComponent(invoiceId)}`,
      { headers: { authorization: this.authHeader(creds) } }
    )
    const invoice: any = await res.json().catch(() => null)
    const status = String(invoice?.status || "").toUpperCase()
    const ref = (invoice?.external_id as string) || externalId
    const amount = Number(invoice?.paid_amount ?? invoice?.amount ?? 0)

    if (status === "PAID" || status === "SETTLED") {
      return this.webhookResult("authorized", ref, amount)
    }
    if (status === "EXPIRED") {
      return this.webhookResult("canceled", ref, 0)
    }
    return { action: "failed", data: { session_id: ref, amount: new BigNumber(0) } }
  }
}

export default XenditProvider
