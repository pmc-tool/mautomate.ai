import type { ReactNode } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the promo_banner_grid CMS block, restyled as the  */
/* template's "banner area" (.tp-banner-item background-image tiles:    */
/* one wide col-xl-8 banner + col-xl-4 side banners). Consumes the SAME */
/* resolved block data the Learts/Cignet renderers do — received as the */
/* spread prop bag from the storefront SectionRenderer                  */
/* (`<PromoBannerGrid {...block} />`), so it also carries block_type /  */
/* schema_version / countryCode / sectionScope which we ignore.         */
/* intro / sale / instagram are OPTIONAL groups (absent => not          */
/* rendered). `categories` is always treated as an array (may be        */
/* empty). Interfaces are re-declared here so this file is fully        */
/* self-contained. Server component (no state/effects). The template's  */
/* data-background lazy JS is replaced with a plain inline              */
/* backgroundImage style.                                               */
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

/* Template defaults — the index.html banner area photos (verified). */
const DEFAULT_WIDE_IMAGE = "/shofy/img/product/banner/product-banner-1.jpg"
const DEFAULT_SM_IMAGE = "/shofy/img/product/banner/product-banner-2.jpg"

const tileImage = (image: string | undefined, wide: boolean) =>
  image || (wide ? DEFAULT_WIDE_IMAGE : DEFAULT_SM_IMAGE)

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

const LinkArrow = () => (
  <svg
    width="15"
    height="13"
    viewBox="0 0 15 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.9998 6.19656L1 6.19656"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.75674 0.975394L14 6.19613L8.75674 11.4177"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function BannerItem({
  eyebrow,
  title,
  note,
  image,
  href,
  linkLabel,
  wide,
}: {
  eyebrow?: string
  title: string
  note?: string
  image: string
  href: string
  linkLabel?: string
  wide?: boolean
}) {
  return (
    <div className={wide ? "col-xl-8 col-lg-7" : "col-xl-4 col-lg-5"}>
      <div
        className={`tp-banner-item ${
          wide ? "" : "tp-banner-item-sm "
        }tp-banner-height p-relative mb-30 z-index-1 fix`}
      >
        <div
          className="tp-banner-thumb include-bg transition-3"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="tp-banner-content">
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h3 className="tp-banner-title">
            <TileLink href={href}>{title}</TileLink>
          </h3>
          {note ? <p>{note}</p> : null}
          <div className="tp-banner-btn">
            <TileLink href={href} className="tp-link-btn">
              {linkLabel || "Shop Now"} <LinkArrow />
            </TileLink>
          </div>
        </div>
      </div>
    </div>
  )
}

const PromoBannerGrid = (props: PromoBannerGridData) => {
  const { intro, sale, instagram } = props
  const categories = Array.isArray(props.categories) ? props.categories : []

  // Nothing to render -> render null (mirror the original empty guards).
  if (!intro && !sale && !instagram && categories.length === 0) {
    return null
  }

  return (
    <section className="tp-banner-area pb-70 pt-30">
      <div className="container">
        {intro ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="tp-section-title-wrapper mb-40">
                <h3 className="tp-section-title">
                  {intro.title}{" "}
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
                {intro.body ? (
                  <p style={{ maxWidth: 720, marginTop: 15 }}>{intro.body}</p>
                ) : null}
                {intro.href && intro.link_label ? (
                  <div style={{ marginTop: 10 }}>
                    <TileLink href={intro.href} className="tp-link-btn">
                      {intro.link_label} <LinkArrow />
                    </TileLink>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="row">
          {/* Sale highlight banner — the template's wide col-xl-8 tile */}
          {sale ? (
            <BannerItem
              eyebrow={sale.special_title}
              title={sale.title}
              image={tileImage(sale.image, true)}
              href={sale.href}
              linkLabel={sale.link_label || "Shop Now"}
              wide
            />
          ) : null}

          {/* Category tiles — wide flag maps to the col-xl-8 banner size */}
          {categories.map((cat, i) => (
            <BannerItem
              key={`cat-${i}`}
              title={cat.title}
              note={cat.count_label}
              image={tileImage(cat.image, !!cat.wide)}
              href={cat.href}
              linkLabel="Shop Now"
              wide={!!cat.wide}
            />
          ))}

          {/* Instagram tile */}
          {instagram ? (
            <BannerItem
              eyebrow={instagram.sub_title}
              title={instagram.handle}
              image={tileImage(instagram.image, false)}
              href={instagram.href}
              linkLabel={instagram.handle}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default PromoBannerGrid
