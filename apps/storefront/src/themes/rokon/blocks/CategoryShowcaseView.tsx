import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon PRESENTATIONAL view for the category_showcase block. Pure,      */
/* client-safe — it takes the already-resolved `tiles` as props and      */
/* renders the Rokon "Our Best Projects" grid (project__card). Rendered  */
/* BYTE-IDENTICALLY by both the live async server block                  */
/* (CategoryShowcase.tsx) and the visual-editor canvas (which fetches    */
/* the same tiles from /api/puck/category-tiles).                        */
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

/* Template defaults — the index.html project grid photos. */
const FALLBACK_IMAGES = [
  "/rokon/img/product/product1.webp",
  "/rokon/img/product/product2.webp",
  "/rokon/img/product/product3.webp",
  "/rokon/img/product/product4.webp",
  "/rokon/img/product/product5.webp",
  "/rokon/img/product/product6.webp",
]

/* The template's project card arrow (index.html project__card--btn). */
const ArrowIcon = () => (
  <span className="project__card--btn">
    <svg
      className="project__card--btn__svg"
      xmlns="http://www.w3.org/2000/svg"
      width="15.51"
      height="15.443"
      viewBox="0 0 512 512"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="48"
        d="M268 112l144 144-144 144M392 256H100"
      ></path>
    </svg>
  </span>
)

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <section className="project__section project__section--bg section--padding">
      <div className="container">
        <div className="section__heading text-center mb-50">
          {title ? (
            <h2
              data-el="title"
              className="section__heading--maintitle text__secondary mb-10"
            >
              {title}
            </h2>
          ) : null}
          {sub_title ? (
            <p className="section__heading--desc">{sub_title}</p>
          ) : null}
        </div>
        <div className="project__section--inner">
          <div className="row row-cols-md-3 row-cols-2 mb--n30">
            {tiles.map((tile, i) => (
              <div data-el="tile" data-el-item={`items:${tile.index}`} className="col custom-col-2 mb-30" key={i}>
                <article className="project__card">
                  <LocalizedClientLink
                    className="project__card--link"
                    href={tile.href}
                  >
                    <div className="project__card--thumbnail">
                      <img
                        className="project__card--thumbnail__img display-block"
                        src={
                          tile.image ||
                          FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                        }
                        alt={tile.label}
                      />
                    </div>
                    <div className="project__card--content d-flex justify-content-between align-items-center">
                      <div className="project__card--content__left">
                        <h3 className="project__card--content__title">
                          {tile.label}
                        </h3>
                        {typeof tile.count === "number" ? (
                          <span className="project__card--content__subtitle">
                            {tile.count} Items
                          </span>
                        ) : null}
                      </div>
                      <ArrowIcon />
                    </div>
                  </LocalizedClientLink>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default CategoryShowcaseView
