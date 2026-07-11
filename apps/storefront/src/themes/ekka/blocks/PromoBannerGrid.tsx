import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the promo_banner_grid CMS block, restyled as the   */
/* template's ".ec-banner" promo section (.banner-block / .bnr-overlay  */
/* tiles with .banner-text + .ec-banner-btn). Consumes the SAME         */
/* resolved block data the Learts/Aurora/Cignet renderers do — received */
/* as the spread prop bag from the storefront SectionRenderer           */
/* (`<PromoBannerGrid {...block} />`), so it also carries block_type /  */
/* schema_version / countryCode / sectionScope which we ignore.         */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always treated as an array (may be        */
/* empty). Interfaces are re-declared here so this file is fully        */
/* self-contained. Server component (no state/effects), like the        */
/* Cignet version.                                                      */
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

/* The template's own ec-banner tile photos (index.html demo 1). */
const DEFAULT_TILE_IMAGES = [
  "/ekka/images/banner/2.jpg",
  "/ekka/images/banner/3.jpg",
]

const tileImage = (image: string | undefined, index: number) =>
  image || DEFAULT_TILE_IMAGES[index % DEFAULT_TILE_IMAGES.length]

/** Is this href off-site (or a bare hash)? Then it must not be localized. */
const isExternal = (href: string) =>
  /^https?:\/\//.test(href) || href.startsWith("#")

function TileLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }
  return (
    <LocalizedClientLink href={href} className={className}>
      {children}
    </LocalizedClientLink>
  )
}

function BannerTile({
  title,
  stitle,
  image,
  href,
  linkLabel,
  wide,
}: {
  title: string
  stitle?: string
  image: string
  href: string
  linkLabel?: string
  wide?: boolean
}) {
  return (
    <div
      className={
        wide
          ? "banner-block col-lg-12 margin-b-30"
          : "banner-block col-lg-6 col-md-12 margin-b-30"
      }
    >
      {/* Banner Tile Start */}
      <div className="bnr-overlay">
        <img src={image} alt={title} />
        <div className="banner-text">
          {stitle ? <span className="ec-banner-stitle">{stitle}</span> : null}
          <span className="ec-banner-title">{title}</span>
        </div>
        {linkLabel ? (
          <div className="banner-content">
            <span className="ec-banner-btn">
              <TileLink href={href}>{linkLabel}</TileLink>
            </span>
          </div>
        ) : null}
      </div>
      {/* Banner Tile End */}
    </div>
  )
}

const PromoBannerGrid = (props: PromoBannerGridData) => {
  const { intro, sale, instagram } = props
  const categories = Array.isArray(props.categories) ? props.categories : []

  // Preserve the shared content order: intro (section header), sale, the
  // regular (non-wide) category tiles, the instagram banner, then the wide
  // tiles — same order the Cignet/Aurora renderers use.
  const regularCats = categories.filter((c) => !c.wide)
  const wideCats = categories.filter((c) => c.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <section className="ec-banner section section-space-p">
      <h2 className="d-none">Banner</h2>
      <div className="container">
        {intro ? (
          <div className="row">
            <div className="col-md-12 text-center">
              {/* Section Title Start */}
              <div className="section-title">
                <h2 className="ec-bg-title">{intro.title}</h2>
                <h2 className="ec-title">{intro.title}</h2>
                {intro.body ? <p className="sub-title">{intro.body}</p> : null}
                {intro.href && intro.link_label ? (
                  <div style={{ marginTop: 20 }}>
                    <TileLink href={intro.href} className="btn btn-primary">
                      {intro.link_label}
                    </TileLink>
                  </div>
                ) : null}
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}

        {/* ec Banners Start */}
        <div className="ec-banner-inner">
          <div className="ec-banner-block ec-banner-block-2">
            <div className="row">
              {/* Sale highlight tile */}
              {sale ? (
                <BannerTile
                  title={sale.title}
                  stitle={sale.special_title}
                  image={tileImage(sale.image, 0)}
                  href={sale.href}
                  linkLabel={sale.link_label || "Order Now"}
                />
              ) : null}

              {/* Regular category tiles */}
              {regularCats.map((cat, i) => (
                <BannerTile
                  key={`reg-${i}`}
                  title={cat.title}
                  stitle={cat.count_label}
                  image={tileImage(cat.image, sale ? i + 1 : i)}
                  href={cat.href}
                  linkLabel="Order Now"
                />
              ))}

              {/* Instagram tile */}
              {instagram ? (
                <BannerTile
                  title={instagram.handle}
                  stitle={instagram.sub_title}
                  image={tileImage(instagram.image, 1)}
                  href={instagram.href}
                  linkLabel={instagram.handle}
                />
              ) : null}

              {/* Wide category tiles */}
              {wideCats.map((cat, i) => (
                <BannerTile
                  key={`wide-${i}`}
                  title={cat.title}
                  stitle={cat.count_label}
                  image={tileImage(cat.image, i)}
                  href={cat.href}
                  linkLabel="Order Now"
                  wide
                />
              ))}
            </div>
          </div>
        </div>
        {/* ec Banners End */}
      </div>
    </section>
  )
}

export default PromoBannerGrid
