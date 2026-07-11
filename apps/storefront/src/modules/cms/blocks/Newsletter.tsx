/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend newsletter resolved schema).   */
/* Received as the spread prop bag from the storefront SectionRenderer */
/* (`<Newsletter {...block} />`), so it also carries block_type /      */
/* schema_version which we simply ignore.                              */
/* `subtitle` / `provider_note` are OPTIONAL (absent => not rendered). */
/* Renders the Learts `widget-subscibe` newsletter look — a static     */
/* presentational form (submission wiring is out of scope here).       */
/* ------------------------------------------------------------------ */

export interface NewsletterData {
  title?: string
  subtitle?: string
  placeholder?: string
  button?: string
  provider_note?: string
  [key: string]: unknown
}

const Newsletter = (props: NewsletterData) => {
  const { title, subtitle, placeholder, button, provider_note } = props

  if (!title) {
    return null
  }

  return (
    <div className="section section-padding bg-white learts-theme">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-7 col-lg-9 col-12">
            <div className="newsletter-area text-center">
              <h2 data-el="heading" className="title">
                {title}
              </h2>
              {subtitle ? (
                <p data-el="text" className="desc">
                  {subtitle}
                </p>
              ) : null}
              <form className="mc-form widget-subscibe2 learts-mt-20">
                <input
                  data-el="input"
                  autoComplete="off"
                  type="email"
                  placeholder={placeholder || "Enter your email address"}
                />
                <button data-el="button" type="submit" className="btn">
                  {button || "Subscribe"}
                </button>
              </form>
              {provider_note ? (
                <p className="provider-note learts-mt-15 text-muted">
                  {provider_note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Newsletter
