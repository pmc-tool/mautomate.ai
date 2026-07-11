import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no data */
/* fetching, no server-only imports): it takes the already-resolved      */
/* footer settings + categories + brand name as props and renders the    */
/* template's tp-footer-area markup. Rendered BYTE-IDENTICALLY by both    */
/* the live async server ShofyFooter (which fetches then renders this)    */
/* and the visual-editor canvas (which passes the chrome data it already  */
/* has), so the editor footer matches the storefront. The FooterSettings  */
/* contract is re-declared locally so the View never imports server-only  */
/* presentational types.                                                  */
/* ------------------------------------------------------------------ */

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

export interface ShofyFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's own assets — used when the CMS carries no values. */
const FALLBACK_FOOTER_LOGO = "/shofy/img/logo/logo.svg"
const FALLBACK_PAYMENT_IMAGE = "/shofy/img/footer/footer-pay.png"

/* Derive an accessible platform name from a Font Awesome social slug
   (settings.social stores only { icon, href }). */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Learts/Aurora/
   Cignet footer behavior. */
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

/* The template's own inline SVGs (footer contact items). */
const MailIcon = () => (
  <svg
    width="18"
    height="16"
    viewBox="0 0 18 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 5C1 2.2 2.6 1 5 1H13C15.4 1 17 2.2 17 5V10.6C17 13.4 15.4 14.6 13 14.6H5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 5.40039L10.496 7.40039C9.672 8.05639 8.32 8.05639 7.496 7.40039L5 5.40039"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 11.4004H5.8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 8.19922H3.4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeMiterlimit="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LocationIcon = () => (
  <svg
    width="17"
    height="20"
    viewBox="0 0 17 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.50001 10.9417C9.99877 10.9417 11.2138 9.72668 11.2138 8.22791C11.2138 6.72915 9.99877 5.51416 8.50001 5.51416C7.00124 5.51416 5.78625 6.72915 5.78625 8.22791C5.78625 9.72668 7.00124 10.9417 8.50001 10.9417Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M1.21115 6.64496C2.92464 -0.887449 14.0841 -0.878751 15.7889 6.65366C16.7891 11.0722 14.0406 14.8123 11.6313 17.126C9.88298 18.8134 7.11704 18.8134 5.36006 17.126C2.95943 14.8123 0.210885 11.0635 1.21115 6.64496Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
)

const ShofyFooterView = ({ footer, categories, brand }: ShofyFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  return (
    <footer className="shofy-theme">
      <div className="tp-footer-area" data-bg-color="footer-bg-grey">
        <div className="tp-footer-top pt-95 pb-40">
          <div className="container">
            <div className="row">
              <div className="col-xl-4 col-lg-3 col-md-4 col-sm-6">
                <div className="tp-footer-widget footer-col-1 mb-50">
                  <div className="tp-footer-widget-content">
                    <div className="tp-footer-logo">
                      <LocalizedClientLink href="/">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={footer.bottom_logo || FALLBACK_FOOTER_LOGO}
                          alt={brand}
                        />
                      </LocalizedClientLink>
                    </div>
                    <p className="tp-footer-desc">
                      {brand} brings you a curated collection of premium
                      products, chosen with care and delivered with love.
                    </p>
                    {footer.social.length > 0 && (
                      <div className="tp-footer-social">
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
                    )}
                  </div>
                </div>
              </div>
              <div className="col-xl-2 col-lg-3 col-md-4 col-sm-6">
                <div className="tp-footer-widget footer-col-2 mb-50">
                  <h4 className="tp-footer-widget-title">Quick Links</h4>
                  <div className="tp-footer-widget-content">
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
              <div className="col-xl-3 col-lg-3 col-md-4 col-sm-6">
                <div className="tp-footer-widget footer-col-3 mb-50">
                  <h4 className="tp-footer-widget-title">Information</h4>
                  <div className="tp-footer-widget-content">
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
              <div className="col-xl-3 col-lg-3 col-md-4 col-sm-6">
                <div className="tp-footer-widget footer-col-4 mb-50">
                  <h4 className="tp-footer-widget-title">Talk To Us</h4>
                  <div className="tp-footer-widget-content">
                    <div className="tp-footer-talk mb-20">
                      <span>Got Questions? Call us</span>
                      <h4>
                        <a
                          href={`tel:${footer.contact.phone.replace(
                            /[^+\d]/g,
                            ""
                          )}`}
                        >
                          {footer.contact.phone}
                        </a>
                      </h4>
                    </div>
                    <div className="tp-footer-contact">
                      <div className="tp-footer-contact-item d-flex align-items-start">
                        <div className="tp-footer-contact-icon">
                          <span>
                            <MailIcon />
                          </span>
                        </div>
                        <div className="tp-footer-contact-content">
                          <p>
                            <a href={`mailto:${footer.contact.email}`}>
                              {footer.contact.email}
                            </a>
                          </p>
                        </div>
                      </div>
                      <div className="tp-footer-contact-item d-flex align-items-start">
                        <div className="tp-footer-contact-icon">
                          <span>
                            <LocationIcon />
                          </span>
                        </div>
                        <div className="tp-footer-contact-content">
                          <p>
                            <LocalizedClientLink href="/contact-us">
                              Visit our contact page
                            </LocalizedClientLink>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="tp-footer-bottom">
          <div className="container">
            <div className="tp-footer-bottom-wrapper">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <div className="tp-footer-copyright">
                    <p>{copyright}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="tp-footer-payment text-md-end">
                    <p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={footer.payment_image || FALLBACK_PAYMENT_IMAGE}
                        alt="Accepted payment methods"
                      />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default ShofyFooterView
