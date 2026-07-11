"use client"

import { completeCartReturn } from "@lib/data/cart"
import { Heading, Text } from "@modules/common/components/ui"
import InteractiveLink from "@modules/common/components/interactive-link"
import Spinner from "@modules/common/icons/spinner"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

// How persistently we retry completing the cart while the gateway webhook lands.
const MAX_ATTEMPTS = 10
const RETRY_DELAY_MS = 2000

type PaymentReturnProps = {
  countryCode: string
  cartId?: string
}

const PaymentReturn = ({ countryCode, cartId }: PaymentReturnProps) => {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const startedRef = useRef(false)

  const confirm = useCallback(async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = await completeCartReturn(cartId)

      if (result.status === "order") {
        const cc = result.countryCode || countryCode
        router.replace(`/${cc}/order/${result.orderId}/confirmed`)
        return
      }

      if (result.status === "error") {
        setFailed(true)
        return
      }

      // Still pending — wait for the webhook to authorize, then retry.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }

    setFailed(true)
  }, [cartId, countryCode, router])

  useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true
    confirm()
  }, [confirm])

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 py-48 px-2 text-center">
        <Heading level="h1" className="text-2xl-semi">
          We're still confirming your payment
        </Heading>
        <Text className="text-base-regular max-w-[32rem] text-ui-fg-subtle">
          Your payment may still be processing. If you were charged, your order
          will appear in your account shortly. You can safely return to checkout
          to review your cart.
        </Text>
        <InteractiveLink href="/checkout?step=review">
          Return to checkout
        </InteractiveLink>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-y-4 py-48 px-2 text-center">
      <Spinner size="28" />
      <Heading level="h1" className="text-2xl-semi">
        Confirming your payment…
      </Heading>
      <Text className="text-base-regular max-w-[32rem] text-ui-fg-subtle">
        Please wait while we confirm your payment and place your order. This can
        take a few moments — do not close this window.
      </Text>
    </div>
  )
}

export default PaymentReturn
