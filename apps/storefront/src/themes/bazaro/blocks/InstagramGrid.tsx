import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the CMS "instagram_grid" block: the block's      */
/* images list rendered as the template's shop-gram tiles               */
/* (`aq-shopgram-item aq-shopgram-overlay`, index-fashion-v2.html —     */
/* main.css ships the hover shade / zoom / corner-icon styling for the  */
/* default demo too). Consumes the SAME resolved block-data prop bag as */
/* the Cignet version (`<InstagramGrid {...block} />`), so it also      */
/* carries block_type / schema_version / countryCode / sectionScope     */
/* which we simply ignore.                                              */
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

/* The template's shop-gram corner icon (camera, index-fashion-v2.html). */
const CameraIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="15"
    viewBox="0 0 14 15"
    fill="none"
  >
    <path
      d="M3.89236 3.61653C3.89236 2.0334 5.17572 0.750026 6.75883 0.750026C7.52116 0.746795 8.25338 1.04737 8.79358 1.5853C9.33378 2.12322 9.63745 2.85417 9.63744 3.61653M4.79126 6.60444H4.82163M8.65943 6.60444H8.68979M3.98337 13.503H9.52197C11.5564 13.503 13.1172 12.7681 12.6739 9.81052L12.1577 5.80228C11.8844 4.32652 10.9431 3.76172 10.1171 3.76172H3.36392C2.52585 3.76172 1.63919 4.36903 1.32339 5.80228L0.807182 9.81052C0.430655 12.4341 1.94891 13.503 3.98337 13.503Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

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
    <div className="aq-shopgram-area bazaro-instagram-grid pt-60 pb-60">
      <div className="container">
        {heading || handle ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="aqf-collection-title-box text-center mb-40">
                {heading ? (
                  <span className="aq-section-subtitle ff-satoshi-med mb-10">
                    {heading}
                  </span>
                ) : null}
                {handle ? (
                  <h4 className="aq-section-title ff-satoshi-med fs-38 mb-0">
                    {handle}
                  </h4>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row g-2 row-cols-lg-5 row-cols-md-3 row-cols-2">
          {images.map((item, i) => {
            const href =
              typeof item.href === "string" && item.href && item.href !== "#"
                ? item.href
                : "/store"
            const external = /^https?:\/\//i.test(href)

            const tile = (
              <div className="aq-shopgram-item aq-shopgram-overlay">
                <img src={item.image} alt={alt} />
                <span className="aq-shopgram-icon">
                  <span>
                    <CameraIcon />
                  </span>
                </span>
              </div>
            )

            return (
              <div className="col" key={i}>
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={alt}
                    style={{ display: "block", cursor: "pointer" }}
                  >
                    {tile}
                  </a>
                ) : (
                  <LocalizedClientLink
                    href={href}
                    aria-label={alt}
                    style={{ display: "block", cursor: "pointer" }}
                  >
                    {tile}
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
