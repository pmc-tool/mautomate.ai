"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  CurrencyDollar,
  ArrowPath,
  CheckCircleSolid,
  InformationCircleSolid,
  CircleWarningSolid,
  Spinner,
  ArrowUpRightOnBox,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getBillingOverview,
  getCredits,
  topUpCredits,
  changePlan,
  BillingOverview,
  CreditsResponse,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

const usd = (credits: number, rate: number) =>
  `$${(credits * rate).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const nf = (n: number) => n.toLocaleString()

export default function BillingPage() {
  const { token } = useMerchantAuth()
  const [ov, setOv] = useState<BillingOverview | null>(null)
  const [credits, setCredits] = useState<CreditsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyPack, setBusyPack] = useState<number | null>(null)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [histOffset, setHistOffset] = useState(0)
  const [histMore, setHistMore] = useState(false)
  const [histBusy, setHistBusy] = useState(false)
  const HIST_PAGE = 20

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [o, c] = await Promise.all([
        getBillingOverview(token),
        getCredits(token, { limit: HIST_PAGE, offset: 0 }).catch(() => null),
      ])
      setOv(o)
      setCredits(c)
      setHistOffset(0)
      setHistMore(!!c?.has_more)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load billing")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const loadMoreHistory = async () => {
    if (!token || !credits || histBusy) return
    setHistBusy(true)
    try {
      const next = histOffset + HIST_PAGE
      const more = await getCredits(token, { limit: HIST_PAGE, offset: next })
      setCredits({
        ...credits,
        transactions: [...credits.transactions, ...more.transactions],
      })
      setHistOffset(next)
      setHistMore(!!more.has_more)
    } catch {
      /* keep what we have */
    } finally {
      setHistBusy(false)
    }
  }

  const buy = async (credits: number, amount_usd: number, idx: number) => {
    if (!token) return
    setBusyPack(idx)
    setNotice(null)
    setError(null)
    try {
      const r = await topUpCredits(token, { credits, amount_usd })
      if (r.checkout_url) {
        window.location.href = r.checkout_url
        return
      }
      setNotice(
        "Card payments are being set up for your region — we couldn't start checkout yet. Your balance and usage are still tracked."
      )
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Card payments are being set up — please try again later."
      )
    } finally {
      setBusyPack(null)
    }
  }

  const selectPlan = async (key: string) => {
    if (!token) return
    setBusyPlan(key)
    setNotice(null)
    setError(null)
    try {
      const r = await changePlan(token, key)
      if (r.checkout_url) {
        window.location.href = r.checkout_url
        return
      }
      setNotice(r.message || "Plan change requested.")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change plan")
    } finally {
      setBusyPlan(null)
    }
  }

  const rate = ov?.credit_usd ?? 0.01
  const balance = ov?.wallet.balance ?? 0
  const lowBalance = ov ? balance < 100 : false

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your plan, AI credit balance, and usage."
      />

      {loading && !ov ? (
        <div className="flex items-center gap-2 text-sm text-grey-50">
          <Spinner className="h-4 w-4 animate-spin" /> Loading billing…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleWarningSolid className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : ov ? (
        <>
          {!ov.gateway.configured && (
            <div className="flex items-start gap-3 rounded-large border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <InformationCircleSolid className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Card payments are being set up</p>
                <p className="mt-0.5">
                  You can change your plan anytime below — upgrades take effect
                  immediately at no charge until card billing goes live. Your
                  credit balance and usage are tracked accurately.
                </p>
              </div>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-3 rounded-large border border-grey-20 bg-grey-10 p-4 text-sm text-grey-70">
              <InformationCircleSolid className="mt-0.5 h-5 w-5 shrink-0 text-grey-50" />
              <span>{notice}</span>
            </div>
          )}

          {/* ---- Balance hero: the two buckets, front and centre ---- */}
          <div className="relative overflow-hidden rounded-2xl border border-grey-20 bg-gradient-to-br from-grey-90 via-grey-80 to-grey-90 p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-white/60">
                  Available AI credits
                </p>
                <p className="mt-1 text-5xl font-bold tabular-nums">
                  {nf(ov.credits?.total ?? balance)}
                </p>
                {ov.wallet.reserved > 0 && (
                  <p className="mt-1 text-sm text-white/60">
                    {nf(ov.wallet.reserved)} credits on hold
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {(ov.credits?.expiring ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 font-medium text-amber-300 ring-1 ring-inset ring-amber-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {nf(ov.credits!.expiring)} plan credits
                    {ov.credits?.next_expiry
                      ? ` · expire ${new Date(ov.credits.next_expiry).toLocaleDateString()}`
                      : ""}
                  </span>
                )}
                {(ov.credits?.purchased ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {nf(ov.credits!.purchased)} purchased · never expire
                  </span>
                )}
                <div className="mt-1 flex gap-2">
                  <a
                    href="#packs"
                    className="rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-grey-90 transition hover:bg-grey-10"
                  >
                    Buy credits
                  </a>
                  <a
                    href="#plans"
                    className="rounded-lg border border-white/25 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Change plan
                  </a>
                </div>
              </div>
            </div>
            {ov.allowance.included > 0 && (
              <div className="relative mt-5">
                <div className="mb-1 flex justify-between text-xs text-white/60">
                  <span>Monthly allowance</span>
                  <span>
                    {nf(Math.round(ov.allowance.used_this_cycle))} / {nf(ov.allowance.included)} used
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{
                      width: `${Math.min(100, (ov.allowance.used_this_cycle / ov.allowance.included) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Plan + Credits side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Current plan */}
            <SectionCard
              title="Your plan"
              description="Subscription tier and what it includes."
            >
              {ov.current_plan ? (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-semibold text-grey-90">
                        {ov.current_plan.name}
                      </p>
                      <p className="text-sm text-grey-50">
                        {ov.current_plan.price_usd > 0
                          ? `$${ov.current_plan.price_usd}/mo`
                          : "Free"}
                        {" · "}
                        {nf(ov.current_plan.included_credits)} credits/mo included
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        ov.plan_status === "live"
                          ? "bg-green-100 text-green-700"
                          : "bg-grey-10 text-grey-60"
                      )}
                    >
                      {ov.plan_status}
                    </span>
                  </div>
                  {ov.trial_ends_at && (
                    <p className="text-xs text-grey-50">
                      Trial ends {new Date(ov.trial_ends_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-grey-50">No active plan.</p>
              )}
            </SectionCard>

            {/* AI Credits */}
            <SectionCard
              id="packs"
              title="AI credits"
              description="Spent on AI calls, content, chatbot and SMS."
            >
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-semibold text-grey-90">
                      {nf(balance)}{" "}
                      <span className="text-base font-normal text-grey-50">
                        credits
                      </span>
                    </p>

                  </div>
                  {ov.wallet.reserved > 0 && (
                    <p className="text-xs text-grey-50">
                      {nf(ov.wallet.reserved)} reserved
                    </p>
                  )}
                </div>

                {/* allowance usage bar */}
                {ov.allowance.included > 0 && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-grey-50">
                      <span>Included this month</span>
                      <span>
                        {nf(Math.round(ov.allowance.used_this_cycle))} /{" "}
                        {nf(ov.allowance.included)} used
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-grey-10">
                      <div
                        className="h-full rounded-full bg-grey-90"
                        style={{
                          width: `${Math.min(
                            100,
                            (ov.allowance.used_this_cycle /
                              ov.allowance.included) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {lowBalance && (
                  <div className="flex items-start gap-2 rounded-base bg-amber-50 p-2.5 text-xs text-amber-800">
                    <CircleWarningSolid className="mt-0.5 h-4 w-4 shrink-0" />
                    Your balance is low — top up so AI calls, posts and chatbot
                    replies keep running.
                  </div>
                )}

                {/* packs */}
                <div>
                  <p className="mb-2 text-xs font-medium text-grey-60">
                    Buy credits
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ov.packs.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => buy(p.credits, p.amount_usd, i)}
                        disabled={busyPack !== null}
                        className="flex flex-col items-start rounded-base border border-grey-20 bg-white p-3 text-left transition-colors hover:border-grey-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-sm font-semibold text-grey-90">
                          {busyPack === i ? (
                            <Spinner className="h-4 w-4 animate-spin" />
                          ) : (
                            `${nf(p.credits)} credits`
                          )}
                        </span>
                        <span className="text-xs text-grey-50">
                          ${p.amount_usd}
                          {p.bonus_pct > 0 && (
                            <span className="ml-1 text-green-600">
                              +{p.bonus_pct}%
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Usage this cycle */}
          <SectionCard
            title="Usage this cycle"
            description="Credits consumed per feature this month."
          >
            {ov.usage.length === 0 ? (
              <p className="text-sm text-grey-50">
                No AI usage yet this month.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-grey-50">
                    <tr className="border-b border-grey-10 text-left">
                      <th className="py-2 font-medium">Feature</th>
                      <th className="py-2 text-right font-medium">Units</th>
                      <th className="py-2 text-right font-medium">Credits</th>

                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {ov.usage.map((u) => (
                      <tr key={u.action}>
                        <td className="py-2 text-grey-90">{u.label}</td>
                        <td className="py-2 text-right text-grey-60">
                          {nf(Math.round(u.units))}
                        </td>
                        <td className="py-2 text-right text-grey-90">
                          {nf(Math.round(u.credits))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Compare / change plan */}
          <SectionCard
            id="plans"
            title="Plans"
            description="Upgrade or downgrade your subscription."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ov.plans.map((p) => {
                const isCurrent = p.key === ov.current_plan?.key
                return (
                  <div
                    key={p.key}
                    className={cn(
                      "flex flex-col rounded-large border p-4",
                      isCurrent
                        ? "border-grey-90 bg-grey-10"
                        : "border-grey-20 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-grey-90">{p.name}</p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-grey-70">
                          <CheckCircleSolid className="h-4 w-4" /> Current
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-grey-90">
                      {p.price_usd > 0 ? `$${p.price_usd}` : "Free"}
                      {p.price_usd > 0 && (
                        <span className="text-sm font-normal text-grey-50">
                          /mo
                        </span>
                      )}
                    </p>
                    <ul className="mt-3 flex-1 space-y-1 text-xs text-grey-60">
                      <li>{nf(p.included_credits)} AI credits / month</li>
                      {p.products_limit != null && (
                        <li>{nf(p.products_limit)} products</li>
                      )}
                      {p.seats_limit != null && (
                        <li>{nf(p.seats_limit)} staff seats</li>
                      )}
                      {p.domains_limit != null && (
                        <li>{nf(p.domains_limit)} custom domains</li>
                      )}
                    </ul>
                    <button
                      onClick={() => selectPlan(p.key)}
                      disabled={isCurrent || busyPlan !== null}
                      className={cn(
                        "mt-4 inline-flex items-center justify-center gap-1.5 rounded-base px-3 py-2 text-sm font-medium transition-colors",
                        isCurrent
                          ? "cursor-default bg-grey-10 text-grey-40"
                          : "bg-grey-90 text-white hover:bg-grey-80 disabled:opacity-50"
                      )}
                    >
                      {busyPlan === p.key ? (
                        <Spinner className="h-4 w-4 animate-spin" />
                      ) : isCurrent ? (
                        "Current plan"
                      ) : (
                        <>
                          Choose {p.name}
                          <ArrowUpRightOnBox className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* History */}
          <SectionCard
            title="Credit history"
            description="Top-ups, grants and metered spend."
          >
            {!credits || credits.transactions.length === 0 ? (
              <p className="text-sm text-grey-50">No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-grey-50">
                    <tr className="border-b border-grey-10 text-left">
                      <th className="py-2 font-medium">Date</th>
                      <th className="py-2 font-medium">Activity</th>
                      <th className="py-2 text-right font-medium">Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {credits.transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 text-grey-60">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-grey-90">
                          {(t as any).label ?? t.type}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right font-medium",
                            t.amount >= 0 ? "text-green-600" : "text-grey-90"
                          )}
                        >
                          {t.amount >= 0 ? "+" : ""}
                          {nf(Math.round(t.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {histMore && (
                  <button
                    onClick={loadMoreHistory}
                    disabled={histBusy}
                    className="mt-3 w-full rounded-lg border border-grey-20 py-2 text-sm font-medium text-grey-70 transition hover:bg-grey-10 disabled:opacity-50"
                  >
                    {histBusy ? "Loading…" : "Load more"}
                  </button>
                )}
                {credits?.count ? (
                  <p className="mt-2 text-center text-xs text-grey-50">
                    Showing {credits.transactions.length} of {credits.count}
                  </p>
                ) : null}
              </div>
            )}
          </SectionCard>

          <div className="flex justify-end">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-sm text-grey-50 hover:text-grey-90"
            >
              <ArrowPath className="h-4 w-4" /> Refresh
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
