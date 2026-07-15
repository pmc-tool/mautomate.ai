"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Shofy renderer for the deal_of_day CMS block, restyled as the        */
/* template's "product offer area" (.tp-product-offer grey band with a  */
/* tp-section-title header, a "View All Deals" button and a product     */
/* offer card carrying the .tp-product-countdown timer). Receives the   */
/* SAME resolved block data as the Learts/Cignet renderers — the        */
/* spread prop bag from the storefront SectionRenderer                  */
/* (`<DealOfDay {...block} />`), so it also carries block_type /        */
/* schema_version / countryCode / sectionScope which we simply ignore.  */
/* The countdown ticks in React (useEffect, 1s interval) to the         */
/* block's `countdown_to` ISO date — the template's jQuery countdown    */
/* plugin is NOT loaded; only its markup/classes are reused so the      */
/* template CSS styles the timer cells.                                 */
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

/* Template default — the index.html product offer photo (verified). */
const DEFAULT_IMAGE = "/shofy/img/product/offer/product-offer-1.jpg"

const pad = (n: number) => String(n).padStart(2, "0")

const BtnArrow = () => (
  <svg
    width="17"
    height="14"
    viewBox="0 0 17 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16 6.99976L1 6.99976"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.9502 0.975414L16.0002 6.99941L9.9502 13.0244"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
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

  const title = props.title || "Deal of The Day"
  const cta = props.cta

  return (
    <section className="tp-product-offer grey-bg-2 pt-70 pb-80">
      <div className="container">
        <div className="row align-items-end">
          <div className="col-xl-4 col-md-5 col-sm-6">
            <div className="tp-section-title-wrapper mb-40">
              <h3 data-el="title" className="tp-section-title">
                {title}{" "}
                <svg
                  width="114"
                  height="35"
                  viewBox="0 0 114 35"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M112 23.275C1.84952 -10.6834 -7.36586 1.48086 7.50443 32.9053"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeMiterlimit="3.8637"
                    strokeLinecap="round"
                  />
                </svg>
              </h3>
            </div>
          </div>
          {cta?.href ? (
            <div className="col-xl-8 col-md-7 col-sm-6">
              <div className="tp-product-offer-more-wrapper d-flex justify-content-sm-end p-relative z-index-1">
                <div className="tp-product-offer-more mb-40 text-sm-end grey-bg-2">
                  <LocalizedClientLink
                    data-el="button"
                    href={cta.href}
                    className="tp-btn tp-btn-2 tp-btn-blue"
                  >
                    {cta.label || "View All Deals"} <BtnArrow />
                  </LocalizedClientLink>
                  <span className="tp-product-offer-more-border"></span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="row align-items-center">
          <div className="col-lg-5 col-md-6">
            <div className="tp-product-offer-item tp-product-item transition-3">
              <div className="tp-product-thumb p-relative fix m-img">
                <LocalizedClientLink href={cta?.href || "/store"}>
                  <img src={props.image || DEFAULT_IMAGE} alt={title} />
                </LocalizedClientLink>
              </div>
            </div>
          </div>
          <div className="col-lg-7 col-md-6">
            <div className="tp-product-content">
              <h3 className="tp-product-title" style={{ fontSize: 24 }}>
                <LocalizedClientLink href={cta?.href || "/store"}>
                  {title}
                </LocalizedClientLink>
              </h3>
              {props.description ? (
                <p data-el="text" style={{ maxWidth: 560, marginTop: 10 }}>
                  {props.description}
                </p>
              ) : null}

              <div data-el="countdown" className="tp-product-countdown">
                <div className="tp-product-countdown-inner">
                  <ul>
                    <li>
                      <span>{pad(days)}</span> Days
                    </li>
                    <li>
                      <span>{pad(hours)}</span> Hrs
                    </li>
                    <li>
                      <span>{pad(minutes)}</span> Min
                    </li>
                    <li>
                      <span>{pad(seconds)}</span> Sec
                    </li>
                  </ul>
                </div>
              </div>

              {cta?.href ? (
                <div style={{ marginTop: 30 }}>
                  <LocalizedClientLink
                    data-el="button"
                    href={cta.href}
                    className="tp-btn tp-btn-2 tp-btn-blue"
                  >
                    {cta.label || "Shop Now"} <BtnArrow />
                  </LocalizedClientLink>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DealOfDay
