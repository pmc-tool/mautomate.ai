import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the image_with_text CMS block, composed from the */
/* template's "Intro Video" / "Our Promise" sections: image side +      */
/* content side (eyebrow / title / body / CTA) with a key-benefit icon  */
/* feature list beneath. Consumes the SAME resolved block-data prop bag */
/* as the Learts/Aurora versions (`<ImageWithText {...block} />`), so   */
/* it also carries block_type / schema_version / countryCode /          */
/* sectionScope which we simply ignore.                                 */
/*                                                                      */
/* `image` holds a fully-resolved media URL. `cta` is OPTIONAL (absent  */
/* => no button). The block renders nothing when image and title are    */
/* both missing. The template's YouTube popup player is dropped: when   */
/* the prop bag carries a `video` / `video_url` string the play-button  */
/* visual renders over the image as a plain anchor linking out. An      */
/* optional `items` array overrides the template's default key-benefit  */
/* feature list (pass an empty array to hide the list).                 */
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

/** The template's own key-benefit items, used when the block has none. */
const DEFAULT_FEATURES: ImageWithTextFeature[] = [
  {
    icon: "/cignet/images/icon-key-benefit-item-1.svg",
    title: "Premium Support",
    text: "Outstanding premium support",
  },
  {
    icon: "/cignet/images/icon-key-benefit-item-2.svg",
    title: "Flexible Payment",
    text: "Pay with multiple credit cards",
  },
  {
    icon: "/cignet/images/icon-key-benefit-item-3.svg",
    title: "Free Shipping",
    text: "Free shipping on qualifying orders",
  },
  {
    icon: "/cignet/images/icon-key-benefit-item-4.svg",
    title: "Easy Returns",
    text: "Within 30 days for exchange",
  },
]

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
  const video =
    typeof props.video === "string" && props.video
      ? props.video
      : typeof props.video_url === "string"
      ? props.video_url
      : ""
  const features = Array.isArray(props.items)
    ? props.items.filter((f) => f && (f.title || f.text || f.icon))
    : DEFAULT_FEATURES

  const imageCol = image ? (
    <div className="col-lg-6">
      <div className="position-relative">
        <figure className="image-anime" style={{ marginBottom: 0 }}>
          <img
            data-el="image"
            src={image}
            alt={title}
            className="img-fluid w-100"
            style={{ borderRadius: "4px" }}
          />
        </figure>
        {video ? (
          /* Video Play Button Start (popup player dropped: plain anchor) */
          <div className="video-play-button position-absolute top-50 start-50 translate-middle">
            <a
              href={video}
              target="_blank"
              rel="noreferrer"
              aria-label="Play video"
              style={{ cursor: "pointer" }}
            >
              <span className="bg-effect">
                <i className="fa-solid fa-play" />
              </span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  ) : null

  const contentCol = (
    <div className={image ? "col-lg-6" : "col-lg-12"}>
      {/* Section Title Start */}
      <div className="section-title" style={{ marginBottom: 0 }}>
        {props.eyebrow ? (
          <span className="section-sub-title wow fadeInUp">
            {props.eyebrow}
          </span>
        ) : null}
        {title ? (
          <h2 data-el="heading" className="text-anime-style-3">{renderTitle(title)}</h2>
        ) : null}
        {props.body ? (
          <p data-el="text" className="wow fadeInUp">
            {props.body}
          </p>
        ) : null}
      </div>
      {/* Section Title End */}
      {props.cta?.href ? (
        <div className="wow fadeInUp" style={{ marginTop: "30px" }}>
          <LocalizedClientLink
            data-el="button"
            href={props.cta.href}
            className="btn-default"
          >
            {props.cta.label || "Shop now"}
          </LocalizedClientLink>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="our-promise cignet-image-with-text">
      <div className="container">
        <div className="row align-items-center" style={{ rowGap: "30px" }}>
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

        {features.length ? (
          <div className="row">
            <div className="col-lg-12">
              {/* Key Benefit Item List Start */}
              <div
                className="key-benefit-item-list"
                style={{ marginTop: "60px" }}
              >
                {features.map((feature, i) => (
                  <div className="key-benefit-item wow fadeInUp" key={i}>
                    {feature.icon ? (
                      <div className="icon-box">
                        <img src={feature.icon} alt="" />
                      </div>
                    ) : null}
                    <div className="key-benefit-item-content">
                      {feature.title ? <h3>{feature.title}</h3> : null}
                      {feature.text ? <p>{feature.text}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
              {/* Key Benefit Item List End */}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ImageWithText
