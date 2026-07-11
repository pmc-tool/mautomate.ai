/**
 * Payment gateway registry — the single catalog the admin UI, the credential
 * API, and the provider modules all agree on.
 *
 * Each merchant BRINGS THEIR OWN gateway credentials. The platform never
 * touches funds: credentials are stored per-tenant in the encrypted config
 * vault (see modules/platform/secure-config.ts) and read at runtime by the
 * provider instances. This file only describes WHICH gateways exist, WHAT
 * credentials each needs, and how they map onto Medusa payment provider ids.
 *
 * A provider's runtime id in Medusa is `pp_{identifier}_{id}`. We keep
 * identifier === id for every gateway, so e.g. stripe => pp_stripe_stripe.
 */

/** A single credential field a merchant fills in for a gateway. */
export type GatewayCredential = {
  /** Vault sub-key: stored at `gateway.<gateway_id>.<key>`. */
  key: string
  /** Human label for the admin form. */
  label: string
  /** Secret values are encrypted + never returned in plain to the UI. */
  secret: boolean
  /** Optional fields are not required for a gateway to be "configured". */
  optional?: boolean
  /** One-line hint shown under the field. */
  help?: string
}

/** Checkout integration style. */
export type GatewayMode = "direct" | "redirect" | "offline"

/**
 * Merchant-facing "How to get your keys" onboarding guide. Rendered in the
 * admin Configure drawer above the credential fields so a store owner can
 * self-serve: sign up with the provider, find the right values in that
 * provider's dashboard, and paste them into the matching credential fields.
 */
export type GatewaySetupGuide = {
  /** Optional lead-in sentence shown above the steps. */
  intro?: string
  /** Short, concrete, merchant-friendly imperative steps. */
  steps: string[]
  /** Where the merchant logs in / finds the keys. */
  dashboard_url?: string
  /** Deep link straight to the API-keys screen, when one exists. */
  keys_url?: string
  /** How sandbox/test differs from live. */
  sandbox_note?: string
  /** Official integration docs. */
  docs_url?: string
}

/** A gateway definition — everything the UI needs to render + collect creds. */
export type GatewayDef = {
  /** Stable slug, e.g. "stripe". */
  id: string
  /** Medusa runtime provider id, `pp_{identifier}_{id}`. */
  provider_id: string
  /** Display name. */
  name: string
  /** One-line description. */
  blurb: string
  /** ISO-2 country codes this gateway serves, or ["*"] for global. */
  countries: string[]
  /** "direct" (card-on-page), "redirect" (hosted checkout), "offline" (manual). */
  mode: GatewayMode
  /** Credential fields the merchant provides. */
  credentials: GatewayCredential[]
  /** Emoji or short label used as a logo in the UI. */
  logo?: string
  /** Link to the gateway's API-key docs. */
  docs_url?: string
  /** In-app "How to get your keys" onboarding guide for the merchant. */
  setup_guide?: GatewaySetupGuide
}

/** Build a `pp_{identifier}_{id}` runtime id (identifier === id here). */
const providerId = (id: string): string => `pp_${id}_${id}`

