import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the brand_strip CMS block: the template's "brand  */
/* area" (.tp-brand-area / .tp-brand-item logo row from index-4.html)   */
/* rendered swiper-free as a wrapping flex strip. Compiled block data   */
/* (mirrors the backend brand_strip resolved schema), received as the   */
/* spread prop bag from the storefront SectionRenderer                  */
/* (`<BrandStrip {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* `title` is OPTIONAL (absent / empty => heading not rendered).        */
/* `brands` is always an array (may be empty => render null). Each      */
/* image field holds a fully-resolved media URL; a missing image falls  */
/* back to the template's own /shofy/img/brand/logo_0N.png files.       */
/* External / hash hrefs render as plain <a>, internal paths through    */
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

/* Template defaults — the index-4.html brand logos (verified). */
const FALLBACK_LOGOS = [
  "/shofy/img/brand/logo_01.png",
  "/shofy/img/brand/logo_02.png",
  "/shofy/img/brand/logo_03.png",
  "/shofy/img/brand/logo_04.png",
  "/shofy/img/brand/logo_05.png",
]

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
    <section className="tp-brand-area pt-70 pb-70">
      <div className="container">
        {title ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="tp-section-title-wrapper mb-40 text-center">
                <h3 data-el="title" className="tp-section-title">
                  {title}
                </h3>
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          <div className="col-xl-12">
            <div className="tp-brand-slider p-relative">
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
                  const image =
                    brand.image || FALLBACK_LOGOS[i % FALLBACK_LOGOS.length]
                  const logo = (
                    <img
                      src={image}
                      alt="Brand"
                      style={{
                        maxHeight: 60,
                        width: "auto",
                        maxWidth: 160,
                        objectFit: "contain",
                      }}
                    />
                  )
                  return (
                    <div
                      data-el="logo"
                      data-el-item={`brands:${i}`}
                      className="tp-brand-item text-center"
                      key={i}
                    >
                      {isExternal(brand.href) ? (
                        <a href={brand.href || "#"}>{logo}</a>
                      ) : (
                        <LocalizedClientLink href={brand.href}>
                          {logo}
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
    </section>
  )
}

export default BrandStrip
