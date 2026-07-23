"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  ArrowDownTray,
  ArrowUpRightOnBox,
  Bolt,
  CheckCircleSolid,
  RocketLaunch,
} from "@medusajs/icons"
import {
  MobileAppBuildStatus,
  MobileAppService,
  requestMobileAppBuild,
  startMobileAppCheckout,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

/* ------------------------------------------------------------------ */
/* Step 2 — BuildStep: one panel that always tells the truth about the  */
/* free build: not requested / preparing / ready to download.           */
/* Step 3 — PublishStep: the one real decision (yourself vs our team),  */
/* with the paid-service state surfaced when the team is already on it. */
/* ------------------------------------------------------------------ */

export function BuildStep({
  token,
  build,
  onRefresh,
}: {
  token: string
  build: MobileAppBuildStatus | null
  onRefresh: () => Promise<void>
}) {
  const [requesting, setRequesting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const downloadUrl = build?.download_url ?? null
  const latest = build?.latest_status ?? null
  const queued =
    !downloadUrl && !!latest && !["cancelled", "failed"].includes(latest)
  const requestedAt = build?.requests?.[0]?.created_at

  const request = async () => {
    setRequesting(true)
    setError(null)
    try {
      await requestMobileAppBuild(token)
      await onRefresh()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We couldn't start your build just yet. Please try again shortly."
      )
    } finally {
      setRequesting(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  if (downloadUrl) {
    return (
      <div className="rounded-base border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircleSolid className="h-4 w-4" />
          Your app is ready
        </p>
        <p className="mt-1 text-sm text-emerald-800/90">
          This is the real, installable app of your store. Download it, then go to
          step 3 to put it on Google Play.
        </p>
        <a
          href={downloadUrl}
          className="mt-3 inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
        >
          <ArrowDownTray className="h-4 w-4" />
          Download your app
        </a>
      </div>
    )
  }

  if (queued) {
    return (
      <div className="rounded-base border border-grey-20 bg-grey-5 px-5 py-4">
        <p className="flex items-center gap-2.5 text-sm font-semibold text-grey-90">
          <span className="maap-pulse h-2.5 w-2.5 rounded-full bg-brand-500" />
          We&apos;re preparing your app
          {requestedAt && (
            <span className="font-normal text-grey-50">
              · requested {new Date(requestedAt).toLocaleString()}
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-grey-60">
          Nothing else to do — the Download button appears right here when it&apos;s
          ready. You don&apos;t need to stay on this page.
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10 disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "Check again"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-base border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={request}
        disabled={requesting}
        className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RocketLaunch className="h-4 w-4" />
        {requesting ? "Requesting…" : "Build my app — free"}
      </button>
      <p className="mt-3 text-xs text-grey-50">
        Choosing &ldquo;our team publishes it&rdquo; in step 3? You can skip this —
        building is included in that service.
      </p>
      {error && (
        <p className="mt-3 rounded-base border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/* --------------------------- Step 3 ---------------------------------- */

function money(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null
  if (typeof value === "string") return value
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

type DisplayTier = {
  tier: "play" | "full"
  name: string
  cta: string
  regular: string | null
  sale: string | null
  badge: string
  includes: string[]
}

const FALLBACK_TIER_META: Record<
  "play" | "full",
  { name: string; cta: string; regular: string; sale: string; badge: string; includes: string[] }
> = {
  play: {
    name: "Google Play",
    cta: "Choose Google Play",
    regular: "$199",
    sale: "$99",
    badge: "50% OFF LAUNCH",
    includes: [
      "We build and test your Android app",
      "We upload it to Google Play",
      "Store listing done: icon, screenshots, description",
      "We handle Google's review for you",
    ],
  },
  full: {
    name: "Google Play + Apple App Store",
    cta: "Choose both stores",
    regular: "$349",
    sale: "$174",
    badge: "50% OFF LAUNCH",
    includes: [
      "Everything in the Google Play package",
      "We build and submit your iPhone app",
      "Apple listing set up and submitted",
      "We handle review feedback for both stores",
    ],
  },
}

const FALLBACK_TIERS: DisplayTier[] = [
  { tier: "play", ...FALLBACK_TIER_META.play },
  { tier: "full", ...FALLBACK_TIER_META.full },
]

const TIER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  play: RocketLaunch,
  full: Bolt,
}

export function PublishStep({
  token,
  service,
}: {
  token: string
  service: MobileAppService | null
}) {
  const [busyTier, setBusyTier] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const state = service?.service?.state ?? "none"
  const teamWorking = state === "paid" || state === "in_progress"
  const published = state === "published"

  const tiers: DisplayTier[] =
    service?.tiers && service.tiers.length
      ? service.tiers.map((t) => {
          const meta = FALLBACK_TIER_META[t.tier]
          return {
            tier: t.tier,
            name: meta?.name || t.label || t.tier,
            cta: meta?.cta || "Get started",
            regular: money(t.regular_usd) ?? meta?.regular ?? null,
            sale: money(t.launch_usd) ?? meta?.sale ?? null,
            badge:
              t.discount_pct != null
                ? `${t.discount_pct}% OFF LAUNCH`
                : meta?.badge || "50% OFF LAUNCH",
            includes: meta?.includes ?? [],
          }
        })
      : FALLBACK_TIERS

  const checkout = async (tier: "play" | "full") => {
    setBusyTier(tier)
    setNotice(null)
    try {
      // We send ONLY the tier. The server owns the price and starts Stripe.
      const res = await startMobileAppCheckout(token, tier)
      if (res.checkout_url) {
        window.location.href = res.checkout_url
        return
      }
      setNotice(
        res.message ||
          "Checkout is being set up for your region. Please try again in a moment or contact support."
      )
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "We couldn't start checkout just yet. Please try again shortly."
      )
    } finally {
      setBusyTier(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      {/* Path A — yourself */}
      <div className="flex flex-col rounded-base border border-grey-20 bg-white p-5">
        <h3 className="text-sm font-semibold text-grey-90">You publish it</h3>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
          Free
        </p>
        <ol className="mt-4 flex-1 space-y-3">
          {[
            "Download your app in step 2",
            "Follow our step-by-step guide (with screenshots)",
            "Your app appears on Google Play",
          ].map((s, i) => (
            <li key={s} className="flex items-start gap-2.5 text-sm text-grey-70">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-grey-10 text-[11px] font-bold text-grey-60">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-grey-50">
          You&apos;ll need a Google Play account — Google charges a one-time $25 fee,
          paid to Google directly.
        </p>
        <Link
          href="/dashboard/mobile-app/guide"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
        >
          Open the step-by-step guide
          <ArrowUpRightOnBox className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Path B — our team */}
      <div className="flex flex-col rounded-base border border-brand-200 bg-brand-50/40 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-grey-90">We publish it for you</h3>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
              Recommended — zero effort
            </p>
          </div>
        </div>

        {published ? (
          <div className="mt-4 rounded-base border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <CheckCircleSolid className="h-4 w-4" />
              Your app is live on the stores
            </p>
            <p className="mt-1 text-xs text-emerald-800/90">
              Need a change or an update? Email support and we&apos;ll take care of it.
            </p>
          </div>
        ) : teamWorking ? (
          <div className="mt-4 rounded-base border border-brand-200 bg-white px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-grey-90">
              <span className="maap-pulse h-2.5 w-2.5 rounded-full bg-brand-500" />
              Our team is on it
            </p>
            <p className="mt-1 text-xs text-grey-60">
              Payment received. We build, test, upload and set up your listing — we&apos;ll
              email you at each step, and whenever the stores need something from you.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-grey-60">
              We build, test, upload and set up your store listing — you just approve.
            </p>
            <div className="mt-4 grid flex-1 gap-4 sm:grid-cols-2">
              {tiers.map((t) => {
                const Icon = TIER_ICON[t.tier] || RocketLaunch
                return (
                  <div
                    key={t.tier}
                    className="flex flex-col rounded-base border border-grey-20 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-base bg-grey-10 p-1.5 text-grey-60">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {t.badge}
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-grey-90">{t.name}</h4>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      {t.sale && (
                        <span className="text-2xl font-bold text-grey-90">{t.sale}</span>
                      )}
                      {t.regular && t.regular !== t.sale && (
                        <span className="text-sm text-grey-40 line-through">
                          {t.regular}
                        </span>
                      )}
                      <span className="text-xs text-grey-50">one-time</span>
                    </div>
                    <ul className="mt-3 flex-1 space-y-2">
                      {(t.includes || []).map((inc, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-grey-70"
                        >
                          <CheckCircleSolid className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => checkout(t.tier)}
                      disabled={busyTier !== null}
                      className={cn(
                        "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-base px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        "bg-brand-500 hover:bg-brand-600"
                      )}
                    >
                      {busyTier === t.tier ? "Starting checkout…" : t.cta}
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-grey-50">
              App-store fees are separate and paid to the stores directly: Google Play{" "}
              <span className="font-medium text-grey-70">$25 one-time</span>, Apple{" "}
              <span className="font-medium text-grey-70">$99 per year</span>. Our price
              covers the build, testing, upload and listing work.
            </p>
          </>
        )}

        {notice && (
          <p className="mt-4 rounded-base border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}
      </div>
    </div>
  )
}
