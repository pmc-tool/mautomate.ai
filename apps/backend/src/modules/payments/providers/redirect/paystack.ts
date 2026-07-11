import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import crypto from "crypto"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "paystack"
const API_BASE = "https://api.paystack.co"

/**
 * Paystack payment provider — hosted checkout for Nigeria, Ghana, Kenya, South
 * Africa. Uses the merchant's own secret key (BYO credentials from the vault).
 *
 * Flow: initialize a transaction to get an `authorization_url`, send the shopper
 * there, then confirm via the webhook. Webhooks are verified with HMAC-SHA512 of
 * the raw body using the secret key (x-paystack-signature); as a second layer we
 * re-verify the transaction server-side via GET /transaction/verify before
 * treating it as paid.
 *
 * Amounts are charged in the currency's smallest unit (kobo/pesewa/cents), i.e.
 * major-unit amount * 100.
 */
class PaystackProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const reference =
      ((input.data as any)?.session_id as string) ||
      `ps_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const amountMinor = Math.round(Number(input.amount) * 100)
    const currency = (input.currency_code || "NGN").toUpperCase()
    const email = input.context?.customer?.email || "customer@example.com"

    const res = await fetch(`${API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${String(creds.secret_key)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountMinor,
        currency,
        reference,
        callback_url: this.returnUrl("success"),
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || json.status !== true || !json.data?.authorization_url) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Paystack transaction initialization failed: ${json?.message || "unknown error"}`
      )
    }

    return {
      id: json.data.reference || reference,
      redirect_url: json.data.authorization_url,
      data: {
        reference: json.data.reference || reference,
        access_code: json.data.access_code,
        status: "pending",
      },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const secret = String(creds.secret_key || "")
    const raw = payload.rawData
    const signature = this.headerValue(payload.headers, "x-paystack-signature")

    // Verify the HMAC-SHA512 signature over the raw request body.
    if (raw && signature) {
      const rawStr =
        typeof raw === "string" ? raw : Buffer.from(raw as any).toString("utf8")
      const expected = crypto
        .createHmac("sha512", secret)
        .update(rawStr)
        .digest("hex")
      if (expected !== signature) {
        return { action: "failed" }
      }
    }

    const body = (payload.data ?? {}) as Record<string, any>
    const event = String(body.event || "")
    const reference = body.data?.reference as string | undefined
    if (!reference) {
      return { action: "failed" }
    }

    if (event && event !== "charge.success") {
      return { action: "failed", data: { session_id: reference, amount: new BigNumber(0) } }
    }

    // Authoritative re-verification: query the transaction server-side.
    const verifyRes = await fetch(
      `${API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { authorization: `Bearer ${secret}` } }
    )
    const verify: any = await verifyRes.json().catch(() => null)
    const status = String(verify?.data?.status || "").toLowerCase()
    const amountMajor = Number(verify?.data?.amount || 0) / 100

    if (status === "success") {
      return this.webhookResult("authorized", reference, amountMajor)
    }
    return { action: "failed", data: { session_id: reference, amount: new BigNumber(0) } }
  }

  /** Case-insensitive header lookup from a webhook payload's headers map. */
  private headerValue(
    headers: Record<string, unknown> | undefined,
    name: string
  ): string | undefined {
    if (!headers) {
      return undefined
    }
    const target = name.toLowerCase()
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === target) {
        const v = (headers as any)[key]
        return Array.isArray(v) ? String(v[0]) : v != null ? String(v) : undefined
      }
    }
    return undefined
  }
}

export default PaystackProvider
