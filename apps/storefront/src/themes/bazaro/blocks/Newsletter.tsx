/* ------------------------------------------------------------------ */
/* Bazaro renderer for the newsletter CMS block: the template's footer  */
/* subscribe form (`aq-footer-widget-input` bordered input +            */
/* `aq-btn-subscribe` inset button, index.html footer) styled as a      */
/* standalone gray band (#FAFAFA — the template's section-panel tone).  */
/* Consumes the SAME resolved CMS block prop bag as the Cignet          */
/* Newsletter renderer (spread via `<Newsletter {...block} />`), so it  */
/* also carries block_type / schema_version / countryCode /             */
/* sectionScope which we simply ignore. `subtitle` / `provider_note`    */
/* are OPTIONAL. Same subscribe mechanism as the Cignet version: a      */
/* static presentational email form (submission wiring out of scope),   */
/* so it stays a server component. The `button` label drives the        */
/* submit control's text and accessible name.                           */
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
      className="bazaro-newsletter pt-100 pb-100"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-6 col-lg-8">
            <div className="aqf-collection-title-box text-center mb-30">
              <span className="aq-section-subtitle ff-satoshi-med mb-10">
                Newsletter
              </span>
              <h4 data-el="heading" className="aq-section-title ff-satoshi-med fs-38 mb-10">
                {title}
              </h4>
              {subtitle ? <p data-el="text" className="mb-0">{subtitle}</p> : null}
            </div>

            <div className="aq-footer-widget-input-box">
              <form>
                <div className="aq-footer-widget-input p-relative">
                  <input
                    data-el="input"
                    className="aq-form-control brr-0 h-56"
                    type="email"
                    name="mail"
                    placeholder={placeholder || "Enter Your Email"}
                    aria-label={placeholder || "Enter Your Email"}
                    autoComplete="off"
                    required
                  />
                  <button
                    data-el="button"
                    className="aq-btn-subscribe"
                    type="submit"
                    aria-label={buttonLabel}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </form>
            </div>

            {provider_note ? (
              <p
                className="text-center mb-0"
                style={{ marginTop: 20, opacity: 0.6 }}
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
