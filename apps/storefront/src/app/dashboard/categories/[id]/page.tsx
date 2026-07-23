"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  FolderOpen,
  PencilSquare,
  Trash,
  Plus,
  PlusMini,
  MagnifyingGlass,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getCategory,
  updateCategory,
  deleteCategory,
  listCategoryProducts,
  batchCategoryProducts,
  listCategories,
  listProducts,
  CategoryDetail,
  ProductCategory,
  Product,
  ApiError,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

type Tone = "green" | "red" | "blue" | "grey"

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800",
  red: "bg-rose-50 text-rose-800",
  blue: "bg-sky-50 text-sky-800",
  grey: "bg-grey-10 text-grey-70",
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "green" && "bg-emerald-500",
          tone === "red" && "bg-rose-500",
          tone === "blue" && "bg-sky-500",
          tone === "grey" && "bg-grey-40"
        )}
      />
      {children}
    </span>
  )
}

type EditForm = {
  name: string
  handle: string
  description: string
  status: "active" | "inactive"
  visibility: "public" | "internal"
  parent_category_id: string
}

type MetaRow = { key: string; value: string }

const PAGE_SIZE = 10

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [category, setCategory] = useState<CategoryDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [allCats, setAllCats] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  // products table
  const [productQuery, setProductQuery] = useState("")
  const [productPage, setProductPage] = useState(1)

  // edit drawer
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<EditForm>({
    name: "",
    handle: "",
    description: "",
    status: "active",
    visibility: "public",
    parent_category_id: "",
  })
  const [saving, setSaving] = useState(false)

  // add products modal
  const [addOpen, setAddOpen] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [addSearch, setAddSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  // metadata modal
  const [metaOpen, setMetaOpen] = useState(false)
  const [metaRows, setMetaRows] = useState<MetaRow[]>([])
  const [metaSaving, setMetaSaving] = useState(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [{ category: cat }, prod, cats] = await Promise.all([
        getCategory(token, id),
        listCategoryProducts(token, id, { limit: 200 }),
        listCategories(token),
      ])
      setCategory(cat)
      setProducts(prod.products || [])
      setAllCats(cats.categories || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load category")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  const catById = useMemo(() => new Map(allCats.map((c) => [c.id, c])), [allCats])

  // Full ancestor path using the flat category list.
  const path = useMemo(() => {
    if (!category) return [] as { id: string; name: string }[]
    const chain: { id: string; name: string }[] = [{ id: category.id, name: category.name }]
    let pid = category.parent_category?.id ?? null
    const guard = new Set<string>([category.id])
    while (pid && !guard.has(pid)) {
      guard.add(pid)
      const node = catById.get(pid)
      if (!node) break
      chain.unshift({ id: node.id, name: node.name })
      pid = node.parent?.id ?? null
    }
    return chain
  }, [category, catById])

  // Parent options for the edit drawer (exclude self + descendants).
  const parentOptions = useMemo(() => {
    if (!category) return allCats
    const descendants = new Set<string>()
    const walk = (targetId: string) => {
      for (const c of allCats) {
        if (c.parent?.id === targetId && !descendants.has(c.id)) {
          descendants.add(c.id)
          walk(c.id)
        }
      }
    }
    walk(category.id)
    return allCats
      .filter((c) => c.id !== category.id && !descendants.has(c.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }, [allCats, category])

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.handle || "").toLowerCase().includes(q)
    )
  }, [products, productQuery])

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const currentProductPage = Math.min(productPage, totalProductPages)
  const pagedProducts = filteredProducts.slice(
    (currentProductPage - 1) * PAGE_SIZE,
    currentProductPage * PAGE_SIZE
  )

  useEffect(() => {
    setProductPage(1)
  }, [productQuery])

  // ---- edit drawer ----
  function openEdit() {
    if (!category) return
    setForm({
      name: category.name,
      handle: category.handle,
      description: category.description || "",
      status: category.is_active ? "active" : "inactive",
      visibility: category.is_internal ? "internal" : "public",
      parent_category_id: category.parent_category?.id || "",
    })
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !category || !form.name.trim()) return
    setSaving(true)
    try {
      const { category: updated } = await updateCategory(token, category.id, {
        name: form.name.trim(),
        handle: form.handle.trim(),
        description: form.description.trim() || null,
        is_active: form.status === "active",
        is_internal: form.visibility === "internal",
        parent_category_id: form.parent_category_id || null,
      })
      setCategory(updated)
      setEditOpen(false)
      showMessage("success", "Category was successfully updated.")
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update category")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!token || !category) return
    if (
      !confirm(
        `You are about to delete the category ${category.name}. This action cannot be undone.`
      )
    )
      return
    setBusy("delete")
    try {
      await deleteCategory(token, category.id)
      router.push("/dashboard/categories")
    } catch (err) {
      // Deleting a category with children is blocked by the API (400).
      showMessage("error", err instanceof Error ? err.message : "Failed to delete category")
      setBusy(null)
    }
  }

  // ---- add products ----
  async function openAdd() {
    setAddOpen(true)
    setSelected(new Set())
    setAddSearch("")
    if (allProducts.length === 0 && token) {
      setProductsLoading(true)
      try {
        const res = await listProducts(token)
        setAllProducts(res.products || [])
      } catch (err) {
        showMessage("error", err instanceof Error ? err.message : "Failed to load products")
      } finally {
        setProductsLoading(false)
      }
    }
  }

  const assignedIds = useMemo(() => new Set(products.map((p) => p.id)), [products])

  const addCandidates = useMemo(() => {
    const q = addSearch.trim().toLowerCase()
    return allProducts.filter(
      (p) =>
        !q ||
        (p.title || "").toLowerCase().includes(q) ||
        (p.handle || "").toLowerCase().includes(q)
    )
  }, [allProducts, addSearch])

  async function handleAdd() {
    if (!token || !category) return
    const add = Array.from(selected).filter((pid) => !assignedIds.has(pid))
    if (add.length === 0) {
      setAddOpen(false)
      return
    }
    setAdding(true)
    try {
      await batchCategoryProducts(token, category.id, { add, remove: [] })
      setAddOpen(false)
      showMessage(
        "success",
        `Added ${add.length} product${add.length === 1 ? "" : "s"} to the category.`
      )
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to add products")
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(product: Product) {
    if (!token || !category) return
    if (!confirm(`Remove ${product.title} from the category?`)) return
    setBusy(`remove-${product.id}`)
    try {
      await batchCategoryProducts(token, category.id, { add: [], remove: [product.id] })
      showMessage("success", "Removed 1 product from the category.")
      await load()
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to remove product")
    } finally {
      setBusy(null)
    }
  }

  // ---- metadata ----
  function openMeta() {
    const meta = category?.metadata || {}
    const rows: MetaRow[] = Object.entries(meta)
      .filter(([k]) => k !== "tenant_id")
      .map(([k, v]) => ({
        key: k,
        value: typeof v === "object" ? JSON.stringify(v) : String(v),
      }))
    if (rows.length === 0) rows.push({ key: "", value: "" })
    setMetaRows(rows)
    setMetaOpen(true)
  }

  async function saveMeta() {
    if (!token || !category) return
    const meta: Record<string, any> = {}
    // Preserve the tenant ownership tag; never expose or drop it.
    const tenantId = (category.metadata as any)?.tenant_id
    if (tenantId) meta.tenant_id = tenantId
    for (const row of metaRows) {
      const key = row.key.trim()
      if (!key) continue
      meta[key] = row.value
    }
    setMetaSaving(true)
    try {
      const { category: updated } = await updateCategory(token, category.id, { metadata: meta })
      setCategory(updated)
      setMetaOpen(false)
      showMessage("success", "Metadata was successfully updated.")
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to update metadata")
    } finally {
      setMetaSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Category" description="Loading..." />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !category) {
    return (
      <div className="space-y-6">
        <PageHeader title="Category" description="We could not load this category." />
        <EmptyState
          icon={FolderOpen}
          title="Category not found"
          description={error || "This category does not exist or you do not have access to it."}
        />
      </div>
    )
  }

  const metaEntries = Object.entries(category.metadata || {}).filter(([k]) => k !== "tenant_id")

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/categories")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to categories
      </button>

      {message && (
        <div
          className={cn(
            "rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.text}
        </div>
      )}

      <TwoColumnLayout
        sidebar={
          <SectionCard
            title="Organize"
            action={
              <ActionMenu
                items={[
                  {
                    label: "Edit ranking",
                    icon: PencilSquare,
                    onClick: () => router.push("/dashboard/categories?organize=1"),
                  },
                ]}
              />
            }
          >
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="mb-1.5 text-grey-50">Path</dt>
                <dd>
                  {path.length > 1 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {path.map((node, idx) => {
                        const last = idx === path.length - 1
                        return (
                          <React.Fragment key={node.id}>
                            {last ? (
                              <span className="font-medium text-grey-90">{node.name}</span>
                            ) : (
                              <Link
                                href={`/dashboard/categories/${node.id}`}
                                className="text-grey-60 hover:text-grey-90 hover:underline"
                              >
                                {node.name}
                              </Link>
                            )}
                            {!last && <span className="text-grey-30">/</span>}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-grey-40">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-grey-50">Children</dt>
                <dd>
                  {category.category_children.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {category.category_children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/dashboard/categories/${child.id}`}
                          className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-80 hover:bg-grey-20"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-grey-40">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </SectionCard>
        }
      >
        {/* General */}
        <SectionCard
          title={category.name}
          action={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Pill tone={category.is_active ? "green" : "red"}>
                  {category.is_active ? "Active" : "Inactive"}
                </Pill>
                <Pill tone={category.is_internal ? "blue" : "green"}>
                  {category.is_internal ? "Internal" : "Public"}
                </Pill>
              </div>
              <ActionMenu
                items={[
                  { label: "Edit", icon: PencilSquare, onClick: openEdit },
                  {
                    label: "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: handleDelete,
                  },
                ]}
              />
            </div>
          }
        >
          <dl className="divide-y divide-grey-10">
            <div className="grid grid-cols-3 gap-4 py-3 text-sm">
              <dt className="text-grey-50">Description</dt>
              <dd className="col-span-2 text-grey-90">
                {category.description || <span className="text-grey-40">—</span>}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4 py-3 text-sm">
              <dt className="text-grey-50">Handle</dt>
              <dd className="col-span-2 text-grey-90">/{category.handle}</dd>
            </div>
          </dl>
        </SectionCard>

        {/* Products */}
        <SectionCard
          title="Products"
          description="Products assigned to this category."
          action={
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80"
            >
              <PlusMini className="h-4 w-4" />
              Add
            </button>
          }
        >
          {products.length === 0 ? (
            <div className="rounded-base border border-dashed border-grey-20 py-10 text-center">
              <p className="text-sm text-grey-50">There are no products in the category.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative sm:max-w-xs">
                <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
                />
              </div>
              <div className="overflow-hidden rounded-large border border-grey-20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-grey-10 text-grey-70">
                      <tr>
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium">Variants</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-10">
                      {pagedProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-grey-5">
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/products/${p.id}`}
                              className="flex items-center gap-3"
                            >
                              {p.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.thumbnail}
                                  alt={p.title}
                                  className="h-8 w-8 rounded-base border border-grey-20 object-cover"
                                />
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-base border border-grey-20 bg-grey-10 text-grey-40">
                                  <FolderOpen className="h-4 w-4" />
                                </span>
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
                            <button
                              onClick={() => handleRemove(p)}
                              disabled={busy === `remove-${p.id}`}
                              className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title="Remove from category"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {pagedProducts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-sm text-grey-50">
                            No products match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredProducts.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-grey-10 px-4 py-3">
                    <p className="text-xs text-grey-50">
                      Showing {(currentProductPage - 1) * PAGE_SIZE + 1}–
                      {Math.min(currentProductPage * PAGE_SIZE, filteredProducts.length)} of{" "}
                      {filteredProducts.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setProductPage((n) => Math.max(1, n - 1))}
                        disabled={currentProductPage === 1}
                        className="rounded-base border border-grey-20 px-3 py-1 text-xs text-grey-70 hover:bg-grey-10 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-grey-60">
                        Page {currentProductPage} of {totalProductPages}
                      </span>
                      <button
                        onClick={() => setProductPage((n) => Math.min(totalProductPages, n + 1))}
                        disabled={currentProductPage === totalProductPages}
                        className="rounded-base border border-grey-20 px-3 py-1 text-xs text-grey-70 hover:bg-grey-10 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Metadata */}
        <SectionCard
          title="Metadata"
          action={
            <button
              onClick={openMeta}
              className="text-sm font-medium text-grey-60 hover:text-grey-90"
            >
              Edit
            </button>
          }
        >
          {metaEntries.length > 0 ? (
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
          ) : (
            <p className="text-sm text-grey-50">No metadata set.</p>
          )}
        </SectionCard>

        {/* JSON */}
        <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <button
            type="button"
            onClick={() => setShowJson((s) => !s)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
          >
            Raw category data (JSON)
            <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
          </button>
          {showJson && (
            <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
              {JSON.stringify(category, null, 2)}
            </pre>
          )}
        </div>
      </TwoColumnLayout>

      {/* Edit drawer */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Category"
        description="Edit the category to update its details."
        size="sm"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Title" htmlFor="cat-name" required>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Clothing"
              required
            />
          </FormField>
          <FormField label="Handle" htmlFor="cat-handle" hint="Used in the category URL.">
            <Input
              id="cat-handle"
              value={form.handle}
              onChange={(e) => setForm((p) => ({ ...p, handle: e.target.value }))}
              placeholder="clothing"
            />
          </FormField>
          <FormField label="Description" htmlFor="cat-desc">
            <Textarea
              id="cat-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Short description"
              rows={3}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Status" htmlFor="cat-status">
              <Select
                id="cat-status"
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value as "active" | "inactive" }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
            <FormField label="Visibility" htmlFor="cat-visibility">
              <Select
                id="cat-visibility"
                value={form.visibility}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    visibility: e.target.value as "public" | "internal",
                  }))
                }
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Parent category" htmlFor="cat-parent">
            <Select
              id="cat-parent"
              value={form.parent_category_id}
              onChange={(e) => setForm((p) => ({ ...p, parent_category_id: e.target.value }))}
            >
              <option value="">No parent</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add products modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add products"
        description="Select products to add to this category."
        size="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
            <input
              type="text"
              autoFocus
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
            />
          </div>
          {productsLoading ? (
            <div className="py-10 text-center text-sm text-grey-50">Loading products...</div>
          ) : addCandidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-grey-50">No products found.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-base border border-grey-20">
              {addCandidates.map((p) => {
                const already = assignedIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    title={already ? "The product is already in this category." : undefined}
                    className={cn(
                      "flex items-center gap-3 border-b border-grey-10 px-4 py-3 last:border-0",
                      already ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-grey-5"
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={already}
                      checked={already || selected.has(p.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(p.id) : next.delete(p.id)
                          return next
                        })
                      }
                      className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-grey-90">{p.title}</p>
                      <p className="text-xs text-grey-50">{p.handle}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </label>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              onClick={() => setAddOpen(false)}
              className="rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || selected.size === 0}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {adding ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Metadata modal */}
      <Modal
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        title="Edit Metadata"
        description="Add key/value pairs to store extra data on this category."
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {metaRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  onChange={(e) =>
                    setMetaRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r))
                    )
                  }
                  placeholder="Key"
                />
                <Input
                  value={row.value}
                  onChange={(e) =>
                    setMetaRows((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))
                    )
                  }
                  placeholder="Value"
                />
                <button
                  type="button"
                  onClick={() => setMetaRows((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded-base p-2 text-grey-50 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove row"
                >
                  <XMark className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMetaRows((prev) => [...prev, { key: "", value: "" }])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-grey-60 hover:text-grey-90"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <div className="flex items-center justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              onClick={() => setMetaOpen(false)}
              className="rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              onClick={saveMeta}
              disabled={metaSaving}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {metaSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
