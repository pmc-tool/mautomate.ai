import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the image_with_text CMS block, restyled as the    */
/* template's "product banner area" (.tp-product-banner-inner blue      */
/* band: subtitle / title / CTA on one side, product shot with a        */
/* gradient shape on the other, plus the oversized decorative           */
/* .tp-product-banner-bg-text word). Consumes the SAME resolved         */
/* block-data prop bag as the Learts/Cignet versions                    */
/* (`<ImageWithText {...block} />`), so it also carries block_type /    */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `image` holds a fully-resolved media URL. `cta` is OPTIONAL (absent  */
/* => no button). The block renders nothing when image and title are    */
/* both missing. `image_side` flips the two columns. Server component   */
/* (no state/effects); the template's Swiper banner slider is dropped — */
/* one CMS block is one banner.                                         */
/* ------------------------------------------------------------------ */

export interface ImageWithTextCta {
  label?: string
  href: string
}

export interface ImageWithTextData {
  image?: string
  image_side?: "left" | "right"
  eyebrow?: string
  title?: string
  body?: string
  cta?: ImageWithTextCta
  [key: string]: unknown
}

/* Template defaults — the index.html product banner art (verified). */
const DEFAULT_IMAGE = "/shofy/img/banner/banner-slider-1.png"
const OFFER_SHAPE = "/shofy/img/banner/banner-slider-offer.png"

/** Render a localized title where "\n" becomes a hard line break. */
function renderTitle(title: string) {
  const lines = title.split("\n")
  return lines.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < lines.length - 1 ? <br /> : null}
    </Fragment>
  ))
}

const ImageWithText = (props: ImageWithTextData) => {
  const image = typeof props.image === "string" ? props.image : ""
  const title = typeof props.title === "string" ? props.title : ""

  // Nothing meaningful to render.
  if (!image && !title) {
    return null
  }

  const imageLeft = props.image_side === "left"

  const contentCol = (
    <div className="col-xl-6 col-lg-6">
      <div className="tp-product-banner-content p-relative z-index-1">
        {props.eyebrow ? (
          <span className="tp-product-banner-subtitle">{props.eyebrow}</span>
        ) : null}
        {title ? (
          <h3 data-el="heading" className="tp-product-banner-title">
            {renderTitle(title)}
          </h3>
        ) : null}
        {props.body ? (
          <p data-el="text" className="mb-40">
            {props.body}
          </p>
        ) : null}
        {props.cta?.href ? (
          <div className="tp-product-banner-btn">
            <LocalizedClientLink
              data-el="button"
              href={props.cta.href}
              className="tp-btn tp-btn-2"
            >
              {props.cta.label || "Shop now"}
            </LocalizedClientLink>
          </div>
        ) : null}
      </div>
    </div>
  )

  const imageCol = (
    <div className="col-xl-6 col-lg-6">
      <div className="tp-product-banner-thumb-wrapper p-relative">
        <div className="tp-product-banner-thumb-shape">
          <span className="tp-product-banner-thumb-gradient"></span>
          <img className="tp-offer-shape" src={OFFER_SHAPE} alt="" />
        </div>

        <div className="tp-product-banner-thumb text-end p-relative z-index-1">
          <img data-el="image" src={image || DEFAULT_IMAGE} alt={title} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="tp-product-banner-area pb-90 shofy-image-with-text">
      <div className="container">
        <div className="tp-product-banner-slider fix">
          <div className="tp-product-banner-inner theme-bg p-relative z-index-1 fix">
            {props.eyebrow ? (
              <h4 className="tp-product-banner-bg-text" aria-hidden="true">
                {props.eyebrow}
              </h4>
            ) : null}
            <div className="row align-items-center">
              {imageLeft ? (
                <>
                  {imageCol}
                  {contentCol}
                </>
              ) : (
                <>
                  {contentCol}
                  {imageCol}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageWithText
