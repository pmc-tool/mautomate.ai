"use client"

import Link from "next/link"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  ChartPie,
  ExclamationCircle,
  Spinner,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  AdsOverview,
  getAdsOverview,
  runAdsSyncNow,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { cn } from "@lib/util/cn"

/**
 * Advertising — Overview. Cross-platform ad performance for THIS store:
 * spend, impressions, clicks, conversions and ROAS over a selectable window,
 * a daily spend bar strip, and the campaign table. Every figure is aggregated
 * from insight rows the ad platform actually returned — an empty store shows
 * an honest empty state, never sample numbers.
 *
 * Note on currency: ad spend is real platform money billed to the merchant's
 * own ad account (their card at Meta/Google), so it is shown in the ad
 * account's currency — this is not the credits system.
 */

const WINDOWS = [7, 30, 90] as const

const fmtMoney = (v: number, currency: string | null): string => {
  const cur = currency ?? "USD"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(v)
  } catch {
    return `${v.toFixed(2)} ${cur}`
  }
}

const fmtInt = (v: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  draft: "bg-grey-10 text-grey-70",
  archived: "bg-grey-10 text-grey-50",
  error: "bg-rose-50 text-rose-700",
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "bg-grey-10 text-grey-70"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        tone
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replace(/_/g, " ")}
    </span>
  )
}

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-grey-20 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-grey-50">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-grey-90">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-grey-50">{hint}</div> : null}
    </div>
  )
}

