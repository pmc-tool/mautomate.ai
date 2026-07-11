import { getCartId } from "@lib/data/cookies"
import PaymentReturn from "@modules/checkout/components/payment-return"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Confirming payment",
  description: "Confirming your payment and placing your order",
}

type Props = {
  params: Promise<{ countryCode: string; gateway: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Landing page the gateway redirects the shopper to after a successful payment.
// The gateway may echo the cart id back as a query param (e.g. ?cart_id=...),
// but the httpOnly cart cookie is still set at this point (the cart was never
// completed before the redirect), so we fall back to it.
export default async function PaymentSuccessPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams

  const rawCartId =
    searchParams.cart_id ?? searchParams.cartId ?? searchParams.cart

  const queryCartId = Array.isArray(rawCartId) ? rawCartId[0] : rawCartId
  const cartId = queryCartId || (await getCartId())

  return (
    <div className="content-container">
      <PaymentReturn countryCode={params.countryCode} cartId={cartId} />
    </div>
  )
}
