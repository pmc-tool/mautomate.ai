import { Metadata } from "next"
import { draftMode } from "next/headers"

import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { WishlistProvider } from "@lib/context/wishlist-context"
import { getBaseURL } from "@lib/util/env"
import { StoreCartShippingOption } from "@medusajs/types"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import ChatWidgetMount from "@modules/marketing-chat/chat-widget-mount"
import ChromeStyles from "@modules/layout/components/chrome-styles"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"
import {
  getLiquidChrome,
  getThemeBranding,
  brandingCss,
  LiquidChromeHead,
} from "@modules/theme-runtime/chrome"

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

export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const customer = await retrieveCustomer()
  const cart = await retrieveCart()
  const { isEnabled: isPreview } = await draftMode()
  let shippingOptions: StoreCartShippingOption[] = []

  if (cart) {
    const { shipping_options } = await listCartOptions()

    shippingOptions = shipping_options
  }

  // The store's own theme chrome for the React pages that remain after the
  // Liquid migration (order confirmation, payment, account fallback). The
  // theme's header/footer render server-side — NO theme.js on these
  // surfaces — so they finally match the rest of the storefront. Falls back
  // to the base Nav/Footer whenever the theme has no chrome.
  const [liquidChrome, branding] = await Promise.all([
    getLiquidChrome(countryCode).catch(() => null),
    getThemeBranding().catch(() => null),
  ])

  return (
    <>
      {/* F1: scoped chrome (topbar/header/footer) CSS — applies live-storefront
          chrome styling identically to the editor. Renders nothing when unset. */}
      <ChromeStyles />
      {isPreview && <PreviewBanner />}
      {liquidChrome && <LiquidChromeHead chrome={liquidChrome} />}
      {branding && (
        <style dangerouslySetInnerHTML={{ __html: brandingCss(branding) }} />
      )}
      <WishlistProvider>
      {liquidChrome ? (
        <div
          data-liquid-chrome
          className={liquidChrome.bodyClass}
          dangerouslySetInnerHTML={{ __html: liquidChrome.header }}
        />
      ) : (
        <Nav />
      )}
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
      <div data-theme-branded={branding ? "" : undefined}>
        {props.children}
      </div>
      {liquidChrome ? (
        <div
          data-liquid-chrome
          className={liquidChrome.bodyClass}
          dangerouslySetInnerHTML={{ __html: liquidChrome.footer }}
        />
      ) : (
        <Footer />
      )}
      {/* A-2: the store's own chatbot. Renders only when THIS tenant has an
          active chatbot (see chat-widget-mount) — nothing otherwise. */}
      <ChatWidgetMount />
      </WishlistProvider>
    </>
  )
}
