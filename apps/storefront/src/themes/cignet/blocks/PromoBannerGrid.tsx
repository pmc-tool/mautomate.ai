import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the promo_banner_grid CMS block, restyled as     */
/* the template's "Our Collection" banner grid (.collection-item-*).    */
/* Consumes the SAME resolved block data the Learts/Aurora renderers    */
/* do — received as the spread prop bag from the storefront             */
/* SectionRenderer (`<PromoBannerGrid {...block} />`), so it also       */
/* carries block_type / schema_version / countryCode / sectionScope     */
/* which we ignore. intro / sale / instagram are OPTIONAL groups        */
/* (absent => not rendered). `categories` is always treated as an       */
/* array (may be empty). Interfaces are re-declared here so this file   */
/* is fully self-contained. Server component (no state/effects), like   */
/* Aurora's version.                                                    */
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
  "/cignet/images/collection-item-image-1.jpg",
  "/cignet/images/collection-item-image-2.jpg",
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
  dataEl,
}: {
  href: string
  className?: string
  children: ReactNode
  dataEl?: string
}) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} data-el={dataEl}>
        {children}
      </a>
    )
  }
  return (
    <LocalizedClientLink href={href} className={className} data-el={dataEl}>
      {children}
    </LocalizedClientLink>
  )
}

function CollectionItem({
  title,
  body,
  image,
  href,
  linkLabel,
  wide,
  itemIndex,
}: {
  title: string
  body?: string
  image: string
  href: string
  linkLabel?: string
  wide?: boolean
  itemIndex?: number
}) {
  return (
    <div
      data-el="item"
      data-el-item={
        typeof itemIndex === "number" ? `categories:${itemIndex}` : undefined
      }
      className={wide ? "col-lg-12" : "col-lg-6"}
    >
      {/* Collection Item Start */}
      <div className="collection-item wow fadeInUp">
        {/* Collection Item Content Start */}
        <div className="collection-item-content">
          <div className="collection-item-title">
            <h3>{title}</h3>
          </div>
          {linkLabel ? (
            <div className="collection-item-button">
              <TileLink href={href} className="btn-default" dataEl="button">
                {linkLabel}
              </TileLink>
            </div>
          ) : null}
        </div>
        {/* Collection Item Content End */}

        {/* Collection Item Image Box Start */}
        <div className="collection-item-image-box">
          {body ? (
            <div className="collection-item-image-content">
              <p>{body}</p>
            </div>
          ) : null}
          <div className="collection-item-image">
            <TileLink href={href}>
              <figure className="image-anime">
                <img src={image} alt={title} />
              </figure>
            </TileLink>
          </div>
        </div>
        {/* Collection Item Image Box End */}
      </div>
      {/* Collection Item End */}
    </div>
  )
}

const PromoBannerGrid = (props: PromoBannerGridData) => {
  const { intro, sale, instagram } = props
  const categories = Array.isArray(props.categories) ? props.categories : []

  // Preserve the shared content order: intro (section header), sale, the
  // regular (non-wide) category tiles, the instagram banner, then the wide
  // tiles — same order Aurora renders.
  const indexedCats = categories.map((cat, i) => ({ cat, i }))
  const regularCats = indexedCats.filter(({ cat }) => !cat.wide)
  const wideCats = indexedCats.filter(({ cat }) => cat.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <div className="our-collection">
      <div className="container">
        {intro ? (
          <div className="row section-row">
            <div className="col-xl-12">
              {/* Section Title Start */}
              <div className="section-title section-title-center">
                <span className="section-sub-title wow fadeInUp">
                  Our collection
                </span>
                <h2 data-el="title" className="text-anime-style-3">{intro.title}</h2>
                {intro.body ? (
                  <p className="wow fadeInUp">{intro.body}</p>
                ) : null}
                {intro.href && intro.link_label ? (
                  <div style={{ marginTop: 30 }}>
                    <TileLink href={intro.href} className="btn-default" dataEl="button">
                      {intro.link_label}
                    </TileLink>
                  </div>
                ) : null}
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}

        <div className="row">
          {/* Sale highlight tile */}
          {sale ? (
            <CollectionItem
              title={sale.title}
              body={sale.special_title}
              image={tileImage(sale.image, 0)}
              href={sale.href}
              linkLabel={sale.link_label || "Shop Now"}
            />
          ) : null}

          {/* Regular category tiles */}
          {regularCats.map(({ cat, i }, pos) => (
            <CollectionItem
              key={`reg-${i}`}
              title={cat.title}
              body={cat.count_label}
              image={tileImage(cat.image, sale ? pos + 1 : pos)}
              href={cat.href}
              linkLabel="Shop Now"
              itemIndex={i}
            />
          ))}

          {/* Instagram tile */}
          {instagram ? (
            <CollectionItem
              title={instagram.handle}
              body={instagram.sub_title}
              image={tileImage(instagram.image, 1)}
              href={instagram.href}
              linkLabel={instagram.handle}
            />
          ) : null}

          {/* Wide category tiles */}
          {wideCats.map(({ cat, i }, pos) => (
            <CollectionItem
              key={`wide-${i}`}
              title={cat.title}
              body={cat.count_label}
              image={tileImage(cat.image, pos)}
              href={cat.href}
              linkLabel="Shop Now"
              wide
              itemIndex={i}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PromoBannerGrid
