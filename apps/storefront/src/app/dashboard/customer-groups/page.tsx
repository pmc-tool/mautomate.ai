"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listCustomerGroups, CustomerGroup, ApiError } from "@lib/merchant-admin/api"

export default function CustomerGroupsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<CustomerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGroups = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listCustomerGroups(token)
      setItems(res.groups || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load customer groups")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [token, logout])

  const handleDelete = (group: CustomerGroup) => {
    if (!confirm(`Delete customer group "${group.name}"?`)) return
    setItems((prev) => prev.filter((g) => g.id !== group.id))
  }

  const columns = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "customer_count",
      header: "Customers",
      render: (g: CustomerGroup) => <span className="text-grey-90">{g.customer_count ?? 0}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer groups"
        description="Organize customers into groups."
        action={
          <button
            onClick={() => router.push("/dashboard/customer-groups/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create group
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<CustomerGroup>
        columns={columns}
        rows={items}
        searchKeys={["name"]}
        sortKeys={[
          { key: "name", label: "Name" },
          { key: "customer_count", label: "Customers" },
        ]}
        rowActions={(g) => (
          <>
            <button
              onClick={() => alert(`Edit ${g.name}`)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              title="Edit"
            >
              <PencilSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(g)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={Users}
        emptyTitle="No customer groups"
        emptyDescription="Create your first customer group to get started."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/customer-groups/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create group
          </button>
        }
        isLoading={loading}
      />
    </div>
  )
}
