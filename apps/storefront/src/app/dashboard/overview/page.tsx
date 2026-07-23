"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Cash,
  DocumentText,
  CubeSolid,
  UsersSolid,
  CreditCard,
  ArrowUpRightOnBox,
  Plus,
  Globe,
  Bolt,
} from "@medusajs/icons"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { useOverview } from "@lib/merchant-admin/hooks"
import type { OverviewRange, OverviewSeriesPoint } from "@lib/merchant-admin/api"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { SetupChecklist } from "@components/merchant-admin/setup-checklist"
import { cn } from "@lib/util/cn"

function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  const safeAmount = amount ?? 0
  const safeCurrency = currency || "USD"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: safeCurrency.toUpperCase(),
  }).format(safeAmount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// -----------------------------
// Period filter
// -----------------------------

type PeriodId = "today" | "7d" | "30d" | "month" | "year" | "all" | "custom"

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function computeRange(id: PeriodId, custom: { from: string; to: string }): OverviewRange {
  const now = new Date()
  switch (id) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString(), label: "Today" }
    case "7d": {
      const f = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
      return { from: f.toISOString(), to: endOfDay(now).toISOString(), label: "Last 7 days" }
    }
    case "30d": {
      const f = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))
      return { from: f.toISOString(), to: endOfDay(now).toISOString(), label: "Last 30 days" }
    }
    case "month": {
      const f = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: f.toISOString(), to: endOfDay(now).toISOString(), label: "This month" }
    }
    case "year": {
      const f = new Date(now.getFullYear(), 0, 1)
      return { from: f.toISOString(), to: endOfDay(now).toISOString(), label: "This year" }
    }
    case "all":
      return { label: "All time" }
    case "custom": {
      const f = custom.from ? startOfDay(new Date(custom.from)) : undefined
      const t = custom.to ? endOfDay(new Date(custom.to)) : undefined
      const label =
        f || t
          ? `${custom.from || "…"} → ${custom.to || "…"}`
          : "All time"
      return { from: f?.toISOString(), to: t?.toISOString(), label }
    }
  }
}

function PeriodFilter({
  periodId,
  setPeriodId,
  custom,
  setCustom,
}: {
  periodId: PeriodId
  setPeriodId: (id: PeriodId) => void
  custom: { from: string; to: string }
  setCustom: (c: { from: string; to: string }) => void
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white p-3 shadow-borders-base">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-grey-50">Period</span>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodId(p.id)}
            className={cn(
              "rounded-base px-3 py-1.5 text-sm font-medium transition-colors",
              periodId === p.id
                ? "bg-grey-90 text-white"
                : "border border-grey-20 bg-white text-grey-70 hover:bg-grey-10"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setPeriodId("custom")}
          className={cn(
            "rounded-base px-3 py-1.5 text-sm font-medium transition-colors",
            periodId === "custom"
              ? "bg-grey-90 text-white"
              : "border border-grey-20 bg-white text-grey-70 hover:bg-grey-10"
          )}
        >
          Custom
        </button>
      </div>

      {periodId === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-grey-10 pt-3">
          <label className="flex items-center gap-2 text-sm text-grey-60">
            From
            <input
              type="date"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              className="rounded-base border border-grey-20 px-2 py-1 text-sm text-grey-90"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-grey-60">
            To
            <input
              type="date"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              className="rounded-base border border-grey-20 px-2 py-1 text-sm text-grey-90"
            />
          </label>
        </div>
      )}
    </div>
  )
}

// -----------------------------
// Sales-by-day (or by-month) chart
// -----------------------------

