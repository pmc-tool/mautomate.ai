import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy PRESENTATIONAL view for the category_showcase block. Pure,      */
/* client-safe (no data fetching, no server-only imports) — it takes the */
/* already-resolved `tiles` as props and renders the Shofy template's    */
/* "product category area" markup (round .tp-product-category-item       */
/* tiles). Rendered BYTE-IDENTICALLY by both the live async server block  */
/* (CategoryShowcase.tsx) and the visual-editor canvas (which fetches the */
/* same tiles from /api/puck/category-tiles), so the editor preview       */
/* matches the storefront.                                               */
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
  /** Injected by the SectionRenderer ("sec-<idx>"); unused here. */
  sectionScope?: string
}

/* Template defaults — the index.html product category tile art (verified). */
const FALLBACK_IMAGES = [
  "/shofy/img/product/category/product-cat-1.png",
  "/shofy/img/product/category/product-cat-2.png",
  "/shofy/img/product/category/product-cat-3.png",
  "/shofy/img/product/category/product-cat-4.png",
  "/shofy/img/product/category/product-cat-5.png",
]

const CategoryShowcaseView = (props: CategoryShowcaseViewProps) => {
  const { sub_title, title } = props
  const tiles = Array.isArray(props.tiles) ? props.tiles : []

  if (tiles.length === 0) {
    return null
  }

  return (
    <section className="tp-product-category pt-60 pb-15">
      <div className="container">
        {sub_title || title ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="tp-section-title-wrapper mb-40 text-center">
                {sub_title ? (
                  <span
                    style={{
                      display: "block",
                      marginBottom: 5,
                      color: "var(--tp-theme-primary)",
                    }}
                  >
                    {sub_title}
                  </span>
                ) : null}
                {title ? (
                  <h3 className="tp-section-title">
                    {title}{" "}
                    <svg
                      width="114"
                      height="35"
                      viewBox="0 0 114 35"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M112 23.275C1.84952 -10.6834 -7.36586 1.48086 7.50443 32.9053"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeMiterlimit="3.8637"
                        strokeLinecap="round"
                      />
                    </svg>
                  </h3>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row row-cols-xl-5 row-cols-lg-5 row-cols-md-4 row-cols-sm-3 row-cols-2 justify-content-center">
          {tiles.map((tile, i) => (
            <div className="col" key={i}>
              <div className="tp-product-category-item text-center mb-40">
                <div className="tp-product-category-thumb fix">
                  <LocalizedClientLink href={tile.href}>
                    <img
                      src={
                        tile.image || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                      }
                      alt={tile.label}
                    />
                  </LocalizedClientLink>
                </div>
                <div className="tp-product-category-content">
                  <h3 className="tp-product-category-title">
                    <LocalizedClientLink href={tile.href}>
                      {tile.label}
                    </LocalizedClientLink>
                  </h3>
                  {typeof tile.count === "number" ? (
                    <p>{tile.count} Product</p>
                  ) : null}
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
