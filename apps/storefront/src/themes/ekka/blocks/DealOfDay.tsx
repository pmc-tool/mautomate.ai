"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/* ------------------------------------------------------------------ */
/* Ekka renderer for the deal_of_day CMS block, restyled as the         */
/* template's "Limited Time Offer" special section (.ec-spe-section /   */
/* .ec-fs-product cards from index.html). Receives the SAME resolved    */
/* block data as the Learts/Aurora/Cignet renderers — the spread prop   */
/* bag from the storefront SectionRenderer (`<DealOfDay {...block} />`),*/
/* so it also carries block_type / schema_version / countryCode /       */
/* sectionScope which we simply ignore. The countdown ticks in React    */
/* (useEffect, 1s interval) to the block's `countdown_to` ISO date,     */
/* exactly like the Cignet DealOfDay timer. The timer cells reuse the   */
/* template's jQuery-countdownTimer classes (.timerDisplay /            */
/* .displaySection / .numberDisplay / .periodDisplay) so the shipped    */
/* countdownTimer.css + demo1.css style them without any plugin JS.     */
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

const DEFAULT_IMAGE = "/ekka/images/product-image/8_1.jpg"

const pad = (n: number) => String(n).padStart(2, "0")

const Cell = ({ value, label }: { value: number; label: string }) => (
  <span className="displaySection">
    <span
      className="numberDisplay"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {pad(value)}
    </span>
    <span className="periodDisplay">{label}</span>
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
    <section className="section ec-fre-spe-section section-space-p">
      <div className="container">
        <div className="row">
          {/* Special Section Start */}
          <div className="ec-spe-section col-lg-12">
            <div className="col-md-12 text-left">
              {/* Section Title Start */}
              <div className="section-title">
                <h2 className="ec-bg-title">Limited Time Offer</h2>
                <h2 className="ec-title">Limited Time Offer</h2>
              </div>
              {/* Section Title End */}
            </div>

            <div className="ec-spe-products">
              <div className="ec-fs-product">
                <div className="ec-fs-pro-inner">
                  <div className="ec-fs-pro-image-outer col-lg-6 col-md-6 col-sm-6">
                    <div className="ec-fs-pro-image">
                      <LocalizedClientLink
                        href={cta?.href || "/store"}
                        className="image"
                      >
                        <img
                          className="main-image"
                          src={props.image || DEFAULT_IMAGE}
                          alt={title}
                        />
                      </LocalizedClientLink>
                    </div>
                  </div>
                  <div className="ec-fs-pro-content col-lg-6 col-md-6 col-sm-6">
                    <h5 className="ec-fs-pro-title">
                      <LocalizedClientLink href={cta?.href || "/store"}>
                        {title}
                      </LocalizedClientLink>
                    </h5>
                    <div className="countdowntimer">
                      <span>
                        <span className="timerDisplay">
                          <Cell value={days} label="Days" />
                          <Cell value={hours} label="Hours" />
                          <Cell value={minutes} label="Minutes" />
                          <Cell value={seconds} label="Seconds" />
                        </span>
                      </span>
                    </div>
                    {props.description ? (
                      <div className="ec-fs-pro-desc">{props.description}</div>
                    ) : null}
                    {cta?.href ? (
                      <div className="ec-fs-pro-btn">
                        <LocalizedClientLink
                          href={cta.href}
                          className="btn btn-lg btn-primary"
                        >
                          {cta.label || "Shop Now"}
                        </LocalizedClientLink>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Special Section End */}
        </div>
      </div>
    </section>
  )
}

export default DealOfDay
