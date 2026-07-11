"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listCustomers, Customer, ApiError } from "@lib/merchant-admin/api"
import { formatDate } from "@lib/merchant-admin/utils"

export function CustomersView() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    listCustomers(token)
      .then((r) => setItems(r.customers || []))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load customers")
      })
      .finally(() => setLoading(false))
  }, [token, logout])

  const columns = [
    { key: "email", header: "Email", sortable: true },
    {
      key: "name",
      header: "Name",
      render: (row: Customer) => (
        <span className="text-grey-90">
          {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (row: Customer) => (
        <span className="text-grey-60">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="View and manage your customers."
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<Customer>
        columns={columns}
        rows={items}
        searchKeys={["email", "first_name", "last_name"]}
        sortKeys={[
          { key: "email", label: "Email" },
          { key: "created_at", label: "Joined" },
        ]}
        onRowClick={(row) => router.push(`/dashboard/customers/${row.id}`)}
        emptyIcon={Users}
        emptyTitle="No customers yet"
        emptyDescription="Customers will appear here once they place orders or sign up."
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
