"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Helendo renderer for the deal_of_day CMS block: the template's       */
/* "Offer Collection" countdown band (index.html .offer-colection-area  */
/* — the template really spells it "colection"). Receives the SAME      */
/* resolved block data as the Cignet renderer — the spread prop bag     */
/* from the storefront SectionRenderer (`<DealOfDay {...block} />`),    */
/* so it also carries block_type / schema_version / countryCode /       */
/* sectionScope which we simply ignore. The countdown ticks in React    */
/* (useEffect, 1s interval) to the block's `countdown_to` ISO date,     */
/* exactly like the Cignet timer. Markup per unit is the template's own */
/* .single-countdown DOM (what main.js rendered via jQuery countdown),  */
/* so style.css's .countdown-deals.counter-style--one rules apply       */
/* untouched. The template set the band background via data-bg +        */
/* jQuery; we keep `bg-img` (cover/center via style.css) and set the    */
/* image inline. An optional `highlight` string renders in the          */
/* template's <span class="text-red"> next to the title.                */
/* ------------------------------------------------------------------ */

export interface DealOfDayCta {
  label?: string
  href: string
}

export interface DealOfDayData {
  image?: string
  title?: string
  highlight?: string
  description?: string
  countdown_to?: string
  cta?: DealOfDayCta
  [key: string]: unknown
}

const DEFAULT_BG = "/helendo/images/bg/h1-countdown.jpg"

const pad = (n: number) => String(n).padStart(2, "0")

/* The exact per-unit DOM the template's main.js countdown rendered. */
const Unit = ({ value, label }: { value: number; label: string }) => (
  <div className="single-countdown">
    <span className="single-countdown__time">{pad(value)}</span>
    <span className="single-countdown__text">{label}</span>
  </div>
)

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

  return (
    <div className="offer-colection-area container-fluid">
      <div
        className="section-space--ptb_120 bg-img"
        style={{ backgroundImage: `url(${props.image || DEFAULT_BG})` }}
      >
        <div className="row">
          <div className="container">
            <div className="row pl-md-0 pl-3 pr-md-0 pr-3">
              <div className="col-lg-7 col-md-7">
                <div className="colection-info-wrap">
                  <div className="section-title mb-30">
                    <h2 className="section-title--one">
                      {title}
                      {props.highlight ? (
                        <>
                          {" "}
                          <span className="text-red">{props.highlight}</span>
                        </>
                      ) : null}
                    </h2>
                  </div>

                  {props.description ? <p>{props.description}</p> : null}

                  <div className="timer text-center section-space--mt_60">
                    {/* countdown start */}
                    <div className="countdown-deals counter-style--one">
                      <Unit value={days} label="Days" />
                      <Unit value={hours} label="Hours" />
                      <Unit value={minutes} label="Mints" />
                      <Unit value={seconds} label="Secs" />
                    </div>
                    {/* countdown end */}
                  </div>

                  {cta?.href ? (
                    <div className="button-box section-space--mt_60">
                      <LocalizedClientLink
                        href={cta.href}
                        className="btn--md btn--black btn"
                      >
                        {cta.label || "Shop now"}{" "}
                        <i className="icon-arrow-right" />
                      </LocalizedClientLink>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealOfDay
