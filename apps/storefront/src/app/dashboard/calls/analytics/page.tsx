"use client"

import { useEffect, useMemo, useState } from "react"
import { ChartBar, ChartPie } from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCallCenterAnalytics,
  type CallCenterAnalytics,
} from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

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
      <PageHeader
        title="Call Center Analytics"
        description="Connect rate, containment, handle time, and cost."
      />

      <div className="flex flex-col gap-3 rounded-large border border-grey-20 bg-white p-4 shadow-borders-base sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-grey-70">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-grey-70">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-base border border-grey-20 px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total calls" value={loading ? "—" : summary?.total ?? 0} icon={ChartBar} />
        <KpiCard
          label="Connect rate"
          value={loading ? "—" : `${((summary?.connect_rate ?? 0) * 100).toFixed(1)}%`}
          icon={ChartPie}
          tone="green"
        />
        <KpiCard
          label="Containment"
          value={loading ? "—" : `${((summary?.containment_rate ?? 0) * 100).toFixed(1)}%`}
          icon={ChartPie}
          tone="brand"
        />
        <KpiCard
          label="Avg handle time"
          value={loading ? "—" : `${Math.round(summary?.avg_handle_time ?? 0)}s`}
          icon={ChartBar}
        />
        <KpiCard
          label="Total cost"
          value={loading ? "—" : `$${(summary?.total_cost ?? 0).toFixed(2)}`}
          icon={ChartBar}
        />
      </div>

      {analytics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BreakdownCard
            title="Outcomes"
            data={analytics.outcomes}
            emptyText="No outcome data for this range."
          />
          <BreakdownCard
            title="By status"
            data={analytics.by_status}
            emptyText="No status data for this range."
          />
          <BreakdownCard
            title="Sentiment"
            data={analytics.sentiment}
            emptyText="No sentiment data for this range."
          />
          <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
            <h3 className="mb-4 font-semibold text-grey-90">Calls by day</h3>
            {analytics.by_day.length === 0 ? (
              <p className="text-sm text-grey-50">No daily data for this range.</p>
            ) : (
              <DayBarChart data={analytics.by_day} />
            )}
          </div>
        </div>
      )}

      {analytics?.kpis_note && (
        <p className="text-xs text-grey-50">{analytics.kpis_note}</p>
      )}
    </div>
  )
}

function BreakdownCard({
  title,
  data,
  emptyText,
}: {
  title: string
  data: Record<string, number>
  emptyText: string
}) {
  const entries = useMemo(() => Object.entries(data || {}).sort((a, b) => b[1] - a[1]), [data])
  return (
    <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
      <h3 className="mb-4 font-semibold text-grey-90">{title}</h3>
      {entries.length === 0 ? (
        <EmptyState title={emptyText} icon={ChartPie} className="p-4" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, count]) => (
            <div
              key={key}
              className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm shadow-borders-base"
            >
              <StatusBadge status={key} />
              <span className="font-medium text-grey-90">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DayBarChart({ data }: { data: { date: string; count: number; cost: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.date} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-grey-60">{d.date}</span>
          <div className="flex-1">
            <div
              className="h-4 rounded-base bg-cyan-600"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 text-right font-medium text-grey-90">{d.count}</span>
          <span className="w-16 text-right text-grey-50">${(Number(d.cost) || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
