"use client"

import Link from "next/link"
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

export default function OverviewPage() {
  const { token, me } = useMerchantAuth()
  const { stats, recentOrders, loading, error } = useOverview(token)

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total sales"
          value={loading ? "—" : formatMoney(stats.totalSales, stats.currencyCode)}
          icon={Cash}
          tone="green"
        />
        <KpiCard
          label="Orders this month"
          value={loading ? "—" : stats.ordersThisMonth}
          icon={DocumentText}
          tone="brand"
        />
        <KpiCard
          label="Products live"
          value={loading ? "—" : stats.productsLive}
          icon={CubeSolid}
        />
        <KpiCard
          label="Customers"
          value={loading ? "—" : stats.customers}
          icon={UsersSolid}
        />
        <KpiCard
          label="Credit balance"
          value={loading ? "—" : `$${(Number(stats?.creditBalance) || 0).toFixed(2)}`}
          icon={CreditCard}
          tone="green"
        />
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
                  title="No orders yet"
                  description="Your recent orders will appear here once customers start buying."
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
