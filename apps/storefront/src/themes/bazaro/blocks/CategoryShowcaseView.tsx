import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro PRESENTATIONAL view for the category_showcase block. Pure,     */
/* client-safe — it takes the already-resolved `tiles` as props and      */
/* renders the Bazaro `aqf-collection-area` "Season Collection" cards.    */
/* Rendered BYTE-IDENTICALLY by both the live async server block          */
/* (CategoryShowcase.tsx) and the visual-editor canvas (which fetches     */
/* the same tiles from /api/puck/category-tiles).                        */
/* ------------------------------------------------------------------ */

interface CategoryTile {
  label: string
  image: string
  href: string
  count?: number
}

export interface CategoryShowcaseViewProps {
  sub_title?: string
  title?: string
  tiles: CategoryTile[]
  sectionScope?: string
}

/* Template defaults — the index.html Season Collection card photos. */
const FALLBACK_IMAGES = [
  "/bazaro/img/fashion-1/collection/collection-1.jpg",
  "/bazaro/img/fashion-1/collection/collection-2.jpg",
  "/bazaro/img/fashion-1/collection/collection-3.jpg",
  "/bazaro/img/fashion-1/collection/collection-4.jpg",
  "/bazaro/img/fashion-1/collection/collection-5.jpg",
]

/* The template's 12x12 arrow icon (aqf-collection-link). */
const ArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
  >
    <path
      d="M0.75 5.75H10.75M10.75 5.75L5.75 0.75M10.75 5.75L5.75 10.75"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <div className="aqf-collection-area fix pt-100 pb-60">
      <div className="container">
        <div className="aqf-collection-top mb-40">
          <div className="row align-items-end">
            <div className="col-md-6">
              <div className="aqf-collection-title-box text-center text-md-start mb-15">
                {sub_title ? (
                  <span className="aq-section-subtitle ff-satoshi-med mb-10">
                    {sub_title}
                  </span>
                ) : null}
                {title ? (
                  <h4 className="aq-section-title ff-satoshi-med fs-38 mb-0">
                    {title}
                  </h4>
                ) : null}
              </div>
            </div>
            <div className="col-md-6">
              <div className="aqf-collection-btn text-center text-md-end mb-15">
                <LocalizedClientLink
                  className="aq-btn-text aq-btn-underline"
                  href="/store"
                >
                  View all Collection
                </LocalizedClientLink>
              </div>
            </div>
          </div>
        </div>

        <div className="aqf-collection-slider-wrap">
          <div className="row row-cols-xl-5 row-cols-lg-4 row-cols-md-3 row-cols-sm-2 row-cols-2">
            {tiles.map((tile, i) => (
              <div className="col" key={i}>
                <div className="aqf-collection-item p-relative mb-30">
                  <div className="aqf-collection-thumb">
                    <LocalizedClientLink href={tile.href}>
                      <img
                        src={
                          tile.image ||
                          FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                        }
                        alt={tile.label}
                      />
                    </LocalizedClientLink>
                  </div>
                  <div className="aqf-collection-content-wrap d-flex align-items-center justify-content-between">
                    <div className="aqf-collection-content">
                      <h4 className="aqf-collection-title">
                        <LocalizedClientLink href={tile.href}>
                          {tile.label}
                        </LocalizedClientLink>
                      </h4>
                      {typeof tile.count === "number" ? (
                        <span>{tile.count} items</span>
                      ) : null}
                    </div>
                    <div className="aqf-collection-link-wrap">
                      <LocalizedClientLink
                        className="aqf-collection-link"
                        href={tile.href}
                        aria-label={tile.label}
                      >
                        <span>
                          <ArrowIcon />
                        </span>
                      </LocalizedClientLink>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CategoryShowcaseView
