import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the CMS "instagram_grid" block: the block's     */
/* images rendered as a responsive bootstrap tile grid (col-lg-2        */
/* col-md-4 col-4, six across on desktop). style.css's own              */
/* `.instagram_gallery` rules are the 80px footer-widget thumbnails —   */
/* deliberately NOT reused here; the tiles carry the unstyled           */
/* `instagram_gallery-item` class instead and size via img-fluid/w-100. */
/* Consumes the SAME resolved block-data prop bag as the Cignet         */
/* version (`<InstagramGrid {...block} />`), so it also carries         */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore.                                                       */
/*                                                                      */
/* Each tile links to its provided `href`: external URLs get a plain    */
/* <a target="_blank">, internal paths keep the /[countryCode] prefix   */
/* via LocalizedClientLink, and missing/# hrefs fall back to /store.    */
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
    ? props.images.filter((m) => m && typeof m.image === "string" && m.image)
    : []

  if (images.length === 0) {
    return null
  }

  const alt = handle || "Instagram"

  return (
    <div className="helendo-instagram-area section-space--ptb_90">
      <div className="container">
        {heading || handle ? (
          <div className="row">
            <div className="col-lg-12">
              <div className="section-title text-center mb-20">
                {heading ? (
                  <h6 className="sub-heading mb-2">{heading}</h6>
                ) : null}
                {handle ? (
                  <h2 className="section-title--one section-title--center">
                    {handle}
                  </h2>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          {images.map((item, i) => {
            const href =
              typeof item.href === "string" && item.href && item.href !== "#"
                ? item.href
                : "/store"
            const external = /^https?:\/\//i.test(href)

            const media = (
              <img src={item.image} className="img-fluid w-100" alt={alt} />
            )

            return (
              <div className="col-lg-2 col-md-4 col-4" key={i}>
                <div className="mt-30">
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="instagram_gallery-item"
                      aria-label={alt}
                      style={{ display: "block" }}
                    >
                      {media}
                    </a>
                  ) : (
                    <LocalizedClientLink
                      href={href}
                      className="instagram_gallery-item"
                      aria-label={alt}
                      style={{ display: "block" }}
                    >
                      {media}
                    </LocalizedClientLink>
                  )}
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
