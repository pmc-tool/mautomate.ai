"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  ExclamationCircle,
  PencilSquare,
  Trash,
  Photo,
  XMark,
  DocumentText,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { DataTable } from "@components/merchant-admin/data-table"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductMedia,
  getStoreSettings,
  listCategories,
  listCollections,
  listProductTypes,
  ProductDetail,
  ProductVariant,
  ProductCategory,
  ProductCollection,
  ProductType,
} from "@lib/merchant-admin/api"

type EnabledCurrency = { code: string; name: string; symbol: string }
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

function priceToCents(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token } = useMerchantAuth()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("draft")
  const [discountable, setDiscountable] = useState(true)
  const [material, setMaterial] = useState("")
  const [collectionId, setCollectionId] = useState("")
  const [typeId, setTypeId] = useState("")
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [tagsInput, setTagsInput] = useState("")
  const [pendingImages, setPendingImages] = useState<{ id: string; url: string; file?: File }[]>([])
  // variantId -> currency code -> amount (major units, as entered).
  const [variantPrices, setVariantPrices] = useState<Record<string, Record<string, string>>>({})
  // The store's enabled currencies drive per-currency variant pricing. Falls back
  // to USD so pricing still works if the store settings fail to load.
  const [enabledCurrencies, setEnabledCurrencies] = useState<EnabledCurrency[]>([
    { code: "usd", name: "US Dollar", symbol: "$" },
  ])
  const [variantStock, setVariantStock] = useState<Record<string, string>>({})
  const [variantSku, setVariantSku] = useState<Record<string, string>>({})
  const [variantManageInventory, setVariantManageInventory] = useState<Record<string, boolean>>({})
  const [variantAllowBackorder, setVariantAllowBackorder] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    Promise.all([
      listCollections(token).then((r) => setCollections(r.collections || [])),
      listProductTypes(token).then((r) => setProductTypes(r.types || [])),
      listCategories(token).then((r) => setCategories(r.categories || [])),
    ]).catch(() => {})

    getStoreSettings(token)
      .then((r) => {
        const enabled = r.store.supported_currencies
          .filter((c) => c.enabled)
          .map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))
        if (enabled.length) setEnabledCurrencies(enabled)
      })
      .catch(() => {})

    getProduct(token, id)
      .then((r) => setProduct(r.product))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load product"))
      .finally(() => setLoading(false))
  }, [token, id])

  useEffect(() => {
    if (!product) return
    setTitle(product.title)
    setHandle(product.handle)
    setSubtitle(product.subtitle ?? "")
    setDescription(product.description ?? "")
    setStatus(product.status)
    setDiscountable(product.discountable ?? true)
    setMaterial(product.material ?? "")
    setCollectionId(product.collection?.id ?? "")
    setTypeId(product.type?.id ?? "")
    setCategoryIds((product.categories || []).map((c) => c.id))
    setTagsInput(product.tags?.map((t) => t.value).join(", ") ?? "")
    setPendingImages((product.images || []).map((img) => ({ id: img.id, url: img.url })))
    const prices: Record<string, Record<string, string>> = {}
    const stock: Record<string, string> = {}
    const sku: Record<string, string> = {}
    const manageInventory: Record<string, boolean> = {}
    const allowBackorder: Record<string, boolean> = {}
    for (const v of product.variants || []) {
      // Seed the entered amount for every currency this variant already has.
      const byCode: Record<string, string> = {}
      for (const p of v.prices || []) {
        byCode[p.currency_code] = (Number(p.amount) || 0).toFixed(2)
      }
      prices[v.id] = byCode
      stock[v.id] = String(v.inventory_quantity ?? 0)
      sku[v.id] = v.sku ?? ""
      manageInventory[v.id] = v.manage_inventory ?? true
      allowBackorder[v.id] = v.allow_backorder ?? false
    }
    setVariantPrices(prices)
    setVariantStock(stock)
    setVariantSku(sku)
    setVariantManageInventory(manageInventory)
    setVariantAllowBackorder(allowBackorder)
  }, [product])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !product) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      const variantUpdates = (product.variants || []).map((v) => {
        const edited = variantPrices[v.id] || {}
        // Send a price for each enabled currency, plus any currency the variant
        // already had (so existing prices aren't silently dropped).
        const codes = Array.from(
          new Set([...enabledCurrencies.map((c) => c.code), ...Object.keys(edited)])
        )
        const prices = codes.map((code) => ({
          amount: priceToCents(edited[code] || "0"),
          currency_code: code,
        }))
        return {
          id: v.id,
          sku: (variantSku[v.id] ?? "").trim() || null,
          prices,
          inventory_quantity: parseInt(variantStock[v.id] || "0", 10) || 0,
          manage_inventory: variantManageInventory[v.id] ?? true,
          allow_backorder: variantAllowBackorder[v.id] ?? false,
        }
      })

      await updateProduct(token, product.id, {
        title,
        handle,
        subtitle,
        description,
        status,
        discountable,
        material,
        tags,
        collection_ids: collectionId ? [collectionId] : [],
        category_ids: categoryIds,
        type_id: typeId || null,
        variants: variantUpdates,
      })

      for (const img of pendingImages) {
        if (img.file) {
          await uploadProductMedia(token, product.id, img.file)
        }
      }

      const refreshed = await getProduct(token, product.id)
      setProduct(refreshed.product)
      setEditing(false)
      setSaveMessage("Product saved")
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !product) return
    if (!confirm("Are you sure you want to delete this product?")) return
    try {
      await deleteProduct(token, product.id)
      router.push("/dashboard/products")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product")
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const next = files.map((file) => ({
      id: `${Date.now()}_${file.name}`,
      url: URL.createObjectURL(file),
      file,
    }))
    setPendingImages((prev) => [...prev, ...next])
    e.target.value = ""
  }

  const removeImage = (imageId: string) => {
    setPendingImages((prev) => prev.filter((i) => i.id !== imageId))
  }

  const variantColumns = useMemo(() => {
    const optionCols =
      product?.options?.map((opt) => ({
        key: opt.id,
        header: opt.title,
        render: (v: ProductVariant) =>
          v.options?.find((o) => o.option_id === opt.id)?.value ?? "—",
      })) ?? []
    return [
      ...optionCols,
      { key: "sku", header: "SKU", render: (v: ProductVariant) => v.sku || "—" },
      {
        key: "price",
        header: "Price",
        render: (v: ProductVariant) =>
          v.prices?.[0]
            ? formatMoney(Number(v.prices[0].amount) || 0, v.prices[0].currency_code)
            : "—",
      },
      {
        key: "inventory_quantity",
        header: "Stock",
        render: (v: ProductVariant) => v.inventory_quantity ?? "—",
      },
      {
        key: "allow_backorder",
        header: "Backorder",
        render: (v: ProductVariant) => (v.allow_backorder ? "Yes" : "No"),
      },
      {
        key: "manage_inventory",
        header: "Manage stock",
        render: (v: ProductVariant) => (v.manage_inventory ? "Yes" : "No"),
      },
    ]
  }, [product?.options])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product" description="We could not load this product." />
        <div className="rounded-large border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <ExclamationCircle className="mx-auto mb-2 h-6 w-6" />
          {error || "Product not found."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/products"
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title={product.title}
          description={`Handle: ${product.handle}`}
          action={
            <div className="flex items-center gap-3">
              <StatusBadge status={product.status} />
              <ActionMenu
                items={[
                  { label: "Edit", onClick: () => setEditing(true), icon: PencilSquare },
                  { label: "Delete", onClick: handleDelete, icon: Trash, destructive: true },
                ]}
              />
            </div>
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
          <TwoColumnLayout
            sidebar={
              <>
                <SectionCard title="Media" description="Product images.">
                  <div className="grid grid-cols-2 gap-3">
                    {pendingImages.map((img) => (
                      <div
                        key={img.id}
                        className="group relative aspect-square overflow-hidden rounded-large border border-grey-20 bg-grey-10"
                      >
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                        {img.file ? (
                          // Only NEW (not-yet-uploaded) images can be removed. The media
                          // API is upload-only, so already-saved images cannot be deleted.
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-grey-70 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                          >
                            <XMark className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-grey-60 shadow-sm">
                            Saved
                          </span>
                        )}
                      </div>
                    ))}
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-large border border-dashed border-grey-30 bg-grey-5 hover:bg-grey-10">
                      <Photo className="h-6 w-6 text-grey-40" />
                      <span className="text-xs font-medium text-grey-70">Upload</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-grey-50">
                    Uploading a new image adds it to the gallery and sets it as the thumbnail.
                    Removing already-saved images is not yet supported by the API.
                  </p>
                </SectionCard>

                <SectionCard title="Organize" description="Categorization.">
                  <div className="space-y-4">
                    <FormField label="Collection" htmlFor="collection">
                      <Select
                        id="collection"
                        value={collectionId}
                        onChange={(e) => setCollectionId(e.target.value)}
                      >
                        <option value="">No collection</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Type" htmlFor="type">
                      <Select
                        id="type"
                        value={typeId}
                        onChange={(e) => setTypeId(e.target.value)}
                      >
                        <option value="">No type</option>
                        {productTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.value}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Categories" htmlFor="categories">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {categoryIds.map((catId) => {
                            const cat = categories.find((c) => c.id === catId)
                            return (
                              <span
                                key={catId}
                                className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                              >
                                {cat?.name ?? catId}
                                <button
                                  type="button"
                                  onClick={() => setCategoryIds((prev) => prev.filter((c) => c !== catId))}
                                  className="rounded p-0.5 hover:bg-grey-20"
                                >
                                  <XMark className="h-3 w-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                        <Select
                          id="categories"
                          value=""
                          onChange={(e) => {
                            const catId = e.target.value
                            if (!catId) return
                            setCategoryIds((prev) => (prev.includes(catId) ? prev : [...prev, catId]))
                            e.target.value = ""
                          }}
                          disabled={categories.length === 0}
                        >
                          <option value="">{categories.length === 0 ? "No categories" : "Add a category"}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </FormField>
                    <FormField label="Tags" htmlFor="tags" hint="Separate tags with commas.">
                      <Input
                        id="tags"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="summer, sale, new"
                      />
                    </FormField>
                  </div>
                </SectionCard>
              </>
            }
          >
            <SectionCard title="General" description="Basic product details.">
              <div className="space-y-4">
                <FormField label="Title" htmlFor="title">
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </FormField>
                <FormField label="Subtitle" htmlFor="subtitle">
                  <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
                </FormField>
                <FormField label="Handle" htmlFor="handle" hint="Used in the product URL.">
                  <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} required />
                </FormField>
                <FormField label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </FormField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Status" htmlFor="status">
                    <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="proposed">Proposed</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                  </FormField>
                  <FormField label="Material" htmlFor="material">
                    <Input id="material" value={material} onChange={(e) => setMaterial(e.target.value)} />
                  </FormField>
                </div>
                <div className="rounded-base border border-grey-20 p-4">
                  <FormToggle
                    checked={discountable}
                    onChange={setDiscountable}
                    label="Discountable"
                    description="Allow discounts to be applied to this product."
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Variants" description="Edit SKU, stock and pricing per variant.">
              {(product.variants || []).length > 0 ? (
                <div className="space-y-3">
                  {(product.variants || []).map((v) => (
                    <div key={v.id} className="grid grid-cols-1 gap-3 rounded-base border border-grey-20 p-4 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="font-medium text-grey-90">{v.title}</div>
                      <FormField label="SKU" htmlFor={`sku-${v.id}`}>
                        <Input
                          id={`sku-${v.id}`}
                          value={variantSku[v.id] ?? ""}
                          onChange={(e) =>
                            setVariantSku((p) => ({ ...p, [v.id]: e.target.value }))
                          }
                          placeholder="SKU"
                        />
                      </FormField>
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-grey-50">
                          Price
                        </span>
                        <div className="space-y-1.5">
                          {enabledCurrencies.map((cur) => (
                            <div key={cur.code} className="flex items-center gap-2">
                              <span className="w-9 shrink-0 text-xs uppercase text-grey-50">
                                {cur.code}
                              </span>
                              <Input
                                id={`price-${v.id}-${cur.code}`}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={variantPrices[v.id]?.[cur.code] ?? ""}
                                onChange={(e) =>
                                  setVariantPrices((p) => ({
                                    ...p,
                                    [v.id]: {
                                      ...(p[v.id] || {}),
                                      [cur.code]: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <FormField label="Stock" htmlFor={`stock-${v.id}`}>
                        <Input
                          id={`stock-${v.id}`}
                          type="number"
                          min="0"
                          value={variantStock[v.id] ?? ""}
                          onChange={(e) =>
                            setVariantStock((p) => ({ ...p, [v.id]: e.target.value }))
                          }
                        />
                      </FormField>
                      <div className="flex items-center gap-6 pt-5 sm:pt-0">
                        <label className="flex items-center gap-2 text-sm text-grey-70">
                          <input
                            type="checkbox"
                            checked={variantManageInventory[v.id] ?? true}
                            onChange={(e) =>
                              setVariantManageInventory((p) => ({ ...p, [v.id]: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                          />
                          Manage stock
                        </label>
                        <label className="flex items-center gap-2 text-sm text-grey-70">
                          <input
                            type="checkbox"
                            checked={variantAllowBackorder[v.id] ?? false}
                            onChange={(e) =>
                              setVariantAllowBackorder((p) => ({ ...p, [v.id]: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                          />
                          Backorder
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-grey-50">No variants defined.</p>
              )}
              <p className="mt-3 text-xs text-grey-50">
                Editing existing variants (SKU, price, stock, backorder) is saved. Adding new
                variants or removing variants after creation is not yet supported by the API —
                set up all variants when creating the product.
              </p>
            </SectionCard>
          </TwoColumnLayout>

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
              disabled={saving}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <TwoColumnLayout
            sidebar={
              <>
                <SectionCard title="Media" description="Product images.">
                  {product.images && product.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {product.images.map((img) => (
                        <div
                          key={img.id}
                          className="aspect-square overflow-hidden rounded-large border border-grey-20 bg-grey-10"
                        >
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-grey-50">
                      <Photo className="mb-2 h-8 w-8" />
                      <p className="text-sm">No images</p>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Organize" description="Categorization.">
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-grey-50">Collection</dt>
                      <dd className="font-medium text-grey-90">
                        {product.collection?.title ?? <span className="text-grey-40">—</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-grey-50">Type</dt>
                      <dd className="font-medium text-grey-90">
                        {product.type?.value ?? <span className="text-grey-40">—</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-grey-50">Categories</dt>
                      <dd className="flex flex-wrap gap-2 pt-1">
                        {product.categories && product.categories.length > 0 ? (
                          product.categories.map((cat) => (
                            <span
                              key={cat.id}
                              className="rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                            >
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-grey-40">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-grey-50">Tags</dt>
                      <dd className="flex flex-wrap gap-2 pt-1">
                        {product.tags && product.tags.length > 0 ? (
                          product.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                            >
                              {tag.value}
                            </span>
                          ))
                        ) : (
                          <span className="text-grey-40">—</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </SectionCard>
              </>
            }
          >
            <SectionCard title="General" description="Basic product details.">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-grey-50">Title</dt>
                  <dd className="text-sm font-medium text-grey-90">{product.title}</dd>
                </div>
                <div>
                  <dt className="text-sm text-grey-50">Subtitle</dt>
                  <dd className="text-sm font-medium text-grey-90">
                    {product.subtitle ?? <span className="text-grey-40">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-grey-50">Handle</dt>
                  <dd className="text-sm font-medium text-grey-90">{product.handle}</dd>
                </div>
                <div>
                  <dt className="text-sm text-grey-50">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={product.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-grey-50">Material</dt>
                  <dd className="text-sm font-medium text-grey-90">
                    {product.material ?? <span className="text-grey-40">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-grey-50">Discountable</dt>
                  <dd className="text-sm font-medium text-grey-90">
                    {product.discountable ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
              {product.description && (
                <div className="mt-4 border-t border-grey-10 pt-4">
                  <dt className="text-sm text-grey-50">Description</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-grey-90">
                    {product.description}
                  </dd>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Variants" description="Stock keeping units generated from product options.">
              {product.variants && product.variants.length > 0 ? (
                <DataTable<ProductVariant>
                  columns={variantColumns}
                  rows={product.variants}
                  pageSize={5}
                />
              ) : (
                <div className="rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-center text-grey-50">
                  <DocumentText className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm">No variants yet.</p>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Options" description="Product options and their values (read-only).">
              <p className="mb-3 text-xs text-grey-50">
                Options and their values are set when the product is created. Editing them after
                creation is not yet supported by the API.
              </p>
              {product.options && product.options.length > 0 ? (
                <div className="space-y-3">
                  {product.options.map((option) => (
                    <div key={option.id} className="rounded-base border border-grey-20 p-4">
                      <h4 className="text-sm font-medium text-grey-90">{option.title}</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {option.values.map((value) => (
                          <span key={value.id} className="rounded-base bg-grey-10 px-2 py-1 text-xs text-grey-70">
                            {value.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-grey-50">No options defined.</p>
              )}
            </SectionCard>
          </TwoColumnLayout>
        </>
      )}
    </div>
  )
}
