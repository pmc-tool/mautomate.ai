"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DocumentText, PencilSquare, Plus, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listPriceLists,
  deletePriceList,
  PriceList,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate } from "@lib/merchant-admin/utils"

export default function PriceListsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPriceLists = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listPriceLists(token)
      setItems(res.price_lists || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load price lists")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPriceLists()
  }, [token, logout])

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm("Are you sure you want to delete this price list?")) return
    try {
      await deletePriceList(token, id)
      await loadPriceLists()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete price list")
    }
  }

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(items.map((p) => p.status))).sort()
    return statuses.map((s) => ({ value: s, label: s }))
  }, [items])

  const columns = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (p: PriceList) => <StatusBadge status={p.status} />,
    },
    {
      key: "prices_count",
      header: "Prices",
      render: (p: PriceList) => <span className="text-grey-90">{p.prices_count}</span>,
    },
    {
      key: "expires_at",
      header: "Expires",
      render: (p: PriceList) => (
        <span className="text-grey-60">{p.expires_at ? formatDate(p.expires_at) : "-"}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price lists"
        description="Manage override prices for products and variants."
        action={
          <button
            onClick={() => router.push("/dashboard/price-lists/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Add price list
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<PriceList>
        columns={columns}
        rows={items}
        searchKeys={["title"]}
        filterKey="status"
        filterOptions={statusOptions}
        sortKeys={[
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
        ]}
        rowActions={(p) => (
          <>
            <button
              onClick={() => router.push(`/dashboard/price-lists/${p.id}`)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              title="Edit"
            >
              <PencilSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(p.id)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={DocumentText}
        emptyTitle="No price lists yet"
        emptyDescription="Get started by adding your first price list."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/price-lists/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Add price list
          </button>
        }
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
