/* ------------------------------------------------------------------ */
/* Shofy renderer for the newsletter CMS block: the template's          */
/* "subscribe area" (.tp-subscribe-area blue band with decorative       */
/* shapes + the paper plane, heading on the left and the                */
/* .tp-subscribe-input email form on the right). Consumes the SAME      */
/* resolved CMS block prop bag as the Learts/Cignet Newsletter          */
/* renderers (spread via `<Newsletter {...block} />`), so it also       */
/* carries block_type / schema_version / countryCode / sectionScope     */
/* which we simply ignore. `subtitle` / `provider_note` are OPTIONAL.   */
/* Same subscribe mechanism as the Cignet version: a static             */
/* presentational email form (submission wiring out of scope), so it    */
/* stays a server component.                                            */
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
    <section className="tp-subscribe-area pt-70 pb-65 theme-bg p-relative z-index-1">
      <div className="tp-subscribe-shape">
        <img
          className="tp-subscribe-shape-1"
          src="/shofy/img/subscribe/subscribe-shape-1.png"
          alt=""
        />
        <img
          className="tp-subscribe-shape-2"
          src="/shofy/img/subscribe/subscribe-shape-2.png"
          alt=""
        />
        <img
          className="tp-subscribe-shape-3"
          src="/shofy/img/subscribe/subscribe-shape-3.png"
          alt=""
        />
        <img
          className="tp-subscribe-shape-4"
          src="/shofy/img/subscribe/subscribe-shape-4.png"
          alt=""
        />
        {/* plane shape */}
        <div className="tp-subscribe-plane">
          <img
            className="tp-subscribe-plane-shape"
            src="/shofy/img/subscribe/plane.png"
            alt=""
          />
          <svg
            width="399"
            height="110"
            className="d-none d-sm-block"
            viewBox="0 0 399 110"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0.499634 1.00049C8.5 20.0005 54.2733 13.6435 60.5 40.0005C65.6128 61.6426 26.4546 130.331 15 90.0005C-9 5.5 176.5 127.5 218.5 106.5C301.051 65.2247 202 -57.9188 344.5 40.0003C364 53.3997 384 22 399 22"
              stroke="white"
              strokeOpacity="0.5"
              strokeDasharray="3 3"
            />
          </svg>
        </div>
      </div>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-xl-7 col-lg-7">
            <div className="tp-subscribe-content">
              {subtitle ? <span>{subtitle}</span> : null}
              <h3 className="tp-subscribe-title">{title}</h3>
            </div>
          </div>
          <div className="col-xl-5 col-lg-5">
            <div className="tp-subscribe-form">
              <form>
                <div className="tp-subscribe-input">
                  <input
                    type="email"
                    name="mail"
                    placeholder={placeholder || "Enter Your Email"}
                    aria-label={placeholder || "Enter Your Email"}
                    autoComplete="off"
                    required
                  />
                  <button type="submit">{button || "Subscribe"}</button>
                </div>
              </form>
              {provider_note ? (
                <p
                  style={{
                    color: "#ffffff",
                    opacity: 0.6,
                    margin: "12px 0 0",
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
