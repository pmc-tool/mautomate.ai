import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the CMS "instagram_grid" block: the block's      */
/* images list rendered as the template's "Our Blog" media grid         */
/* (`.our-blog` / `.post-item` image cards in a responsive row).        */
/* Consumes the SAME resolved block-data prop bag as the Learts/Aurora  */
/* versions (`<InstagramGrid {...block} />`), so it also carries        */
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
    ? props.images
        .map((m, i) => ({ item: m, i }))
        .filter(({ item }) => item && typeof item.image === "string" && item.image)
    : []

  if (images.length === 0) {
    return null
  }

  const alt = handle || "Instagram"

  return (
    <div className="our-blog cignet-instagram-grid">
      <div className="container">
        {heading || handle ? (
          <div className="row section-row">
            <div className="col-xl-12">
              {/* Section Title Start */}
              <div className="section-title section-title-center">
                {heading ? (
                  <span className="section-sub-title wow fadeInUp">
                    {heading}
                  </span>
                ) : null}
                {handle ? (
                  <h2 data-el="title" className="text-anime-style-3">{handle}</h2>
                ) : null}
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}

        <div className="row">
          {images.map(({ item, i }) => {
            const href =
              typeof item.href === "string" && item.href && item.href !== "#"
                ? item.href
                : "/store"
            const external = /^https?:\/\//i.test(href)

            const media = (
              <figure className="image-anime">
                <img src={item.image} alt={alt} />
              </figure>
            )

            return (
              <div data-el="item" data-el-item={`images:${i}`} className="col-xl-4 col-md-6" key={i}>
                {/* Post Item Start */}
                <div className="post-item wow fadeInUp">
                  <div className="post-featured-image">
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={alt}
                        style={{ cursor: "pointer" }}
                      >
                        {media}
                      </a>
                    ) : (
                      <LocalizedClientLink
                        href={href}
                        aria-label={alt}
                        style={{ cursor: "pointer" }}
                      >
                        {media}
                      </LocalizedClientLink>
                    )}
                  </div>
                </div>
                {/* Post Item End */}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default InstagramGrid
