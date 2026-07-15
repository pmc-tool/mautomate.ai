import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the image_with_text CMS block, composed from the   */
/* template's generic section shell (section-title / ec-title /         */
/* sub-title / btn btn-primary) with the ".ec-services-section" key-    */
/* benefit cards (.ec_ser_content / .ec_ser_inner) beneath. Consumes    */
/* the SAME resolved block-data prop bag as the Learts/Aurora/Cignet    */
/* versions (`<ImageWithText {...block} />`), so it also carries        */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore.                                                       */
/*                                                                      */
/* `image` holds a fully-resolved media URL. `cta` is OPTIONAL (absent  */
/* => no button). The block renders nothing when image and title are    */
/* both missing. When the prop bag carries a `video` / `video_url`      */
/* string, a plain play-button anchor links out over the image (no      */
/* popup player JS). An optional `items` array overrides the template's */
/* default service cards (pass an empty array to hide the list); item   */
/* icons may be media URLs (rendered as <img>) or ecicon class names    */
/* (rendered as <i>).                                                   */
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

/** The template's own services-section items, used when the block has none. */
const DEFAULT_FEATURES: ImageWithTextFeature[] = [
  {
    icon: "ecicon eci-truck",
    title: "Free Shipping",
    text: "Free shipping on all US order or order above $200",
  },
  {
    icon: "ecicon eci-headphones",
    title: "24X7 Support",
    text: "Contact us 24 hours a day, 7 days a week",
  },
  {
    icon: "ecicon eci-percent",
    title: "30 Days Return",
    text: "Simply return it within 30 days for an exchange",
  },
  {
    icon: "ecicon eci-lock",
    title: "Payment Secure",
    text: "Contact us 24 hours a day, 7 days a week",
  },
]

/** Icon class names render as <i>; media URLs render as <img>. */
const isIconClass = (icon: string) => !/^(\/|https?:\/\/|data:)/.test(icon)

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
    <div className="col-lg-6 align-self-center">
      <div style={{ position: "relative" }}>
        <img
          data-el="image"
          src={image}
          alt={title}
          style={{ maxWidth: "100%", width: "100%" }}
        />
        {video ? (
          /* Popup player dropped: plain anchor over the image */
          <a
            href={video}
            target="_blank"
            rel="noreferrer"
            aria-label="Play video"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 70,
              height: 70,
              borderRadius: "100%",
              backgroundColor: "#3474d4",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            <i className="ecicon eci-play"></i>
          </a>
        ) : null}
      </div>
    </div>
  ) : null

  const contentCol = (
    <div
      className={
        image ? "col-lg-6 align-self-center" : "col-lg-12 text-center"
      }
    >
      {/* Section Title Start */}
      <div className="section-title" style={{ marginBottom: 20 }}>
        {title ? <h2 className="ec-bg-title">{title}</h2> : null}
        {title ? (
          <h2 data-el="heading" className="ec-title">
            {renderTitle(title)}
          </h2>
        ) : null}
        {props.eyebrow ? <p className="sub-title">{props.eyebrow}</p> : null}
      </div>
      {/* Section Title End */}
      {props.body ? <p data-el="text">{props.body}</p> : null}
      {props.cta?.href ? (
        <div style={{ marginTop: 25 }}>
          <LocalizedClientLink
            href={props.cta.href}
            data-el="button"
            className="btn btn-primary"
          >
            {props.cta.label || "Shop Now"}
          </LocalizedClientLink>
        </div>
      ) : null}
    </div>
  )

  return (
    <section className="section ekka-image-with-text section-space-p">
      <div className="container">
        <div className="row" style={{ rowGap: 30 }}>
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
          <div className="row" style={{ marginTop: 40 }}>
            {features.map((feature, i) => (
              <div
                className="ec_ser_content col-sm-12 col-md-6 col-lg-3"
                key={i}
              >
                <div className="ec_ser_inner">
                  {feature.icon ? (
                    <div className="ec-service-image">
                      {isIconClass(feature.icon) ? (
                        <i className={feature.icon}></i>
                      ) : (
                        <img src={feature.icon} alt="" />
                      )}
                    </div>
                  ) : null}
                  <div className="ec-service-desc">
                    {feature.title ? <h2>{feature.title}</h2> : null}
                    {feature.text ? <p>{feature.text}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default ImageWithText
