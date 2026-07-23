import { PaddleGateway } from "./paddle"
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

/** A one-off purchase that is NOT credits (a domain registration, etc). */
export type PurchaseEvent = {
  /** What was bought — routes the webhook to the right fulfilment. */
  purchase_kind?: string
  /** Our own order id, so fulfilment is idempotent and traceable. */
  purchase_ref?: string
}

export type SubscriptionEvent = {
  /** Which plan the tenant is now on. */
  plan_key?: string
  /** End of the paid period — plan credits expire here. */
  period_end?: Date
  stripe_customer_id?: string
  stripe_subscription_id?: string
}

export type WebhookEvent = SubscriptionEvent & PurchaseEvent & {
  /** provider + external event id → the ledger idempotency key */
  provider: string
  external_event_id: string
  type: string
  tenant_id?: string
  credits?: number
  amount_usd?: number
  /**
   * The amount the gateway VERIFIED was actually charged (major units, from
   * Stripe `amount_total`). Unlike `amount_usd`/`credits` (echoed from
   * client-set checkout metadata), this is authoritative and is what the credit
   * grant must be derived from. See the top-up underpayment fix (P1).
   */
  amount_paid_usd?: number
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
  /**
   * A one-off purchase paid with a CARD, not credits — e.g. a domain, which is
   * a real registrar invoice we pass through with a margin. Credits are for AI;
   * money is for money.
   */
  createPurchaseCheckout?(input: {
    tenant_id: string
    kind: string
    ref: string
    description: string
    amount_usd: number
    success_url: string
    cancel_url: string
  }): Promise<GatewayResult<CheckoutSession>>
  /** Start a RECURRING subscription for a plan (the real revenue engine). */
  createSubscriptionCheckout?(input: {
    tenant_id: string
    plan_key: string
    plan_name: string
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

  async createPurchaseCheckout(input: {
    tenant_id: string
    kind: string
    ref: string
    description: string
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
              product_data: { name: input.description },
              unit_amount: Math.round(input.amount_usd * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          tenant_id: input.tenant_id,
          purchase_kind: input.kind,
          purchase_ref: input.ref,
          amount_usd: String(input.amount_usd),
        },
        success_url: input.success_url,
        cancel_url: input.cancel_url,
      })
      return { ok: true, data: { id: session.id, url: session.url || "", provider: this.name } }
    } catch (e: any) {
      return { ok: false, error: e?.message || "stripe_purchase_checkout_failed" }
    }
  }

  /**
   * A real recurring subscription. Stripe bills the card every month and sends
   * `invoice.paid` — that webhook is what grants the monthly credit allowance,
   * so credits and money can never drift apart.
   */
  async createSubscriptionCheckout(input: {
    tenant_id: string
    plan_key: string
    plan_name: string
    amount_usd: number
    success_url: string
    cancel_url: string
  }): Promise<GatewayResult<CheckoutSession>> {
    const stripe = await this.client()
    if (!stripe) return { ok: false, error: "stripe_not_configured" }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `mAutomate ${input.plan_name}` },
              unit_amount: Math.round(input.amount_usd * 100),
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        metadata: {
          tenant_id: input.tenant_id,
          plan_key: input.plan_key,
        },
        subscription_data: {
          metadata: { tenant_id: input.tenant_id, plan_key: input.plan_key },
        },
        success_url: input.success_url,
        cancel_url: input.cancel_url,
      })
      return { ok: true, data: { id: session.id, url: session.url || "", provider: this.name } }
    } catch (e: any) {
      return { ok: false, error: e?.message || "stripe_subscription_checkout_failed" }
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

    const base = { provider: this.name, external_event_id: event.id, type: event.type }

    // A renewal payment landed — this is what grants next month's credits.
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const inv = event.data.object as any
      const sub = inv.subscription as string | undefined
      let meta: Record<string, string> = {}
      let periodEnd: Date | undefined
      if (sub) {
        try {
          const s: any = await stripe.subscriptions.retrieve(sub)
          meta = (s.metadata || {}) as Record<string, string>
          if (s.current_period_end) periodEnd = new Date(s.current_period_end * 1000)
        } catch {
          /* fall through with what the invoice carries */
        }
      }
      return {
        ok: true,
        data: {
          ...base,
          tenant_id: meta.tenant_id ?? inv.metadata?.tenant_id,
          plan_key: meta.plan_key ?? inv.metadata?.plan_key,
          period_end: periodEnd,
          stripe_customer_id: typeof inv.customer === "string" ? inv.customer : undefined,
          stripe_subscription_id: sub,
          amount_usd: typeof inv.amount_paid === "number" ? inv.amount_paid / 100 : undefined,
        },
      }
    }

    // Cancelled / lapsed subscription.
    if (event.type === "customer.subscription.deleted") {
      const s = event.data.object as any
      const meta = (s.metadata || {}) as Record<string, string>
      return {
        ok: true,
        data: {
          ...base,
          tenant_id: meta.tenant_id,
          plan_key: meta.plan_key,
          stripe_subscription_id: s.id,
        },
      }
    }

    if (event.type !== "checkout.session.completed") {
      return { ok: true, data: base }
    }

    const session = event.data.object as Stripe.Checkout.Session
    const metadata = session.metadata || {}
    return {
      ok: true,
      data: {
        ...base,
        tenant_id: metadata.tenant_id,
        credits: metadata.credits ? Number(metadata.credits) : undefined,
        amount_usd: metadata.amount_usd ? Number(metadata.amount_usd) : undefined,
        // Authoritative charged amount (Stripe-verified), NOT from metadata.
        // The credit grant is computed from this so forged metadata can't
        // inflate the top-up.
        amount_paid_usd:
          typeof session.amount_total === "number"
            ? session.amount_total / 100
            : undefined,
        plan_key: metadata.plan_key,
        purchase_kind: metadata.purchase_kind,
        purchase_ref: metadata.purchase_ref,
        stripe_customer_id:
          typeof session.customer === "string" ? session.customer : undefined,
        stripe_subscription_id:
          typeof session.subscription === "string" ? session.subscription : undefined,
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
export const gatewayForCountry = (country?: string, cfg?: EncryptedConfigService): PaymentGateway => {
  const paddle = new PaddleGateway(cfg)
  if (paddle.isConfigured()) return paddle
  return new SslcommerzGateway(cfg).serves(country)
    ? new SslcommerzGateway(cfg)
    : new StripeGateway(cfg)
}

export const allGateways = (cfg?: EncryptedConfigService): PaymentGateway[] => [
  new StripeGateway(cfg),
  new SslcommerzGateway(cfg),
]

/** The ledger idempotency key for a webhook — composite, NOT global. */
export const webhookIdempotencyKey = (e: {
  provider: string
  external_event_id: string
}): string => `${e.provider}:${e.external_event_id}`
