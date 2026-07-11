"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash } from "@medusajs/icons"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createPriceList,
  getStoreSettings,
  listProducts,
  listProductVariants,
  CreatePriceListInput,
  Product,
  ProductVariant,
  ApiError,
} from "@lib/merchant-admin/api"

type EnabledCurrency = { code: string; name: string; symbol: string }

// A staged override price. `variant_id` is REQUIRED by the backend
// (CreatePriceListSchema.prices) — the picker below guarantees each row has one.
type PriceRow = {
  id: string
  variant_id: string
  label: string
  amount: string
  currency_code: string
}

function majorUnits(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

// The backend validates starts_at/expires_at with z.string().datetime(), which
// requires a full ISO timestamp (with Z). The datetime-local input yields
// "2026-07-07T12:00", so convert to ISO or send null.
function toIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default function CreatePriceListPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"draft" | "active" | "inactive">("draft")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store currencies drive the currency dropdown (falls back to USD).
  const [enabledCurrencies, setEnabledCurrencies] = useState<EnabledCurrency[]>([
    { code: "usd", name: "US Dollar", symbol: "$" },
  ])

  // Product/variant picker state.
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [rowAmount, setRowAmount] = useState("")
  const [rowCurrency, setRowCurrency] = useState("usd")

  // Staged price rows (each with a variant_id) sent as `prices` on submit.
  const [rows, setRows] = useState<PriceRow[]>([])

  useEffect(() => {
    if (!token) return
    setLoadingProducts(true)
    listProducts(token)
      .then((r) => setProducts(r.products || []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false))

    getStoreSettings(token)
      .then((r) => {
        const enabled = r.store.supported_currencies
          .filter((c) => c.enabled)
          .map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))
        if (enabled.length) {
          setEnabledCurrencies(enabled)
          setRowCurrency(enabled[0].code)
        }
      })
      .catch(() => {})
  }, [token])

  // Load the selected product's variants for the second dropdown.
  useEffect(() => {
    if (!token || !selectedProductId) {
      setVariants([])
      setSelectedVariantId("")
      return
    }
    setLoadingVariants(true)
    listProductVariants(token, selectedProductId)
      .then((vs) => {
        setVariants(vs)
        setSelectedVariantId(vs[0]?.id ?? "")
      })
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false))
  }, [token, selectedProductId])

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  )

  const addRow = () => {
    if (!selectedVariantId || !rowAmount) return
    const variant = variants.find((v) => v.id === selectedVariantId)
    const label = `${selectedProduct?.title ?? "Product"} · ${variant?.title ?? selectedVariantId}`
    setRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}`,
        variant_id: selectedVariantId,
        label,
        amount: rowAmount,
        currency_code: rowCurrency,
      },
    ])
    setRowAmount("")
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !title || rows.length === 0) return
    setSaving(true)
    setError(null)

    const body: CreatePriceListInput = {
      title,
      description,
      status,
      // Each price carries the variant_id the backend requires (fixes the 400).
      prices: rows.map((r) => ({
        variant_id: r.variant_id,
        amount: majorUnits(r.amount),
        currency_code: r.currency_code,
      })),
      starts_at: toIso(startsAt),
      expires_at: toIso(expiresAt),
    }

    try {
      await createPriceList(token, body)
      router.push("/dashboard/price-lists")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create price list")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Add price list"
      subtitle="Create an override price list."
      footer={
        <>
          <RouteModalFooterAction
            variant="secondary"
            onClick={() => router.push("/dashboard/price-lists")}
          >
            Cancel
          </RouteModalFooterAction>
          <RouteModalFooterAction
            type="submit"
            disabled={!title || rows.length === 0 || saving}
            onClick={() => handleSubmit()}
          >
            {saving ? "Saving..." : "Add price list"}
          </RouteModalFooterAction>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <SectionCard title="General" description="Basic price list information.">
          <div className="space-y-4">
            <FormField label="Title" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wholesale prices"
                required
              />
            </FormField>

            <FormField label="Description" htmlFor="description">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </FormField>

            <FormField label="Status" htmlFor="status">
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          title="Override prices"
          description="Pick a product variant and set its override price. At least one is required."
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <FormField label="Product" htmlFor="product">
                  <Select
                    id="product"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    disabled={loadingProducts || products.length === 0}
                  >
                    <option value="">
                      {loadingProducts
                        ? "Loading..."
                        : products.length === 0
                        ? "No products"
                        : "Select a product"}
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="sm:col-span-3">
                <FormField label="Variant" htmlFor="variant">
                  <Select
                    id="variant"
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    disabled={!selectedProductId || loadingVariants || variants.length === 0}
                  >
                    <option value="">
                      {!selectedProductId
                        ? "Pick a product first"
                        : loadingVariants
                        ? "Loading..."
                        : variants.length === 0
                        ? "No variants"
                        : "Select a variant"}
                    </option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                        {v.sku ? ` (${v.sku})` : ""}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Amount" htmlFor="amount">
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={rowAmount}
                    onChange={(e) => setRowAmount(e.target.value)}
                    placeholder="10.00"
                  />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Currency" htmlFor="currency">
                  <Select
                    id="currency"
                    value={rowCurrency}
                    onChange={(e) => setRowCurrency(e.target.value)}
                  >
                    {enabledCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code.toUpperCase()}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="flex items-end sm:col-span-1">
                <button
                  type="button"
                  onClick={addRow}
                  disabled={!selectedVariantId || !rowAmount}
                  className="mb-0.5 inline-flex h-[38px] w-full items-center justify-center rounded-base border border-grey-20 bg-white text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Add price"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {rows.length > 0 ? (
              <div className="divide-y divide-grey-10 rounded-base border border-grey-20">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="truncate text-grey-90">{r.label}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-medium text-grey-90">
                        {r.amount} {r.currency_code.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="rounded-base p-1 text-grey-50 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove price"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-base border border-dashed border-grey-20 bg-grey-5 px-3 py-4 text-center text-sm text-grey-50">
                No prices added yet. Select a variant and amount, then click +.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Schedule" description="Optionally limit when this price list is active.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Starts at" htmlFor="starts_at">
              <Input
                id="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FormField>

            <FormField label="Expires at" htmlFor="expires_at">
              <Input
                id="expires_at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </FormField>
          </div>
        </SectionCard>
      </form>
    </RouteModal>
  )
}
