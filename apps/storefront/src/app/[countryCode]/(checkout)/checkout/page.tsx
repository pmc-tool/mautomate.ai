import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { countryCode } = await params
  const cart = await retrieveCart()

  if (!cart) {
    // Empty/expired cart: send to the cart page (friendly empty state) instead
    // of a dead 404.
    redirect(`/${countryCode}/cart`)
  }

  // The checkout steps each open based on the `?step` query param. A cart's
  // "Checkout" link (e.g. from a Liquid theme) may point at /checkout WITHOUT a
  // step — with no step the address section renders a permanent spinner. Default
  // to the first INCOMPLETE step so checkout always opens on the right form.
  const { step } = await searchParams
  if (!step) {
    const hasAddress = !!(cart.shipping_address && cart.shipping_address.address_1)
    const hasDelivery = !!(cart.shipping_methods && cart.shipping_methods.length)
    const next = !hasAddress ? "address" : !hasDelivery ? "delivery" : "payment"
    redirect(`/${countryCode}/checkout?step=${next}`)
  }

  const customer = await retrieveCustomer()

  return (
    <div className="learts-theme">
      <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
        <PaymentWrapper cart={cart}>
          <CheckoutForm cart={cart} customer={customer} />
        </PaymentWrapper>
        <CheckoutSummary cart={cart} />
      </div>
    </div>
  )
}