function SpendStrip({
  daily,
  currency,
}: {
  daily: { date: string; spend: number }[]
  currency: string | null
}) {
  const max = Math.max(...daily.map((d) => d.spend), 0.01)
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {daily.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${fmtMoney(d.spend, currency)}`}
          className="min-w-[6px] flex-1 rounded-t-sm bg-grey-30 transition-colors hover:bg-grey-50"
          style={{ height: `${Math.max((d.spend / max) * 100, d.spend > 0 ? 4 : 1)}%` }}
        />
      ))}
    </div>
  )
}

export default function AdvertisingOverviewPage() {
  const { token } = useMerchantAuth()
  const [overview, setOverview] = useState<AdsOverview | null>(null)
  const [days, setDays] = useState<number>(30)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (windowDays: number) => {
      if (!token) return
      setLoading(true)
      setError(null)
      try {
        setOverview(await getAdsOverview(token, windowDays))
      } catch (e: any) {
        setError(e?.message ?? "Could not load advertising data.")
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    load(days)
  }, [load, days])

  const syncNow = useCallback(async () => {
    if (!token || syncing) return
    setSyncing(true)
    setError(null)
    try {
      const { summary } = await runAdsSyncNow(token)
      if (summary.errors.length > 0) {
        setError(`Sync finished with issues: ${summary.errors[0]}`)
      }
      await load(days)
    } catch (e: any) {
      setError(e?.message ?? "Sync failed.")
    } finally {
      setSyncing(false)
    }
  }, [token, syncing, load, days])

  const hasConnection = (overview?.connections ?? []).some(
    (c) => c.status === "connected"
  )
  const hasData = (overview?.campaigns ?? []).length > 0

  const syncedAgo = useMemo(() => {
    if (!overview?.last_synced_at) return null
    const mins = Math.round(
      (Date.now() - new Date(overview.last_synced_at).getTime()) / 60000
    )
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins} min ago`
    const hours = Math.round(mins / 60)
    return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`
  }, [overview?.last_synced_at])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Advertising"
          description="Your ad performance across platforms, in one place. Spend is billed by the ad platform to your own ad account."
        />
        {hasConnection && (
          <Link
            href="/dashboard/advertising/new"
            className="shrink-0 rounded-md bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            New campaign
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-base border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <ExclamationCircle className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !overview ? (
        <div className="flex items-center gap-2 py-16 text-grey-50">
          <Spinner className="animate-spin" /> Loading advertising data…
        </div>
      ) : !hasConnection ? (
        <SectionCard
          title="Get started"
          description="Connect an ad account to see and manage your campaigns from here."
        >
          <EmptyState
            icon={ChartPie}
            title="No ad account connected yet"
            description="Connect your Meta ad account and your campaigns, spend, and results will show up here — no more switching to Ads Manager."
          />
          <div className="mt-4 flex justify-center">
            <Link
              href="/dashboard/advertising/connect"
              className="rounded-md bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Connect an ad account
            </Link>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-md border border-grey-20 bg-white p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  onClick={() => setDays(w)}
                  className={cn(
                    "rounded px-3 py-1 text-sm",
                    days === w
                      ? "bg-grey-90 font-medium text-white"
                      : "text-grey-60 hover:text-grey-90"
                  )}
                >
                  {w} days
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm text-grey-50">
              {syncedAgo ? <span>Synced {syncedAgo}</span> : null}
              <button
                onClick={syncNow}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-md border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-5 disabled:opacity-50"
              >
                {syncing ? (
                  <Spinner className="animate-spin" />
                ) : (
                  <ArrowPath />
                )}
                Sync now
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiTile
              label="Spend"
              value={fmtMoney(
                overview?.totals.spend ?? 0,
                overview?.totals.currency ?? null
              )}
            />
            <KpiTile
              label="Impressions"
              value={fmtInt(overview?.totals.impressions ?? 0)}
            />
            <KpiTile label="Clicks" value={fmtInt(overview?.totals.clicks ?? 0)} />
            <KpiTile
              label="Purchases"
              value={fmtInt(overview?.totals.conversions ?? 0)}
              hint={
                (overview?.totals.conversion_value ?? 0) > 0
                  ? `${fmtMoney(
                      overview!.totals.conversion_value,
                      overview!.totals.currency
                    )} value`
                  : undefined
              }
            />
            <KpiTile
              label="ROAS"
              value={
                overview?.totals.roas != null
                  ? `${overview.totals.roas.toFixed(2)}x`
                  : "—"
              }
              hint={
                overview?.totals.roas == null
                  ? "Needs purchase tracking"
                  : undefined
              }
            />
          </div>

          {(overview?.daily ?? []).length > 0 && (
            <SectionCard
              title="Daily spend"
              description={`Spend per day over the last ${days} days.`}
            >
              <SpendStrip
                daily={overview!.daily}
                currency={overview!.totals.currency}
              />
            </SectionCard>
          )}

          <SectionCard
            title="Campaigns"
            description="Everything running in your connected ad accounts. Numbers cover the selected window."
          >
            {!hasData ? (
              <EmptyState
                icon={ChartPie}
                title="No campaigns yet"
                description="When your ad account has campaigns, they appear here with their results. If you just connected, try Sync now."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grey-20 text-left text-xs uppercase tracking-wide text-grey-50">
                      <th className="py-2 pr-4 font-medium">Campaign</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Budget</th>
                      <th className="py-2 pr-4 text-right font-medium">Spend</th>
                      <th className="py-2 pr-4 text-right font-medium">Impressions</th>
                      <th className="py-2 pr-4 text-right font-medium">Clicks</th>
                      <th className="py-2 pr-4 text-right font-medium">Purchases</th>
                      <th className="py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {(overview?.campaigns ?? []).map((c) => (
                      <tr key={c.id}>
                        <td className="max-w-[280px] py-2.5 pr-4">
                          <Link
                            href={`/dashboard/advertising/campaigns/${c.id}`}
                            className="block truncate font-medium text-grey-90 hover:underline"
                          >
                            {c.name}
                          </Link>
                          <div className="text-xs capitalize text-grey-50">
                            {c.platform}
                            {c.objective
                              ? ` · ${c.objective
                                  .replace(/^OUTCOME_/, "")
                                  .toLowerCase()}`
                              : ""}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <StatusPill status={c.status} />
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums text-grey-70">
                          {c.daily_budget != null
                            ? `${fmtMoney(c.daily_budget, c.currency)}/day`
                            : c.lifetime_budget != null
                              ? fmtMoney(c.lifetime_budget, c.currency)
                              : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {fmtMoney(c.spend ?? 0, c.currency)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {fmtInt(c.impressions ?? 0)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {fmtInt(c.clicks ?? 0)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {fmtInt(c.conversions ?? 0)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {fmtMoney(c.conversion_value ?? 0, c.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
