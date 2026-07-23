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
  Globe,
  Photo,
} from "@medusajs/icons"

import {
  getSetupStatus,
  getMerchantMe,
  SetupStatus,
  SetupTask,
  SetupTaskKey,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

/**
 * "Let's set up your shop" — the overview's setup widget.
 *
 * Reads the SAME verified engine as the setup wizard (GET /merchant/setup/status)
 * so the number here and the number in the wizard are always identical. Every
 * tick is real: a step never shows done unless the merchant can actually sell
 * through it, and when something is wrong it says WHAT is wrong (e.g. a delivery
 * option that covers the wrong country) rather than a bare "not done".
 *
 * Required steps gate selling. Once they are all done the widget collapses to a
 * slim "ready to sell" bar, and it can be dismissed for good — a running store
 * is never nagged.
 */

const ICONS: Record<SetupTaskKey, React.ComponentType<{ className?: string }>> = {
  store_country: GlobeEurope,
  products: ShoppingBag,
  shipping: TruckFast,
  payment: CreditCard,
  logo: Photo,
  business_details: Buildings,
  domain: Globe,
}

export function SetupChecklist({ token }: { token: string | null }) {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [storeUrl, setStoreUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    Promise.all([
      getSetupStatus(token).catch(() => null),
      getMerchantMe(token).catch(() => null),
    ])
      .then(([s, me]: any[]) => {
        if (!alive) return
        setStatus(s)
        const host =
          me?.store?.domain || (me?.store?.slug ? `${me.store.slug}.mautomate.ai` : null)
        if (host) setStoreUrl(`https://${host}`)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  const { required, recommended, nextTask } = useMemo(() => {
    const tasks = status?.tasks ?? []
    return {
      required: tasks.filter((t) => t.required),
      recommended: tasks.filter((t) => !t.required),
      nextTask: tasks.find((t) => t.required && !t.done) ?? null,
    }
  }, [status])

  if (loading || !status || dismissed) return null

  const pct = status.percent
  const requiredDone = required.filter((t) => t.done).length

  // A ready store is never nagged: collapse to a slim, dismissible bar.
  if (status.ready_to_sell) {
    const openRecommended = recommended.filter((t) => !t.done).length
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          <CheckCircleSolid className="h-5 w-5 text-emerald-600" />
          Your store is ready to sell.
          {openRecommended > 0 && (
            <span className="font-normal text-emerald-700">
              {openRecommended} optional step{openRecommended > 1 ? "s" : ""} left to
              polish it.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/setup"
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            Open setup guide
          </Link>
          <button
            onClick={() => setDismissed(true)}
            title="Hide"
            className="rounded-lg p-1.5 text-emerald-500 transition hover:bg-emerald-100"
          >
            <XMark className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-grey-90">
          Let&apos;s set up your shop in a few simple steps
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/setup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-grey-90 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-grey-80"
          >
            Open setup guide
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            title="Hide"
            className="rounded-lg p-1.5 text-grey-40 transition hover:bg-grey-10 hover:text-grey-60"
          >
            <XMark className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-grey-20 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-grey-90">
            {requiredDone} of {required.length} required steps done
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

      {/* Required steps + the always-done store card */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Online store — always done: they have a store the moment they sign up. */}
        <div className="rounded-xl border border-grey-20 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
              <CheckCircleSolid className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-grey-90">Online store</p>
              {/* This card only renders while the store is NOT ready to sell
                  (the ready state returns the slim bar above), so it is honest
                  to caveat "live" here — the store is reachable but cannot yet
                  take an order. */}
              <p className="text-xs text-amber-700">Live, but not taking orders yet</p>
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

        {required.map((task, i) => {
          const Icon = ICONS[task.key] ?? ShoppingBag
          return (
            <div
              key={task.key}
              className="rounded-xl border border-grey-20 bg-white p-4 shadow-sm transition hover:border-grey-30"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    task.done ? "bg-emerald-500 text-white" : "bg-grey-90 text-white"
                  )}
                >
                  {task.done ? <CheckCircleSolid className="h-5 w-5" /> : i + 2}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-semibold",
                      task.done ? "text-grey-40 line-through" : "text-grey-90"
                    )}
                  >
                    {task.label}
                  </p>
                  <p className="text-xs text-grey-50">{task.why}</p>
                  {!task.done && task.blocker_detail && (
                    <p className="mt-1.5 rounded-base bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900">
                      {task.blocker_detail}
                    </p>
                  )}
                </div>
              </div>
              {!task.done && (
                <Link
                  href={task.cta_href}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-grey-5 px-3 py-2 text-sm font-medium text-grey-70 transition hover:bg-grey-10"
                >
                  <Icon className="h-4 w-4" />
                  {task.label}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Recommended — compact, non-nagging */}
      {recommended.some((t) => !t.done) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-grey-20 bg-grey-5 px-4 py-3">
          <span className="text-xs font-medium text-grey-60">Also recommended:</span>
          {recommended
            .filter((t) => !t.done)
            .map((t: SetupTask) => (
              <Link
                key={t.key}
                href={t.cta_href}
                className="inline-flex items-center gap-1 rounded-full border border-grey-20 bg-white px-2.5 py-1 text-xs font-medium text-grey-70 transition hover:border-grey-30 hover:bg-grey-10"
              >
                {t.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
        </div>
      )}

      {/* One obvious next action. */}
      {nextTask && (
        <Link
          href={nextTask.cta_href}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-grey-90 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-grey-80"
        >
          {nextTask.key === "products"
            ? "Add your first product to continue"
            : `${nextTask.label} to continue`}
          <ArrowRight className="h-5 w-5" />
        </Link>
      )}
    </div>
  )
}
