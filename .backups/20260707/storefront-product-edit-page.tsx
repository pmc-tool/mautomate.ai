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
import {
  ProductDetail,
  ProductImage,
  ProductVariant,
} from "@lib/merchant-admin/api"
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

const mockProduct: ProductDetail = {
  id: "prod_1",
  title: "Cotton T-Shirt",
  handle: "cotton-t-shirt",
  status: "published",
  thumbnail: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  description:
    "A soft, comfortable cotton t-shirt. Perfect for everyday wear.",
  subtitle: "Everyday essentials",
  discountable: true,
  material: "100% Cotton",
  collection: { id: "col_1", title: "Summer 2024", handle: "summer-2024" },
  type: { id: "type_1", value: "Clothing" },
  tags: [
    { id: "tag_1", value: "summer" },
    { id: "tag_2", value: "sale" },
  ],
  sales_channels: [
    { id: "sc_1", name: "Default Store" },
  ],
  options: [
    {
      id: "opt_1",
      title: "Size",
      values: [
        { id: "ov_1", value: "Small" },
        { id: "ov_2", value: "Medium" },
        { id: "ov_3", value: "Large" },
      ],
    },
    {
      id: "opt_2",
      title: "Color",
      values: [
        { id: "ov_4", value: "Black" },
        { id: "ov_5", value: "White" },
      ],
    },
  ],
  variants: [
    {
      id: "var_1",
      title: "Small / Black",
      sku: "TS-S-BLK",
      prices: [{ amount: 2900, currency_code: "USD" }],
      inventory_quantity: 12,
      allow_backorder: false,
      options: [
        { option_id: "opt_1", value: "Small" },
        { option_id: "opt_2", value: "Black" },
      ],
    },
    {
      id: "var_2",
      title: "Small / White",
      sku: "TS-S-WHT",
      prices: [{ amount: 2900, currency_code: "USD" }],
      inventory_quantity: 8,
      allow_backorder: false,
      options: [
        { option_id: "opt_1", value: "Small" },
        { option_id: "opt_2", value: "White" },
      ],
    },
    {
      id: "var_3",
      title: "Medium / Black",
      sku: "TS-M-BLK",
      prices: [{ amount: 2900, currency_code: "USD" }],
      inventory_quantity: 20,
      allow_backorder: true,
      options: [
        { option_id: "opt_1", value: "Medium" },
        { option_id: "opt_2", value: "Black" },
      ],
    },
  ],
  images: [
    { id: "img_1", url: "https://placehold.co/400x400/e5e7eb/1f2937?text=Front" },
    { id: "img_2", url: "https://placehold.co/400x400/e5e7eb/1f2937?text=Back" },
  ],
}

const collections = [
  { id: "col_1", title: "Summer 2024" },
  { id: "col_2", title: "New Arrivals" },
  { id: "col_3", title: "Sale" },
]

const productTypes = [
  { id: "type_1", value: "Clothing" },
  { id: "type_2", value: "Electronics" },
  { id: "type_3", value: "Home" },
]

function useMockProduct(id: string) {
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      setProduct({ ...mockProduct, id })
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [id])

  return { product, setProduct, loading }
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { product, setProduct, loading } = useMockProduct(id)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const [tagsInput, setTagsInput] = useState("")
  const [pendingImages, setPendingImages] = useState<ProductImage[]>([])

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
    setTagsInput(product.tags?.map((t) => t.value).join(", ") ?? "")
    setPendingImages(product.images ?? [])
  }, [product])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    setSaving(true)
    setError(null)
    try {
      await new Promise((r) => setTimeout(r, 400))
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              title,
              handle,
              subtitle,
              description,
              status,
              discountable,
              material,
              tags: tagsInput.split(",").map((t, i) => ({ id: `tag_${i}`, value: t.trim() })).filter((t) => t.value),
              collection: collectionId
                ? collections.find((c) => c.id === collectionId) || prev.collection
                : null,
              type: typeId
                ? productTypes.find((t) => t.id === typeId) || prev.type
                : null,
              images: pendingImages,
            }
          : prev
      )
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
    if (!confirm("Are you sure you want to delete this product?")) return
    router.push("/merchant-admin/products")
  }

  const handleDuplicate = () => {
    router.push("/merchant-admin/products/create")
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const next = files.map((file) => ({
      id: `${Date.now()}_${file.name}`,
      url: URL.createObjectURL(file),
    }))
    setPendingImages((prev) => [...prev, ...next])
    e.target.value = ""
  }

  const removeImage = (imageId: string) => {
    setPendingImages((prev) => {
      const item = prev.find((i) => i.id === imageId)
      if (item?.url.startsWith("blob:")) URL.revokeObjectURL(item.url)
      return prev.filter((i) => i.id !== imageId)
    })
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
      {
        key: "sku",
        header: "SKU",
        render: (v: ProductVariant) => v.sku || "—",
      },
      {
        key: "price",
        header: "Price",
        render: (v: ProductVariant) =>
          v.prices?.[0] ? formatMoney(v.prices[0].amount, v.prices[0].currency_code) : "—",
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
    ]
  }, [product?.options])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product" description="We could not load this product." />
        <div className="rounded-large border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <ExclamationCircle className="mx-auto mb-2 h-6 w-6" />
          Product not found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/merchant-admin/products"
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
                  {
                    label: "Edit",
                    onClick: () => setEditing(true),
                    icon: PencilSquare,
                  },
                  {
                    label: "Duplicate",
                    onClick: handleDuplicate,
                    icon: DocumentText,
                  },
                  {
                    label: "Delete",
                    onClick: handleDelete,
                    icon: Trash,
                    destructive: true,
                  },
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
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-grey-70 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                        >
                          <XMark className="h-3.5 w-3.5" />
                        </button>
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
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Subtitle" htmlFor="subtitle">
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </FormField>
                <FormField label="Handle" htmlFor="handle" hint="Used in the product URL.">
                  <Input
                    id="handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    required
                  />
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
                    <Select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="proposed">Proposed</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                  </FormField>
                  <FormField label="Material" htmlFor="material">
                    <Input
                      id="material"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                    />
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
                          <img
                            src={img.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
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
                  <dd className="mt-1 text-sm whitespace-pre-wrap text-grey-90">
                    {product.description}
                  </dd>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Variants"
              description="Stock keeping units generated from product options."
              action={
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
                >
                  <PencilSquare className="h-4 w-4" />
                  Edit
                </button>
              }
            >
              {product.variants && product.variants.length > 0 ? (
                <DataTable<ProductVariant>
                  columns={variantColumns}
                  rows={product.variants}
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
                  pageSize={5}
                />
              ) : (
                <div className="rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-center text-grey-50">
                  <DocumentText className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm">No variants yet.</p>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Options" description="Product options and their values.">
              {product.options && product.options.length > 0 ? (
                <div className="space-y-3">
                  {product.options.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-base border border-grey-20 p-4"
                    >
                      <h4 className="text-sm font-medium text-grey-90">{option.title}</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {option.values.map((value) => (
                          <span
                            key={value.id}
                            className="rounded-base bg-grey-10 px-2 py-1 text-xs text-grey-70"
                          >
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
