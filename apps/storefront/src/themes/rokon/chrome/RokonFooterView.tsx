/* ------------------------------------------------------------------ */
/* Rokon chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no data */
/* fetching, no server-only imports): it takes the already-resolved      */
/* footer settings + categories + brand name as props and renders the    */
/* template's footer__section markup (four widget columns +              */
/* footer__bottom copyright). Rendered BYTE-IDENTICALLY by both the live  */
/* async server RokonFooter (which fetches then renders this) and the     */
/* visual-editor canvas (which passes the chrome data it already has), so */
/* the editor footer matches the storefront. The FooterSettings contract  */
/* is re-declared locally so the View never imports server-only           */
/* presentational types. The template's mobile widget accordion lives in  */
/* the RokonFooterWidget client sub-component; social icons are the       */
/* template's own inline SVGs mapped from the CMS fa-* slugs (this theme   */
/* loads no icon font).                                                    */
/* ------------------------------------------------------------------ */

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import RokonFooterWidget from "./RokonFooterWidget"

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Rokon stays
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

export interface RokonFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* The template's white footer logo — used when the CMS has no logo. */
const FALLBACK_FOOTER_LOGO = "/rokon/img/logo/nav-logo-white.webp"

/* Derive an accessible platform name from a Font Awesome social slug
   (settings.social stores only { icon, href }). */
