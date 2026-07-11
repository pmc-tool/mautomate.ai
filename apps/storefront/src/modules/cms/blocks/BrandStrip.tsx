import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend brand_strip resolved schema).  */
/* Received as the spread prop bag from the storefront SectionRenderer */
/* (`<BrandStrip {...block} />`), so it also carries block_type /       */
/* schema_version which we simply ignore.                              */
/* `title` is OPTIONAL (absent / empty => heading not rendered).        */
/* `brands` is always an array (may be empty). Each image field holds   */
/* a fully-resolved media URL (absolute backend urls or /learts paths   */
/* both work in <img>).                                                 */
/* ------------------------------------------------------------------ */

export interface BrandStripItem {
  image: string
  href: string
}

export interface BrandStripData {
  title?: string
  brands?: BrandStripItem[]
  [key: string]: unknown
}

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  return (
    <div className="section section-fluid section-padding bg-white border-top-dashed border-bottom-dashed learts-theme">
      <div className="container">
        {title ? (
          <div className="section-title text-center">
            <h2 className="title title-icon-both" data-el="title">
              {title}
            </h2>
          </div>
        ) : null}
        <div
          className="brand-carousel row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-6 align-items-center justify-content-center"
          style={{ gap: "20px 0" }}
        >
          {brands.map((brand, i) => (
            <div className="col" key={i}>
              <div className="brand-item text-center" data-el="logo">
                <LocalizedClientLink href={brand.href || "#"}>
                  <img src={brand.image} alt="Brand" />
                </LocalizedClientLink>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BrandStrip
