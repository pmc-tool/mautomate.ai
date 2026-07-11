import { Fragment } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the image_with_text CMS block, composed from the */
/* template's "Summer suits you" section (`aqf-summer-suit-area`,       */
/* index.html 5238-5300: image side + oversized title + body + CTA on   */
/* a #FAFAFA panel) with the `aqf-shop-feature-item` icon strip         */
/* (5474-5528) beneath. Consumes the SAME resolved block-data prop bag  */
/* as the Cignet version (`<ImageWithText {...block} />`), so it also   */
/* carries block_type / schema_version / countryCode / sectionScope     */
/* which we simply ignore.                                              */
/*                                                                      */
/* `image` holds a fully-resolved media URL. `cta` is OPTIONAL (absent  */
/* => no button). The block renders nothing when image and title are    */
/* both missing. An optional `items` array overrides the template's     */
/* default shop-feature list (pass an empty array to hide it); custom   */
/* items may carry an `icon` image URL, template defaults use the       */
/* template's own inline SVGs.                                          */
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
  items?: ImageWithTextFeature[]
  [key: string]: unknown
}

/* The template's own shop-feature inline SVGs (index.html 5474-5528). */
const FeatureIconShipping = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="35"
    height="36"
    viewBox="0 0 35 36"
    fill="none"
  >
    <path
      d="M2.07422 9.99707L17.0833 18.6829L31.9904 10.048M17.083 34.0831V18.666M25.5831 19.8554V13.6342L9.45215 4.31934M13.5663 1.5659L4.48949 6.61431C2.43275 7.75316 0.75 10.6088 0.75 12.9545V22.5583C0.75 24.904 2.43275 27.7596 4.48949 28.8984L13.5663 33.9469C15.5041 35.0177 18.6827 35.0177 20.6204 33.9469L29.6973 28.8984C31.754 27.7596 33.4368 24.904 33.4368 22.5583V12.9545C33.4368 10.6088 31.754 7.75316 29.6973 6.61431L20.6204 1.5659C18.6657 0.478035 15.5041 0.478035 13.5663 1.5659Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const FeatureIconReturns = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="30"
    height="36"
    viewBox="0 0 30 36"
    fill="none"
  >
    <path
      d="M14.5026 0.75V34.75M14.5025 29.5818L27.5926 23.2238M14.5025 21.0811L27.0315 14.9951M14.5025 12.5811L23.0536 8.41613M15.5402 1.107C14.9282 0.631 14.0783 0.631 13.4663 1.107C10.2363 3.572 0.699204 11.613 0.750204 20.98C0.750204 28.562 6.92127 34.75 14.5203 34.75C22.1193 34.75 28.2902 28.579 28.2902 20.997C28.3072 11.766 18.7532 3.589 15.5402 1.107Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const FeatureIconPayment = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
  >
    <path
      d="M3.88037 24.1954L24.1983 3.87744M16.0757 28.2761L18.116 26.2358M20.6509 23.7037L24.7145 19.6401M0.600098 34.6001H34.6051M3.32265 14.606L14.6123 3.31631C18.2168 -0.288222 20.0191 -0.305224 23.5896 3.2653L31.9378 11.6135C35.5084 15.184 35.4914 16.9863 31.8868 20.5908L20.5972 31.8805C16.9927 35.485 15.1904 35.502 11.6199 31.9315L3.27165 23.5833C-0.298875 20.0128 -0.298875 18.2275 3.32265 14.606Z"
      stroke="currentcolor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const FeatureIconSupport = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
  >
    <path
      d="M28.7484 25.9603L29.4113 31.3321C29.5813 32.7431 28.0684 33.729 26.8614 32.998L19.7388 28.7652C18.9568 28.7652 18.1919 28.7142 17.4439 28.6122C18.7019 27.1333 19.4498 25.2633 19.4498 23.2403C19.4498 18.4125 15.268 14.5027 10.1003 14.5027C8.12836 14.5027 6.30945 15.0636 4.79653 16.0496C4.74553 15.6246 4.72852 15.1996 4.72852 14.7576C4.72852 7.0228 11.4432 0.75 19.7388 0.75C28.0344 0.75 34.7491 7.0228 34.7491 14.7576C34.7491 19.3475 32.3862 23.4104 28.7484 25.9603Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.4491 23.2396C19.4491 25.2626 18.7011 27.1326 17.4432 28.6115C15.7603 30.6515 13.0914 31.9604 10.0995 31.9604L5.66276 34.5953C4.9148 35.0543 3.96284 34.4253 4.06483 33.5583L4.48981 30.2095C2.21192 28.6285 0.75 26.0955 0.75 23.2396C0.75 20.2477 2.34793 17.6128 4.79581 16.0489C6.30874 15.0629 8.12764 14.502 10.0995 14.502C15.2673 14.502 19.4491 18.4118 19.4491 23.2396Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DEFAULT_FEATURE_ICONS = [
  FeatureIconShipping,
  FeatureIconReturns,
  FeatureIconPayment,
  FeatureIconSupport,
]

