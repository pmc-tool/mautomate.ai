/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist) renderer for the CMS "instagram_grid"     */
/* block. Consumes the SAME resolved block-data prop bag as the Learts   */
/* version (`<InstagramGrid {...block} />`), so it also carries          */
/* block_type / schema_version / countryCode which we simply ignore.     */
/*                                                                      */
/* Editorial, monochrome image grid: an eyebrow + heading + @handle      */
/* label over a responsive grid of rounded square tiles. Each tile is a  */
/* link to its `href` (external instagram urls -> plain <a>) with a       */
/* subtle hover overlay and inline instagram glyph. `images` is always    */
/* treated as an array (may be empty -> the section renders nothing).     */
/* All image fields hold fully-resolved media URLs.                       */
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
        .map((m, i) => ({ item: m, i }))
        .filter(({ item }) => item && typeof item.image === "string" && item.image)
    : []

  if (images.length === 0) {
    return null
  }

  return (
    <section className="aurora-theme bg-white py-16 font-sans md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(heading || handle) && (
          <div className="mb-10 text-center md:mb-14">
            {heading ? (
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                {heading}
              </p>
            ) : null}
            {handle ? (
              <h2 data-el="title" className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
                {handle}
              </h2>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {images.map(({ item, i }) => (
            <a
              key={i}
              data-el="item"
              data-el-item={`images:${i}`}
              href={item.href || "#"}
              target="_blank"
              rel="noreferrer"
              aria-label={handle || "Instagram"}
              className="group relative block aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <img
                src={item.image}
                alt={handle || "Instagram"}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 opacity-0 transition duration-300 group-hover:bg-neutral-900/40 group-hover:opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-white"
                  aria-hidden="true"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export default InstagramGrid
