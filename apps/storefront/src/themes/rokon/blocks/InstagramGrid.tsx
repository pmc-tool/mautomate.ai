import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the CMS "instagram_grid" block: the block's       */
/* images list rendered with the template's "instagram__section"        */
/* thumbnail tiles (index-2.html). The template's edge-to-edge Swiper   */
/* strip is reimplemented as a full-width responsive grid (no Swiper    */
/* JS), keeping the `.instagram__thumbnail` hover overlay + icon.       */
/* Consumes the SAME resolved block-data prop bag as the Cignet/Learts  */
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

/* The template's instagram hover icon (compact single-path version). */
const InstagramIcon = () => (
  <span className="instagram__social--icon">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="25.198"
      height="25.199"
      viewBox="0 0 25.198 25.199"
    >
      <path
        d="M8.4,12.6a4.2,4.2,0,1,1,4.2,4.2,4.2,4.2,0,0,1-4.2-4.2m-2.271,0A6.47,6.47,0,1,0,12.6,6.13,6.469,6.469,0,0,0,6.13,12.6M17.813,5.873a1.512,1.512,0,1,0,1.513-1.511h0a1.513,1.513,0,0,0-1.512,1.511M7.509,22.855a6.963,6.963,0,0,1-2.34-.433,3.916,3.916,0,0,1-1.449-.942,3.887,3.887,0,0,1-.942-1.448,6.957,6.957,0,0,1-.433-2.34c-.061-1.328-.073-1.727-.073-5.092s.013-3.762.073-5.092a7.01,7.01,0,0,1,.433-2.34A3.916,3.916,0,0,1,3.72,3.719a3.883,3.883,0,0,1,1.449-.942,6.957,6.957,0,0,1,2.34-.433c1.328-.061,1.727-.073,5.09-.073s3.762.013,5.092.073a7.01,7.01,0,0,1,2.34.433,3.9,3.9,0,0,1,1.449.942,3.9,3.9,0,0,1,.942,1.449,6.957,6.957,0,0,1,.433,2.34c.061,1.329.073,1.727.073,5.092s-.012,3.762-.073,5.092a6.99,6.99,0,0,1-.433,2.34,4.172,4.172,0,0,1-2.392,2.391,6.957,6.957,0,0,1-2.34.433c-1.328.061-1.727.073-5.092.073s-3.762-.012-5.09-.073M7.4.076A9.239,9.239,0,0,0,4.347.662,6.18,6.18,0,0,0,2.115,2.115,6.156,6.156,0,0,0,.662,4.347,9.241,9.241,0,0,0,.076,7.4C.014,8.748,0,9.178,0,12.6s.014,3.851.076,5.194a9.241,9.241,0,0,0,.585,3.058,6.159,6.159,0,0,0,1.453,2.232,6.2,6.2,0,0,0,2.232,1.453,9.247,9.247,0,0,0,3.058.585c1.344.061,1.773.076,5.194.076s3.851-.014,5.194-.076a9.241,9.241,0,0,0,3.058-.585,6.442,6.442,0,0,0,3.685-3.685,9.216,9.216,0,0,0,.585-3.058c.061-1.344.075-1.773.075-5.194s-.014-3.851-.075-5.194a9.238,9.238,0,0,0-.585-3.058,6.2,6.2,0,0,0-1.453-2.232A6.165,6.165,0,0,0,20.853.662,9.226,9.226,0,0,0,17.795.076C16.451.015,16.022,0,12.6,0S8.749.014,7.4.076"
        transform="translate(0 0)"
        fill="currentColor"
      />
    </svg>
  </span>
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
    <div className="instagram__section">
      {heading || handle ? (
        <div className="container">
          <div className="section__heading text-center mb-50">
            {heading ? (
              <h2 className="section__heading--maintitle text__secondary mb-10">
                {heading}
              </h2>
            ) : null}
            {handle ? (
              <p className="section__heading--desc">{handle}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="container-fluid p-0">
        <div
          className="instagram__section--inner"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {images.map((item, i) => {
            const href =
              typeof item.href === "string" && item.href && item.href !== "#"
                ? item.href
                : "/store"
            const external = /^https?:\/\//i.test(href)

            const media = (
              <>
                <img
                  className="instagram__thumbnail--img display-block"
                  src={item.image}
                  alt={alt}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <InstagramIcon />
              </>
            )

            return (
              <div className="instagram__thumbnail position__relative" key={i}>
                {external ? (
                  <a
                    className="instagram__thumbnail--link display-block"
                    target="_blank"
                    rel="noreferrer"
                    href={href}
                    aria-label={alt}
                  >
                    {media}
                  </a>
                ) : (
                  <LocalizedClientLink
                    className="instagram__thumbnail--link display-block"
                    href={href}
                    aria-label={alt}
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
