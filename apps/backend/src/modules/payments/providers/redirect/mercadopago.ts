import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "mercadopago"
const API_BASE = "https://api.mercadopago.com"

/**
 * Mercado Pago payment provider — Latin American hosted checkout (Checkout Pro).
 * Uses the merchant's own Access Token (BYO credentials from the vault).
 *
 * Flow: POST /checkout/preferences to get an `init_point`, redirect the shopper,
 * then confirm on the webhook. The webhook's x-signature HMAC uses a per-app
 * "webhook secret" that is NOT one of the credentials we collect, so we do not
 * trust the notification body. Instead we read the payment server-side via
 * GET /v1/payments/{id} with the access token and treat only "approved" as paid.
 *
 * Amounts (unit_price) are in major currency units.
 */
class MercadopagoProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const externalRef =
      ((input.data as any)?.session_id as string) ||
      `mp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const token = String(creds.access_token)
    const amount = Number(input.amount)
    const currency = (input.currency_code || "BRL").toUpperCase()
    const customer = input.context?.customer

    const res = await fetch(`${API_BASE}/checkout/preferences`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: externalRef,
            title: "Order",
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        payer: customer?.email ? { email: customer.email } : undefined,
        back_urls: {
          success: this.returnUrl("success"),
          failure: this.returnUrl("fail"),
          pending: this.returnUrl("success"),
        },
        auto_return: "approved",
        notification_url: this.webhookUrl(),
        external_reference: externalRef,
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || (!json.init_point && !json.sandbox_init_point) || !json.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Mercado Pago preference creation failed: ${json?.message || "unknown error"}`
      )
    }

    // TEST- access tokens must use the sandbox checkout URL.
    const useSandbox = token.startsWith("TEST-")
    const redirectUrl =
      useSandbox && json.sandbox_init_point ? json.sandbox_init_point : json.init_point

    return {
      id: externalRef,
      redirect_url: redirectUrl,
      data: { preference_id: json.id, external_reference: externalRef, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const token = String(creds.access_token || "")
    const body = (payload.data ?? {}) as Record<string, any>

    // Only payment notifications carry a settlement outcome.
    const type = String(body.type || body.topic || "")
    if (type && type !== "payment") {
      return { action: "not_supported" }
    }

    const paymentId = body.data?.id ?? body.id
    if (!paymentId) {
      return { action: "failed" }
    }

    // Authoritative read of the payment server-side.
    const res = await fetch(
      `${API_BASE}/v1/payments/${encodeURIComponent(String(paymentId))}`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    const payment: any = await res.json().catch(() => null)
    const status = String(payment?.status || "").toLowerCase()
    const ref = (payment?.external_reference as string) || String(paymentId)
    const amount = Number(payment?.transaction_amount || 0)

    if (status === "approved") {
      return this.webhookResult("authorized", ref, amount)
    }
    if (status === "pending" || status === "in_process" || status === "authorized") {
      return { action: "pending", data: { session_id: ref, amount: new BigNumber(amount) } }
    }
    if (status === "cancelled" || status === "refunded" || status === "charged_back") {
      return this.webhookResult("canceled", ref, amount)
    }
    return { action: "failed", data: { session_id: ref, amount: new BigNumber(0) } }
  }
}

export default MercadopagoProvider
