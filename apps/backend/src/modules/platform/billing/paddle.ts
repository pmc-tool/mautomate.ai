import crypto from "crypto"
import type { EncryptedConfigService } from "../secure-config"
import type {
  PaymentGateway,
  GatewayResult,
  CheckoutSession,
  WebhookEvent,
} from "./provider"

/**
 * Paddle Billing gateway — the platform's main payment rail (Merchant of
 * Record) for subscriptions + AI-credit top-ups. Uses Paddle's HOSTED checkout
 * (create a transaction → redirect to transaction.checkout.url), so it drops
 * straight into the existing `checkout_url` flow with no storefront change.
 *
 * Config (env, or a real env var wins over the vault via ensurePlatformEnv):
 *   PADDLE_API_KEY         server API key (pdl_sdbx_... sandbox / pdl_live_...)
 *   PADDLE_ENV             "sandbox" (default) | "live"
 *   PADDLE_WEBHOOK_SECRET  notification-destination secret (signature verify)
 *   PADDLE_PRICE_<PLAN>    optional per-plan price id override (else the map below)
 */

const isLive = () => process.env.PADDLE_ENV === "live"
const apiBase = () =>
  isLive() ? "https://api.paddle.com" : "https://sandbox-api.paddle.com"

// Price ids created in this Paddle account (sandbox). Override per plan with
// PADDLE_PRICE_STARTER etc. Recreate + update these when going live.
// Billing cycles offered on every paid plan; months paid per cycle. Kept in
// lockstep with the public pricing page (mautomate.ai lib/plans.js) and the
// dashboard billing page.
export const PLAN_BILLING_MONTHS: Record<string, number> = {
  monthly: 1,
  "6months": 6,
  yearly: 12,
}
const PLAN_PRICE: Record<string, Record<string, string>> = {
  starter: {
    monthly: "pri_01ky743pf8p9zeyh12m3dqsrkq",
    "6months": "pri_01ky743psxwhe77yq591j5sj9n",
    yearly: "pri_01ky743q462gs2nd8hfdzjptj8",
  },
  growth: {
    monthly: "pri_01ky743ram8p0b77hrpr82dc6j",
    "6months": "pri_01ky743rmkg6c0668x0p4aes0b",
    yearly: "pri_01ky743rydgtp78xkba3ec58td",
  },
  pro: {
    monthly: "pri_01ky743sj4pe9hem74h2383c5n",
    "6months": "pri_01ky743svmwg98qqzfxsd8qhr6",
    yearly: "pri_01ky743t56z7hp5tsjh6xm9bdy",
  },
  scale: {
    monthly: "pri_01ky743tsprg67rc5kj0edda52",
    "6months": "pri_01ky743v3g55n4vq5qxsx5s4kt",
    yearly: "pri_01ky743vcwn595cj1xhgtjvdk5",
  },
}
const PACK_PRICE: Record<number, string> = {
  1000: "pri_01ky6t4ejdrnzhedrtavy738y2",
  5000: "pri_01ky6t4fe69bgd37924v4jpqn6",
  15000: "pri_01ky6t4g4veh6rgc3k21gnzc22",
  50000: "pri_01ky6t4hfkrpwc9hkzqfssk2eg",
}

/* One "credit unit" price powers EVERY top-up: 1 credit = $0.01, charged
 * with a Paddle quantity equal to the CREDIT COUNT — so the checkout line
 * reads "AI Credits · Qty 3700 — $37.00" (the quantity IS the credits, no
 * translation for the buyer) and any amount is purchasable to the cent
 * ($1.20 = exactly 120 credits; min 100 credits = $1). This keeps the
 * webhook invariant (credits granted = verified paid USD x 100) EXACTLY
 * equal to what was advertised. The id comes from PADDLE_PRICE_CREDIT_UNIT,
 * or is created once via the Paddle API and cached. */
const CREDIT_UNIT_CREDITS = 1
let cachedUnitPriceId: string | undefined
let cachedAddonStorePriceId: string | undefined

