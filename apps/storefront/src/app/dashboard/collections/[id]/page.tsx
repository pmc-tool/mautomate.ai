"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  ExclamationCircle,
  Folder,
  MagnifyingGlass,
  PencilSquare,
  Photo,
  Plus,
  Trash,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
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
import { cn } from "@lib/util/cn"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

type CollectionWithMeta = ProductCollection & { metadata?: Record<string, unknown> | null }

function Card({
  title,
  action,
  children,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          {typeof title === "string" ? (
            <h2 className="text-base font-semibold text-grey-90">{title}</h2>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

const PRODUCTS_PAGE_SIZE = 10

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [collection, setCollection] = useState<CollectionWithMeta | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  // Edit drawer
  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")

  // Add products modal
  const [addOpen, setAddOpen] = useState(false)
  const [available, setAvailable] = useState<Product[]>([])
  const [availableLoading, setAvailableLoading] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([])

  // Products table state
  const [tableSearch, setTableSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const load = async () => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [{ collection: c }, { products: p }] = await Promise.all([
        getCollection(token, id),
        listCollectionProducts(token, id),
      ])
      setCollection(c as CollectionWithMeta)
      setProducts(p || [])
      setSelectedRows([])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load collection")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  // ---- edit ----
  const openEdit = () => {
    if (!collection) return
    setTitle(collection.title)
    setHandle(collection.handle)
    setEditOpen(true)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !collection || !title.trim() || !handle.trim()) return
    setBusy("save")
    try {
      const { collection: updated } = await updateCollection(token, collection.id, {
        title: title.trim(),
        handle: handle.trim(),
      })
      setCollection((prev) => ({ ...(prev as CollectionWithMeta), ...updated }))
      setEditOpen(false)
      showMessage("success", "Collection was successfully updated.")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update collection")
    } finally {
      setBusy(null)
    }
  }

  // ---- delete collection ----
  const handleDelete = async () => {
    if (!token || !collection) return
    if (
      !confirm(
        `You are about to delete the collection ${collection.title}. This action cannot be undone.`
      )
    )
      return
    setBusy("delete")
    try {
      await deleteCollection(token, collection.id)
      router.push("/dashboard/collections")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to delete collection")
      setBusy(null)
    }
  }

  // ---- remove products ----
  const removeProducts = async (ids: string[], confirmText: string, successText: string) => {
    if (!token || !collection || ids.length === 0) return
    if (!confirm(confirmText)) return
    setBusy("remove")
    try {
      await removeProductsFromCollection(token, collection.id, ids)
      showMessage("success", successText)
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to remove product(s)")
    } finally {
      setBusy(null)
    }
  }

  const handleRemoveOne = (p: Product) =>
    removeProducts(
      [p.id],
      `You are about to remove the product ${p.title} from the collection. This action cannot be undone.`,
      "Product was successfully removed from the collection."
    )

  const handleRemoveSelected = () =>
    removeProducts(
      selectedRows,
      `You are about to remove ${selectedRows.length} product(s) from the collection. This action cannot be undone.`,
      selectedRows.length === 1
        ? "Product was successfully removed from the collection."
        : "Products were successfully removed from the collection."
    )

  // ---- add products ----
  const openAdd = async () => {
    if (!token) return
    setAddOpen(true)
    setSelectedToAdd([])
    setAddSearch("")
    setAvailableLoading(true)
    try {
      const { products: all } = await listProducts(token)
      const assigned = new Set(products.map((p) => p.id))
      setAvailable((all || []).filter((p) => !assigned.has(p.id)))
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setAvailableLoading(false)
    }
  }

  const saveAdd = async () => {
    if (!token || !collection || selectedToAdd.length === 0) return
    setBusy("add")
    try {
      await addProductsToCollection(token, collection.id, selectedToAdd)
      setAddOpen(false)
      showMessage("success", "Products were successfully added to the collection.")
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to add products")
    } finally {
      setBusy(null)
    }
  }

  // ---- table derivations ----
  const filteredProducts = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || (p.handle || "").toLowerCase().includes(q)
    )
  }, [products, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PAGE_SIZE,
    currentPage * PRODUCTS_PAGE_SIZE
  )

  useEffect(() => {
    setPage(1)
  }, [tableSearch])

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((p) => selectedRows.includes(p.id))
  const somePageSelected = pageRows.some((p) => selectedRows.includes(p.id))

  const toggleSelectAllPage = () => {
    const pageIds = pageRows.map((p) => p.id)
    if (allPageSelected) {
      setSelectedRows((prev) => prev.filter((rid) => !pageIds.includes(rid)))
    } else {
      setSelectedRows((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const availableFiltered = useMemo(() => {
    const q = addSearch.trim().toLowerCase()
    if (!q) return available
    return available.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || (p.handle || "").toLowerCase().includes(q)
    )
  }, [available, addSearch])

  const metaEntries = useMemo(() => {
    const meta = collection?.metadata
    if (!meta) return []
    return Object.entries(meta).filter(([k]) => k !== "tenant_id")
  }, [collection])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Collection" description="Loading..." />
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="space-y-6">
        <PageHeader title="Collection" description="We could not load this collection." />
        <EmptyState
          icon={Folder}
          title="Collection not found"
          description={error || "This collection does not exist or you do not have access to it."}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/collections")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to collections
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* General */}
      <Card
        title={<h1 className="text-xl font-semibold text-grey-90">{collection.title}</h1>}
        action={
          <ActionMenu
            items={[
              { label: "Edit", icon: PencilSquare, onClick: openEdit },
              { label: "Delete", icon: Trash, destructive: true, onClick: handleDelete },
            ]}
          />
        }
      >
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-grey-50">Handle</dt>
            <dd className="mt-0.5 font-medium text-grey-90">/{collection.handle}</dd>
          </div>
          <div>
            <dt className="text-grey-50">Products</dt>
            <dd className="mt-0.5 font-medium text-grey-90">
              {collection.product_count ?? products.length}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Products */}
      <Card
        title="Products"
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        }
        bodyClassName="p-0"
      >
        {products.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Folder}
              title="No products"
              description="There are no products in the collection."
              className="border-0 bg-transparent shadow-none"
              action={
                <button
                  onClick={openAdd}
                  className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
                >
                  <Plus className="h-4 w-4" />
                  Add products
                </button>
              }
            />
          </div>
        ) : (
          <div>
            {selectedRows.length > 0 ? (
              <div className="flex items-center justify-between gap-3 border-b border-grey-10 bg-grey-5 px-5 py-3">
                <span className="text-sm font-medium text-grey-90">
                  {selectedRows.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRows([])}
                    className="rounded-base px-3 py-1.5 text-sm font-medium text-grey-60 hover:text-grey-90"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleRemoveSelected}
                    disabled={busy === "remove"}
                    className="inline-flex items-center gap-1.5 rounded-base bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    <Trash className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-b border-grey-10 px-5 py-3">
                <div className="relative sm:max-w-xs">
                  <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-grey-10 text-grey-70">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allPageSelected && somePageSelected
                        }}
                        onChange={toggleSelectAllPage}
                        className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Variants</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-10">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-grey-50">
                        No products match your search.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((p) => {
                      const checked = selectedRows.includes(p.id)
                      return (
                        <tr key={p.id} className="transition-colors hover:bg-grey-5">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedRows((prev) =>
                                  checked ? prev.filter((rid) => rid !== p.id) : [...prev, p.id]
                                )
                              }
                              className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/products/${p.id}`}
                              className="flex items-center gap-3"
                            >
                              {p.thumbnail ? (
                                <img
                                  src={p.thumbnail}
                                  alt=""
                                  className="h-9 w-9 rounded-base object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-base bg-grey-10">
                                  <Photo className="h-4 w-4 text-grey-40" />
                                </div>
                              )}
                              <span className="font-medium text-grey-90 hover:underline">
                                {p.title}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-grey-70">{p.variant_count ?? 0}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end">
                              <ActionMenu
                                items={[
                                  {
                                    label: "Edit",
                                    icon: PencilSquare,
                                    onClick: () => router.push(`/dashboard/products/${p.id}`),
                                  },
                                  {
                                    label: "Remove",
                                    icon: Trash,
                                    destructive: true,
                                    onClick: () => handleRemoveOne(p),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredProducts.length > PRODUCTS_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-grey-10 px-5 py-3">
                <p className="text-xs text-grey-50">
                  Showing {(currentPage - 1) * PRODUCTS_PAGE_SIZE + 1}–
                  {Math.min(currentPage * PRODUCTS_PAGE_SIZE, filteredProducts.length)} of{" "}
                  {filteredProducts.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-grey-60">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-base border border-grey-20 px-3 py-1.5 text-xs font-medium text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Metadata */}
      {metaEntries.length > 0 && (
        <Card title="Metadata">
          <dl className="divide-y divide-grey-10">
            {metaEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                <dt className="text-grey-50">{k}</dt>
                <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* JSON */}
      <Card bodyClassName="p-0">
        <button
          type="button"
          onClick={() => setShowJson((s) => !s)}
          className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
        >
          JSON · {Object.keys(collection).length} keys
          <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
        </button>
        {showJson && (
          <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
            {JSON.stringify(collection, null, 2)}
          </pre>
        )}
      </Card>

      {/* Edit drawer */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Collection"
        description="Update the collection title and handle."
        size="sm"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Title" htmlFor="edit-title">
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer 2024"
              autoFocus
              required
            />
          </FormField>
          <FormField
            label="Handle"
            htmlFor="edit-handle"
            hint="The handle is used to reference the collection in your storefront."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-grey-40">
                /
              </span>
              <Input
                id="edit-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onBlur={() => setHandle((h) => slugify(h))}
                placeholder="summer-2024"
                className="pl-6"
                required
              />
            </div>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={busy === "save"}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save" || !title.trim() || !handle.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "save" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add products modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add products"
        description="Select products to add to this collection."
        size="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search products..."
              autoFocus
              className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
            />
          </div>

          {availableLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
            </div>
          ) : availableFiltered.length === 0 ? (
            <p className="py-8 text-center text-sm text-grey-50">
              {available.length === 0
                ? "No available products to add."
                : "No products match your search."}
            </p>
          ) : (
            <div className="max-h-80 divide-y divide-grey-10 overflow-y-auto rounded-base border border-grey-20">
              {availableFiltered.map((p) => {
                const checked = selectedToAdd.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-grey-5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedToAdd((prev) =>
                          checked ? prev.filter((rid) => rid !== p.id) : [...prev, p.id]
                        )
                      }
                      className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                    />
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="h-9 w-9 rounded-base object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-base bg-grey-10">
                        <Photo className="h-4 w-4 text-grey-40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-grey-90">{p.title}</p>
                      <p className="truncate text-xs text-grey-50">/{p.handle}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </label>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAdd}
              disabled={busy === "add" || selectedToAdd.length === 0}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "add"
                ? "Adding..."
                : `Save${selectedToAdd.length ? ` (${selectedToAdd.length})` : ""}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
