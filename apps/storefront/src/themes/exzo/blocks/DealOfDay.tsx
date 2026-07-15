"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Exzo renderer for the deal_of_day CMS block, restyled as the         */
/* template's "special offers / choose the best" slide (index1.html:    */
/* .row.vertical-aligned-columns with a .block-image.rounded-image      */
/* photo, h3.h3 headline, the .countdown strip and pill buttons).       */
/* Receives the SAME resolved block data as the Learts/Cignet renderers */
/* — the spread prop bag from the storefront SectionRenderer            */
/* (`<DealOfDay {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The countdown ticks in React (useEffect, 1s interval) to the block's */
/* `countdown_to` ISO date, exactly like the Cignet timer. The          */
/* template's ClassyCountdown canvas knobs are NOT ported (that is      */
/* template JS): the digits render as pure CSS circles in the Exzo      */
/* typography (Raleway 900 uppercase, lime #b8cd06 ring).               */
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

const DEFAULT_IMAGE = "/exzo/img/thumbnail-24.jpg"

const pad = (n: number) => String(n).padStart(2, "0")

const Cell = ({ value, label }: { value: number; label: string }) => (
  <div style={{ flex: "1 1 0", maxWidth: 90, textAlign: "center" }}>
    <div
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        border: "3px solid #b8cd06",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 8px",
        background: "#fff",
      }}
    >
      <span
        style={{
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 900,
          fontSize: 22,
          lineHeight: 1,
          color: "#343434",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pad(value)}
      </span>
    </div>
    <div className="simple-article size-1 uppercase">{label}</div>
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
    <div className="exzo-deal-of-day">
      <div className="container">
        <div className="row vertical-aligned-columns">
          <div className="col-sm-6 col-xs-b30 col-sm-b0">
            <img
              src={props.image || DEFAULT_IMAGE}
              className="block-image rounded-image"
              alt={title}
            />
          </div>
          <div className="col-sm-6 col-md-5 col-md-offset-1">
            <div className="simple-article size-3 grey uppercase col-xs-b5">
              Limited time offer
            </div>
            <h3 data-el="title" className="h3 col-xs-b15">
              {title}
            </h3>
            <div
              data-el="countdown"
              className="countdown max-width col-xs-b20"
              style={{ display: "flex", gap: 10 }}
            >
              <Cell value={days} label="Days" />
              <Cell value={hours} label="Hours" />
              <Cell value={minutes} label="Min" />
              <Cell value={seconds} label="Sec" />
            </div>
            {props.description ? (
              <div
                data-el="text"
                className="simple-article size-3 col-xs-b30"
              >
                {props.description}
              </div>
            ) : null}
            {cta?.href ? (
              <div className="buttons-wrapper">
                <LocalizedClientLink
                  data-el="button"
                  href={cta.href}
                  className="button size-2 style-3"
                >
                  <span className="button-wrapper">
                    <span className="icon">
                      <img src="/exzo/img/icon-4.png" alt="" />
                    </span>
                    <span className="text">{cta.label || "Shop Now"}</span>
                  </span>
                </LocalizedClientLink>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealOfDay
