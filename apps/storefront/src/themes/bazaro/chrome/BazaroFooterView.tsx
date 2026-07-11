/* ------------------------------------------------------------------ */
/* Bazaro chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no    */
/* data fetching, no server-only imports): it takes the already-        */
/* resolved footer settings + categories + brand name as props and      */
/* renders the template's aq-footer-area markup. Rendered BYTE-          */
/* IDENTICALLY by both the live async server BazaroFooter (which fetches */
/* then renders this) and the visual-editor canvas (which passes the     */
/* chrome data it already has), so the editor footer matches the         */
/* storefront. The FooterSettings contract is re-declared locally so the */
/* View never imports server-only presentational types.                 */
/* ------------------------------------------------------------------ */

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Bazaro stays
   independent of the Learts renderer. */
interface FooterSettings {
  contact: {
    email: string
    phone: string
    app_buttons: { img: string; alt: string; href: string }[]
  }
  column_categories: {
    source: "categories"
    limit: number
    extra: { label: string; href: string }[]
  }
  column_links: { label: string; href: string }[]
  social: { icon: string; href: string }[]
  newsletter: { title: string; placeholder: string; button: string }
  bottom_logo: string
  payment_image: string
  copyright: string
}

export interface BazaroFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's own footer assets — used when the CMS has none. */
const FALLBACK_FOOTER_LOGO = "/bazaro/img/logo/logo.png"
const FALLBACK_PAYMENT_IMAGE = "/bazaro/img/payment/payment.png"

/* Derive an accessible platform name from a Font Awesome social slug
   (settings.social stores only { icon, href }). */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* HTTrack mangled some template image paths to .html — never emit one.
   Any .html (or empty) CMS value falls back to the known-real asset, and
   the CMS_DEFAULTS Learts-era assets count as "unset" so a store that
   never customized them gets Bazaro's own imagery. */
const safeImage = (src: string | undefined, fallback: string): string =>
  src && !src.endsWith(".html") && !src.startsWith("/learts/") ? src : fallback

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Learts/Cignet
   footer behavior. */
const FooterLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) =>
  href.startsWith("/") ? (
    <LocalizedClientLink href={href}>{children}</LocalizedClientLink>
  ) : (
    <a href={href}>{children}</a>
  )

/* The template's own inline SVGs (footer contact icons). */

const MailIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="16"
    viewBox="0 0 18 16"
    fill="none"
  >
    <path
      d="M0.75 4.75C0.75 1.95 2.35 0.75 4.75 0.75H12.75C15.15 0.75 16.75 1.95 16.75 4.75V10.35C16.75 13.15 15.15 14.35 12.75 14.35H4.75M12.75 5.15028L10.246 7.15003C9.422 7.80596 8.07 7.80596 7.246 7.15003L4.75 5.15028M0.75 11.1503H5.55M0.75 7.94945H3.15"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PinIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="17"
    height="19"
    viewBox="0 0 17 19"
    fill="none"
  >
    <path
      d="M8.25099 10.6922C9.74975 10.6922 10.9647 9.47717 10.9647 7.9784C10.9647 6.47964 9.74975 5.26465 8.25099 5.26465C6.75222 5.26465 5.53723 6.47964 5.53723 7.9784C5.53723 9.47717 6.75222 10.6922 8.25099 10.6922Z"
      stroke="currentcolor"
      strokeWidth="1.5"
    />
    <path
      d="M0.962124 6.39496C2.67562 -1.13745 13.8351 -1.12875 15.5399 6.40366C16.5401 10.8222 13.7916 14.5623 11.3822 16.876C9.63396 18.5634 6.86802 18.5634 5.11104 16.876C2.71041 14.5623 -0.0381381 10.8135 0.962124 6.39496Z"
      stroke="currentcolor"
      strokeWidth="1.5"
    />
  </svg>
)

