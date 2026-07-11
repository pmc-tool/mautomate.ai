"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Compiled block data (mirrors backend deal_of_day resolved schema).  */
/* Received as the spread prop bag from the storefront SectionRenderer */
/* (`<DealOfDay {...block} />`), so it also carries block_type /       */
/* schema_version which we simply ignore.                              */
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

const Cell = ({ value, label }: { value: number; label: string }) => (
  <div className="countdown-section" style={{ textAlign: "center" }}>
    <span
      className="countdown-amount"
      style={{ fontSize: 34, fontWeight: 600, display: "block" }}
    >
      {pad(value)}
    </span>
    <span
      className="countdown-period"
      style={{ textTransform: "uppercase", fontSize: 12, color: "#888" }}
    >
      {label}
    </span>
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
    <div className="section section-fluid section-padding learts-theme">
      <div className="container">
        <div className="row align-items-center learts-mb-n30">
          <div className="col-lg-6 col-12 learts-mb-30">
            <div className="product-deal-image text-center">
              {props.image ? (
                <img src={props.image} alt={title} />
              ) : null}
            </div>
          </div>
          <div className="col-lg-6 col-12 learts-mb-30">
            <div className="product-deal-content">
              <h2 className="title" data-el="title">
                {title}
              </h2>
              {props.description ? (
                <div className="desc" data-el="text">
                  <p>{props.description}</p>
                </div>
              ) : null}
              <div
                className="countdown1"
                data-el="countdown"
                style={{
                  display: "flex",
                  gap: 30,
                  margin: "25px 0 30px",
                }}
              >
                <Cell value={days} label="Days" />
                <Cell value={hours} label="Hours" />
                <Cell value={minutes} label="Minutes" />
                <Cell value={seconds} label="Seconds" />
              </div>
              {cta?.href ? (
                <LocalizedClientLink
                  href={cta.href}
                  className="btn btn-dark btn-hover-primary"
                  data-el="button"
                >
                  {cta.label || "Shop Now"}
                </LocalizedClientLink>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealOfDay
