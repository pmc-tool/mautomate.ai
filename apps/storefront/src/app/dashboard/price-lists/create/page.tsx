"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createPriceList,
  listProducts,
  listProductVariants,
  listCustomerGroups,
  listRegions,
  CreatePriceListInput,
  PriceListType,
  Product,
  ProductVariant,
  CustomerGroup,
  ApiError,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

type StepId = "detail" | "product" | "price"
const STEPS: { id: StepId; label: string }[] = [
  { id: "detail", label: "Details" },
  { id: "product", label: "Products" },
  { id: "price", label: "Prices" },
]

function toIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function priceKey(variantId: string, currency: string) {
  return `${variantId}::${currency}`
}

function StepTabs({ current }: { current: StepId }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="mb-8 flex items-center gap-2 border-b border-grey-20">
      {STEPS.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium",
              active
                ? "border-grey-90 text-grey-90"
                : done
                ? "border-transparent text-grey-70"
                : "border-transparent text-grey-40"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                done
                  ? "bg-emerald-600 text-white"
                  : active
                  ? "bg-grey-90 text-white"
                  : "bg-grey-20 text-grey-50"
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </div>
        )
      })}
    </div>
  )
}

function TypeChoice({
  value,
  onChange,
}: {
  value: PriceListType
  onChange: (v: PriceListType) => void
}) {
  const opts: { id: PriceListType; title: string; desc: string }[] = [
    { id: "sale", title: "Sale", desc: "Sale prices are temporary price changes for products." },
    { id: "override", title: "Override", desc: "Overrides are usually used to create customer-specific prices." },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-large border p-4 text-left transition-colors",
            value === o.id
              ? "border-grey-90 ring-1 ring-grey-90"
              : "border-grey-20 hover:border-grey-40"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border",
                value === o.id ? "border-grey-90" : "border-grey-30"
              )}
            >
              {value === o.id && <span className="h-2 w-2 rounded-full bg-grey-90" />}
            </span>
            <span className="text-sm font-semibold text-grey-90">{o.title}</span>
          </div>
          <p className="mt-1 pl-6 text-sm text-grey-50">{o.desc}</p>
        </button>
      ))}
    </div>
  )
}

