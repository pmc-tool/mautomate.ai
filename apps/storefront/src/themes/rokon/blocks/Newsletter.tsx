/* ------------------------------------------------------------------ */
/* Rokon renderer for the newsletter CMS block: the template's          */
/* "newsletter__section newsletter__bg" band (about.html /              */
/* index-2.html) — title on the left, bordered input + Subscribe        */
/* button on the right. Consumes the SAME resolved CMS block prop bag   */
/* as the Cignet/Learts Newsletter renderers (spread via                */
/* `<Newsletter {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* `subtitle` / `provider_note` are OPTIONAL. Same subscribe mechanism  */
/* as the Cignet version: a static presentational email form            */
/* (submission wiring out of scope), so it stays a server component.    */
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
    <section className="newsletter__section newsletter__bg">
      <div className="container">
        <div className="row row-cols-md-2 row-cols-1 align-items-center">
          <div className="col">
            <div className="newsletter__content position__relative">
              <h2 data-el="heading" className="newsletter__content--title text-white">
                {title}
              </h2>
              {subtitle ? (
                <p
                  data-el="text"
                  className="newsletter__content--desc text-white"
                  style={{ marginTop: "10px", opacity: 0.8 }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="col">
            <div className="newsletter__subscribe">
              <form
                className="newsletter__subscribe position__relative"
                action="#"
              >
                <label>
                  <input
                    data-el="input"
                    className="newsletter__subscribe--input style2"
                    placeholder={placeholder || "Enter Your Email"}
                    aria-label={placeholder || "Enter Your Email"}
                    type="email"
                    name="mail"
                    autoComplete="off"
                    required
                  />
                </label>
                <button
                  data-el="button"
                  className="newsletter__subscribe--button style2 primary__btn"
                  type="submit"
                >
                  {buttonLabel}
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
              {provider_note ? (
                <p
                  className="text-white"
                  style={{
                    marginTop: "15px",
                    marginBottom: 0,
                    opacity: 0.6,
                    fontSize: "14px",
                  }}
                >
                  {provider_note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Newsletter
