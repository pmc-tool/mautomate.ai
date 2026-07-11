"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DocumentText } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listOrders, Order, ApiError } from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Completed", value: "completed" },
  { label: "Canceled", value: "canceled" },
]

const columns: Column<Order>[] = [
  {
    key: "display_id",
    header: "Order #",
    render: (o) => <span className="font-medium text-grey-90">#{o.display_id}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (o) => (
      <div className="flex flex-col">
        <span className="text-grey-90">{o.customer_name || "Guest"}</span>
        {o.email && <span className="text-xs text-grey-50">{o.email}</span>}
      </div>
    ),
  },
  {
    key: "items",
    header: "Items",
    render: (o) => <span className="text-grey-60">{o.item_count ?? 0}</span>,
  },
  {
    key: "created_at",
    header: "Date",
    render: (o) => <span className="text-grey-60">{formatDate(o.created_at)}</span>,
  },
  {
    key: "payment_status",
    header: "Payment",
    render: (o) => <StatusBadge status={o.payment_status || "unknown"} />,
  },
  {
    key: "fulfillment_status",
    header: "Fulfillment",
    render: (o) => <StatusBadge status={o.fulfillment_status || "unknown"} />,
  },
  {
    key: "country",
    header: "Country",
    render: (o) => <span className="text-grey-60">{o.country_code ? o.country_code.toUpperCase() : "—"}</span>,
  },
  {
    key: "total",
    header: "Total",
    className: "text-right",
    render: (o) => <span className="font-medium text-grey-90">{formatMoney(o.total, o.currency_code)}</span>,
  },
]

export default function OrdersPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError(null)

    listOrders(token)
      .then((r) => setOrders(r.orders || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load orders")
      })
      .finally(() => setLoading(false))
  }, [token, logout])

  const filteredOrders = useMemo(() => {
    let data = orders
    if (from || to) {
      data = data.filter((o) => {
        const date = new Date(o.created_at)
        if (from && date < new Date(from)) return false
        if (to && date > new Date(to + "T23:59:59.999Z")) return false
        return true
      })
    }
    return data
  }, [orders, from, to])

  if (error && !orders.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Orders" description="Track, fulfill, and manage customer orders." />
        <EmptyState
          icon={DocumentText}
          title="Could not load orders"
          description={error}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Track, fulfill, and manage customer orders." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          />
          <span className="text-sm text-grey-50">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-base border border-grey-20 bg-white px-3 py-2 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredOrders}
        searchKeys={["display_id", "email", "customer_name"]}
        filterKey="status"
        filterOptions={statusOptions}
        pageSize={15}
        isLoading={loading}
        emptyTitle="No orders found"
        emptyDescription="No orders match your filters."
        onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
      />
    </div>
  )
}