/** The template's own shop-feature items, used when the block has none. */
const DEFAULT_FEATURES: ImageWithTextFeature[] = [
  { title: "Free Shipping", text: "Free Shipping for orders over $130" },
  { title: "Free Returns", text: "Within 30 days for an exchange." },
  { title: "Flexible Payment", text: "Pay with Multiple Credit Cards" },
  { title: "Support Online", text: "24 hours a day, 7 days a week" },
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
  const features = Array.isArray(props.items)
    ? props.items.filter((f) => f && (f.title || f.text || f.icon))
    : DEFAULT_FEATURES

  const imageCol = image ? (
    <div className="col-xl-5 col-lg-6">
      <div className="aqf-summer-suit-img">
        <img className="w-100" src={image} alt={title} />
      </div>
    </div>
  ) : null

  const contentCol = (
    <div className={image ? "col-xl-7 col-lg-6" : "col-lg-12"}>
      <div className="aqf-summer-slider-wrap pl-35 pr-35">
        <div className="aqf-summer-title-wrap pt-60 mb-20">
          {props.eyebrow ? (
            <span className="aq-section-subtitle ff-satoshi-med mb-10">
              {props.eyebrow}
            </span>
          ) : null}
          {title ? (
            <h3 className="aq-section-title ff-satoshi-med fs-60">
              {renderTitle(title)}
            </h3>
          ) : null}
        </div>
        <div className="aqf-summer-slider-content mb-60">
          {props.body ? <p>{props.body}</p> : null}
          {props.cta?.href ? (
            <LocalizedClientLink className="aq-btn-black" href={props.cta.href}>
              {props.cta.label || "Shop Collection"}
            </LocalizedClientLink>
          ) : null}
        </div>
      </div>
    </div>
  )

  return (
    <div className="aqf-summer-suit-area pt-60 pb-60 bazaro-image-with-text">
      <div className="container">
        <div className="aqf-summer-wrap" style={{ backgroundColor: "#FAFAFA" }}>
          <div className="row align-items-center">
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

        {features.length ? (
          <div className="aqf-shop-feature-wrap pt-60">
            <div className="row">
              {features.map((feature, i) => {
                const DefaultIcon =
                  DEFAULT_FEATURE_ICONS[i % DEFAULT_FEATURE_ICONS.length]
                return (
                  <div className="col-xl-3 col-md-6" key={i}>
                    <div className="aqf-shop-feature-item mb-30 text-center">
                      <span>
                        {feature.icon ? (
                          <img
                            src={feature.icon}
                            alt=""
                            style={{ maxHeight: 36, width: "auto" }}
                          />
                        ) : (
                          <DefaultIcon />
                        )}
                      </span>
                      {feature.title ? <h4>{feature.title}</h4> : null}
                      {feature.text ? <p>{feature.text}</p> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ImageWithText