export default function CreatePriceListPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [step, setStep] = useState<StepId>("detail")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Details
  const [type, setType] = useState<PriceListType>("sale")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<"active" | "draft">("active")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [customerGroupIds, setCustomerGroupIds] = useState<string[]>([])

  // Reference data
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["usd"])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productSearch, setProductSearch] = useState("")

  // Selection + prices
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token) return
    setLoadingProducts(true)
    listProducts(token)
      .then((r) => setProducts(r.products || []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false))

    listCustomerGroups(token)
      .then((r) => setCustomerGroups(r.groups || []))
      .catch(() => {})

    listRegions(token)
      .then((r) => {
        const codes = Array.from(
          new Set((r.regions || []).map((rg) => (rg.currency_code || "").toLowerCase()).filter(Boolean))
        )
        if (codes.length) setCurrencies(codes)
      })
      .catch(() => {})
  }, [token])

  // Lazily load variants for selected products (needed by the Prices step).
  useEffect(() => {
    if (!token) return
    const missing = selectedProductIds.filter((id) => !variantsByProduct[id])
    if (!missing.length) return
    missing.forEach((pid) => {
      listProductVariants(token, pid)
        .then((vs) => setVariantsByProduct((prev) => ({ ...prev, [pid]: vs })))
        .catch(() => setVariantsByProduct((prev) => ({ ...prev, [pid]: [] })))
    })
  }, [token, selectedProductIds, variantsByProduct])

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  )

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.title.toLowerCase().includes(q))
  }, [products, productSearch])

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleGroup = (id: string) => {
    setCustomerGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const setAmount = (variantId: string, currency: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [priceKey(variantId, currency)]: value }))
  }

  const builtPrices = useMemo(() => {
    const rows: { variant_id: string; amount: number; currency_code: string }[] = []
    for (const pid of selectedProductIds) {
      for (const v of variantsByProduct[pid] || []) {
        for (const cur of currencies) {
          const raw = amounts[priceKey(v.id, cur)]
          if (raw !== undefined && raw !== "") {
            const n = parseFloat(raw)
            if (!isNaN(n) && n >= 0) rows.push({ variant_id: v.id, amount: n, currency_code: cur })
          }
        }
      }
    }
    return rows
  }, [selectedProductIds, variantsByProduct, currencies, amounts])

  const canContinueDetail = title.trim().length > 0
  const canContinueProduct = selectedProductIds.length > 0
  const canSave = builtPrices.length > 0

  const goNext = () => {
    if (step === "detail" && canContinueDetail) setStep("product")
    else if (step === "product" && canContinueProduct) setStep("price")
  }
  const goBack = () => {
    if (step === "price") setStep("product")
    else if (step === "product") setStep("detail")
  }

  const handleSubmit = async () => {
    if (!token || !canSave) return
    setSaving(true)
    setError(null)
    const body: CreatePriceListInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      status,
      customer_group_ids: customerGroupIds,
      prices: builtPrices,
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
      title="Create price list"
      subtitle="Set up sale or override prices for your products."
      footer={
        <>
          {step !== "detail" && (
            <RouteModalFooterAction variant="secondary" onClick={goBack}>
              Back
            </RouteModalFooterAction>
          )}
          {step !== "price" ? (
            <RouteModalFooterAction
              onClick={goNext}
              disabled={
                (step === "detail" && !canContinueDetail) ||
                (step === "product" && !canContinueProduct)
              }
            >
              Continue
            </RouteModalFooterAction>
          ) : (
            <RouteModalFooterAction type="submit" onClick={handleSubmit} disabled={!canSave || saving}>
              {saving ? "Saving..." : "Save"}
            </RouteModalFooterAction>
          )}
        </>
      }
    >
      <StepTabs current={step} />

      {error && (
        <div className="mb-6 rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === "detail" && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-grey-90">Type</p>
            <p className="mb-3 text-sm text-grey-50">Choose the type of price list you want to create.</p>
            <TypeChoice value={type} onChange={setType} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Title" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wholesale prices"
                required
              />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Description" htmlFor="description">
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date (optional)" htmlFor="starts_at">
              <Input
                id="starts_at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FormField>
            <FormField label="Expiry date (optional)" htmlFor="expires_at">
              <Input
                id="expires_at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </FormField>
          </div>

          <div>
            <p className="text-sm font-medium text-grey-90">Customer availability (optional)</p>
            <p className="mb-3 text-sm text-grey-50">
              Choose which customer groups the price list should be applied to.
            </p>
            {customerGroups.length === 0 ? (
              <p className="text-sm text-grey-40">
                No customer groups yet. Create groups under Customers to target specific customers.
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-base border border-grey-20 p-2">
                {customerGroups.map((g) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-3 rounded-base px-2 py-1.5 hover:bg-grey-5"
                  >
                    <input
                      type="checkbox"
                      checked={customerGroupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    <span className="text-sm text-grey-90">{g.name}</span>
                    <span className="ml-auto text-xs text-grey-40">{g.customer_count ?? 0} customers</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === "product" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-grey-90">
              Choose products ({selectedProductIds.length} selected)
            </p>
          </div>
          <Input
            placeholder="Search products..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {loadingProducts ? (
            <p className="text-sm text-grey-50">Loading products...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-sm text-grey-40">No products found.</p>
          ) : (
            <div className="max-h-96 divide-y divide-grey-10 overflow-y-auto rounded-base border border-grey-20">
              {filteredProducts.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-grey-5"
                >
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt="" className="h-8 w-8 rounded-base object-cover" />
                  ) : (
                    <span className="h-8 w-8 rounded-base bg-grey-10" />
                  )}
                  <span className="text-sm text-grey-90">{p.title}</span>
                  <span className="ml-auto text-xs text-grey-40">{p.status}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "price" && (
        <div className="space-y-6">
          <p className="text-sm text-grey-50">
            Set the {type === "sale" ? "sale" : "override"} price per variant. Leave a cell empty to skip it.
          </p>
          {selectedProducts.map((p) => {
            const variants = variantsByProduct[p.id]
            return (
              <div key={p.id} className="rounded-large border border-grey-20">
                <div className="border-b border-grey-10 bg-grey-5 px-4 py-2.5 text-sm font-semibold text-grey-90">
                  {p.title}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-grey-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Variant</th>
                        {currencies.map((c) => (
                          <th key={c} className="px-4 py-2 text-left font-medium uppercase">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-10">
                      {!variants ? (
                        <tr>
                          <td className="px-4 py-3 text-grey-40" colSpan={currencies.length + 1}>
                            Loading variants...
                          </td>
                        </tr>
                      ) : variants.length === 0 ? (
                        <tr>
                          <td className="px-4 py-3 text-grey-40" colSpan={currencies.length + 1}>
                            No variants.
                          </td>
                        </tr>
                      ) : (
                        variants.map((v) => (
                          <tr key={v.id}>
                            <td className="px-4 py-2 text-grey-90">
                              {v.title}
                              {v.sku ? <span className="text-grey-40"> ({v.sku})</span> : null}
                            </td>
                            {currencies.map((c) => (
                              <td key={c} className="px-4 py-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={amounts[priceKey(v.id, c)] ?? ""}
                                  onChange={(e) => setAmount(v.id, c, e.target.value)}
                                  placeholder="—"
                                />
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
          {!canSave && (
            <p className="text-sm text-grey-40">Enter at least one price to save.</p>
          )}
        </div>
      )}
    </RouteModal>
  )
}
