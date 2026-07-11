import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the brand_strip CMS block, restyled as the       */
/* template's google-rating-box trust strip (index.html hero): the       */
/* Google logo + five stars + "4.9/5 Review" rating text, followed by    */
/* the block's brand logos in a swiper-free flex strip. Sits on a        */
/* `dark-section` band (the template styles the rating box for the dark  */
/* hero: white stars/text on the primary green).                         */
/*                                                                      */
/* Compiled block data (mirrors backend brand_strip resolved schema),    */
/* received as the spread prop bag from the storefront SectionRenderer   */
/* (`<BrandStrip {...block} />`), so it also carries block_type /         */
/* schema_version / countryCode / sectionScope which we simply ignore.    */
/* `title` is OPTIONAL (absent / empty => heading not rendered).          */
/* `brands` is always an array (may be empty => render null). Each image  */
/* field holds a fully-resolved media URL.                                */
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

const GOOGLE_ICON = "/cignet/images/icon-google.svg"

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  if (!brands.length) {
    return null
  }

  return (
    <section className="brand-strip dark-section" style={{ padding: "60px 0" }}>
      <div className="container">
        {title ? (
          <div className="row section-row">
            <div className="col-xl-12">
              {/* Section Title Start */}
              <div className="section-title section-title-center">
                <h2 className="text-anime-style-3">{title}</h2>
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}

        <div className="row">
          <div className="col-xl-12">
            <div
              className="brand-strip-box"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "30px 60px",
              }}
            >
              {/* Google Rating Box Start */}
              <div className="google-rating-box wow fadeInUp">
                <div className="google-rating-logo">
                  <img src={GOOGLE_ICON} alt="Google rating" />
                </div>
                <div className="google-rating-content">
                  <span className="google-rating-star">
                    <i className="fa fa-solid fa-star"></i>
                    <i className="fa fa-solid fa-star"></i>
                    <i className="fa fa-solid fa-star"></i>
                    <i className="fa fa-solid fa-star"></i>
                    <i className="fa fa-solid fa-star"></i>
                  </span>
                  <h2>
                    <span className="counter">4.9</span>/5 Review
                  </h2>
                </div>
              </div>
              {/* Google Rating Box End */}

              {/* Brand Logos Start */}
              <div
                className="brand-strip-logos wow fadeInUp"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "30px 40px",
                }}
              >
                {brands.map((brand, i) => (
                  <LocalizedClientLink
                    key={i}
                    href={brand.href || "#"}
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    <img
                      src={brand.image}
                      alt="Brand"
                      style={{
                        maxHeight: "40px",
                        width: "auto",
                        maxWidth: "140px",
                        objectFit: "contain",
                        filter: "brightness(0) invert(1)",
                        opacity: 0.85,
                      }}
                    />
                  </LocalizedClientLink>
                ))}
              </div>
              {/* Brand Logos End */}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BrandStrip
