"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CloudArrowUp,
  Photo,
  Plus,
  Trash,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import {
  FormField,
  Input,
  Select,
  Textarea,
} from "@components/merchant-admin/form-field"
import { DataTable } from "@components/merchant-admin/data-table"
import type { Column } from "@components/merchant-admin/data-table"
import { cn } from "@lib/util/cn"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createProduct,
  getStoreSettings,
  listCategories,
  listCollections,
  listProductTypes,
  uploadProductMedia,
  ProductCategory,
  ProductCollection,
  ProductType,
} from "@lib/merchant-admin/api"

type EnabledCurrency = { code: string; name: string; symbol: string }

type Tab = "details" | "organize" | "variants" | "media"

type Option = {
  id: string
  title: string
  values: string[]
}

type VariantRow = {
  id: string
  title: string
  sku: string
  // Amount (as entered, major units) per currency code.
  prices: Record<string, string>
  stock: string
  allowBackorder: boolean
  manageInventory: boolean
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

function priceToCents(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-grey-90 text-grey-90"
          : "border-transparent text-grey-50 hover:text-grey-90"
      )}
    >
      {children}
    </button>
  )
}

function generateVariantTitles(options: Option[]): string[] {
  if (options.length === 0 || options.some((o) => o.values.length === 0)) return []
  const matrices = options.map((o) => o.values)
  const combos: string[][] = []
  function combine(idx: number, current: string[]) {
    if (idx === matrices.length) {
      combos.push([...current])
      return
    }
    for (const value of matrices[idx]) {
      current.push(value)
      combine(idx + 1, current)
      current.pop()
    }
  }
  combine(0, [])
  return combos.map((combo) => combo.join(" / "))
}

export default function ProductCreatePage() {
  const router = useRouter()
  const { token } = useMerchantAuth()
  const [activeTab, setActiveTab] = useState<Tab>("details")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  // The store's enabled currencies drive per-currency variant pricing. Falls back
  // to USD so pricing still works if the store settings fail to load.
  const [enabledCurrencies, setEnabledCurrencies] = useState<EnabledCurrency[]>([
    { code: "usd", name: "US Dollar", symbol: "$" },
  ])

  useEffect(() => {
    if (!token) return
    setLoadingMeta(true)
    Promise.all([
      listCollections(token).then((r) => setCollections(r.collections || [])),
      listProductTypes(token).then((r) => setProductTypes(r.types || [])),
      listCategories(token).then((r) => setCategories(r.categories || [])),
    ])
      .catch(() => {})
      .finally(() => setLoadingMeta(false))

    getStoreSettings(token)
      .then((r) => {
        const enabled = r.store.supported_currencies
          .filter((c) => c.enabled)
          .map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))
        if (enabled.length) setEnabledCurrencies(enabled)
      })
      .catch(() => {})
  }, [token])

  // Details
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("draft")
  const [discountable, setDiscountable] = useState(true)
  const [material, setMaterial] = useState("")

  // Organize
  const [collectionId, setCollectionId] = useState("")
  const [typeId, setTypeId] = useState("")
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")

  // Variants
  const [options, setOptions] = useState<Option[]>([])
  const [optionTitle, setOptionTitle] = useState("")
  // Per-option value input (keyed by option id) so values can be added to ANY
  // option, not only the most recently created one.
  const [optionValueInputs, setOptionValueInputs] = useState<Record<string, string>>({})
  const [variants, setVariants] = useState<VariantRow[]>([])

  // Media
  const [images, setImages] = useState<{ id: string; url: string; file?: File }[]>([])
  const mediaInputRef = useRef<HTMLInputElement>(null)

  const generatedTitles = useMemo(() => generateVariantTitles(options), [options])

  useEffect(() => {
    setVariants((prev) => {
      const map = new Map(prev.map((v) => [v.title, v]))
      return generatedTitles.map((title) => ({
        id: `variant_${title}`,
        title,
        sku: map.get(title)?.sku ?? "",
        prices: map.get(title)?.prices ?? {},
        stock: map.get(title)?.stock ?? "0",
        allowBackorder: map.get(title)?.allowBackorder ?? false,
        manageInventory: map.get(title)?.manageInventory ?? true,
      }))
    })
  }, [generatedTitles])

  useEffect(() => {
    if (!handleEdited) setHandle(slugify(title))
  }, [title, handleEdited])

  const addTag = () => {
    const value = tagInput.trim()
    if (!value || tags.includes(value)) return
    setTags([...tags, value])
    setTagInput("")
  }

  const removeTag = (value: string) => {
    setTags(tags.filter((t) => t !== value))
  }

  const addOption = () => {
    const title = optionTitle.trim()
    if (!title) return
    setOptions((prev) => [...prev, { id: `opt_${Date.now()}`, title, values: [] }])
    setOptionTitle("")
  }

  // Add a value to a SPECIFIC option (identified by id).
  const addOptionValue = (optionId: string) => {
    const value = (optionValueInputs[optionId] || "").trim()
    if (!value) return
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId && !o.values.includes(value)
          ? { ...o, values: [...o.values, value] }
          : o
      )
    )
    setOptionValueInputs((prev) => ({ ...prev, [optionId]: "" }))
  }

  const removeOptionValue = (optionId: string, value: string) => {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId ? { ...o, values: o.values.filter((v) => v !== value) } : o
      )
    )
  }

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateVariant = (idx: number, patch: Partial<VariantRow>) => {
    setVariants((prev) => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.map((file) => ({
      id: `img_${file.name}_${Date.now()}`,
      url: URL.createObjectURL(file),
      file,
    }))
    setImages((prev) => [...prev, ...newImages])
    if (mediaInputRef.current) mediaInputRef.current.value = ""
  }

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)

    try {
      // Build a price entry for EACH enabled store currency.
      const buildPrices = (source: Record<string, string>) =>
        enabledCurrencies.map((cur) => ({
          amount: priceToCents(source[cur.code] || "0"),
          currency_code: cur.code,
        }))

      const productVariants =
        variants.length > 0
          ? variants.map((v) => ({
              title: v.title,
              sku: v.sku,
              prices: buildPrices(v.prices),
              inventory_quantity: parseInt(v.stock, 10) || 0,
              allow_backorder: v.allowBackorder,
              manage_inventory: v.manageInventory,
              options: Object.fromEntries(
                options.map((opt, i) => [opt.title, v.title.split(" / ")[i] || ""])
              ),
            }))
          : undefined

      const productOptions =
        options.length > 0
          ? options.map((o) => ({ title: o.title, values: o.values }))
          : undefined

      const { product } = await createProduct(token, {
        title,
        handle,
        subtitle,
        description,
        status,
        discountable,
        material,
        tags,
        collection_ids: collectionId ? [collectionId] : undefined,
        category_ids: categoryIds.length ? categoryIds : undefined,
        type_id: typeId || undefined,
        prices: enabledCurrencies.map((cur) => ({ amount: 0, currency_code: cur.code })),
        inventory_quantity: 0,
        options: productOptions,
        variants: productVariants,
      })

      for (const img of images) {
        if (img.file) {
          await uploadProductMedia(token, product.id, img.file)
        }
      }

      router.push("/dashboard/products")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  const variantColumns: Column<VariantRow>[] = [
    { key: "title", header: "Title", render: (v) => <span className="text-grey-90">{v.title}</span> },
    {
      key: "sku",
      header: "SKU",
      render: (v) => {
        const idx = variants.findIndex((row) => row.id === v.id)
        return (
          <Input
            value={v.sku}
            onChange={(e) => updateVariant(idx, { sku: e.target.value })}
            placeholder="SKU"
            className="min-w-[120px]"
          />
        )
      },
    },
    {
      key: "price",
      header: "Price",
      render: (v) => {
        const idx = variants.findIndex((row) => row.id === v.id)
        return (
          <div className="min-w-[150px] space-y-1.5">
            {enabledCurrencies.map((cur) => (
              <div key={cur.code} className="flex items-center gap-1.5">
                <span className="w-9 shrink-0 text-xs uppercase text-grey-50">
                  {cur.code}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.prices[cur.code] ?? ""}
                  onChange={(e) =>
                    updateVariant(idx, {
                      prices: { ...v.prices, [cur.code]: e.target.value },
                    })
                  }
                  placeholder="0.00"
                  className="min-w-[90px]"
                />
              </div>
            ))}
          </div>
        )
      },
    },
    {
      key: "stock",
      header: "Stock",
      render: (v) => {
        const idx = variants.findIndex((row) => row.id === v.id)
        return (
          <Input
            type="number"
            min="0"
            value={v.stock}
            onChange={(e) => updateVariant(idx, { stock: e.target.value })}
            className="min-w-[80px]"
          />
        )
      },
    },
    {
      key: "allowBackorder",
      header: "Backorder",
      render: (v) => {
        const idx = variants.findIndex((row) => row.id === v.id)
        return (
          <input
            type="checkbox"
            checked={v.allowBackorder}
            onChange={(e) => updateVariant(idx, { allowBackorder: e.target.checked })}
            className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
          />
        )
      },
    },
    {
      key: "manageInventory",
      header: "Manage stock",
      render: (v) => {
        const idx = variants.findIndex((row) => row.id === v.id)
        return (
          <input
            type="checkbox"
            checked={v.manageInventory}
            onChange={(e) => updateVariant(idx, { manageInventory: e.target.checked })}
            className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
          />
        )
      },
    },
  ]

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
          title="Create product"
          description="Add a new product to your catalog."
        />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-b border-grey-20">
          <nav className="-mb-px flex" aria-label="Product tabs">
            <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")}>
              Details
            </TabButton>
            <TabButton active={activeTab === "organize"} onClick={() => setActiveTab("organize")}>
              Organize
            </TabButton>
            <TabButton active={activeTab === "variants"} onClick={() => setActiveTab("variants")}>
              Variants
            </TabButton>
            <TabButton active={activeTab === "media"} onClick={() => setActiveTab("media")}>
              Media
            </TabButton>
          </nav>
        </div>

        {activeTab === "details" && (
          <SectionCard title="General" description="Basic product information.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Title" htmlFor="title">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (!handleEdited) setHandle(slugify(e.target.value))
                  }}
                  placeholder="e.g. Cotton T-Shirt"
                  required
                />
              </FormField>
              <FormField label="Subtitle" htmlFor="subtitle">
                <Input
                  id="subtitle"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Short tagline"
                />
              </FormField>
            </div>
            <FormField label="Handle" htmlFor="handle" hint="Used in the product URL.">
              <Input
                id="handle"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value)
                  setHandleEdited(true)
                }}
                placeholder="cotton-t-shirt"
                required
              />
            </FormField>
            <FormField label="Description" htmlFor="description">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the product..."
                rows={5}
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
                  placeholder="e.g. 100% Cotton"
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
          </SectionCard>
        )}

        {activeTab === "organize" && (
          <SectionCard title="Organize" description="Categorize the product.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Collection" htmlFor="collection">
                <Select
                  id="collection"
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  disabled={loadingMeta}
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
                  disabled={loadingMeta}
                >
                  <option value="">No type</option>
                  {productTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.value}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Categories" htmlFor="categories">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {categoryIds.map((id) => {
                    const cat = categories.find((c) => c.id === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                      >
                        {cat?.name ?? id}
                        <button
                          type="button"
                          onClick={() => setCategoryIds((prev) => prev.filter((c) => c !== id))}
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
                    const id = e.target.value
                    if (!id) return
                    setCategoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                    e.target.value = ""
                  }}
                  disabled={loadingMeta || categories.length === 0}
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
            <FormField label="Tags" htmlFor="tags">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="rounded p-0.5 hover:bg-grey-20"
                      >
                        <XMark className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="Type a tag and press Enter"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </FormField>
          </SectionCard>
        )}

        {activeTab === "variants" && (
          <SectionCard
            title="Variants"
            description="Define options and generate variant combinations."
          >
            <div className="space-y-6">
              <div className="rounded-base border border-grey-20 p-4">
                <h3 className="mb-3 text-sm font-medium text-grey-90">Product options</h3>
                <div className="space-y-3">
                  {options.map((option, idx) => (
                    <div
                      key={option.id}
                      className="space-y-3 rounded-base border border-grey-20 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-grey-90">{option.title}</p>
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="rounded-base p-1.5 text-grey-50 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove option ${option.title}`}
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value) => (
                          <span
                            key={value}
                            className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                          >
                            {value}
                            <button
                              type="button"
                              onClick={() => removeOptionValue(option.id, value)}
                              className="rounded p-0.5 hover:bg-grey-20"
                              aria-label={`Remove value ${value}`}
                            >
                              <XMark className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {option.values.length === 0 && (
                          <span className="text-xs text-grey-50">No values yet</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={optionValueInputs[option.id] ?? ""}
                          onChange={(e) =>
                            setOptionValueInputs((prev) => ({
                              ...prev,
                              [option.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault()
                              addOptionValue(option.id)
                            }
                          }}
                          placeholder="Add a value"
                        />
                        <button
                          type="button"
                          onClick={() => addOptionValue(option.id)}
                          disabled={!(optionValueInputs[option.id] || "").trim()}
                          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Value
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-10">
                      <Input
                        value={optionTitle}
                        onChange={(e) => setOptionTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addOption()
                          }
                        }}
                        placeholder="e.g. Color"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={addOption}
                        disabled={!optionTitle.trim()}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Option
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {variants.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-grey-90">Variant matrix</h3>
                  <DataTable
                    columns={variantColumns}
                    rows={variants}
                    pageSize={10}
                    emptyTitle="No variants"
                    emptyDescription="Add options to generate variants."
                  />
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {activeTab === "media" && (
          <SectionCard title="Media" description="Upload product images.">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square overflow-hidden rounded-base border border-grey-20 bg-grey-10"
                  >
                    <img
                      src={image.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-grey-70 opacity-0 shadow-sm transition-opacity hover:text-red-600 group-hover:opacity-100"
                    >
                      <XMark className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-base border border-dashed border-grey-30 bg-grey-5 text-grey-60 hover:border-grey-50 hover:bg-grey-10"
                >
                  <CloudArrowUp className="h-6 w-6" />
                  <span className="text-sm font-medium">Upload</span>
                </button>
              </div>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleMediaSelect}
                className="hidden"
              />
              {images.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-large border border-dashed border-grey-20 bg-grey-5 py-12 text-center">
                  <Photo className="mb-3 h-8 w-8 text-grey-40" />
                  <p className="text-sm font-medium text-grey-70">Drag images here</p>
                  <p className="text-xs text-grey-50">or click Upload to browse</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-grey-10 pt-4">
          <Link
            href="/dashboard/products"
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !title}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create product"}
          </button>
        </div>
      </form>
    </div>
  )
}
