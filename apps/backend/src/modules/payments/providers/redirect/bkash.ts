import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "bkash"

const isSandbox = (): boolean => process.env.BKASH_SANDBOX !== "false"

const apiBase = (): string =>
  isSandbox()
    ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout"
    : "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout"

/**
 * bKash payment provider — Bangladesh mobile-wallet hosted checkout (Tokenized
 * Checkout, URL-based `sale` flow, mode 0011). Uses the merchant's own
 * app_key / app_secret / username / password (BYO credentials from the vault).
 * Set BKASH_SANDBOX=false to target production.
 *
 * Flow: grant an id_token -> create a payment to get `bkashURL` -> redirect the
 * shopper -> bKash returns them to the callback with a paymentID. bKash's
 * documented model has NO confirmation webhook: the merchant must call Execute
 * Payment (falling back to Query Payment) with that paymentID to settle. We do
 * exactly that in `mapWebhook`: whatever posts the paymentID to our hook (the
 * storefront callback forwarding it, or bKash's opt-in IPN) triggers a
 * server-side Execute/Query, and only a "Completed" transaction is authorized.
 *
 * The Medusa payment session id is carried as merchantInvoiceNumber /
 * payerReference so it can be recovered from the Execute/Query response.
 *
 * Amounts are major-unit BDT formatted to 2 decimals.
 */
class BkashProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  private async grantToken(creds: GatewayCredentials): Promise<string> {
    const res = await fetch(`${apiBase()}/token/grant`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        username: String(creds.username),
        password: String(creds.password),
      },
      body: JSON.stringify({
        app_key: String(creds.app_key),
        app_secret: String(creds.app_secret),
      }),
    })
    const json: any = await res.json().catch(() => null)
    if (!json?.id_token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `bKash authentication failed: ${json?.statusMessage || "could not grant token"}`
      )
    }
    return json.id_token as string
  }

  private authHeaders(creds: GatewayCredentials, token: string): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json",
      authorization: token,
      "x-app-key": String(creds.app_key),
    }
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const invoice =
      ((input.data as any)?.session_id as string) ||
      `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const amount = Number(input.amount).toFixed(2)
    const token = await this.grantToken(creds)

    const res = await fetch(`${apiBase()}/create`, {
      method: "POST",
      headers: this.authHeaders(creds, token),
      body: JSON.stringify({
        mode: "0011",
        payerReference: invoice,
        callbackURL: this.returnUrl("success"),
        amount,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: invoice,
      }),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || json.statusCode !== "0000" || !json.bkashURL || !json.paymentID) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `bKash payment creation failed: ${json?.statusMessage || "unknown error"}`
      )
    }

    return {
      id: invoice,
      redirect_url: json.bkashURL,
      data: { payment_id: json.paymentID, invoice, status: "pending" },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, any>
    const paymentId = (body.paymentID as string) || (body.payment_id as string)
    const callbackStatus = String(body.status || "").toLowerCase()

    if (callbackStatus === "cancel") {
      return this.webhookResult("canceled", (body.invoice as string) || "", 0)
    }
    if (callbackStatus === "failure") {
      return { action: "failed" }
    }
    if (!paymentId) {
      return { action: "failed" }
    }

    const token = await this.grantToken(creds)

    // Execute the payment to settle it; on any failure, query for the final state.
    let result: any = await this.executePayment(creds, token, paymentId)
    if (String(result?.transactionStatus || "") !== "Completed") {
      result = await this.queryPayment(creds, token, paymentId)
    }

    const status = String(result?.transactionStatus || "")
    const invoice =
      (result?.merchantInvoiceNumber as string) || (body.invoice as string) || paymentId
    const amount = Number(result?.amount || 0)

    if (status === "Completed") {
      return this.webhookResult("authorized", invoice, amount)
    }
    return { action: "failed", data: { session_id: invoice, amount: new BigNumber(0) } }
  }

  private async executePayment(
    creds: GatewayCredentials,
    token: string,
    paymentId: string
  ): Promise<any> {
    const res = await fetch(`${apiBase()}/execute`, {
      method: "POST",
      headers: this.authHeaders(creds, token),
      body: JSON.stringify({ paymentID: paymentId }),
    })
    return res.json().catch(() => null)
  }

  private async queryPayment(
    creds: GatewayCredentials,
    token: string,
    paymentId: string
  ): Promise<any> {
    const res = await fetch(`${apiBase()}/payment/status`, {
      method: "POST",
      headers: this.authHeaders(creds, token),
      body: JSON.stringify({ paymentID: paymentId }),
    })
    return res.json().catch(() => null)
  }
}

export default BkashProvider
