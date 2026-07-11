import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import crypto from "crypto"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "midtrans"

/** Sandbox server keys are prefixed "SB-Mid-server-"; production "Mid-server-". */
const isSandbox = (creds: GatewayCredentials): boolean => {
  if (process.env.MIDTRANS_SANDBOX === "true") {
    return true
  }
  if (process.env.MIDTRANS_SANDBOX === "false") {
    return false
  }
  return String(creds.server_key || "").startsWith("SB-")
}

const snapApiUrl = (creds: GatewayCredentials): string =>
  isSandbox(creds)
    ? "https://app.sandbox.midtrans.com/snap/v1/transactions"
    : "https://app.midtrans.com/snap/v1/transactions"

/**
 * Midtrans payment provider — Indonesia hosted checkout (Snap). Uses the
 * merchant's own Server Key (BYO credentials from the vault).
 *
 * Flow: POST /snap/v1/transactions to get a `redirect_url`, send the shopper
 * there, then confirm on the HTTP notification (webhook). The notification is
 * verified with signature_key = SHA512(order_id + status_code + gross_amount +
 * server_key), which we can compute because the Server Key IS a credential we
 * hold.
 *
 * gross_amount is an integer (IDR has no minor units).
 */
class MidtransProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const orderId =
      ((input.data as any)?.session_id as string) ||
      `mid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const grossAmount = Math.round(Number(input.amount))
    const customer = input.context?.customer
    const auth = Buffer.from(`${String(creds.server_key)}:`).toString("base64")

    const res = await fetch(snapApiUrl(creds), {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: grossAmount },
        credit_card: { secure: true },
        customer_details: {
          first_name: customer?.first_name || "Customer",
          last_name: customer?.last_name || undefined,
          email: customer?.email || "customer@example.com",
          phone: customer?.phone || undefined,
        },
        callbacks: { finish: this.returnUrl("success") },
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || !json.redirect_url || !json.token) {
      const reason = Array.isArray(json?.error_messages)
        ? json.error_messages.join("; ")
        : json?.status_message || "unknown error"
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Midtrans Snap transaction creation failed: ${reason}`
      )
    }

    return {
      id: orderId,
      redirect_url: json.redirect_url,
      data: { order_id: orderId, token: json.token, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const serverKey = String(creds.server_key || "")
    const body = (payload.data ?? {}) as Record<string, any>
    const orderId = String(body.order_id || "")
    const statusCode = String(body.status_code || "")
    const grossAmount = String(body.gross_amount || "")
    const signatureKey = String(body.signature_key || "")

    // Verify signature_key = SHA512(order_id + status_code + gross_amount + serverKey).
    const expected = crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex")
    if (!signatureKey || expected !== signatureKey) {
      return { action: "failed" }
    }

    const txStatus = String(body.transaction_status || "").toLowerCase()
    const fraudStatus = String(body.fraud_status || "").toLowerCase()
    const amount = Number(grossAmount) || 0

    if (txStatus === "settlement" || (txStatus === "capture" && fraudStatus === "accept")) {
      return this.webhookResult("authorized", orderId, amount)
    }
    if (txStatus === "capture" && fraudStatus === "challenge") {
      return { action: "pending", data: { session_id: orderId, amount: new BigNumber(amount) } }
    }
    if (txStatus === "pending") {
      return { action: "pending", data: { session_id: orderId, amount: new BigNumber(amount) } }
    }
    if (txStatus === "cancel" || txStatus === "expire") {
      return this.webhookResult("canceled", orderId, amount)
    }
    return { action: "failed", data: { session_id: orderId, amount: new BigNumber(0) } }
  }
}

export default MidtransProvider
