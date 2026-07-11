"use client"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the Testimonials CMS block ("Client Review"        */
/* section of the Ekka template, .ec-test-section). Consumes the SAME   */
/* resolved block-data prop bag as the Learts/Aurora/Cignet versions    */
/* (`<Testimonials {...block} />`), so it also carries block_type /     */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is       */
/* always an array (may be empty => the whole block renders null).      */
/* `role` / `avatar` are optional per item; avatars default to the      */
/* template's /ekka/images/testimonial/N.jpg files cycling by index. An */
/* optional `rating` per item (1..5, default 5) drives the ecicon       */
/* stars. Client component: the template's slick slider is              */
/* reimplemented as a simple React one-at-a-time carousel (no slick     */
/* JS) whose avatar dots reuse the template's `.slick-dots` styling —   */
/* the same hooks/state pattern as the Cignet Testimonials.             */
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

/** Default portraits shipped with the template (cycled by index). */
function fallbackAvatar(index: number): string {
  return `/ekka/images/testimonial/${(index % 3) + 1}.jpg`
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
      {Array.from({ length: 5 }).map((_, i) => (
        <i
          className={i < count ? "ecicon eci-star fill" : "ecicon eci-star"}
          aria-hidden="true"
          key={i}
        />
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

  return (
    <section className="section ec-test-section section-space-ptb-100 section-space-m ekka-testimonials">
      <div className="container">
        {props.title ? (
          <div className="row">
            <div className="col-md-12 text-center">
              {/* Section Title Start */}
              <div className="section-title mb-0">
                <h2 className="ec-bg-title">Testimonial</h2>
                <h2 className="ec-title">{props.title}</h2>
              </div>
              {/* Section Title End */}
            </div>
          </div>
        ) : null}

        <div className="row">
          <div className="ec-test-outer" style={{ width: "100%" }}>
            <ul
              style={{
                textAlign: "center",
                listStyle: "none",
                padding: "27px 0",
                margin: 0,
                width: "100%",
              }}
            >
              {/* Testimonial Item Start */}
              <li className="ec-test-item">
                <i
                  className="ecicon eci-quote-right fi-rr-quote-right top"
                  aria-hidden="true"
                ></i>
                <div className="ec-test-inner">
                  <div className="ec-test-img">
                    <img
                      alt={item.author}
                      title={item.author}
                      src={item.avatar || fallbackAvatar(active)}
                    />
                  </div>
                  <div className="ec-test-content">
                    <div className="ec-test-desc">{item.quote}</div>
                    <div className="ec-test-name">{item.author}</div>
                    {item.role ? (
                      <div className="ec-test-designation">{item.role}</div>
                    ) : null}
                    <div className="ec-test-rating">
                      <Stars count={starCount(item.rating)} />
                    </div>
                  </div>
                </div>
                <i
                  className="ecicon eci-quote-right fi-rr-quote-right bottom"
                  aria-hidden="true"
                ></i>
              </li>
              {/* Testimonial Item End */}
            </ul>

            {items.length > 1 ? (
              /* Avatar dots — reuse the template's slick-dots styling */
              <ul className="slick-dots" role="tablist">
                {items.map((entry, i) => (
                  <li
                    key={i}
                    className={i === active ? "slick-active" : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Show testimonial from ${entry.author}`}
                      aria-current={i === active ? "true" : undefined}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={entry.avatar || fallbackAvatar(i)}
                        alt={entry.author}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Testimonials
