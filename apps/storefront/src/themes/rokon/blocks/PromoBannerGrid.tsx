import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the promo_banner_grid CMS block. The template's   */
/* "Banner CSS" family (.banner__section--bg photo band with its dark   */
/* ::before overlay + banner__video--content typography) is adapted     */
/* into a responsive banner grid. Consumes the SAME resolved block      */
/* data the Cignet/Learts renderers do — received as the spread prop    */
/* bag from the storefront SectionRenderer                              */
/* (`<PromoBannerGrid {...block} />`), so it also carries block_type /  */
/* schema_version / countryCode / sectionScope which we ignore.         */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always treated as an array (may be        */
/* empty). Interfaces are re-declared here (mirroring the backend       */
/* promo_banner_grid registry contract) so this file is fully           */
/* self-contained. Server component (no state/effects).                 */
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

/* Template banner backgrounds, cycled when a tile has no image. */
const DEFAULT_TILE_IMAGES = [
  "/rokon/img/banner/banner-bg1.webp",
  "/rokon/img/banner/banner-bg2.webp",
  "/rokon/img/banner/banner-bg3.webp",
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
  "data-el": dataEl,
}: {
  href: string
  className?: string
  children: ReactNode
  "data-el"?: string
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

/** One photo banner tile: the template's banner band scaled to a grid cell. */
function BannerTile({
  title,
  subtitle,
  image,
  href,
  linkLabel,
  wide,
  "data-el-item": dataElItem,
}: {
  title: string
  subtitle?: string
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
      className={wide ? "col-12" : "col-lg-6 col-md-6"}
    >
      <div
        className="banner__section--bg position__relative"
        style={{
          backgroundImage: `url(${image})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          backgroundSize: "cover",
          minHeight: wide ? "260px" : "320px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="banner__video--content position__relative text-center"
          style={{ padding: "50px 20px", zIndex: 1 }}
        >
          {subtitle ? (
            <p className="banner__video--info text-white">{subtitle}</p>
          ) : null}
          <h2 className="banner__video--title text-white mb-15">{title}</h2>
          {linkLabel ? (
            <TileLink
              data-el="button"
              href={href}
              className="banner__video--btn primary__btn"
            >
              {linkLabel}
            </TileLink>
          ) : (
            /* Fallback link when the tile has no button label. */
            <TileLink href={href} className="display-block">
              <span className="visually-hidden">{title}</span>
            </TileLink>
          )}
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
  // tiles — same order the Cignet/Learts renderers use.
  const indexedCats = categories.map((cat, i) => ({ cat, i }))
  const regularCats = indexedCats.filter(({ cat }) => !cat.wide)
  const wideCats = indexedCats.filter(({ cat }) => cat.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <section className="rokon-banner-grid section--padding">
      <div className="container">
        {intro ? (
          <div className="section__heading text-center mb-50">
            <h2
              data-el="title"
              className="section__heading--maintitle text__secondary mb-10"
            >
              {intro.title}
            </h2>
            {intro.body ? (
              <p className="section__heading--desc">{intro.body}</p>
            ) : null}
            {intro.href && intro.link_label ? (
              <div style={{ marginTop: "25px" }}>
                <TileLink
                  data-el="button"
                  href={intro.href}
                  className="primary__btn"
                >
                  {intro.link_label}
                </TileLink>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="row" style={{ rowGap: "25px" }}>
          {/* Sale highlight tile */}
          {sale ? (
            <BannerTile
              title={sale.title}
              subtitle={sale.special_title}
              image={tileImage(sale.image, 0)}
              href={sale.href}
              linkLabel={sale.link_label || "Shop Now"}
            />
          ) : null}

          {/* Regular category tiles */}
          {regularCats.map(({ cat, i }, pos) => (
            <BannerTile
              key={`reg-${i}`}
              data-el-item={`categories:${i}`}
              title={cat.title}
              subtitle={cat.count_label}
              image={tileImage(cat.image, sale ? pos + 1 : pos)}
              href={cat.href}
              linkLabel="Shop Now"
            />
          ))}

          {/* Instagram tile */}
          {instagram ? (
            <BannerTile
              title={instagram.handle}
              subtitle={instagram.sub_title}
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
              subtitle={cat.count_label}
              image={tileImage(cat.image, pos)}
              href={cat.href}
              linkLabel="Shop Now"
              wide
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PromoBannerGrid
