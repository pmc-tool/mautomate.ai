import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no    */
/* data fetching, no server-only imports): it takes the already-        */
/* resolved footer settings + categories + brand name as props and      */
/* renders the template's main-footer dark-section markup. Rendered      */
/* BYTE-IDENTICALLY by both the live async server CignetFooter (which    */
/* fetches then renders this) and the visual-editor canvas (which        */
/* passes the chrome data it already has), so the editor footer matches  */
/* the storefront. The FooterSettings contract is re-declared locally    */
/* so the View never imports server-only presentational types.           */
/* ------------------------------------------------------------------ */

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Cignet stays
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

export interface CignetFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's white footer logo — used when the CMS has no logo. */
const FALLBACK_FOOTER_LOGO = "/cignet/images/logo-white.svg"

/* Derive an accessible platform name from a Font Awesome social slug
   (settings.social stores only { icon, href }). */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Learts/Aurora
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

const CignetFooterView = ({
  footer,
  categories,
  brand,
}: CignetFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  return (
    <footer className="cignet-theme main-footer dark-section">
      <div className="container">
        <div className="row">
          <div className="col-xl-4">
            {/* About Footer */}
            <div className="about-footer">
              {/* Footer Logo */}
              <div className="footer-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={footer.bottom_logo || FALLBACK_FOOTER_LOGO}
                  alt={brand}
                />
              </div>

              {/* About Footer Content */}
              <div className="about-footer-content">
                <p>
                  {brand} brings you a curated collection of premium fashion and
                  elegant jewellery.
                </p>
              </div>

              {/* Footer Newsletter Form (same non-wired form as the shared
                  Learts/Aurora footers — no subscribe action exists yet) */}
              <div className="footer-newsletter-form">
                <form>
                  <div className="form-group">
                    <input
                      autoComplete="off"
                      type="email"
                      name="mail"
                      className="form-control"
                      placeholder={footer.newsletter.placeholder}
                      aria-label={footer.newsletter.title}
                      required
                    />
                    <button
                      type="submit"
                      className="newsletter-btn"
                      aria-label={footer.newsletter.button}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/cignet/images/arrow-primary.svg" alt="" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Social icons (reuses the topbar social list styling) */}
              {footer.social.length > 0 ? (
                <div
                  className="topbar-social-list footer-social-list"
                  style={{ marginTop: 20 }}
                >
                  <ul>
                    {footer.social.map((s, i) => (
                      <li key={i}>
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={socialLabel(s.icon)}
                        >
                          <i className={`fa-brands ${s.icon}`}></i>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="col-xl-8">
            {/* Footer Links Box */}
            <div className="footer-links-box">
              {/* Quick Links: live categories + configured extras */}
              <div className="footer-links">
                <h2>Quick Links</h2>
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

              {/* Customer Support: the CMS link column */}
              <div className="footer-links">
                <h2>Customer Support</h2>
                <ul>
                  {footer.column_links.map((item, i) => (
                    <li key={i}>
                      <FooterLink href={item.href}>{item.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact Information */}
              <div className="footer-links footer-contact-box">
                <h2>Contact Information</h2>
                <div className="footer-contact-items-list">
                  <div className="footer-contact-item">
                    <div className="icon-box">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/cignet/images/icon-phone-white.svg" alt="" />
                    </div>
                    <div className="footer-contact-item-content">
                      <h3>Phone:</h3>
                      <p>
                        <a
                          href={`tel:${footer.contact.phone.replace(
                            /[^+\d]/g,
                            ""
                          )}`}
                        >
                          {footer.contact.phone}
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="footer-contact-item">
                    <div className="icon-box">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/cignet/images/icon-location-white.svg"
                        alt=""
                      />
                    </div>
                    <div className="footer-contact-item-content">
                      <h3>Email:</h3>
                      <p>
                        <a href={`mailto:${footer.contact.email}`}>
                          {footer.contact.email}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="footer-copyright">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="footer-copyright-text">
                <p>{copyright}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default CignetFooterView
