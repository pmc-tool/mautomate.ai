"use client"

import React, { useEffect, useState } from "react"
import { ChartBar, CheckCircleSolid, CurrencyDollar } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { KpiCard } from "@components/merchant-admin/kpi-card"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { usePartnerAuth } from "@lib/partner/auth"
import {
  listPartnerCommissions,
  PartnerApiError,
  PartnerCommission,
  usd,
} from "@lib/partner/api"

const SOURCE_LABEL: Record<string, string> = {
  subscription: "New subscription",
  renewal: "Plan renewal",
  topup: "Credit top-up",
  manual: "Adjustment",
}

export default function PartnerEarningsPage() {
  const { token, me, logout, refreshMe } = usePartnerAuth()
  const [rows, setRows] = useState<PartnerCommission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    refreshMe().catch(() => undefined)
    listPartnerCommissions(token)
      .then((res) => setRows(res.commissions || []))
      .catch((err) => {
        if (err instanceof PartnerApiError && err.status === 401) logout()
        else setError(err instanceof Error ? err.message : "Failed to load earnings")
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const stats = me?.stats

  const columns = [
    {
      key: "created_at",
      header: "Date",
      sortable: true,
      render: (c: PartnerCommission) => (
        <span className="text-grey-60">
          {new Date(c.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "store",
      header: "Store",
      sortable: true,
      render: (c: PartnerCommission) => (
        <span className="font-medium text-grey-90">{c.store}</span>
      ),
    },
    {
      key: "source",
      header: "Type",
      render: (c: PartnerCommission) => (
        <span className="text-grey-60">{SOURCE_LABEL[c.source] ?? c.source}</span>
      ),
    },
    {
      key: "base_cents",
      header: "Base",
      render: (c: PartnerCommission) => (
        <span className="text-grey-60">
          {usd(c.base_cents)} &times; {c.pct}%
        </span>
      ),
    },
    {
      key: "amount_cents",
      header: "Commission",
      sortable: true,
      render: (c: PartnerCommission) => (
        <span className="font-medium text-grey-90">{usd(c.amount_cents)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c: PartnerCommission) => (
        <StatusBadge
          status={c.status === "pending" && c.payout_id ? "processing" : c.status}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="Every commission you have earned from your referred stores."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Open balance"
          value={stats ? usd(stats.pending_cents) : "—"}
          icon={CurrencyDollar}
          tone="brand"
        />
        <KpiCard
          label="Paid out"
          value={stats ? usd(stats.paid_cents) : "—"}
          icon={CheckCircleSolid}
          tone="green"
        />
        <KpiCard
          label="Lifetime earnings"
          value={stats ? usd(stats.lifetime_cents) : "—"}
          icon={ChartBar}
        />
      </div>

      <DataTable<PartnerCommission>
        columns={columns}
        rows={rows}
        searchKeys={["store"]}
        filterKey="status"
        filterOptions={[
          { value: "pending", label: "Pending" },
          { value: "paid", label: "Paid" },
        ]}
        sortKeys={[
          { key: "created_at", label: "Date" },
          { key: "amount_cents", label: "Commission" },
        ]}
        emptyIcon={ChartBar}
        emptyTitle="No earnings yet"
        emptyDescription="Commissions appear here when your referred stores pay for a plan or buy credits."
        isLoading={loading}
        pageSize={20}
      />
    </div>
  )
}
