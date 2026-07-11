import { Metadata } from "next"
import { draftMode } from "next/headers"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { WishlistProvider } from "@lib/context/wishlist-context"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import ChromeStyles from "@modules/layout/components/chrome-styles"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

/**
 * Preview-mode banner — server component, rendered only when Next draftMode is
 * enabled. Signals that unpublished DRAFT content is being shown and links to
 * /api/cms/exit-preview to leave preview mode.
 */
function PreviewBanner() {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: "#1f1f1f",
        color: "#fff",
        fontFamily: "Jost, sans-serif",
        fontSize: 13,
        lineHeight: 1.4,
        padding: "8px 16px",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <span>
        Preview mode — you are viewing unpublished draft content.
      </span>
      <a
        href="/api/cms/exit-preview"
        style={{
          color: "#72a499",
          textDecoration: "underline",
          fontWeight: 600,
        }}
      >
        Exit preview
      </a>
    </div>
  )
}

export default async function PageLayout(props: { children: React.ReactNode }) {
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()
  const { isEnabled: isPreview } = await draftMode()
  let shippingOptions: StoreCartShippingOption[] = []

  if (cart) {
    const { shipping_options } = await listCartOptions()

    shippingOptions = shipping_options
  }

  return (
    <>
      {/* F1: scoped chrome (topbar/header/footer) CSS — applies live-storefront
          chrome styling identically to the editor. Renders nothing when unset. */}
      <ChromeStyles />
      {isPreview && <PreviewBanner />}
      <WishlistProvider>
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {cart && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          shippingOptions={shippingOptions}
        />
      )}
      {props.children}
      <Footer />
      </WishlistProvider>
    </>
  )
}
