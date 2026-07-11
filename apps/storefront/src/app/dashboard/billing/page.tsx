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

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [o, c] = await Promise.all([
        getBillingOverview(token),
        getCredits(token).catch(() => null),
      ])
      setOv(o)
      setCredits(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load billing")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

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
                    <p className="text-sm text-grey-50">≈ {usd(balance, rate)}</p>
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
                      <th className="py-2 text-right font-medium">≈ Cost</th>
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
                        <td className="py-2 text-right text-grey-60">
                          {usd(u.credits, rate)}
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
                      <th className="py-2 font-medium">Type</th>
                      <th className="py-2 text-right font-medium">Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {credits.transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 text-grey-60">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 capitalize text-grey-90">
                          {t.type}
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
