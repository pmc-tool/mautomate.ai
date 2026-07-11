import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "flutterwave"
const API_BASE = "https://api.flutterwave.com/v3"

/**
 * Flutterwave payment provider — pan-African hosted checkout (Standard v3).
 * Uses the merchant's own secret key (BYO credentials from the vault).
 *
 * Flow: POST /payments to get a hosted `data.link`, redirect the shopper, then
 * confirm on the webhook. Flutterwave currently ships two webhook formats
 * (`verif-hash` plain-string vs `flutterwave-signature` HMAC) and the verifying
 * "secret hash" is NOT one of the credentials a merchant gives us, so we do not
 * trust the webhook body. Instead we always re-verify server-side via the
 * authoritative GET verify endpoint (Flutterwave's own recommendation) before
 * treating a charge as paid.
 *
 * Amounts are in major currency units.
 */
class FlutterwaveProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const txRef =
      ((input.data as any)?.session_id as string) ||
      `flw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const amount = Number(input.amount)
    const currency = (input.currency_code || "NGN").toUpperCase()
    const customer = input.context?.customer

    const res = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${String(creds.secret_key)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: this.returnUrl("success"),
        customer: {
          email: customer?.email || "customer@example.com",
          name: customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || undefined
            : undefined,
          phonenumber: customer?.phone || undefined,
        },
        customizations: { title: "Order" },
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || json.status !== "success" || !json.data?.link) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Flutterwave payment initialization failed: ${json?.message || "unknown error"}`
      )
    }

    return {
      id: txRef,
      redirect_url: json.data.link,
      data: { tx_ref: txRef, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const secret = String(creds.secret_key || "")
    const body = (payload.data ?? {}) as Record<string, any>
    const data = (body.data ?? {}) as Record<string, any>

    const transactionId = data.id ?? body.id
    const txRef = (data.tx_ref as string) || (body.tx_ref as string) || ""

    // Authoritative verification: prefer the numeric transaction id, else tx_ref.
    let verify: any = null
    if (transactionId != null) {
      const res = await fetch(
        `${API_BASE}/transactions/${encodeURIComponent(String(transactionId))}/verify`,
        { headers: { authorization: `Bearer ${secret}` } }
      )
      verify = await res.json().catch(() => null)
    } else if (txRef) {
      const res = await fetch(
        `${API_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
        { headers: { authorization: `Bearer ${secret}` } }
      )
      verify = await res.json().catch(() => null)
    }

    const status = String(verify?.data?.status || "").toLowerCase()
    const amount = Number(verify?.data?.amount || 0)
    const ref = (verify?.data?.tx_ref as string) || txRef

    if (verify?.status === "success" && status === "successful") {
      return this.webhookResult("authorized", ref, amount)
    }
    return { action: "failed", data: { session_id: ref, amount: new BigNumber(0) } }
  }
}

export default FlutterwaveProvider
