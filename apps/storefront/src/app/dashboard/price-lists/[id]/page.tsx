"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Plus, Trash } from "@medusajs/icons"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getPriceList,
  updatePriceList,
  listProducts,
  listProductVariants,
  listCustomerGroups,
  listRegions,
  UpdatePriceListInput,
  PriceListType,
  Product,
  ProductVariant,
  CustomerGroup,
  ApiError,
} from "@lib/merchant-admin/api"

function toIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function priceKey(variantId: string, currency: string) {
  return `${variantId}::${currency}`
}

export default function EditPriceListPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { token, logout } = useMerchantAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Details
  const [type, setType] = useState<PriceListType>("sale")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<"active" | "draft" | "inactive">("active")
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [customerGroupIds, setCustomerGroupIds] = useState<string[]>([])

  // Reference data
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [currencies, setCurrencies] = useState<string[]>(["usd"])
  const [products, setProducts] = useState<Product[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [productSearch, setProductSearch] = useState("")

  // Included products + prices
  const [includedProductIds, setIncludedProductIds] = useState<string[]>([])
  const [titleMap, setTitleMap] = useState<Record<string, string>>({})
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)

    listCustomerGroups(token).then((r) => setCustomerGroups(r.groups || [])).catch(() => {})
    listProducts(token).then((r) => setProducts(r.products || [])).catch(() => {})
    listRegions(token)
      .then((r) => {
        const codes = Array.from(
          new Set((r.regions || []).map((rg) => (rg.currency_code || "").toLowerCase()).filter(Boolean))
        )
        if (codes.length) setCurrencies(codes)
      })
      .catch(() => {})

    getPriceList(token, id)
      .then(({ price_list }) => {
        setType(price_list.type || "sale")
        setTitle(price_list.title)
        setStatus((price_list.status as any) || "active")
        setDescription(price_list.description || "")
        setStartsAt(toDateTimeLocal(price_list.starts_at))
        setExpiresAt(toDateTimeLocal(price_list.expires_at))
        setCustomerGroupIds(price_list.customer_group_ids || [])

        // Seed included products + amounts from existing prices.
        const included: string[] = []
        const tMap: Record<string, string> = {}
        const amt: Record<string, string> = {}
        for (const p of price_list.prices || []) {
          if (p.product_id) {
            if (!included.includes(p.product_id)) included.push(p.product_id)
            if (p.product_title) tMap[p.product_id] = p.product_title
          }
          if (p.variant_id) amt[priceKey(p.variant_id, p.currency_code)] = String(p.amount)
        }
        setIncludedProductIds(included)
        setTitleMap(tMap)
        setAmounts(amt)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load price list")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  // Load variants for every included product.
  useEffect(() => {
    if (!token) return
    const missing = includedProductIds.filter((pid) => !variantsByProduct[pid])
    if (!missing.length) return
    missing.forEach((pid) => {
      listProductVariants(token, pid)
        .then((vs) => setVariantsByProduct((prev) => ({ ...prev, [pid]: vs })))
        .catch(() => setVariantsByProduct((prev) => ({ ...prev, [pid]: [] })))
    })
  }, [token, includedProductIds, variantsByProduct])

  const titleFor = (pid: string) =>
    titleMap[pid] || products.find((p) => p.id === pid)?.title || pid

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    const base = products.filter((p) => !includedProductIds.includes(p.id))
    if (!q) return base
    return base.filter((p) => p.title.toLowerCase().includes(q))
  }, [products, includedProductIds, productSearch])

  const addProduct = (p: Product) => {
    setIncludedProductIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]))
    setTitleMap((prev) => ({ ...prev, [p.id]: p.title }))
  }
  const removeProduct = (pid: string) => {
    setIncludedProductIds((prev) => prev.filter((x) => x !== pid))
  }
  const toggleGroup = (gid: string) => {
    setCustomerGroupIds((prev) => (prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]))
  }
  const setAmount = (variantId: string, currency: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [priceKey(variantId, currency)]: value }))
  }

  const builtPrices = useMemo(() => {
    const rows: { variant_id: string; amount: number; currency_code: string }[] = []
    for (const pid of includedProductIds) {
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
  }, [includedProductIds, variantsByProduct, currencies, amounts])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !title.trim()) return
    setSaving(true)
    setError(null)
    const body: UpdatePriceListInput = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
      customer_group_ids: customerGroupIds,
      prices: builtPrices,
      starts_at: toIso(startsAt),
      expires_at: toIso(expiresAt),
    }
    try {
      await updatePriceList(token, id, body)
      router.push("/dashboard/price-lists")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to update price list")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Edit price list"
      subtitle="Update details, customer availability, and override prices."
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
            disabled={!title.trim() || saving || loading}
            onClick={() => handleSubmit()}
          >
            {saving ? "Saving..." : "Save changes"}
          </RouteModalFooterAction>
        </>
      }
    >
      {error && (
        <div className="mb-6 rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-base bg-grey-10" />
          <div className="h-10 animate-pulse rounded-base bg-grey-10" />
          <div className="h-40 animate-pulse rounded-base bg-grey-10" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <SectionCard title="Details" description="Type, title, status and schedule.">
            <div className="space-y-4">
              <FormField label="Type" htmlFor="type">
                <Select id="type" value={type} onChange={(e) => setType(e.target.value as PriceListType)}>
                  <option value="sale">Sale</option>
                  <option value="override">Override</option>
                </Select>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Title" htmlFor="title">
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </FormField>
                <FormField label="Status" htmlFor="status">
                  <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="inactive">Inactive</option>
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
            </div>
          </SectionCard>

          <SectionCard
            title="Customer availability"
            description="Choose which customer groups this price list applies to."
          >
            {customerGroups.length === 0 ? (
              <p className="text-sm text-grey-40">No customer groups yet.</p>
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
          </SectionCard>

          <SectionCard
            title="Products & prices"
            description="Set the override/sale price per variant. Clear a cell to remove that price."
          >
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => setShowPicker((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-base border border-grey-20 px-3 py-1.5 text-sm font-medium text-grey-70 hover:bg-grey-10"
                >
                  <Plus className="h-4 w-4" />
                  Add products
                </button>
                {showPicker && (
                  <div className="mt-3 rounded-base border border-grey-20 p-3">
                    <Input
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    <div className="mt-2 max-h-56 divide-y divide-grey-10 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-grey-40">No products to add.</p>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => addProduct(p)}
                            className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-grey-5"
                          >
                            {p.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.thumbnail} alt="" className="h-8 w-8 rounded-base object-cover" />
                            ) : (
                              <span className="h-8 w-8 rounded-base bg-grey-10" />
                            )}
                            <span className="text-sm text-grey-90">{p.title}</span>
                            <Plus className="ml-auto h-4 w-4 text-grey-50" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {includedProductIds.length === 0 ? (
                <p className="text-sm text-grey-40">No products in this price list yet. Add products above.</p>
              ) : (
                includedProductIds.map((pid) => {
                  const variants = variantsByProduct[pid]
                  return (
                    <div key={pid} className="rounded-large border border-grey-20">
                      <div className="flex items-center justify-between border-b border-grey-10 bg-grey-5 px-4 py-2.5">
                        <span className="text-sm font-semibold text-grey-90">{titleFor(pid)}</span>
                        <button
                          type="button"
                          onClick={() => removeProduct(pid)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Remove
                        </button>
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
                })
              )}
            </div>
          </SectionCard>
        </form>
      )}
    </RouteModal>
  )
}
