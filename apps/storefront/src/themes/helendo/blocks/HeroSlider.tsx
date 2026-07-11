"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the hero_slider CMS block (template index.html  */
/* "Hero Slider Area": .hero-slider-one > .single-hero-slider-one).     */
/* Receives the SAME resolved block data as the Cignet renderer — the   */
/* spread prop bag from the storefront SectionRenderer                  */
/* (`<HeroSlider {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The template drove this with slick; here multiple slides crossfade   */
/* via a simple React autoplay (same state logic as Cignet): every      */
/* slide is a full `.single-hero-slider-one` layer stacked on one CSS   */
/* grid cell. The template set backgrounds via data-bg + jQuery — we    */
/* keep the `bg-img` class (style.css: cover/center !important) and set */
/* the image inline. `has-bg-image` is the bridge-sheet hook for the    */
/* legibility scrim; the active slide also gets `slick-current` so the  */
/* template's .slick-current .hero-text-one entrance animations fire.   */
/* Dots reuse the template's own `.hero-slider-one .slick-dots` styles. */
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
const DEFAULT_BG = "/helendo/images/hero/home-default-1.jpg"

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
    <div className="hero-box-area mt-md-0 mt-lg-3">
      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-12 pl-0 pl-lg-3 pr-0 pr-lg-3">
            {/* Hero Slider Area Start */}
            <div
              className="hero-area hero-slider-one"
              style={{ position: "relative", display: "grid" }}
            >
              {slides.map((slide, i) => (
                <div
                  key={i}
                  className={`single-hero-slider-one bg-img has-bg-image${
                    i === active ? " slick-current" : ""
                  }`}
                  style={{
                    gridArea: "1 / 1",
                    backgroundImage: `url(${slide.image || DEFAULT_BG})`,
                    opacity: i === active ? 1 : 0,
                    zIndex: i === active ? 1 : 0,
                    pointerEvents: i === active ? undefined : "none",
                    transition: "opacity 700ms ease",
                  }}
                  aria-hidden={i === active ? undefined : true}
                >
                  <div className="container" style={{ position: "relative" }}>
                    <div className="row">
                      <div className="col-lg-12">
                        <div className="hero-text-one">
                          {slide.subtitle ? (
                            <h6 className="text-color-primary mb-10">
                              {slide.subtitle}
                            </h6>
                          ) : null}
                          <h1 className="hero-title">
                            {renderTitle(slide.title)}
                          </h1>
                          {slide.text ? (
                            <p className="mt-30">{slide.text}</p>
                          ) : null}
                          <div className="button-box mt-30">
                            <LocalizedClientLink
                              href={slide.cta?.href || "/store"}
                              className="hero-btn-one btn"
                            >
                              {slide.cta?.label || "Shop now"}{" "}
                              <i className="icon-arrow-right" />
                            </LocalizedClientLink>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {slides.length > 1 ? (
                <ul className="slick-dots" style={{ zIndex: 2 }}>
                  {slides.map((_, i) => (
                    <li key={i} className={i === active ? "slick-active" : ""}>
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        aria-current={i === active ? "true" : undefined}
                        style={{ cursor: "pointer" }}
                      >
                        {i + 1}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {/* Hero Slider Area End */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HeroSlider
