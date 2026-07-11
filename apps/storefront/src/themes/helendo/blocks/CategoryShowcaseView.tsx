import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo PRESENTATIONAL view for the category_showcase block. Pure,    */
/* client-safe — it takes the already-resolved `tiles` as props and      */
/* renders the Helendo `.banner-images-one` category banner tiles.       */
/* Rendered BYTE-IDENTICALLY by both the live async server block         */
/* (CategoryShowcase.tsx) and the visual-editor canvas (which fetches    */
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

/* Template defaults — banner photos shipped under /helendo/images/banners. */
const FALLBACK_IMAGES = [
  "/helendo/images/banners/hl-sb-1.jpg",
  "/helendo/images/banners/hl-sb-2.jpg",
  "/helendo/images/banners/h-g-1.jpg",
  "/helendo/images/banners/h-g-3.jpg",
  "/helendo/images/banners/h-g-4.jpg",
  "/helendo/images/banners/h-g-5.jpg",
]

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <div className="banner-area section-space--pt_90">
      <div className="container">
        {sub_title || title ? (
          <div className="row">
            <div className="col-lg-12">
              <div className="section-title text-center mb-20">
                {sub_title ? (
                  <h6 className="sub-heading mb-2">{sub_title}</h6>
                ) : null}
                {title ? (
                  <h2 className="section-title--one section-title--center">
                    {title}
                  </h2>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          {tiles.map((tile, i) => (
            <div className="col-lg-6 col-md-6" key={i}>
              <div
                className="banner-images-one mt-30"
                style={{ position: "relative" }}
              >
                <LocalizedClientLink href={tile.href} className="thumbnail">
                  <img
                    src={
                      tile.image || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                    }
                    className="img-fluid"
                    alt={tile.label}
                  />
                </LocalizedClientLink>
                <div className="banner-title">
                  <h3>
                    <LocalizedClientLink href={tile.href}>
                      {tile.label}
                    </LocalizedClientLink>
                  </h3>
                  {typeof tile.count === "number" ? (
                    <h6>{tile.count} Items</h6>
                  ) : null}
                  <div className="button-box section-space--mt_60">
                    <LocalizedClientLink
                      href={tile.href}
                      className="text-btn-normal"
                    >
                      Shop now <i className="icon-arrow-right" />
                    </LocalizedClientLink>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CategoryShowcaseView
