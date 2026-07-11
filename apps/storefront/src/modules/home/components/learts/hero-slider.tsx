"use client"

import { useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SLIDES = [
  {
    image: "/learts/assets/images/slider/home3/slide-1.webp",
    sub: "Handicraft shop",
    title: (
      <>
        Inspired by Your <br />
        Sweetest Dreams
      </>
    ),
  },
  {
    image: "/learts/assets/images/slider/home3/slide-2.webp",
    sub: "Handicraft shop",
    title: (
      <>
        Daily Recipes <br />
        for Your Health
      </>
    ),
  },
  {
    image: "/learts/assets/images/slider/home3/slide-3.webp",
    sub: "Handicraft shop",
    title: (
      <>
        Decorative Box <br />
        for New Aspiration
      </>
    ),
  },
]

const HeroSlider = () => {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setActive((a) => (a + 1) % SLIDES.length),
      5000
    )
    return () => clearInterval(id)
  }, [])

  const go = (dir: number) =>
    setActive((a) => (a + dir + SLIDES.length) % SLIDES.length)

  return (
    <div className="section section-fluid bg-white learts-theme">
      <div className="container-fluid">
        <div
          className="home3-slider learts-hero"
          style={{ height: 700, maxHeight: "70vh" }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className={`slide ${i === active ? "active" : ""}`}
              style={{ backgroundImage: `url(${slide.image})` }}
            >
              <div className="container slide-inner">
                <div className="home3-slide-content">
                  <h5 className="sub-title">{slide.sub}</h5>
                  <h2 className="title">{slide.title}</h2>
                  <div className="link">
                    <LocalizedClientLink
                      href="/store"
                      className="btn btn-black btn-hover-primary"
                    >
                      shop now
                    </LocalizedClientLink>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
        </div>
      </div>
    </div>
  )
}

export default HeroSlider
