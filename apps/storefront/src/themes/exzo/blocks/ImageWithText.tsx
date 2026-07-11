import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the image_with_text CMS block: the template's      */
/* two-column media band (index1.html "choose the best" slide /         */
/* about1.html "we love music" rows) — a .block-image.rounded-image     */
/* photo beside an eyebrow / .h2 headline / .title-underline / body     */
/* copy / pill-button stack. Consumes the SAME resolved block-data      */
/* prop bag as the Learts/Cignet versions                               */
/* (`<ImageWithText {...block} />`), so it also carries block_type /    */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `image` holds a fully-resolved media URL. `cta` is OPTIONAL (absent  */
/* => no button). The block renders nothing when image and title are    */
/* both missing. When the (open) prop bag carries a `video` /           */
/* `video_url` string a play link renders under the CTA as a plain      */
/* anchor linking out (no popup player — that was template JS). An      */
/* optional `items` array renders the template's                        */
/* .icon-description-shortcode.style-1 feature tiles beneath.           */
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
  const video =
    typeof props.video === "string" && props.video
      ? props.video
      : typeof props.video_url === "string"
      ? props.video_url
      : ""
  const features = Array.isArray(props.items)
    ? props.items.filter((f) => f && (f.title || f.text || f.icon))
    : []

  const imageCol = image ? (
    <div className="col-sm-6 col-xs-b30 col-sm-b0">
      <img src={image} className="block-image rounded-image" alt={title} />
    </div>
  ) : null

  const contentCol = (
    <div className={image ? "col-sm-6 col-md-5 col-md-offset-1" : "col-sm-12"}>
      {props.eyebrow ? (
        <div className="simple-article size-3 grey uppercase col-xs-b5">
          {props.eyebrow}
        </div>
      ) : null}
      {title ? <div className="h2">{renderTitle(title)}</div> : null}
      <div className="title-underline left">
        <span></span>
      </div>
      {props.body ? (
        <div className="simple-article size-3 col-xs-b30">{props.body}</div>
      ) : null}
      {props.cta?.href || video ? (
        <div className="buttons-wrapper">
          {props.cta?.href ? (
            <LocalizedClientLink
              href={props.cta.href}
              className="button size-2 style-3"
            >
              <span className="button-wrapper">
                <span className="icon">
                  <img src="/exzo/img/icon-4.png" alt="" />
                </span>
                <span className="text">{props.cta.label || "Shop now"}</span>
              </span>
            </LocalizedClientLink>
          ) : null}
          {video ? (
            <a
              href={video}
              target="_blank"
              rel="noreferrer"
              className="button size-2 style-2"
            >
              <span className="button-wrapper">
                <span className="icon">
                  <i
                    className="fa fa-play"
                    aria-hidden="true"
                    style={{ lineHeight: "50px", color: "#fff" }}
                  />
                </span>
                <span className="text">Watch video</span>
              </span>
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="exzo-image-with-text">
      <div className="container">
        <div className="row vertical-aligned-columns">
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
          <div>
            <div className="empty-space col-xs-b35 col-md-b70"></div>
            <div className="row">
              {features.map((feature, i) => (
                <div className="col-sm-4 col-xs-b30 col-sm-b0" key={i}>
                  <div className="icon-description-shortcode style-1">
                    {feature.icon ? (
                      <img
                        className="image-icon"
                        src={feature.icon}
                        alt=""
                        style={{ margin: "0 auto 10px" }}
                      />
                    ) : null}
                    <div className="content">
                      {feature.title ? (
                        <h6 className="title h6">{feature.title}</h6>
                      ) : null}
                      {feature.text ? (
                        <div className="description simple-article size-2">
                          {feature.text}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ImageWithText
