"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ReceiptPercent, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listDiscounts, deleteDiscount, Discount, ApiError } from "@lib/merchant-admin/api"
import { formatDate } from "@lib/merchant-admin/utils"

function formatDiscountValue(d: Discount): string {
  if (d.type === "free_shipping") return "Free shipping"
  if (d.type === "percentage") return `${d.value}%`
  return `$${(Number(d.value) || 0).toFixed(2)}`
}

export default function DiscountsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDiscounts = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listDiscounts(token)
      setItems(res.discounts || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load discounts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDiscounts()
  }, [token, logout])

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm("Are you sure you want to delete this discount?")) return
    try {
      await deleteDiscount(token, id)
      await loadDiscounts()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete discount")
    }
  }

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(items.map((d) => d.status))).sort()
    return statuses.map((s) => ({ value: s, label: s }))
  }, [items])

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(items.map((d) => d.type))).sort()
    return types.map((t) => ({ value: t, label: t }))
  }, [items])

  const columns = [
    { key: "code", header: "Code", sortable: true },
    {
      key: "type",
      header: "Type",
      render: (d: Discount) => (
        <span className="text-sm capitalize text-grey-70">{d.type.replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "value",
      header: "Value",
      render: (d: Discount) => (
        <span className="text-grey-90">{formatDiscountValue(d)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (d: Discount) => <StatusBadge status={d.status} />,
    },
    {
      key: "usage",
      header: "Usage",
      render: (d: Discount) => (
        <span className="text-grey-90">
          {d.usage_count ?? 0}
          {d.usage_limit != null ? ` / ${d.usage_limit}` : ""}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (d: Discount) => (
        <span className="text-grey-60">{d.created_at ? formatDate(d.created_at) : "—"}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Manage percentage, fixed, and free shipping discounts."
        action={
          <button
            onClick={() => router.push("/dashboard/discounts/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create discount
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<Discount>
        columns={columns}
        rows={items}
        searchKeys={["code"]}
        filterKey="status"
        filterOptions={statusOptions}
        sortKeys={[
          { key: "code", label: "Code" },
          { key: "created_at", label: "Created" },
        ]}
        rowActions={(d) => (
          <>
            <button
              onClick={() => router.push(`/dashboard/discounts/${d.id}`)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              title="Edit"
            >
              <PencilSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(d.id)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={ReceiptPercent}
        emptyTitle="No discounts yet"
        emptyDescription="Create your first discount to start driving sales."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/discounts/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create discount
          </button>
        }
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
