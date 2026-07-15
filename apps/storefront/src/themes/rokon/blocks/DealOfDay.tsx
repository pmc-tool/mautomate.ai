"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Rokon renderer for the deal_of_day CMS block: the template's         */
/* "deals__section deals__section--bg" band (index-2.html). Receives    */
/* the SAME resolved block data as the Cignet/Learts renderers — the    */
/* spread prop bag from the storefront SectionRenderer                  */
/* (`<DealOfDay {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The template's jQuery countdown plugin is reimplemented in React     */
/* (useEffect, 1s interval) ticking to the block's `countdown_to` ISO   */
/* date, emitting the exact `.deals__countdown .countdown__item`        */
/* number/text DOM the template CSS styles. When the block carries an   */
/* `image` it replaces the band's default background photo.             */
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

const pad = (n: number) => String(n).padStart(2, "0")

/* Template countdown cell: column-reverse, so the number comes FIRST in
 * the DOM and renders below the label — exactly what the plugin emitted. */
const Cell = ({ value, label }: { value: number; label: string }) => (
  <div className="countdown__item">
    <span className="countdown__number">{pad(value)}</span>
    <span className="countdown__text">{label}</span>
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
    <section
      className="deals__section deals__section--bg section--padding"
      style={
        props.image
          ? {
              backgroundImage: `url(${props.image})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      <div className="container">
        <div className="row">
          <div className="col-lg-6 col-md-8">
            <div className="deals__content">
              <h2
                data-el="title"
                className="deals__content--title text-white mb-20"
              >
                {title}
              </h2>
              {props.description ? (
                <p
                  data-el="text"
                  className="deals__content--desc text-white mb-20"
                >
                  {props.description}
                </p>
              ) : null}
              <div data-el="countdown" className="deals__countdown d-flex mb-50">
                <Cell value={days} label="Days" />
                <Cell value={hours} label="Hrs" />
                <Cell value={minutes} label="Min" />
                <Cell value={seconds} label="Sec" />
              </div>
              {cta?.href ? (
                <LocalizedClientLink
                  data-el="button"
                  className="deals__content--btn primary__btn"
                  href={cta.href}
                >
                  {cta.label || "Shop Now"}
                </LocalizedClientLink>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DealOfDay
