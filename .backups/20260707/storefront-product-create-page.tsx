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
  price: string
  stock: string
  allowBackorder: boolean
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

const salesChannelOptions = [
  { id: "sc_1", name: "Default Store" },
  { id: "sc_2", name: "POS" },
  { id: "sc_3", name: "Wholesale" },
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
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
  const [activeTab, setActiveTab] = useState<Tab>("details")
  const [saving, setSaving] = useState(false)

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
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["sc_1"])

  // Variants
  const [options, setOptions] = useState<Option[]>([])
  const [optionTitle, setOptionTitle] = useState("")
  const [optionValue, setOptionValue] = useState("")
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
        price: map.get(title)?.price ?? "",
        stock: map.get(title)?.stock ?? "0",
        allowBackorder: map.get(title)?.allowBackorder ?? false,
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

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const addOption = () => {
    const title = optionTitle.trim()
    if (!title) return
    setOptions((prev) => [...prev, { id: `opt_${Date.now()}`, title, values: [] }])
    setOptionTitle("")
  }

  const addOptionValue = () => {
    const value = optionValue.trim()
    if (!value) return
    setOptions((prev) => {
      if (prev.length === 0) return prev
      const copy = [...prev]
      const last = copy[copy.length - 1]
      if (last && !last.values.includes(value)) {
        last.values.push(value)
      }
      return copy
    })
    setOptionValue("")
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
    setSaving(true)
    // Placeholder: in a real implementation this would call createProduct.
    await new Promise((resolve) => setTimeout(resolve, 400))
    setSaving(false)
    router.push("/merchant-admin/products")
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
          <Input
            type="number"
            step="0.01"
            min="0"
            value={v.price}
            onChange={(e) => updateVariant(idx, { price: e.target.value })}
            placeholder="0.00"
            className="min-w-[100px]"
          />
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
  ]

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
          title="Create product"
          description="Add a new product to your catalog."
        />
      </div>

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
            </div>
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
            <div>
              <label className="mb-2 block text-sm font-medium text-grey-70">
                Sales channels
              </label>
              <div className="space-y-2">
                {salesChannelOptions.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-center gap-3 rounded-base border border-grey-20 p-3 hover:bg-grey-5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(channel.id)}
                      onChange={() => toggleChannel(channel.id)}
                      className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                    />
                    <span className="text-sm font-medium text-grey-90">
                      {channel.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
                      className="flex items-start justify-between gap-3 rounded-base border border-grey-20 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-grey-90">{option.title}</p>
                        <p className="text-sm text-grey-60">
                          {option.values.join(", ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="rounded-base p-1.5 text-grey-50 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <Input
                        value={optionTitle}
                        onChange={(e) => setOptionTitle(e.target.value)}
                        placeholder="e.g. Color"
                      />
                    </div>
                    <div className="sm:col-span-6">
                      <Input
                        value={optionValue}
                        onChange={(e) => setOptionValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault()
                            addOptionValue()
                          }
                        }}
                        placeholder="Add a value"
                      />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <button
                        type="button"
                        onClick={addOptionValue}
                        disabled={!optionValue.trim() || options.length === 0}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Value
                      </button>
                      <button
                        type="button"
                        onClick={addOption}
                        disabled={!optionTitle.trim()}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
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
            href="/merchant-admin/products"
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
