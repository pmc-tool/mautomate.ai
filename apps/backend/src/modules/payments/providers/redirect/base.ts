import { AbstractPaymentProvider, MedusaError, BigNumber } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"

import {
  GatewayCredentials,
  loadGatewayCredentials,
  requireGatewayCredentials,
} from "../vault-provider"

/** Result of a gateway "create session" call. */
export type RedirectSession = {
  /** The gateway's session/transaction id (stored as the payment id). */
  id: string
  /** Where the storefront must send the shopper to complete payment. */
  redirect_url: string
  /** Extra data to persist on the payment session (publicly visible). */
  data?: Record<string, unknown>
}

/**
 * Base class for hosted-redirect payment gateways.
 *
 * The flow: `initiatePayment` asks the gateway to create a checkout session and
 * returns a `redirect_url` in the session data; the storefront sends the shopper
 * there; the gateway then notifies us (webhook/IPN) which `getWebhookActionAndData`
 * maps onto Medusa's authorized/captured actions to complete the cart.
 *
 * Concrete gateways implement only `gatewayId`, `createSession`, and `mapWebhook`.
 * Everything else (Medusa lifecycle plumbing) is shared here. All credential
 * reads happen at runtime from the encrypted vault, so instances boot with no
 * credentials and only fail — with a clear message — when actually used.
 */
export abstract class RedirectGatewayProvider extends AbstractPaymentProvider {
  protected readonly container_: Record<string, unknown>

  constructor(container: Record<string, unknown>, options: Record<string, unknown>) {
    super(container, options)
    this.container_ = container
  }

  /** The registry gateway id (e.g. "sslcommerz"). */
  protected abstract gatewayId(): string

  /** Create a hosted checkout session and return its redirect URL. */
  protected abstract createSession(
    creds: GatewayCredentials,
    input: InitiatePaymentInput
  ): Promise<RedirectSession>

  /** Map an inbound gateway webhook/IPN onto a Medusa webhook action. */
  protected abstract mapWebhook(
    creds: GatewayCredentials,
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult>

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const creds = await requireGatewayCredentials(this.container_, this.gatewayId())
    const session = await this.createSession(creds, input)
    const sessionId = (input.data as any)?.session_id as string | undefined
    return {
      id: session.id,
      status: "pending",
      data: {
        ...(session.data ?? {}),
        id: session.id,
        redirect_url: session.redirect_url,
        session_id: sessionId,
      },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const status = ((input.data as any)?.status as PaymentSessionStatus) || "pending"
    return { status, data: input.data ?? {} }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // Hosted gateways settle on their side; nothing to capture in Medusa.
    return { data: input.data ?? {} }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data ?? {} }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Automated refunds are not available for ${this.gatewayId()}. Refund from the gateway's own dashboard.`
    )
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const status = ((input.data as any)?.status as PaymentSessionStatus) || "pending"
    return { status, data: input.data ?? {} }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Amount is fixed at session creation; a changed cart re-initiates.
    return { status: "pending", data: input.data ?? {} }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    try {
      const creds = await loadGatewayCredentials(this.container_, this.gatewayId())
      return await this.mapWebhook(creds, payload)
    } catch (e) {
      return { action: "failed" }
    }
  }

  /** The storefront origin (no trailing slash), used to build return URLs. */
  protected storefrontBase(): string {
    return (process.env.STOREFRONT_URL || "http://localhost:8000").replace(/\/$/, "")
  }

  /** The backend origin (no trailing slash), used to build the webhook URL. */
  protected backendBase(): string {
    return (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")
  }

  /** Build the storefront return URL for a payment outcome. */
  protected returnUrl(outcome: "success" | "fail" | "cancel"): string {
    return `${this.storefrontBase()}/payment/${this.gatewayId()}/${outcome}`
  }

  /**
   * Build the backend webhook/IPN URL. Medusa's `/hooks/payment/:provider` route
   * re-adds the `pp_` prefix before resolving the provider, so the URL param must
   * be the provider id WITHOUT `pp_` — i.e. `<identifier>_<id>` (identifier === id
   * here, so `<gatewayId>_<gatewayId>`).
   */
  protected webhookUrl(): string {
    return `${this.backendBase()}/hooks/payment/${this.gatewayId()}_${this.gatewayId()}`
  }

  /** Helper for subclasses: build a WebhookActionResult with a BigNumber amount. */
  protected webhookResult(
    action: WebhookActionResult["action"],
    sessionId: string,
    amount: number | string
  ): WebhookActionResult {
    return { action, data: { session_id: sessionId, amount: new BigNumber(Number(amount) || 0) } }
  }

  /** Helper for scaffolded gateways that are registered but not yet certified. */
  protected notCertified(): never {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `The ${this.gatewayId()} gateway is registered but not yet certified. Contact support to enable it.`
    )
  }
}

export default RedirectGatewayProvider
