"use client"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the Testimonials CMS block: the template's        */
/* "testimonial area" from index-2.html (.tp-testimonial-area grey      */
/* band, centered .tp-testimonial-item with rating stars, quote,        */
/* avatar + name/role, and the side prev/next arrows). Consumes the     */
/* SAME resolved block-data prop bag as the Learts/Cignet versions      */
/* (`<Testimonials {...block} />`), so it also carries block_type /     */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is       */
/* always an array (may be empty => the whole block renders null).      */
/* `role` / `avatar` are optional per item; avatars default to the      */
/* template's /shofy/img/users/user-N.jpg files cycling by index. An    */
/* optional `rating` per item (1..5, default 5) drives the fa stars.    */
/* Client component: the template's Swiper slider is reimplemented as   */
/* a simple React prev/next carousel (no Swiper JS).                    */
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

/** Default portraits shipped with the template (cycled by index; verified). */
function fallbackAvatar(index: number): string {
  return `/shofy/img/users/user-${(index % 6) + 1}.jpg`
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
        <span key={i}>
          <i className="fa-solid fa-star" aria-hidden="true" />
        </span>
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

  const prev = () => setIndex((active + items.length - 1) % items.length)
  const next = () => setIndex((active + 1) % items.length)

  return (
    <section className="tp-testimonial-area grey-bg-7 pt-70 pb-75 shofy-testimonials">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-12">
            <div className="tp-testimonial-slider p-relative z-index-1">
              <div className="tp-testimonial-shape">
                <span className="tp-testimonial-shape-gradient"></span>
              </div>
              {props.title ? (
                <h3 className="tp-testimonial-section-title text-center">
                  {props.title}
                </h3>
              ) : null}
              <div className="row justify-content-center">
                <div className="col-xl-8 col-lg-8 col-md-10">
                  <div className="tp-testimonial-item text-center mb-20">
                    <div className="tp-testimonial-rating">
                      <Stars count={starCount(item.rating)} />
                    </div>
                    <div className="tp-testimonial-content">
                      <p>&ldquo;{item.quote}&rdquo;</p>
                    </div>
                    <div className="tp-testimonial-user-wrapper d-flex align-items-center justify-content-center">
                      <div className="tp-testimonial-user d-flex align-items-center">
                        <div className="tp-testimonial-avater mr-10">
                          <img src={avatar} alt={item.author} />
                        </div>
                        <div className="tp-testimonial-user-info tp-testimonial-user-translate">
                          <h3 className="tp-testimonial-user-title">
                            {item.author}
                          </h3>
                          {item.role ? (
                            <span className="tp-testimonial-designation">
                              {item.role}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {items.length > 1 ? (
                <div className="tp-testimonial-arrow d-none d-md-block">
                  <button
                    type="button"
                    className="tp-testimonial-slider-button-prev"
                    aria-label="Previous testimonial"
                    onClick={prev}
                  >
                    <svg
                      width="17"
                      height="14"
                      viewBox="0 0 17 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.061 6.99959L16 6.99959"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7.08618 1L1.06079 6.9995L7.08618 13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="tp-testimonial-slider-button-next"
                    aria-label="Next testimonial"
                    onClick={next}
                  >
                    <svg
                      width="17"
                      height="14"
                      viewBox="0 0 17 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15.939 6.99959L1 6.99959"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.91382 1L15.9392 6.9995L9.91382 13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ) : null}
              {items.length > 1 ? (
                <div
                  className="text-center mt-30 d-md-none"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  {items.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Go to testimonial ${i + 1}`}
                      aria-current={i === active ? "true" : undefined}
                      style={{
                        width: i === active ? 24 : 10,
                        height: 10,
                        padding: 0,
                        border: "none",
                        borderRadius: 100,
                        cursor: "pointer",
                        background:
                          i === active
                            ? "var(--tp-theme-primary)"
                            : "rgba(0, 0, 0, 0.2)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Testimonials
