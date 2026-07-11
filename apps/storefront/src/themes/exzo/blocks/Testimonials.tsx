"use client"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the Testimonials CMS block: the template's         */
/* .icon-description-shortcode.style-2 review card (about1.html — the   */
/* .rounded-image thumbnail over a centered title + description) shown  */
/* one quote at a time inside a .slider-wrapper. Consumes the SAME      */
/* resolved block-data prop bag as the Learts/Cignet versions           */
/* (`<Testimonials {...block} />`), so it also carries block_type /     */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/*                                                                      */
/* `title` is OPTIONAL (absent / empty => no heading). `items` is       */
/* always an array (may be empty => the whole block renders null).      */
/* `role` / `avatar` are optional per item; avatars default to the      */
/* template's /exzo/img/thumbnail-3N.jpg portraits cycling by index.    */
/* Client component: the template's Swiper slider is reimplemented as   */
/* a simple React prev/next carousel (template arrow + bullet classes,  */
/* React state — no Swiper JS).                                         */
/* ------------------------------------------------------------------ */

import { useState } from "react"

export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  avatar?: string
  [key: string]: unknown
}

export interface TestimonialsData {
  title?: string
  items?: TestimonialItem[]
  [key: string]: unknown
}

/** Default portraits shipped with the template (cycled by index). */
function fallbackAvatar(index: number): string {
  return `/exzo/img/thumbnail-${35 + (index % 3)}.jpg`
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
    <div className="exzo-testimonials">
      <div className="container">
        {props.title ? (
          <div>
            <div className="text-center">
              <div className="simple-article size-3 grey uppercase col-xs-b5">
                Testimonials
              </div>
              <div className="h2">{props.title}</div>
              <div className="title-underline center">
                <span></span>
              </div>
            </div>
            <div className="empty-space col-xs-b35 col-md-b70"></div>
          </div>
        ) : null}

        <div className="slider-wrapper" style={{ position: "relative" }}>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="swiper-button-prev style-1 hidden-xs"
                aria-label="Previous testimonial"
                onClick={prev}
                style={{ border: "none", padding: 0 }}
              />
              <button
                type="button"
                className="swiper-button-next style-1 hidden-xs"
                aria-label="Next testimonial"
                onClick={next}
                style={{ border: "none", padding: 0 }}
              />
            </>
          ) : null}

          <div className="swiper-container swiper-container-horizontal">
            <div
              className="swiper-wrapper"
              style={{ display: "block", cursor: "auto", transform: "none" }}
            >
              <div className="swiper-slide">
                <div
                  className="icon-description-shortcode style-2"
                  style={{ maxWidth: "770px", margin: "0 auto" }}
                >
                  <img
                    className="image-icon rounded-image"
                    src={avatar}
                    alt={item.author}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                  <div className="content">
                    {item.quote ? (
                      <div className="description simple-article size-3">
                        <p>&ldquo;{item.quote}&rdquo;</p>
                      </div>
                    ) : null}
                    <h6 className="title h6" style={{ marginBottom: 5 }}>
                      {item.author}
                    </h6>
                    {item.role ? (
                      <div className="simple-article size-1 grey uppercase">
                        {item.role}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {items.length > 1 ? (
              /* Spans (not buttons): swiper.css strips borders off button
                 bullets, which would make the dots invisible. */
              <div className="swiper-pagination relative-pagination swiper-pagination-bullets swiper-pagination-clickable">
                {items.map((_, i) => (
                  <span
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setIndex(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setIndex(i)
                      }
                    }}
                    aria-label={`Go to testimonial ${i + 1}`}
                    aria-current={i === active ? "true" : undefined}
                    className={
                      i === active
                        ? "swiper-pagination-bullet swiper-pagination-bullet-active"
                        : "swiper-pagination-bullet"
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Testimonials
