"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  ExclamationCircle,
  Folder,
  PencilSquare,
  Plus,
  Trash,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { DataTable } from "@components/merchant-admin/data-table"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { Modal } from "@components/merchant-admin/modal"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCollection,
  updateCollection,
  deleteCollection,
  listCollectionProducts,
  addProductsToCollection,
  removeProductsFromCollection,
  listProducts,
  ProductCollection,
  Product,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatMoney } from "@lib/merchant-admin/utils"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token } = useMerchantAuth()

  const [collection, setCollection] = useState<ProductCollection | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  const loadData = async () => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [{ collection: c }, { products: p }, { products: all }] = await Promise.all([
        getCollection(token, id),
        listCollectionProducts(token, id),
        listProducts(token),
      ])
      setCollection(c)
      setProducts(p || [])
      const assignedIds = new Set((p || []).map((x) => x.id))
      setAllProducts((all || []).filter((x) => !assignedIds.has(x.id)))
      setTitle(c.title)
      setHandle(c.handle)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
      setError(err instanceof Error ? err.message : "Failed to load collection")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, id])

  useEffect(() => {
    if (!handleEdited) setHandle(slugify(title))
  }, [title, handleEdited])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !collection) return
    setSaving(true)
    setError(null)
    try {
      const { collection: updated } = await updateCollection(token, collection.id, {
        title,
        handle,
      })
      setCollection(updated)
      setEditing(false)
      setSaveMessage("Collection saved")
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save collection")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !collection) return
    if (!confirm("Delete this collection? Products in it will be unassigned.")) return
    try {
      await deleteCollection(token, collection.id)
      router.push("/dashboard/collections")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection")
    }
  }

  const handleRemoveProduct = async (productId: string) => {
    if (!token || !collection) return
    if (!confirm("Remove this product from the collection?")) return
    try {
      await removeProductsFromCollection(token, collection.id, [productId])
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove product")
    }
  }

  const handleAddProducts = async () => {
    if (!token || !collection || selectedProductIds.length === 0) return
    setAdding(true)
    try {
      await addProductsToCollection(token, collection.id, selectedProductIds)
      setSelectedProductIds([])
      setAddModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add products")
    } finally {
      setAdding(false)
    }
  }

  const productColumns = useMemo(
    () => [
      {
        key: "title",
        header: "Title",
        render: (p: Product) => (
          <Link
            href={`/dashboard/products/${p.id}`}
            className="font-medium text-grey-90 hover:underline"
          >
            {p.title}
          </Link>
        ),
      },
      { key: "handle", header: "Handle" },
      {
        key: "status",
        header: "Status",
        render: (p: Product) => <StatusBadge status={p.status} />,
      },
      {
        key: "price",
        header: "Price",
        render: (p: Product) =>
          p.price != null && p.currency_code ? formatMoney(p.price, p.currency_code) : "—",
      },
    ],
    []
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="space-y-6">
        <PageHeader title="Collection" description="We could not load this collection." />
        <div className="rounded-large border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <ExclamationCircle className="mx-auto mb-2 h-6 w-6" />
          {error || "Collection not found."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/collections"
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title={collection.title}
          description={`Handle: ${collection.handle}`}
          action={
            <ActionMenu
              items={[
                { label: "Edit", onClick: () => setEditing(true), icon: PencilSquare },
                { label: "Delete", onClick: handleDelete, icon: Trash, destructive: true },
              ]}
            />
          }
        />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="flex items-center gap-2 rounded-base border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <Check className="h-4 w-4" />
          {saveMessage}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="space-y-6">
          <SectionCard title="Details" description="Edit collection information.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Title" htmlFor="title">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer 2024"
                  required
                />
              </FormField>
              <FormField label="Handle" htmlFor="handle">
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value)
                    setHandleEdited(true)
                  }}
                  placeholder="summer-2024"
                  required
                />
              </FormField>
            </div>
          </SectionCard>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <TwoColumnLayout
          sidebar={
            <SectionCard title="Summary" description="Collection overview.">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-grey-50">Handle</dt>
                  <dd className="font-medium text-grey-90">{collection.handle}</dd>
                </div>
                <div>
                  <dt className="text-grey-50">Products</dt>
                  <dd className="font-medium text-grey-90">{collection.product_count ?? products.length}</dd>
                </div>
              </dl>
            </SectionCard>
          }
        >
          <SectionCard
            title="Products"
            description="Products assigned to this collection."
            action={
              <button
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80"
              >
                <Plus className="h-4 w-4" />
                Add products
              </button>
            }
          >
            {products.length > 0 ? (
              <DataTable<Product>
                columns={productColumns}
                rows={products}
                searchKeys={["title", "handle"]}
                pageSize={10}
                rowActions={(p) => (
                  <button
                    onClick={() => handleRemoveProduct(p.id)}
                    className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-grey-50">
                <Folder className="mb-2 h-8 w-8" />
                <p className="text-sm">No products in this collection yet.</p>
              </div>
            )}
          </SectionCard>
        </TwoColumnLayout>
      )}

      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add products"
        description="Select products to add to this collection."
      >
        <div className="space-y-4">
          {allProducts.length === 0 ? (
            <p className="text-sm text-grey-50">No available products to add.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-base border border-grey-20">
              {allProducts.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-grey-10 px-4 py-3 last:border-0 hover:bg-grey-5"
                >
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={(e) => {
                      setSelectedProductIds((prev) =>
                        e.target.checked
                          ? [...prev, p.id]
                          : prev.filter((id) => id !== p.id)
                      )
                    }}
                    className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-grey-90">{p.title}</p>
                    <p className="text-xs text-grey-50">{p.handle}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              onClick={() => setAddModalOpen(false)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              onClick={handleAddProducts}
              disabled={adding || selectedProductIds.length === 0}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? "Adding..." : `Add ${selectedProductIds.length || ""} product${selectedProductIds.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
