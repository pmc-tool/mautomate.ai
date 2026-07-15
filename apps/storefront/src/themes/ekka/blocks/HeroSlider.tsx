"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the hero_slider CMS block (template "Main Slider": */
/* .ec-main-slider > .ec-slide-item full-height background slides with  */
/* .ec-slide-content copy). Receives the SAME resolved block data as    */
/* the Learts/Aurora/Cignet renderers — the spread prop bag from the    */
/* storefront SectionRenderer (`<HeroSlider {...block} />`), so it also */
/* carries block_type / schema_version / countryCode / sectionScope     */
/* which we simply ignore. The template's Swiper carousel is dropped:   */
/* slides crossfade via a simple React autoplay (same hooks/state as    */
/* the Cignet HeroSlider); each slide is a full `.ec-slide-item` layer  */
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
/* The template's own main-slider backdrops, cycled per slide index. */
const DEFAULT_BGS = [
  "/ekka/images/main-slider-banner/1.jpg",
  "/ekka/images/main-slider-banner/2.jpg",
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

  return (
    <div className="sticky-header-next-sec ec-main-slider section section-space-pb">
      <div
        className="ec-slider"
        style={{ position: "relative", display: "grid" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-el="image"
            data-el-item={`slides:${i}`}
            className="ec-slide-item d-flex"
            style={{
              gridArea: "1 / 1",
              backgroundImage: `url(${
                slide.image || DEFAULT_BGS[i % DEFAULT_BGS.length]
              })`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === active ? 1 : 0,
              zIndex: i === active ? 1 : 0,
              pointerEvents: i === active ? undefined : "none",
              transition: "opacity 700ms ease",
            }}
            aria-hidden={i === active ? undefined : true}
          >
            <div className="container align-self-center">
              <div className="row">
                <div className="col-xl-6 col-lg-7 col-md-7 col-sm-7 align-self-center">
                  {/* Slide Content Start */}
                  <div className="ec-slide-content">
                    <h1 data-el="title" className="ec-slide-title">
                      {renderTitle(slide.title)}
                    </h1>
                    {slide.subtitle ? (
                      <h2 data-el="kicker" className="ec-slide-stitle">
                        {slide.subtitle}
                      </h2>
                    ) : null}
                    {slide.text ? <p>{slide.text}</p> : null}
                    <LocalizedClientLink
                      href={slide.cta?.href || "/store"}
                      data-el="button"
                      className="btn btn-lg btn-secondary"
                    >
                      {slide.cta?.label || "Order Now"}
                    </LocalizedClientLink>
                  </div>
                  {/* Slide Content End */}
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
                  width: 14,
                  height: 14,
                  padding: 0,
                  border: "1px solid #000000",
                  borderRadius: "100%",
                  cursor: "pointer",
                  background: i === active ? "#444444" : "transparent",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default HeroSlider
