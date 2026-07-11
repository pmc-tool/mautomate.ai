import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no    */
/* data fetching, no server-only imports): it takes the already-resolved */
/* footer settings + categories + brand name as props and renders the    */
/* template's footer-area-wrapper markup. Rendered BYTE-IDENTICALLY by    */
/* both the live async server HelendoFooter (which fetches then renders   */
/* this) and the visual-editor canvas (which passes the chrome data it    */
/* already has), so the editor footer matches the storefront. The         */
/* FooterSettings contract is re-declared locally so the View never       */
/* imports server-only presentational types.                             */
/* ------------------------------------------------------------------ */

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Helendo stays
   independent of the other theme renderers. */
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

export interface HelendoFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's own logo — used when the CMS has no bottom logo. */
const FALLBACK_FOOTER_LOGO = "/helendo/images/logo/logo.svg"

/* Map a Font Awesome social slug (settings.social stores only
   { icon, href }, e.g. "fa-facebook-f") onto the template's local
   ElegantIcons "social social_*" font classes. */
const SOCIAL_CLASS_MAP: Record<string, string> = {
  facebook: "social_facebook",
  twitter: "social_twitter",
  "x-twitter": "social_twitter",
  instagram: "social_instagram",
  pinterest: "social_pinterest",
  youtube: "social_youtube",
  linkedin: "social_linkedin",
  tumblr: "social_tumblr",
  vimeo: "social_vimeo",
  skype: "social_skype",
  dribbble: "social_dribbble",
  rss: "social_rss",
}

const socialClass = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "")
  const base = slug.replace(/-.*$/, "")
  return SOCIAL_CLASS_MAP[slug] ?? SOCIAL_CLASS_MAP[base] ?? "social_share"
}

/* Derive an accessible platform name from the Font Awesome slug. */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Cignet/Aurora
   footer behavior. */
const FooterLink = ({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) =>
  href.startsWith("/") ? (
    <LocalizedClientLink href={href} className={className}>
      {children}
    </LocalizedClientLink>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  )

const SocialList = ({
  social,
  className,
}: {
  social: { icon: string; href: string }[]
  className: string
}) => (
  <ul className={className}>
    {social.map((s, i) => (
      <li key={i} className="item">
        <a
          href={s.href}
          target="_blank"
          rel="noreferrer"
          aria-label={socialLabel(s.icon)}
        >
          <i className={`social ${socialClass(s.icon)}`}></i>
        </a>
      </li>
    ))}
  </ul>
)

const HelendoFooterView = ({
  footer,
  categories,
  brand,
}: HelendoFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  /* The copyright strip's small footer menu (Term & Condition / Policy /
     Map in the template) reuses the first CMS footer links. */
  const bottomMenu = footer.column_links.slice(0, 3)

  return (
    <footer className="helendo-theme footer-area-wrapper">
      <div className="footer-area section-space--ptb_120">
        <div className="container">
          <div className="row footer-widget-wrapper">
            {/* Contact widget (the template's "Address" column, fed by
                the CMS contact fields: phone + email) */}
            <div className="col-lg-4 col-md-4 col-sm-6 footer-widget">
              <h6 className="footer-widget__title mb-20">Contact</h6>
              <ul className="footer-widget__list">
                <li>
                  <i className="icon_phone"></i>
                  <a
                    href={`tel:${footer.contact.phone.replace(/[^+\d]/g, "")}`}
                    className="hover-style-link"
                  >
                    {footer.contact.phone}
                  </a>
                </li>
                <li>
                  <i className="icon_mail"></i>
                  <a
                    href={`mailto:${footer.contact.email}`}
                    className="hover-style-link"
                  >
                    {footer.contact.email}
                  </a>
                </li>
              </ul>
              {footer.social.length > 0 && (
                <SocialList
                  social={footer.social}
                  className="list footer-social-networks mt-25"
                />
              )}
            </div>

            {/* Help & Information: the CMS link column */}
            <div className="col-lg-3 col-md-4 col-sm-6 footer-widget">
              <h6 className="footer-widget__title mb-20">
                Help &amp; Information
              </h6>
              <ul className="footer-widget__list">
                {footer.column_links.map((item, i) => (
                  <li key={i}>
                    <FooterLink href={item.href} className="hover-style-link">
                      {item.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Categories: live top categories + configured extras */}
            <div className="col-lg-2 col-md-4 col-sm-6 footer-widget">
              <h6 className="footer-widget__title mb-20">Categories</h6>
              <ul className="footer-widget__list">
                {categoryLinks.map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink
                      href={`/categories/${c.handle}`}
                      className="hover-style-link"
                    >
                      {c.name}
                    </LocalizedClientLink>
                  </li>
                ))}
                {footer.column_categories.extra.map((item, i) => (
                  <li key={`x-${i}`}>
                    <FooterLink href={item.href} className="hover-style-link">
                      {item.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter (same non-wired form as the shared footers —
                no subscribe action exists yet) */}
            <div className="col-lg-3 col-md-6 col-sm-6 footer-widget">
              <h6 className="footer-widget__title mb-20">
                {footer.newsletter.title}
              </h6>
              <form className="footer-widget__newsletter mt-30">
                <input
                  type="email"
                  name="mail"
                  autoComplete="off"
                  placeholder={footer.newsletter.placeholder}
                  aria-label={footer.newsletter.title}
                  required
                />
                <button
                  type="submit"
                  className="submit-button"
                  aria-label={footer.newsletter.button}
                >
                  <i className="icon-arrow-right"></i>
                </button>
              </form>
              <ul className="footer-widget__footer-menu section-space--mt_60 d-none d-lg-block">
                {bottomMenu.map((item, i) => (
                  <li key={i}>
                    <FooterLink href={item.href}>{item.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-copyright-area section-space--pb_30">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-4 col-md-5 text-center text-md-left">
              <ul className="footer-widget__footer-menu">
                {bottomMenu.map((item, i) => (
                  <li key={i}>
                    <FooterLink href={item.href}>{item.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-lg-4 col-md-2 text-center">
              <div className="footer-logo">
                <LocalizedClientLink href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={footer.bottom_logo || FALLBACK_FOOTER_LOGO}
                    alt={brand}
                  />
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col-lg-4 col-md-5 order-md-3">
              {footer.social.length > 0 && (
                <div className="footer-bottom-social">
                  <h6 className="title">Follow Us On Social</h6>
                  <SocialList
                    social={footer.social}
                    className="list footer-social-networks"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="row">
            <div className="col-lg-12">
              <span className="copyright-text text-center section-space--mt_40">
                {copyright}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default HelendoFooterView
