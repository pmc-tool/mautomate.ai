/* ------------------------------------------------------------------ */
/* Ekka renderer for the newsletter CMS block: the template's           */
/* ".ec-offer-section" band visual language (index.html) carrying the   */
/* footer's ".ec-subscribe-form" email input + paper-plane submit.      */
/* Consumes the SAME resolved CMS block prop bag as the                 */
/* Learts/Aurora/Cignet Newsletter renderers (spread via                */
/* `<Newsletter {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* `subtitle` / `provider_note` are OPTIONAL. Same subscribe mechanism  */
/* as the Cignet version: a static presentational email form            */
/* (submission wiring out of scope), so it stays a server component.    */
/* The `button` label drives the submit control's accessible name (the  */
/* template's button is the paper-plane icon visual).                   */
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
    <section
      className="section ec-offer-section section-space-p section-space-m ekka-newsletter"
      style={{ minHeight: 360 }}
    >
      <h2 className="d-none">Newsletter</h2>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-6 col-lg-7 col-md-8 align-self-center ec-offer-content">
            <h2 className="ec-offer-title">{title}</h2>
            {subtitle ? (
              <span className="ec-offer-desc">{subtitle}</span>
            ) : null}

            {/* Subscribe Form Start */}
            <div
              className="ec-subscribe-form"
              style={{ maxWidth: 480, width: "100%", margin: "23px auto 0" }}
            >
              <form>
                <div
                  className="ec-form"
                  style={{
                    display: "flex",
                    border: "1px solid #eeeeee",
                    padding: 5,
                    backgroundColor: "#ffffff",
                  }}
                >
                  <input
                    className="ec-email"
                    type="email"
                    name="ec-email"
                    placeholder={placeholder || "Enter your email here..."}
                    aria-label={placeholder || "Enter your email here..."}
                    autoComplete="off"
                    required
                  />
                  <button
                    className="button btn-primary"
                    type="submit"
                    name="subscribe"
                    aria-label={buttonLabel}
                    title={buttonLabel}
                  >
                    <i className="ecicon eci-paper-plane-o" aria-hidden="true"></i>
                  </button>
                </div>
              </form>
            </div>
            {/* Subscribe Form End */}

            {provider_note ? (
              <p
                style={{
                  color: "#777777",
                  textAlign: "center",
                  margin: "15px 0 0",
                  fontSize: 13,
                }}
              >
                {provider_note}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Newsletter
