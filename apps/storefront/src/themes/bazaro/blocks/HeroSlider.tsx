"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the hero_slider CMS block (template               */
/* `aqf-slider-area`, index.html 2203-2268). Receives the SAME resolved  */
/* block data as the Cignet renderer — the spread prop bag from the      */
/* storefront SectionRenderer (`<HeroSlider {...block} />`), so it also  */
/* carries block_type / schema_version / countryCode / sectionScope      */
/* which we simply ignore. The template's Swiper is reimplemented as a   */
/* React autoplay crossfade: each slide is a full `aqf-slider-item`      */
/* layer stacked on one CSS grid cell so the tallest slide defines the   */
/* section height. The active layer keeps the template's                 */
/* `swiper-slide-active` class so main.css's fadeInUp content            */
/* animations replay on every slide change, and the dots reuse the       */
/* template's `aqf-slider-dot` / `swiper-pagination-bullet` styling.     */
/* ------------------------------------------------------------------ */

export interface HeroSlideCta {
  label?: string
  href: string
}

export interface HeroSlide {
  image?: string
  subtitle?: string
  title: string
  text?: string
  cta?: HeroSlideCta
}

export interface HeroSliderData {
  autoplay_ms?: number
  slides?: HeroSlide[]
  [key: string]: unknown
}

const DEFAULT_AUTOPLAY_MS = 5000
const DEFAULT_BG = "/bazaro/img/fashion-1/slider/slider-1.jpg"

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

const HeroSlider = (props: HeroSliderData) => {
  const slides = Array.isArray(props.slides) ? props.slides : []
  const autoplay =
    typeof props.autoplay_ms === "number" &&
    isFinite(props.autoplay_ms) &&
    props.autoplay_ms > 0
      ? props.autoplay_ms
      : DEFAULT_AUTOPLAY_MS

  const [active, setActive] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) {
      return
    }
    const id = setInterval(
      () => setActive((a) => (a + 1) % slides.length),
      autoplay
    )
    return () => clearInterval(id)
  }, [slides.length, autoplay])

  if (!slides.length) {
    return null
  }

  return (
    <div className="aqf-slider-area">
      <div
        className="aqf-slider-active p-relative"
        style={{ position: "relative", display: "grid", overflow: "hidden" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-el-item={`slides:${i}`}
            className={
              i === active ? "swiper-slide swiper-slide-active" : "swiper-slide"
            }
            style={{
              gridArea: "1 / 1",
              opacity: i === active ? 1 : 0,
              zIndex: i === active ? 1 : 0,
              pointerEvents: i === active ? undefined : "none",
              transition: "opacity 700ms ease",
            }}
            aria-hidden={i === active ? undefined : true}
          >
            <div className="aqf-slider-item p-relative">
              <div className="aqf-slider-thumb">
                <img
                  data-el="image"
                  className="w-100"
                  src={slide.image || DEFAULT_BG}
                  alt={slide.title}
                />
              </div>
              <div className="container">
                <div className="row align-items-center">
                  <div className="col-xl-6 col-lg-8 col-md-8">
                    <div className="aqf-slider-content text-center text-md-start z-index-1">
                      {slide.subtitle ? (
                        <span data-el="kicker" className="aq-section-subtitle ff-satoshi-reg mb-10">
                          {slide.subtitle}
                        </span>
                      ) : null}
                      <h3 data-el="title" className="aq-section-title ff-satoshi-reg mb-30">
                        {renderTitle(slide.title)}
                      </h3>
                      {slide.text ? <p className="mb-30">{slide.text}</p> : null}
                      <LocalizedClientLink
                        data-el="button"
                        className="aq-btn-black"
                        href={slide.cta?.href || "/store"}
                      >
                        {slide.cta?.label || "Shop Collection"}
                      </LocalizedClientLink>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {slides.length > 1 ? (
          <div className="aqf-slider-dot" style={{ zIndex: 2 }}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Go to slide ${i + 1}`}
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
  )
}

export default HeroSlider
