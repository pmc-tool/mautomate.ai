/**
 * Payment-gateway provider contract (plan §06). Two gateways, routed by the
 * merchant's billing country: Stripe (USD/global) and SSLCommerz (Bangladesh,
 * bKash/Nagad/cards, BDT). Both env-gated and no-throw; the wallet — not the
 * gateway — is the real-time credit gate, so gateways only handle subscription
 * charges + credit top-up checkout, reconciled via idempotent webhooks.
 *
 * Credentials are read from the encrypted platform config store first, then
 * fall back to environment variables.
 */
import Stripe from "stripe"
import { EncryptedConfigService } from "../secure-config"

const PLATFORM_SCOPE = "__platform__"

export type GatewayResult<T = unknown> = {
  ok: boolean
  data?: T
  error?: string
}

export type CheckoutSession = {
  id: string
  url: string
  provider: string
}

export type WebhookEvent = {
  /** provider + external event id → the ledger idempotency key */
  provider: string
  external_event_id: string
  type: string
  tenant_id?: string
  credits?: number
  amount_usd?: number
}

export interface PaymentGateway {
  readonly name: string
  isConfigured(): boolean | Promise<boolean>
  /** country codes this gateway serves */
  serves(country?: string): boolean
  createTopupCheckout(input: {
    tenant_id: string
    credits: number
    amount_usd: number
    success_url: string
    cancel_url: string
  }): Promise<GatewayResult<CheckoutSession>>
  /** verify + normalize a webhook into a WebhookEvent (idempotency-keyable). */
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<GatewayResult<WebhookEvent>>
}

/** Stripe — global default. Inert until STRIPE_SECRET_KEY is set. */
export class StripeGateway implements PaymentGateway {
  readonly name = "stripe"
  private readonly cfg_?: EncryptedConfigService

  constructor(cfg?: EncryptedConfigService) {
    this.cfg_ = cfg
  }

  private async secret(): Promise<string | undefined> {
    const env = process.env.STRIPE_SECRET_KEY
    if (env) return env
    try {
      return await this.cfg_?.getSecret(PLATFORM_SCOPE, "STRIPE_SECRET_KEY")
    } catch {
      return undefined
    }
  }

  private async webhookSecret(): Promise<string | undefined> {
    const env = process.env.STRIPE_WEBHOOK_SECRET
    if (env) return env
    try {
      return await this.cfg_?.getSecret(PLATFORM_SCOPE, "STRIPE_WEBHOOK_SECRET")
    } catch {
      return undefined
    }
  }

  async isConfigured(): Promise<boolean> {
    return (await this.secret()) !== undefined
  }

  private async client(): Promise<Stripe | undefined> {
    const key = await this.secret()
    if (!key) return undefined
    return new Stripe(key, { apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion })
  }

  serves(country?: string): boolean {
    return country !== "BD" // everything except Bangladesh routes to Stripe
  }

  async createTopupCheckout(input: {
    tenant_id: string
    credits: number
    amount_usd: number
    success_url: string
    cancel_url: string
  }): Promise<GatewayResult<CheckoutSession>> {
    const stripe = await this.client()
    if (!stripe) return { ok: false, error: "stripe_not_configured" }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `mAutomate credits — ${input.credits} credits` },
              unit_amount: input.amount_usd * 100,
            },
            quantity: 1,
          },
        ],
        metadata: {
          tenant_id: input.tenant_id,
          credits: String(input.credits),
          amount_usd: String(input.amount_usd),
        },
        success_url: input.success_url,
        cancel_url: input.cancel_url,
      })
      return {
        ok: true,
        data: {
          id: session.id,
          url: session.url || "",
          provider: this.name,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || "stripe_checkout_failed" }
    }
  }

  async parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<GatewayResult<WebhookEvent>> {
    const stripe = await this.client()
    if (!stripe) return { ok: false, error: "stripe_not_configured" }

    const secret = await this.webhookSecret()
    if (!secret) return { ok: false, error: "stripe_webhook_secret_not_set" }

    const sig = headers["stripe-signature"] || headers["Stripe-Signature"]
    if (!sig) return { ok: false, error: "missing_stripe_signature" }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    } catch (e: any) {
      return { ok: false, error: `stripe_signature_invalid: ${e?.message}` }
    }

    if (event.type !== "checkout.session.completed") {
      return { ok: true, data: { provider: this.name, external_event_id: event.id, type: event.type } }
    }

    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata || {}
    return {
      ok: true,
      data: {
        provider: this.name,
        external_event_id: event.id,
        type: event.type,
        tenant_id: metadata.tenant_id,
        credits: metadata.credits ? Number(metadata.credits) : undefined,
        amount_usd: metadata.amount_usd ? Number(metadata.amount_usd) : undefined,
      },
    }
  }
}

/** SSLCommerz — Bangladesh. Inert until SSLCOMMERZ_STORE_ID is set. */
export class SslcommerzGateway implements PaymentGateway {
  readonly name = "sslcommerz"
  private readonly cfg_?: EncryptedConfigService

  constructor(cfg?: EncryptedConfigService) {
    this.cfg_ = cfg
  }

  private async storeId(): Promise<string | undefined> {
    const env = process.env.SSLCOMMERZ_STORE_ID
    if (env) return env
    try {
      return await this.cfg_?.getSecret(PLATFORM_SCOPE, "SSLCOMMERZ_STORE_ID")
    } catch {
      return undefined
    }
  }

  async isConfigured(): Promise<boolean> {
    return (await this.storeId()) !== undefined
  }

  serves(country?: string): boolean {
    return country === "BD"
  }

  async createTopupCheckout(): Promise<GatewayResult<CheckoutSession>> {
    if (!(await this.isConfigured())) return { ok: false, error: "sslcommerz_not_configured" }
    return { ok: false, error: "sslcommerz_checkout_not_wired" }
  }

  async parseWebhook(): Promise<GatewayResult<WebhookEvent>> {
    if (!(await this.isConfigured())) return { ok: false, error: "sslcommerz_not_configured" }
    return { ok: false, error: "sslcommerz_webhook_not_wired" }
  }
}

/** Pick the gateway for a billing country (SSLCommerz for BD, else Stripe). */
export const gatewayForCountry = (country?: string, cfg?: EncryptedConfigService): PaymentGateway =>
  new SslcommerzGateway(cfg).serves(country)
    ? new SslcommerzGateway(cfg)
    : new StripeGateway(cfg)

export const allGateways = (cfg?: EncryptedConfigService): PaymentGateway[] => [
  new StripeGateway(cfg),
  new SslcommerzGateway(cfg),
]

/** The ledger idempotency key for a webhook — composite, NOT global. */
export const webhookIdempotencyKey = (e: {
  provider: string
  external_event_id: string
}): string => `${e.provider}:${e.external_event_id}`
