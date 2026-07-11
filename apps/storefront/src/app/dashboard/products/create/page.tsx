"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  CloudArrowUp,
  ExclamationCircle,
  Photo,
  Plus,
  StackPerspective,
  ThumbnailBadge,
  Trash,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import {
  FormField,
  Input,
  Select,
  Textarea,
} from "@components/merchant-admin/form-field"
import { cn } from "@lib/util/cn"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createProduct,
  listCategories,
  listCollections,
  listProductTags,
  listStoreCurrencies,
  uploadProductMedia,
  ApiError,
  ProductCategory,
  ProductCollection,
  ProductTag,
} from "../../../../lib/merchant-admin/api"

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

const STEPS = ["Details", "Organize", "Variants", "Prices"] as const

const DEFAULT_OPTION_TITLE = "Default option"
const DEFAULT_OPTION_VALUE = "Default option value"
const DEFAULT_VARIANT_TITLE = "Default variant"
const DEFAULT_ROW_KEY = "__default_variant__"

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type MediaItem = {
  id: string
  file: File
  url: string
  name: string
  size: number
  isThumbnail: boolean
}

type OptionDraft = {
  id: string
  title: string
  values: string[]
}

type VariantRow = {
  key: string
  title: string
  comboValues: string[]
  include: boolean
  sku: string
  allowBackorder: boolean
  // Currency code -> amount as entered (MAJOR units).
  prices: Record<string, string>
}

type SelectedTag = {
  id?: string
  value: string
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function StepError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  )
}

function InlineTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-base border border-grey-20 bg-grey-5 px-4 py-3">
      <div className="w-1 shrink-0 rounded-full bg-grey-30" />
      <p className="text-sm text-grey-60">
        <span className="font-medium text-grey-70">Tip: </span>
        {children}
      </p>
    </div>
  )
}

function Chip({
  label,
  onRemove,
  removeLabel,
}: {
  label: string
  onRemove: () => void
  removeLabel: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 hover:bg-grey-20"
        aria-label={removeLabel}
      >
        <XMark className="h-3 w-3" />
      </button>
    </span>
  )
}

function Stepper({
  current,
  completed,
  onSelect,
  disabled,
}: {
  current: number
  completed: boolean[]
  onSelect: (index: number) => void
  disabled: boolean
}) {
  return (
    <nav
      aria-label="Product creation steps"
      className="rounded-large border border-grey-20 bg-white px-4 py-3 shadow-borders-base"
    >
      <ol className="flex flex-wrap items-center gap-y-2">
        {STEPS.map((label, index) => {
          const isCurrent = index === current
          const isCompleted = completed[index] && !isCurrent
          return (
            <li key={label} className="flex items-center">
              {index > 0 && (
                <div className="mx-2 h-px w-6 bg-grey-20 sm:mx-3 sm:w-10" />
              )}
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={disabled}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-base px-2 py-1.5 transition-colors",
                  disabled ? "cursor-not-allowed opacity-60" : "hover:bg-grey-10"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCompleted && "bg-grey-90 text-white",
                    isCurrent && "bg-grey-90 text-white ring-2 ring-grey-30",
                    !isCompleted && !isCurrent && "bg-grey-10 text-grey-50"
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isCurrent ? "text-grey-90" : "text-grey-50"
                  )}
                >
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductCreatePage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState<boolean[]>(
    STEPS.map(() => false)
  )
  const [stepError, setStepError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Toast (no global toast library in this app; local fixed-position toast).
  const [toast, setToast] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  // ---- reference data ----
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [allTags, setAllTags] = useState<ProductTag[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["usd"])
  const [defaultCurrency, setDefaultCurrency] = useState("usd")
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [metaError, setMetaError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoadingMeta(true)
    setMetaError(null)
    Promise.allSettled([
      listCollections(token),
      listCategories(token),
      listProductTags(token),
      listStoreCurrencies(token),
    ]).then((results) => {
      if (cancelled) return
      const [cols, cats, tags, curr] = results
      const failures: string[] = []

      const unauthorized = results.some(
        (r) =>
          r.status === "rejected" &&
          r.reason instanceof ApiError &&
          r.reason.status === 401
      )
      if (unauthorized) {
        logout()
        return
      }

      if (cols.status === "fulfilled") {
        setCollections(cols.value.collections || [])
      } else {
        failures.push("collections")
      }
      if (cats.status === "fulfilled") {
        setCategories(cats.value.categories || [])
      } else {
        failures.push("categories")
      }
      if (tags.status === "fulfilled") {
        setAllTags(tags.value.tags || [])
      } else {
        failures.push("tags")
      }
      if (curr.status === "fulfilled") {
        const list = (curr.value.currencies || []).map((c) => c.toLowerCase())
        const def = (curr.value.default_currency || "usd").toLowerCase()
        const ordered = [def, ...list.filter((c) => c !== def)]
        if (ordered.length) {
          setCurrencies(ordered)
          setDefaultCurrency(def)
        }
      } else {
        failures.push("currencies")
      }

      if (failures.length) {
        setMetaError(
          `Some store data failed to load (${failures.join(
            ", "
          )}). You can still create the product; reload the page to retry.`
        )
      }
      setLoadingMeta(false)
    })
    return () => {
      cancelled = true
    }
  }, [token, logout])

  // ---- Step 1: Details ----
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (!handleEdited) setHandle(slugify(title))
  }, [title, handleEdited])

  // ---- Media ----
  const [media, setMedia] = useState<MediaItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaItem[]>([])
  useEffect(() => {
    mediaRef.current = media
  }, [media])
  useEffect(() => {
    return () => {
      mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url))
    }
  }, [])

  const addFiles = (files: File[]) => {
    const accepted = files.filter(
      (f) => ALLOWED_IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_BYTES
    )
    const rejected = files.length - accepted.length
    if (rejected > 0) {
      showToast(
        "error",
        `${rejected} file${
          rejected === 1 ? " was" : "s were"
        } skipped. Use PNG, JPG, WebP or GIF up to 10 MB.`
      )
    }
    if (!accepted.length) return
    setMedia((prev) => {
      const hasThumbnail = prev.some((m) => m.isThumbnail)
      const items: MediaItem[] = accepted.map((file, i) => ({
        id: `media_${Date.now()}_${i}_${file.name}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        isThumbnail: !hasThumbnail && i === 0,
      }))
      return [...prev, ...items]
    })
  }

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []))
    if (mediaInputRef.current) mediaInputRef.current.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    addFiles(Array.from(e.dataTransfer.files || []))
  }

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const removed = prev.find((m) => m.id === id)
      if (removed) URL.revokeObjectURL(removed.url)
      const next = prev.filter((m) => m.id !== id)
      if (removed?.isThumbnail && next.length > 0) {
        next[0] = { ...next[0], isThumbnail: true }
      }
      return next
    })
  }

  const makeThumbnail = (id: string) => {
    setMedia((prev) => prev.map((m) => ({ ...m, isThumbnail: m.id === id })))
  }

  // ---- Step 2: Organize ----
  const [status, setStatus] = useState("draft")
  const [collectionId, setCollectionId] = useState("")
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([])
  const [newTagInput, setNewTagInput] = useState("")

  const addExistingTag = (id: string) => {
    const tag = allTags.find((t) => t.id === id)
    if (!tag) return
    setSelectedTags((prev) =>
      prev.some((t) => t.value.toLowerCase() === tag.value.toLowerCase())
        ? prev
        : [...prev, { id: tag.id, value: tag.value }]
    )
  }

  const addNewTag = () => {
    const value = newTagInput.trim()
    if (!value) return
    setSelectedTags((prev) =>
      prev.some((t) => t.value.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, { value }]
    )
    setNewTagInput("")
  }

  const removeTag = (value: string) => {
    setSelectedTags((prev) => prev.filter((t) => t.value !== value))
  }

  // ---- Step 3: Variants ----
  const [options, setOptions] = useState<OptionDraft[]>([])
  const [optionTitle, setOptionTitle] = useState("")
  const [optionValueInputs, setOptionValueInputs] = useState<
    Record<string, string>
  >({})
  const [rows, setRows] = useState<VariantRow[]>([])

  const permutations = useMemo(() => {
    if (options.length === 0) return null
    if (options.some((o) => o.values.length === 0)) return [] as string[][]
    return options.reduce<string[][]>(
      (acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v])),
      [[]]
    )
  }, [options])

  useEffect(() => {
    setRows((prev) => {
      const byKey = new Map(prev.map((r) => [r.key, r]))
      if (permutations === null) {
        const existing = byKey.get(DEFAULT_ROW_KEY)
        return [
          existing ?? {
            key: DEFAULT_ROW_KEY,
            title: DEFAULT_VARIANT_TITLE,
            comboValues: [],
            include: true,
            sku: "",
            allowBackorder: false,
            prices: {},
          },
        ]
      }
      return permutations.map((combo) => {
        const key = combo.join(" / ")
        return (
          byKey.get(key) ?? {
            key,
            title: key,
            comboValues: combo,
            include: true,
            sku: "",
            allowBackorder: false,
            prices: {},
          }
        )
      })
    })
  }, [permutations])

  const updateRow = (key: string, patch: Partial<VariantRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    )
  }

  const includedRows = useMemo(
    () => (options.length === 0 ? rows : rows.filter((r) => r.include)),
    [rows, options.length]
  )

  const addOption = () => {
    const t = optionTitle.trim()
    if (!t) return
    if (options.some((o) => o.title.toLowerCase() === t.toLowerCase())) {
      setStepError(`Option "${t}" already exists.`)
      return
    }
    setStepError(null)
    setOptions((prev) => [
      ...prev,
      { id: `opt_${Date.now()}`, title: t, values: [] },
    ])
    setOptionTitle("")
  }

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id))
    setOptionValueInputs((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const addOptionValues = (optionId: string) => {
    const raw = optionValueInputs[optionId] || ""
    const values = raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    if (!values.length) return
    setStepError(null)
    setOptions((prev) =>
      prev.map((o) => {
        if (o.id !== optionId) return o
        const existing = new Set(o.values.map((v) => v.toLowerCase()))
        const additions = values.filter((v) => !existing.has(v.toLowerCase()))
        return additions.length ? { ...o, values: [...o.values, ...additions] } : o
      })
    )
    setOptionValueInputs((prev) => ({ ...prev, [optionId]: "" }))
  }

  const removeOptionValue = (optionId: string, value: string) => {
    setOptions((prev) =>
      prev.map((o) =>
        o.id === optionId
          ? { ...o, values: o.values.filter((v) => v !== value) }
          : o
      )
    )
  }

  const allIncluded = rows.length > 0 && rows.every((r) => r.include)
  const someIncluded = rows.some((r) => r.include)

  // ---- validation ----
  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!title.trim()) return "Title is required."
      return null
    }
    if (index === 1) {
      return null
    }
    if (index === 2) {
      if (options.length > 0) {
        const emptyOption = options.find((o) => o.values.length === 0)
        if (emptyOption) {
          return `Option "${emptyOption.title}" needs at least one value.`
        }
        if (!rows.some((r) => r.include)) {
          return "Please select at least one variant."
        }
      }
      const skus = new Set<string>()
      for (const row of includedRows) {
        const sku = row.sku.trim()
        if (!sku) continue
        if (skus.has(sku.toLowerCase())) return "SKU must be unique."
        skus.add(sku.toLowerCase())
      }
      return null
    }
    if (index === 3) {
      for (const row of includedRows) {
        for (const code of currencies) {
          const raw = (row.prices[code] ?? "").trim()
          if (!raw) continue
          const n = parseFloat(raw)
          if (!Number.isFinite(n) || n < 0) {
            return "Prices must be valid non-negative amounts."
          }
        }
      }
      return null
    }
    return null
  }

  const goToStep = (target: number) => {
    if (saving || target === step) return
    if (target < step) {
      setStepError(null)
      setStep(target)
      return
    }
    for (let i = step; i < target; i++) {
      const err = validateStep(i)
      if (err) {
        setStep(i)
        setStepError(err)
        return
      }
      setCompleted((prev) => {
        const next = [...prev]
        next[i] = true
        return next
      })
    }
    setStepError(null)
    setStep(target)
  }

  // ---- dirty tracking / cancel ----
  const isDirty = useMemo(() => {
    return (
      title.trim() !== "" ||
      description !== "" ||
      handleEdited ||
      media.length > 0 ||
      status !== "draft" ||
      collectionId !== "" ||
      categoryIds.length > 0 ||
      selectedTags.length > 0 ||
      options.length > 0 ||
      rows.some(
        (r) =>
          r.sku !== "" ||
          !r.include ||
          r.allowBackorder ||
          Object.values(r.prices).some((v) => v !== "")
      )
    )
  }, [
    title,
    description,
    handleEdited,
    media,
    status,
    collectionId,
    categoryIds,
    selectedTags,
    options,
    rows,
  ])

  const handleCancel = () => {
    if (saving) return
    if (
      isDirty &&
      !window.confirm(
        "Are you sure you want to leave this form? All unsaved changes will be lost."
      )
    ) {
      return
    }
    router.push("/dashboard/products")
  }

  // ---- submit ----
  const primaryStatus =
    status === "proposed" || status === "rejected" ? status : "published"
  const primaryLabel =
    status === "proposed"
      ? "Save as proposed"
      : status === "rejected"
        ? "Save as rejected"
        : "Publish"

  const buildVariantPrices = (row: VariantRow) => {
    const entries: { currency_code: string; amount: number }[] = []
    for (const code of currencies) {
      const raw = (row.prices[code] ?? "").trim()
      if (!raw) continue
      const n = parseFloat(raw)
      if (Number.isFinite(n) && n >= 0) {
        entries.push({ currency_code: code, amount: n })
      }
    }
    return entries
  }

  const handleSubmit = async (finalStatus: string) => {
    if (!token || saving) return
    for (let i = 0; i < STEPS.length; i++) {
      const err = validateStep(i)
      if (err) {
        setStep(i)
        setStepError(err)
        return
      }
    }
    setStepError(null)
    setSaving(true)

    const trimmedTitle = title.trim()
    const hasUserOptions = options.length > 0

    const payloadOptions = hasUserOptions
      ? options.map((o) => ({ title: o.title, values: o.values }))
      : [{ title: DEFAULT_OPTION_TITLE, values: [DEFAULT_OPTION_VALUE] }]

    const payloadVariants = (hasUserOptions ? includedRows : rows).map(
      (row) => {
        const prices = buildVariantPrices(row)
        return {
          title: row.title,
          sku: row.sku.trim() || undefined,
          prices: prices.length ? prices : undefined,
          allow_backorder: row.allowBackorder,
          options: hasUserOptions
            ? Object.fromEntries(
                options.map((o, i) => [o.title, row.comboValues[i] || ""])
              )
            : { [DEFAULT_OPTION_TITLE]: DEFAULT_OPTION_VALUE },
        }
      }
    )

    try {
      const { product } = await createProduct(token, {
        title: trimmedTitle,
        handle: handle.trim() ? slugify(handle) : slugify(trimmedTitle),
        description: description.trim() || undefined,
        status: finalStatus,
        collection_ids: collectionId ? [collectionId] : undefined,
        category_ids: categoryIds.length ? categoryIds : undefined,
        tags: selectedTags.length
          ? selectedTags.map((t) => t.value)
          : undefined,
        options: payloadOptions,
        variants: payloadVariants,
      })

      // Upload images one by one. The media endpoint sets the product thumbnail
      // to the most recent upload, so the chosen thumbnail is uploaded LAST.
      let failedUploads = 0
      const ordered = [...media].sort(
        (a, b) => Number(a.isThumbnail) - Number(b.isThumbnail)
      )
      for (const item of ordered) {
        try {
          await uploadProductMedia(token, product.id, item.file)
        } catch {
          failedUploads++
        }
      }

      if (failedUploads > 0) {
        showToast(
          "error",
          `Product ${trimmedTitle} was created, but ${failedUploads} image${
            failedUploads === 1 ? "" : "s"
          } failed to upload.`
        )
      } else {
        showToast(
          "success",
          `Product ${trimmedTitle} was successfully created.`
        )
      }
      window.setTimeout(() => {
        router.push(`/dashboard/products/${product.id}`)
      }, 900)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to create product"
      )
      setSaving(false)
    }
  }

  // ---- keyboard: plain Enter is suppressed (except in textareas); Cmd/Ctrl+Enter
  // advances the step, or submits with the primary action on the last step. ----
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return
    const target = e.target as HTMLElement
    if (target.tagName === "TEXTAREA") return
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      if (step < STEPS.length - 1) {
        goToStep(step + 1)
      } else {
        handleSubmit(primaryStatus)
      }
      return
    }
    if (!e.defaultPrevented) e.preventDefault()
  }

  const isLastStep = step === STEPS.length - 1

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Back to products"
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          title="Create product"
          description="Add a new product to your catalog."
        />
      </div>

      {metaError && (
        <div className="flex items-start justify-between gap-3 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {metaError}
          </div>
          <button
            type="button"
            onClick={() => setMetaError(null)}
            className="rounded p-0.5 hover:bg-amber-100"
            aria-label="Dismiss"
          >
            <XMark className="h-4 w-4" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={handleFormKeyDown}
        className="space-y-6"
        noValidate
      >
        <Stepper
          current={step}
          completed={completed}
          onSelect={goToStep}
          disabled={saving}
        />

        {stepError && <StepError message={stepError} />}

        {/* ------------------------------ Step 1: Details ------------------------------ */}
        {step === 0 && (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <SectionCard
              title="General"
              description="Give the product a title and describe it."
            >
              <div className="space-y-4">
                <FormField label="Title" htmlFor="title">
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      if (stepError) setStepError(null)
                    }}
                    placeholder="Winter jacket"
                    required
                    autoFocus
                  />
                </FormField>
                <FormField
                  label="Handle"
                  htmlFor="handle"
                  hint="The handle is used to reference the product in your storefront. If left blank it is generated from the title."
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-grey-40">
                      /
                    </span>
                    <Input
                      id="handle"
                      value={handle}
                      onChange={(e) => {
                        setHandle(e.target.value)
                        setHandleEdited(true)
                      }}
                      placeholder="winter-jacket"
                      className="pl-7"
                    />
                  </div>
                </FormField>
                <FormField label="Description" htmlFor="description" hint="Optional">
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A warm and cozy jacket"
                    rows={5}
                  />
                </FormField>
              </div>
            </SectionCard>

            <SectionCard
              title="Media"
              description="Add images to showcase the product. The thumbnail is used in lists and previews."
            >
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-large border border-dashed py-10 text-center transition-colors",
                    dragActive
                      ? "border-grey-50 bg-grey-10"
                      : "border-grey-30 bg-grey-5"
                  )}
                >
                  <CloudArrowUp className="mb-2 h-6 w-6 text-grey-40" />
                  <p className="text-sm font-medium text-grey-70">
                    Drag and drop images here
                  </p>
                  <p className="mt-0.5 text-xs text-grey-50">
                    PNG, JPG, WebP or GIF up to 10 MB.
                  </p>
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
                  >
                    <Plus className="h-4 w-4" />
                    Upload images
                  </button>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    multiple
                    onChange={handleMediaSelect}
                    className="hidden"
                  />
                </div>

                {media.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-grey-50">
                    <Photo className="h-4 w-4 text-grey-40" />
                    No images added yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-grey-10 rounded-base border border-grey-20">
                    {media.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <div className="h-10 w-[30px] shrink-0 overflow-hidden rounded-[4px] border border-grey-20 bg-grey-10">
                          <img
                            src={item.url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-grey-90">
                              {item.name}
                            </p>
                            {item.isThumbnail && (
                              <span className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-1.5 py-0.5 text-[10px] font-medium text-grey-60">
                                <ThumbnailBadge className="h-3 w-3" />
                                Thumbnail
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-grey-50">
                            {formatBytes(item.size)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <ActionMenu
                            label={`Actions for ${item.name}`}
                            items={[
                              {
                                label: "Make thumbnail",
                                icon: StackPerspective,
                                onClick: () => makeThumbnail(item.id),
                              },
                              {
                                label: "Delete",
                                icon: Trash,
                                destructive: true,
                                onClick: () => removeMedia(item.id),
                              },
                            ]}
                          />
                          <button
                            type="button"
                            onClick={() => removeMedia(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="rounded-base p-1.5 text-grey-50 hover:bg-grey-10 hover:text-grey-90"
                          >
                            <XMark className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ Step 2: Organize ------------------------------ */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <SectionCard
              title="Organize"
              description="Categorize the product so customers can find it."
            >
              <div className="space-y-4">
                <FormField
                  label="Status"
                  htmlFor="status"
                  hint="You can also publish or save as draft from the final step."
                >
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
                <FormField label="Collection" htmlFor="collection" hint="Optional">
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
                <FormField label="Categories" htmlFor="categories" hint="Optional">
                  <div className="space-y-2">
                    {categoryIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {categoryIds.map((id) => {
                          const cat = categories.find((c) => c.id === id)
                          return (
                            <Chip
                              key={id}
                              label={cat?.name ?? id}
                              removeLabel={`Remove category ${cat?.name ?? id}`}
                              onRemove={() =>
                                setCategoryIds((prev) =>
                                  prev.filter((c) => c !== id)
                                )
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                    <Select
                      id="categories"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value
                        if (!id) return
                        setCategoryIds((prev) =>
                          prev.includes(id) ? prev : [...prev, id]
                        )
                        e.target.value = ""
                      }}
                      disabled={loadingMeta || categories.length === 0}
                    >
                      <option value="">
                        {loadingMeta
                          ? "Loading categories..."
                          : categories.length === 0
                            ? "No categories available"
                            : "Add a category"}
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </FormField>
                <FormField label="Tags" htmlFor="tags" hint="Optional">
                  <div className="space-y-2">
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.map((tag) => (
                          <Chip
                            key={tag.value}
                            label={tag.value}
                            removeLabel={`Remove tag ${tag.value}`}
                            onRemove={() => removeTag(tag.value)}
                          />
                        ))}
                      </div>
                    )}
                    <Select
                      id="tags"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value
                        if (!id) return
                        addExistingTag(id)
                        e.target.value = ""
                      }}
                      disabled={loadingMeta || allTags.length === 0}
                    >
                      <option value="">
                        {loadingMeta
                          ? "Loading tags..."
                          : allTags.length === 0
                            ? "No existing tags"
                            : "Add an existing tag"}
                      </option>
                      {allTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.value}
                        </option>
                      ))}
                    </Select>
                    <div className="flex gap-2">
                      <Input
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addNewTag()
                          }
                        }}
                        placeholder="Create a new tag and press Enter"
                      />
                      <button
                        type="button"
                        onClick={addNewTag}
                        disabled={!newTagInput.trim()}
                        className="inline-flex shrink-0 items-center justify-center rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Add tag"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </FormField>
                <div className="rounded-base border border-grey-20 bg-grey-5 px-4 py-3">
                  <p className="text-sm font-medium text-grey-70">
                    Sales channel
                  </p>
                  <p className="mt-0.5 text-sm text-grey-50">
                    This product is automatically made available in your store's
                    sales channel.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ Step 3: Variants ------------------------------ */}
        {step === 2 && (
          <SectionCard
            title="Variants"
            description="Add options like color or size to create variants of this product."
          >
            <div className="space-y-6">
              <div className="rounded-base border border-grey-20 p-4">
                <h3 className="mb-1 text-sm font-medium text-grey-90">
                  Product options
                </h3>
                <p className="mb-3 text-xs text-grey-50">
                  Leave empty to create a single default variant.
                </p>
                <div className="space-y-3">
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className="space-y-3 rounded-base border border-grey-20 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-grey-90">
                          {option.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeOption(option.id)}
                          className="rounded-base p-1.5 text-grey-50 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove option ${option.title}`}
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {option.values.map((value) => (
                          <Chip
                            key={value}
                            label={value}
                            removeLabel={`Remove value ${value}`}
                            onRemove={() =>
                              removeOptionValue(option.id, value)
                            }
                          />
                        ))}
                        {option.values.length === 0 && (
                          <span className="text-xs text-grey-50">
                            No values yet
                          </span>
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
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addOptionValues(option.id)
                            }
                          }}
                          placeholder="Red, Blue, Green"
                        />
                        <button
                          type="button"
                          onClick={() => addOptionValues(option.id)}
                          disabled={
                            !(optionValueInputs[option.id] || "").trim()
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={optionTitle}
                      onChange={(e) => setOptionTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addOption()
                        }
                      }}
                      placeholder="Option title, e.g. Color"
                    />
                    <button
                      type="button"
                      onClick={addOption}
                      disabled={!optionTitle.trim()}
                      className="inline-flex shrink-0 items-center justify-center gap-1 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add option
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-grey-90">
                  Product variants
                </h3>
                {options.length > 0 && rows.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Add options to create variants.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-grey-10 text-grey-70">
                            <tr>
                              {options.length > 0 && (
                                <th className="w-10 px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={allIncluded}
                                    ref={(el) => {
                                      if (el) {
                                        el.indeterminate =
                                          someIncluded && !allIncluded
                                      }
                                    }}
                                    onChange={(e) =>
                                      setRows((prev) =>
                                        prev.map((r) => ({
                                          ...r,
                                          include: e.target.checked,
                                        }))
                                      )
                                    }
                                    aria-label="Select all variants"
                                    className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                                  />
                                </th>
                              )}
                              <th className="px-4 py-3 font-medium">
                                {options.length > 0
                                  ? options.map((o) => o.title).join(" / ")
                                  : "Variant"}
                              </th>
                              <th className="px-4 py-3 font-medium">SKU</th>
                              <th className="px-4 py-3 font-medium">
                                Allow backorder
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-grey-10">
                            {rows.map((row) => (
                              <tr
                                key={row.key}
                                className={cn(
                                  options.length > 0 &&
                                    !row.include &&
                                    "opacity-50"
                                )}
                              >
                                {options.length > 0 && (
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={row.include}
                                      onChange={(e) =>
                                        updateRow(row.key, {
                                          include: e.target.checked,
                                        })
                                      }
                                      aria-label={`Create variant ${row.title}`}
                                      className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                                    />
                                  </td>
                                )}
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-grey-90">
                                  {row.title}
                                </td>
                                <td className="px-4 py-2">
                                  <Input
                                    value={row.sku}
                                    onChange={(e) =>
                                      updateRow(row.key, {
                                        sku: e.target.value,
                                      })
                                    }
                                    disabled={
                                      options.length > 0 && !row.include
                                    }
                                    placeholder="SKU"
                                    className="min-w-[140px]"
                                    aria-label={`SKU for ${row.title}`}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={row.allowBackorder}
                                    onChange={(e) =>
                                      updateRow(row.key, {
                                        allowBackorder: e.target.checked,
                                      })
                                    }
                                    disabled={
                                      options.length > 0 && !row.include
                                    }
                                    aria-label={`Allow backorder for ${row.title}`}
                                    className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {options.length > 0 && (
                      <InlineTip>
                        Variants left unchecked won't be created.
                      </InlineTip>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ------------------------------ Step 4: Prices ------------------------------ */}
        {step === 3 && (
          <SectionCard
            title="Prices"
            description="Set a price per currency for each variant. Amounts are in major units, e.g. 19.99."
          >
            {includedRows.length === 0 ? (
              <div className="flex items-start gap-2 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Please select at least one variant.
              </div>
            ) : (
              <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-grey-10 text-grey-70">
                      <tr>
                        <th className="px-4 py-3 font-medium">Variant</th>
                        {currencies.map((code) => (
                          <th key={code} className="px-4 py-3 font-medium">
                            Price {code.toUpperCase()}
                            {code === defaultCurrency && (
                              <span className="ml-1.5 rounded-base bg-grey-20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-grey-60">
                                Default
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-10">
                      {includedRows.map((row) => (
                        <tr key={row.key}>
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-grey-90">
                            {row.title}
                          </td>
                          {currencies.map((code) => (
                            <td key={code} className="px-4 py-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={row.prices[code] ?? ""}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    prices: {
                                      ...row.prices,
                                      [code]: e.target.value,
                                    },
                                  })
                                }
                                placeholder="0.00"
                                className="min-w-[110px]"
                                aria-label={`Price ${code.toUpperCase()} for ${row.title}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ------------------------------ Footer ------------------------------ */}
        <div className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-grey-10 pt-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-name="save-draft-button"
            onClick={() => handleSubmit("draft")}
            disabled={saving}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save as draft"}
          </button>
          {isLastStep ? (
            <button
              type="button"
              onClick={() => handleSubmit(primaryStatus)}
              disabled={saving}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : primaryLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goToStep(step + 1)}
              disabled={saving}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          )}
        </div>
      </form>

      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-2 rounded-large px-4 py-3 text-sm shadow-lg",
            toast.type === "success" && "bg-emerald-50 text-emerald-800",
            toast.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {toast.type === "error" ? (
            <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {toast.text}
        </div>
      )}
    </div>
  )
}