const socialLabel = (icon: string): string => {
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/* The template's own inline social SVGs, keyed by platform slug. */
const SOCIAL_SVGS: Record<string, React.ReactNode> = {
  facebook: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="8.239"
      height="15.984"
      viewBox="0 0 11.239 20.984"
    >
      <path
        d="M11.575,11.8l.583-3.8H8.514V5.542A1.9,1.9,0,0,1,10.655,3.49h1.657V.257A20.2,20.2,0,0,0,9.371,0c-3,0-4.962,1.819-4.962,5.112V8.006H1.073v3.8H4.409v9.181H8.514V11.8Z"
        transform="translate(-1.073)"
        fill="currentColor"
      />
    </svg>
  ),
  twitter: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="14.492"
      viewBox="0 0 24 19.492"
    >
      <path
        d="M21.533,7.112c.015.213.015.426.015.64A13.9,13.9,0,0,1,7.553,21.746,13.9,13.9,0,0,1,0,19.538a10.176,10.176,0,0,0,1.188.061,9.851,9.851,0,0,0,6.107-2.1,4.927,4.927,0,0,1-4.6-3.411,6.2,6.2,0,0,0,.929.076,5.2,5.2,0,0,0,1.294-.167A4.919,4.919,0,0,1,.975,9.168V9.107A4.954,4.954,0,0,0,3.2,9.731,4.926,4.926,0,0,1,1.675,3.152,13.981,13.981,0,0,0,11.817,8.3,5.553,5.553,0,0,1,11.7,7.173a4.923,4.923,0,0,1,8.513-3.365A9.684,9.684,0,0,0,23.33,2.619,4.906,4.906,0,0,1,21.167,5.33,9.861,9.861,0,0,0,24,4.569a10.573,10.573,0,0,1-2.467,2.543Z"
        transform="translate(0 -2.254)"
        fill="currentColor"
      />
    </svg>
  ),
  instagram: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14.497"
      height="14.492"
      viewBox="0 0 19.497 19.492"
    >
      <path
        d="M9.747,6.24a5,5,0,1,0,5,5A4.99,4.99,0,0,0,9.747,6.24Zm0,8.247A3.249,3.249,0,1,1,13,11.238a3.255,3.255,0,0,1-3.249,3.249Zm6.368-8.451A1.166,1.166,0,1,1,14.949,4.87,1.163,1.163,0,0,1,16.115,6.036Zm3.31,1.183A5.769,5.769,0,0,0,17.85,3.135,5.807,5.807,0,0,0,13.766,1.56c-1.609-.091-6.433-.091-8.042,0A5.8,5.8,0,0,0,1.64,3.13,5.788,5.788,0,0,0,.065,7.215c-.091,1.609-.091,6.433,0,8.042A5.769,5.769,0,0,0,1.64,19.341a5.814,5.814,0,0,0,4.084,1.575c1.609.091,6.433.091,8.042,0a5.769,5.769,0,0,0,4.084-1.575,5.807,5.807,0,0,0,1.575-4.084c.091-1.609.091-6.429,0-8.038Zm-2.079,9.765a3.289,3.289,0,0,1-1.853,1.853c-1.283.509-4.328.391-5.746.391S5.28,19.341,4,18.837a3.289,3.289,0,0,1-1.853-1.853c-.509-1.283-.391-4.328-.391-5.746s-.113-4.467.391-5.746A3.289,3.289,0,0,1,4,3.639c1.283-.509,4.328-.391,5.746-.391s4.467-.113,5.746.391a3.289,3.289,0,0,1,1.853,1.853c.509,1.283.391,4.328.391,5.746S17.855,15.705,17.346,16.984Z"
        transform="translate(0.004 -1.492)"
        fill="currentColor"
      />
    </svg>
  ),
  linkedin: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14.419"
      height="14.419"
      viewBox="0 0 19.419 19.419"
    >
      <path
        d="M4.347,19.419H.321V6.454H4.347ZM2.332,4.686A2.343,2.343,0,1,1,4.663,2.332,2.351,2.351,0,0,1,2.332,4.686ZM19.415,19.419H15.4V13.108c0-1.5-.03-3.433-2.093-3.433-2.093,0-2.414,1.634-2.414,3.325v6.42H6.869V6.454H10.73V8.223h.056A4.23,4.23,0,0,1,14.6,6.129c4.075,0,4.824,2.683,4.824,6.168v7.122Z"
        fill="currentColor"
      />
    </svg>
  ),
  youtube: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15.49"
      height="15.582"
      viewBox="0 0 16.49 11.582"
    >
      <path
        d="M967.759,1365.592q0,1.377-.019,1.717-.076,1.114-.151,1.622a3.981,3.981,0,0,1-.245.925,1.847,1.847,0,0,1-.453.717,2.171,2.171,0,0,1-1.151.6q-3.585.265-7.641.189-2.377-.038-3.387-.085a11.337,11.337,0,0,1-1.5-.142,2.206,2.206,0,0,1-1.113-.585,2.562,2.562,0,0,1-.528-1.037,3.523,3.523,0,0,1-.141-.585c-.032-.2-.06-.5-.085-.906a38.894,38.894,0,0,1,0-4.867l.113-.925a4.382,4.382,0,0,1,.208-.906,2.069,2.069,0,0,1,.491-.755,2.409,2.409,0,0,1,1.113-.566,19.2,19.2,0,0,1,2.292-.151q1.82-.056,3.953-.056t3.952.066q1.821.067,2.311.142a2.3,2.3,0,0,1,.726.283,1.865,1.865,0,0,1,.557.49,3.425,3.425,0,0,1,.434,1.019,5.72,5.72,0,0,1,.189,1.075q0,.095.057,1C967.752,1364.1,967.759,1364.677,967.759,1365.592Zm-7.6.925q1.49-.754,2.113-1.094l-4.434-2.339v4.66Q958.609,1367.311,960.156,1366.517Z"
        transform="translate(-951.269 -1359.8)"
        fill="currentColor"
      ></path>
    </svg>
  ),
}

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Cignet footer
   behavior. */
const FooterLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) =>
  href.startsWith("/") ? (
    <LocalizedClientLink className="footer__widget--menu__text" href={href}>
      {children}
    </LocalizedClientLink>
  ) : (
    <a className="footer__widget--menu__text" href={href}>
      {children}
    </a>
  )

