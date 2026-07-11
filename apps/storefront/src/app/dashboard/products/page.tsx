"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CubeSolid, PencilSquare, Plus, Trash, Photo } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listProducts,
  deleteProduct,
  Product,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDate, formatMoney } from "@lib/merchant-admin/utils"

export default function ProductsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listProducts(token)
      setItems(res.products || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [token, logout])

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm("Are you sure you want to delete this product?")) return
    try {
      await deleteProduct(token, id)
      await loadProducts()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product")
    }
  }

  const statusOptions = useMemo(() => {
    const statuses = Array.from(new Set(items.map((p) => p.status))).sort()
    return statuses.map((s) => ({ value: s, label: s }))
  }, [items])

  const columns = [
    {
      key: "thumbnail",
      header: "",
      className: "w-14",
      render: (p: Product) =>
        p.thumbnail ? (
          <img
            src={p.thumbnail}
            alt=""
            className="h-10 w-10 rounded-base object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-base bg-grey-10">
            <Photo className="h-5 w-5 text-grey-40" />
          </div>
        ),
    },
    { key: "title", header: "Title", sortable: true },
    { key: "handle", header: "Handle", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (p: Product) => <StatusBadge status={p.status} />,
    },
    {
      key: "price",
      header: "Price",
      render: (p: Product) =>
        p.price != null && p.currency_code ? (
          <span className="text-grey-90">{formatMoney(p.price, p.currency_code)}</span>
        ) : (
          <span className="text-grey-50">-</span>
        ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (p: Product) => (
        <span className="text-grey-90">{p.stock ?? "-"}</span>
      ),
    },
    {
      key: "updated_at",
      header: "Updated",
      render: (p: Product) => (
        <span className="text-grey-60">{p.updated_at ? formatDate(p.updated_at) : "-"}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, inventory, and pricing."
        action={
          <button
            onClick={() => router.push("/dashboard/products/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<Product>
        columns={columns}
        rows={items}
        searchKeys={["title", "handle"] as (keyof Product)[]}
        filterKey="status"
        filterOptions={statusOptions}
        sortKeys={[
          { key: "updated_at" as keyof Product, label: "Updated" },
          { key: "title" as keyof Product, label: "Title" },
        ]}
        rowActions={(p) => (
          <>
            <button
              onClick={() => router.push(`/dashboard/products/${p.id}`)}
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
        emptyIcon={CubeSolid}
        emptyTitle="No products yet"
        emptyDescription="Get started by adding your first product."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/products/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        }
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
