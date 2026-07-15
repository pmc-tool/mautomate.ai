"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  Buildings,
  Check,
  CurrencyDollar,
  DocumentText,
  ExclamationCircle,
  PencilSquare,
  Plus,
  Trash,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { TwoColumnLayout } from "@components/merchant-admin/two-column-layout"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getProductFull,
  updateVariant,
  deleteVariant,
  getProductStock,
  listStoreCurrencies,
  ProductFullDetail,
  ProductFullVariant,
  ProductStockVariant,
  VariantUpsertPayload,
  ApiError,
} from "../../../../../../lib/merchant-admin/api"
import { formatMoney } from "@lib/merchant-admin/utils"
import { cn } from "@lib/util/cn"

// A broad ISO-3166-1 alpha-2 list; names rendered via Intl.DisplayNames.
const COUNTRY_CODES =
  "us ca gb au nz ie de fr es it nl be pt ch at se no dk fi pl cz sk hu ro bg gr hr si ee lv lt lu is mt cy in bd pk lk np sg my th vn ph id jp kr cn hk tw ae sa qa kw bh om il tr eg za ng ke gh ma dz tn br mx ar cl co pe uy ec ve bo py cr pa gt do jm tt ru ua by kz ge am az".split(
    " "
  )

function countryName(code?: string | null): string {
  if (!code) return "—"
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function optionalString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function optionalFloat(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = parseFloat(trimmed)
  return Number.isFinite(n) ? n : null
}

const secondaryButton =
  "inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
const primaryButton =
  "inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"

type EditForm = {
  title: string
  material: string
  options: Record<string, string>
  sku: string
  ean: string
  upc: string
  barcode: string
  manage_inventory: boolean
  allow_backorder: boolean
  weight: string
  width: string
  length: string
  height: string
  mid_code: string
  hs_code: string
  origin_country: string
}

const EMPTY_EDIT_FORM: EditForm = {
  title: "",
  material: "",
  options: {},
  sku: "",
  ean: "",
  upc: "",
  barcode: "",
  manage_inventory: true,
  allow_backorder: false,
  weight: "",
  width: "",
  length: "",
  height: "",
  mid_code: "",
  hs_code: "",
  origin_country: "",
}

type MetaRow = {
  rowId: number
  key: string
  value: string
  editable: boolean
  original?: any
}

const PRICES_PAGE_SIZE = 3

export default function ProductVariantDetailPage() {
  const params = useParams<{ id: string; variantId: string }>()
  const productId = params.id
  const variantId = params.variantId
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [product, setProduct] = useState<ProductFullDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  // Inventory (per-location stock for this variant)
  const [stockRow, setStockRow] = useState<ProductStockVariant | null>(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)

  // Store currencies drive the price editor rows.
  const [storeCurrencies, setStoreCurrencies] = useState<string[]>([])

  // Modals
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM)
  const [pricesOpen, setPricesOpen] = useState(false)
  const [priceForm, setPriceForm] = useState<Record<string, string>>({})
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [metaRows, setMetaRows] = useState<MetaRow[]>([])
  const metaIdRef = useRef(0)

  // Prices card paging ("Show more" reveals 3 at a time)
  const [visiblePrices, setVisiblePrices] = useState(PRICES_PAGE_SIZE)

  const variant: ProductFullVariant | null = useMemo(
    () => product?.variants?.find((v) => v.id === variantId) ?? null,
    [product, variantId]
  )

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load() {
    if (!token || !productId) return
    setError(null)
    try {
      const res = await getProductFull(token, productId)
      setProduct(res.product)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load variant")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, productId])

  useEffect(() => {
    if (!token) return
    listStoreCurrencies(token)
      .then((res) => setStoreCurrencies(res.currencies || []))
      .catch(() => {
        // Non-fatal: the price editor falls back to the currencies the
        // variant already has prices in.
      })
  }, [token])

  // Load per-location stock once the variant is known to manage inventory.
  useEffect(() => {
    if (!token || !product) return
    const v = product.variants?.find((x) => x.id === variantId)
    if (!v || !v.manage_inventory) {
      setStockRow(null)
      setStockLoading(false)
      setStockError(null)
      return
    }
    let cancelled = false
    setStockLoading(true)
    setStockError(null)
    getProductStock(token, productId)
      .then((res) => {
        if (cancelled) return
        setStockRow(res.variants?.find((s) => s.variant_id === variantId) ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) logout()
        setStockError(err instanceof Error ? err.message : "Failed to load inventory")
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, product, productId, variantId])

  useEffect(() => {
    setVisiblePrices(PRICES_PAGE_SIZE)
  }, [variantId])

  async function run(key: string, fn: () => Promise<any>, okMsg: string) {
    if (!token) return false
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await load()
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  /** Set (or clear) this variant's thumbnail — always an image already in the
   *  product's gallery, so there is nothing extra to upload or keep in sync. */
  async function setVariantThumbnail(url: string | null) {
    await run(
      "thumbnail",
      () => updateVariant(token!, productId, variantId, { thumbnail: url }),
      url ? "Variant thumbnail updated." : "Variant thumbnail cleared."
    )
  }

  // ---- edit variant (drawer) ----
  function openEdit() {
    if (!variant || !product) return
    const options: Record<string, string> = {}
    for (const opt of product.options || []) {
      const match = variant.options?.find((vo) => vo.option?.id === opt.id)
      options[opt.title] = match?.value ?? ""
    }
    setEditForm({
      title: variant.title ?? "",
      material: variant.material ?? "",
      options,
      sku: variant.sku ?? "",
      ean: variant.ean ?? "",
      upc: variant.upc ?? "",
      barcode: variant.barcode ?? "",
      manage_inventory: variant.manage_inventory ?? true,
      allow_backorder: variant.allow_backorder ?? false,
      weight: variant.weight != null ? String(variant.weight) : "",
      width: variant.width != null ? String(variant.width) : "",
      length: variant.length != null ? String(variant.length) : "",
      height: variant.height != null ? String(variant.height) : "",
      mid_code: variant.mid_code ?? "",
      hs_code: variant.hs_code ?? "",
      origin_country: variant.origin_country ?? "",
    })
    setEditOpen(true)
  }

  const missingOption = (product?.options || []).some(
    (opt) => !(editForm.options[opt.title] || "").trim()
  )

  async function saveVariant(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !variant || !editForm.title.trim() || missingOption) return
    const payload: VariantUpsertPayload = {
      title: editForm.title.trim(),
      material: optionalString(editForm.material),
      sku: optionalString(editForm.sku),
      ean: optionalString(editForm.ean),
      upc: optionalString(editForm.upc),
      barcode: optionalString(editForm.barcode),
      manage_inventory: editForm.manage_inventory,
      allow_backorder: editForm.manage_inventory ? editForm.allow_backorder : false,
      weight: optionalFloat(editForm.weight),
      width: optionalFloat(editForm.width),
      length: optionalFloat(editForm.length),
      height: optionalFloat(editForm.height),
      mid_code: optionalString(editForm.mid_code),
      hs_code: optionalString(editForm.hs_code),
      origin_country: editForm.origin_country || null,
    }
    const optionEntries = (product?.options || [])
      .map((opt) => [opt.title, (editForm.options[opt.title] || "").trim()] as const)
      .filter(([, value]) => value)
    if (optionEntries.length) {
      payload.options = Object.fromEntries(optionEntries)
    }
    const ok = await run(
      "save-variant",
      () => updateVariant(token, productId, variantId, payload),
      "Product variant edited successfully"
    )
    if (ok) setEditOpen(false)
  }

  // ---- delete variant ----
  async function handleDelete() {
    if (!token || !variant) return
    if (!confirm("Are you sure you want to delete this variant?")) return
    setBusy("delete-variant")
    try {
      await deleteVariant(token, productId, variantId)
      router.push(`/dashboard/products/${productId}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      showMessage("error", err instanceof Error ? err.message : "Failed to delete variant")
      setBusy(null)
    }
  }

  // ---- prices ----
  const priceCurrencyList = useMemo(() => {
    const codes = new Set<string>()
    for (const code of storeCurrencies) codes.add(code.toLowerCase())
    for (const p of variant?.prices || []) codes.add(p.currency_code.toLowerCase())
    if (codes.size === 0) codes.add("usd")
    return Array.from(codes).sort()
  }, [storeCurrencies, variant])

  function openPrices() {
    if (!variant) return
    const seed: Record<string, string> = {}
    for (const p of variant.prices || []) {
      seed[p.currency_code.toLowerCase()] = String(p.amount)
    }
    setPriceForm(seed)
    setPricesOpen(true)
  }

  const priceFormInvalid = priceCurrencyList.some((code) => {
    const raw = (priceForm[code] || "").trim()
    if (!raw) return false
    const n = parseFloat(raw)
    return !Number.isFinite(n) || n < 0
  })

  async function savePrices(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !variant || priceFormInvalid) return
    const prices: { currency_code: string; amount: number }[] = []
    for (const code of priceCurrencyList) {
      const raw = (priceForm[code] || "").trim()
      if (!raw) continue
      prices.push({ currency_code: code, amount: parseFloat(raw) })
    }
    const ok = await run(
      "save-prices",
      () => updateVariant(token, productId, variantId, { prices }),
      "Prices were successfully updated."
    )
    if (ok) setPricesOpen(false)
  }

  // ---- metadata ----
  function nextMetaId() {
    metaIdRef.current += 1
    return metaIdRef.current
  }

  function openMetadata() {
    if (!variant) return
    const rows: MetaRow[] = Object.entries(variant.metadata || {}).map(([key, value]) => {
      const primitive =
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      return primitive
        ? { rowId: nextMetaId(), key, value: value === null ? "" : String(value), editable: true }
        : {
            rowId: nextMetaId(),
            key,
            value: JSON.stringify(value),
            editable: false,
            original: value,
          }
    })
    if (rows.length === 0) {
      rows.push({ rowId: nextMetaId(), key: "", value: "", editable: true })
    }
    setMetaRows(rows)
    setMetadataOpen(true)
  }

  function insertMetaRow(index: number) {
    setMetaRows((rows) => {
      const next = [...rows]
      next.splice(index, 0, { rowId: nextMetaId(), key: "", value: "", editable: true })
      return next
    })
  }

  function deleteMetaRow(rowId: number) {
    setMetaRows((rows) => {
      const next = rows.filter((r) => r.rowId !== rowId)
      return next.length > 0 ? next : [{ rowId: nextMetaId(), key: "", value: "", editable: true }]
    })
  }

  function updateMetaRow(rowId: number, patch: Partial<Pick<MetaRow, "key" | "value">>) {
    setMetaRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)))
  }

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !variant) return
    const metadata: Record<string, any> = {}
    for (const row of metaRows) {
      if (!row.editable) {
        metadata[row.key] = row.original
        continue
      }
      const key = row.key.trim()
      if (!key) continue
      metadata[key] = row.value
    }
    const ok = await run(
      "save-metadata",
      () =>
        updateVariant(token, productId, variantId, {
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        }),
      "Metadata was successfully updated."
    )
    if (ok) setMetadataOpen(false)
  }

  // ---- render ----
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Variant" description="Loading..." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-48 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-40 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="h-48 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Variant" description="We could not load this variant." />
        <EmptyState
          icon={ExclamationCircle}
          title="Variant could not be loaded"
          description={error || "This product does not exist or you do not have access to it."}
          action={
            <Link href="/dashboard/products" className={secondaryButton}>
              Back to products
            </Link>
          }
        />
      </div>
    )
  }

  if (!variant) {
    return (
      <div className="space-y-6">
        <Link
          href={`/dashboard/products/${productId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          {product.title}
        </Link>
        <EmptyState
          icon={DocumentText}
          title="Variant not found"
          description="This variant does not exist on the product or has been removed."
          action={
            <Link href={`/dashboard/products/${productId}`} className={secondaryButton}>
              Back to product
            </Link>
          }
        />
      </div>
    )
  }

  const sortedPrices = [...(variant.prices || [])].sort((a, b) =>
    a.currency_code.localeCompare(b.currency_code)
  )
  const shownPrices = sortedPrices.slice(0, visiblePrices)
  const stockLocations = stockRow?.locations || []
  const totalStocked = stockLocations.reduce((sum, l) => sum + (l.stocked_quantity || 0), 0)
  const totalReserved = stockLocations.reduce((sum, l) => sum + (l.reserved_quantity || 0), 0)
  const metaEntries = Object.entries(variant.metadata || {})

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/products/${productId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        {product.title}
      </Link>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <ExclamationCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <TwoColumnLayout
        sidebar={
          <SectionCard
            title="Prices"
            action={
              <ActionMenu
                items={[{ label: "Edit", icon: CurrencyDollar, onClick: openPrices }]}
              />
            }
          >
            {sortedPrices.length === 0 ? (
              <div className="rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-center text-grey-50">
                <CurrencyDollar className="mx-auto mb-2 h-6 w-6 text-grey-40" />
                <p className="text-sm font-medium text-grey-80">No records</p>
                <p className="mt-0.5 text-sm">No prices have been added to this variant yet.</p>
              </div>
            ) : (
              <>
                <dl className="divide-y divide-grey-10">
                  {shownPrices.map((price) => (
                    <div
                      key={price.id || price.currency_code}
                      className="flex items-center justify-between gap-4 py-2 text-sm"
                    >
                      <dt className="uppercase text-grey-50">{price.currency_code}</dt>
                      <dd className="font-medium text-grey-90">
                        {formatMoney(Number(price.amount) || 0, price.currency_code)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-grey-10 pt-3">
                  <p className="text-xs text-grey-50">
                    1 - {shownPrices.length} of {sortedPrices.length} prices
                  </p>
                  <button
                    type="button"
                    onClick={() => setVisiblePrices((n) => n + PRICES_PAGE_SIZE)}
                    disabled={visiblePrices >= sortedPrices.length}
                    className="text-xs font-medium text-grey-60 hover:text-grey-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Show more
                  </button>
                </div>
              </>
            )}
          </SectionCard>
        }
      >
        {/* General */}
        <SectionCard
          title={variant.title}
          description="Product variant"
          action={
            <ActionMenu
              items={[
                { label: "Edit", icon: PencilSquare, onClick: openEdit },
                { label: "Delete", icon: Trash, destructive: true, onClick: handleDelete },
              ]}
            />
          }
        >
          <dl className="divide-y divide-grey-10">
            <div className="flex items-center justify-between gap-4 py-3 text-sm">
              <dt className="text-grey-50">SKU</dt>
              <dd className="font-medium text-grey-90">
                {variant.sku || <span className="text-grey-40">—</span>}
              </dd>
            </div>
            {(product.options || []).map((opt) => {
              const value = variant.options?.find((vo) => vo.option?.id === opt.id)?.value
              return (
                <div key={opt.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-grey-50">{opt.title}</dt>
                  <dd>
                    {value ? (
                      <span className="rounded-base bg-grey-10 px-2 py-1 text-xs font-medium text-grey-70">
                        {value}
                      </span>
                    ) : (
                      <span className="text-grey-40">—</span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </SectionCard>

        {/* Thumbnail — chosen from the product's gallery */}
        <SectionCard
          title="Thumbnail"
          description="The image shown for this variant in listings and the cart."
        >
          {(product.images || []).length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3">
                {(product.images || []).map((img) => {
                  const active = variant.thumbnail === img.url
                  return (
                    <button
                      key={img.id}
                      type="button"
                      disabled={busy === "thumbnail"}
                      onClick={() => setVariantThumbnail(active ? null : img.url)}
                      title={active ? "Click to clear" : "Use as this variant's thumbnail"}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-base border bg-grey-10 transition",
                        active
                          ? "border-2 border-ui-fg-interactive ring-2 ring-ui-fg-interactive/20"
                          : "border-grey-20 hover:border-grey-40"
                      )}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      {active && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-[10px] font-medium text-white">
                          Selected
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-grey-50">
                No thumbnail selected means this variant falls back to the product's
                own thumbnail.
              </p>
            </div>
          ) : (
            <p className="text-sm text-grey-50">
              This product has no images yet. Add media on the product page first.
            </p>
          )}
        </SectionCard>

        {/* Inventory */}
        {variant.manage_inventory ? (
          <SectionCard
            title="Inventory"
            description="Stock levels for this variant per location."
            action={
              <Link
                href={`/dashboard/products/${productId}/stock`}
                className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                <Buildings className="h-4 w-4" />
                Manage stock
              </Link>
            }
          >
            {stockLoading ? (
              <div className="space-y-2">
                <div className="h-9 animate-pulse rounded-base bg-grey-10" />
                <div className="h-9 animate-pulse rounded-base bg-grey-10" />
              </div>
            ) : stockError ? (
              <div className="flex items-center gap-2 rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <ExclamationCircle className="h-4 w-4" />
                {stockError}
              </div>
            ) : stockLocations.length === 0 ? (
              <div className="rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-center text-grey-50">
                <Buildings className="mx-auto mb-2 h-6 w-6 text-grey-40" />
                <p className="text-sm font-medium text-grey-80">No stock recorded</p>
                <p className="mt-0.5 text-sm">
                  This variant is not stocked at any location yet.
                </p>
                <Link
                  href={`/dashboard/products/${productId}/stock`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-3 py-1.5 text-sm font-medium text-white hover:bg-grey-80"
                >
                  Manage stock
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-large border border-grey-20">
                <table className="w-full text-left text-sm">
                  <thead className="bg-grey-10 text-grey-70">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Location</th>
                      <th className="px-4 py-2.5 text-right font-medium">Stocked</th>
                      <th className="px-4 py-2.5 text-right font-medium">Reserved</th>
                      <th className="px-4 py-2.5 text-right font-medium">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {stockLocations.map((level) => (
                      <tr key={level.location_id}>
                        <td className="px-4 py-3 text-grey-90">{level.location_name}</td>
                        <td className="px-4 py-3 text-right text-grey-90">
                          {level.stocked_quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-grey-90">
                          {level.reserved_quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-grey-90">
                          {level.stocked_quantity - level.reserved_quantity}
                        </td>
                      </tr>
                    ))}
                    {stockLocations.length > 1 && (
                      <tr className="bg-grey-5">
                        <td className="px-4 py-3 font-medium text-grey-90">Total</td>
                        <td className="px-4 py-3 text-right font-medium text-grey-90">
                          {totalStocked}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-grey-90">
                          {totalReserved}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-grey-90">
                          {totalStocked - totalReserved}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Inventory" description="Track this variant's stock across locations.">
            <div className="rounded-large border border-dashed border-grey-30 bg-grey-5 py-8 text-center text-grey-50">
              <Buildings className="mx-auto mb-2 h-6 w-6 text-grey-40" />
              <p className="text-sm font-medium text-grey-80">Inventory not managed</p>
              <p className="mx-auto mt-0.5 max-w-sm text-sm">
                {
                  "Inventory is not managed for this variant. Turn on Manage Inventory to track the variant's inventory."
                }
              </p>
              <button
                type="button"
                onClick={openEdit}
                className="mt-3 inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                Edit Variant
              </button>
            </div>
          </SectionCard>
        )}

        {/* Metadata */}
        <SectionCard
          title="Metadata"
          description={`${metaEntries.length} key${metaEntries.length === 1 ? "" : "s"}`}
          action={
            <button
              type="button"
              onClick={openMetadata}
              className="text-sm font-medium text-grey-60 hover:text-grey-90"
            >
              Edit
            </button>
          }
        >
          {metaEntries.length > 0 ? (
            <dl className="divide-y divide-grey-10">
              {metaEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 py-2 text-sm">
                  <dt className="text-grey-50">{key}</dt>
                  <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                    {typeof value === "object" && value !== null
                      ? JSON.stringify(value)
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-grey-50">No metadata has been added to this variant.</p>
          )}
        </SectionCard>

        {/* JSON */}
        <SectionCard
          title="JSON"
          description={`${Object.keys(variant).length} keys`}
          action={
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="text-sm font-medium text-grey-60 hover:text-grey-90"
            >
              {showJson ? "Hide" : "Show"}
            </button>
          }
        >
          {showJson ? (
            <pre className="max-h-96 overflow-auto rounded-base bg-grey-10 p-4 text-xs text-grey-70">
              {JSON.stringify(variant, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-grey-50">
              The raw variant object as returned by the API.
            </p>
          )}
        </SectionCard>
      </TwoColumnLayout>

      {/* Edit Variant drawer */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Variant" size="md">
        <form onSubmit={saveVariant} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Title" htmlFor="variant-title">
              <Input
                id="variant-title"
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Material" htmlFor="variant-material">
              <Input
                id="variant-material"
                value={editForm.material}
                onChange={(e) => setEditForm((p) => ({ ...p, material: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
          </div>

          {(product.options || []).length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(product.options || []).map((opt) => (
                <FormField key={opt.id} label={opt.title} htmlFor={`variant-opt-${opt.id}`}>
                  <Select
                    id={`variant-opt-${opt.id}`}
                    value={editForm.options[opt.title] ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        options: { ...p.options, [opt.title]: e.target.value },
                      }))
                    }
                  >
                    <option value="">Select {opt.title.toLowerCase()}</option>
                    {opt.values.map((val) => (
                      <option key={val.id} value={val.value}>
                        {val.value}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ))}
            </div>
          )}

          <div className="border-t border-grey-10 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-grey-90">Stock &amp; Inventory</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="SKU" htmlFor="variant-sku">
                <Input
                  id="variant-sku"
                  value={editForm.sku}
                  onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="EAN" htmlFor="variant-ean">
                <Input
                  id="variant-ean"
                  value={editForm.ean}
                  onChange={(e) => setEditForm((p) => ({ ...p, ean: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="UPC" htmlFor="variant-upc">
                <Input
                  id="variant-upc"
                  value={editForm.upc}
                  onChange={(e) => setEditForm((p) => ({ ...p, upc: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Barcode" htmlFor="variant-barcode">
                <Input
                  id="variant-barcode"
                  value={editForm.barcode}
                  onChange={(e) => setEditForm((p) => ({ ...p, barcode: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-base border border-grey-20 p-4">
                <FormToggle
                  checked={editForm.manage_inventory}
                  onChange={(v) =>
                    setEditForm((p) => ({
                      ...p,
                      manage_inventory: v,
                      allow_backorder: v ? p.allow_backorder : false,
                    }))
                  }
                  label="Manage inventory"
                  description="When enabled, we'll change the inventory quantity for you when orders and returns are created."
                />
              </div>
              <div
                className={cn(
                  "rounded-base border border-grey-20 p-4",
                  !editForm.manage_inventory && "opacity-50"
                )}
              >
                <FormToggle
                  checked={editForm.manage_inventory ? editForm.allow_backorder : false}
                  onChange={(v) => {
                    if (!editForm.manage_inventory) return
                    setEditForm((p) => ({ ...p, allow_backorder: v }))
                  }}
                  label="Allow backorders"
                  description="When enabled, customers can purchase the variant even if there's no available quantity."
                />
              </div>
            </div>
          </div>

          <div className="border-t border-grey-10 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-grey-90">Attributes</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField label="Weight" htmlFor="variant-weight">
                <Input
                  id="variant-weight"
                  type="number"
                  step="any"
                  min="0"
                  value={editForm.weight}
                  onChange={(e) => setEditForm((p) => ({ ...p, weight: e.target.value }))}
                />
              </FormField>
              <FormField label="Width" htmlFor="variant-width">
                <Input
                  id="variant-width"
                  type="number"
                  step="any"
                  min="0"
                  value={editForm.width}
                  onChange={(e) => setEditForm((p) => ({ ...p, width: e.target.value }))}
                />
              </FormField>
              <FormField label="Length" htmlFor="variant-length">
                <Input
                  id="variant-length"
                  type="number"
                  step="any"
                  min="0"
                  value={editForm.length}
                  onChange={(e) => setEditForm((p) => ({ ...p, length: e.target.value }))}
                />
              </FormField>
              <FormField label="Height" htmlFor="variant-height">
                <Input
                  id="variant-height"
                  type="number"
                  step="any"
                  min="0"
                  value={editForm.height}
                  onChange={(e) => setEditForm((p) => ({ ...p, height: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Mid code" htmlFor="variant-mid-code">
                <Input
                  id="variant-mid-code"
                  value={editForm.mid_code}
                  onChange={(e) => setEditForm((p) => ({ ...p, mid_code: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="HS code" htmlFor="variant-hs-code">
                <Input
                  id="variant-hs-code"
                  value={editForm.hs_code}
                  onChange={(e) => setEditForm((p) => ({ ...p, hs_code: e.target.value }))}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Country of origin" htmlFor="variant-origin-country">
                <Select
                  id="variant-origin-country"
                  value={editForm.origin_country}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, origin_country: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {COUNTRY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {countryName(code)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
            <button type="button" onClick={() => setEditOpen(false)} className={secondaryButton}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-variant" || !editForm.title.trim() || missingOption}
              className={primaryButton}
            >
              {busy === "save-variant" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit prices modal */}
      <Modal
        open={pricesOpen}
        onClose={() => setPricesOpen(false)}
        title="Edit prices"
        description="Prices are in major units (for example 10.00). Leave a currency empty to remove its price."
        size="sm"
      >
        <form onSubmit={savePrices} className="space-y-4">
          {priceCurrencyList.map((code) => {
            const raw = (priceForm[code] || "").trim()
            const parsed = parseFloat(raw)
            const invalid = raw !== "" && (!Number.isFinite(parsed) || parsed < 0)
            return (
              <FormField
                key={code}
                label={code.toUpperCase()}
                htmlFor={`variant-price-${code}`}
                error={invalid ? "Enter a valid amount." : undefined}
              >
                <Input
                  id={`variant-price-${code}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={priceForm[code] ?? ""}
                  onChange={(e) =>
                    setPriceForm((p) => ({ ...p, [code]: e.target.value }))
                  }
                />
              </FormField>
            )
          })}
          <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              type="button"
              onClick={() => setPricesOpen(false)}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-prices" || priceFormInvalid}
              className={primaryButton}
            >
              {busy === "save-prices" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit metadata modal */}
      <Modal
        open={metadataOpen}
        onClose={() => setMetadataOpen(false)}
        title="Edit Metadata"
        description="Store structured key-value data on this variant."
        size="md"
      >
        <form onSubmit={saveMetadata} className="space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 text-xs font-medium text-grey-50">
              <span>Key</span>
              <span>Value</span>
              <span />
            </div>
            {metaRows.map((row, index) => (
              <div key={row.rowId} className="grid grid-cols-[1fr_1fr_2rem] items-center gap-2">
                <Input
                  aria-label="Key"
                  value={row.key}
                  disabled={!row.editable}
                  onChange={(e) => updateMetaRow(row.rowId, { key: e.target.value })}
                  placeholder="Key"
                />
                <Input
                  aria-label="Value"
                  value={row.value}
                  disabled={!row.editable}
                  onChange={(e) => updateMetaRow(row.rowId, { value: e.target.value })}
                  placeholder="Value"
                />
                {row.editable ? (
                  <ActionMenu
                    label="Row actions"
                    items={[
                      { label: "Insert row above", icon: Plus, onClick: () => insertMetaRow(index) },
                      {
                        label: "Insert row below",
                        icon: Plus,
                        onClick: () => insertMetaRow(index + 1),
                      },
                      {
                        label: "Delete row",
                        icon: Trash,
                        destructive: true,
                        onClick: () => deleteMetaRow(row.rowId),
                      },
                    ]}
                  />
                ) : (
                  <span
                    className="inline-block h-8 w-8"
                    aria-hidden="true"
                    title="This row contains a complex value and cannot be edited here. It will be preserved."
                  />
                )}
              </div>
            ))}
          </div>
          {metaRows.some((r) => !r.editable) && (
            <p className="text-xs text-grey-50">
              Some rows contain complex values and cannot be edited here. They will be preserved
              when you save.
            </p>
          )}
          <button
            type="button"
            onClick={() => insertMetaRow(metaRows.length)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-grey-60 hover:text-grey-90"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
            <button
              type="button"
              onClick={() => setMetadataOpen(false)}
              className={secondaryButton}
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
