"use client"

import React, { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftMini,
  CubeSolid,
  ExclamationCircle,
  MapPin,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  listInventoryItems,
  getInventoryItem,
  updateInventoryLevels,
  listStockLocations,
  InventoryItemDetail,
  StockLocation,
  ApiError,
} from "../../../../lib/merchant-admin/api"

// Safety cap when the page is opened without an explicit selection: we page
// through the tenant's items but never load more than this many into the grid.
const MAX_ITEMS = 500
const LIST_BATCH = 100
const DETAIL_CONCURRENCY = 8

function cellKey(itemId: string, locationId: string): string {
  return `${itemId}|${locationId}`
}

/**
 * Parses a quantity input value. Empty string counts as 0 (clearing a cell
 * sets the level to zero). Returns null for anything that is not a
 * non-negative integer so the cell can be flagged invalid.
 */
function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return 0
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

function InventoryStockPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, logout } = useMerchantAuth()

  const idsParam = searchParams.get("inventory_item_ids") || ""
  const selectedIds = useMemo(
    () =>
      idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [idsParam]
  )

  const [items, setItems] = useState<InventoryItemDetail[]>([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Cell state: values are the raw input strings, initial holds the loaded
  // numbers so dirty cells can be diffed and only those get submitted.
  const [values, setValues] = useState<Record<string, string>>({})
  const [initial, setInitial] = useState<Record<string, number>>({})
  const [reserved, setReserved] = useState<Record<string, number>>({})

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  async function resolveItemIds(tk: string): Promise<string[]> {
    if (selectedIds.length > 0) return selectedIds
    const collected: string[] = []
    let offset = 0
    for (;;) {
      const res = await listInventoryItems(tk, { offset, limit: LIST_BATCH })
      const batch = res.items || []
      for (const item of batch) collected.push(item.id)
      offset += LIST_BATCH
      const total = res.count || 0
      if (
        batch.length === 0 ||
        collected.length >= total ||
        collected.length >= MAX_ITEMS
      ) {
        break
      }
    }
    return collected.slice(0, MAX_ITEMS)
  }

  async function fetchDetails(
    tk: string,
    ids: string[]
  ): Promise<{ details: InventoryItemDetail[]; failed: number }> {
    const details: InventoryItemDetail[] = []
    let failed = 0
    for (let i = 0; i < ids.length; i += DETAIL_CONCURRENCY) {
      const chunk = await Promise.all(
        ids.slice(i, i + DETAIL_CONCURRENCY).map(async (id) => {
          try {
            const res = await getInventoryItem(tk, id)
            return res.item
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) throw err
            failed += 1
            return null
          }
        })
      )
      for (const item of chunk) {
        if (item) details.push(item)
      }
    }
    return { details, failed }
  }

  function applyData(details: InventoryItemDetail[], locs: StockLocation[]) {
    const nextInitial: Record<string, number> = {}
    const nextValues: Record<string, string> = {}
    const nextReserved: Record<string, number> = {}
    for (const item of details) {
      for (const loc of locs) {
        const key = cellKey(item.id, loc.id)
        const level = (item.location_levels || []).find(
          (l) => l.location_id === loc.id
        )
        const qty = level ? level.stocked_quantity : 0
        nextInitial[key] = qty
        nextValues[key] = String(qty)
        nextReserved[key] = level ? level.reserved_quantity : 0
      }
    }
    setInitial(nextInitial)
    setValues(nextValues)
    setReserved(nextReserved)
    setItems(details)
    setLocations(locs)
  }

  async function load(withSpinner: boolean) {
    if (!token) return
    if (withSpinner) setLoading(true)
    setError(null)
    setLoadWarning(null)
    try {
      const [locRes, ids] = await Promise.all([
        listStockLocations(token),
        resolveItemIds(token),
      ])
      const { details, failed } = await fetchDetails(token, ids)
      applyData(details, locRes.stock_locations || [])
      if (failed > 0) {
        setLoadWarning(
          `${failed} item${failed === 1 ? "" : "s"} could not be loaded and ${
            failed === 1 ? "is" : "are"
          } not shown in the grid.`
        )
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(
        err instanceof Error ? err.message : "Failed to load inventory levels"
      )
    } finally {
      if (withSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, idsParam])

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
      const parsed = parseQuantity(values[key] ?? "")
      if (parsed === null) {
        keys.push(key)
        continue
      }
      // A stocked quantity below the reserved quantity is rejected server-side;
      // flag it inline instead of failing on save.
      if (parsed < (reserved[key] ?? 0)) keys.push(key)
    }
    return keys
  }, [values, initial, reserved])

  function setCell(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!token || saving) return
    if (invalidKeys.length > 0) {
      showMessage(
        "error",
        "Fix the highlighted cells before saving. Quantities must be whole numbers of 0 or more and not below the reserved quantity."
      )
      return
    }
    if (dirtyKeys.length === 0) return

    // Group dirty cells per inventory item; each item gets one levels call.
    const updatesByItem = new Map<
      string,
      { location_id: string; stocked_quantity: number }[]
    >()
    for (const key of dirtyKeys) {
      const sep = key.indexOf("|")
      const itemId = key.slice(0, sep)
      const locationId = key.slice(sep + 1)
      const list = updatesByItem.get(itemId) || []
      list.push({
        location_id: locationId,
        stocked_quantity: parseQuantity(values[key] ?? "")!,
      })
      updatesByItem.set(itemId, list)
    }

    setSaving(true)
    const failures: string[] = []
    try {
      for (const [itemId, updates] of updatesByItem.entries()) {
        try {
          await updateInventoryLevels(token, itemId, updates)
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            logout()
            return
          }
          const item = items.find((i) => i.id === itemId)
          const label = item?.title || item?.sku || itemId
          failures.push(
            `${label}: ${err instanceof Error ? err.message : "unknown error"}`
          )
        }
      }
      if (failures.length === 0) {
        showMessage("success", "Inventory levels updated successfully.")
      } else {
        showMessage(
          "error",
          `Failed to update ${failures.length} item${
            failures.length === 1 ? "" : "s"
          }: ${failures.join("; ")}`
        )
      }
      await load(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (dirtyKeys.length > 0 && !confirm("Discard unsaved stock changes?")) {
      return
    }
    router.push("/dashboard/inventory")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Edit stock levels"
          description="Loading inventory levels..."
        />
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
          onClick={() => router.push("/dashboard/inventory")}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to inventory
        </button>
        <PageHeader
          title="Edit stock levels"
          description="We could not load inventory levels."
        />
        <EmptyState
          icon={ExclamationCircle}
          title="Failed to load inventory levels"
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
  const scoped = selectedIds.length > 0

  return (
    <div className="space-y-6">
      <button
        onClick={handleCancel}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to inventory
      </button>

      <PageHeader
        title="Edit stock levels"
        description={
          scoped
            ? "Update the stocked inventory levels for the selected inventory items."
            : "Update the stocked inventory levels for your inventory items."
        }
        action={
          scoped ? (
            <Link
              href="/dashboard/inventory/stock"
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Edit all items
            </Link>
          ) : undefined
        }
      />

      {scoped && (
        <p className="text-sm text-grey-50">
          Editing {items.length} selected item{items.length === 1 ? "" : "s"}.
        </p>
      )}

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800"
          )}
        >
          {message.type === "error" && (
            <ExclamationCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {loadWarning && (
        <div className="rounded-base border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {loadWarning}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={CubeSolid}
          title="No inventory items"
          description="There are no inventory items to edit stock levels for."
          action={
            <Link
              href="/dashboard/inventory"
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Back to inventory
            </Link>
          }
        />
      ) : noLocations ? (
        <EmptyState
          icon={MapPin}
          title="No stock locations"
          description="Create a stock location to start tracking inventory."
          action={
            <Link
              href="/dashboard/settings/locations"
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80"
            >
              Go to locations
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
                    <th className="px-5 py-3 text-left font-medium text-grey-50">
                      Item
                    </th>
                    {locations.map((loc) => (
                      <th
                        key={loc.id}
                        className="whitespace-nowrap px-5 py-3 text-left font-medium text-grey-50"
                      >
                        {loc.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-10">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-5 py-3">
                        <p
                          className="max-w-[240px] truncate font-medium text-grey-90"
                          title={item.title || undefined}
                        >
                          {item.title || "-"}
                        </p>
                        <p className="mt-0.5 text-xs text-grey-50">
                          {item.sku || "No SKU"}
                        </p>
                      </td>
                      {locations.map((loc) => {
                        const key = cellKey(item.id, loc.id)
                        const raw = values[key] ?? ""
                        const parsed = parseQuantity(raw)
                        const cellReserved = reserved[key] ?? 0
                        const invalid =
                          parsed === null || parsed < cellReserved
                        const dirty =
                          parsed !== null && parsed !== initial[key]
                        return (
                          <td key={loc.id} className="px-5 py-3">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={raw}
                              disabled={saving}
                              onChange={(e) => setCell(key, e.target.value)}
                              title={
                                invalid && parsed !== null
                                  ? `Stocked quantity cannot be less than the reserved quantity of ${cellReserved}.`
                                  : undefined
                              }
                              aria-label={`Stocked quantity for ${
                                item.title || item.sku || "item"
                              } at ${loc.name}`}
                              className={cn(
                                "w-24 rounded-base border bg-white px-2 py-1.5 text-right text-sm text-grey-90 outline-none transition-colors focus:border-grey-50 disabled:cursor-not-allowed disabled:bg-grey-10 disabled:text-grey-40",
                                invalid
                                  ? "border-rose-400"
                                  : dirty
                                    ? "border-blue-500"
                                    : "border-grey-20"
                              )}
                            />
                            <p className="mt-1 text-xs text-grey-40">
                              {cellReserved} reserved
                            </p>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-grey-50">
              {invalidKeys.length > 0
                ? "Fix the highlighted cells before saving."
                : dirtyKeys.length > 0
                  ? `${dirtyKeys.length} unsaved change${
                      dirtyKeys.length === 1 ? "" : "s"
                    }`
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
                disabled={
                  saving || dirtyKeys.length === 0 || invalidKeys.length > 0
                }
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

function InventoryStockPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit stock levels"
        description="Loading inventory levels..."
      />
      <div className="h-96 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
    </div>
  )
}

export default function InventoryStockPage() {
  return (
    <Suspense fallback={<InventoryStockPageSkeleton />}>
      <InventoryStockPageContent />
    </Suspense>
  )
}
