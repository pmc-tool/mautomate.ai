import Stripe from "stripe"
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

import { loadGatewayCredentials, requireGatewayCredentials } from "../vault-provider"

const GATEWAY_ID = "stripe"

/** Currencies Stripe treats as zero-decimal (amount already in smallest unit). */
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
])

/** Convert a Medusa major-unit amount into Stripe's smallest currency unit. */
const toSmallestUnit = (amount: number, currency: string): number => {
  const code = (currency || "").toLowerCase()
  const multiplier = ZERO_DECIMAL.has(code) ? 1 : 100
  return Math.round(amount * multiplier)
}

const toStatus = (stripeStatus?: string): PaymentSessionStatus => {
  switch (stripeStatus) {
    case "requires_capture":
      return "authorized"
    case "succeeded":
      return "captured"
    case "canceled":
      return "canceled"
    case "requires_action":
    case "requires_confirmation":
    case "requires_payment_method":
      return "requires_more"
    case "processing":
    default:
      return "pending"
  }
}

/**
 * Stripe payment provider — BYO-credential, multi-tenant.
 *
 * identifier "stripe" + id "stripe" => runtime id `pp_stripe_stripe`.
 *
 * Boots with empty options. The tenant's secret_key / webhook_secret are read
 * at call time from the encrypted vault. If the tenant has no key, every method
 * throws a clear MedusaError rather than crashing the instance.
 */
class StripeGatewayProvider extends AbstractPaymentProvider {
  static identifier = GATEWAY_ID

  private readonly container_: Record<string, unknown>

  constructor(container: Record<string, unknown>, options: Record<string, unknown>) {
    super(container, options)
    this.container_ = container
  }

  /** Build a Stripe client from the tenant's stored secret key. */
  private async client(): Promise<Stripe> {
    const creds = await requireGatewayCredentials(this.container_, GATEWAY_ID)
    return new Stripe(creds.secret_key as string, {
      apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
    })
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const stripe = await this.client()
    const amount = toSmallestUnit(Number(input.amount), input.currency_code)
    const sessionId = (input.data as any)?.session_id as string | undefined
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: input.currency_code.toLowerCase(),
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      metadata: sessionId ? { session_id: sessionId } : undefined,
    })
    return {
      id: intent.id,
      data: { ...(intent as any), id: intent.id, client_secret: intent.client_secret },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const id = (input.data as any)?.id as string
    const stripe = await this.client()
    const intent = await stripe.paymentIntents.retrieve(id)
    return { status: toStatus(intent.status), data: { ...(intent as any), id } }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const id = (input.data as any)?.id as string
    const stripe = await this.client()
    const intent = await stripe.paymentIntents.capture(id)
    return { data: { ...(intent as any), id } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const id = (input.data as any)?.id as string | undefined
    if (!id) {
      return { data: input.data }
    }
    const stripe = await this.client()
    try {
      const intent = await stripe.paymentIntents.cancel(id)
      return { data: { ...(intent as any), id } }
    } catch (e: any) {
      // Already captured/canceled intents cannot be canceled — surface data as-is.
      return { data: input.data }
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const id = (input.data as any)?.id as string
    const stripe = await this.client()
    const intent = await stripe.paymentIntents.retrieve(id)
    await stripe.refunds.create({
      payment_intent: id,
      amount: toSmallestUnit(Number(input.amount), intent.currency),
    })
    const refreshed = await stripe.paymentIntents.retrieve(id)
    return { data: { ...(refreshed as any), id } }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const id = (input.data as any)?.id as string
    const stripe = await this.client()
    const intent = await stripe.paymentIntents.retrieve(id)
    return { status: toStatus(intent.status), data: { ...(intent as any), id } }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const id = (input.data as any)?.id as string
    const stripe = await this.client()
    const intent = await stripe.paymentIntents.retrieve(id)
    return { data: { ...(intent as any), id } }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const id = (input.data as any)?.id as string
    const stripe = await this.client()
    const intent = await stripe.paymentIntents.update(id, {
      amount: toSmallestUnit(Number(input.amount), input.currency_code),
    })
    return { status: toStatus(intent.status), data: { ...(intent as any), id } }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const creds = await loadGatewayCredentials(this.container_, GATEWAY_ID)
    const webhookSecret = creds.webhook_secret as string | undefined

    let event: Stripe.Event
    try {
      if (!creds.secret_key) {
        throw new Error("no key")
      }
      const stripe = new Stripe(creds.secret_key as string, {
        apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
      })
      const signature = (payload.headers?.["stripe-signature"] ??
        payload.headers?.["Stripe-Signature"]) as string | undefined
      if (webhookSecret && signature) {
        event = stripe.webhooks.constructEvent(
          payload.rawData as string | Buffer,
          signature,
          webhookSecret
        )
      } else {
        // No signing secret configured — trust the parsed body (best-effort).
        event = payload.data as unknown as Stripe.Event
      }
    } catch (e) {
      return { action: "failed" }
    }

    const intent = event.data?.object as Stripe.PaymentIntent
    const sessionId = (intent?.metadata as any)?.session_id ?? ""
    const amount = new BigNumber(intent?.amount ?? 0)

    switch (event.type) {
      case "payment_intent.amount_capturable_updated":
        return { action: "authorized", data: { session_id: sessionId, amount } }
      case "payment_intent.succeeded":
        return { action: "captured", data: { session_id: sessionId, amount } }
      case "payment_intent.payment_failed":
        return { action: "failed", data: { session_id: sessionId, amount } }
      default:
        return { action: "not_supported" }
    }
  }
}

export default StripeGatewayProvider
