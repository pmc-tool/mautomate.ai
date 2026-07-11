import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the image_with_text CMS block: the template's   */
/* "Featured Product" editorial band (index.html                        */
/* .featuted-product-wrap — the template really spells it "featuted").  */
/* Consumes the SAME resolved block-data prop bag as the Cignet         */
/* version (`<ImageWithText {...block} />`), so it also carries         */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore.                                                       */
/*                                                                      */
/* `image` holds a fully-resolved media URL. `cta` is OPTIONAL (absent  */
/* => no button). The block renders nothing when image and title are    */
/* both missing. `image_side` flips the column order exactly like the   */
/* template's alternating sections (order-md-1 / order-md-2). The       */
/* Cignet-only extras (`video` play overlay, `items` key-benefit list)  */
/* stay in the interface for prop-bag compatibility but are NOT         */
/* rendered — Helendo ships no styling for them.                        */
/* ------------------------------------------------------------------ */

export interface ImageWithTextCta {
  label?: string
  href: string
}

export interface ImageWithTextFeature {
  icon?: string
  title?: string
  text?: string
  [key: string]: unknown
}

export interface ImageWithTextData {
  image?: string
  image_side?: "left" | "right"
  eyebrow?: string
  title?: string
  body?: string
  cta?: ImageWithTextCta
  video?: string
  video_url?: string
  items?: ImageWithTextFeature[]
  [key: string]: unknown
}

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

  const imageRight = props.image_side === "right"

  const imageCol = image ? (
    <div
      className={`col-lg-6 col-md-6 ${
        imageRight ? "order-md-2 order-1" : "order-md-1 order-1"
      }`}
    >
      <div className="product-thumbnail">
        <img src={image} className="img-fluid" alt={title || "Featured"} />
      </div>
    </div>
  ) : null

  const contentCol = (
    <div
      className={
        image
          ? `col-lg-6 col-md-6 ${
              imageRight ? "order-md-1 order-2" : "order-md-2 order-2"
            }`
          : "col-lg-12"
      }
    >
      <div className="featured-product-contect">
        {props.eyebrow ? (
          <h6 className="sub-heading mb-2">{props.eyebrow}</h6>
        ) : null}
        {title ? (
          <h2 className="section-title--one">{renderTitle(title)}</h2>
        ) : null}
        {props.body ? <p className="mt-30">{props.body}</p> : null}
        {props.cta?.href ? (
          <div className="button-box section-space--mt_60">
            <LocalizedClientLink
              href={props.cta.href}
              className="btn btn--md btn--border_1"
            >
              {props.cta.label || "Shop now"} <i className="icon-arrow-right" />
            </LocalizedClientLink>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="featuted-product-wrap section-space--pt_120">
      <div className="container">
        <div className="row align-items-center featuted-product-one">
          {imageCol}
          {contentCol}
        </div>
      </div>
    </div>
  )
}

export default ImageWithText