function SalesChart({
  series,
  currency,
  granularityLabel,
}: {
  series: OverviewSeriesPoint[]
  currency: string
  granularityLabel: string
}) {
  if (!series || series.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-grey-50">
        No sales in this period yet.
      </div>
    )
  }

  const max = Math.max(...series.map((p) => p.sales), 1)
  const step = Math.max(1, Math.ceil(series.length / 12))

  return (
    <div>
      <p className="mb-3 text-xs text-grey-50">Sales {granularityLabel}</p>
      <div className="flex h-40 items-end gap-1">
        {series.map((p) => (
          <div
            key={p.key}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${p.label}: ${formatMoney(p.sales, currency)} · ${p.orders} order${
              p.orders === 1 ? "" : "s"
            }`}
          >
            <div
              className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600"
              style={{
                height: `${(p.sales / max) * 100}%`,
                minHeight: p.sales > 0 ? 3 : 0,
              }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-grey-90 px-2 py-1 text-[11px] text-white group-hover:block">
              {p.label}: {formatMoney(p.sales, currency)} · {p.orders} order
              {p.orders === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        {series.map((p, i) => (
          <span
            key={p.key}
            className="flex-1 truncate text-center text-[10px] text-grey-40"
          >
            {i % step === 0 ? p.label : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const { token, me } = useMerchantAuth()

  const [periodId, setPeriodId] = useState<PeriodId>("month")
  const [custom, setCustom] = useState({ from: "", to: "" })

  const range = useMemo(() => computeRange(periodId, custom), [periodId, custom.from, custom.to])

  const { stats, recentOrders, loading, error } = useOverview(token, range)

  const periodLabel = stats.periodLabel || "This month"
  const storeUrl = me?.store.slug ? `https://${me.store.slug}.mautomate.ai` : ""

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Manage ${me?.store.name || "your store"} from one place.`}
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-grey-90">
              Welcome back, {me?.merchant.name || me?.merchant.email}
            </h2>
            <p className="mt-0.5 text-sm text-grey-50">
              {me?.store.name} ·{" "}
              <span className="text-grey-70">{me?.store.domain || storeUrl.replace("https://", "")}</span>
            </p>
          </div>
          {storeUrl && (
            <button
              onClick={() => navigator.clipboard.writeText(storeUrl)}
              className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-colors hover:bg-grey-10"
            >
              <ArrowUpRightOnBox className="h-4 w-4" />
              Copy store link
            </button>
          )}
        </div>
      </div>

      <SetupChecklist token={token} />

      <PeriodFilter
        periodId={periodId}
        setPeriodId={setPeriodId}
        custom={custom}
        setCustom={setCustom}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total sales"
          value={loading ? "—" : formatMoney(stats.totalSales, stats.currencyCode)}
          icon={Cash}
          tone="green"
          trend={periodLabel}
        />
        <KpiCard
          label="Orders"
          value={loading ? "—" : stats.ordersThisMonth}
          icon={DocumentText}
          tone="brand"
          trend={periodLabel}
        />
        <KpiCard
          label="Products live"
          value={loading ? "—" : stats.productsLive}
          icon={CubeSolid}
          trend="Current"
        />
        <KpiCard
          label={periodId === "all" ? "Customers" : "New customers"}
          value={loading ? "—" : stats.customers}
          icon={UsersSolid}
          trend={periodLabel}
        />
        <KpiCard
          label="Credit balance"
          value={loading ? "—" : `$${(Number(stats?.creditBalance) || 0).toFixed(2)}`}
          icon={CreditCard}
          tone="green"
          trend="Current"
        />
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-grey-90">Sales</h3>
          <span className="text-sm text-grey-50">{periodLabel}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-grey-50">Loading…</div>
        ) : (
          <SalesChart
            series={stats.series || []}
            currency={stats.currencyCode}
            granularityLabel={stats.granularity === "month" ? "by month" : "by day"}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
            <div className="flex items-center justify-between border-b border-grey-10 px-5 py-4">
              <h3 className="font-semibold text-grey-90">Recent orders</h3>
              <Link
                href="/dashboard/orders"
                className="text-sm font-medium text-grey-60 hover:text-grey-90"
              >
                View all
              </Link>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-grey-50">Loading orders…</div>
            ) : recentOrders.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No orders in this period"
                  description="Orders placed in the selected period will appear here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-grey-5 text-grey-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Order</th>
                      <th className="px-5 py-3 text-left font-medium">Customer</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-left font-medium">Total</th>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-grey-5">
                        <td className="px-5 py-3 font-medium text-grey-90">
                          #{order.display_id}
                        </td>
                        <td className="px-5 py-3 text-grey-60">{order.email || "—"}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-5 py-3 font-medium text-grey-90">
                          {formatMoney(order.total, order.currency_code)}
                        </td>
                        <td className="px-5 py-3 text-grey-50">{formatDate(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
            <h3 className="mb-4 font-semibold text-grey-90">Quick actions</h3>
            <div className="space-y-2">
              <QuickAction href="/dashboard/products" icon={Plus} label="Add product" />
              <QuickAction
                href={storeUrl || "#"}
                external
                icon={ArrowUpRightOnBox}
                label="View store"
              />
              <QuickAction href="/dashboard/domains" icon={Globe} label="Connect domain" />
              <QuickAction href="/dashboard/settings" icon={Bolt} label="Top-up credits" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  external?: boolean
}) {
  const base =
    "flex items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium transition-colors"
  const enabled = "text-grey-70 hover:bg-grey-10 hover:text-grey-90"
  const disabled = "pointer-events-none text-grey-30"

  const content = (
    <>
      <Icon className="h-5 w-5" />
      {label}
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(base, href === "#" ? disabled : enabled)}
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={href} className={cn(base, enabled)}>
      {content}
    </Link>
  )
}
