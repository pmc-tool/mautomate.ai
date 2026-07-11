import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the brand_strip CMS block: the template's          */
/* ".ec-brand-area" logo band (index.html). The template's slick        */
/* carousel is dropped — the block's brand logos render in a plain      */
/* flex-wrapped list carrying the template's .ec-brand-item /           */
/* .ec-brand-img classes so its own CSS (bordered logo card + hover     */
/* shadow) styles every tile.                                           */
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
    <section className="section ec-brand-area section-space-p">
      <h2 className="d-none">Brand</h2>
      <div className="container">
        {title ? (
          <div className="row">
            <div className="col-md-12 text-center">
              {/* Section Title Start */}
              <div className="section-title">
                <h2 className="ec-bg-title">{title}</h2>
                <h2 className="ec-title">{title}</h2>
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}

        <div className="row">
          <div className="ec-brand-outer">
            <ul
              className="ekka-brand-list"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                listStyle: "none",
                padding: 0,
                margin: 0,
                gap: "20px 0",
              }}
            >
              {brands.map((brand, i) => {
                const img = <img alt="brand" title="brand" src={brand.image} />
                return (
                  <li
                    className="ec-brand-item"
                    key={i}
                    style={{ flex: "0 1 12.5%", minWidth: 120 }}
                  >
                    <div className="ec-brand-img">
                      {isExternal(brand.href) ? (
                        <a href={brand.href || "#"}>{img}</a>
                      ) : (
                        <LocalizedClientLink href={brand.href}>
                          {img}
                        </LocalizedClientLink>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BrandStrip
