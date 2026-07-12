"use client"

import React, { useEffect, useState } from "react"
import { Tag, Plus, PencilSquare, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listProductTypesFull,
  createProductType,
  updateProductType,
  deleteProductType,
  ProductTypeListItem,
  ApiError,
} from "@lib/merchant-admin/api"

export default function ProductTypesPage() {
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<ProductTypeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProductTypeListItem | null>(null)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const flashNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 4000)
  }

  const loadTypes = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listProductTypesFull(token, { limit: 200 })
      setItems(res.types || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load product types")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout])

  const openCreate = () => {
    setEditing(null)
    setValue("")
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (type: ProductTypeListItem) => {
    setEditing(type)
    setValue(type.value)
    setFormError(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!token || !trimmed) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateProductType(token, editing.id, { value: trimmed })
        flashNotice(`Product type ${trimmed} was successfully updated.`)
      } else {
        await createProductType(token, { value: trimmed })
        flashNotice(`Product type ${trimmed} was successfully created.`)
      }
      setModalOpen(false)
      await loadTypes()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setFormError(err instanceof Error ? err.message : "Failed to save product type")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (type: ProductTypeListItem) => {
    if (!token) return
    if (
      !confirm(
        `You are about to delete the product type "${type.value}". This action cannot be undone.`
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteProductType(token, type.id)
      flashNotice(`Product type "${type.value}" was successfully deleted.`)
      await loadTypes()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(
        err instanceof Error ? err.message : "Failed to delete product type"
      )
    }
  }

  const columns = [
    {
      key: "value",
      header: "Value",
      sortable: true,
      render: (t: ProductTypeListItem) => (
        <span className="font-medium text-grey-90">{t.value}</span>
      ),
    },
    {
      key: "products_count",
      header: "Products",
      render: (t: ProductTypeListItem) => (
        <span className="text-grey-70">
          {t.products_count ?? 0} {t.products_count === 1 ? "product" : "products"}
        </span>
      ),
    },
  ]

  const createButton = (
    <button
      onClick={openCreate}
      className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
    >
      <Plus className="h-4 w-4" />
      Create
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Types"
        description="Organize your products into types."
        action={createButton}
      />

      {notice && (
        <div className="rounded-base border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<ProductTypeListItem>
        columns={columns}
        rows={items}
        searchKeys={["value"]}
        sortKeys={[{ key: "value", label: "Value" }]}
        pageSize={20}
        rowActions={(t) => (
          <ActionMenu
            items={[
              { label: "Edit", icon: PencilSquare, onClick: () => openEdit(t) },
              {
                label: "Delete",
                icon: Trash,
                destructive: true,
                onClick: () => handleDelete(t),
              },
            ]}
          />
        )}
        emptyIcon={Tag}
        emptyTitle="No product types"
        emptyDescription="Create your first product type to categorize your products."
        emptyAction={createButton}
        isLoading={loading}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Product Type" : "Create Product Type"}
        description="Create a new product type to categorize your products."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Value" htmlFor="type-value">
              <Input
                id="type-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. Clothing"
                autoFocus
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !value.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
