"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FolderOpen, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listCategories, ProductCategory, ApiError } from "@lib/merchant-admin/api"

export default function CategoriesPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listCategories(token)
      setItems(res.categories || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [token, logout])

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(items.map((c) => c.status))).sort()
    return statuses.map((s) => ({ value: s, label: s }))
  }, [items])

  const columns = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (c: ProductCategory) => (
        <div className="flex flex-col">
          <span className="text-grey-90">{c.name}</span>
          {c.parent && <span className="text-xs text-grey-50">under {c.parent.name}</span>}
        </div>
      ),
    },
    { key: "handle", header: "Handle", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (c: ProductCategory) => <StatusBadge status={c.status} />,
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (c: ProductCategory) => (
        <span className="text-sm capitalize text-grey-70">{c.visibility}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage product categories."
        action={
          <button
            onClick={() => router.push("/dashboard/categories/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create category
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<ProductCategory>
        columns={columns}
        rows={items}
        searchKeys={["name", "handle"]}
        filterKey="status"
        filterOptions={statusOptions}
        sortKeys={[
          { key: "name", label: "Name" },
          { key: "handle", label: "Handle" },
        ]}
        rowActions={() => (
          <>
            <button className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90">
              <PencilSquare className="h-4 w-4" />
            </button>
            <button className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600">
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={FolderOpen}
        emptyTitle="No categories yet"
        emptyDescription="Get started by adding your first category."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/categories/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create category
          </button>
        }
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