const BazaroFooterView = ({
  footer,
  categories,
  brand,
}: BazaroFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  const footerLogo = safeImage(footer.bottom_logo, FALLBACK_FOOTER_LOGO)
  const paymentImage = safeImage(footer.payment_image, FALLBACK_PAYMENT_IMAGE)

  return (
    <footer className="bazaro-theme">
      {/* footer area start */}
      <div
        className="aq-footer-area pt-100"
        style={{ backgroundColor: "var(--aq-gray-1, #F1EFEE)" }}
      >
        <div className="container">
          <div className="aq-footer-widget-wrap">
            <div className="row">
              <div className="col-xl-3 col-lg-4 col-md-5 col-sm-6">
                {/* Logo + contact information */}
                <div className="aq-footer-widget footer-col-6-1 mb-90">
                  <div className="aq-footer-logo mb-25">
                    <LocalizedClientLink href="/">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={footerLogo}
                        alt={brand}
                        style={{ width: 120 }}
                      />
                    </LocalizedClientLink>
                  </div>
                  <div className="aq-footer-contact-wrap">
                    <div className="aq-footer-contact-item d-flex align-items-start">
                      <span>
                        <MailIcon />
                      </span>
                      <a href={`mailto:${footer.contact.email}`}>
                        {footer.contact.email}
                      </a>
                    </div>
                    <div className="aq-footer-contact-item d-flex align-items-start">
                      <span>
                        <PinIcon />
                      </span>
                      <LocalizedClientLink href="/contact-us">
                        Visit our store
                      </LocalizedClientLink>
                    </div>
                    <div className="aq-footer-contact-item d-flex align-items-start">
                      <a
                        className="fs-bold"
                        href={`tel:${footer.contact.phone.replace(
                          /[^+\d]/g,
                          ""
                        )}`}
                      >
                        {footer.contact.phone}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-2 col-lg-4 col-md-3 col-sm-6">
                {/* Shop: live categories + configured extras */}
                <div className="aq-footer-widget mb-90">
                  <h4 className="aq-footer-widget-title">Shop</h4>
                  <div className="aq-footer-widget-menu">
                    <ul>
                      {categoryLinks.map((c) => (
                        <li key={c.id}>
                          <LocalizedClientLink href={`/categories/${c.handle}`}>
                            {c.name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                      {footer.column_categories.extra.map((item, i) => (
                        <li key={`x-${i}`}>
                          <FooterLink href={item.href}>{item.label}</FooterLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="col-xl-2 col-lg-4 col-md-4 col-sm-6">
                {/* Information: the CMS link column */}
                <div className="aq-footer-widget mb-90">
                  <h4 className="aq-footer-widget-title">Information</h4>
                  <div className="aq-footer-widget-menu">
                    <ul>
                      {footer.column_links.map((item, i) => (
                        <li key={i}>
                          <FooterLink href={item.href}>{item.label}</FooterLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="col-xl-2 col-lg-4 col-md-4 col-sm-6">
                {/* Account: fixed storefront links (tenant-neutral) */}
                <div className="aq-footer-widget mb-90">
                  <h4 className="aq-footer-widget-title">Account</h4>
                  <div className="aq-footer-widget-menu">
                    <ul>
                      <li>
                        <LocalizedClientLink href="/account">
                          My Account
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink href="/cart">
                          Cart
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink href="/wishlist">
                          Wishlist
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink href="/contact-us">
                          Contact Us
                        </LocalizedClientLink>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="col-xl-3 col-lg-6 col-md-7 col-sm-10">
                {/* Newsletter (same non-wired form as the shared footers —
                    no subscribe action exists yet) + social icons */}
                <div className="aq-footer-widget mb-90">
                  <h4 className="aq-footer-widget-title">
                    {footer.newsletter.title}
                  </h4>
                  <div className="aq-footer-widget-input-box mb-25">
                    <form>
                      <p className="mb-10">
                        Our conversation is just getting started
                      </p>
                      <div className="aq-footer-widget-input p-relative">
                        <input
                          className="aq-form-control brr-0 h-56"
                          type="email"
                          name="mail"
                          autoComplete="off"
                          placeholder={footer.newsletter.placeholder}
                          aria-label={footer.newsletter.title}
                          required
                        />
                        <button className="aq-btn-subscribe" type="submit">
                          {footer.newsletter.button}
                        </button>
                      </div>
                    </form>
                  </div>
                  {footer.social.length > 0 ? (
                    <div className="aq-footer-widget-social-box">
                      <h4 className="aq-footer-widget-social-title mb-10">
                        Follow Us On
                      </h4>
                      <div className="aq-footer-widget-social">
                        {footer.social.map((s, i) => (
                          <a
                            key={i}
                            href={s.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={socialLabel(s.icon)}
                          >
                            <i className={`fa-brands ${s.icon}`}></i>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright + payment strip */}
        <div className="aq-copyright-area">
          <div className="container">
            <div className="aq-copyright-border pt-15 pb-15">
              <div className="row align-items-center">
                <div className="col-xl-4 col-lg-5 col-md-6">
                  <div className="aq-copyright-text text-center text-md-start pb-20">
                    <p className="mb-0">{copyright}</p>
                  </div>
                </div>
                <div className="col-xl-8 col-lg-7 col-md-6">
                  <div className="aq-copyright-payment text-center text-md-end pb-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={paymentImage} alt="Accepted payment methods" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* footer area end */}
    </footer>
  )
}

export default BazaroFooterView
