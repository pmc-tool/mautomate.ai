import { MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  InitiatePaymentInput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

import { GatewayCredentials, requireGatewayCredentials } from "../vault-provider"
import { RedirectGatewayProvider, RedirectSession } from "./base"

const GATEWAY_ID = "sslcommerz"

/** Detect the sandbox environment from the store id or an explicit env flag. */
const isSandbox = (creds: GatewayCredentials): boolean => {
  if (process.env.SSLCOMMERZ_SANDBOX === "true") {
    return true
  }
  if (process.env.SSLCOMMERZ_SANDBOX === "false") {
    return false
  }
  const storeId = String(creds.store_id || "").toLowerCase()
  return storeId.includes("test")
}

const sessionApiUrl = (creds: GatewayCredentials): string =>
  isSandbox(creds)
    ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
    : "https://securepay.sslcommerz.com/gwprocess/v4/api.php"

const validationApiUrl = (creds: GatewayCredentials): string =>
  isSandbox(creds)
    ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
    : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"

const refundApiUrl = (creds: GatewayCredentials): string =>
  isSandbox(creds)
    ? "https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php"
    : "https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php"

const storefrontBase = (): string =>
  (process.env.STOREFRONT_URL || "http://localhost:8000").replace(/\/$/, "")

const backendBase = (): string =>
  (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")

/**
 * SSLCommerz payment provider — Bangladesh's hosted checkout.
 *
 * identifier "sslcommerz" + id "sslcommerz" => runtime id `pp_sslcommerz_sslcommerz`.
 *
 * Fully implemented: creates a hosted session via the SSLCommerz v4 session API
 * with the tenant's store_id / store_passwd, returns the GatewayPageURL as the
 * storefront redirect target, verifies the IPN against the validation API, and
 * supports refunds via the merchant transaction API.
 */
class SslcommerzProvider extends RedirectGatewayProvider {
  static identifier = GATEWAY_ID

  protected gatewayId(): string {
    return GATEWAY_ID
  }

  protected async createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession> {
    const tranId =
      ((input.data as any)?.session_id as string) ||
      `ssl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const amount = Number(input.amount)
    const customer = input.context?.customer

    const form = new URLSearchParams()
    form.set("store_id", String(creds.store_id))
    form.set("store_passwd", String(creds.store_passwd))
    form.set("total_amount", amount.toFixed(2))
    form.set("currency", (input.currency_code || "BDT").toUpperCase())
    form.set("tran_id", tranId)
    form.set("success_url", `${storefrontBase()}/payment/sslcommerz/success`)
    form.set("fail_url", `${storefrontBase()}/payment/sslcommerz/fail`)
    form.set("cancel_url", `${storefrontBase()}/payment/sslcommerz/cancel`)
    form.set("ipn_url", `${backendBase()}/hooks/payment/sslcommerz_sslcommerz`)
    form.set("cus_name", customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer" : "Customer")
    form.set("cus_email", customer?.email || "customer@example.com")
    form.set("cus_phone", customer?.phone || "0000000000")
    form.set("shipping_method", "NO")
    form.set("product_name", "Order")
    form.set("product_category", "general")
    form.set("product_profile", "general")

    const res = await fetch(sessionApiUrl(creds), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
    const json: any = await res.json().catch(() => null)

    if (!json || json.status !== "SUCCESS" || !json.GatewayPageURL) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `SSLCommerz session creation failed: ${json?.failedreason || json?.status || "unknown error"}`
      )
    }

    return {
      id: tranId,
      redirect_url: json.GatewayPageURL,
      data: {
        tran_id: tranId,
        sessionkey: json.sessionkey,
        status: "pending",
      },
    }
  }

  protected async mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, any>
    const valId = body.val_id as string | undefined
    const tranId = (body.tran_id as string) || ""
    const rawStatus = String(body.status || "").toUpperCase()

    // Verify against the validation API when a val_id is present (secure path).
    if (valId) {
      const url = new URL(validationApiUrl(creds))
      url.searchParams.set("val_id", valId)
      url.searchParams.set("store_id", String(creds.store_id))
      url.searchParams.set("store_passwd", String(creds.store_passwd))
      url.searchParams.set("format", "json")
      const res = await fetch(url.toString())
      const json: any = await res.json().catch(() => null)
      const status = String(json?.status || "").toUpperCase()
      if (status === "VALID" || status === "VALIDATED") {
        return this.webhookResult("authorized", json.tran_id || tranId, json.amount ?? body.amount ?? 0)
      }
      return { action: "failed", data: { session_id: json?.tran_id || tranId, amount: new BigNumber(0) } }
    }

    // No val_id: fall back to the posted status (less trusted).
    if (rawStatus === "VALID" || rawStatus === "VALIDATED") {
      return this.webhookResult("authorized", tranId, body.amount ?? 0)
    }
    if (rawStatus === "CANCELLED") {
      return this.webhookResult("canceled", tranId, body.amount ?? 0)
    }
    return this.webhookResult("failed", tranId, body.amount ?? 0)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const creds = await requireGatewayCredentials(this.container_, GATEWAY_ID)
    const bankTranId = (input.data as any)?.bank_tran_id as string | undefined
    if (!bankTranId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "SSLCommerz refund requires the bank_tran_id from the original transaction validation."
      )
    }
    const url = new URL(refundApiUrl(creds))
    url.searchParams.set("bank_tran_id", bankTranId)
    url.searchParams.set("refund_amount", Number(input.amount).toFixed(2))
    url.searchParams.set("refund_remarks", "Refund")
    url.searchParams.set("store_id", String(creds.store_id))
    url.searchParams.set("store_passwd", String(creds.store_passwd))
    url.searchParams.set("format", "json")
    const res = await fetch(url.toString())
    const json: any = await res.json().catch(() => null)
    if (!json || (json.APIConnect !== "DONE" && json.status !== "success")) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `SSLCommerz refund failed: ${json?.errorReason || json?.status || "unknown error"}`
      )
    }
    return { data: { ...(input.data ?? {}), refund_ref_id: json.refund_ref_id, refunded: true } }
  }
}

export default SslcommerzProvider
