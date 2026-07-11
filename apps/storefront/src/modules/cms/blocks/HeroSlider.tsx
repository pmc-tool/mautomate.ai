"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend hero_slider resolved schema).  */
/* Received as the spread prop bag from the storefront SectionRenderer */
/* (`<HeroSlider {...block} />`), so it also carries block_type /      */
/* schema_version which we simply ignore.                              */
/* ------------------------------------------------------------------ */

export interface HeroSlideCta {
  label?: string
  href: string
}

export interface HeroSlide {
  image: string
  subtitle?: string
  title: string
  cta: HeroSlideCta
}

export interface HeroSliderData {
  autoplay_ms?: number
  slides?: HeroSlide[]
  [key: string]: unknown
}

const DEFAULT_AUTOPLAY_MS = 5000

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

  const go = (dir: number) =>
    setActive((a) => (a + dir + slides.length) % slides.length)

  return (
    <div className="section section-fluid bg-white learts-theme">
      <div className="container-fluid">
        {/* Height comes from the Learts stylesheet: .home3-slider is 600px with
            the original responsive ladder (1199px:450, 991px:350, 767px:300,
            575px:250, 479px:200). An inline height here would beat those media
            queries and break the theme's mobile behavior — do not re-add one. */}
        <div className="home3-slider learts-hero">
          {slides.map((slide, i) => (
            <div
              key={i}
              data-el="image"
              className={`slide ${i === active ? "active" : ""}`}
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              <div className="container slide-inner">
                <div className="home3-slide-content">
                  {slide.subtitle ? (
                    <h5 data-el="kicker" className="sub-title">
                      {slide.subtitle}
                    </h5>
                  ) : null}
                  <h2 data-el="title" className="title">
                    {renderTitle(slide.title)}
                  </h2>
                  {slide.cta?.href ? (
                    <div className="link">
                      <LocalizedClientLink
                        href={slide.cta.href}
                        data-el="button"
                        className="btn btn-black btn-hover-primary"
                      >
                        {slide.cta.label || "shop now"}
                      </LocalizedClientLink>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {slides.length > 1 ? (
            <>
              <button
                type="button"
                className="home3-slider-prev swiper-button-prev"
                onClick={() => go(-1)}
                aria-label="Previous slide"
              >
                <i className="ti-angle-left" />
              </button>
              <button
                type="button"
                className="home3-slider-next swiper-button-next"
                onClick={() => go(1)}
                aria-label="Next slide"
              >
                <i className="ti-angle-right" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default HeroSlider
