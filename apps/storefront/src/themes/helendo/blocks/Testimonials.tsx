"use client"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the Testimonials CMS block. The template ships  */
/* NO testimonial section, so this composes one from Helendo's design   */
/* language: the standard section heading                               */
/* (h2.section-title--one.section-title--center), a centered            */
/* blockquote-style card (Roboto italic quote, gold #dcb14a stars using */
/* the template's own `.product-rating` + `icon_star` icon-font         */
/* classes, name in the template's h6.sub-heading style). Consumes the  */
/* SAME resolved block-data prop bag as the Cignet version              */
/* (`<Testimonials {...block} />`), so it also carries block_type /     */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is       */
/* always an array (may be empty => the whole block renders null).      */
/* `role` / `avatar` are optional per item (no template author photos   */
/* exist, so no avatar => none rendered). An optional `rating` per item */
/* (1..5, default 5) drives the stars. Client component: same React     */
/* prev/next carousel behavior as Cignet (one quote at a time, no       */
/* slider JS), with the template's icon-arrow-left/right glyphs as the  */
/* nav controls.                                                        */
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

function Stars({ count }: { count: number }) {
  return (
    <div
      className="product-rating d-flex"
      style={{ justifyContent: "center", color: "#dcb14a", fontSize: "16px" }}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <i className="icon_star" key={i} />
      ))}
    </div>
  )
}

const arrowStyle = {
  background: "transparent",
  border: "1px solid #ededed",
  width: "44px",
  height: "44px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#000000",
  fontSize: "16px",
} as const

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
    <div className="helendo-testimonials-area section-space--ptb_120">
      <div className="container">
        {props.title ? (
          <div className="row">
            <div className="col-lg-12">
              <div className="section-title text-center mb-20">
                <h2 className="section-title--one section-title--center">
                  {props.title}
                </h2>
              </div>
            </div>
          </div>
        ) : null}

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="text-center mt-30">
              <Stars count={starCount(item.rating)} />
              <blockquote
                style={{
                  margin: "30px 0 0",
                  fontFamily: '"Roboto", sans-serif',
                  fontStyle: "italic",
                  fontSize: "18px",
                  lineHeight: 1.8,
                  color: "#666666",
                }}
              >
                {item.quote}
              </blockquote>
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt={item.author}
                  style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    marginTop: "30px",
                  }}
                />
              ) : null}
              <h6
                className="sub-heading"
                style={{
                  marginTop: item.avatar ? "15px" : "30px",
                  marginBottom: 0,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#000000",
                }}
              >
                {item.author}
              </h6>
              {item.role ? (
                <p style={{ marginTop: "5px", color: "#999999" }}>
                  {item.role}
                </p>
              ) : null}

              {items.length > 1 ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "10px",
                    marginTop: "30px",
                  }}
                >
                  <button
                    type="button"
                    aria-label="Previous testimonial"
                    onClick={prev}
                    style={arrowStyle}
                  >
                    <i className="icon-arrow-left" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next testimonial"
                    onClick={next}
                    style={arrowStyle}
                  >
                    <i className="icon-arrow-right" />
                  </button>
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
