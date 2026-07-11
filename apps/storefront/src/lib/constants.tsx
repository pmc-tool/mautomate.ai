import { Bolt, CreditCard, CurrencyDollar, GlobeEurope } from "@medusajs/icons"
import Bancontact from "@modules/common/icons/bancontact"
import Ideal from "@modules/common/icons/ideal"
import PayPal from "@modules/common/icons/paypal"
import React from "react"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_medusa-payments_default": {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_sslcommerz_sslcommerz: {
    title: "SSLCommerz",
    icon: <CreditCard />,
  },
  pp_bkash_bkash: {
    title: "bKash",
    icon: <CurrencyDollar />,
  },
  pp_nagad_nagad: {
    title: "Nagad",
    icon: <CurrencyDollar />,
  },
  pp_razorpay_razorpay: {
    title: "Razorpay",
    icon: <CreditCard />,
  },
  pp_paystack_paystack: {
    title: "Paystack",
    icon: <CreditCard />,
  },
  pp_flutterwave_flutterwave: {
    title: "Flutterwave",
    icon: <GlobeEurope />,
  },
  pp_mercadopago_mercadopago: {
    title: "Mercado Pago",
    icon: <GlobeEurope />,
  },
  pp_xendit_xendit: {
    title: "Xendit",
    icon: <GlobeEurope />,
  },
  pp_midtrans_midtrans: {
    title: "Midtrans",
    icon: <Bolt />,
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
  // Add more payment providers here
}

// Redirect (hosted checkout) providers. Their backend initiatePayment returns a
// session `data.redirect_url` pointing at the gateway's hosted checkout page.
// The storefront must send the shopper there instead of completing the cart
// in-page. Keep this list in sync with the backend redirect-mode providers.
const REDIRECT_PROVIDER_PREFIXES = [
  "pp_sslcommerz_",
  "pp_paypal_",
  "pp_bkash_",
  "pp_nagad_",
  "pp_razorpay_",
  "pp_paystack_",
  "pp_flutterwave_",
  "pp_mercadopago_",
  "pp_xendit_",
  "pp_midtrans_",
]

export const isRedirectProvider = (providerId?: string) => {
  if (!providerId) {
    return false
  }
  return REDIRECT_PROVIDER_PREFIXES.some((prefix) =>
    providerId.startsWith(prefix)
  )
}

// This only checks if it is native stripe or medusa payments for card payments, it ignores the other stripe-based providers
export const isStripeLike = (providerId?: string) => {
  return (
    providerId?.startsWith("pp_stripe_") || providerId?.startsWith("pp_medusa-")
  )
}

export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
