import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the promo_banner_grid CMS block, restyled as the   */
/* template's collection banner strip (.banner-shortcode.style-3.wide   */
/* tiles from index1.html: background image, uppercase eyebrow,          */
/* h3.h3.light title, .title-underline.left and a pill button).          */
/* Consumes the SAME resolved block data the Learts/Cignet renderers     */
/* do — received as the spread prop bag from the storefront              */
/* SectionRenderer (`<PromoBannerGrid {...block} />`), so it also        */
/* carries block_type / schema_version / countryCode / sectionScope      */
/* which we ignore. intro / sale / instagram are OPTIONAL groups         */
/* (absent => not rendered). `categories` is always treated as an        */
/* array (may be empty). Interfaces are re-declared here so this file    */
/* is fully self-contained. Server component (no state/effects), like    */
/* the Cignet version.                                                   */
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

/* Template defaults — the index1.html collection banner backgrounds. */
const DEFAULT_TILE_IMAGES = [
  "/exzo/img/background-9.jpg",
  "/exzo/img/background-10.jpg",
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
      <a data-el="button" href={href} className={className}>
        {children}
      </a>
    )
  }
  return (
    <LocalizedClientLink
      data-el="button"
      href={href}
      className={className}
    >
      {children}
    </LocalizedClientLink>
  )
}

function BannerTile({
  eyebrow,
  title,
  image,
  href,
  linkLabel,
  wide,
  dataElItem,
}: {
  eyebrow?: string
  title: string
  image: string
  href: string
  linkLabel?: string
  wide?: boolean
  dataElItem?: string
}) {
  return (
    <div
      data-el="item"
      data-el-item={dataElItem}
      className={wide ? "col-sm-12" : "col-sm-6"}
    >
      <div
        className="banner-shortcode style-3 wide"
        style={{ backgroundImage: `url(${image})` }}
      >
        <div className="valign-middle-cell">
          <div className="valign-middle-content">
            {eyebrow ? (
              <div className="simple-article size-3 light transparent uppercase col-xs-b5">
                {eyebrow}
              </div>
            ) : null}
            <h3 className="h3 light">{title}</h3>
            <div className="title-underline left">
              <span></span>
            </div>
            {linkLabel ? (
              <TileLink href={href} className="button size-2 style-1">
                <span className="button-wrapper">
                  <span className="icon">
                    <img src="/exzo/img/icon-1.png" alt="" />
                  </span>
                  <span className="text">{linkLabel}</span>
                </span>
              </TileLink>
            ) : null}
          </div>
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
  // tiles — same order the Cignet renderer keeps.
  const indexedCategories = categories.map((cat, i) => ({ cat, i }))
  const regularCats = indexedCategories.filter(({ cat }) => !cat.wide)
  const wideCats = indexedCategories.filter(({ cat }) => cat.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <div className="exzo-promo-banner-grid">
      {intro ? (
        <div className="container">
          <div className="text-center">
            <div data-el="title" className="h2">
              {intro.title}
            </div>
            <div className="title-underline center">
              <span></span>
            </div>
            {intro.body ? (
              <div
                className="simple-article size-3"
                style={{ maxWidth: "770px", margin: "0 auto" }}
              >
                <p>{intro.body}</p>
              </div>
            ) : null}
            {intro.href && intro.link_label ? (
              <div>
                <div className="empty-space col-xs-b10"></div>
                <TileLink href={intro.href} className="button size-2 style-3">
                  <span className="button-wrapper">
                    <span className="icon">
                      <img src="/exzo/img/icon-4.png" alt="" />
                    </span>
                    <span className="text">{intro.link_label}</span>
                  </span>
                </TileLink>
              </div>
            ) : null}
          </div>
          <div className="empty-space col-xs-b35 col-md-b70"></div>
        </div>
      ) : null}

      <div className="row nopadding">
        {/* Sale highlight tile */}
        {sale ? (
          <BannerTile
            eyebrow={sale.special_title}
            title={sale.title}
            image={tileImage(sale.image, 0)}
            href={sale.href}
            linkLabel={sale.link_label || "Shop Now"}
          />
        ) : null}

        {/* Regular category tiles */}
        {regularCats.map(({ cat, i }, j) => (
          <BannerTile
            key={`reg-${i}`}
            dataElItem={`categories:${i}`}
            eyebrow={cat.count_label}
            title={cat.title}
            image={tileImage(cat.image, sale ? j + 1 : j)}
            href={cat.href}
            linkLabel="Shop Now"
          />
        ))}

        {/* Instagram tile */}
        {instagram ? (
          <BannerTile
            eyebrow={instagram.sub_title}
            title={instagram.handle}
            image={tileImage(instagram.image, 1)}
            href={instagram.href}
            linkLabel={instagram.handle}
          />
        ) : null}

        {/* Wide category tiles */}
        {wideCats.map(({ cat, i }, j) => (
          <BannerTile
            key={`wide-${i}`}
            dataElItem={`categories:${i}`}
            eyebrow={cat.count_label}
            title={cat.title}
            image={tileImage(cat.image, j)}
            href={cat.href}
            linkLabel="Shop Now"
            wide
          />
        ))}
      </div>
    </div>
  )
}

export default PromoBannerGrid
