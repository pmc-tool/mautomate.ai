"use client"

import { useEffect, useMemo, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const pad = (n: number) => String(n).padStart(2, "0")

const DealOfDay = () => {
  // Count down to 10 days from first render.
  const target = useMemo(
    () => Date.now() + 10 * 24 * 60 * 60 * 1000,
    []
  )
  const [remaining, setRemaining] = useState(target - Date.now())

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  const clamped = Math.max(0, remaining)
  const days = Math.floor(clamped / (24 * 60 * 60 * 1000))
  const hours = Math.floor((clamped / (60 * 60 * 1000)) % 24)
  const minutes = Math.floor((clamped / (60 * 1000)) % 60)
  const seconds = Math.floor((clamped / 1000) % 60)

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

  return (
    <div className="section section-fluid section-padding learts-theme">
      <div className="container">
        <div className="row align-items-center learts-mb-n30">
          <div className="col-lg-6 col-12 learts-mb-30">
            <div className="product-deal-image text-center">
              <img
                src="/learts/assets/images/product/deal-product-1.webp"
                alt="Deal of the day"
              />
            </div>
          </div>
          <div className="col-lg-6 col-12 learts-mb-30">
            <div className="product-deal-content">
              <h2 className="title">Deal of the day</h2>
              <div className="desc">
                <p>
                  Years of experience brought about by our skilled craftsmen
                  could ensure that every piece produced is a work of art. Our
                  focus is always the best quality possible.
                </p>
              </div>
              <div
                className="countdown1"
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
              <LocalizedClientLink
                href="/store"
                className="btn btn-dark btn-hover-primary"
              >
                Shop Now
              </LocalizedClientLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealOfDay
