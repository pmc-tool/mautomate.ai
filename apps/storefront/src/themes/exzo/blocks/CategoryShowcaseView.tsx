import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo PRESENTATIONAL view for the category_showcase block. Pure,       */
/* client-safe — it takes the already-resolved `tiles` as props and      */
/* renders the Exzo tall category banner tiles (.banner-shortcode        */
/* .style-2). Rendered BYTE-IDENTICALLY by both the live async server    */
/* block (CategoryShowcase.tsx) and the visual-editor canvas (which       */
/* fetches the same tiles from /api/puck/category-tiles).                */
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

/* Template defaults — Exzo banner/thumbnail photos (cycled by index). */
const FALLBACK_IMAGES = [
  "/exzo/img/thumbnail-11.jpg",
  "/exzo/img/background-9.jpg",
  "/exzo/img/background-10.jpg",
  "/exzo/img/background-11.jpg",
]

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <section className="exzo-category-showcase">
      <div className="container">
        <div className="text-center">
          {sub_title ? (
            <div className="simple-article size-3 grey uppercase col-xs-b5">
              {sub_title}
            </div>
          ) : null}
          {title ? <div className="h2">{title}</div> : null}
          <div className="title-underline center">
            <span></span>
          </div>
        </div>

        <div className="empty-space col-xs-b35 col-md-b70"></div>

        <div className="row">
          {tiles.map((tile, i) => (
            <div className="col-md-3 col-sm-4 col-xs-6" key={i}>
              <div
                className="banner-shortcode style-2 rounded-image"
                style={{ margin: "0 auto 30px" }}
              >
                <div className="content">
                  <div
                    className="background"
                    style={{
                      backgroundImage: `url(${
                        tile.image ||
                        FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                      })`,
                    }}
                  ></div>
                  {/* Top scrim: keeps the light title legible on light images */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: "100%",
                      height: "100%",
                      background:
                        "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 55%)",
                    }}
                  ></div>
                  <div className="description valign-middle">
                    <div className="valign-middle-content">
                      {typeof tile.count === "number" ? (
                        <div className="simple-article size-1 color">
                          {tile.count} items
                        </div>
                      ) : null}
                      <div className="h4 light">
                        <LocalizedClientLink href={tile.href}>
                          {tile.label}
                        </LocalizedClientLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CategoryShowcaseView
