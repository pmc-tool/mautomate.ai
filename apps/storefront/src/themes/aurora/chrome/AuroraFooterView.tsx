import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Aurora chrome FOOTER — PRESENTATIONAL view. Pure, client-safe (no data */
/* fetching, no server-only imports): it takes the already-resolved      */
/* footer settings + categories + brand name as props and renders the    */
/* Aurora (modern minimalist editorial) markup. Rendered BYTE-IDENTICALLY */
/* by both the live async server AuroraFooter (which fetches then renders */
/* this) and the visual-editor canvas (which passes the chrome data it    */
/* already has), so the editor footer matches the storefront. The         */
/* FooterSettings contract is re-declared locally so the View never       */
/* imports server-only presentational types.                              */
/* ------------------------------------------------------------------ */

/* Local copy of the resolved FooterSettings contract (see
   @lib/data/cms FooterSettings) — re-declared so Aurora stays
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

export interface AuroraFooterViewProps {
  footer: FooterSettings
  categories?: any[]
  brand: string
}

/* Inline brand SVGs keyed by the Font Awesome slug stored in
   settings.social[].icon. Falls back to a generic link glyph. */
const SocialIcon = ({ icon }: { icon: string }) => {
  const key = icon.replace(/^fa-/, "")
  switch (key) {
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M22 5.8a8.4 8.4 0 0 1-2.36.65 4.1 4.1 0 0 0 1.8-2.27 8.2 8.2 0 0 1-2.6 1 4.1 4.1 0 0 0-7 3.74A11.6 11.6 0 0 1 3.4 4.6a4.1 4.1 0 0 0 1.27 5.48A4 4 0 0 1 2.8 9.6v.05a4.1 4.1 0 0 0 3.3 4 4.1 4.1 0 0 1-1.85.07 4.1 4.1 0 0 0 3.83 2.85A8.23 8.23 0 0 1 2 18.28a11.6 11.6 0 0 0 6.29 1.84c7.55 0 11.67-6.25 11.67-11.67v-.53A8.3 8.3 0 0 0 22 5.8Z" />
        </svg>
      )
    case "facebook":
    case "facebook-f":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5h1.65V4.6A22 22 0 0 0 14.7 4.5c-2.37 0-4 1.45-4 4.1v2.3H8v3.1h2.7V22h2.8Z" />
        </svg>
      )
    case "instagram":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="h-4 w-4"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M22.5 7.2a2.7 2.7 0 0 0-1.9-1.9C18.9 4.8 12 4.8 12 4.8s-6.9 0-8.6.5A2.7 2.7 0 0 0 1.5 7.2 28.3 28.3 0 0 0 1 12a28.3 28.3 0 0 0 .5 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.7 2.7 0 0 0 1.9-1.9 28.3 28.3 0 0 0 .5-4.8 28.3 28.3 0 0 0-.5-4.8ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
        </svg>
      )
    case "linkedin":
    case "linkedin-in":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M6.5 8.3H3.7V22h2.8V8.3ZM5.1 3.5A1.7 1.7 0 1 0 5.1 7a1.7 1.7 0 0 0 0-3.5ZM22 22v-7.5c0-3.8-2-5.5-4.7-5.5a4 4 0 0 0-3.6 2h-.05V8.3H8.9V22h2.8v-6.8c0-1.8.35-3.5 2.55-3.5 2.18 0 2.2 2 2.2 3.6V22H22Z" />
        </svg>
      )
    case "pinterest":
    case "pinterest-p":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12 2a10 10 0 0 0-3.65 19.3c-.08-.82-.16-2.08.03-2.97.18-.78 1.13-4.95 1.13-4.95s-.29-.58-.29-1.43c0-1.34.78-2.34 1.74-2.34.82 0 1.22.62 1.22 1.36 0 .83-.53 2.07-.8 3.22-.23.96.48 1.74 1.43 1.74 1.71 0 3.03-1.8 3.03-4.4 0-2.3-1.65-3.91-4.01-3.91-2.73 0-4.34 2.05-4.34 4.17 0 .83.32 1.71.72 2.2.08.09.09.17.07.27l-.27 1.1c-.04.18-.14.22-.33.13-1.24-.58-2.01-2.38-2.01-3.83 0-3.12 2.27-5.99 6.54-5.99 3.43 0 6.1 2.45 6.1 5.72 0 3.41-2.15 6.16-5.13 6.16-1 0-1.95-.52-2.27-1.14l-.62 2.35c-.22.86-.83 1.94-1.24 2.6A10 10 0 1 0 12 2Z" />
        </svg>
      )
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 10.5 21 3m0 0h-5.25M21 3v5.25M10.5 6H6.75A2.25 2.25 0 0 0 4.5 8.25v9A2.25 2.25 0 0 0 6.75 19.5h9a2.25 2.25 0 0 0 2.25-2.25V13.5"
          />
        </svg>
      )
  }
}

