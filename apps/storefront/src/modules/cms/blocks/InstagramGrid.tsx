/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend instagram_grid resolved        */
/* schema). Received as the spread prop bag from the storefront         */
/* SectionRenderer (`<InstagramGrid {...block} />`), so it also carries  */
/* block_type / schema_version which we simply ignore.                  */
/*                                                                      */
/* Renders the Learts "follow us on instagram" look: a section heading  */
/* (the @handle, with the translatable heading as a sub-title) over a    */
/* responsive row of square instagram tiles, each linking out via its    */
/* href. `images` is always treated as an array (may be empty -> the     */
/* section renders nothing). All image fields hold fully-resolved media  */
/* URLs (absolute backend urls or /learts paths both work in <img>).     */
/* ------------------------------------------------------------------ */

export interface InstagramGridImage {
  image: string
  href: string
}

export interface InstagramGridData {
  handle: string
  heading?: string
  images?: InstagramGridImage[]
  [key: string]: unknown
}

const InstagramGrid = (props: InstagramGridData) => {
  const { handle, heading } = props
  const images = Array.isArray(props.images)
    ? props.images
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m && typeof m.image === "string" && m.image)
    : []

  if (images.length === 0) {
    return null
  }

  return (
    <div className="section section-fluid section-padding bg-white learts-theme">
      <div className="container">
        {(heading || handle) && (
          <div className="section-title text-center">
            {heading ? <h3 className="sub-title">{heading}</h3> : null}
            {handle ? (
              <h2 data-el="title" className="title title-icon-both">
                {handle}
              </h2>
            ) : null}
          </div>
        )}

        <div className="row row-cols-xl-4 row-cols-md-3 row-cols-2 learts-mb-n30">
          {images.map(({ m: item, i }) => (
            <div className="col learts-mb-30" key={i} data-el-item={`images:${i}`}>
              <div data-el="item" className="instagram-banner1">
                <a
                  href={item.href || "#"}
                  className="inner"
                  aria-label={handle || "Instagram"}
                >
                  <div className="image">
                    <img src={item.image} alt={handle || "Instagram"} />
                  </div>
                  <div className="content">
                    <div className="icon">
                      <i className="fab fa-instagram" />
                    </div>
                  </div>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default InstagramGrid