export const PAYMENT_GATEWAYS: GatewayDef[] = [
  {
    id: "stripe",
    provider_id: providerId("stripe"),
    name: "Stripe",
    blurb: "Global card payments taken directly on your checkout page.",
    countries: ["*"],
    mode: "direct",
    logo: "💳",
    docs_url: "https://dashboard.stripe.com/apikeys",
    credentials: [
      { key: "secret_key", label: "Secret key", secret: true, help: "Starts with sk_live_ or sk_test_" },
      { key: "publishable_key", label: "Publishable key", secret: false, optional: true, help: "Starts with pk_" },
      { key: "webhook_secret", label: "Webhook signing secret", secret: true, optional: true, help: "Starts with whsec_" },
    ],
    setup_guide: {
      intro:
        "Stripe gives you a test set and a live set of keys. Set up with test keys, then switch to live.",
      steps: [
        "Create or log in to your Stripe account at dashboard.stripe.com.",
        "Open Developers > API keys.",
        "Copy the Secret key (sk_) into Secret key and the Publishable key (pk_) into Publishable key.",
        "For the webhook secret, open Developers > Webhooks, add an endpoint, then copy its Signing secret (whsec_).",
        "Use the Test mode toggle (top right) to reveal test keys; turn it off for live keys.",
      ],
      dashboard_url: "https://dashboard.stripe.com/apikeys",
      keys_url: "https://dashboard.stripe.com/apikeys",
      sandbox_note:
        "Test keys start with sk_test_/pk_test_, live keys with sk_live_/pk_live_. Flip Test mode to switch.",
      docs_url: "https://docs.stripe.com/keys",
    },
  },
  {
    id: "paypal",
    provider_id: providerId("paypal"),
    name: "PayPal",
    blurb: "Global hosted checkout with PayPal and card wallets.",
    countries: ["*"],
    mode: "redirect",
    logo: "🅿️",
    docs_url: "https://developer.paypal.com/dashboard/applications",
    credentials: [
      { key: "client_id", label: "Client ID", secret: false },
      { key: "client_secret", label: "Client secret", secret: true },
    ],
    setup_guide: {
      intro:
        "PayPal keys come from a REST API app you create in the Developer Dashboard.",
      steps: [
        "Log in at developer.paypal.com/dashboard with your PayPal business account.",
        "Open Apps & Credentials and use the Sandbox/Live toggle to pick the environment.",
        "Click Create App, name it, and create the app.",
        "Copy the Client ID into the Client ID field.",
        "Click Show under Secret and copy it into the Client secret field.",
      ],
      dashboard_url: "https://developer.paypal.com/dashboard/applications",
      sandbox_note:
        "Sandbox and Live each have their own Client ID and secret — pick the tab at the top of Apps & Credentials.",
      docs_url: "https://developer.paypal.com/api/rest/",
    },
  },
  {
    id: "sslcommerz",
    provider_id: providerId("sslcommerz"),
    name: "SSLCommerz",
    blurb: "Bangladesh's leading hosted payment gateway (cards, MFS, bank).",
    countries: ["BD"],
    mode: "redirect",
    logo: "🇧🇩",
    docs_url: "https://developer.sslcommerz.com/",
    credentials: [
      { key: "store_id", label: "Store ID", secret: false },
      { key: "store_passwd", label: "Store password", secret: true },
    ],
    setup_guide: {
      intro:
        "SSLCommerz emails your Store ID and Store Password when your store is approved. Test with a free sandbox store first.",
      steps: [
        "For testing, register a free sandbox store at sandbox.sslcommerz.com — credentials are issued instantly.",
        "For live, apply and complete business verification, then log in at merchant.sslcommerz.com.",
        "Find your Store ID under My Stores in the merchant panel and enter it in the Store ID field.",
        "Enter the Store Password from your registration email into the Store password field.",
        "If you lost the password, contact SSLCommerz support to have it re-issued.",
      ],
      dashboard_url: "https://merchant.sslcommerz.com/",
      sandbox_note:
        "Sandbox is at sandbox.sslcommerz.com with test credentials; live credentials come from merchant.sslcommerz.com and never mix.",
      docs_url: "https://developer.sslcommerz.com/doc/v4/",
    },
  },
  {
    id: "bkash",
    provider_id: providerId("bkash"),
    name: "bKash",
    blurb: "Bangladesh mobile-wallet checkout (bKash PGW).",
    countries: ["BD"],
    mode: "redirect",
    logo: "📱",
    docs_url: "https://developer.bka.sh/",
    credentials: [
      { key: "app_key", label: "App key", secret: false },
      { key: "app_secret", label: "App secret", secret: true },
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
    ],
    setup_guide: {
      intro:
        "bKash issues PGW (Payment Gateway) app credentials after you onboard as a merchant. A public sandbox set is available for testing.",
      steps: [
        "Apply to become a bKash merchant at bkash.com/en/business/merchant and complete KYC and the agreement.",
        "For testing, use bKash's public tokenized-checkout sandbox credentials from developer.bka.sh.",
        "For live, your bKash account manager issues your production App Key, App Secret, Username and Password.",
        "Enter them into the App key, App secret, Username and Password fields respectively.",
        "Contact bKash support (16247) or your relationship manager if you do not have production credentials yet.",
      ],
      dashboard_url: "https://developer.bka.sh/",
      sandbox_note:
        "Sandbox uses tokenized.sandbox.bka.sh with public test credentials; live uses tokenized.pay.bka.sh with keys from your account manager.",
      docs_url: "https://developer.bka.sh/",
    },
  },
  {
    id: "nagad",
    provider_id: providerId("nagad"),
    name: "Nagad",
    blurb: "Bangladesh mobile financial service checkout.",
    countries: ["BD"],
    mode: "redirect",
    logo: "🟠",
    docs_url: "https://nagad.com.bd/",
    credentials: [
      { key: "merchant_id", label: "Merchant ID", secret: false },
      { key: "public_key", label: "Nagad public key", secret: false },
      { key: "private_key", label: "Merchant private key", secret: true },
    ],
    setup_guide: {
      intro:
        "Nagad merchant keys are exchanged through the Nagad merchant onboarding team — there is no instant public signup.",
      steps: [
        "Apply as a Nagad merchant through Nagad's merchant/business team and complete onboarding.",
        "In the Nagad merchant portal, open Merchant Management > Merchant Integration Details to find your Merchant ID.",
        "Use Key Generate to create your key pair, then download and keep your Merchant Private Key.",
        "Upload your own merchant public key and set your callback URL in the portal.",
        "Nagad returns its Payment Gateway public key — put that in Nagad public key, and your downloaded key in Merchant private key.",
        "Ask Nagad for sandbox credentials (Merchant ID, private key, PG public key) to test before going live.",
      ],
      dashboard_url: "https://nagad.com.bd/",
      sandbox_note:
        "Nagad emails sandbox Merchant ID and keys for testing; production also requires Nagad to whitelist your server and callback URL.",
      docs_url: "https://nagad.com.bd/",
    },
  },
  {
    id: "razorpay",
    provider_id: providerId("razorpay"),
    name: "Razorpay",
    blurb: "India card + UPI payments taken on your checkout page.",
    countries: ["IN"],
    mode: "direct",
    logo: "🇮🇳",
    docs_url: "https://dashboard.razorpay.com/app/keys",
    credentials: [
      { key: "key_id", label: "Key ID", secret: false },
      { key: "key_secret", label: "Key secret", secret: true },
    ],
    setup_guide: {
      intro:
        "Razorpay generates a Key ID and Key Secret pair; the secret is shown only once.",
      steps: [
        "Log in to your Razorpay account at dashboard.razorpay.com.",
        "Open Settings > API Keys.",
        "Click Generate Key to create a Key ID and Key Secret.",
        "Copy the Key ID into Key ID and the Key Secret into Key secret before closing the dialog.",
        "Use the Test/Live mode switch to generate keys for the matching environment.",
      ],
      dashboard_url: "https://dashboard.razorpay.com/app/keys",
      keys_url: "https://dashboard.razorpay.com/app/keys",
      sandbox_note:
        "Test keys start with rzp_test_ and live keys with rzp_live_; switch Test/Live in the dashboard header.",
      docs_url: "https://razorpay.com/docs/api/authentication/",
    },
  },
  {
    id: "paystack",
    provider_id: providerId("paystack"),
    name: "Paystack",
    blurb: "Hosted checkout across Nigeria, Ghana, Kenya and South Africa.",
    countries: ["NG", "GH", "KE", "ZA"],
    mode: "redirect",
    logo: "🟦",
    docs_url: "https://dashboard.paystack.com/#/settings/developers",
    credentials: [
      { key: "secret_key", label: "Secret key", secret: true, help: "Starts with sk_" },
      { key: "public_key", label: "Public key", secret: false, optional: true, help: "Starts with pk_" },
    ],
    setup_guide: {
      intro:
        "Paystack shows separate test and live key pairs in your dashboard.",
      steps: [
        "Create or log in to your Paystack account at dashboard.paystack.com.",
        "Open Settings > API Keys & Webhooks.",
        "Copy the Secret key (sk_) into Secret key and the Public key (pk_) into Public key.",
        "Reveal a secret key with the eye icon — you will re-enter your password.",
        "Live keys appear only after Paystack activates your business; use test keys until then.",
      ],
      dashboard_url: "https://dashboard.paystack.com/#/settings/developer",
      keys_url: "https://dashboard.paystack.com/#/settings/developer",
      sandbox_note:
        "Test keys are sk_test_/pk_test_ and work immediately; live keys sk_live_/pk_live_ unlock after account activation.",
      docs_url: "https://paystack.com/docs/api/",
    },
  },
  {
    id: "flutterwave",
    provider_id: providerId("flutterwave"),
    name: "Flutterwave",
    blurb: "Pan-African hosted checkout (cards, mobile money, bank).",
    countries: ["NG", "KE", "GH", "ZA", "UG", "TZ"],
    mode: "redirect",
    logo: "🌍",
    docs_url: "https://dashboard.flutterwave.com/settings/apis",
    credentials: [
      { key: "secret_key", label: "Secret key", secret: true, help: "Starts with FLWSECK-" },
      { key: "public_key", label: "Public key", secret: false, optional: true, help: "Starts with FLWPUBK-" },
    ],
    setup_guide: {
      intro:
        "Flutterwave auto-creates your public key; you generate the secret key yourself.",
      steps: [
        "Log in to your Flutterwave dashboard at app.flutterwave.com.",
        "Open Settings > API Keys (under the Developers section).",
        "Copy the Public key (FLWPUBK-) into the Public key field.",
        "Generate your Secret key, then copy it (FLWSECK-) into the Secret key field.",
        "Use the Test/Live mode toggle to see the matching key set.",
      ],
      dashboard_url: "https://app.flutterwave.com/dashboard/settings/apis",
      sandbox_note:
        "Test keys carry a _TEST suffix (e.g. FLWSECK_TEST-); the live secret key must be generated manually.",
      docs_url: "https://developer.flutterwave.com/",
    },
  },
  {
    id: "mercadopago",
    provider_id: providerId("mercadopago"),
    name: "Mercado Pago",
    blurb: "Latin American hosted checkout (cards, wallets, boleto/PIX).",
    countries: ["AR", "BR", "MX", "CL", "CO"],
    mode: "redirect",
    logo: "🟡",
    docs_url: "https://www.mercadopago.com/developers/panel/app",
    credentials: [
      { key: "access_token", label: "Access token", secret: true, help: "Starts with APP_USR- or TEST-" },
    ],
    setup_guide: {
      intro:
        "Mercado Pago credentials live in a developer application you create on your country's Mercado Pago site.",
      steps: [
        "Go to your country's Mercado Pago Developers portal (e.g. mercadopago.com.br/developers or .com.ar) and log in.",
        "Open Your integrations and create an application.",
        "In the app menu, open Production credentials (or Test credentials to trial).",
        "Copy the Access token into the Access token field.",
      ],
      dashboard_url: "https://www.mercadopago.com/developers/panel/app",
      sandbox_note:
        "Test tokens start with TEST- and work immediately; production tokens start with APP_USR- and need your business info completed.",
      docs_url: "https://www.mercadopago.com.co/developers/en/docs/credentials",
    },
  },
  {
    id: "xendit",
    provider_id: providerId("xendit"),
    name: "Xendit",
    blurb: "Southeast Asia hosted checkout (Indonesia, Philippines).",
    countries: ["ID", "PH"],
    mode: "redirect",
    logo: "🟩",
    docs_url: "https://dashboard.xendit.co/settings/developers#api-keys",
    credentials: [
      { key: "secret_key", label: "Secret API key", secret: true, help: "Starts with xnd_" },
    ],
    setup_guide: {
      intro:
        "Xendit uses a single secret API key that you generate with the permissions you need.",
      steps: [
        "Create or log in to your Xendit account at dashboard.xendit.co.",
        "Open Settings > Developers > API Keys.",
        "Click Generate Secret Key, name it, and give Money-in / Payments the Write permission.",
        "Copy the key immediately (it is shown only once) into the Secret API key field.",
        "Use the Test/Live mode switch (top left) before generating to pick the environment.",
      ],
      dashboard_url: "https://dashboard.xendit.co/settings/developers#api-keys",
      keys_url: "https://dashboard.xendit.co/settings/developers#api-keys",
      sandbox_note:
        "Test keys start with xnd_development_ and live keys with xnd_production_; toggle Test/Live in the dashboard.",
      docs_url: "https://docs.xendit.co/docs/api-keys",
    },
  },
  {
    id: "midtrans",
    provider_id: providerId("midtrans"),
    name: "Midtrans",
    blurb: "Indonesia hosted checkout (Snap).",
    countries: ["ID"],
    mode: "redirect",
    logo: "🔵",
    docs_url: "https://dashboard.midtrans.com/settings/config_info",
    credentials: [
      { key: "server_key", label: "Server key", secret: true },
      { key: "client_key", label: "Client key", secret: false, optional: true },
    ],
    setup_guide: {
      intro:
        "Midtrans keeps separate Sandbox and Production access keys in the Merchant Portal.",
      steps: [
        "Create or log in to your Midtrans account at dashboard.midtrans.com.",
        "Use the environment dropdown (top left) to choose Sandbox or Production.",
        "Open Settings > Access Keys.",
        "Copy the Server Key into Server key and the Client Key into Client key.",
        "Repeat in the other environment when you are ready to go live — the keys differ per environment.",
      ],
      dashboard_url: "https://dashboard.midtrans.com/settings/config_info",
      keys_url: "https://dashboard.midtrans.com/settings/config_info",
      sandbox_note:
        "Sandbox and Production have different Server/Client keys; switch with the environment dropdown before copying.",
      docs_url: "https://docs.midtrans.com/docs/access-keys",
    },
  },
  {
    // Always-available manual fallback so a store can accept orders before any
    // real gateway is configured. Maps onto Medusa's built-in system provider,
    // so there is no custom provider module and no credentials to collect.
    id: "bank_transfer",
    provider_id: "pp_system_default",
    name: "Bank transfer / manual",
    blurb: "Accept orders and settle payment manually (offline).",
    countries: ["*"],
    mode: "offline",
    logo: "🏦",
    credentials: [],
    setup_guide: {
      intro:
        "No keys needed. Bank transfer shows shoppers your bank account details at checkout so they can pay you manually.",
      steps: [
        "Enable Bank transfer to offer it as a manual, offline payment option.",
        "At checkout, shoppers see your bank details and place the order marked as awaiting payment.",
        "The shopper transfers the amount to your bank account using their own banking app.",
        "Confirm the payment in your bank, then mark the order as paid to fulfil it.",
      ],
    },
  },
]

