"use client"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the Testimonials CMS block ("Our Testimonials"   */
/* section of the Cignet template). Consumes the SAME resolved          */
/* block-data prop bag as the Learts/Aurora versions                    */
/* (`<Testimonials {...block} />`), so it also carries block_type /     */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is        */
/* always an array (may be empty => the whole block renders null).      */
/* `role` / `avatar` are optional per item; avatars default to the       */
/* template's /cignet/images/author-N.jpg files cycling by index. An     */
/* optional `rating` per item (1..5, default 5) drives the fa stars,     */
/* and an optional block-level `google_rating` renders the template's    */
/* google-rating box. Client component: the template's Swiper slider is  */
/* reimplemented as a simple React prev/next carousel (no Swiper JS).    */
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
  google_rating?: number | string
  [key: string]: unknown
}

/** Default author portraits shipped with the template (cycled by index). */
function fallbackAvatar(index: number): string {
  return `/cignet/images/author-${(index % 6) + 1}.jpg`
}

/** Coerce an unknown per-item rating into a 1..5 star count (default 5). */
function starCount(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : NaN
  if (!Number.isFinite(n)) {
    return 5
  }
  return Math.min(5, Math.max(1, n))
}

function Stars({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <i className="fa-solid fa-star" aria-hidden="true" key={i} />
      ))}
    </>
  )
}

const Testimonials = (props: TestimonialsData) => {
  const items = Array.isArray(props.items) ? props.items : []
  const [index, setIndex] = useState(0)

  if (!items.length) {
    return null
  }

  const active = Math.min(index, items.length - 1)
  const item = items[active]
  const avatar = item.avatar || fallbackAvatar(active)
  const googleRating =
    typeof props.google_rating === "number" ||
    (typeof props.google_rating === "string" && props.google_rating.trim())
      ? String(props.google_rating)
      : ""

  const prev = () => setIndex((active + items.length - 1) % items.length)
  const next = () => setIndex((active + 1) % items.length)

  const arrowStyle = {
    border: "none",
    padding: 0,
    cursor: "pointer",
  } as const

  return (
    <div
      className="our-testimonials dark-section cignet-testimonials"
      style={{
        backgroundImage: "url(/cignet/images/testimonial-bg-image.jpg)",
      }}
    >
      <div className="container">
        <div className="row">
          <div className="col-xl-12">
            {/* Testimonials Content Box Start */}
            <div className="testimonials-content-box">
              {props.title ? (
                <div className="section-title">
                  <span className="section-sub-title wow fadeInUp">
                    Testimonials
                  </span>
                  <h2 className="text-anime-style-3">{props.title}</h2>
                </div>
              ) : null}

              {googleRating ? (
                <div
                  className="google-rating-box"
                  style={{ marginBottom: "40px" }}
                >
                  <div className="google-rating-logo">
                    <img src="/cignet/images/icon-google.svg" alt="Google" />
                  </div>
                  <div className="google-rating-content">
                    <span className="google-rating-star">
                      <Stars count={5} />
                    </span>
                    <h2>
                      <span className="counter">{googleRating}</span>/5 Review
                    </h2>
                  </div>
                </div>
              ) : null}

              {/* Testimonial Slider Start */}
              <div className="testimonial-slider">
                <div className="swiper">
                  <div className="swiper-wrapper">
                    <div className="swiper-slide">
                      {/* Testimonial Item Start */}
                      <div className="testimonial-item">
                        <div className="testimonial-item-content-box">
                          <div className="testimonial-item-rating">
                            <Stars count={starCount(item.rating)} />
                          </div>
                          <div className="testimonial-item-content">
                            <span
                              aria-hidden="true"
                              style={{
                                display: "block",
                                marginBottom: "10px",
                                fontSize: "24px",
                                color: "var(--white-color)",
                              }}
                            >
                              <i className="fa-solid fa-quote-left" />
                            </span>
                            {item.quote ? <p>{item.quote}</p> : null}
                          </div>
                        </div>
                        <div className="testimonial-item-author">
                          <div className="testimonial-author-image">
                            <figure className="image-anime">
                              <img src={avatar} alt={item.author} />
                            </figure>
                          </div>
                          <div className="testimonial-author-content">
                            <h2>{item.author}</h2>
                            {item.role ? <p>{item.role}</p> : null}
                          </div>
                        </div>
                      </div>
                      {/* Testimonial Item End */}
                    </div>
                  </div>
                  {items.length > 1 ? (
                    <div className="testimonial-btn">
                      <button
                        type="button"
                        className="testimonial-button-prev"
                        aria-label="Previous testimonial"
                        onClick={prev}
                        style={arrowStyle}
                      />
                      <button
                        type="button"
                        className="testimonial-button-next"
                        aria-label="Next testimonial"
                        onClick={next}
                        style={arrowStyle}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              {/* Testimonial Slider End */}
            </div>
            {/* Testimonials Content Box End */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Testimonials
