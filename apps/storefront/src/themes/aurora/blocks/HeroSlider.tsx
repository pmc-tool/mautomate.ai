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
    <section className="aurora-theme bg-white font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="relative h-[440px] sm:h-[520px] md:h-[640px]">
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                  i === active
                    ? "opacity-100 z-10"
                    : "opacity-0 z-0 pointer-events-none"
                }`}
                aria-hidden={i === active ? undefined : true}
              >
                <img
                  src={slide.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/55 to-transparent" />
                <div className="relative z-10 flex h-full items-center">
                  <div className="max-w-2xl px-6 sm:px-10 md:px-16">
                    {slide.subtitle ? (
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                        {slide.subtitle}
                      </p>
                    ) : null}
                    <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight text-neutral-900">
                      {renderTitle(slide.title)}
                    </h2>
                    {slide.cta?.href ? (
                      <div className="mt-8">
                        <LocalizedClientLink
                          href={slide.cta.href}
                          className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700 transition"
                        >
                          {slide.cta.label || "Shop now"}
                          <svg
                            className="ml-2 h-4 w-4 stroke-current"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                            />
                          </svg>
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
                  onClick={() => go(-1)}
                  aria-label="Previous slide"
                  className="absolute left-4 top-1/2 z-20 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-900 shadow-sm hover:bg-white transition"
                >
                  <svg
                    className="h-4 w-4 stroke-current"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next slide"
                  className="absolute right-4 top-1/2 z-20 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-900 shadow-sm hover:bg-white transition"
                >
                  <svg
                    className="h-4 w-4 stroke-current"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>

                <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === active ? "true" : undefined}
                      className={`h-2 rounded-full transition-all ${
                        i === active
                          ? "w-6 bg-neutral-900"
                          : "w-2 bg-neutral-300 hover:bg-neutral-400"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSlider
