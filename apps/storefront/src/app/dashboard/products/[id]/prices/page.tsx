"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeftMini, CurrencyDollar, ExclamationCircle } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getProductFull,
  listStoreCurrencies,
  updateVariantPricesBatch,
  ProductFullDetail,
  ProductFullVariant,
  ApiError,
} from "../../../../../lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

// Cell values are kept as raw strings in MAJOR units exactly as typed. An empty
// string means "no price for this currency" — on save it is simply omitted from
// the variant's price list, which removes/skips that price server-side.
type PriceGrid = Record<string, Record<string, string>>

function sanitizeAmount(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, "")
  const firstDot = s.indexOf(".")
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "")
  }
  return s
}

function normalizeAmount(value: string | undefined): string {
  if (!value || !value.trim()) return ""
  const n = parseFloat(value)
  return Number.isFinite(n) ? String(n) : ""
}

function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code.toUpperCase(),
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0)
    return parts.find((p) => p.type === "currency")?.value || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function buildInitialGrid(
  variants: ProductFullVariant[],
  currencies: string[]
): PriceGrid {
  const grid: PriceGrid = {}
  for (const variant of variants) {
    const row: Record<string, string> = {}
    for (const code of currencies) {
      const price = (variant.prices || []).find(
        (p) => p.currency_code?.toLowerCase() === code
      )
      row[code] =
        price && typeof price.amount === "number" ? String(price.amount) : ""
    }
    grid[variant.id] = row
  }
  return grid
}

