import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the promo_banner_grid CMS block, restyled as a   */
/* grid of the template's deals banner cards (`aqf-deals-banner-wrap`,  */
/* index.html 4407-4419: image + overlaid title + blur-bg CTA button).  */
/* Consumes the SAME resolved block data the Cignet renderer does —     */
/* received as the spread prop bag from the storefront SectionRenderer  */
/* (`<PromoBannerGrid {...block} />`), so it also carries block_type /  */
/* schema_version / countryCode / sectionScope which we ignore.         */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always treated as an array (may be        */
/* empty). Interfaces are re-declared here so this file is fully        */
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

const DEFAULT_TILE_IMAGES = [
  "/bazaro/img/fashion-1/banner/banner-1.jpg",
  "/bazaro/img/fashion-1/collection/collection-1.jpg",
  "/bazaro/img/fashion-1/collection/collection-2.jpg",
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

function BannerCard({
  title,
  body,
  image,
  href,
  linkLabel,
  wide,
}: {
  title: string
  body?: string
  image: string
  href: string
  linkLabel?: string
  wide?: boolean
}) {
  return (
    <div className={wide ? "col-lg-12" : "col-lg-6"}>
      <div className="aqf-deals-banner-wrap p-relative mb-30">
        <div className="aqf-deals-banner-thumb">
          <TileLink href={href}>
            <img className="w-100" src={image} alt={title} />
          </TileLink>
        </div>
        <div className="aqf-deals-banner-content">
          <h4 className="aq-section-title fs-44 aq-text-white mb-20">
            {title}
          </h4>
          {body ? <span>{body}</span> : null}
        </div>
        {linkLabel ? (
          <div className="aqf-deals-banner-btn">
            <TileLink
              href={href}
              className="aq-btn-black blur-bg w-100 text-center"
            >
              {linkLabel}
            </TileLink>
          </div>
        ) : null}
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
  const regularCats = categories.filter((c) => !c.wide)
  const wideCats = categories.filter((c) => c.wide)

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <div className="bazaro-promo-banner-grid pt-60 pb-30">
      <div className="container">
        {intro ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="aqf-collection-title-box text-center mb-40">
                <span className="aq-section-subtitle ff-satoshi-med mb-10">
                  {intro.title}
                </span>
                {intro.body ? (
                  <h4 className="aq-section-title ff-satoshi-med fs-38 mb-15">
                    {intro.body}
                  </h4>
                ) : null}
                {intro.href && intro.link_label ? (
                  <TileLink
                    href={intro.href}
                    className="aq-btn-text aq-btn-underline"
                  >
                    {intro.link_label}
                  </TileLink>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          {/* Sale highlight banner */}
          {sale ? (
            <BannerCard
              title={sale.title}
              body={sale.special_title}
              image={tileImage(sale.image, 0)}
              href={sale.href}
              linkLabel={sale.link_label || "Shop Now"}
            />
          ) : null}

          {/* Regular category banners */}
          {regularCats.map((cat, i) => (
            <BannerCard
              key={`reg-${i}`}
              title={cat.title}
              body={cat.count_label}
              image={tileImage(cat.image, sale ? i + 1 : i)}
              href={cat.href}
              linkLabel="Shop Now"
            />
          ))}

          {/* Instagram banner */}
          {instagram ? (
            <BannerCard
              title={instagram.handle}
              body={instagram.sub_title}
              image={tileImage(instagram.image, 1)}
              href={instagram.href}
              linkLabel={instagram.handle}
            />
          ) : null}

          {/* Wide category banners */}
          {wideCats.map((cat, i) => (
            <BannerCard
              key={`wide-${i}`}
              title={cat.title}
              body={cat.count_label}
              image={tileImage(cat.image, i)}
              href={cat.href}
              linkLabel="Shop Now"
              wide
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default PromoBannerGrid
