"use client"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the Testimonials CMS block (template             */
/* `aqf-testimonial-area`, index.html 5302-5472: centered quote card    */
/* with outlined quote mark, orange stars, author line, side arrows +   */
/* dots). Consumes the SAME resolved block-data prop bag as the Cignet  */
/* version (`<Testimonials {...block} />`), so it also carries          */
/* block_type / schema_version / countryCode / sectionScope which we    */
/* simply ignore.                                                       */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is       */
/* always an array (may be empty => the whole block renders null).      */
/* `role` is appended to the author line ("Author - Role"); `avatar`    */
/* is accepted but unused (the template's testimonial card carries no   */
/* portrait). An optional `rating` per item (1..5, default 5) drives    */
/* the stars. Client component: the template's Swiper is reimplemented  */
/* as a simple React prev/next carousel with clickable dots (no Swiper  */
/* JS) reusing the template's arrow / bullet classes.                   */
/* ------------------------------------------------------------------ */

import { useState } from "react"

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
  rating?: number
  [key: string]: unknown
}

export interface TestimonialsData {
  title?: string
  items?: TestimonialItem[]
  [key: string]: unknown
}

/** Coerce an unknown per-item rating into a 1..5 star count (default 5). */
function starCount(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : NaN
  if (!Number.isFinite(n)) {
    return 5
  }
  return Math.min(5, Math.max(1, n))
}

/* The template's 13x13 orange rating star. */
const StarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 13 13"
    fill="none"
  >
    <path
      d="M6.41531 0L8.19948 4.28974L12.8305 4.66101L9.30216 7.68349L10.3801 12.2027L6.41531 9.78094L2.45047 12.2027L3.52845 7.68349L6.4373e-05 4.66101L4.63113 4.28974L6.41531 0Z"
      fill="#FF9C05"
    />
  </svg>
)

/* The template's 56x41 outlined double-quote mark. */
const QuoteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="56"
    height="41"
    viewBox="0 0 56 41"
    fill="none"
  >
    <path
      d="M25.4502 0.75V24.127L13.3496 38.54V23.6504H0.75V0.75H25.4502ZM54.8496 0.75V24.127L42.75 38.54V23.6504H30.1504V0.75H54.8496Z"
      stroke="#000709"
      strokeWidth="1.5"
    />
  </svg>
)

const ArrowLeft = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="7"
    height="12"
    viewBox="0 0 7 12"
    fill="none"
  >
    <path
      d="M5.75 10.75L0.75 5.75L5.75 0.75"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ArrowRight = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="7"
    height="12"
    viewBox="0 0 7 12"
    fill="none"
  >
    <path
      d="M0.75 10.75L5.75 5.75L0.75 0.75"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const Testimonials = (props: TestimonialsData) => {
  const items = Array.isArray(props.items) ? props.items : []
  const [index, setIndex] = useState(0)

  if (!items.length) {
    return null
  }

  const active = Math.min(index, items.length - 1)
  const item = items[active]

  const prev = () => setIndex((active + items.length - 1) % items.length)
  const next = () => setIndex((active + 1) % items.length)

  return (
    <div className="aqf-testimonial-area pt-60 pb-60 fix bazaro-testimonials">
      <div className="container">
        {props.title ? (
          <div className="row">
            <div className="col-xl-12">
              <div className="aqf-collection-title-box text-center mb-20">
                <h4 className="aq-section-title ff-satoshi-med fs-38 mb-0">
                  {props.title}
                </h4>
              </div>
            </div>
          </div>
        ) : null}

        <div className="row justify-content-center">
          <div className="col-xl-8 col-lg-10">
            <div className="aqf-testimonial-slider p-relative">
              {items.length > 1 ? (
                <div className="aqf-testimonial-arrow">
                  <button
                    type="button"
                    className="aqf-testimonial-prev"
                    aria-label="Previous testimonial"
                    onClick={prev}
                  >
                    <i>
                      <ArrowLeft />
                    </i>
                  </button>
                  <button
                    type="button"
                    className="aqf-testimonial-next"
                    aria-label="Next testimonial"
                    onClick={next}
                  >
                    <i>
                      <ArrowRight />
                    </i>
                  </button>
                </div>
              ) : null}

              <div className="aqf-testimonial-item text-center">
                <span className="aqf-testimonial-quote">
                  <QuoteIcon />
                </span>
                <div className="aqf-testimonial-text">
                  {item.quote ? <p>{item.quote}</p> : null}
                </div>
                <div className="aqf-testimonial-ratting">
                  {Array.from({ length: starCount(item.rating) }).map(
                    (_, i) => (
                      <span key={i}>
                        <StarIcon />
                      </span>
                    )
                  )}
                </div>
                <div className="aqf-testimonial-info">
                  <span>
                    {item.author}
                    {item.role ? ` - ${item.role}` : ""}
                  </span>
                </div>
              </div>

              {items.length > 1 ? (
                <div className="aqf-testimonial-dot text-center mt-30">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Go to testimonial ${i + 1}`}
                      aria-current={i === active ? "true" : undefined}
                      className={
                        i === active
                          ? "swiper-pagination-bullet swiper-pagination-bullet-active"
                          : "swiper-pagination-bullet"
                      }
                      style={{ padding: 0, cursor: "pointer" }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Testimonials
