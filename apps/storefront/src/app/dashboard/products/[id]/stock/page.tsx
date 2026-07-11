"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeftMini, ExclamationCircle, MapPin } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  getProduct,
  getProductStock,
  updateProductStock,
  ProductStockVariantRow,
  ApiError,
} from "../../../../../lib/merchant-admin/api"

type LocationColumn = { location_id: string; location_name: string }

function cellKey(inventoryItemId: string, locationId: string): string {
  return `${inventoryItemId}|${locationId}`
}

/**
 * Parses a quantity input value. Empty string counts as 0 (clearing a cell sets
 * the level to zero). Returns null for anything that is not a non-negative
 * integer so the cell can be flagged invalid.
 */
function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

export default function ProductStockPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [productTitle, setProductTitle] = useState<string | null>(null)
  const [rows, setRows] = useState<ProductStockVariantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Cell state: values are the raw input strings, initial holds the loaded
  // numbers so dirty cells can be diffed and only those get submitted.
  const [values, setValues] = useState<Record<string, string>>({})
  const [initial, setInitial] = useState<Record<string, number>>({})

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // Location columns: union of every location seen across variants, in order of
  // first appearance, so all managed variants share the same grid columns.
  const locations = useMemo<LocationColumn[]>(() => {
    const seen = new Map<string, LocationColumn>()
    for (const row of rows) {
      for (const level of row.locations) {
        if (!seen.has(level.location_id)) {
          seen.set(level.location_id, {
            location_id: level.location_id,
            location_name: level.location_name,
          })
        }
      }
    }
    return Array.from(seen.values())
  }, [rows])

  // First variant that owns each inventory item. Variants sharing an inventory
  // item with an earlier row render mirrored, read-only cells so the same level
  // is never edited (and submitted) twice.
  const itemOwner = useMemo(() => {
    const owner = new Map<string, string>()
    for (const row of rows) {
      if (row.inventory_item_id && !owner.has(row.inventory_item_id)) {
        owner.set(row.inventory_item_id, row.variant_id)
      }
    }
    return owner
  }, [rows])

  function applyStock(stockRows: ProductStockVariantRow[]) {
    // Rebuild the editable cell state from a fresh stock response.
    const columnIds = new Map<string, true>()
    for (const row of stockRows) {
      for (const level of row.locations) {
        columnIds.set(level.location_id, true)
      }
    }
    const nextInitial: Record<string, number> = {}
    const nextValues: Record<string, string> = {}
    for (const row of stockRows) {
      if (!row.inventory_item_id) continue
      for (const locationId of columnIds.keys()) {
        const key = cellKey(row.inventory_item_id, locationId)
        if (key in nextInitial) continue
        const level = row.locations.find((l) => l.location_id === locationId)
        const qty = level ? level.stocked_quantity : 0
        nextInitial[key] = qty
        nextValues[key] = String(qty)
      }
    }
    setInitial(nextInitial)
    setValues(nextValues)
    setRows(stockRows)
  }

  async function load(withSpinner: boolean) {
    if (!token || !id) return
    if (withSpinner) setLoading(true)
    setError(null)
    try {
      const [productRes, stockRes] = await Promise.all([
        getProduct(token, id).catch(() => null),
        getProductStock(token, id),
      ])
      if (productRes) setProductTitle(productRes.product.title)
      applyStock(stockRes.variants || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof Error ? err.message : "Failed to load stock levels")
    } finally {
      if (withSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  const dirtyKeys = useMemo(() => {
    const keys: string[] = []
    for (const key of Object.keys(initial)) {
      const parsed = parseQuantity(values[key] ?? "")
      if (parsed !== null && parsed !== initial[key]) keys.push(key)
    }
    return keys
  }, [values, initial])

  const invalidKeys = useMemo(() => {
    const keys: string[] = []
    for (const key of Object.keys(initial)) {
      if (parseQuantity(values[key] ?? "") === null) keys.push(key)
    }
    return keys
  }, [values, initial])

  const hasManagedVariant = rows.some((r) => !!r.inventory_item_id)

  function setCell(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!token || !id || saving) return
    if (invalidKeys.length > 0) {
      showMessage("error", "Enter a whole number of 0 or more in every changed cell.")
      return
    }
    if (dirtyKeys.length === 0) return
    const updates = dirtyKeys.map((key) => {
      const sep = key.indexOf("|")
      const inventory_item_id = key.slice(0, sep)
      const location_id = key.slice(sep + 1)
      return {
        inventory_item_id,
        location_id,
        stocked_quantity: parseQuantity(values[key] ?? "")!,
      }
    })
    setSaving(true)
    try {
      await updateProductStock(token, id, updates)
      showMessage("success", "Stock updated")
      await load(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showMessage("error", err instanceof Error ? err.message : "Failed to update stock")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (dirtyKeys.length > 0 && !confirm("Discard unsaved stock changes?")) return
    router.push(`/dashboard/products/${id}`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock" description="Loading stock levels..." />
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-64 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-10 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push(`/dashboard/products/${id}`)}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to product
        </button>
        <PageHeader title="Stock" description="We could not load stock levels for this product." />
        <EmptyState
          icon={ExclamationCircle}
          title="Failed to load stock"
          description={error}
          action={
            <button
              onClick={() => load(true)}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Try again
            </button>
          }
        />
      </div>
    )
  }

  const noLocations = locations.length === 0

  return (
    <div className="space-y-6">
      <button
        onClick={handleCancel}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to product
      </button>

      <PageHeader
        title="Stock"
        description={
          productTitle
            ? `Manage stock levels and locations for ${productTitle}.`
            : "Manage product stock levels and locations."
        }
      />

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={ExclamationCircle}
          title="No variants"
          description="This product has no variants to manage stock for. Add a variant first."
          action={
            <Link
              href={`/dashboard/products/${id}`}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Back to product
            </Link>
          }
        />
      ) : noLocations && hasManagedVariant ? (
        <EmptyState
          icon={MapPin}
          title="No stock locations"
          description="Create a stock location to start tracking inventory for this product."
          action={
            <Link
              href="/dashboard/settings/locations"
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Go to locations
            </Link>
          }
        />
      ) : noLocations ? (
        <EmptyState
          icon={ExclamationCircle}
          title="Inventory not managed"
          description="None of this product's variants have inventory management enabled, so there are no stock levels to edit."
          action={
            <Link
              href={`/dashboard/products/${id}`}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Back to product
            </Link>
          }
        />
      ) : (
        <>
          <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-grey-20 bg-grey-10">
                    <th className="px-5 py-3 text-left font-medium text-grey-50">Variant</th>
                    {locations.map((loc) => (
                      <th
                        key={loc.location_id}
                        className="whitespace-nowrap px-5 py-3 text-left font-medium text-grey-50"
                      >
                        {loc.location_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-10">
                  {rows.map((row) => {
                    const managed = !!row.inventory_item_id
                    const isDuplicate =
                      managed && itemOwner.get(row.inventory_item_id!) !== row.variant_id
                    const ownerRow = isDuplicate
                      ? rows.find((r) => r.variant_id === itemOwner.get(row.inventory_item_id!))
                      : undefined
                    return (
                      <tr key={row.variant_id} className="align-top">
                        <td className="px-5 py-3">
                          <p className="font-medium text-grey-90">{row.variant_title}</p>
                          <p className="mt-0.5 text-xs text-grey-50">{row.sku || "No SKU"}</p>
                        </td>
                        {!managed ? (
                          <td
                            colSpan={locations.length}
                            className="px-5 py-3 text-sm text-grey-40"
                          >
                            Not managed
                          </td>
                        ) : (
                          locations.map((loc) => {
                            const key = cellKey(row.inventory_item_id!, loc.location_id)
                            const level = row.locations.find(
                              (l) => l.location_id === loc.location_id
                            )
                            const reserved = level ? level.reserved_quantity : 0
                            const raw = values[key] ?? ""
                            const parsed = parseQuantity(raw)
                            const dirty = parsed !== null && parsed !== initial[key]
                            const invalid = parsed === null
                            return (
                              <td key={loc.location_id} className="px-5 py-3">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={raw}
                                  disabled={saving || isDuplicate}
                                  onChange={(e) => setCell(key, e.target.value)}
                                  title={
                                    isDuplicate && ownerRow
                                      ? `This inventory item is already editable under ${ownerRow.variant_title}${ownerRow.sku ? ` (${ownerRow.sku})` : ""}.`
                                      : undefined
                                  }
                                  aria-label={`Stocked quantity for ${row.variant_title} at ${loc.location_name}`}
                                  className={cn(
                                    "w-24 rounded-base border bg-white px-2 py-1.5 text-right text-sm text-grey-90 outline-none transition-colors focus:border-grey-50 disabled:cursor-not-allowed disabled:bg-grey-10 disabled:text-grey-40",
                                    invalid
                                      ? "border-rose-400"
                                      : dirty
                                        ? "border-blue-500"
                                        : "border-grey-20"
                                  )}
                                />
                                <p className="mt-1 text-xs text-grey-40">{reserved} reserved</p>
                              </td>
                            )
                          })
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-grey-50">
              {invalidKeys.length > 0
                ? "Fix the highlighted cells before saving."
                : dirtyKeys.length > 0
                  ? `${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? "" : "s"}`
                  : "No unsaved changes"}
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
                disabled={saving || dirtyKeys.length === 0 || invalidKeys.length > 0}
                className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save All"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
