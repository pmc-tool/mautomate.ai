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
/* missing. Aurora = modern minimalist editorial split section.          */
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
    <div className="w-full">
      {image ? (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
    </div>
  )

  const contentCol = (
    <div className="w-full">
      <div className="max-w-xl">
        {props.eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            {props.eyebrow}
          </p>
        ) : null}
        {title ? (
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">
            {renderTitle(title)}
          </h2>
        ) : null}
        {props.body ? (
          <p className="mt-4 text-base leading-relaxed text-neutral-500">
            {props.body}
          </p>
        ) : null}
        {props.cta?.href ? (
          <div className="mt-8">
            <LocalizedClientLink
              href={props.cta.href}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {props.cta.label || "Shop now"}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </LocalizedClientLink>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <section className="aurora-theme bg-white py-16 md:py-24 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
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
