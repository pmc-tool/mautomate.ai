import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend image_with_text resolved       */
/* schema). Received as the spread prop bag from the storefront         */
/* SectionRenderer (`<ImageWithText {...block} />`), so it also carries  */
/* block_type / schema_version which we simply ignore.                  */
/* `image` holds a fully-resolved media URL (absolute backend url or a   */
/* /learts path — both work in <img>). `cta` is OPTIONAL (absent =>      */
/* no button). The block renders nothing when image and title are both   */
/* missing.                                                              */
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

  const imageCol = (
    <div className="col-lg-6 col-12 learts-mb-30">
      <div className="product-deal-image text-center">
        {image ? <img data-el="image" src={image} alt={title} /> : null}
      </div>
    </div>
  )

  const contentCol = (
    <div className="col-lg-6 col-12 learts-mb-30">
      <div className="product-deal-content">
        {props.eyebrow ? (
          <h5 className="sub-title">{props.eyebrow}</h5>
        ) : null}
        {title ? (
          <h2 data-el="heading" className="title">
            {renderTitle(title)}
          </h2>
        ) : null}
        {props.body ? (
          <div className="desc">
            <p data-el="text">{props.body}</p>
          </div>
        ) : null}
        {props.cta?.href ? (
          <LocalizedClientLink
            data-el="button"
            href={props.cta.href}
            className="btn btn-dark btn-hover-primary"
          >
            {props.cta.label || "shop now"}
          </LocalizedClientLink>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="section section-fluid section-padding learts-theme">
      <div className="container">
        <div className="row align-items-center learts-mb-n30">
          {imageRight ? (
            <>
              {contentCol}
              {imageCol}
            </>
          ) : (
            <>
              {imageCol}
              {contentCol}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageWithText
