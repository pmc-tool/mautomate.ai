"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  CurrencyDollar,
  DocumentText,
  ExclamationCircle,
  PencilSquare,
  Photo,
  Plus,
  ShoppingBag,
  Trash,
  TruckFast,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { DataTable } from "@components/merchant-admin/data-table"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  ApiError,
  ProductCategory,
  ProductCollection,
  ProductFullDetail,
  ProductFullVariant,
  ProductTag,
  ProductType,
  UpdateProductInput,
  createProductOption,
  createVariant,
  deleteProduct,
  deleteProductImage,
  deleteProductOption,
  deleteVariant,
  getProductFull,
  listCategories,
  listCollections,
  listProductTags,
  listProductTypes,
  listShippingProfilesLite,
  listStoreCurrencies,
  setImageVariants,
  updateProduct,
  updateProductOption,
  uploadProductMedia,
} from "../../../../lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

// A broad ISO-3166-1 alpha-2 list; names rendered via Intl.DisplayNames.
const COUNTRY_CODES =
  "us ca gb au nz ie de fr es it nl be pt ch at se no dk fi pl cz sk hu ro bg gr hr si ee lv lt lu is mt cy in bd pk lk np sg my th vn ph id jp kr cn hk tw ae sa qa kw bh om il tr eg za ng ke gh ma dz tn br mx ar cl co pe uy ec ve bo py cr pa gt do jm tt ru ua by kz ge am az".split(
    " "
  )

function countryName(code?: string | null): string {
  if (!code) return ""
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  proposed: "Proposed",
  published: "Published",
  rejected: "Rejected",
}

// Spec badge colors: draft=grey, proposed=orange, published=green, rejected=red.
const PRODUCT_STATUS_CLASSES: Record<string, string> = {
  draft: "bg-grey-10 text-grey-70",
  proposed: "bg-orange-50 text-orange-800",
  published: "bg-emerald-50 text-emerald-800",
  rejected: "bg-rose-50 text-rose-800",
}

function ProductStatusBadge({ status }: { status?: string | null }) {
  const key = (status ?? "").toLowerCase()
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        PRODUCT_STATUS_CLASSES[key] || "bg-grey-10 text-grey-70"
      )}
    >
      {PRODUCT_STATUS_LABELS[key] || status || "Unknown"}
    </span>
  )
}

function SectionRow({ label, value }: { label: string; value?: React.ReactNode }) {
  const isEmpty = value === null || value === undefined || value === ""
  return (
    <div className="grid grid-cols-2 items-start gap-4 border-b border-grey-10 py-3 text-sm last:border-0 last:pb-0">
      <dt className="text-grey-50">{label}</dt>
      <dd className="break-words font-medium text-grey-90">
        {isEmpty ? <span className="font-normal text-grey-40">-</span> : value}
      </dd>
    </div>
  )
}

const secondaryButton =
  "inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
const cancelButton =
  "inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
const primaryButton =
  "inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"

type GeneralForm = {
  status: string
  title: string
  subtitle: string
  handle: string
  description: string
  discountable: boolean
}

type QueuedImage = { id: string; url: string; file: File }

type OptionForm = { title: string; values: string }

type VariantForm = {
  title: string
  sku: string
  manage_inventory: boolean
  allow_backorder: boolean
  options: Record<string, string>
  prices: Record<string, string>
}

type OrganizeForm = {
  type_id: string
  collection_id: string
  category_ids: string[]
  tags: string[]
}

type AttributesForm = {
  width: string
  height: string
  length: string
  weight: string
  mid_code: string
  hs_code: string
  origin_country: string
  material: string
}

type MetaRow = {
  id: number
  key: string
  value: string
  locked: boolean
  raw: unknown
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [product, setProduct] = useState<ProductFullDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  // Reference data
  const [collections, setCollections] = useState<ProductCollection[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [allTags, setAllTags] = useState<ProductTag[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["usd"])

  // General edit drawer
  const [generalOpen, setGeneralOpen] = useState(false)
  const [genForm, setGenForm] = useState<GeneralForm>({
    status: "draft",
    title: "",
    subtitle: "",
    handle: "",
    description: "",
    discountable: true,
  })

  // Media edit modal
  const [mediaOpen, setMediaOpen] = useState(false)
  // "Assign to variants" — which image is open, and the variants ticked for it.
  // An image linked to NO variants is shown for every variant (Medusa's rule),
  // which is why a fresh product needs no tagging at all to keep working.
  const [imgVariantsFor, setImgVariantsFor] = useState<{
    id: string
    url: string
  } | null>(null)
  const [imgVariantIds, setImgVariantIds] = useState<Set<string>>(new Set())
  const [queued, setQueued] = useState<QueuedImage[]>([])

  // Options manage modal
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [optionForms, setOptionForms] = useState<Record<string, OptionForm>>({})
  const [newOption, setNewOption] = useState<OptionForm>({ title: "", values: "" })

  // Variant create modal
  const [variantOpen, setVariantOpen] = useState(false)
  const [variantForm, setVariantForm] = useState<VariantForm>({
    title: "",
    sku: "",
    manage_inventory: true,
    allow_backorder: false,
    options: {},
    prices: {},
  })

  // Organize drawer
  const [organizeOpen, setOrganizeOpen] = useState(false)
  const [orgForm, setOrgForm] = useState<OrganizeForm>({
    type_id: "",
    collection_id: "",
    category_ids: [],
    tags: [],
  })
  const [tagInput, setTagInput] = useState("")

  // Attributes drawer
  const [attrsOpen, setAttrsOpen] = useState(false)
  const [attrForm, setAttrForm] = useState<AttributesForm>({
    width: "",
    height: "",
    length: "",
    weight: "",
    mid_code: "",
    hs_code: "",
    origin_country: "",
    material: "",
  })

  // Shipping profile drawer
  const [shipOpen, setShipOpen] = useState(false)
  const [shipProfiles, setShipProfiles] = useState<{ id: string; name: string }[]>([])
  const [shipSel, setShipSel] = useState("")

  // Metadata drawer
  const [metaOpen, setMetaOpen] = useState(false)
  const [metaRows, setMetaRows] = useState<MetaRow[]>([])
  const metaSeq = useRef(0)

  const editParamHandled = useRef(false)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load(initial = false) {
    if (!token || !id) return
    if (initial) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await getProductFull(token, id)
      setProduct(res.product)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      const msg = err instanceof Error ? err.message : "Failed to load product"
      if (initial) {
        setError(msg)
      } else {
        showMessage("error", msg)
      }
    } finally {
      if (initial) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  useEffect(() => {
    if (!token) return
    Promise.all([
      listCollections(token).then((r) => setCollections(r.collections || [])),
      listProductTypes(token).then((r) => setProductTypes(r.types || [])),
      listCategories(token).then((r) => setCategories(r.categories || [])),
      listProductTags(token).then((r) => setAllTags(r.tags || [])),
    ]).catch(() => {})

    listStoreCurrencies(token)
      .then((r) => {
        const list = (r.currencies || []).map((c) => c.toLowerCase())
        const def = (r.default_currency || list[0] || "usd").toLowerCase()
        const ordered = [def, ...list.filter((c) => c !== def)]
        if (ordered.length) setCurrencies(ordered)
      })
      .catch(() => {})
  }, [token])

  // ?edit=1 deep-link opens the General edit drawer once the product is loaded.
  useEffect(() => {
    if (!product || editParamHandled.current) return
    editParamHandled.current = true
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("edit") === "1") {
        openGeneralEdit(product)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    if (!token) return false
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await load(false)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  // ---- General ----
  function openGeneralEdit(p: ProductFullDetail) {
    setGenForm({
      status: p.status || "draft",
      title: p.title || "",
      subtitle: p.subtitle || "",
      handle: p.handle || "",
      description: p.description || "",
      discountable: p.discountable ?? true,
    })
    setGeneralOpen(true)
  }

  async function saveGeneral(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !product) return
    if (!genForm.title.trim() || !genForm.handle.trim()) return
    const body: Record<string, unknown> = {
      status: genForm.status,
      title: genForm.title.trim(),
      subtitle: genForm.subtitle.trim() || null,
      handle: genForm.handle.trim().replace(/^\/+/, ""),
      description: genForm.description.trim() || null,
      discountable: genForm.discountable,
    }
    const ok = await run(
      "save-general",
      () => updateProduct(token, product.id, body as UpdateProductInput),
      `Product ${genForm.title.trim()} was successfully updated.`
    )
    if (ok) setGeneralOpen(false)
  }

  async function handleDeleteProduct() {
    if (!token || !product) return
    if (
      !confirm(
        `You are about to delete the product ${product.title}. This action cannot be undone.`
      )
    ) {
      return
    }
    setBusy("del-product")
    try {
      await deleteProduct(token, product.id)
      router.push("/dashboard/products")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to delete product")
      setBusy(null)
    }
  }

  // ---- Media ----
  const mediaItems = useMemo(() => {
    if (!product) return []
    const images = product.images || []
    const thumb = product.thumbnail
    const items = images.map((img) => ({
      id: img.id,
      url: img.url,
      isThumbnail: !!thumb && img.url === thumb,
      synthetic: false,
      variantIds: (img.variants || []).map((v) => v.id),
    }))
    // A thumbnail not present in images[] is prepended as a synthetic item.
    if (thumb && !images.some((img) => img.url === thumb)) {
      items.unshift({
        id: "synthetic_thumbnail",
        url: thumb,
        isThumbnail: true,
        synthetic: true,
        variantIds: [],
      })
    }
    return items
  }, [product])

  function openMediaEdit() {
    setQueued([])
    setMediaOpen(true)
  }

  /** Open the "shown for which variants" picker for one image. */
  function openImageVariants(img: { id: string; url: string; variantIds: string[] }) {
    setImgVariantsFor({ id: img.id, url: img.url })
    setImgVariantIds(new Set(img.variantIds))
  }

  /** Persist the tick-boxes as an add/remove diff against what was linked. */
  async function saveImageVariants() {
    if (!token || !product || !imgVariantsFor) return
    const before = new Set(
      (product.images || []).find((i) => i.id === imgVariantsFor.id)?.variants?.map(
        (v) => v.id
      ) ?? []
    )
    const add = [...imgVariantIds].filter((id) => !before.has(id))
    const remove = [...before].filter((id) => !imgVariantIds.has(id))
    if (!add.length && !remove.length) {
      setImgVariantsFor(null)
      return
    }
    setBusy("save-image-variants")
    try {
      await setImageVariants(token, product.id, imgVariantsFor.id, { add, remove })
      showMessage("success", "Image variants were updated.")
      await load(false)
      setImgVariantsFor(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", "Failed to update the image's variants. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  function closeMediaEdit() {
    queued.forEach((q) => URL.revokeObjectURL(q.url))
    setQueued([])
    setMediaOpen(false)
  }

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setQueued((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        url: URL.createObjectURL(file),
        file,
      })),
    ])
    e.target.value = ""
  }

  function removeQueued(qid: string) {
    setQueued((prev) => {
      const item = prev.find((q) => q.id === qid)
      if (item) URL.revokeObjectURL(item.url)
      return prev.filter((q) => q.id !== qid)
    })
  }

  async function saveMedia() {
    if (!token || !product || queued.length === 0) return
    setBusy("save-media")
    try {
      for (const q of queued) {
        await uploadProductMedia(token, product.id, q.file)
      }
      queued.forEach((q) => URL.revokeObjectURL(q.url))
      setQueued([])
      showMessage("success", "Media was successfully updated.")
      await load(false)
      setMediaOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", "Failed to upload the added media. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  async function handleDeleteImage(item: { id: string; isThumbnail: boolean }) {
    if (!token || !product) return
    const warning = item.isThumbnail
      ? "You are about to delete 1 image including the thumbnail. This action cannot be undone."
      : "You are about to delete 1 image. This action cannot be undone."
    if (!confirm(warning)) return
    await run(
      `del-img-${item.id}`,
      () => deleteProductImage(token, product.id, item.id),
      "Media was successfully updated."
    )
  }

  async function handleMakeThumbnail(url: string) {
    if (!token || !product) return
    await run(
      `thumb-${url}`,
      () => updateProduct(token, product.id, { thumbnail: url } as UpdateProductInput),
      "Media was successfully updated."
    )
  }

  // ---- Options ----
  function openOptionsManage() {
    if (!product) return
    const forms: Record<string, OptionForm> = {}
    for (const opt of product.options || []) {
      forms[opt.id] = {
        title: opt.title,
        values: (opt.values || []).map((v) => v.value).join(", "),
      }
    }
    setOptionForms(forms)
    setNewOption({ title: "", values: "" })
    setOptionsOpen(true)
  }

  function parseOptionValues(raw: string): string[] {
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      )
    )
  }

  async function saveOption(optionId: string) {
    if (!token || !product) return
    const form = optionForms[optionId]
    if (!form) return
    const values = parseOptionValues(form.values)
    if (!form.title.trim() || values.length === 0) {
      showMessage("error", "Please select at least one value for the added option(s).")
      return
    }
    await run(
      `save-option-${optionId}`,
      () =>
        updateProductOption(token, product.id, optionId, {
          title: form.title.trim(),
          values,
        }),
      `Option ${form.title.trim()} was successfully updated.`
    )
  }

  async function addOption() {
    if (!token || !product) return
    const values = parseOptionValues(newOption.values)
    if (!newOption.title.trim() || values.length === 0) {
      showMessage("error", "Please select at least one value for the added option(s).")
      return
    }
    const ok = await run(
      "add-option",
      () =>
        createProductOption(token, product.id, {
          title: newOption.title.trim(),
          values,
        }),
      `Option ${newOption.title.trim()} was successfully created.`
    )
    if (ok) setNewOption({ title: "", values: "" })
  }

  async function handleDeleteOption(opt: { id: string; title: string }) {
    if (!token || !product) return
    if (
      !confirm(
        `You are about to delete the product option: ${opt.title}. This action cannot be undone.`
      )
    ) {
      return
    }
    await run(
      `del-option-${opt.id}`,
      () => deleteProductOption(token, product.id, opt.id),
      `Option ${opt.title} was successfully deleted.`
    )
  }

  // Keep the option edit forms in sync when the product refetches while the
  // manage modal is open (e.g. after a per-option save or delete).
  useEffect(() => {
    if (!optionsOpen || !product) return
    setOptionForms((prev) => {
      const next: Record<string, OptionForm> = {}
      for (const opt of product.options || []) {
        next[opt.id] = prev[opt.id] ?? {
          title: opt.title,
          values: (opt.values || []).map((v) => v.value).join(", "),
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  // ---- Variants ----
  function openVariantCreate() {
    if (!product) return
    setVariantForm({
      title: "",
      sku: "",
      manage_inventory: true,
      allow_backorder: false,
      options: {},
      prices: {},
    })
    setVariantOpen(true)
  }

  const variantOptionsComplete = useMemo(() => {
    const opts = product?.options || []
    if (opts.length === 0) return true
    return opts.every((opt) => !!variantForm.options[opt.title])
  }, [product, variantForm.options])

  const variantCanSave =
    (product?.options || []).length > 0
      ? variantOptionsComplete
      : !!variantForm.title.trim()

  async function saveVariant(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !product || !variantCanSave) return
    const selected: Record<string, string> = {}
    for (const opt of product.options || []) {
      const value = variantForm.options[opt.title]
      if (value) selected[opt.title] = value
    }
    const title =
      variantForm.title.trim() || Object.values(selected).join(" / ") || "Default variant"
    const prices = currencies
      .map((code) => ({ code, raw: (variantForm.prices[code] || "").trim() }))
      .filter((p) => p.raw !== "")
      .map((p) => ({ currency_code: p.code, amount: Number(p.raw) }))
      .filter((p) => Number.isFinite(p.amount) && p.amount >= 0)
    const ok = await run(
      "create-variant",
      () =>
        createVariant(token, product.id, {
          title,
          sku: variantForm.sku.trim() || undefined,
          manage_inventory: variantForm.manage_inventory,
          allow_backorder: variantForm.allow_backorder,
          options: selected,
          prices,
        }),
      `Variant ${title} was successfully created.`
    )
    if (ok) setVariantOpen(false)
  }

  async function handleDeleteVariant(variant: ProductFullVariant) {
    if (!token || !product) return
    if (
      !confirm(
        `You are about to delete the variant ${variant.title}. This action cannot be undone.`
      )
    ) {
      return
    }
    await run(
      `del-variant-${variant.id}`,
      () => deleteVariant(token, product.id, variant.id),
      `Variant ${variant.title} was successfully deleted.`
    )
  }

  const variantColumns = useMemo(() => {
    const optionCols = (product?.options || []).map((opt) => ({
      key: opt.id,
      header: opt.title,
      render: (v: ProductFullVariant) => {
        const value = (v.options || []).find((o) => o.option?.id === opt.id)?.value
        return value ? (
          <span className="rounded-base bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
            {value}
          </span>
        ) : (
          <span className="text-grey-40">-</span>
        )
      },
    }))
    return [
      {
        key: "title",
        header: "Title",
        render: (v: ProductFullVariant) => {
          // The variant's own image when it has one, else the product's — the
          // same fallback the storefront and the cart use, so what a merchant
          // sees here is what a shopper gets.
          const img = v.thumbnail || product?.thumbnail || null
          return (
            <span className="flex items-center gap-2">
              {img ? (
                <img
                  src={img}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-base border border-grey-20 object-cover"
                />
              ) : (
                <span className="h-8 w-8 shrink-0 rounded-base border border-grey-20 bg-grey-10" />
              )}
              <span className="font-medium text-grey-90">{v.title}</span>
            </span>
          )
        },
      },
      {
        key: "sku",
        header: "SKU",
        render: (v: ProductFullVariant) => v.sku || <span className="text-grey-40">-</span>,
      },
      ...optionCols,
      {
        key: "inventory",
        header: "Inventory",
        render: (v: ProductFullVariant) => {
          if (!v.manage_inventory) {
            return <span className="text-grey-40">-</span>
          }
          const qty = v.inventory_quantity ?? 0
          return (
            <span className={cn(qty === 0 && "font-medium text-rose-600")}>
              {qty} available
            </span>
          )
        },
      },
    ]
  }, [product?.options])

  // ---- Organize ----
  function openOrganize() {
    if (!product) return
    setOrgForm({
      type_id: product.type?.id ?? "",
      collection_id: product.collection?.id ?? "",
      category_ids: (product.categories || []).map((c) => c.id),
      tags: (product.tags || []).map((t) => t.value),
    })
    setTagInput("")
    setOrganizeOpen(true)
  }

  function addOrgTag(raw: string) {
    const value = raw.trim()
    if (!value) return
    setOrgForm((prev) =>
      prev.tags.some((t) => t.toLowerCase() === value.toLowerCase())
        ? prev
        : { ...prev, tags: [...prev.tags, value] }
    )
    setTagInput("")
  }

  async function saveOrganize(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !product) return
    const body: Record<string, unknown> = {
      type_id: orgForm.type_id || null,
      collection_ids: orgForm.collection_id ? [orgForm.collection_id] : [],
      category_ids: orgForm.category_ids,
      tags: orgForm.tags,
    }
    const ok = await run(
      "save-organize",
      () => updateProduct(token, product.id, body as UpdateProductInput),
      `Successfully updated the organization of ${product.title}.`
    )
    if (ok) setOrganizeOpen(false)
  }

  // ---- Attributes ----
  function openAttributes() {
    if (!product) return
    const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))
    setAttrForm({
      width: str(product.width),
      height: str(product.height),
      length: str(product.length),
      weight: str(product.weight),
      mid_code: str(product.mid_code),
      hs_code: str(product.hs_code),
      origin_country: (product.origin_country || "").toLowerCase(),
      material: str(product.material),
    })
    setAttrsOpen(true)
  }

  async function saveAttributes(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !product) return
    const num = (s: string) => {
      const t = s.trim()
      if (!t) return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }
    const body: Record<string, unknown> = {
      width: num(attrForm.width),
      height: num(attrForm.height),
      length: num(attrForm.length),
      weight: num(attrForm.weight),
      mid_code: attrForm.mid_code.trim() || null,
      hs_code: attrForm.hs_code.trim() || null,
      origin_country: attrForm.origin_country || null,
      material: attrForm.material.trim() || null,
    }
    const ok = await run(
      "save-attributes",
      () => updateProduct(token, product.id, body as UpdateProductInput),
      `Product ${product.title} was successfully updated.`
    )
    if (ok) setAttrsOpen(false)
  }

  // ---- Shipping profile ----
  async function openShipping() {
    if (!token || !product) return
    setBusy("load-profiles")
    try {
      const res = await listShippingProfilesLite(token)
      setShipProfiles(res.profiles || [])
      setShipSel(product.shipping_profile?.id ?? "")
      setShipOpen(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to load shipping profiles"
      )
    } finally {
      setBusy(null)
    }
  }

  async function saveShipping(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !product) return
    const body: Record<string, unknown> = { shipping_profile_id: shipSel || null }
    const ok = await run(
      "save-shipping",
      () => updateProduct(token, product.id, body as UpdateProductInput),
      `Successfully updated the shipping profile for ${product.title}.`
    )
    if (ok) setShipOpen(false)
  }

  // ---- Metadata ----
  function openMetadata() {
    if (!product) return
    const entries = Object.entries(product.metadata || {})
    metaSeq.current = 0
    const rows: MetaRow[] = entries.map(([key, value]) => {
      const primitive =
        value === null || ["string", "number", "boolean"].includes(typeof value)
      return {
        id: metaSeq.current++,
        key,
        value: primitive ? (value === null ? "" : String(value)) : JSON.stringify(value),
        locked: !primitive,
        raw: value,
      }
    })
    if (rows.length === 0) {
      rows.push({ id: metaSeq.current++, key: "", value: "", locked: false, raw: undefined })
    }
    setMetaRows(rows)
    setMetaOpen(true)
  }

  function insertMetaRow(index: number) {
    setMetaRows((prev) => {
      const next = [...prev]
      next.splice(index, 0, {
        id: metaSeq.current++,
        key: "",
        value: "",
        locked: false,
        raw: undefined,
      })
      return next
    })
  }

  function deleteMetaRow(rowId: number) {
    setMetaRows((prev) => {
      const next = prev.filter((r) => r.id !== rowId)
      return next.length
        ? next
        : [{ id: metaSeq.current++, key: "", value: "", locked: false, raw: undefined }]
    })
  }

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !product) return
    const metadata: Record<string, unknown> = {}
    for (const row of metaRows) {
      const key = row.key.trim()
      if (!key) continue
      metadata[key] = row.locked ? row.raw : row.value
    }
    const ok = await run(
      "save-metadata",
      () => updateProduct(token, product.id, { metadata } as UpdateProductInput),
      "Metadata was successfully updated."
    )
    if (ok) setMetaOpen(false)
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product" description="Loading..." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-large border border-grey-20 bg-grey-10"
              />
            ))}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-large border border-grey-20 bg-grey-10"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product" description="We could not load this product." />
        <EmptyState
          icon={ExclamationCircle}
          title="Product not found"
          description={error || "This product does not exist or you do not have access to it."}
          action={
            <Link href="/dashboard/products" className={secondaryButton}>
              <ArrowLeftMini className="h-4 w-4" />
              Back to products
            </Link>
          }
        />
      </div>
    )
  }

  const metadataCount = Object.keys(product.metadata || {}).length
  const salesChannels = product.sales_channels || []

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to products
      </Link>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <TwoColumnLayout
        sidebar={
          <>
            {/* Organize */}
            <SectionCard
              title="Organize"
              action={
                <ActionMenu
                  items={[{ label: "Edit", icon: PencilSquare, onClick: openOrganize }]}
                />
              }
            >
              <dl>
                <SectionRow
                  label="Type"
                  value={
                    product.type ? (
                      <span className="rounded-base bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                        {product.type.value}
                      </span>
                    ) : null
                  }
                />
                <SectionRow
                  label="Collection"
                  value={
                    product.collection ? (
                      <span className="rounded-base bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70">
                        {product.collection.title}
                      </span>
                    ) : null
                  }
                />
                <SectionRow
                  label="Categories"
                  value={
                    (product.categories || []).length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {(product.categories || []).map((cat) => (
                          <span
                            key={cat.id}
                            className="rounded-base bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </span>
                    ) : null
                  }
                />
                <SectionRow
                  label="Tags"
                  value={
                    (product.tags || []).length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {(product.tags || []).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-base bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70"
                          >
                            {tag.value}
                          </span>
                        ))}
                      </span>
                    ) : null
                  }
                />
              </dl>
            </SectionCard>

            {/* Attributes */}
            <SectionCard
              title="Attributes"
              action={
                <ActionMenu
                  items={[{ label: "Edit", icon: PencilSquare, onClick: openAttributes }]}
                />
              }
            >
              <dl>
                <SectionRow label="Height" value={product.height ?? null} />
                <SectionRow label="Width" value={product.width ?? null} />
                <SectionRow label="Length" value={product.length ?? null} />
                <SectionRow label="Weight" value={product.weight ?? null} />
                <SectionRow label="Mid code" value={product.mid_code} />
                <SectionRow label="HS code" value={product.hs_code} />
                <SectionRow
                  label="Country of origin"
                  value={product.origin_country ? countryName(product.origin_country) : null}
                />
                <SectionRow label="Material" value={product.material} />
              </dl>
            </SectionCard>

            {/* Sales channels (read-only: single tenant channel) */}
            <SectionCard title="Sales channels">
              {salesChannels.length > 0 ? (
                <ul className="space-y-2">
                  {salesChannels.map((sc) => (
                    <li key={sc.id} className="flex items-center gap-2 text-sm text-grey-80">
                      <ShoppingBag className="h-4 w-4 shrink-0 text-grey-40" />
                      {sc.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-grey-50">Not available in any sales channels</p>
              )}
              <p className="mt-3 text-xs text-grey-50">
                Your store sells through this channel. Channel assignment is managed
                automatically.
              </p>
            </SectionCard>

            {/* Shipping configuration */}
            <SectionCard
              title="Shipping configuration"
              action={
                <ActionMenu
                  items={[{ label: "Edit", icon: PencilSquare, onClick: openShipping }]}
                />
              }
            >
              {product.shipping_profile ? (
                <div className="flex items-center gap-2 text-sm text-grey-80">
                  <TruckFast className="h-4 w-4 shrink-0 text-grey-40" />
                  {product.shipping_profile.name}
                </div>
              ) : (
                <p className="text-sm text-grey-50">No shipping profile configured.</p>
              )}
            </SectionCard>
          </>
        }
      >
        {/* General */}
        <SectionCard
          title={product.title}
          description={product.subtitle || undefined}
          action={
            <div className="flex items-center gap-3">
              <ProductStatusBadge status={product.status} />
              <ActionMenu
                items={[
                  {
                    label: "Edit",
                    icon: PencilSquare,
                    onClick: () => openGeneralEdit(product),
                  },
                  {
                    label: "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: handleDeleteProduct,
                  },
                ]}
              />
            </div>
          }
        >
          <dl>
            <SectionRow label="Description" value={product.description} />
            <SectionRow label="Subtitle" value={product.subtitle} />
            <SectionRow
              label="Handle"
              value={product.handle ? `/${product.handle}` : null}
            />
            <SectionRow label="Material" value={product.material} />
            <SectionRow label="Discountable" value={product.discountable ? "True" : "False"} />
          </dl>
        </SectionCard>

        {/* Media */}
        <SectionCard
          title="Media"
          action={
            <ActionMenu
              items={[{ label: "Edit", icon: PencilSquare, onClick: openMediaEdit }]}
            />
          }
        >
          {mediaItems.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
              {mediaItems.map((item) => {
                const variantCount = item.variantIds.length
                const totalVariants = (product.variants || []).length
                return (
                  <div
                    key={item.id}
                    className="relative aspect-square overflow-hidden rounded-base border border-grey-20 bg-grey-10"
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                    {item.isThumbnail && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-grey-70 shadow-sm">
                        Thumbnail
                      </span>
                    )}
                    {/* Which variants this image is shown for. An untagged image
                        shows for all of them, so "All variants" is the honest
                        default label — not "0". */}
                    {!item.synthetic && totalVariants > 0 && (
                      <button
                        type="button"
                        onClick={() => openImageVariants(item)}
                        title="Choose which variants show this image"
                        className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity hover:bg-black/75 focus:opacity-100 group-hover:opacity-100"
                        style={{ opacity: 1 }}
                      >
                        {variantCount === 0
                          ? "All variants"
                          : variantCount === 1
                            ? "1 variant"
                            : `${variantCount} variants`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Photo}
              title="No media yet"
              description="Add media to showcase it in your storefront."
              action={
                <button type="button" onClick={openMediaEdit} className={secondaryButton}>
                  <Plus className="h-4 w-4" />
                  Add media
                </button>
              }
              className="border-dashed shadow-none"
            />
          )}
        </SectionCard>

        {/* Options */}
        <SectionCard
          title="Options"
          action={
            <ActionMenu
              items={[
                { label: "Manage options", icon: PencilSquare, onClick: openOptionsManage },
              ]}
            />
          }
        >
          {(product.options || []).length > 0 ? (
            <dl>
              {(product.options || []).map((opt) => (
                <SectionRow
                  key={opt.id}
                  label={opt.title}
                  value={
                    (opt.values || []).length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {(opt.values || []).map((v) => (
                          <span
                            key={v.id}
                            className="rounded-base bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-70"
                          >
                            {v.value}
                          </span>
                        ))}
                      </span>
                    ) : null
                  }
                />
              ))}
            </dl>
          ) : (
            <p className="text-sm text-grey-50">No options defined.</p>
          )}
        </SectionCard>

        {/* Variants */}
        <SectionCard
          title="Variants"
          action={
            <div className="flex items-center gap-2">
              <button type="button" onClick={openVariantCreate} className={secondaryButton}>
                <Plus className="h-4 w-4" />
                Create variant
              </button>
              <ActionMenu
                items={[
                  {
                    label: "Edit prices",
                    icon: CurrencyDollar,
                    onClick: () => router.push(`/dashboard/products/${product.id}/prices`),
                  },
                  {
                    label: "Edit stock levels",
                    icon: DocumentText,
                    onClick: () => router.push(`/dashboard/products/${product.id}/stock`),
                  },
                ]}
              />
            </div>
          }
        >
          <DataTable<ProductFullVariant>
            columns={variantColumns}
            rows={product.variants || []}
            searchKeys={["title", "sku"]}
            pageSize={10}
            emptyIcon={DocumentText}
            emptyTitle="No variants"
            emptyDescription="There are no variants to display."
            onRowClick={(v) =>
              router.push(`/dashboard/products/${product.id}/variants/${v.id}`)
            }
            rowActions={(v) => (
              <span onClick={(e) => e.stopPropagation()}>
                <ActionMenu
                  items={[
                    {
                      label: "Edit",
                      icon: PencilSquare,
                      onClick: () =>
                        router.push(`/dashboard/products/${product.id}/variants/${v.id}`),
                    },
                    {
                      label: "Delete",
                      icon: Trash,
                      destructive: true,
                      onClick: () => handleDeleteVariant(v),
                    },
                  ]}
                />
              </span>
            )}
          />
        </SectionCard>

        {/* Metadata */}
        <SectionCard
          title="Metadata"
          action={
            <ActionMenu
              items={[{ label: "Edit", icon: PencilSquare, onClick: openMetadata }]}
            />
          }
        >
          <p className="text-sm text-grey-70">
            {metadataCount} {metadataCount === 1 ? "key" : "keys"}
          </p>
        </SectionCard>

        {/* JSON */}
        <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
          <button
            type="button"
            onClick={() => setShowJson((s) => !s)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
          >
            JSON
            <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
          </button>
          {showJson && (
            <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
              {JSON.stringify(product, null, 2)}
            </pre>
          )}
        </div>
      </TwoColumnLayout>

      {/* Edit Product drawer */}
      <Modal
        open={generalOpen}
        onClose={() => setGeneralOpen(false)}
        title="Edit Product"
        description="Edit the product details."
        size="sm"
      >
        <form onSubmit={saveGeneral} className="space-y-4">
          <FormField label="Status" htmlFor="gen-status">
            <Select
              id="gen-status"
              value={genForm.status}
              onChange={(e) => setGenForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="proposed">Proposed</option>
              <option value="rejected">Rejected</option>
            </Select>
          </FormField>
          <FormField label="Title" htmlFor="gen-title">
            <Input
              id="gen-title"
              value={genForm.title}
              onChange={(e) => setGenForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Winter jacket"
              required
            />
          </FormField>
          <FormField label="Subtitle" htmlFor="gen-subtitle">
            <Input
              id="gen-subtitle"
              value={genForm.subtitle}
              onChange={(e) => setGenForm((p) => ({ ...p, subtitle: e.target.value }))}
              placeholder="Warm and cosy"
            />
          </FormField>
          <FormField label="Handle" htmlFor="gen-handle">
            <div className="flex items-center rounded-base border border-grey-30 bg-white transition-colors focus-within:border-grey-90 focus-within:ring-1 focus-within:ring-grey-90">
              <span className="pl-3 text-sm text-grey-40">/</span>
              <input
                id="gen-handle"
                value={genForm.handle}
                onChange={(e) => setGenForm((p) => ({ ...p, handle: e.target.value }))}
                placeholder="winter-jacket"
                required
                className="w-full rounded-base border-0 bg-transparent px-2 py-2 text-sm text-grey-90 placeholder:text-grey-40 focus:outline-none"
              />
            </div>
          </FormField>
          <FormField label="Description" htmlFor="gen-description">
            <Textarea
              id="gen-description"
              value={genForm.description}
              onChange={(e) => setGenForm((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="A warm and cozy jacket"
            />
          </FormField>
          <div className="rounded-base border border-grey-20 p-4">
            <FormToggle
              checked={genForm.discountable}
              onChange={(value) => setGenForm((p) => ({ ...p, discountable: value }))}
              label="Discountable"
              description="When unchecked, discounts will not be applied to this product."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setGeneralOpen(false)}
              disabled={busy === "save-general"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                busy === "save-general" || !genForm.title.trim() || !genForm.handle.trim()
              }
              className={primaryButton}
            >
              {busy === "save-general" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit media modal */}
      <Modal
        open={mediaOpen}
        onClose={closeMediaEdit}
        title="Edit media"
        description="Add media to the product to showcase it in your storefront."
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-grey-70">Current media</p>
            {mediaItems.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                {mediaItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square overflow-hidden rounded-base border border-grey-20 bg-grey-10"
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                    {item.isThumbnail && (
                      <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-grey-70 shadow-sm">
                        Thumbnail
                      </span>
                    )}
                    {!item.synthetic && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {!item.isThumbnail && (
                          <button
                            type="button"
                            onClick={() => handleMakeThumbnail(item.url)}
                            disabled={busy !== null}
                            className="rounded-base bg-white/95 px-2 py-1 text-[11px] font-medium text-grey-90 shadow-sm hover:bg-white disabled:opacity-50"
                          >
                            {busy === `thumb-${item.url}` ? "Saving..." : "Make thumbnail"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(item)}
                          disabled={busy !== null}
                          className="rounded-base bg-white/95 px-2 py-1 text-[11px] font-medium text-red-600 shadow-sm hover:bg-white disabled:opacity-50"
                        >
                          {busy === `del-img-${item.id}` ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-grey-50">No media yet.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-grey-70">Add media</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
              {queued.map((q) => (
                <div
                  key={q.id}
                  className="group relative aspect-square overflow-hidden rounded-base border border-grey-20 bg-grey-10"
                >
                  <img src={q.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeQueued(q.id)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-grey-70 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <XMark className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-base border border-dashed border-grey-30 bg-grey-5 hover:bg-grey-10">
                <Photo className="h-6 w-6 text-grey-40" />
                <span className="text-xs font-medium text-grey-70">Upload images</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  onChange={handleMediaSelect}
                  className="hidden"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-grey-50">
              Drag and drop images here or click to upload. PNG, JPG, WebP or GIF.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeMediaEdit}
              disabled={busy === "save-media"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveMedia}
              disabled={busy === "save-media" || queued.length === 0}
              className={primaryButton}
            >
              {busy === "save-media" ? "Uploading..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage product options modal */}
      <Modal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title="Manage Product Options"
        description="Associate or disassociate product options from this product."
        size="md"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-2 rounded-base border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ExclamationCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Editing options impacts this product&apos;s variants. Removing values that
              variants use may change or invalidate those variants, and an option cannot be
              deleted while variants still use its values.
            </p>
          </div>

          {(product.options || []).length > 0 ? (
            <div className="space-y-3">
              {(product.options || []).map((opt) => {
                const form = optionForms[opt.id] ?? {
                  title: opt.title,
                  values: (opt.values || []).map((v) => v.value).join(", "),
                }
                return (
                  <div key={opt.id} className="space-y-3 rounded-base border border-grey-20 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Option title" htmlFor={`opt-title-${opt.id}`}>
                        <Input
                          id={`opt-title-${opt.id}`}
                          value={form.title}
                          onChange={(e) =>
                            setOptionForms((prev) => ({
                              ...prev,
                              [opt.id]: { ...form, title: e.target.value },
                            }))
                          }
                          placeholder="Color"
                        />
                      </FormField>
                      <FormField
                        label="Variations (comma-separated)"
                        htmlFor={`opt-values-${opt.id}`}
                      >
                        <Input
                          id={`opt-values-${opt.id}`}
                          value={form.values}
                          onChange={(e) =>
                            setOptionForms((prev) => ({
                              ...prev,
                              [opt.id]: { ...form, values: e.target.value },
                            }))
                          }
                          placeholder="Red, Blue, Green"
                        />
                      </FormField>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteOption(opt)}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash className="h-4 w-4" />
                        {busy === `del-option-${opt.id}` ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveOption(opt.id)}
                        disabled={busy !== null}
                        className={secondaryButton}
                      >
                        {busy === `save-option-${opt.id}` ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-grey-50">No options defined yet.</p>
          )}

          <div className="space-y-3 rounded-base border border-dashed border-grey-30 p-4">
            <p className="text-sm font-medium text-grey-90">Add option</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Option title" htmlFor="new-opt-title">
                <Input
                  id="new-opt-title"
                  value={newOption.title}
                  onChange={(e) => setNewOption((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Color"
                />
              </FormField>
              <FormField label="Variations (comma-separated)" htmlFor="new-opt-values">
                <Input
                  id="new-opt-values"
                  value={newOption.values}
                  onChange={(e) => setNewOption((p) => ({ ...p, values: e.target.value }))}
                  placeholder="Red, Blue, Green"
                />
              </FormField>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addOption}
                disabled={
                  busy !== null ||
                  !newOption.title.trim() ||
                  parseOptionValues(newOption.values).length === 0
                }
                className={secondaryButton}
              >
                <Plus className="h-4 w-4" />
                {busy === "add-option" ? "Adding..." : "Add option"}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setOptionsOpen(false)}
              className={cancelButton}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Create variant modal */}
      <Modal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        title="Create Variant"
        description="Create a new variant for this product."
        size="md"
      >
        <form onSubmit={saveVariant} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Title"
              htmlFor="var-title"
              hint={
                (product.options || []).length > 0
                  ? "Leave empty to generate from the selected option values."
                  : undefined
              }
            >
              <Input
                id="var-title"
                value={variantForm.title}
                onChange={(e) => setVariantForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Small / Red"
              />
            </FormField>
            <FormField label="SKU" htmlFor="var-sku">
              <Input
                id="var-sku"
                value={variantForm.sku}
                onChange={(e) => setVariantForm((p) => ({ ...p, sku: e.target.value }))}
                placeholder="SKU"
              />
            </FormField>
          </div>

          {(product.options || []).length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-grey-70">Options</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(product.options || []).map((opt) => (
                  <FormField key={opt.id} label={opt.title} htmlFor={`var-opt-${opt.id}`}>
                    <Select
                      id={`var-opt-${opt.id}`}
                      value={variantForm.options[opt.title] ?? ""}
                      onChange={(e) =>
                        setVariantForm((p) => ({
                          ...p,
                          options: { ...p.options, [opt.title]: e.target.value },
                        }))
                      }
                      required
                    >
                      <option value="">Select a value</option>
                      {(opt.values || []).map((v) => (
                        <option key={v.id} value={v.value}>
                          {v.value}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-grey-70">Prices</p>
            <div className="space-y-1.5">
              {currencies.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs uppercase text-grey-50">{code}</span>
                  <Input
                    id={`var-price-${code}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={variantForm.prices[code] ?? ""}
                    onChange={(e) =>
                      setVariantForm((p) => ({
                        ...p,
                        prices: { ...p.prices, [code]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-base border border-grey-20 p-4">
            <FormToggle
              checked={variantForm.manage_inventory}
              onChange={(value) =>
                setVariantForm((p) => ({ ...p, manage_inventory: value }))
              }
              label="Manage inventory"
              description="When enabled, we'll change the inventory quantity for you when orders and returns are created."
            />
            <FormToggle
              checked={variantForm.allow_backorder}
              onChange={(value) => setVariantForm((p) => ({ ...p, allow_backorder: value }))}
              label="Allow backorders"
              description="When enabled, customers can purchase the variant even if there's no available quantity."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setVariantOpen(false)}
              disabled={busy === "create-variant"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "create-variant" || !variantCanSave}
              className={primaryButton}
            >
              {busy === "create-variant" ? "Creating..." : "Create variant"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit organization drawer */}
      <Modal
        open={organizeOpen}
        onClose={() => setOrganizeOpen(false)}
        title="Edit Organization"
        description="Edit the type, collection, categories and tags of the product."
        size="sm"
      >
        <form onSubmit={saveOrganize} className="space-y-4">
          <FormField label="Type" htmlFor="org-type">
            <Select
              id="org-type"
              value={orgForm.type_id}
              onChange={(e) => setOrgForm((p) => ({ ...p, type_id: e.target.value }))}
            >
              <option value="">No type</option>
              {productTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.value}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Collection" htmlFor="org-collection">
            <Select
              id="org-collection"
              value={orgForm.collection_id}
              onChange={(e) => setOrgForm((p) => ({ ...p, collection_id: e.target.value }))}
            >
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Categories" htmlFor="org-categories">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {orgForm.category_ids.map((catId) => {
                  const cat = categories.find((c) => c.id === catId)
                  return (
                    <span
                      key={catId}
                      className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                    >
                      {cat?.name ?? catId}
                      <button
                        type="button"
                        onClick={() =>
                          setOrgForm((p) => ({
                            ...p,
                            category_ids: p.category_ids.filter((c) => c !== catId),
                          }))
                        }
                        className="rounded p-0.5 hover:bg-grey-20"
                        aria-label="Remove category"
                      >
                        <XMark className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
              <Select
                id="org-categories"
                value=""
                onChange={(e) => {
                  const catId = e.target.value
                  if (!catId) return
                  setOrgForm((p) =>
                    p.category_ids.includes(catId)
                      ? p
                      : { ...p, category_ids: [...p.category_ids, catId] }
                  )
                  e.target.value = ""
                }}
                disabled={categories.length === 0}
              >
                <option value="">
                  {categories.length === 0 ? "No categories" : "Add a category"}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </FormField>
          <FormField label="Tags" htmlFor="org-tags">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {orgForm.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setOrgForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }))
                      }
                      className="rounded p-0.5 hover:bg-grey-20"
                      aria-label="Remove tag"
                    >
                      <XMark className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {allTags.length > 0 && (
                <Select
                  id="org-tags-existing"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    addOrgTag(e.target.value)
                    e.target.value = ""
                  }}
                >
                  <option value="">Add an existing tag</option>
                  {allTags
                    .filter(
                      (t) =>
                        !orgForm.tags.some(
                          (v) => v.toLowerCase() === t.value.toLowerCase()
                        )
                    )
                    .map((t) => (
                      <option key={t.id} value={t.value}>
                        {t.value}
                      </option>
                    ))}
                </Select>
              )}
              <div className="flex gap-2">
                <Input
                  id="org-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addOrgTag(tagInput)
                    }
                  }}
                  placeholder="Type a tag and press Enter"
                />
                <button
                  type="button"
                  onClick={() => addOrgTag(tagInput)}
                  disabled={!tagInput.trim()}
                  className={secondaryButton}
                  aria-label="Add tag"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOrganizeOpen(false)}
              disabled={busy === "save-organize"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy === "save-organize"} className={primaryButton}>
              {busy === "save-organize" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Which variants show this image */}
      <Modal
        open={!!imgVariantsFor}
        onClose={() => setImgVariantsFor(null)}
        title="Image variants"
        description="Choose which variants show this image. An image with no variants selected is shown for all of them."
        size="sm"
      >
        {imgVariantsFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void saveImageVariants()
            }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <img
                src={imgVariantsFor.url}
                alt=""
                className="h-16 w-16 rounded-base border border-grey-20 object-cover"
              />
              <p className="text-sm text-grey-50">
                Shoppers who pick one of the selected variants will see this image.
              </p>
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-base border border-grey-20 p-2">
              {(product.variants || []).map((v) => {
                const on = imgVariantIds.has(v.id)
                return (
                  <label
                    key={v.id}
                    className="flex cursor-pointer items-center gap-2 rounded-base px-2 py-1.5 text-sm hover:bg-grey-10"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setImgVariantIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(v.id)) {
                            next.delete(v.id)
                          } else {
                            next.add(v.id)
                          }
                          return next
                        })
                      }
                    />
                    <span>{v.title}</span>
                    {v.sku && <span className="text-grey-40">· {v.sku}</span>}
                  </label>
                )
              })}
            </div>

            {imgVariantIds.size === 0 && (
              <p className="text-xs text-grey-50">
                No variants selected — this image is shown for every variant.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setImgVariantsFor(null)}
                disabled={busy === "save-image-variants"}
                className={cancelButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy === "save-image-variants"}
                className={primaryButton}
              >
                {busy === "save-image-variants" ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit attributes drawer */}
      <Modal
        open={attrsOpen}
        onClose={() => setAttrsOpen(false)}
        title="Edit Attributes"
        description="Edit the physical and customs attributes of the product."
        size="sm"
      >
        <form onSubmit={saveAttributes} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Width" htmlFor="attr-width">
              <Input
                id="attr-width"
                type="number"
                min="0"
                step="any"
                value={attrForm.width}
                onChange={(e) => setAttrForm((p) => ({ ...p, width: e.target.value }))}
                placeholder="100"
              />
            </FormField>
            <FormField label="Height" htmlFor="attr-height">
              <Input
                id="attr-height"
                type="number"
                min="0"
                step="any"
                value={attrForm.height}
                onChange={(e) => setAttrForm((p) => ({ ...p, height: e.target.value }))}
                placeholder="100"
              />
            </FormField>
            <FormField label="Length" htmlFor="attr-length">
              <Input
                id="attr-length"
                type="number"
                min="0"
                step="any"
                value={attrForm.length}
                onChange={(e) => setAttrForm((p) => ({ ...p, length: e.target.value }))}
                placeholder="100"
              />
            </FormField>
            <FormField label="Weight" htmlFor="attr-weight">
              <Input
                id="attr-weight"
                type="number"
                min="0"
                step="any"
                value={attrForm.weight}
                onChange={(e) => setAttrForm((p) => ({ ...p, weight: e.target.value }))}
                placeholder="100"
              />
            </FormField>
          </div>
          <FormField label="Mid code" htmlFor="attr-mid">
            <Input
              id="attr-mid"
              value={attrForm.mid_code}
              onChange={(e) => setAttrForm((p) => ({ ...p, mid_code: e.target.value }))}
            />
          </FormField>
          <FormField label="HS code" htmlFor="attr-hs">
            <Input
              id="attr-hs"
              value={attrForm.hs_code}
              onChange={(e) => setAttrForm((p) => ({ ...p, hs_code: e.target.value }))}
            />
          </FormField>
          <FormField label="Country of origin" htmlFor="attr-origin">
            <Select
              id="attr-origin"
              value={attrForm.origin_country}
              onChange={(e) => setAttrForm((p) => ({ ...p, origin_country: e.target.value }))}
            >
              <option value="">No country</option>
              {COUNTRY_CODES.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Material" htmlFor="attr-material">
            <Input
              id="attr-material"
              value={attrForm.material}
              onChange={(e) => setAttrForm((p) => ({ ...p, material: e.target.value }))}
              placeholder="100% Cotton"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAttrsOpen(false)}
              disabled={busy === "save-attributes"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-attributes"}
              className={primaryButton}
            >
              {busy === "save-attributes" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Shipping configuration drawer */}
      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title="Shipping Configuration"
        description="Connect the product to a shipping profile."
        size="sm"
      >
        <form onSubmit={saveShipping} className="space-y-4">
          <FormField label="Shipping profile" htmlFor="ship-profile">
            <Select
              id="ship-profile"
              value={shipSel}
              onChange={(e) => setShipSel(e.target.value)}
            >
              <option value="">No shipping profile</option>
              {shipProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShipOpen(false)}
              disabled={busy === "save-shipping"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy === "save-shipping"} className={primaryButton}>
              {busy === "save-shipping" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit metadata drawer */}
      <Modal
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        title="Edit Metadata"
        description="Edit the metadata for this object."
        size="md"
      >
        <form onSubmit={saveMetadata} className="space-y-4">
          <div className="overflow-hidden rounded-base border border-grey-20">
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-grey-10 bg-grey-10 px-3 py-2 text-xs font-medium text-grey-70">
              <span>Key</span>
              <span>Value</span>
              <span className="w-8" />
            </div>
            <div className="divide-y divide-grey-10">
              {metaRows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2"
                  title={
                    row.locked
                      ? "This row is disabled because it contains non-primitive data."
                      : undefined
                  }
                >
                  <Input
                    value={row.key}
                    onChange={(e) =>
                      setMetaRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r))
                      )
                    }
                    placeholder="Key"
                    disabled={row.locked}
                    aria-label="Metadata key"
                  />
                  <Input
                    value={row.value}
                    onChange={(e) =>
                      setMetaRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id ? { ...r, value: e.target.value } : r
                        )
                      )
                    }
                    placeholder="Value"
                    disabled={row.locked}
                    aria-label="Metadata value"
                  />
                  <ActionMenu
                    items={[
                      {
                        label: "Insert row above",
                        icon: Plus,
                        onClick: () => insertMetaRow(index),
                      },
                      {
                        label: "Insert row below",
                        icon: Plus,
                        onClick: () => insertMetaRow(index + 1),
                      },
                      {
                        label: "Delete row",
                        icon: Trash,
                        destructive: true,
                        onClick: () => deleteMetaRow(row.id),
                      },
                    ]}
                  />
                </div>
              ))}
            </div>
          </div>
          {metaRows.some((r) => r.locked) && (
            <p className="text-xs text-grey-50">
              Rows containing non-primitive data are disabled and will be preserved as-is.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMetaOpen(false)}
              disabled={busy === "save-metadata"}
              className={cancelButton}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy === "save-metadata"} className={primaryButton}>
              {busy === "save-metadata" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
