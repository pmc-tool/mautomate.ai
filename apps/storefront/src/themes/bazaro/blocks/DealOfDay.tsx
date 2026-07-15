"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Bazaro renderer for the deal_of_day CMS block, restyled as the       */
/* template's deals area (`aqf-deals-area`, index.html 4401-4835:       */
/* banner card + "Ends in" countdown on a #FAFAFA panel). Receives the  */
/* SAME resolved block data as the Cignet renderer — the spread prop    */
/* bag from the storefront SectionRenderer (`<DealOfDay {...block} />`),*/
/* so it also carries block_type / schema_version / countryCode /       */
/* sectionScope which we simply ignore. The template's jQuery countdown */
/* is reimplemented in React (useEffect, 1s interval) ticking to the    */
/* block's `countdown_to` ISO date, hydration-safe (starts blank until  */
/* mounted). Markup keeps the template's `aq-countdown-style-2` boxes.  */
/* ------------------------------------------------------------------ */

export interface DealOfDayCta {
  label?: string
  href: string
}

export interface DealOfDayData {
  image?: string
  title?: string
  description?: string
  countdown_to?: string
  cta?: DealOfDayCta
  [key: string]: unknown
}

const DEFAULT_IMAGE = "/bazaro/img/fashion-1/banner/banner-1.jpg"

const pad = (n: number) => String(n).padStart(2, "0")

const DealOfDay = (props: DealOfDayData) => {
  // Resolve the countdown target (ISO date). Fall back to 10 days out if the
  // configured value is missing/invalid so the timer never shows NaN.
  const target = useMemo(() => {
    const t = props.countdown_to ? Date.parse(props.countdown_to) : NaN
    return Number.isNaN(t) ? Date.now() + 10 * 24 * 60 * 60 * 1000 : t
  }, [props.countdown_to])

  // Avoid a server/client hydration mismatch: start at null, fill in after mount.
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    setRemaining(target - Date.now())
    const id = setInterval(() => setRemaining(target - Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  const clamped = Math.max(0, remaining ?? 0)
  const days = Math.floor(clamped / (24 * 60 * 60 * 1000))
  const hours = Math.floor((clamped / (60 * 60 * 1000)) % 24)
  const minutes = Math.floor((clamped / (60 * 1000)) % 60)
  const seconds = Math.floor((clamped / 1000) % 60)

  const title = props.title || "Deal of the day"
  const cta = props.cta

  const cells: Array<{ value: number; label: string; sep: boolean }> = [
    { value: days, label: "Days", sep: true },
    { value: hours, label: "Hours", sep: true },
    { value: minutes, label: "Minutes", sep: true },
    { value: seconds, label: "Seconds", sep: false },
  ]

  return (
    <div className="aqf-deals-area pt-60 pb-60 bazaro-deal-of-day">
      <div className="container">
        <div className="aqf-deals-wrap" style={{ backgroundColor: "#FAFAFA" }}>
          <div className="row align-items-center">
            <div className="col-xl-5 col-lg-6">
              <div className="aqf-deals-banner-wrap p-relative mr-30">
                <div className="aqf-deals-banner-thumb">
                  <img className="w-100" src={props.image || DEFAULT_IMAGE} alt={title} />
                </div>
                {cta?.href ? (
                  <div className="aqf-deals-banner-btn">
                    <LocalizedClientLink
                      className="aq-btn-black blur-bg w-100 text-center"
                      href={cta.href}
                    >
                      {cta.label || "Shop Now"}
                    </LocalizedClientLink>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="col-xl-7 col-lg-6">
              <div className="aqf-deals-slider-main pt-60 pb-60">
                <div data-el="countdown" className="aqf-deals-countbox d-flex align-items-center mb-25">
                  <div className="aq-countdown-text mr-20">
                    <span>Ends in</span>
                  </div>
                  <div className="aq-countdown-style-2 d-inline-flex align-items-center">
                    {cells.map((cell) => (
                      <div className="count-box" key={cell.label}>
                        <span aria-label={cell.label}>
                          {remaining === null ? "--" : pad(cell.value)}
                        </span>
                        {cell.sep ? <i>:</i> : null}
                      </div>
                    ))}
                  </div>
                </div>
                <h4 data-el="title" className="aq-section-title ff-satoshi-med fs-38 mb-15">
                  {title}
                </h4>
                {props.description ? (
                  <p data-el="text" className="mb-30" style={{ maxWidth: 480 }}>
                    {props.description}
                  </p>
                ) : null}
                {cta?.href ? (
                  <LocalizedClientLink data-el="button" className="aq-btn-black" href={cta.href}>
                    {cta.label || "Shop Now"}
                  </LocalizedClientLink>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealOfDay
