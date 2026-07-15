import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet PRESENTATIONAL view for the category_showcase block. Pure,     */
/* client-safe — it takes the already-resolved `tiles` as props and      */
/* renders the Cignet "Our Best Sellers" markup. Rendered BYTE-          */
/* IDENTICALLY by both the live async server block (CategoryShowcase.tsx) */
/* and the visual-editor canvas (which fetches the same tiles from        */
/* /api/puck/category-tiles).                                            */
/* ------------------------------------------------------------------ */

interface CategoryTile {
  index: number
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

/* Template defaults — the index.html top-selling tile photos. */
const FALLBACK_IMAGES = [
  "/cignet/images/top-selling-item-image-1.jpg",
  "/cignet/images/top-selling-item-image-2.jpg",
  "/cignet/images/top-selling-item-image-3.jpg",
  "/cignet/images/top-selling-item-image-4.jpg",
  "/cignet/images/top-selling-item-image-5.jpg",
  "/cignet/images/top-selling-item-image-6.jpg",
]

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <section className="our-best-sellers">
      <div className="container">
        <div className="row section-row align-items-center">
          <div className="col-xl-6">
            {/* Section Title Start */}
            <div className="section-title">
              {sub_title ? (
                <span className="section-sub-title wow fadeInUp">
                  {sub_title}
                </span>
              ) : null}
              {title ? (
                <h2 data-el="title" className="text-anime-style-3">
                  {title}
                </h2>
              ) : null}
            </div>
            {/* Section Title End */}
          </div>

          <div className="col-xl-6">
            {/* Section Button Start */}
            <div className="section-btn wow fadeInUp">
              <LocalizedClientLink href="/store" className="btn-default">
                View All Collection
              </LocalizedClientLink>
            </div>
            {/* Section Button End */}
          </div>
        </div>

        <div className="row">
          <div className="col-xl-12">
            {/* Top Selling Item List Start */}
            <div className="top-selling-item-list">
              {tiles.map((tile, i) => (
                <div data-el="tile" data-el-item={`items:${tile.index}`} className="top-selling-item wow fadeInUp" key={i}>
                  <div className="top-selling-item-image">
                    <LocalizedClientLink href={tile.href}>
                      <figure className="image-anime">
                        <img
                          src={
                            tile.image ||
                            FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                          }
                          alt={tile.label}
                        />
                      </figure>
                    </LocalizedClientLink>
                  </div>
                  <div className="top-selling-item-content">
                    <h3>
                      <LocalizedClientLink href={tile.href}>
                        {tile.label}
                      </LocalizedClientLink>
                    </h3>
                    {typeof tile.count === "number" ? (
                      <p>{tile.count} Items</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {/* Top Selling Item List End */}
          </div>
        </div>
      </div>
    </section>
  )
}

export default CategoryShowcaseView
