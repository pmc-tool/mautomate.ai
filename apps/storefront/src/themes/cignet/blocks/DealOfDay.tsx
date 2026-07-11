"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Cignet renderer for the deal_of_day CMS block, restyled as the       */
/* template's "Limited Offer" banner (.limited-offer-item-*). Receives  */
/* the SAME resolved block data as the Learts/Aurora renderers — the    */
/* spread prop bag from the storefront SectionRenderer                  */
/* (`<DealOfDay {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The countdown ticks in React (useEffect, 1s interval) to the block's */
/* `countdown_to` ISO date, exactly like Aurora's DealOfDay timer. The  */
/* template's limited-offer markup carries no countdown styles, so the  */
/* timer cells are styled inline against the banner's dark gradient.    */
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

const DEFAULT_IMAGE = "/cignet/images/limited-offer-image-1.jpg"

const pad = (n: number) => String(n).padStart(2, "0")

const Cell = ({ value, label }: { value: number; label: string }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 64,
    }}
  >
    <span
      style={{
        fontFamily: "var(--accent-font)",
        fontSize: 36,
        lineHeight: 1.2,
        color: "var(--white-color, #ffffff)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {pad(value)}
    </span>
    <span
      style={{
        marginTop: 4,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.2em",
        color: "rgba(255, 255, 255, 0.7)",
      }}
    >
      {label}
    </span>
  </div>
)

const Sep = () => (
  <span
    aria-hidden="true"
    style={{
      fontSize: 28,
      lineHeight: "44px",
      color: "rgba(255, 255, 255, 0.4)",
    }}
  >
    :
  </span>
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
    <div className="limited-offer" style={{ padding: "60px 0" }}>
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            {/* Limited Offer Item List Start */}
            <div className="limited-offer-item-list" style={{ marginTop: 0 }}>
              {/* Limited Offer Item Start */}
              <div
                className="limited-offer-item wow fadeInUp"
                style={{ width: "100%" }}
              >
                <div className="limited-offer-image">
                  <figure>
                    <img src={props.image || DEFAULT_IMAGE} alt={title} />
                  </figure>
                </div>
                <div className="limited-offer-item-body">
                  <div className="limited-offer-item-content">
                    <span>Limited Time Offer</span>
                    <h2>{title}</h2>
                    {props.description ? (
                      <p
                        style={{
                          maxWidth: 640,
                          margin: "20px auto 0",
                          color: "rgba(255, 255, 255, 0.75)",
                        }}
                      >
                        {props.description}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="limited-offer-countdown"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      gap: 20,
                      marginTop: 30,
                    }}
                  >
                    <Cell value={days} label="Days" />
                    <Sep />
                    <Cell value={hours} label="Hours" />
                    <Sep />
                    <Cell value={minutes} label="Minutes" />
                    <Sep />
                    <Cell value={seconds} label="Seconds" />
                  </div>
                  {cta?.href ? (
                    <div className="limited-offer-btn">
                      <LocalizedClientLink
                        href={cta.href}
                        className="btn-default btn-highlighted"
                      >
                        {cta.label || "Shop Now"}
                      </LocalizedClientLink>
                    </div>
                  ) : null}
                </div>
              </div>
              {/* Limited Offer Item End */}
            </div>
            {/* Limited Offer Item List End */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealOfDay
