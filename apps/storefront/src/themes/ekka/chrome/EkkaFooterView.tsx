import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no data  */
/* fetching, no server-only imports): it takes the already-resolved      */
/* footer settings + categories + brand name as props and renders the    */
/* template's ec-footer markup. Rendered BYTE-IDENTICALLY by both the     */
/* live async server EkkaFooter (which fetches then renders this) and     */
/* the visual-editor canvas (which passes the chrome data it already      */
/* has), so the editor footer matches the storefront. The FooterSettings  */
/* contract is re-declared locally so the View never imports server-only  */
/* presentational types.                                                  */
/* ------------------------------------------------------------------ */

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Ekka stays
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

export interface EkkaFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's own footer assets — used when the CMS has no values. */
const FALLBACK_FOOTER_LOGO = "/ekka/images/logo/footer-logo.png"
const FALLBACK_PAYMENT_IMAGE = "/ekka/images/icons/payment.png"

/* Derive an accessible platform name from a Font Awesome social slug
   (settings.social stores only { icon, href }). */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* The CMS stores social icons as Font Awesome slugs (fa-facebook-f,
   fa-twitter, ...). Ekka ships the ecicons font instead, so map the
   platform to its eci-* glyph. */
const ECI_SOCIAL_ICONS: Record<string, string> = {
  facebook: "eci-facebook",
  twitter: "eci-twitter",
  x: "eci-twitter",
  instagram: "eci-instagram",
  linkedin: "eci-linkedin",
  pinterest: "eci-pinterest",
  youtube: "eci-youtube-play",
}

const socialIconClass = (icon: string): string => {
  const slug = icon
    .replace(/^fa-brands\s+/, "")
    .replace(/^fa-/, "")
    .replace(/-.*$/, "")
  return `ecicon ${ECI_SOCIAL_ICONS[slug] ?? "eci-link"}`
}

/* Anchor class hook the template styles per platform (hdr-facebook,
   hdr-twitter, ...). */
const socialAnchorClass = (icon: string): string => {
  const slug = icon
    .replace(/^fa-brands\s+/, "")
    .replace(/^fa-/, "")
    .replace(/-.*$/, "")
  return `hdr-${slug}`
}

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