const RokonFooterView = ({
  footer,
  categories,
  brand,
}: RokonFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  return (
    <footer className="rokon-theme footer__section footer__bg">
      <div className="container">
        <div className="main__footer section--padding">
          <div className="row">
            <div className="col-lg-4 col-md-6">
              <RokonFooterWidget
                title="About Us"
                titleClassName="d-none d-md-block"
              >
                <LocalizedClientLink className="footer__logo" href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="footer__logo--img display-block"
                    src={footer.bottom_logo || FALLBACK_FOOTER_LOGO}
                    alt={brand}
                  />
                </LocalizedClientLink>
                <p className="footer__widget--desc">
                  {brand} brings you a curated collection of premium fashion
                  and elegant jewellery.
                </p>
                {footer.social.length > 0 && (
                  <div className="footer__social">
                    <ul className="social__shear d-flex">
                      {footer.social.map((s, i) => {
                        const label = socialLabel(s.icon)
                        const svg = SOCIAL_SVGS[label.toLowerCase()]
                        return (
                          <li className="social__shear--list" key={i}>
                            <a
                              className="social__shear--list__icon"
                              target="_blank"
                              rel="noreferrer"
                              href={s.href}
                            >
                              {svg ?? <span>{label.charAt(0)}</span>}
                              <span className="visually-hidden">{label}</span>
                            </a>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </RokonFooterWidget>
            </div>
            <div className="col-lg-3 col-md-6">
              <RokonFooterWidget title="Quick Links">
                <ul className="footer__widget--menu">
                  {categoryLinks.map((c) => (
                    <li className="footer__widget--menu__list" key={c.id}>
                      <LocalizedClientLink
                        className="footer__widget--menu__text"
                        href={`/categories/${c.handle}`}
                      >
                        {c.name}
                      </LocalizedClientLink>
                    </li>
                  ))}
                  {footer.column_categories.extra.map((item, i) => (
                    <li className="footer__widget--menu__list" key={`x-${i}`}>
                      <FooterLink href={item.href}>{item.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </RokonFooterWidget>
            </div>
            <div className="col-lg-2 col-md-6">
              <RokonFooterWidget title="Account Info">
                <ul className="footer__widget--menu">
                  {footer.column_links.map((item, i) => (
                    <li className="footer__widget--menu__list" key={i}>
                      <FooterLink href={item.href}>{item.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </RokonFooterWidget>
            </div>
            <div className="col-lg-3 col-md-6">
              <RokonFooterWidget title={footer.newsletter.title || "Newsletter"}>
                <div className="footer__newsletter">
                  <p className="footer__newsletter--desc">
                    Get updates by subscribing to our weekly newsletter
                  </p>
                  {/* Same non-wired form as the shared Learts/Cignet
                      footers — no subscribe action exists yet. */}
                  <form className="newsletter__subscribe--form__style position__relative">
                    <label>
                      <input
                        className="footer__newsletter--input newsletter__subscribe--input"
                        placeholder={footer.newsletter.placeholder}
                        aria-label={footer.newsletter.title}
                        type="email"
                      />
                    </label>
                    <button
                      className="footer__newsletter--button newsletter__subscribe--button primary__btn"
                      type="submit"
                    >
                      {footer.newsletter.button}
                      <svg
                        className="newsletter__subscribe--button__icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="9.159"
                        height="7.85"
                        viewBox="0 0 9.159 7.85"
                      >
                        <path
                          data-name="Icon material-send"
                          d="M3,12.35l9.154-3.925L3,4.5,3,7.553l6.542.872L3,9.3Z"
                          transform="translate(-3 -4.5)"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </form>
                </div>
              </RokonFooterWidget>
            </div>
          </div>
        </div>
        <div className="footer__bottom d-flex justify-content-between align-items-center">
          <p className="copyright__content m-0">{copyright}</p>
          <p className="footer__bottom--desc">
            <LocalizedClientLink href="/contact-us">
              Contact Us
            </LocalizedClientLink>
          </p>
        </div>
      </div>
    </footer>
  )
}

export default RokonFooterView
