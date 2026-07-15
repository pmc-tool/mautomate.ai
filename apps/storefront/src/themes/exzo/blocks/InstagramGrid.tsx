import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the CMS "instagram_grid" block. Exzo demo 1 has no */
/* Instagram section of its own, so the tiles are composed from the     */
/* template's building blocks: a centered .simple-article eyebrow +     */
/* .h2 handle + .title-underline heading over a Bootstrap grid of       */
/* square .block-image.rounded-image photo tiles (six across on         */
/* desktop, like the template's gallery grids).                         */
/* Consumes the SAME resolved block-data prop bag as the Learts/Cignet  */
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
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item && typeof item.image === "string" && item.image)
    : []

  if (images.length === 0) {
    return null
  }

  const alt = handle || "Instagram"

  return (
    <div className="exzo-instagram-grid">
      <div className="container">
        {heading || handle ? (
          <div>
            <div className="text-center">
              {heading ? (
                <div className="simple-article size-3 grey uppercase col-xs-b5">
                  {heading}
                </div>
              ) : null}
              {handle ? (
                <div data-el="title" className="h2">
                  {handle}
                </div>
              ) : null}
              <div className="title-underline center">
                <span></span>
              </div>
            </div>
            <div className="empty-space col-xs-b35 col-md-b70"></div>
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
              <img
                src={item.image}
                alt={alt}
                className="block-image rounded-image"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                }}
              />
            )

            return (
              <div
                data-el="item"
                data-el-item={`images:${i}`}
                className="col-md-2 col-sm-4 col-xs-6 col-xs-b30"
                key={i}
              >
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={alt}
                    style={{ display: "block", cursor: "pointer" }}
                  >
                    {media}
                  </a>
                ) : (
                  <LocalizedClientLink
                    href={href}
                    aria-label={alt}
                    style={{ display: "block", cursor: "pointer" }}
                  >
                    {media}
                  </LocalizedClientLink>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default InstagramGrid
