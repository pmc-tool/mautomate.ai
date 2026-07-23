"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftMini,
  ChartBar,
  ChartPie,
  ChatBubbleLeftRight,
  Clock,
  Phone,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallCenterAnalytics,
  type CallCenterAnalytics,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { cn } from "@lib/util/cn"

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

const dateInputCls =
  "rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"

export default function AnalyticsPage() {
  const { token } = useMerchantAuth()
  const [analytics, setAnalytics] = useState<CallCenterAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toDateInputValue(d)
  })
  const [to, setTo] = useState(() => toDateInputValue(new Date()))

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getCallCenterAnalytics(token, {
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    })
      .then(setAnalytics)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load analytics"))
      .finally(() => setLoading(false))
  }, [token, from, to])

  const summary = analytics?.summary

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/calls"
        className="inline-flex items-center gap-1 text-sm text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" /> Call center
      </Link>

      <PageHeader
        title="Analytics"
        description="Connect rate, containment, and handle time for your voice agents."
        action={
          <div className="flex flex-wrap items-center gap-2 rounded-large border border-grey-20 bg-white p-2 shadow-borders-base">
            <label className="flex items-center gap-2 text-xs font-medium text-grey-50">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={dateInputCls}
              />
            </label>
            <span className="hidden text-grey-30 sm:inline">–</span>
            <label className="flex items-center gap-2 text-xs font-medium text-grey-50">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={dateInputCls}
              />
            </label>
          </div>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total calls"
          value={(summary?.total ?? 0).toLocaleString()}
          icon={ChatBubbleLeftRight}
          chip="bg-sky-50 text-sky-600"
          loading={loading}
        />
        <StatTile
          label="Connect rate"
          value={`${((summary?.connect_rate ?? 0) * 100).toFixed(1)}%`}
          icon={Phone}
          chip="bg-emerald-50 text-emerald-600"
          loading={loading}
        />
        <StatTile
          label="Containment"
          value={`${((summary?.containment_rate ?? 0) * 100).toFixed(1)}%`}
          icon={ChartPie}
          chip="bg-violet-50 text-violet-600"
          loading={loading}
        />
        <StatTile
          label="Avg handle time"
          value={`${Math.round(summary?.avg_handle_time ?? 0)}s`}
          icon={Clock}
          chip="bg-amber-50 text-amber-600"
          loading={loading}
        />
      </div>

      {loading && !analytics ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-large border border-grey-20 bg-grey-10"
            />
          ))}
        </div>
      ) : (
        analytics && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownCard
              title="Outcomes"
              description="How conversations ended."
              data={analytics.outcomes}
              emptyText="No outcome data for this range."
            />
            <BreakdownCard
              title="By status"
              description="Where calls landed in the pipeline."
              data={analytics.by_status}
              emptyText="No status data for this range."
            />
            <BreakdownCard
              title="Sentiment"
              description="How callers felt, judged from the transcript."
              data={analytics.sentiment}
              emptyText="No sentiment data for this range."
            />
            <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
              <h3 className="text-sm font-semibold text-grey-90">Calls by day</h3>
              <p className="mt-0.5 text-xs text-grey-50">Daily call volume in this range.</p>
              <div className="mt-4">
                {analytics.by_day.length === 0 ? (
                  <EmptyState
                    icon={ChartBar}
                    title="No daily data for this range"
                    description="Pick a wider date range to see daily volume."
                    className="border-0 bg-transparent p-4 shadow-none"
                  />
                ) : (
                  <DayBarChart data={analytics.by_day} />
                )}
              </div>
            </div>
          </div>
        )
      )}

      {analytics?.kpis_note && (
        <p className="text-xs text-grey-50">{analytics.kpis_note}</p>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  icon: Icon,
  chip,
  loading,
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  chip: string
  loading?: boolean
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-grey-50">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-6 w-20 animate-pulse rounded-base bg-grey-10" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-grey-90">
              {value}
            </p>
          )}
        </div>
        <div className={cn("shrink-0 rounded-base p-2", chip)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  description,
  data,
  emptyText,
}: {
  title: string
  description: string
  data: Record<string, number>
  emptyText: string
}) {
  const entries = useMemo(
    () => Object.entries(data || {}).sort((a, b) => b[1] - a[1]),
    [data]
  )
  const max = Math.max(1, ...entries.map(([, count]) => count))

  return (
    <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
      <h3 className="text-sm font-semibold text-grey-90">{title}</h3>
      <p className="mt-0.5 text-xs text-grey-50">{description}</p>
      <div className="mt-4">
        {entries.length === 0 ? (
          <EmptyState
            icon={ChartPie}
            title={emptyText}
            className="border-0 bg-transparent p-4 shadow-none"
          />
        ) : (
          <div className="space-y-3">
            {entries.map(([key, count]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <StatusBadge status={key} />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-10">
                  <div
                    className="h-full rounded-full bg-grey-90"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-grey-90">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DayBarChart({
  data,
}: {
  data: { date: string; count: number; cost: number }[]
}) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.date} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-xs tabular-nums text-grey-50">{d.date}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-grey-10">
            <div
              className="h-full rounded-full bg-grey-90"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-grey-90">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  )
}
