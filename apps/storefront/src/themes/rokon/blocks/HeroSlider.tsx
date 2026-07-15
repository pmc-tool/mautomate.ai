"use client"

import { Fragment, useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the hero_slider CMS block (template               */
/* "hero__slider--section slider__section--bg" from index.html).        */
/* Receives the SAME resolved block data as the Cignet/Learts           */
/* renderers — the spread prop bag from the storefront SectionRenderer  */
/* (`<HeroSlider {...block} />`), so it also carries block_type /       */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The template's Swiper carousel is reimplemented as a React           */
/* crossfade: every slide is a full `.hero__slider--items` layer        */
/* stacked on one CSS grid cell; the active layer additionally carries  */
/* the template's `swiper-slide-active` class so its entrance           */
/* animations (fadeInUp + thumbnail scale) still fire from style.css.   */
/* The glightbox video play button is dropped (no template JS).         */
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

/* Template slide photos, cycled when a slide has no image of its own. */
const DEFAULT_IMAGES = [
  "/rokon/img/slider/home1-slider-thumbnail.webp",
  "/rokon/img/slider/home1-slider-thumbnail2.webp",
  "/rokon/img/slider/home1-slider-thumbnail3.webp",
  "/rokon/img/slider/home1-slider-thumbnail4.webp",
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
    <section className="hero__slider--section slider__section--bg">
      <div
        className="hero__slider--inner position__relative"
        style={{ display: "grid" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            data-el-item={`slides:${i}`}
            className={
              i === active
                ? "hero__slider--items swiper-slide-active"
                : "hero__slider--items"
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
            <div className="container">
              <div className="row">
                <div className="col-12">
                  <div className="hero__slider--thumbnail">
                    <img
                      data-el="image"
                      className="hero__slider--thumbnail__img display-block"
                      src={
                        slide.image ||
                        DEFAULT_IMAGES[i % DEFAULT_IMAGES.length]
                      }
                      alt={slide.title}
                    />
                  </div>
                  <div className="slider__content text-center">
                    {slide.subtitle ? (
                      <span
                        data-el="kicker"
                        className="slider__content--subtitle"
                        style={{
                          display: "block",
                          marginBottom: "10px",
                          fontSize: "14px",
                          fontWeight: 600,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          color: "var(--secondary-color, #f14705)",
                        }}
                      >
                        {slide.subtitle}
                      </span>
                    ) : null}
                    <h2 data-el="title" className="slider__content--maintitle h1">
                      {renderTitle(slide.title)}
                    </h2>
                    {slide.text ? (
                      <p className="slider__content--desc d-sm-2-none">
                        {slide.text}
                      </p>
                    ) : null}
                    <div className="slider__content--footer d-flex align-items-center justify-content-center">
                      <LocalizedClientLink
                        data-el="button"
                        className="slider__content--btn primary__btn"
                        href={slide.cta?.href || "/store"}
                      >
                        {slide.cta?.label || "Shop Now"}
                      </LocalizedClientLink>
                    </div>
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
              bottom: "23px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
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
                  width: i === active ? "26px" : "10px",
                  height: "10px",
                  padding: 0,
                  border: "none",
                  borderRadius: "100px",
                  cursor: "pointer",
                  background:
                    i === active
                      ? "var(--secondary-color, #f14705)"
                      : "rgba(35, 35, 35, 0.3)",
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
