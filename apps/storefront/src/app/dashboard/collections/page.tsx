"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Folder, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listCollections,
  deleteCollection,
  ProductCollection,
  ApiError,
} from "@lib/merchant-admin/api"

export default function CollectionsPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const [items, setItems] = useState<ProductCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ProductCollection | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout])

  const openDelete = (collection: ProductCollection) => {
    setDeleteTarget(collection)
    setConfirmText("")
  }

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteCollection(token, deleteTarget.id)
      setDeleteTarget(null)
      setConfirmText("")
      await loadCollections()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection")
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (c: ProductCollection) => (
        <span className="font-medium text-grey-90">{c.title}</span>
      ),
    },
    {
      key: "handle",
      header: "Handle",
      sortable: true,
      render: (c: ProductCollection) => (
        <span className="text-grey-60">/{c.handle}</span>
      ),
    },
    {
      key: "product_count",
      header: "Products",
      render: (c: ProductCollection) => (
        <span className="text-grey-90">{c.product_count ? c.product_count : ""}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Organize products into collections."
        action={
          <button
            onClick={() => router.push("/dashboard/collections/create")}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
          >
            <Plus className="h-4 w-4" />
            Create
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
          { key: "handle", label: "Handle" },
        ]}
        onRowClick={(c) => router.push(`/dashboard/collections/${c.id}`)}
        rowActions={(c) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionMenu
              items={[
                {
                  label: "Edit",
                  icon: PencilSquare,
                  onClick: () => router.push(`/dashboard/collections/${c.id}`),
                },
                {
                  label: "Delete",
                  icon: Trash,
                  destructive: true,
                  onClick: () => openDelete(c),
                },
              ]}
            />
          </div>
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
            Create
          </button>
        }
        isLoading={loading}
        pageSize={20}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Are you sure?"
        description={
          deleteTarget
            ? `You are about to delete the collection ${deleteTarget.title}. This action cannot be undone.`
            : ""
        }
        size="sm"
      >
        <div className="space-y-4">
          <FormField label={`Please type ${deleteTarget?.title ?? ""} to confirm:`} htmlFor="confirm-title">
            <Input
              id="confirm-title"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              placeholder={deleteTarget?.title ?? ""}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting || confirmText !== deleteTarget?.title}
              className="inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
