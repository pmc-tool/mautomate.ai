/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) Newsletter block.                        */
/* Consumes the SAME resolved CMS block prop bag as the Learts          */
/* Newsletter renderer (spread via `<Newsletter {...block} />`), so it  */
/* also carries block_type / schema_version / countryCode which we      */
/* simply ignore. `subtitle` / `provider_note` are OPTIONAL.            */
/* Static presentational email form (submission wiring out of scope).   */
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
    <section className="aurora-theme bg-white py-16 md:py-24 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm transition md:px-12 md:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            Newsletter
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-4 text-base text-neutral-500">{subtitle}</p>
          ) : null}
          <form className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <div className="relative flex-1 sm:max-w-sm">
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
                placeholder={placeholder || "Enter your email address"}
                className="w-full rounded-full border border-neutral-200 bg-white py-3 pl-11 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {button || "Subscribe"}
            </button>
          </form>
          {provider_note ? (
            <p className="mt-4 text-xs text-neutral-500">{provider_note}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default Newsletter
