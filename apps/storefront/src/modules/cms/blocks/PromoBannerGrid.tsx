import type { CSSProperties } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend promo_banner_grid resolved     */
/* schema). Received as the spread prop bag from the storefront         */
/* SectionRenderer (`<PromoBannerGrid {...block} />`), so it also        */
/* carries block_type / schema_version which we simply ignore.          */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always an array (may be empty).           */
/* All image fields hold fully-resolved media URLs (absolute backend    */
/* urls or /learts paths both work in <img>).                           */
/* ------------------------------------------------------------------ */

export interface PromoIntro {
  title: string
  body: string
  link_label: string
  href: string
}

export interface PromoSale {
  image: string
  special_title: string
  title: string
  link_label: string
  href: string
}

export interface PromoCategoryTile {
  image: string
  title: string
  count_label: string
  href: string
  wide?: boolean
  /** Fixed tile image height in px. 0 / undefined = natural aspect ratio. */
  height?: number
  /** object-fit for the image when a height is set. Defaults to "cover". */
  fit?: "cover" | "contain"
}

export interface PromoInstagram {
  image: string
  sub_title: string
  handle: string
  href: string
}

export interface PromoBannerGridData {
  intro?: PromoIntro
  sale?: PromoSale
  categories?: PromoCategoryTile[]
  instagram?: PromoInstagram
  [key: string]: unknown
}

function CategoryTile({ cat }: { cat: PromoCategoryTile }) {
  const colClass = cat.wide
    ? "col-xxl-6 col-xl-8 col-12 learts-mb-30"
    : "col-xxl-3 col-xl-4 col-md-6 col-12 learts-mb-30"

  // Keep the collage uniform: default to the original Learts tile proportions
  // (square regular tiles, ~2:1 wide tile — from the 407x407 / 845x407 art) so
  // any uploaded image fills a consistent box instead of blowing the tile up to
  // its own natural aspect ratio. A per-tile `height` overrides this; `fit`
  // chooses crop (cover) vs. show-whole-image (contain).
  const fixedHeight =
    typeof cat.height === "number" && cat.height > 0 ? cat.height : null
  const imageStyle: CSSProperties = fixedHeight
    ? { height: `${fixedHeight}px` }
    : { aspectRatio: cat.wide ? "845 / 407" : "1 / 1" }
  const imgStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: cat.fit ?? "cover",
    objectPosition: "center",
  }

  return (
    <div className={colClass}>
      <div className="category-banner3" data-el="item">
        <LocalizedClientLink href={cat.href} className="inner">
          <div className="image" style={imageStyle}>
            <img src={cat.image} alt={cat.title} style={imgStyle} />
          </div>
          <div className="content">
            <h3 className="title">
              {cat.title}
              {cat.count_label ? (
                <span className="number">{cat.count_label}</span>
              ) : null}
            </h3>
          </div>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

const PromoBannerGrid = (props: PromoBannerGridData) => {
  const { intro, sale, instagram } = props
  const categories = Array.isArray(props.categories) ? props.categories : []

  // Preserve the original Learts DOM order: intro, sale, the regular
  // (non-wide) category tiles, the instagram banner, then the wide tiles.
  const regularCats = categories.filter((c) => !c.wide)
  const wideCats = categories.filter((c) => c.wide)

  return (
    <div className="section section-fluid learts-pt-30 bg-white learts-theme">
      <div className="container">
        <div className="row learts-mb-n30">
          {/* Intro blockquote */}
          {intro ? (
            <div className="col-xxl-6 col-xl-8 col-12 learts-mb-30">
              <div className="learts-blockquote">
                <div className="inner">
                  <h2 className="title" data-el="title">
                    {intro.title}
                  </h2>
                  {intro.body ? (
                    <div className="desc">
                      <p>{intro.body}</p>
                    </div>
                  ) : null}
                  {intro.href ? (
                    <LocalizedClientLink
                      href={intro.href}
                      className="link"
                      data-el="button"
                    >
                      {intro.link_label}
                    </LocalizedClientLink>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Spring sale banner */}
          {sale ? (
            <div className="col-xxl-3 col-xl-4 col-md-6 col-12 learts-mb-30">
              <div className="sale-banner3-1">
                <div className="image">
                  <img src={sale.image} alt={sale.title} />
                </div>
                <div className="content">
                  {sale.special_title ? (
                    <span className="special-title">{sale.special_title}</span>
                  ) : null}
                  <h2 className="title">{sale.title}</h2>
                  {sale.href ? (
                    <LocalizedClientLink href={sale.href} className="link">
                      {sale.link_label}
                    </LocalizedClientLink>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Regular category tiles */}
          {regularCats.map((cat, i) => (
            <CategoryTile key={`reg-${i}`} cat={cat} />
          ))}

          {/* Instagram */}
          {instagram ? (
            <div className="col-xxl-3 col-xl-4 col-md-6 col-12 order-xxl-6 learts-mb-30">
              <div className="instagram-banner1">
                <div className="inner">
                  <div className="image">
                    <img src={instagram.image} alt={instagram.handle} />
                  </div>
                  <div className="content">
                    <div className="icon">
                      <i className="fab fa-instagram" />
                    </div>
                    {instagram.sub_title ? (
                      <span className="sub-title">{instagram.sub_title}</span>
                    ) : null}
                    <h3 className="title">
                      <a href={instagram.href || "#"}>{instagram.handle}</a>
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Wide category tiles (e.g. Toys) */}
          {wideCats.map((cat, i) => (
            <CategoryTile key={`wide-${i}`} cat={cat} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PromoBannerGrid