const EkkaFooterView = ({ footer, categories, brand }: EkkaFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  return (
    <footer className="ekka-theme ec-footer section-space-mt">
      <div className="footer-container">
        <div className="footer-top section-space-footer-p">
          <div className="container">
            <div className="row">
              {/* Contact column */}
              <div className="col-sm-12 col-lg-3 ec-footer-contact">
                <div className="ec-footer-widget">
                  <div className="ec-footer-logo">
                    <LocalizedClientLink href="/">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={footer.bottom_logo || FALLBACK_FOOTER_LOGO}
                        alt={brand}
                      />
                    </LocalizedClientLink>
                  </div>
                  <h4 className="ec-footer-heading">Contact us</h4>
                  <div className="ec-footer-links">
                    <ul className="align-items-center">
                      <li className="ec-footer-link">
                        {brand} brings you a curated collection of premium
                        fashion and elegant jewellery.
                      </li>
                      <li className="ec-footer-link">
                        <span>Call Us:</span>
                        <a
                          href={`tel:${footer.contact.phone.replace(
                            /[^+\d]/g,
                            ""
                          )}`}
                        >
                          {footer.contact.phone}
                        </a>
                      </li>
                      <li className="ec-footer-link">
                        <span>Email:</span>
                        <a href={`mailto:${footer.contact.email}`}>
                          {footer.contact.email}
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Categories column: live categories + configured extras */}
              <div className="col-sm-12 col-lg-2 ec-footer-info">
                <div className="ec-footer-widget">
                  <h4 className="ec-footer-heading">Categories</h4>
                  <div className="ec-footer-links">
                    <ul className="align-items-center">
                      {categoryLinks.map((c) => (
                        <li key={c.id} className="ec-footer-link">
                          <LocalizedClientLink href={`/categories/${c.handle}`}>
                            {c.name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                      {footer.column_categories.extra.map((item, i) => (
                        <li key={`x-${i}`} className="ec-footer-link">
                          <FooterLink href={item.href}>{item.label}</FooterLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Account column */}
              <div className="col-sm-12 col-lg-2 ec-footer-account">
                <div className="ec-footer-widget">
                  <h4 className="ec-footer-heading">Account</h4>
                  <div className="ec-footer-links">
                    <ul className="align-items-center">
                      <li className="ec-footer-link">
                        <LocalizedClientLink href="/account">
                          My Account
                        </LocalizedClientLink>
                      </li>
                      <li className="ec-footer-link">
                        <LocalizedClientLink href="/account/orders">
                          Order History
                        </LocalizedClientLink>
                      </li>
                      <li className="ec-footer-link">
                        <LocalizedClientLink href="/wishlist">
                          Wish List
                        </LocalizedClientLink>
                      </li>
                      <li className="ec-footer-link">
                        <LocalizedClientLink href="/cart">
                          Cart
                        </LocalizedClientLink>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Information column: the CMS link column */}
              <div className="col-sm-12 col-lg-2 ec-footer-service">
                <div className="ec-footer-widget">
                  <h4 className="ec-footer-heading">Information</h4>
                  <div className="ec-footer-links">
                    <ul className="align-items-center">
                      {footer.column_links.map((item, i) => (
                        <li key={i} className="ec-footer-link">
                          <FooterLink href={item.href}>{item.label}</FooterLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Newsletter column (same non-wired form as the shared
                  Learts/Cignet footers — no subscribe action exists yet) */}
              <div className="col-sm-12 col-lg-3 ec-footer-news">
                <div className="ec-footer-widget">
                  <h4 className="ec-footer-heading">
                    {footer.newsletter.title}
                  </h4>
                  <div className="ec-footer-links">
                    <ul className="align-items-center">
                      <li className="ec-footer-link">
                        Get instant updates about our new products and special
                        promos!
                      </li>
                    </ul>
                    <div className="ec-subscribe-form">
                      <form
                        id="ec-newsletter-form"
                        name="ec-newsletter-form"
                        method="post"
                        action="#"
                      >
                        <div id="ec_news_signup" className="ec-form">
                          <input
                            className="ec-email"
                            type="email"
                            required
                            placeholder={footer.newsletter.placeholder}
                            aria-label={footer.newsletter.title}
                            name="ec-email"
                          />
                          <button
                            id="ec-news-btn"
                            className="button btn-primary"
                            type="submit"
                            name="subscribe"
                            aria-label={footer.newsletter.button}
                          >
                            <i
                              className="ecicon eci-paper-plane-o"
                              aria-hidden="true"
                            ></i>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="container">
            <div className="row align-items-center">
              {/* Footer social Start */}
              <div className="col text-left footer-bottom-left">
                <div className="footer-bottom-social">
                  <span className="social-text text-upper">Follow us on:</span>
                  <ul className="mb-0">
                    {footer.social.map((s, i) => (
                      <li key={i} className="list-inline-item">
                        <a
                          className={socialAnchorClass(s.icon)}
                          href={s.href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={socialLabel(s.icon)}
                        >
                          <i className={socialIconClass(s.icon)}></i>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Footer social End */}

              {/* Footer Copyright Start */}
              <div className="col text-center footer-copy">
                <div className="footer-bottom-copy">
                  <div className="ec-copy">{copyright}</div>
                </div>
              </div>
              {/* Footer Copyright End */}

              {/* Footer payment */}
              <div className="col footer-bottom-right">
                <div className="footer-bottom-payment d-flex justify-content-end">
                  <div className="payment-link">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={footer.payment_image || FALLBACK_PAYMENT_IMAGE}
                      alt="Accepted payment methods"
                    />
                  </div>
                </div>
              </div>
              {/* Footer payment */}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default EkkaFooterView
