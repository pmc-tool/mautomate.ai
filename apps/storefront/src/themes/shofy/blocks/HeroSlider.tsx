"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the hero_slider CMS block (template "slider       */
/* area": .tp-slider-area / .tp-slider-item two-column slides with a    */
/* dark blue background and decorative shapes). Receives the SAME       */
/* resolved block data as the Learts/Cignet renderers — the spread      */
/* prop bag from the storefront SectionRenderer                         */
/* (`<HeroSlider {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The template's Swiper carousel is reimplemented as a simple React    */
/* autoplay crossfade: every slide is a full `.tp-slider-item` layer    */
/* stacked on one CSS grid cell so the tallest slide defines height.    */
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

/* Template defaults — the index.html slider product shots (verified). */
const FALLBACK_IMAGES = [
  "/shofy/img/slider/slider-img-1.png",
  "/shofy/img/slider/slider-img-2.png",
  "/shofy/img/slider/slider-img-3.png",
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

const ArrowIcon = () => (
  <svg
    width="17"
    height="14"
    viewBox="0 0 17 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16 6.99976L1 6.99976"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.9502 0.975414L16.0002 6.99941L9.9502 13.0244"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

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
    <section className="tp-slider-area p-relative z-index-1">
      <div
        className="tp-slider-active tp-slider-variation"
        style={{ position: "relative", display: "grid" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-el-item={`slides:${i}`}
            className="tp-slider-item tp-slider-height d-flex align-items-center green-dark-bg"
            style={{
              gridArea: "1 / 1",
              opacity: i === active ? 1 : 0,
              zIndex: i === active ? 1 : 0,
              pointerEvents: i === active ? undefined : "none",
              transition: "opacity 700ms ease",
            }}
            aria-hidden={i === active ? undefined : true}
          >
            <div className="tp-slider-shape">
              <img
                className="tp-slider-shape-1"
                src="/shofy/img/slider/shape/slider-shape-1.png"
                alt=""
              />
              <img
                className="tp-slider-shape-2"
                src="/shofy/img/slider/shape/slider-shape-2.png"
                alt=""
              />
              <img
                className="tp-slider-shape-3"
                src="/shofy/img/slider/shape/slider-shape-3.png"
                alt=""
              />
              <img
                className="tp-slider-shape-4"
                src="/shofy/img/slider/shape/slider-shape-4.png"
                alt=""
              />
            </div>
            <div className="container">
              <div className="row align-items-center">
                <div className="col-xl-5 col-lg-6 col-md-6">
                  <div className="tp-slider-content p-relative z-index-1">
                    {slide.subtitle ? (
                      <span data-el="kicker">{slide.subtitle}</span>
                    ) : null}
                    <h3 data-el="title" className="tp-slider-title">
                      {renderTitle(slide.title)}
                    </h3>
                    {slide.text ? <p>{slide.text}</p> : null}

                    <div className="tp-slider-btn">
                      <LocalizedClientLink
                        data-el="button"
                        href={slide.cta?.href || "/store"}
                        className="tp-btn tp-btn-2 tp-btn-white"
                      >
                        {slide.cta?.label || "Shop Now"} <ArrowIcon />
                      </LocalizedClientLink>
                    </div>
                  </div>
                </div>
                <div className="col-xl-7 col-lg-6 col-md-6">
                  <div className="tp-slider-thumb text-end">
                    <img
                      data-el="image"
                      src={
                        slide.image ||
                        FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]
                      }
                      alt={slide.title}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {slides.length > 1 ? (
          <div
            style={{
              position: "absolute",
              bottom: 30,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 2,
            }}
          >
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                style={{
                  width: i === active ? 26 : 10,
                  height: 10,
                  padding: 0,
                  border: "none",
                  borderRadius: 100,
                  cursor: "pointer",
                  background:
                    i === active ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default HeroSlider
