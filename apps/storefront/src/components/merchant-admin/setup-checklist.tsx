"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircleSolid, ArrowRightMini, RocketLaunch, XMark } from "@medusajs/icons"
import { getOnboarding, OnboardingStatus } from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

type Step = {
  key: keyof OnboardingStatus
  label: string
  desc: string
  href: string
  optional?: boolean
}

const STEPS: Step[] = [
  { key: "products", label: "Add your first product", desc: "Create something for customers to buy.", href: "/dashboard/products" },
  { key: "shipping", label: "Set up shipping", desc: "Choose which countries you ship to and your rates.", href: "/dashboard/settings/locations" },
  { key: "payment", label: "Set up payments", desc: "Connect a payment method so you can get paid.", href: "/dashboard/settings" },
  { key: "domain", label: "Connect your domain", desc: "Use your own web address (optional).", href: "/dashboard/domains", optional: true },
]

/**
 * Guided store-setup checklist. Surfaces the essential steps a new seller must
 * complete before they can sell — most importantly shipping + payments, which
 * otherwise live under Settings and are easy to miss. Hides itself once the
 * required steps (products, shipping, payment) are done.
 */
export function SetupChecklist({ token }: { token: string | null }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    getOnboarding(token)
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  const { doneCount, total, requiredDone } = useMemo(() => {
    if (!status) return { doneCount: 0, total: STEPS.length, requiredDone: false }
    const done = STEPS.filter((s) => status[s.key]).length
    const required = STEPS.filter((s) => !s.optional)
    const reqDone = required.every((s) => status[s.key])
    return { doneCount: done, total: STEPS.length, requiredDone: reqDone }
  }, [status])

  // Hide while loading, on error, once the required steps are complete, or if dismissed.
  if (loading || !status || dismissed || requiredDone) return null

  return (
    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
      <div className="flex items-start justify-between gap-4 border-b border-grey-10 bg-grey-10/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base bg-grey-90 text-white">
            <RocketLaunch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-grey-90">Finish setting up your store</h2>
            <p className="mt-0.5 text-sm text-grey-50">
              {doneCount} of {total} done — complete these so customers can buy and pay.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-base p-1 text-grey-40 hover:bg-grey-10 hover:text-grey-70"
          title="Dismiss"
        >
          <XMark className="h-4 w-4" />
        </button>
      </div>

      <ul className="divide-y divide-grey-10">
        {STEPS.map((step) => {
          const done = status[step.key]
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 transition-colors",
                  done ? "cursor-default" : "hover:bg-grey-10"
                )}
              >
                {done ? (
                  <CheckCircleSolid className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-grey-30" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", done ? "text-grey-40 line-through" : "text-grey-90")}>
                    {step.label}
                    {step.optional && !done && (
                      <span className="ml-2 rounded-full bg-grey-10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-grey-50">
                        Optional
                      </span>
                    )}
                  </p>
                  {!done && <p className="text-xs text-grey-50">{step.desc}</p>}
                </div>
                {!done && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-grey-90">
                    Set up
                    <ArrowRightMini className="h-4 w-4" />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
