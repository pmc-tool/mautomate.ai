/* ------------------------------------------------------------------ */
/* Exzo chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no data  */
/* fetching, no server-only imports): it takes the already-resolved      */
/* footer settings + categories + brand name as props and renders the    */
/* template's dark footer markup (index1.html). Rendered BYTE-IDENTICALLY */
/* by both the live async server ExzoFooter (which fetches then renders   */
/* this) and the visual-editor canvas (which passes the chrome data it    */
/* already has), so the editor footer matches the storefront. The         */
/* FooterSettings contract is re-declared locally so the View never       */
/* imports server-only presentational types. Font Awesome 4 (fa fa-*)     */
/* classes only — CMS social slugs are mapped down from the FA5+ names    */
/* the settings store.                                                    */
/* ------------------------------------------------------------------ */

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Exzo stays
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

export interface ExzoFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's light footer logo — used when the CMS has no logo. */
const FALLBACK_FOOTER_LOGO = "/exzo/img/logo-1.png"

/* Map the FA5+ social slugs stored in CMS settings down to the Font
   Awesome 4.6.3 classes the Exzo stylesheet ships. Unknown slugs fall
   back to a generic share icon so no box glyph ever renders. */
const FA4_SOCIAL: Record<string, string> = {
  "fa-facebook-f": "fa-facebook",
  "fa-facebook": "fa-facebook",
  "fa-twitter": "fa-twitter",
  "fa-x-twitter": "fa-twitter",
  "fa-instagram": "fa-instagram",
  "fa-youtube": "fa-youtube",
  "fa-youtube-play": "fa-youtube-play",
  "fa-linkedin-in": "fa-linkedin",
  "fa-linkedin": "fa-linkedin",
  "fa-pinterest-p": "fa-pinterest-p",
  "fa-pinterest": "fa-pinterest",
  "fa-google-plus": "fa-google-plus",
}

const fa4Icon = (icon: string): string => FA4_SOCIAL[icon] ?? "fa-share-alt"

/* Derive an accessible platform name from a Font Awesome social slug
   (settings.social stores only { icon, href }). */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Cignet/Shofy
   footer behavior. "/contact" is normalized to "/contact-us" (the
   seeded, tenant-aware CMS page — see the playbook contact rule). */
const FooterLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => {
  const target = href === "/contact" ? "/contact-us" : href
  return target.startsWith("/") ? (
    <LocalizedClientLink href={target}>{children}</LocalizedClientLink>
  ) : (
    <a href={target}>{children}</a>
  )
}

const ExzoFooterView = ({ footer, categories, brand }: ExzoFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )
  const tagCategories = (categories ?? []).slice(0, 12)

  return (
    <footer className="exzo-theme">
      <div className="container">
        <div className="footer-top">
          <div className="row">
            <div className="col-sm-6 col-md-3 col-xs-b30 col-md-b0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={footer.bottom_logo || FALLBACK_FOOTER_LOGO}
                alt={brand}
              />
              <div className="empty-space col-xs-b20"></div>
              <div className="simple-article size-2 light fulltransparent">
                {brand} brings you a curated collection of quality products,
                picked with care and delivered to your door.
              </div>
              <div className="empty-space col-xs-b20"></div>
              <div className="footer-contact">
                <i className="fa fa-mobile" aria-hidden="true"></i> contact us:{" "}
                <a href={`tel:${footer.contact.phone.replace(/[^+\d]/g, "")}`}>
                  {footer.contact.phone}
                </a>
              </div>
              <div className="footer-contact">
                <i className="fa fa-envelope-o" aria-hidden="true"></i> email:{" "}
                <a href={`mailto:${footer.contact.email}`}>
                  {footer.contact.email}
                </a>
              </div>
              <div className="footer-contact">
                <i className="fa fa-map-marker" aria-hidden="true"></i> help:{" "}
                <LocalizedClientLink href="/contact-us">
                  visit our contact page
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col-sm-6 col-md-3 col-xs-b30 col-md-b0">
              <h6 className="h6 light">quick links</h6>
              <div className="empty-space col-xs-b20"></div>
              <div className="footer-column-links">
                <div className="row">
                  <div className="col-xs-6">
                    <FooterLink href="/">home</FooterLink>
                    <FooterLink href="/store">shop</FooterLink>
                    {categoryLinks.map((c) => (
                      <LocalizedClientLink
                        key={c.id}
                        href={`/categories/${c.handle}`}
                      >
                        {c.name}
                      </LocalizedClientLink>
                    ))}
                  </div>
                  <div className="col-xs-6">
                    {footer.column_categories.extra.map((item, i) => (
                      <FooterLink key={`x-${i}`} href={item.href}>
                        {item.label}
                      </FooterLink>
                    ))}
                    <FooterLink href="/account">my account</FooterLink>
                    <FooterLink href="/cart">cart</FooterLink>
                    <FooterLink href="/contact-us">contact</FooterLink>
                  </div>
                </div>
              </div>
            </div>
            <div className="clear visible-sm"></div>
            <div className="col-sm-6 col-md-3 col-xs-b30 col-sm-b0">
              <h6 className="h6 light">customer support</h6>
              <div className="empty-space col-xs-b20"></div>
              <div className="footer-column-links">
                {footer.column_links.map((item, i) => (
                  <FooterLink key={i} href={item.href}>
                    {item.label}
                  </FooterLink>
                ))}
              </div>
            </div>
            <div className="col-sm-6 col-md-3">
              <h6 className="h6 light">popular tags</h6>
              <div className="empty-space col-xs-b20"></div>
              <div className="tags clearfix">
                {tagCategories.length > 0 ? (
                  tagCategories.map((c) => (
                    <LocalizedClientLink
                      key={c.id}
                      className="tag"
                      href={`/categories/${c.handle}`}
                    >
                      {c.name}
                    </LocalizedClientLink>
                  ))
                ) : (
                  <LocalizedClientLink className="tag" href="/store">
                    shop all
                  </LocalizedClientLink>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="row">
            <div className="col-lg-8 col-xs-text-center col-lg-text-left col-xs-b20 col-lg-b0">
              <div className="copyright">{copyright}</div>
              {footer.social.length > 0 ? (
                <div className="follow">
                  {footer.social.map((s, i) => (
                    <a
                      key={i}
                      className="entry"
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={socialLabel(s.icon)}
                    >
                      <i className={`fa ${fa4Icon(s.icon)}`}></i>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="col-lg-4 col-xs-text-center col-lg-text-right">
              {footer.payment_image ? (
                <div className="footer-payment-icons">
                  <span className="entry">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={footer.payment_image} alt="Accepted payments" />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default ExzoFooterView
