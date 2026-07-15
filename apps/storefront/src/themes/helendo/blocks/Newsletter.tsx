/* ------------------------------------------------------------------ */
/* Helendo renderer for the newsletter CMS block: the template's        */
/* "Our Newsletter" band (index.html .our-newsletter-area — title on    */
/* the left, form.newsletter--one input + absolute submit button on     */
/* the right). Consumes the SAME resolved CMS block prop bag as the     */
/* Cignet Newsletter renderer (spread via `<Newsletter {...block} />`), */
/* so it also carries block_type / schema_version / countryCode /       */
/* sectionScope which we simply ignore. `subtitle` / `provider_note`    */
/* are OPTIONAL. Same subscribe mechanism as the Cignet version: a      */
/* static presentational email form (submission wiring out of scope),   */
/* so it stays a server component. style.css positions `.submit-btn`    */
/* absolutely but gives the form no positioning context, so the form    */
/* carries an inline position:relative (jQuery-free port fix).          */
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
    <div className="our-newsletter-area section-space--ptb_90">
      <div className="container">
        <div className="row">
          <div className="col-lg-5 col-md-4">
            <div className="section-title small-mb__40 tablet-mb__40">
              <h2 data-el="heading" className="section-title--one">
                {title}
              </h2>
              {subtitle ? (
                <p data-el="text" className="mt-30">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="col-lg-7 col-md-8">
            <div className="newsletter-wrap">
              <form
                className="newsletter--one"
                style={{ position: "relative" }}
              >
                <input
                  data-el="input"
                  className="input-box"
                  type="email"
                  name="mail"
                  placeholder={placeholder || "Your email address"}
                  aria-label={placeholder || "Your email address"}
                  autoComplete="off"
                  required
                />
                <button data-el="button" type="submit" className="submit-btn">
                  {buttonLabel}
                </button>
              </form>
              {provider_note ? (
                <p style={{ marginTop: "15px", opacity: 0.6 }}>
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