export default function ProductPricesPage() {
  const params = useParams()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [product, setProduct] = useState<ProductFullDetail | null>(null)
  const [currencies, setCurrencies] = useState<string[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  const [initialGrid, setInitialGrid] = useState<PriceGrid>({})
  const [grid, setGrid] = useState<PriceGrid>({})

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    if (type === "error") {
      setTimeout(() => setMessage(null), 5000)
    }
  }

  async function load() {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    try {
      const [productRes, currencyRes] = await Promise.all([
        getProductFull(token, id),
        listStoreCurrencies(token),
      ])

      const seen = new Set<string>()
      const ordered: string[] = []
      for (const raw of [
        currencyRes.default_currency,
        ...(currencyRes.currencies || []),
      ]) {
        const code = (raw || "").toLowerCase()
        if (code && !seen.has(code)) {
          seen.add(code)
          ordered.push(code)
        }
      }

      const variants = productRes.product.variants || []
      const initial = buildInitialGrid(variants, ordered)

      setProduct(productRes.product)
      setCurrencies(ordered)
      setDefaultCurrency((currencyRes.default_currency || "").toLowerCase())
      setInitialGrid(initial)
      setGrid(
        Object.fromEntries(
          Object.entries(initial).map(([vid, row]) => [vid, { ...row }])
        )
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof Error ? err.message : "Failed to load prices")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
  }, [])

  const variants = useMemo(() => product?.variants || [], [product])

  const symbols = useMemo(() => {
    const map: Record<string, string> = {}
    for (const code of currencies) {
      map[code] = currencySymbol(code)
    }
    return map
  }, [currencies])

  function isCellDirty(variantId: string, code: string): boolean {
    return (
      normalizeAmount(grid[variantId]?.[code]) !==
      normalizeAmount(initialGrid[variantId]?.[code])
    )
  }

  const dirtyVariantIds = useMemo(() => {
    const ids: string[] = []
    for (const variant of variants) {
      if (currencies.some((code) => isCellDirty(variant.id, code))) {
        ids.push(variant.id)
      }
    }
    return ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, initialGrid, variants, currencies])

  const dirtyCellCount = useMemo(() => {
    let count = 0
    for (const variant of variants) {
      for (const code of currencies) {
        if (isCellDirty(variant.id, code)) count++
      }
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, initialGrid, variants, currencies])

  const hasDirty = dirtyCellCount > 0

  useEffect(() => {
    if (!hasDirty || saving) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasDirty, saving])

  function setCell(variantId: string, code: string, value: string) {
    setGrid((prev) => ({
      ...prev,
      [variantId]: { ...prev[variantId], [code]: value },
    }))
  }

  function focusCell(row: number, col: number) {
    if (row < 0 || row >= variants.length) return
    if (col < 0 || col >= currencies.length) return
    const el = inputRefs.current.get(`${row}:${col}`)
    if (el) {
      el.focus()
      el.select()
    }
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
    variantId: string,
    code: string
  ) {
    const input = e.currentTarget
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault()
        focusCell(row - 1, col)
        break
      case "ArrowDown":
        e.preventDefault()
        focusCell(row + 1, col)
        break
      case "Enter":
        e.preventDefault()
        focusCell(e.shiftKey ? row - 1 : row + 1, col)
        break
      case "Tab":
        // Native tab order already walks the grid left-to-right, row by row.
        break
      case "ArrowLeft":
        if (input.selectionStart === 0 && input.selectionEnd === 0) {
          e.preventDefault()
          focusCell(row, col - 1)
        }
        break
      case "ArrowRight":
        if (
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length
        ) {
          e.preventDefault()
          focusCell(row, col + 1)
        }
        break
      case "Escape":
        e.preventDefault()
        setCell(variantId, code, initialGrid[variantId]?.[code] ?? "")
        break
      default:
        break
    }
  }

  function handleCancel() {
    if (
      hasDirty &&
      !saving &&
      !confirm("You have unsaved price changes. Discard them?")
    ) {
      return
    }
    router.push(`/dashboard/products/${id}`)
  }

  async function handleSave() {
    if (!token || !product || saving || !hasDirty) return

    const updates = variants
      .filter((v) => dirtyVariantIds.includes(v.id))
      .map((variant) => ({
        variant_id: variant.id,
        prices: currencies
          .map((code) => ({
            currency_code: code,
            amount: parseFloat(grid[variant.id]?.[code] ?? ""),
          }))
          .filter((p) => Number.isFinite(p.amount) && p.amount >= 0),
      }))

    if (!updates.length) return

    setSaving(true)
    setMessage(null)
    try {
      await updateVariantPricesBatch(token, product.id, updates)
      showMessage("success", "Prices updated")
      // Keep the grid disabled and let the confirmation register before
      // returning to the product detail page.
      redirectTimer.current = setTimeout(() => {
        router.push(`/dashboard/products/${product.id}`)
      }, 700)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showMessage(
        "error",
        err instanceof Error ? err.message : "Failed to update prices"
      )
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit prices" description="Loading..." />
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-12 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit prices"
          description="We could not load this product's prices."
        />
        <EmptyState
          icon={CurrencyDollar}
          title="Unable to load prices"
          description={
            error ||
            "This product does not exist or you do not have access to it."
          }
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/products/${id}`)}
                className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
              >
                Back to product
              </button>
              <button
                onClick={load}
                className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
              >
                Try again
              </button>
            </div>
          }
        />
      </div>
    )
  }

  if (currencies.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit prices" description={product.title} />
        <EmptyState
          icon={CurrencyDollar}
          title="No store currencies"
          description="Your store has no supported currencies configured, so there are no price columns to edit."
          action={
            <button
              onClick={() => router.push(`/dashboard/products/${id}`)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Back to product
            </button>
          }
        />
      </div>
    )
  }

  if (variants.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit prices" description={product.title} />
        <EmptyState
          icon={CurrencyDollar}
          title="No variants"
          description="This product has no variants yet. Add a variant before editing prices."
          action={
            <button
              onClick={() => router.push(`/dashboard/products/${id}`)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Back to product
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={handleCancel}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to product
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && (
            <ExclamationCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <PageHeader
        title="Edit prices"
        description={`Set prices for all variants of ${product.title} across your store currencies.`}
      />

      <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-grey-20">
                <th className="sticky left-0 z-10 min-w-[14rem] border-r border-grey-20 bg-grey-10 px-4 py-3 text-left font-medium text-grey-60">
                  Variant
                </th>
                {currencies.map((code) => (
                  <th
                    key={code}
                    className="min-w-[9rem] border-r border-grey-20 bg-grey-10 px-3 py-3 text-right font-medium text-grey-60 last:border-r-0"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Price {code.toUpperCase()}
                      {code === defaultCurrency && (
                        <span className="rounded-full bg-grey-20 px-1.5 py-0.5 text-[10px] font-medium text-grey-60">
                          Default
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, rowIdx) => (
                <tr
                  key={variant.id}
                  className="border-b border-grey-10 last:border-b-0"
                >
                  <td className="sticky left-0 z-10 border-r border-grey-20 bg-white px-4 py-2 align-middle">
                    <p className="truncate font-medium text-grey-90">
                      {variant.title || "—"}
                    </p>
                    <p className="truncate text-xs text-grey-50">
                      {variant.sku || "No SKU"}
                    </p>
                  </td>
                  {currencies.map((code, colIdx) => {
                    const dirty = isCellDirty(variant.id, code)
                    return (
                      <td
                        key={code}
                        className={cn(
                          "border-r border-grey-10 p-0 last:border-r-0",
                          dirty && "bg-sky-50"
                        )}
                      >
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-grey-40">
                            {symbols[code]}
                          </span>
                          <input
                            ref={(el) => {
                              const key = `${rowIdx}:${colIdx}`
                              if (el) {
                                inputRefs.current.set(key, el)
                              } else {
                                inputRefs.current.delete(key)
                              }
                            }}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`${variant.title || "Variant"} price ${code.toUpperCase()}`}
                            disabled={saving}
                            value={grid[variant.id]?.[code] ?? ""}
                            placeholder="-"
                            onChange={(e) =>
                              setCell(
                                variant.id,
                                code,
                                sanitizeAmount(e.target.value)
                              )
                            }
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) =>
                              handleCellKeyDown(
                                e,
                                rowIdx,
                                colIdx,
                                variant.id,
                                code
                              )
                            }
                            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-right text-sm text-grey-90 placeholder:text-grey-30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-grey-20 px-5 py-4">
          <p className="text-sm text-grey-50">
            {hasDirty
              ? `${dirtyCellCount} unsaved change${dirtyCellCount === 1 ? "" : "s"} across ${dirtyVariantIds.length} variant${dirtyVariantIds.length === 1 ? "" : "s"}`
              : "Amounts are in major units. Clear a cell to remove that price."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasDirty}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
