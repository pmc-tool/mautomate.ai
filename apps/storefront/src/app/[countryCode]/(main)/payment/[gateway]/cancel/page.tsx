import InteractiveLink from "@modules/common/components/interactive-link"
import { Heading, Text } from "@modules/common/components/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Payment cancelled",
  description: "Your payment was cancelled",
}

// Landing page the gateway redirects the shopper to when they cancel the hosted
// checkout. The cart was never completed, so the cart cookie is intact and
// returning to checkout restores the shopper's cart as-is.
export default function PaymentCancelPage() {
  return (
    <div className="content-container">
      <div className="flex flex-col items-center justify-center gap-y-4 py-48 px-2 text-center">
        <Heading level="h1" className="text-2xl-semi">
          Payment cancelled
        </Heading>
        <Text className="text-base-regular max-w-[32rem] text-ui-fg-subtle">
          You cancelled the payment and have not been charged. Your cart is
          still saved — you can return to checkout whenever you're ready to
          complete your order.
        </Text>
        <InteractiveLink href="/checkout?step=payment">
          Return to checkout
        </InteractiveLink>
      </div>
    </div>
  )
}
