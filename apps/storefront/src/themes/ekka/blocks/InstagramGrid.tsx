import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the CMS "instagram_grid" block: the block's        */
/* images list rendered as the template's "Instagram Feed" section      */
/* (.ec-instagram-section / .ec-insta-item tiles with the EcIcons       */
/* instagram hover overlay from the template CSS). The template's slick */
/* auto-scroller is dropped — tiles lay out in a flex-wrapped row.      */
/* Consumes the SAME resolved block-data prop bag as the                */
/* Learts/Aurora/Cignet versions (`<InstagramGrid {...block} />`), so   */
/* it also carries block_type / schema_version / countryCode /          */
/* sectionScope which we simply ignore.                                 */
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
    <section className="section ec-instagram-section module section-space-p">
      <div className="container">
        {heading || handle ? (
          <div className="row">
            <div className="col-md-12 text-center">
              {/* Section Title Start */}
              <div className="section-title">
                {handle ? <h2 className="ec-bg-title">{handle}</h2> : null}
                {handle ? (
                  <h2 data-el="title" className="ec-title">
                    {handle}
                  </h2>
                ) : null}
                {heading ? <p className="sub-title">{heading}</p> : null}
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}
      </div>

      <div className="ec-insta-wrapper">
        <div className="ec-insta-outer">
          <div className="container">
            <div
              className="insta-auto"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {images.map(({ item, i }) => {
                const href =
                  typeof item.href === "string" &&
                  item.href &&
                  item.href !== "#"
                    ? item.href
                    : "/store"
                const external = /^https?:\/\//i.test(href)

                const media = <img src={item.image} alt={alt} />

                return (
                  <div
                    data-el="item"
                    data-el-item={`images:${i}`}
                    className="ec-insta-item"
                    key={i}
                  >
                    <div className="ec-insta-inner">
                      {external ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={alt}
                        >
                          {media}
                        </a>
                      ) : (
                        <LocalizedClientLink href={href} aria-label={alt}>
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
      </div>
    </section>
  )
}

export default InstagramGrid