/** Look a gateway up by its slug id. */
export const gatewayById = (id: string): GatewayDef | undefined =>
  PAYMENT_GATEWAYS.find((g) => g.id === id)

/** Look a gateway up by its Medusa runtime provider id. */
export const gatewayByProviderId = (providerRuntimeId: string): GatewayDef | undefined =>
  PAYMENT_GATEWAYS.find((g) => g.provider_id === providerRuntimeId)

/** The credential keys that MUST be present for a gateway to be usable. */
export const requiredCredentialKeys = (gateway: GatewayDef): string[] =>
  gateway.credentials.filter((c) => !c.optional).map((c) => c.key)

/** The required SECRET credential keys (subset of the above). */
export const requiredSecretKeys = (gateway: GatewayDef): string[] =>
  gateway.credentials.filter((c) => c.secret && !c.optional).map((c) => c.key)

/** Vault storage key for a gateway credential field. */
export const vaultKey = (gatewayId: string, field: string): string =>
  `gateway.${gatewayId}.${field}`

/**
 * Gateways available for a country: global gateways (["*"]) plus any whose
 * `countries` list contains the given ISO-2 code. Pass "*" to get everything.
 */
export const gatewaysForCountry = (iso2: string): GatewayDef[] => {
  const code = (iso2 || "").toUpperCase()
  if (code === "*") {
    return [...PAYMENT_GATEWAYS]
  }
  return PAYMENT_GATEWAYS.filter(
    (g) => g.countries.includes("*") || g.countries.includes(code)
  )
}

/** True when a gateway serves the given country (or is global). */
export const gatewayServesCountry = (gateway: GatewayDef, iso2: string): boolean => {
  const code = (iso2 || "").toUpperCase()
  if (code === "*") {
    return true
  }
  return gateway.countries.includes("*") || gateway.countries.includes(code)
}
