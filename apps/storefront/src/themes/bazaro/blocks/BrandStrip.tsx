import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the brand_strip CMS block, restyled as the       */
/* template's text-slide marquee band (`aqf-text-slide-area`,           */
/* index.html 2270-2387) carrying the block's brand logos instead of    */
/* promo copy. The marquee motion is the template's OWN CSS animation   */
/* (`.aqf-text-slide-wrap` -> `slide-har` keyframes in main.css, pauses */
/* on hover) — no JS, no bridge-sheet additions. The logo run is        */
/* rendered twice (second copy aria-hidden) so the translateX(-100%)    */
/* loop is seamless.                                                    */
/*                                                                      */
/* Compiled block data (mirrors the backend brand_strip resolved        */
/* schema), received as the spread prop bag from the storefront         */
/* SectionRenderer (`<BrandStrip {...block} />`), so it also carries    */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore. `title` is OPTIONAL (absent / empty => heading not    */
/* rendered). `brands` is always an array (may be empty => render       */
/* null). Missing images fall back to the template's own                */
/* /bazaro/img/brand logos (mixed .png/.jpg — verified on disk).        */
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

/* Template defaults — the /bazaro/img/brand logo files (verified ext). */
const FALLBACK_LOGOS = [
  "/bazaro/img/brand/logo-1.png",
  "/bazaro/img/brand/logo-2.png",
  "/bazaro/img/brand/logo-3.png",
  "/bazaro/img/brand/logo-4.jpg",
  "/bazaro/img/brand/logo-5.jpg",
  "/bazaro/img/brand/logo-6.jpg",
  "/bazaro/img/brand/logo-7.png",
  "/bazaro/img/brand/logo-8.png",
]

/** Is this href off-site (or a bare hash / empty)? Then not localized. */
const isExternal = (href: string) =>
  /^https?:\/\//.test(href) || href.startsWith("#") || !href

const BrandStrip = (props: BrandStripData) => {
  const { title } = props
  const brands = Array.isArray(props.brands) ? props.brands : []

  if (!brands.length) {
    return null
  }

  /** One full run of the logo strip; rendered twice for a seamless loop. */
  const run = (hidden: boolean) => (
    <div
      className="d-flex align-items-center"
      aria-hidden={hidden ? true : undefined}
      style={{ flex: "0 0 auto" }}
    >
      {brands.map((brand, i) => {
        const image = brand.image || FALLBACK_LOGOS[i % FALLBACK_LOGOS.length]
        const logo = (
          <img
            src={image}
            alt={hidden ? "" : "Brand"}
            style={{
              maxHeight: 44,
              width: "auto",
              maxWidth: 150,
              objectFit: "contain",
            }}
          />
        )
        return (
          <div
            className="aqf-text-slide-item"
            data-el="logo"
            data-el-item={`brands:${i}`}
            key={i}
            style={{ paddingInlineEnd: 90 }}
          >
            {isExternal(brand.href) ? (
              <a href={brand.href || "#"} tabIndex={hidden ? -1 : undefined}>
                {logo}
              </a>
            ) : (
              <LocalizedClientLink
                href={brand.href}
                tabIndex={hidden ? -1 : undefined}
              >
                {logo}
              </LocalizedClientLink>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="aqf-text-slide-area aqf-text-slide-bdr fix bazaro-brand-strip">
      {title ? (
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <div className="aqf-collection-title-box text-center pt-40 mb-10">
                <h4 data-el="title" className="aq-section-title ff-satoshi-med fs-38 mb-0">
                  {title}
                </h4>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="aqf-text-slide-wrap pt-20 pb-20">
        {run(false)}
        {run(true)}
      </div>
    </div>
  )
}

export default BrandStrip
