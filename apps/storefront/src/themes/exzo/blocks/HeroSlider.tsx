"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the hero_slider CMS block (template home slider:   */
/* .slider-wrapper > .swiper-container > .swiper-slide with a full      */
/* background image, .simple-article light transparent subtitle,        */
/* h1.h1.light headline, .title-underline.light.left and pill buttons). */
/* Receives the SAME resolved block data as the Learts/Cignet renderers */
/* — the spread prop bag from the storefront SectionRenderer            */
/* (`<HeroSlider {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The template's Swiper carousel is reimplemented as a simple React    */
/* autoplay crossfade: every slide is a full `.swiper-slide` layer      */
/* stacked on one CSS grid cell (the flex layout Swiper's CSS applies   */
/* to .swiper-wrapper is overridden inline) so the tallest slide        */
/* defines the section height. Arrows and bullets reuse the template's  */
/* .swiper-button-* / .swiper-pagination-bullet styling with onClick.   */
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

/* Template defaults — the index1.html slider backgrounds (cycled). */
const FALLBACK_BGS = [
  "/exzo/img/background-1.jpg",
  "/exzo/img/background-2.jpg",
  "/exzo/img/background-3.jpg",
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

  const current = Math.min(active, slides.length - 1)
  const prev = () =>
    setActive((current + slides.length - 1) % slides.length)
  const next = () => setActive((current + 1) % slides.length)

  return (
    <div className="slider-wrapper exzo-hero" style={{ position: "relative" }}>
      {slides.length > 1 ? (
        <>
          <button
            type="button"
            className="swiper-button-prev visible-lg"
            aria-label="Previous slide"
            onClick={prev}
            style={{ border: "none", padding: 0 }}
          />
          <button
            type="button"
            className="swiper-button-next visible-lg"
            aria-label="Next slide"
            onClick={next}
            style={{ border: "none", padding: 0 }}
          />
        </>
      ) : null}

      <div className="swiper-container swiper-container-horizontal">
        <div
          className="swiper-wrapper"
          style={{ display: "grid", cursor: "auto", transform: "none" }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="swiper-slide"
              style={{
                gridArea: "1 / 1",
                width: "100%",
                backgroundImage: `url(${
                  slide.image || FALLBACK_BGS[i % FALLBACK_BGS.length]
                })`,
                backgroundSize: "cover",
                backgroundPosition: "center center",
                opacity: i === current ? 1 : 0,
                zIndex: i === current ? 1 : 0,
                pointerEvents: i === current ? undefined : "none",
                transition: "opacity 700ms ease",
              }}
              aria-hidden={i === current ? undefined : true}
            >
              <div className="container">
                <div className="row">
                  <div className="col-sm-8">
                    <div className="cell-view page-height">
                      <div className="col-xs-b40 col-sm-b80"></div>
                      {slide.subtitle ? (
                        <div>
                          <div className="simple-article light transparent size-3">
                            {slide.subtitle}
                          </div>
                          <div className="col-xs-b5"></div>
                        </div>
                      ) : null}
                      <h1 className="h1 light">{renderTitle(slide.title)}</h1>
                      <div className="title-underline light left">
                        <span></span>
                      </div>
                      {slide.text ? (
                        <div>
                          <div className="simple-article size-4 light transparent">
                            <p>{slide.text}</p>
                          </div>
                          <div className="col-xs-b30"></div>
                        </div>
                      ) : null}
                      <div className="buttons-wrapper">
                        <LocalizedClientLink
                          href={slide.cta?.href || "/store"}
                          className="button size-2 style-1"
                        >
                          <span className="button-wrapper">
                            <span className="icon">
                              <img src="/exzo/img/icon-1.png" alt="" />
                            </span>
                            <span className="text">
                              {slide.cta?.label || "Shop now"}
                            </span>
                          </span>
                        </LocalizedClientLink>
                      </div>
                      <div className="col-xs-b40 col-sm-b80"></div>
                    </div>
                  </div>
                </div>
                <div className="empty-space col-xs-b80 col-sm-b0"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Bullets are spans (not buttons): swiper.css strips borders off
            button bullets, which would make the dots invisible. */}
        {slides.length > 1 ? (
          <div className="swiper-pagination swiper-pagination-white swiper-pagination-bullets swiper-pagination-clickable">
            {slides.map((_, i) => (
              <span
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setActive(i)
                  }
                }}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                className={
                  i === current
                    ? "swiper-pagination-bullet swiper-pagination-bullet-active"
                    : "swiper-pagination-bullet"
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default HeroSlider
