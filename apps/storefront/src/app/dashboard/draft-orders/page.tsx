"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DocumentText, Plus } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable, Column } from "@components/merchant-admin/data-table"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listDraftOrders, DraftOrder, ApiError } from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

const columns: Column<DraftOrder>[] = [
  {
    key: "display_id",
    header: "Draft #",
    render: (d) => <span className="font-medium text-grey-90">#{d.display_id}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (d) => (
      <div className="flex flex-col">
        <span className="text-grey-90">{d.customer_name || "Guest"}</span>
        {d.email && <span className="text-xs text-grey-50">{d.email}</span>}
      </div>
    ),
  },
  {
    key: "created_at",
    header: "Date",
    render: (d) => <span className="text-grey-60">{formatDate(d.created_at)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (d) => <StatusBadge status={d.status} />,
  },
  {
    key: "total",
    header: "Total",
    className: "text-right",
    render: (d) => <span className="font-medium text-grey-90">{formatMoney(d.total, d.currency_code)}</span>,
  },
]

export default function DraftOrdersPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()

  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError(null)

    listDraftOrders(token)
      .then((r) => setDraftOrders(r.draft_orders || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load draft orders")
      })
      .finally(() => setLoading(false))
  }, [token, logout])

  if (error && !draftOrders.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Draft orders" description="Create and manage draft orders." />
        <EmptyState icon={DocumentText} title="Could not load draft orders" description={error} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draft orders"
        description="Create and manage draft orders before converting them."
        action={
          <button
            onClick={() => router.push("/dashboard/draft-orders/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create draft order
          </button>
        }
      />

      <DataTable
        columns={columns}
        rows={draftOrders}
        searchKeys={["display_id", "email", "customer_name"]}
        pageSize={15}
        isLoading={loading}
        emptyIcon={DocumentText}
        emptyTitle="No draft orders"
        emptyDescription="Create your first draft order to get started."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/draft-orders/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create draft order
          </button>
        }
      />
    </div>
  )
}
