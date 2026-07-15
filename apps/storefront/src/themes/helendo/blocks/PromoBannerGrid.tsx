import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the promo_banner_grid CMS block: the template's */
/* `.banner-images-one` promo banners (index-4.html "Banner Area" —     */
/* thumbnail image + absolute .banner-title overlay with an h3 title,   */
/* an h6 kicker and a text-btn-normal link with the arrow glyph).       */
/* Consumes the SAME resolved block data the Cignet renderer does —     */
/* received as the spread prop bag from the storefront SectionRenderer  */
/* (`<PromoBannerGrid {...block} />`), so it also carries block_type /  */
/* schema_version / countryCode / sectionScope which we ignore.         */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always treated as an array (may be        */
/* empty). Interfaces are re-declared here so this file is fully        */
/* self-contained. Server component (no state/effects), like Cignet.    */
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

const DEFAULT_TILE_IMAGES = [
  "/helendo/images/banners/hl-sb-1.jpg",
  "/helendo/images/banners/hl-sb-2.jpg",
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
  kicker,
  image,
  href,
  linkLabel,
  wide,
  "data-el-item": dataElItem,
}: {
  title: string
  kicker?: string
  image: string
  href: string
  linkLabel?: string
  wide?: boolean
  "data-el-item"?: string
}) {
  return (
    <div
      data-el="item"
      data-el-item={dataElItem}
      className={wide ? "col-lg-12" : "col-lg-6"}
    >
      <div className="banner-images-one mt-30" style={{ position: "relative" }}>
        <TileLink href={href} className="thumbnail">
          <img src={image} className="img-fluid w-100" alt={title} />
        </TileLink>
        <div className="banner-title">
          <h3>
            <TileLink href={href}>{title}</TileLink>
          </h3>
          {kicker ? <h6>{kicker}</h6> : null}
          {linkLabel ? (
            <div data-el="button" className="button-box section-space--mt_60">
              <TileLink href={href} className="text-btn-normal">
                {linkLabel} <i className="icon-arrow-right" />
              </TileLink>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const PromoBannerGrid = (props: PromoBannerGridData) => {
  const { intro, sale, instagram } = props
  const categories = Array.isArray(props.categories) ? props.categories : []

  // Preserve the shared content order: intro (section header), sale, the
  // regular (non-wide) category tiles, the instagram banner, then the wide
  // tiles — same order the Cignet renderer uses.
  const indexedCats = categories.map((cat, i) => ({ cat, i }))
  const regularCats = indexedCats.filter(({ cat }) => !cat.wide)
  const wideCats = indexedCats.filter(({ cat }) => cat.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <div className="banner-area section-space--pt_90">
      <div className="container">
        {intro ? (
          <div className="row">
            <div className="col-lg-12">
              <div className="section-title text-center mb-20">
                <h2
                  data-el="title"
                  className="section-title--one section-title--center"
                >
                  {intro.title}
                </h2>
                {intro.body ? <p className="mt-30">{intro.body}</p> : null}
                {intro.href && intro.link_label ? (
                  <div data-el="button" className="button-box mt-30">
                    <TileLink href={intro.href} className="text-btn-normal">
                      {intro.link_label} <i className="icon-arrow-right" />
                    </TileLink>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          {/* Sale highlight tile */}
          {sale ? (
            <BannerTile
              title={sale.title}
              kicker={sale.special_title}
              image={tileImage(sale.image, 0)}
              href={sale.href}
              linkLabel={sale.link_label || "Shop now"}
            />
          ) : null}

          {/* Regular category tiles */}
          {regularCats.map(({ cat, i }, pos) => (
            <BannerTile
              key={`reg-${i}`}
              data-el-item={`categories:${i}`}
              title={cat.title}
              kicker={cat.count_label}
              image={tileImage(cat.image, sale ? pos + 1 : pos)}
              href={cat.href}
              linkLabel="Shop now"
            />
          ))}

          {/* Instagram tile */}
          {instagram ? (
            <BannerTile
              title={instagram.handle}
              kicker={instagram.sub_title}
              image={tileImage(instagram.image, 1)}
              href={instagram.href}
              linkLabel={instagram.handle}
            />
          ) : null}

          {/* Wide category tiles */}
          {wideCats.map(({ cat, i }, pos) => (
            <BannerTile
              key={`wide-${i}`}
              data-el-item={`categories:${i}`}
              title={cat.title}
              kicker={cat.count_label}
              image={tileImage(cat.image, pos)}
              href={cat.href}
              linkLabel="Shop now"
              wide
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PromoBannerGrid
