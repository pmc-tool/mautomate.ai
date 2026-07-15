"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the hero_slider CMS block (template "Hero        */
/* Section": .hero background image + .hero-content). Receives the      */
/* SAME resolved block data as the Learts/Aurora renderers — the spread */
/* prop bag from the storefront SectionRenderer                         */
/* (`<HeroSlider {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* Multiple slides crossfade via a simple React autoplay (no Swiper);   */
/* each slide is a full `.hero` layer stacked on one CSS grid cell so   */
/* the tallest slide defines the section height.                        */
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
const DEFAULT_BG = "/cignet/images/hero-bg-image.jpg"

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
    <div
      className="hero-slider"
      style={{ position: "relative", display: "grid" }}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          data-el="image"
          data-el-item={`slides:${i}`}
          className="hero dark-section"
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
          <div className="container">
            <div className="row">
              <div className="col-xl-7">
                {/* Hero Content Start */}
                <div className="hero-content">
                  {/* Section Title Start */}
                  <div className="section-title">
                    {slide.subtitle ? (
                      <span data-el="kicker" className="section-sub-title wow fadeInUp">
                        {slide.subtitle}
                      </span>
                    ) : null}
                    <h1 data-el="title" className="text-anime-style-3">
                      {renderTitle(slide.title)}
                    </h1>
                    {slide.text ? (
                      <p className="wow fadeInUp">{slide.text}</p>
                    ) : null}
                  </div>
                  {/* Section Title End */}

                  {/* Hero Content Body Start */}
                  <div className="hero-content-body wow fadeInUp">
                    {/* Hero Button Start */}
                    <div className="hero-btn">
                      <LocalizedClientLink
                        data-el="button"
                        href={slide.cta?.href || "/store"}
                        className="btn-default btn-highlighted"
                      >
                        {slide.cta?.label || "Explore Collection"}
                      </LocalizedClientLink>
                    </div>
                    {/* Hero Button End */}
                  </div>
                  {/* Hero Content Body End */}
                </div>
                {/* Hero Content End */}
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
                  i === active
                    ? "var(--white-color, #ffffff)"
                    : "rgba(255, 255, 255, 0.4)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default HeroSlider
