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
  <div className="flex flex-col items-center">
    <span className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900 tabular-nums">
      {pad(value)}
    </span>
    <span className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
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
    <section className="aurora-theme bg-white py-16 md:py-24 font-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
          <div className="grid grid-cols-1 items-stretch lg:grid-cols-2">
            <div className="relative bg-neutral-50">
              {props.image ? (
                <img
                  src={props.image}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col justify-center p-8 md:p-12">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                Limited time
              </span>
              <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">
                {title}
              </h2>
              {props.description ? (
                <p className="mt-4 max-w-prose text-sm text-neutral-500">
                  {props.description}
                </p>
              ) : null}
              <div className="mt-8 flex items-center gap-6">
                <Cell value={days} label="Days" />
                <span className="text-2xl font-light text-neutral-300">:</span>
                <Cell value={hours} label="Hours" />
                <span className="text-2xl font-light text-neutral-300">:</span>
                <Cell value={minutes} label="Minutes" />
                <span className="text-2xl font-light text-neutral-300">:</span>
                <Cell value={seconds} label="Seconds" />
              </div>
              {cta?.href ? (
                <div className="mt-10">
                  <LocalizedClientLink
                    href={cta.href}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
                  >
                    {cta.label || "Shop Now"}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-4 w-4"
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
      </div>
    </section>
  )
}

export default DealOfDay
