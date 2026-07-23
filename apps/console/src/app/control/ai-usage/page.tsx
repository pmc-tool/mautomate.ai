"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowPath,
  CurrencyDollar,
  Sparkles,
  CircleStack,
  ExclamationCircle,
  ChartBar,
  ReceiptPercent,
} from "@medusajs/icons"

import { useControlAuth } from "@/lib/auth"
import { getAiUsage, type AiUsageResponse } from "@/lib/api/ai-usage"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

/** Per-merchant USD is tiny — 4 decimals so single traces/credits are visible. */
const usd4 = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n || 0)

/** Totals read cleaner at 2 decimals. */
const usd2 = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0)

/** margin_pct comes back as a FRACTION (margin / revenue); render as a percent. */
const pct = (f: number | null | undefined) =>
  f === null || f === undefined ? "—" : `${(f * 100).toFixed(1)}%`

/** Margin colouring — ok (green) when we're in the black, danger (red) when not. */
const marginTone = (n: number) =>
  n >= 0 ? "text-emerald-700" : "text-red-600"

const num = (n: number) => (n || 0).toLocaleString()

const RANGES = [
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
]

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (!t) return "—"
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AiUsagePage() {
  const { token } = useControlAuth()
  const [range, setRange] = useState("7d")
  const [data, setData] = useState<AiUsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setData(await getAiUsage(token, range))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load AI usage")
    } finally {
      setLoading(false)
    }
  }, [token, range])

  useEffect(() => {
    load()
  }, [load])

  const available = data?.available !== false
  const merchants = data?.by_merchant ?? []
  const features = data?.by_feature ?? []
  const models = data?.by_model ?? []
  const recent = data?.recent ?? []

  const totalRevenue = data?.total_revenue_usd ?? 0
  const totalMargin = data?.total_margin_usd ?? 0
  const overallMarginPct = data?.overall_margin_pct ?? null

  const maxMerchantCost = Math.max(1e-9, ...merchants.map((m) => m.cost))
  // Revenue-only (Langfuse down) still counts as activity worth showing.
  const hasActivity =
    (data?.total_traces ?? 0) > 0 ||
    merchants.length > 0 ||
    recent.length > 0 ||
    totalRevenue > 0

  const headerAction = (
    <div className="flex items-center gap-2">
      <div className="flex overflow-hidden rounded-base border border-grey-20 text-sm">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "border-r border-grey-20 px-3 py-2 last:border-r-0",
              range === r.key
                ? "bg-grey-90 text-white"
                : "text-grey-60 hover:bg-grey-10"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 hover:bg-grey-10 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Usage & Cost"
        description="Platform-wide AI spend, revenue and margin across every tenant — vendor cost from Langfuse, revenue from the credit ledger."
        action={headerAction}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-large border border-grey-20 bg-grey-10"
            />
          ))}
        </div>
      ) : !available && !hasActivity ? (
        <EmptyState
          icon={ExclamationCircle}
          title="AI observability isn't reachable"
          description={
            data?.reason ||
            "Langfuse is unreachable or not configured, so AI spend can't be read right now."
          }
        />
      ) : !hasActivity ? (
        <EmptyState
          icon={Sparkles}
          title="No AI activity yet in this window"
          description="Once merchants use AI features, their spend and revenue will show up here."
        />
      ) : (
        <>
          {!available && (
            <div className="rounded-large border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {data?.reason ||
                "Langfuse is unreachable, so vendor cost is unavailable."}{" "}
              Showing revenue from the credit ledger only — margin excludes
              vendor cost.
            </div>
          )}

          {data?.truncated && (
            <div className="rounded-large border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {data.note ||
                "Results are capped; totals are exact but per-merchant and per-feature breakdowns may be partial."}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Total AI cost"
              value={usd4(data?.total_cost ?? 0)}
              icon={CurrencyDollar}
              tone="brand"
            />
            <KpiCard
              label="Total revenue"
              value={usd2(totalRevenue)}
              icon={ReceiptPercent}
              tone="green"
            />
            <KpiCard
              label="Total margin"
              value={
                <span className={marginTone(totalMargin)}>
                  {usd2(totalMargin)}
                </span>
              }
              icon={ChartBar}
              tone="green"
              trend={`${pct(overallMarginPct)} margin`}
            />
            <KpiCard
              label="Total traces"
              value={num(data?.total_traces ?? 0)}
              icon={Sparkles}
              tone="grey"
            />
            <KpiCard
              label="Total tokens"
              value={num(data?.total_tokens ?? 0)}
              icon={CircleStack}
              tone="grey"
            />
          </div>

          {/* Headline: revenue vs cost by merchant */}
          <div className="rounded-xl border border-grey-20 bg-white">
            <div className="border-b border-grey-10 px-5 py-4">
              <h3 className="text-base font-semibold text-grey-90">
                Revenue &amp; margin by merchant
              </h3>
              <p className="text-sm text-grey-50">
                What each store earned us (credits) vs what it cost us
                (Langfuse), highest revenue first.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-grey-5 text-grey-50">
                  <tr className="text-left">
                    <th className="px-5 py-2 font-medium">Merchant</th>
                    <th className="px-3 py-2 text-right font-medium">Revenue</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Margin</th>
                    <th className="px-3 py-2 text-right font-medium">Margin %</th>
                    <th className="px-3 py-2 text-right font-medium">Traces</th>
                    <th className="px-5 py-2 text-right font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-10">
                  {merchants.map((m) => {
                    const revenue = m.revenue_usd ?? 0
                    const margin =
                      m.margin_usd ?? revenue - (m.cost ?? 0)
                    return (
                      <tr key={m.tenant_id ?? m.name}>
                        <td className="px-5 py-2.5">
                          <p className="truncate font-medium text-grey-90">
                            {m.name}
                          </p>
                          <div className="mt-1 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-grey-10">
                            <span
                              className="block h-full bg-cyan-500"
                              style={{
                                width: `${(m.cost / maxMerchantCost) * 100}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-grey-90">
                          {usd4(revenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                          {usd4(m.cost)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right tabular-nums font-medium",
                            marginTone(margin)
                          )}
                        >
                          {usd4(margin)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                          {pct(m.margin_pct)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-grey-60">
                          {num(m.traces)}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-grey-60">
                          {num(m.tokens)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cost by feature */}
            <div className="rounded-xl border border-grey-20 bg-white">
              <div className="border-b border-grey-10 px-5 py-4">
                <h3 className="text-base font-semibold text-grey-90">
                  Cost by feature
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-grey-5 text-grey-50">
                    <tr className="text-left">
                      <th className="px-5 py-2 font-medium">Feature</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-5 py-2 text-right font-medium">Traces</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {features.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-5 py-6 text-center text-grey-50"
                        >
                          No feature breakdown yet.
                        </td>
                      </tr>
                    ) : (
                      features.map((f) => (
                        <tr key={f.feature}>
                          <td className="px-5 py-2.5 font-medium text-grey-90">
                            {f.feature}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-grey-90">
                            {usd4(f.cost)}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-grey-60">
                            {num(f.traces)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost by model */}
            <div className="rounded-xl border border-grey-20 bg-white">
              <div className="border-b border-grey-10 px-5 py-4">
                <h3 className="text-base font-semibold text-grey-90">
                  Cost by model
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-grey-5 text-grey-50">
                    <tr className="text-left">
                      <th className="px-5 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-5 py-2 text-right font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {models.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-5 py-6 text-center text-grey-50"
                        >
                          No model breakdown yet.
                        </td>
                      </tr>
                    ) : (
                      models.map((m) => (
                        <tr key={m.model}>
                          <td className="px-5 py-2.5 font-medium text-grey-90">
                            {m.model}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-grey-90">
                            {usd4(m.cost)}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-grey-60">
                            {num(m.tokens)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent AI activity */}
          <div className="rounded-xl border border-grey-20 bg-white">
            <div className="border-b border-grey-10 px-5 py-4">
              <h3 className="text-base font-semibold text-grey-90">
                Recent AI activity
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-grey-5 text-grey-50">
                  <tr className="text-left">
                    <th className="px-5 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Merchant</th>
                    <th className="px-3 py-2 font-medium">Feature</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-5 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-10">
                  {recent.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-6 text-center text-grey-50"
                      >
                        No recent activity.
                      </td>
                    </tr>
                  ) : (
                    recent.map((r, i) => (
                      <tr key={`${r.time}-${i}`}>
                        <td className="px-5 py-2.5 whitespace-nowrap text-grey-60">
                          {timeAgo(r.time)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-grey-90">
                          {r.merchant}
                        </td>
                        <td className="px-3 py-2.5 text-grey-70">{r.feature}</td>
                        <td className="px-3 py-2.5 text-grey-60">
                          {r.model || "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-grey-90">
                          {usd4(r.cost)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
