import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the brand_strip CMS block: the block's logos    */
/* rendered as the template's `.single-brand-item` strip (style.css     */
/* ships the .35 -> 1 opacity hover). The template drove this with a    */
/* slick slider; here it is a plain centered flex row that wraps.       */
/*                                                                      */
/* Compiled block data (mirrors backend brand_strip resolved schema),   */
/* received as the spread prop bag from the storefront SectionRenderer  */
/* (`<BrandStrip {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* `title` is OPTIONAL (absent / empty => heading not rendered).        */
/* `brands` is always an array (may be empty => render null) — like     */
/* Cignet, NO built-in template logos; logos come from props only.      */
/* External hrefs get a plain <a>; internal paths go through            */
/* LocalizedClientLink.                                                 */
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
  /^https?:\/\//.test(href) || href.startsWith("#")

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  if (!brands.length) {
    return null
  }

  return (
    <div className="brand-area section-space--ptb_90">
      <div className="container">
        {title ? (
          <div className="row">
            <div className="col-lg-12">
              <div className="section-title text-center mb-20">
                <h2 className="section-title--one section-title--center">
                  {title}
                </h2>
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          <div className="col-lg-12">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "30px 60px",
              }}
            >
              {brands.map((brand, i) => {
                const image = (
                  <img
                    src={brand.image}
                    className="img-fluid"
                    alt="Brand logo"
                  />
                )
                return (
                  <div className="single-brand-item" key={i}>
                    {isExternal(brand.href || "#") ? (
                      <a
                        href={brand.href || "#"}
                        target={
                          /^https?:\/\//.test(brand.href || "")
                            ? "_blank"
                            : undefined
                        }
                        rel={
                          /^https?:\/\//.test(brand.href || "")
                            ? "noreferrer"
                            : undefined
                        }
                      >
                        {image}
                      </a>
                    ) : (
                      <LocalizedClientLink href={brand.href}>
                        {image}
                      </LocalizedClientLink>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BrandStrip