const planPrice = (key: string, billing = "monthly"): string | undefined =>
  process.env[`PADDLE_PRICE_${key.toUpperCase()}_${billing.toUpperCase()}`] ||
  PLAN_PRICE[key]?.[billing]

export class PaddleGateway implements PaymentGateway {
  readonly name = "paddle"
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private cfg?: EncryptedConfigService) {}

  private apiKey(): string | undefined {
    return process.env.PADDLE_API_KEY
  }
  private webhookSecret(): string | undefined {
    return process.env.PADDLE_WEBHOOK_SECRET
  }

  isConfigured(): boolean {
    return !!this.apiKey()
  }
  // Merchant of Record — serves everywhere. Primary gateway.
  serves(): boolean {
    return true
  }

  /** Create a Paddle transaction and return its hosted-checkout URL. */
  private async createTransaction(
    priceId: string,
    customData: Record<string, unknown>,
    quantity = 1
  ): Promise<GatewayResult<CheckoutSession>> {
    const key = this.apiKey()
    if (!key) return { ok: false, error: "Paddle is not configured (missing API key)." }
    try {
      const res = await fetch(`${apiBase()}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity }],
          custom_data: customData,
          collection_mode: "automatic",
        }),
      })
      const d: any = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: d?.error?.detail || `Paddle error ${res.status}` }
      }
      const txnId = d?.data?.id
      if (!txnId) {
        return { ok: false, error: "Paddle returned no transaction id." }
      }
      // Paddle Billing checkout is a Paddle.js overlay. Point at our overlay
      // page (served on the approved merchant domain), which opens the overlay
      // for this transaction. Independent of the dashboard Default Payment Link.
      const overlay =
        process.env.PADDLE_CHECKOUT_URL || "https://merchant.mautomate.ai/checkout"
      const url = `${overlay}?_ptxn=${encodeURIComponent(String(txnId))}`
      return { ok: true, data: { id: String(txnId), url, provider: "paddle" } }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Paddle request failed" }
    }
  }

  async createSubscriptionCheckout(input: {
    tenant_id: string
    plan_key: string
    plan_name: string
    amount_usd: number
    billing?: string
    success_url: string
    cancel_url: string
  }): Promise<GatewayResult<CheckoutSession>> {
    const billing = PLAN_BILLING_MONTHS[input.billing ?? ""] ? input.billing! : "monthly"
    const priceId = planPrice(input.plan_key, billing)
    if (!priceId) {
      return { ok: false, error: `No Paddle price for plan "${input.plan_key}" (${billing}).` }
    }
    return this.createTransaction(priceId, {
      tenant_id: input.tenant_id,
      kind: "subscription",
      plan_key: input.plan_key,
      billing,
    })
  }

  /** Resolve (or lazily create) the 100-credit unit price. */
  private async unitPriceId(): Promise<string | undefined> {
    const fromEnv = process.env.PADDLE_PRICE_CREDIT_UNIT
    if (fromEnv) return fromEnv
    if (cachedUnitPriceId) return cachedUnitPriceId
    const key = this.apiKey()
    if (!key) return undefined
    try {
      // A DEDICATED product, so the checkout line reads "AI Credits · Qty N"
      // — billing the unit against a pack's product made the overlay show the
      // pack's name ("1,000 AI Credits · Qty 2" for a 200-credit purchase).
      const productRes = await fetch(`${apiBase()}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "AI Credits",
          description:
            "mAutomate AI credits, sold in 100-credit units ($1 per 100). Purchased credits never expire.",
          tax_category: "standard",
        }),
      })
      const productBody: any = await productRes.json().catch(() => ({}))
      const productId = productBody?.data?.id
      if (!productId) return undefined
      const res = await fetch(`${apiBase()}/prices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: productId,
          name: "AI credit",
          description: "1 AI credit ($0.01)",
          unit_price: { amount: "1", currency_code: "USD" },
          quantity: { minimum: 100, maximum: 1000000 },
          tax_mode: "account_setting",
        }),
      })
      const d: any = await res.json().catch(() => ({}))
      const id = d?.data?.id ? String(d.data.id) : undefined
      if (id) {
        cachedUnitPriceId = id
        // eslint-disable-next-line no-console
        console.log(
          `[paddle] created credit-unit price ${id} — set PADDLE_PRICE_CREDIT_UNIT=${id} to pin it across restarts`
        )
      }
      return id
    } catch {
      return undefined
    }
  }

  /** Resolve (or lazily create) the $49/mo additional-store price (M2). */
  private async addonStorePriceId(): Promise<string | undefined> {
    const fromEnv = process.env.PADDLE_PRICE_ADDON_STORE
    if (fromEnv) return fromEnv
    if (cachedAddonStorePriceId) return cachedAddonStorePriceId
    const key = this.apiKey()
    if (!key) return undefined
    try {
      const productRes = await fetch(`${apiBase()}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Additional store",
          description:
            "An additional mAutomate store on a Scale account. Billed monthly per store.",
          tax_category: "standard",
        }),
      })
      const productBody: any = await productRes.json().catch(() => ({}))
      const productId = productBody?.data?.id
      if (!productId) return undefined
      const res = await fetch(`${apiBase()}/prices`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: productId,
          name: "Additional store (monthly)",
          description: "One additional store, $49/month",
          unit_price: { amount: "4900", currency_code: "USD" },
          billing_cycle: { interval: "month", frequency: 1 },
          tax_mode: "account_setting",
        }),
      })
      const d: any = await res.json().catch(() => ({}))
      const id = d?.data?.id ? String(d.data.id) : undefined
      if (id) {
        cachedAddonStorePriceId = id
        // eslint-disable-next-line no-console
        console.log(
          `[paddle] created addon-store price ${id} — set PADDLE_PRICE_ADDON_STORE=${id} to pin it across restarts`
        )
      }
      return id
    } catch {
      return undefined
    }
  }

  /**
   * Checkout for one ADDITIONAL store (multi-store M2). The store does not
   * exist yet — the webhook provisions it only after Paddle confirms payment
   * (paid-first rule). custom_data carries everything provisioning needs.
   */
  async createAddonStoreCheckout(input: {
    payer_tenant_id: string
    owner_merchant_id: string
    slug: string
    name: string
  }): Promise<GatewayResult<CheckoutSession>> {
    const priceId = await this.addonStorePriceId()
    if (!priceId) {
      return { ok: false, error: "Additional-store billing is not configured." }
    }
    return this.createTransaction(priceId, {
      kind: "addon_store",
      tenant_id: input.payer_tenant_id,
      owner_merchant_id: input.owner_merchant_id,
      store_slug: input.slug,
      store_name: input.name,
    })
  }

  async createTopupCheckout(input: {
    tenant_id: string
    credits: number
    amount_usd: number
    success_url: string
    cancel_url: string
  }): Promise<GatewayResult<CheckoutSession>> {
    // Preferred path: the 1-credit unit price × quantity, which supports ANY
    // amount to the cent and charges exactly credits/100 USD — the webhook's
    // paid-amount derived grant equals the advertised credits to the credit,
    // and the checkout quantity IS the credit count.
    const unit = await this.unitPriceId()
    if (unit) {
      const units = Math.max(100, Math.round(input.credits / CREDIT_UNIT_CREDITS))
      return this.createTransaction(
        unit,
        {
          tenant_id: input.tenant_id,
          kind: "topup",
          credits: units * CREDIT_UNIT_CREDITS,
        },
        units
      )
    }
    // Fallback: the legacy fixed packs (exact sizes only).
    const priceId = PACK_PRICE[input.credits]
    if (!priceId) return { ok: false, error: `No Paddle pack for ${input.credits} credits.` }
    return this.createTransaction(priceId, {
      tenant_id: input.tenant_id,
      kind: "topup",
      credits: input.credits,
    })
  }

  /** Verify the Paddle-Signature and normalize the event. */
  async parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<GatewayResult<WebhookEvent>> {
    const secret = this.webhookSecret()
    if (!secret) return { ok: false, error: "Paddle webhook secret not set." }
    const sig = headers["paddle-signature"] || headers["Paddle-Signature"] || ""
    if (!sig) return { ok: false, error: "Missing Paddle-Signature header." }

    // Header format: "ts=1700000000;h1=<hex>"
    const map: Record<string, string> = {}
    for (const part of sig.split(";")) {
      const i = part.indexOf("=")
      if (i > 0) map[part.slice(0, i).trim()] = part.slice(i + 1).trim()
    }
    const ts = map.ts
    const h1 = map.h1
    if (!ts || !h1) return { ok: false, error: "Malformed Paddle-Signature." }
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${ts}:${rawBody}`, "utf8")
      .digest("hex")
    const a = Buffer.from(h1)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "Bad Paddle signature." }
    }

    let ev: any
    try {
      ev = JSON.parse(rawBody)
    } catch {
      return { ok: false, error: "Bad JSON." }
    }
    const data = ev?.data ?? {}
    const cd = data?.custom_data ?? {}
    const eid = String(ev?.event_id ?? data?.id ?? "")
    const grand = Number(
      data?.details?.totals?.grand_total ?? data?.totals?.grand_total ?? 0
    )
    const amount_paid_usd = grand ? grand / 100 : undefined
    const base = {
      provider: "paddle",
      external_event_id: eid,
      tenant_id: cd.tenant_id ? String(cd.tenant_id) : undefined,
    }

    switch (ev?.event_type) {
      case "transaction.completed": {
        if (cd.kind === "topup") {
          return {
            ok: true,
            data: {
              ...base,
              type: "checkout.session.completed",
              credits: Number(cd.credits) || undefined,
              amount_paid_usd,
            },
          }
        }
        // Multi-store M2: a paid additional-store checkout. The webhook route
        // provisions the store from these fields (paid-first rule).
        if (cd.kind === "addon_store") {
          return {
            ok: true,
            data: {
              ...base,
              type: "checkout.session.completed",
              purchase_kind: "addon_store",
              addon_store: {
                owner_merchant_id: String(cd.owner_merchant_id ?? ""),
                slug: String(cd.store_slug ?? ""),
                name: String(cd.store_name ?? cd.store_slug ?? ""),
                subscription_id: data?.subscription_id
                  ? String(data.subscription_id)
                  : undefined,
              },
              amount_paid_usd,
            },
          }
        }
        // subscription: first payment vs recurring renewal
        const renewal =
          data?.origin === "subscription_recurring" ||
          data?.origin === "subscription_charge"
        return {
          ok: true,
          data: {
            ...base,
            type: renewal ? "invoice.paid" : "checkout.session.completed",
            plan_key: cd.plan_key ? String(cd.plan_key) : undefined,
            billing: cd.billing ? String(cd.billing) : undefined,
            stripe_subscription_id: data?.subscription_id
              ? String(data.subscription_id)
              : undefined,
            amount_paid_usd,
          },
        }
      }
      case "transaction.payment_failed":
        return {
          ok: true,
          data: { ...base, type: "invoice.payment_failed", plan_key: cd.plan_key },
        }
      case "subscription.canceled":
        return {
          ok: true,
          data: {
            ...base,
            type: "customer.subscription.deleted",
            // Multi-store M2: an addon-store subscription cancels the ADDON
            // tenant (looked up by slug in the route), not the payer tenant.
            purchase_kind: cd.kind === "addon_store" ? "addon_store" : undefined,
            addon_store:
              cd.kind === "addon_store"
                ? { slug: String(cd.store_slug ?? ""), owner_merchant_id: String(cd.owner_merchant_id ?? "") }
                : undefined,
          },
        }
      default:
        // Acknowledged but no action (subscription.created/updated, etc).
        return { ok: true, data: { ...base, type: String(ev?.event_type ?? "unknown") } }
    }
  }
}
