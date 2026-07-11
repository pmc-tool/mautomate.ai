import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "paypal"

const isSandbox = (): boolean => process.env.PAYPAL_SANDBOX === "true"

const apiBase = (): string =>
  isSandbox() ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com"

/**
 * PayPal payment provider — global hosted checkout via Orders v2. Uses the
 * merchant's own client_id / client_secret (BYO credentials from the vault).
 * Set PAYPAL_SANDBOX=true to target the sandbox environment.
 *
 * Flow: OAuth client-credentials token -> create a CAPTURE order -> redirect the
 * shopper to the `payer-action` approval link -> on the webhook we re-read the
 * order server-side and, if the payer has APPROVED it, capture it; only a
 * COMPLETED capture is treated as authorized. Because the webhook-signature
 * verify API needs a `webhook_id` (a dashboard value we do not collect), we rely
 * on the authoritative server-side GET/capture rather than trusting the body.
 *
 * The Medusa payment session id is carried on the order's purchase_unit
 * `custom_id`, so it can be recovered on the webhook.
 *
 * Amounts are major currency units, formatted to 2 decimals.
 */
class PaypalProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  private async accessToken(creds: GatewayCredentials): Promise<string> {
    const basic = Buffer.from(
      `${String(creds.client_id)}:${String(creds.client_secret)}`
    ).toString("base64")
    const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })
    const json: any = await res.json().catch(() => null)
    if (!json?.access_token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `PayPal authentication failed: ${json?.error_description || "could not obtain access token"}`
      )
    }
    return json.access_token as string
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const reference =
      ((input.data as any)?.session_id as string) ||
      `pp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const value = Number(input.amount).toFixed(2)
    const currency = (input.currency_code || "USD").toUpperCase()
    const token = await this.accessToken(creds)

    const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: reference,
            custom_id: reference,
            amount: { currency_code: currency, value },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: this.returnUrl("success"),
              cancel_url: this.returnUrl("cancel"),
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
            },
          },
        },
      }),
    })
    const json: any = await res.json().catch(() => null)
    const links: any[] = Array.isArray(json?.links) ? json.links : []
    const approve =
      links.find((l) => l.rel === "payer-action") ||
      links.find((l) => l.rel === "approve")

    if (!json?.id || !approve?.href) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `PayPal order creation failed: ${json?.message || json?.details?.[0]?.description || "unknown error"}`
      )
    }

    return {
      id: json.id,
      redirect_url: approve.href,
      data: { order_id: json.id, reference, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, any>
    const event = String(body.event_type || "")
    const resource = (body.resource ?? {}) as Record<string, any>

    let orderId: string | undefined
    if (event.startsWith("CHECKOUT.ORDER")) {
      orderId = resource.id
    } else if (event.startsWith("PAYMENT.CAPTURE")) {
      orderId = resource.supplementary_data?.related_ids?.order_id
    }
    orderId = orderId || resource.id
    if (!orderId) {
      return { action: "failed" }
    }

    const token = await this.accessToken(creds)

    // Read the order; capture it if the payer has approved but not yet captured.
    let order = await this.getOrder(token, orderId)
    if (String(order?.status || "").toUpperCase() === "APPROVED") {
      order = await this.captureOrder(token, orderId)
    }

    const status = String(order?.status || "").toUpperCase()
    const unit = Array.isArray(order?.purchase_units) ? order.purchase_units[0] : undefined
    const reference = (unit?.custom_id as string) || (unit?.reference_id as string) || orderId
    const captured = unit?.payments?.captures?.[0]
    const amount = Number(
      captured?.amount?.value ?? unit?.amount?.value ?? 0
    )

    if (status === "COMPLETED") {
      return this.webhookResult("authorized", reference, amount)
    }
    if (status === "VOIDED" || status === "CANCELLED") {
      return this.webhookResult("canceled", reference, 0)
    }
    return { action: "failed", data: { session_id: reference, amount: new BigNumber(0) } }
  }

  private async getOrder(token: string, orderId: string): Promise<any> {
    const res = await fetch(
      `${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    return res.json().catch(() => null)
  }

  private async captureOrder(token: string, orderId: string): Promise<any> {
    const res = await fetch(
      `${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
      }
    )
    return res.json().catch(() => null)
  }
}

export default PaypalProvider
