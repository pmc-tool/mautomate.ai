import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the brand_strip CMS block. The Rokon template     */
/* ships no brand-logo section, so this is a minimal, scoped strip      */
/* (class prefix `rokon-brand`) built to sit inside the template's      */
/* neutral section rhythm (`section--padding border-bottom` + the       */
/* standard `section__heading`).                                        */
/*                                                                      */
/* Compiled block data (mirrors the backend brand_strip resolved        */
/* schema), received as the spread prop bag from the storefront         */
/* SectionRenderer (`<BrandStrip {...block} />`), so it also carries    */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore. `title` is OPTIONAL (absent / empty => heading not    */
/* rendered). `brands` is always an array (may be empty => render       */
/* null). Each image field holds a fully-resolved media URL.            */
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

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  if (!brands.length) {
    return null
  }

  return (
    <section
      className="rokon-brand section--padding border-bottom"
      style={{ paddingTop: "50px", paddingBottom: "50px" }}
    >
      <div className="container">
        {title ? (
          <div className="section__heading text-center mb-50">
            <h2
              data-el="title"
              className="section__heading--maintitle text__secondary mb-10"
            >
              {title}
            </h2>
          </div>
        ) : null}
        <div
          className="rokon-brand__list"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "30px 60px",
          }}
        >
          {brands.map((brand, i) => (
            <LocalizedClientLink
              key={i}
              data-el="logo"
              href={brand.href || "#"}
              className="rokon-brand__item"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <img
                data-el-item={`brands:${i}`}
                src={brand.image}
                alt="Brand"
                style={{
                  maxHeight: "44px",
                  width: "auto",
                  maxWidth: "150px",
                  objectFit: "contain",
                  filter: "grayscale(1)",
                  opacity: 0.7,
                  transition: "opacity 0.3s ease",
                }}
              />
            </LocalizedClientLink>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BrandStrip
