"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUturnLeft, DocumentText } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listReturns, Return, ApiError } from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

const columns: Column<Return>[] = [
  {
    key: "display_id",
    header: "Return #",
    render: (r) => <span className="font-medium text-grey-90">#{r.display_id}</span>,
  },
  {
    key: "order_display_id",
    header: "Order #",
    render: (r) => <span className="text-grey-90">#{r.order_display_id || "—"}</span>,
  },
  {
    key: "created_at",
    header: "Date",
    render: (r) => <span className="text-grey-60">{formatDate(r.created_at)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "item_count",
    header: "Items",
    render: (r) => <span className="text-grey-90">{r.item_count ?? 0}</span>,
  },
  {
    key: "refund_amount",
    header: "Refund",
    className: "text-right",
    render: (r) => (
      <span className="font-medium text-grey-90">
        {r.refund_amount ? formatMoney(r.refund_amount, "USD") : "—"}
      </span>
    ),
  },
]

export default function ReturnsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()

  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError(null)

    listReturns(token)
      .then((r) => setReturns(r.returns || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load returns")
      })
      .finally(() => setLoading(false))
  }, [token, logout])

  if (error && !returns.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Returns" description="Manage customer returns." />
        <EmptyState icon={DocumentText} title="Could not load returns" description={error} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Returns" description="Track and manage customer returns." />

      <DataTable
        columns={columns}
        rows={returns}
        searchKeys={["display_id", "order_display_id"]}
        pageSize={15}
        isLoading={loading}
        emptyIcon={ArrowUturnLeft}
        emptyTitle="No returns"
        emptyDescription="Returns created from orders will appear here."
      />
    </div>
  )
}
