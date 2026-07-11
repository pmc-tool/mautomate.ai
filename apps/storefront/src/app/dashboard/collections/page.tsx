"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Folder, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { listCollections, deleteCollection, ProductCollection, ApiError } from "@lib/merchant-admin/api"

export default function CollectionsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<ProductCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCollections = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listCollections(token)
      setItems(res.collections || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load collections")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCollections()
  }, [token, logout])

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm("Are you sure you want to delete this collection? Products in it will be unassigned.")) return
    try {
      await deleteCollection(token, id)
      await loadCollections()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete collection")
    }
  }

  const columns = [
    { key: "title", header: "Title", sortable: true },
    { key: "handle", header: "Handle", sortable: true },
    {
      key: "product_count",
      header: "Products",
      render: (c: ProductCollection) => (
        <span className="text-grey-90">{c.product_count ?? 0}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Manage product collections."
        action={
          <button
            onClick={() => router.push("/dashboard/collections/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create collection
          </button>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<ProductCollection>
        columns={columns}
        rows={items}
        searchKeys={["title", "handle"]}
        sortKeys={[
          { key: "title", label: "Title" },
          { key: "product_count", label: "Products" },
        ]}
        rowActions={(c) => (
          <>
            <button
              onClick={() => router.push(`/dashboard/collections/${c.id}`)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
              title="Edit"
            >
              <PencilSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(c.id)}
              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </button>
          </>
        )}
        emptyIcon={Folder}
        emptyTitle="No collections yet"
        emptyDescription="Get started by adding your first collection."
        emptyAction={
          <button
            onClick={() => router.push("/dashboard/collections/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create collection
          </button>
        }
        isLoading={loading}
        pageSize={10}
      />
    </div>
  )
}