/* Locale-prefixed link for internal app paths; plain anchor for
   placeholders ("#") and external URLs — matching the Learts behavior. */
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

const linkClass =
  "text-sm text-neutral-500 transition hover:text-neutral-900"

const AuroraFooterView = ({ footer, categories }: AuroraFooterViewProps) => {
  const copyright = footer.copyright.replace(
    "{year}",
    String(new Date().getFullYear())
  )

  const categoryLinks = (categories ?? []).slice(
    0,
    footer.column_categories.limit
  )

  return (
    <footer className="aurora-theme border-t border-neutral-200 bg-white font-sans">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Contact */}
          <div className="lg:col-span-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Get in touch
            </p>
            <a
              href={`mailto:${footer.contact.email}`}
              className="mt-4 block text-2xl font-semibold tracking-tight text-neutral-900 transition hover:text-neutral-700"
            >
              {footer.contact.email}
            </a>
            <p className="mt-2 text-sm text-neutral-500">
              {footer.contact.phone}
            </p>
            {footer.contact.app_buttons.length > 0 ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {footer.contact.app_buttons.map((btn, i) => (
                  <a
                    key={i}
                    href={btn.href}
                    className="inline-flex transition hover:opacity-80"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={btn.img}
                      alt={btn.alt}
                      className="h-10 w-auto object-contain"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Shop / categories */}
          <div className="lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Shop
            </p>
            <ul className="mt-5 space-y-3">
              {categoryLinks.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className={linkClass}
                  >
                    {c.name}
                  </LocalizedClientLink>
                </li>
              ))}
              {footer.column_categories.extra.map((item, i) => (
                <li key={`x-${i}`}>
                  <FooterLink href={item.href} className={linkClass}>
                    {item.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Company / links */}
          <div className="lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Company
            </p>
            <ul className="mt-5 space-y-3">
              {footer.column_links.map((item, i) => (
                <li key={i}>
                  <FooterLink href={item.href} className={linkClass}>
                    {item.label}
                  </FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter + social */}
          <div className="lg:col-span-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              {footer.newsletter.title}
            </p>
            <form className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                    />
                  </svg>
                </span>
                <input
                  autoComplete="off"
                  type="email"
                  placeholder={footer.newsletter.placeholder}
                  className="w-full rounded-full border border-neutral-200 bg-white py-3 pl-11 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
                style={{ backgroundColor: "var(--aurora-accent)" }}
              >
                {footer.newsletter.button}
              </button>
            </form>

            {footer.social.length > 0 ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {footer.social.map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.icon.replace(/^fa-/, "")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                  >
                    <SocialIcon icon={s.icon} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-8 sm:px-6 md:flex-row md:justify-between lg:px-8">
          <p className="order-2 text-sm text-neutral-500 md:order-1">
            {copyright}
          </p>
          {footer.bottom_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={footer.bottom_logo}
              alt="Logo"
              className="order-1 h-9 w-auto object-contain md:order-2"
            />
          ) : null}
          {footer.payment_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={footer.payment_image}
              alt="Payment methods"
              className="order-3 h-6 w-auto object-contain"
            />
          ) : null}
        </div>
      </div>
    </footer>
  )
}

export default AuroraFooterView
