import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the image_with_text CMS block: the template's     */
/* "image__with--text__section" (index.html ~670-716) — image column +  */
/* content column (eyebrow / title / body / CTA). Consumes the SAME     */
/* resolved block-data prop bag as the Cignet/Learts versions           */
/* (`<ImageWithText {...block} />`), so it also carries block_type /    */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* The template's percent bars / signature footer / positioned shape    */
/* imagery are dropped (decorative, demo-specific). `image` holds a     */
/* fully-resolved media URL; `cta` is OPTIONAL (absent => no button).   */
/* The block renders nothing when image and title are both missing.     */
/* `image_side` swaps the column order.                                 */
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

  const imageCol = image ? (
    <div className="col">
      <div className="image__with--text__thumbnail">
        <img className="display-block" src={image} alt={title} />
      </div>
    </div>
  ) : null

  const contentCol = (
    <div className="col">
      <div className="image__with--text__content">
        {props.eyebrow ? (
          <span
            className="image__with--text__eyebrow"
            style={{
              display: "block",
              marginBottom: "12px",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "var(--secondary-color, #f14705)",
            }}
          >
            {props.eyebrow}
          </span>
        ) : null}
        {title ? (
          <h2 className="image__with--text__title mb-18">
            {renderTitle(title)}
          </h2>
        ) : null}
        {props.body ? (
          <p className="image__with--text__desc mb-25">{props.body}</p>
        ) : null}
        {props.cta?.href ? (
          <div className="image__with--text__content--footer d-flex">
            <LocalizedClientLink
              className="primary__btn"
              href={props.cta.href}
            >
              {props.cta.label || "Shop Now"}
            </LocalizedClientLink>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <section className="image__with--text__section section--padding">
      <div className="container">
        <div className="row row-cols-md-2 row-cols-1 align-items-center">
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
    </section>
  )
}

export default ImageWithText
