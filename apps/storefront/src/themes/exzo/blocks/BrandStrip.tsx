import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the brand_strip CMS block: the template's "our     */
/* brands / best of the best" client logo wall from about1.html —       */
/* a.client-logo-entry tiles (each logo twice, so the template CSS can  */
/* run its slide-up hover swap) behind a centered .h2 +                 */
/* .title-underline heading.                                            */
/*                                                                      */
/* Compiled block data (mirrors backend brand_strip resolved schema),   */
/* received as the spread prop bag from the storefront SectionRenderer  */
/* (`<BrandStrip {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* `title` is OPTIONAL (absent / empty => heading not rendered).        */
/* `brands` is always an array (may be empty => render null). Each      */
/* image field holds a fully-resolved media URL.                        */
/* ------------------------------------------------------------------ */

export interface BrandStripItem {
  image: string
  href: string
}

export interface BrandStripData {
  title?: string
  brands?: BrandStripItem[]
  /** Injected by the SectionRenderer from the route; unused here. */
  countryCode?: string
  /** Injected by the SectionRenderer ("sec-<idx>"); unused here. */
  sectionScope?: string
  [key: string]: unknown
}

/** Is this href off-site (or a bare hash)? Then it must not be localized. */
const isExternal = (href: string) =>
  /^https?:\/\//.test(href) || href.startsWith("#") || !href

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  if (!brands.length) {
    return null
  }

  return (
    <div className="exzo-brand-strip">
      {title ? (
        <div className="container">
          <div className="text-center">
            <div data-el="title" className="h2">
              {title}
            </div>
            <div className="title-underline center">
              <span></span>
            </div>
          </div>
          <div className="empty-space col-xs-b35 col-md-b70"></div>
        </div>
      ) : null}

      <div className="container">
        {brands.map((brand, i) => {
          // Both imgs are the SAME logo: the template CSS slides the second
          // copy up over the first on hover (.client-logo-entry img swap).
          const logos = (
            <>
              <img src={brand.image} alt="Brand" />
              <img src={brand.image} alt="" aria-hidden="true" />
            </>
          )
          return isExternal(brand.href) ? (
            <a
              key={i}
              data-el="logo"
              data-el-item={`brands:${i}`}
              className="client-logo-entry"
              href={brand.href || "#"}
              {...(/^https?:\/\//.test(brand.href)
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {logos}
            </a>
          ) : (
            <LocalizedClientLink
              key={i}
              data-el="logo"
              data-el-item={`brands:${i}`}
              className="client-logo-entry"
              href={brand.href}
            >
              {logos}
            </LocalizedClientLink>
          )
        })}
        {/* .client-logo-entry floats left — clear the wall */}
        <div style={{ clear: "both" }}></div>
      </div>
    </div>
  )
}

export default BrandStrip
