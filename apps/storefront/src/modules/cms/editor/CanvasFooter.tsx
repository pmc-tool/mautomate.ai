"use client"

import type { FooterSettings } from "@lib/data/cms"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Derive the visible platform name from a Font Awesome social icon slug.
// (settings.social stores only { icon, href }; the label preserves the
// previous hardcoded Learts text.)
const SOCIAL_LABELS: Record<string, string> = {
  "fa-twitter": "Twitter",
  "fa-facebook-f": "Facebook",
  "fa-facebook": "Facebook",
  "fa-instagram": "Instagram",
  "fa-youtube": "Youtube",
  "fa-linkedin-in": "LinkedIn",
  "fa-pinterest-p": "Pinterest",
}

const socialLabel = (icon: string): string => {
  if (SOCIAL_LABELS[icon]) return SOCIAL_LABELS[icon]
  const slug = icon.replace(/^fa-/, "").replace(/-.*$/, "")
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

// Render an href as a locale-prefixed link for internal app paths, or a plain
// anchor for placeholders ("#") and external URLs — matching prior behavior.
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

export default function CanvasFooter({
  footer,
  categories,
}: {
  footer: FooterSettings
  categories?: any[]
}) {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  return (
    <div className="learts-theme cms-chrome-footer">
      {/* Footer widgets */}
      <div className="footer3-section section section-fluid section-padding">
        <div className="container">
          <div className="row learts-mb-n40">
            <div className="col-xl-4 col-lg-5 col-12 learts-mb-40">
              <div className="widget-contact">
                <p className="email">{footer.contact.email}</p>
                <p className="phone">{footer.contact.phone}</p>
                <div className="app-buttons">
                  {footer.contact.app_buttons.map((btn, i) => (
                    <a key={i} href={btn.href}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={btn.img} alt={btn.alt} />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-xl-4 col-lg-7 col-12 learts-mb-40">
              <div className="row row-cols-sm-3 row-cols-1 learts-mb-n40">
                <div className="col learts-mb-40">
                  <ul className="widget-list" data-el="columns">
                    {(categories ?? [])
                      .slice(0, footer.column_categories.limit)
                      .map((c) => (
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
                <div className="col learts-mb-40">
                  <ul className="widget-list" data-el="columns">
                    {footer.column_links.map((item, i) => (
                      <li key={i}>
                        <FooterLink href={item.href}>{item.label}</FooterLink>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col learts-mb-40">
                  <ul className="widget-list" data-el="social">
                    {footer.social.map((s, i) => (
                      <li key={i}>
                        <i className={`fab ${s.icon}`} />{" "}
                        <a href={s.href}>{socialLabel(s.icon)}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-xl-4 col-12 learts-mb-40">
              <h5 className="widget-title mb-2" data-el="heading">
                {footer.newsletter.title}
              </h5>
              <form className="mc-form widget-subscibe2" data-el="newsletter">
                <input
                  autoComplete="off"
                  type="email"
                  placeholder={footer.newsletter.placeholder}
                />
                <button type="submit" className="btn">
                  {footer.newsletter.button}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bottom */}
      <div className="footer3-bottom section section-fluid section-padding pt-0">
        <div className="container">
          <div className="row align-items-end learts-mb-n40">
            <div className="col-md-4 col-12 learts-mb-40 order-md-2">
              <div className="widget-about text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={footer.bottom_logo}
                  alt="Forever Finds"
                  style={{ height: 40, width: "auto", display: "inline-block" }}
                />
              </div>
            </div>
            <div className="col-md-4 col-12 learts-mb-40 order-md-3">
              <div className="widget-payment text-center text-md-right">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={footer.payment_image} alt="Payment methods" />
              </div>
            </div>
            <div className="col-md-4 col-12 learts-mb-40 order-md-1">
              <div className="widget-copyright">
                <p
                  className="copyright text-center text-md-left"
                  data-el="copyright"
                >
                  {copyright}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
