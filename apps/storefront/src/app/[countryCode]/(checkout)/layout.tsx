import { headers } from "next/headers"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import { getBrandName } from "@lib/brand"
import { getCmsSettings } from "@lib/data/cms"
import {
  getThemeBranding,
  brandingCss,
} from "@modules/theme-runtime/chrome"

/* The checkout stays a locked, minimal, distraction-free surface (the
 * Shopify model: one focused page, no theme code near payment) — but it
 * carries the STORE'S brand: the active theme's token fonts and colors
 * reskin the React UI, the store logo sits center, and the store's own
 * footer line replaces the platform CTA. No theme JavaScript ever loads
 * here. */
export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const [brand, settings, branding] = await Promise.all([
    getBrandName(),
    getCmsSettings().catch(() => null),
    getThemeBranding().catch(() => null),
  ])
  const logo =
    h.get("x-tenant-logo") ||
    (settings as any)?.theme?.logo ||
    (settings as any)?.header?.logo ||
    null
  const year = new Date().getFullYear()
  // Font links from the theme layout so the token font families resolve.
  // The theme stylesheet itself is NOT loaded here — the checkout DOM is
  // React's; only the design tokens reskin it.
  const fontLinks = (branding?.headLinks ?? []).filter((t) =>
    /fonts\.googleapis|fonts\.gstatic/i.test(t)
  )
  return (
    <div
      className="w-full bg-white relative small:min-h-screen"
      data-theme-branded={branding ? "" : undefined}
    >
      {fontLinks.map((tag, i) => {
        const rel = tag.match(/rel="([^"]+)"/i)?.[1]
        const href = tag.match(/href="([^"]+)"/i)?.[1]
        if (!rel || !href) return null
        return (
          <link
            key={i}
            rel={rel}
            href={href}
            crossOrigin={/crossorigin/i.test(tag) ? "anonymous" : undefined}
          />
        )
      })}
      {branding && (
        <style dangerouslySetInnerHTML={{ __html: brandingCss(branding) }} />
      )}
      <div className="h-16 bg-white border-b ">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="text-small-semi text-ui-fg-base flex items-center gap-x-2 uppercase flex-1 basis-0"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base ">
              Back to shopping cart
            </span>
            <span className="mt-px block small:hidden txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base">
              Back
            </span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="flex items-center justify-center"
            data-testid="store-link"
          >
            {logo ? (
              <img src={logo} alt={brand} style={{ height: 26, width: "auto" }} />
            ) : (
              <span className="text-xl" style={{ fontWeight: 600 }}>
                {brand}
              </span>
            )}
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
      <div className="py-6 w-full flex items-center justify-center gap-4 text-sm text-ui-fg-subtle border-t">
        <span>
          &copy; {year} {brand}
        </span>
        <LocalizedClientLink
          href="/privacy-policy"
          className="hover:text-ui-fg-base"
        >
          Privacy
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/terms-of-use"
          className="hover:text-ui-fg-base"
        >
          Terms
        </LocalizedClientLink>
      </div>
    </div>
  )
}
