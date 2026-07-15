"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckCircleSolid,
  ArrowRight,
  ArrowUpRightOnBox,
  XMark,
  Buildings,
  ShoppingBag,
  TruckFast,
  CreditCard,
  GlobeEurope,
} from "@medusajs/icons"

import { getOnboarding, OnboardingStatus, getMerchantMe } from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

/**
 * "Let's set up your shop" — the first thing a new merchant sees.
 *
 * Every tick is REAL: the backend checks the tenant's own products, shipping
 * options, payment providers and custom domain. Nothing here is decorative, and
 * a step never shows done unless the merchant can actually sell through it.
 *
 * It disappears for good once the three selling-critical steps are done, so a
 * running store is never nagged.
 */

type StepKey = "products" | "shipping" | "payment" | "domain"

const STEPS: {
  key: StepKey
  label: string
  desc: string
  href: string
  cta: string
  icon: React.ComponentType<{ className?: string }>
  optional?: boolean
}[] = [
  {
    key: "products",
    label: "Add products",
    desc: "Create something for customers to buy.",
    href: "/dashboard/products",
    cta: "Add product",
    icon: ShoppingBag,
  },
  {
    key: "shipping",
    label: "Set up delivery",
    desc: "Where you ship, and what you charge.",
    href: "/dashboard/settings/locations",
    cta: "Set up shipping",
    icon: TruckFast,
  },
  {
    key: "payment",
    label: "Enable payments",
    desc: "Connect a method so you can get paid.",
    href: "/dashboard/settings",
    cta: "Enable payments",
    icon: CreditCard,
  },
  {
    key: "domain",
    label: "Connect your domain",
    desc: "Use your own web address.",
    href: "/dashboard/domains",
    cta: "Connect domain",
    icon: GlobeEurope,
    optional: true,
  },
]

export function SetupChecklist({ token }: { token: string | null }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [storeUrl, setStoreUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    Promise.all([
      getOnboarding(token).catch(() => null),
      getMerchantMe(token).catch(() => null),
    ])
      .then(([s, me]: any[]) => {
        if (!alive) return
        setStatus(s)
        // Their own domain if they have one, otherwise the mAutomate subdomain.
        const host = me?.store?.domain || (me?.store?.slug ? `${me.store.slug}.mautomate.ai` : null)
        if (host) setStoreUrl(`https://${host}`)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  const { doneCount, total, requiredDone, next } = useMemo(() => {
    if (!status) {
      return { doneCount: 0, total: STEPS.length, requiredDone: false, next: null }
    }
    const done = STEPS.filter((s) => status[s.key]).length
    const reqDone = STEPS.filter((s) => !s.optional).every((s) => status[s.key])
    // The single most useful thing to do right now.
    const nextStep = STEPS.find((s) => !status[s.key]) ?? null
    return { doneCount: done, total: STEPS.length, requiredDone: reqDone, next: nextStep }
  }, [status])

  // A running store is never nagged.
  if (loading || !status || dismissed || requiredDone) return null

  const pct = Math.round((doneCount / total) * 100)

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-grey-90">
          Let&apos;s set up your shop in a few simple steps
        </h2>
        <button
          onClick={() => setDismissed(true)}
          title="Hide"
          className="rounded-lg p-1.5 text-grey-40 transition hover:bg-grey-10 hover:text-grey-60"
        >
          <XMark className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-grey-20 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-grey-90">
            {doneCount} of {total} completed
          </span>
          <span className="text-sm font-bold text-grey-90">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-grey-10">
          <div
            className="h-full rounded-full bg-grey-90 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Store card — always done: they have a store the moment they sign up. */}
        <div className="rounded-xl border border-grey-20 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
              <CheckCircleSolid className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-grey-90">Online store</p>
              <p className="text-xs text-grey-50">Your store is live</p>
            </div>
          </div>
          {storeUrl && (
            <>
              <div className="mt-3 truncate rounded-lg bg-grey-5 px-3 py-2 text-xs text-grey-60">
                {storeUrl.replace(/^https?:\/\//, "")}
              </div>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-grey-20 px-3 py-2 text-sm font-medium text-grey-70 transition hover:bg-grey-10"
              >
                <ArrowUpRightOnBox className="h-4 w-4" /> Visit
              </a>
            </>
          )}
        </div>

        {STEPS.map((step, i) => {
          const done = !!status[step.key]
          const Icon = step.icon
          return (
            <div
              key={step.key}
              className={cn(
                "rounded-xl border bg-white p-4 shadow-sm transition",
                done ? "border-grey-20" : "border-grey-20 hover:border-grey-30"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    done ? "bg-emerald-500 text-white" : "bg-grey-90 text-white"
                  )}
                >
                  {done ? <CheckCircleSolid className="h-5 w-5" /> : i + 2}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-semibold",
                      done ? "text-grey-40 line-through" : "text-grey-90"
                    )}
                  >
                    {step.label}
                    {step.optional && !done && (
                      <span className="ml-1.5 text-xs font-normal text-grey-40">
                        optional
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-grey-50">{step.desc}</p>

                  {/* Do not just say "not done" — say WHAT IS WRONG. A store can
                      have a delivery option and still be unable to take a single
                      order, because that option covers a country the storefront
                      does not sell in. That is invisible from every other screen,
                      and it is exactly what dead-ends checkout at "Continue to
                      payment". */}
                  {step.key === "domain" && !done && status?.pending_domain && (
                    <p className="mt-1.5 rounded-base bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
                      <span className="font-semibold">
                        {status.pending_domain}
                      </span>{" "}
                      was added but is not verified yet, so it does not serve your
                      store. Finish the DNS step to connect it.
                    </p>
                  )}

                  {step.key === "shipping" &&
                    !done &&
                    status?.store_country &&
                    (status.shipping_countries?.length ?? 0) > 0 &&
                    !status.shipping_countries!.includes(status.store_country) && (
                      <p className="mt-1.5 rounded-base bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
                        Your only delivery option covers{" "}
                        <span className="font-semibold uppercase">
                          {status.shipping_countries!.join(", ")}
                        </span>
                        , but your store sells in{" "}
                        <span className="font-semibold uppercase">
                          {status.store_country}
                        </span>
                        . Shoppers see no shipping method, so they cannot reach
                        payment. Add a delivery option for{" "}
                        <span className="font-semibold uppercase">
                          {status.store_country}
                        </span>
                        .
                      </p>
                    )}
                </div>
              </div>

              {!done && (
                <Link
                  href={step.href}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-grey-5 px-3 py-2 text-sm font-medium text-grey-70 transition hover:bg-grey-10"
                >
                  <Icon className="h-4 w-4" />
                  {step.cta}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* One obvious next action — the thing that actually moves them forward. */}
      {next && (
        <Link
          href={next.href}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-grey-90 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-grey-80"
        >
          {next.key === "products"
            ? "Add your first product to continue"
            : `${next.cta} to continue`}
          <ArrowRight className="h-5 w-5" />
        </Link>
      )}
    </div>
  )
}
