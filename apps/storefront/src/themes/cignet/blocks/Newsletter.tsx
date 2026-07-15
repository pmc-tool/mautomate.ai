/* ------------------------------------------------------------------ */
/* Cignet renderer for the newsletter CMS block: the template's footer  */
/* `.footer-newsletter-form` markup (bordered input + arrow submit)     */
/* styled as a standalone dark band. Consumes the SAME resolved CMS     */
/* block prop bag as the Learts/Aurora Newsletter renderers (spread via */
/* `<Newsletter {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* `subtitle` / `provider_note` are OPTIONAL. Same subscribe mechanism  */
/* as the Aurora version: a static presentational email form            */
/* (submission wiring out of scope), so it stays a server component.    */
/* The `button` label drives the submit control's accessible name (the  */
/* template's button is the arrow-icon visual).                         */
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

  const buttonLabel = button || "Subscribe"

  return (
    <div
      className="dark-section cignet-newsletter"
      style={{ padding: "80px 0" }}
    >
      <div className="container">
        <div className="row section-row" style={{ marginBottom: 0 }}>
          <div className="col-xl-12">
            {/* Section Title Start */}
            <div className="section-title section-title-center">
              <span className="section-sub-title wow fadeInUp">Newsletter</span>
              <h2 data-el="heading" className="text-anime-style-3">{title}</h2>
              {subtitle ? (
                <p data-el="text" className="wow fadeInUp">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {/* Section Title End */}

            {/* Footer Newsletter Form Start */}
            <div
              className="footer-newsletter-form"
              style={{ maxWidth: "480px", margin: "40px auto 0" }}
            >
              <form>
                <div className="form-group">
                  <input
                    data-el="input"
                    type="email"
                    name="mail"
                    className="form-control"
                    placeholder={placeholder || "Enter your e-mail"}
                    aria-label={placeholder || "Enter your e-mail"}
                    autoComplete="off"
                    required
                  />
                  <button
                    data-el="button"
                    type="submit"
                    className="newsletter-btn"
                    aria-label={buttonLabel}
                    title={buttonLabel}
                  >
                    <img src="/cignet/images/arrow-primary.svg" alt="" />
                  </button>
                </div>
              </form>
            </div>
            {/* Footer Newsletter Form End */}

            {provider_note ? (
              <p
                className="wow fadeInUp"
                style={{
                  color: "var(--white-color)",
                  opacity: 0.5,
                  textAlign: "center",
                  margin: "20px 0 0",
                }}
              >
                {provider_note}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Newsletter
