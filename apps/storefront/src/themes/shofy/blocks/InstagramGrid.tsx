import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the CMS "instagram_grid" block: the block's       */
/* images list rendered as the template's "instagram area"              */
/* (.tp-instagram-item tiles in a 5-across responsive row, each with    */
/* the hover .tp-instagram-icon Instagram badge). Consumes the SAME     */
/* resolved block-data prop bag as the Learts/Cignet versions           */
/* (`<InstagramGrid {...block} />`), so it also carries block_type /    */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* Each tile links to its provided `href`: external URLs get a plain    */
/* <a target="_blank">, internal paths keep the /[countryCode] prefix   */
/* via LocalizedClientLink, and missing/# hrefs fall back to /store.    */
/* The template's magnific-popup lightbox is dropped (per the brief).   */
/* `images` is always treated as an array (empty => renders null). All  */
/* image fields hold fully-resolved media URLs.                         */
/* ------------------------------------------------------------------ */

export interface InstagramGridImage {
  image: string
  href: string
}

export interface InstagramGridData {
  handle?: string
  heading?: string
  images?: InstagramGridImage[]
  [key: string]: unknown
}

const InstagramGrid = (props: InstagramGridData) => {
  const { handle, heading } = props
  const images = Array.isArray(props.images)
    ? props.images
        .map((item, i) => ({ item, i }))
        .filter(
          ({ item }) => item && typeof item.image === "string" && item.image
        )
    : []

  if (images.length === 0) {
    return null
  }

  const alt = handle || "Instagram"

  return (
    <div className="tp-instagram-area pb-70 shofy-instagram-grid">
      <div className="container">
        {heading || handle ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="tp-section-title-wrapper mb-40 text-center">
                {heading ? (
                  <span
                    style={{
                      display: "block",
                      marginBottom: 5,
                      color: "var(--tp-theme-primary)",
                    }}
                  >
                    {heading}
                  </span>
                ) : null}
                {handle ? (
                  <h3 data-el="title" className="tp-section-title">
                    {handle}
                  </h3>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row row-cols-lg-5 row-cols-md-3 row-cols-sm-2 row-cols-1">
          {images.map(({ item, i }) => {
            const href =
              typeof item.href === "string" && item.href && item.href !== "#"
                ? item.href
                : "/store"
            const external = /^https?:\/\//i.test(href)

            const icon = external ? (
              <a href={href} target="_blank" rel="noreferrer" aria-label={alt}>
                <i className="fa-brands fa-instagram" />
              </a>
            ) : (
              <LocalizedClientLink href={href} aria-label={alt}>
                <i className="fa-brands fa-instagram" />
              </LocalizedClientLink>
            )

            return (
              <div className="col" key={i} data-el-item={`images:${i}`}>
                <div
                  data-el="item"
                  className="tp-instagram-item p-relative z-index-1 fix mb-30 w-img"
                >
                  <img src={item.image} alt={alt} />
                  <div className="tp-instagram-icon">{icon}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default InstagramGrid
