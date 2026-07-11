/* ------------------------------------------------------------------ */
/* Exzo renderer for the newsletter CMS block: the template's           */
/* "special offers for subscribers" subscribe band (index1.html tail)   */
/* — centered eyebrow / h3.h3 headline / copy over a .single-line-form  */
/* (rounded .simple-input + overlaid .button.size-2.style-3 submit).    */
/* Consumes the SAME resolved CMS block prop bag as the Learts/Cignet   */
/* Newsletter renderers (spread via `<Newsletter {...block} />`), so it */
/* also carries block_type / schema_version / countryCode /             */
/* sectionScope which we simply ignore. `subtitle` / `provider_note`    */
/* are OPTIONAL. Same subscribe mechanism as the Cignet version: a      */
/* static presentational email form (submission wiring out of scope),   */
/* so it stays a server component.                                      */
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
    <div className="exzo-newsletter" style={{ background: "#f7f7f7" }}>
      <div className="container">
        <div className="row">
          <div className="col-sm-8 col-sm-offset-2 text-center">
            <div className="empty-space col-xs-b35 col-md-b70"></div>
            <div className="simple-article size-3 grey uppercase col-xs-b5">
              <span className="color">special offers</span> for subscribers
            </div>
            <h3 className="h3 col-xs-b15">{title}</h3>
            {subtitle ? (
              <div className="simple-article size-3 col-xs-b25">
                {subtitle}
              </div>
            ) : null}
            <form>
              <div
                className="single-line-form"
                style={{ maxWidth: "470px", margin: "0 auto" }}
              >
                <input
                  className="simple-input"
                  type="email"
                  name="mail"
                  placeholder={placeholder || "Enter your email"}
                  aria-label={placeholder || "Enter your email"}
                  autoComplete="off"
                  required
                  style={{ paddingRight: "150px" }}
                />
                <div className="button size-2 style-3">
                  <span className="button-wrapper">
                    <span className="icon">
                      <img src="/exzo/img/icon-4.png" alt="" />
                    </span>
                    <span className="text">{buttonLabel}</span>
                  </span>
                  <input type="submit" value="" aria-label={buttonLabel} />
                </div>
              </div>
            </form>
            {provider_note ? (
              <div>
                <div className="empty-space col-xs-b15"></div>
                <div className="simple-article size-1 grey">
                  {provider_note}
                </div>
              </div>
            ) : null}
            <div className="empty-space col-xs-b35 col-md-b70"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Newsletter
