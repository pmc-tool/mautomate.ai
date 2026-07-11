import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "razorpay"
const API_BASE = "https://api.razorpay.com/v1"

/**
 * Razorpay payment provider — India card + UPI, implemented as a hosted redirect
 * using the Payment Links API. Uses the merchant's own key_id / key_secret (BYO
 * credentials from the vault).
 *
 * Flow: POST /payment_links to get a `short_url`, redirect the shopper, then
 * confirm on the webhook. Razorpay webhooks are signed with a per-endpoint
 * webhook secret that is NOT one of the credentials we collect, so we do not
 * trust the webhook body. Instead we re-read the payment link server-side via
 * GET /payment_links/{id} (Basic auth with the API keys) and treat only "paid"
 * as settled.
 *
 * Amounts are in the smallest currency unit (paise), i.e. major-unit * 100.
 */
class RazorpayProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  private authHeader(creds: GatewayCredentials): string {
    const token = Buffer.from(
      `${String(creds.key_id)}:${String(creds.key_secret)}`
    ).toString("base64")
    return `Basic ${token}`
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const reference =
      ((input.data as any)?.session_id as string) ||
      `rzp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const amountMinor = Math.round(Number(input.amount) * 100)
    const currency = (input.currency_code || "INR").toUpperCase()
    const customer = input.context?.customer

    const res = await fetch(`${API_BASE}/payment_links`, {
      method: "POST",
      headers: {
        authorization: this.authHeader(creds),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        reference_id: reference.slice(0, 40),
        description: "Order",
        customer: customer
          ? {
              name:
                `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
                undefined,
              email: customer.email || undefined,
              contact: customer.phone || undefined,
            }
          : undefined,
        notify: { sms: false, email: false },
        callback_url: this.returnUrl("success"),
        callback_method: "get",
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || !json.short_url || !json.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Razorpay payment link creation failed: ${json?.error?.description || "unknown error"}`
      )
    }

    return {
      id: reference,
      redirect_url: json.short_url,
      data: { payment_link_id: json.id, reference_id: reference, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, any>
    const linkEntity = body.payload?.payment_link?.entity as Record<string, any> | undefined
    const linkId = linkEntity?.id as string | undefined

    if (!linkId) {
      return { action: "failed" }
    }

    // Authoritative re-read of the payment link server-side.
    const res = await fetch(
      `${API_BASE}/payment_links/${encodeURIComponent(linkId)}`,
      { headers: { authorization: this.authHeader(creds) } }
    )
    const link: any = await res.json().catch(() => null)
    const status = String(link?.status || "").toLowerCase()
    const reference = (link?.reference_id as string) || linkEntity?.reference_id || linkId
    const amount = Number(link?.amount_paid || 0) / 100

    if (status === "paid") {
      return this.webhookResult("authorized", reference, amount)
    }
    if (status === "cancelled" || status === "expired") {
      return this.webhookResult("canceled", reference, 0)
    }
    return { action: "failed", data: { session_id: reference, amount: new BigNumber(0) } }
  }
}

export default RazorpayProvider
