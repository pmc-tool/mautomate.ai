"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  CubeSolid,
  ExclamationCircle,
  Funnel,
  MagnifyingGlass,
  PencilSquare,
  Plus,
  Trash,
  XMark,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { Modal } from "@components/merchant-admin/modal"
import {
  FormField,
  Input,
  Select,
  Textarea,
} from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  listReservations,
  createReservation,
  deleteReservation,
  listInventoryItems,
  getInventoryItem,
  listStockLocations,
  ReservationRow,
  StockLocation,
  ApiError,
} from "../../../lib/merchant-admin/api"

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Local structural types (kept loose so they stay compatible with the
// inventory-domain API types without importing them by name).
// ---------------------------------------------------------------------------

type InventoryItemOption = {
  id: string
  title: string | null
  sku: string | null
}

type ItemLevel = {
  location_id: string
  location_name: string | null
  stocked_quantity: number | null
  reserved_quantity: number | null
  available_quantity: number | null
}

function toItemOption(i: {
  id: string
  title?: string | null
  sku?: string | null
}): InventoryItemOption {
  return { id: i.id, title: i.title ?? null, sku: i.sku ?? null }
}

function toLevel(l: {
  location_id: string
  location_name?: string | null
  stocked_quantity?: number | null
  reserved_quantity?: number | null
  available_quantity?: number | null
}): ItemLevel {
  return {
    location_id: l.location_id,
    location_name: l.location_name ?? null,
    stocked_quantity: l.stocked_quantity ?? null,
    reserved_quantity: l.reserved_quantity ?? null,
    available_quantity: l.available_quantity ?? null,
  }
}

function levelAvailable(level: ItemLevel | null): number | null {
  if (!level) return null
  if (level.available_quantity != null) return level.available_quantity
  if (level.stocked_quantity == null) return null
  return (level.stocked_quantity ?? 0) - (level.reserved_quantity ?? 0)
}

function isOrderLinked(r: ReservationRow): boolean {
  return !!r.line_item_id || r.order_display_id != null
}

function itemLabel(i: InventoryItemOption): string {
  if (i.title && i.sku) return `${i.title} (${i.sku})`
  return i.title ?? i.sku ?? i.id
}

function formatDate(value?: string | null): string {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function OrderReservationBadge({
  displayId,
}: {
  displayId?: string | number | null
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
      Order reservation{displayId != null ? ` #${displayId}` : ""}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Create reservation modal
// ---------------------------------------------------------------------------

function CreateReservationModal({
  open,
  onClose,
  token,
  lockedItemId,
  onError401,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  token: string | null
  lockedItemId: string | null
  onError401: () => void
  onCreated: (reservation: ReservationRow) => void
}) {
  const [itemQuery, setItemQuery] = useState("")
  const [itemOptions, setItemOptions] = useState<InventoryItemOption[]>([])
  const [itemLoading, setItemLoading] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItemOption | null>(
    null
  )
  const [levels, setLevels] = useState<ItemLevel[] | null>(null)
  const [levelsLoading, setLevelsLoading] = useState(false)
  const [locationId, setLocationId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [description, setDescription] = useState("")
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const itemBoxRef = useRef<HTMLDivElement>(null)
  const levelsSeq = useRef(0)

  // Reset the form each time the modal opens; pre-select and lock the item
  // when opened from an inventory-item-filtered context.
  useEffect(() => {
    if (!open) return
    setItemQuery("")
    setItemOptions([])
    setItemOpen(false)
    setSelectedItem(null)
    setLevels(null)
    setLocationId("")
    setQuantity("")
    setDescription("")
    setQuantityError(null)
    setFormError(null)
    setSubmitting(false)

    if (!lockedItemId || !token) return
    let cancelled = false
    const seq = ++levelsSeq.current
    setLevelsLoading(true)
    getInventoryItem(token, lockedItemId)
      .then((res) => {
        if (cancelled || seq !== levelsSeq.current) return
        const opt = toItemOption(res.item)
        setSelectedItem(opt)
        setItemQuery(itemLabel(opt))
        setLevels((res.item.location_levels || []).map(toLevel))
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          onError401()
          return
        }
        if (!cancelled) {
          setFormError(
            err instanceof Error ? err.message : "Failed to load the item"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLevelsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockedItemId, token])

  // Debounced server-side item search (disabled when the item is locked).
  useEffect(() => {
    if (!open || lockedItemId || !token) return
    const t = setTimeout(async () => {
      setItemLoading(true)
      try {
        const res = await listInventoryItems(token, {
          q: itemQuery.trim() || undefined,
          limit: 20,
        })
        setItemOptions((res.items || []).map(toItemOption))
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onError401()
          return
        }
        setItemOptions([])
      } finally {
        setItemLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemQuery, lockedItemId, token])

  // Close the item dropdown when clicking outside it.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (itemBoxRef.current && !itemBoxRef.current.contains(e.target as Node)) {
        setItemOpen(false)
      }
    }
    if (itemOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [itemOpen])

  async function loadLevels(itemId: string) {
    if (!token) return
    const seq = ++levelsSeq.current
    setLevels(null)
    setLevelsLoading(true)
    try {
      const res = await getInventoryItem(token, itemId)
      if (seq !== levelsSeq.current) return
      setLevels((res.item.location_levels || []).map(toLevel))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onError401()
        return
      }
      if (seq === levelsSeq.current) {
        setFormError(
          err instanceof Error
            ? err.message
            : "Failed to load stock levels for the item"
        )
      }
    } finally {
      if (seq === levelsSeq.current) setLevelsLoading(false)
    }
  }

  function pickItem(opt: InventoryItemOption) {
    setSelectedItem(opt)
    setItemQuery(itemLabel(opt))
    setItemOpen(false)
    setLocationId("")
    setQuantityError(null)
    setFormError(null)
    loadLevels(opt.id)
  }

  function handleItemInput(value: string) {
    setItemQuery(value)
    setItemOpen(true)
    if (selectedItem && value !== itemLabel(selectedItem)) {
      setSelectedItem(null)
      setLevels(null)
      setLocationId("")
      setQuantityError(null)
    }
  }

  const level = useMemo(
    () => levels?.find((l) => l.location_id === locationId) || null,
    [levels, locationId]
  )
  const available = levelAvailable(level)
  const qtyNum = useMemo(() => {
    const trimmed = quantity.trim()
    if (trimmed === "") return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }, [quantity])

  const fieldsUnlocked = !!selectedItem && !!locationId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !selectedItem || !locationId || submitting) return
    setQuantityError(null)
    setFormError(null)

    if (!available) {
      setQuantityError("Stock location doesn't have available quantity.")
      return
    }
    if (qtyNum == null || qtyNum < 1 || qtyNum > available) {
      setQuantityError(
        `Minimum quantity is 1 and maximum quantity is ${available}`
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await createReservation(token, {
        inventory_item_id: selectedItem.id,
        location_id: locationId,
        quantity: qtyNum,
        description: description.trim() || undefined,
      })
      onCreated(res.reservation)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onError401()
        return
      }
      setFormError(
        err instanceof Error ? err.message : "Failed to create reservation"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose()
      }}
      title="Create reservation"
      description="Reserve a quantity of an inventory item at a location."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-center gap-2 rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ExclamationCircle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative" ref={itemBoxRef}>
            <FormField label="Item to reserve" htmlFor="resv-item">
              <Input
                id="resv-item"
                value={itemQuery}
                onChange={(e) => handleItemInput(e.target.value)}
                onFocus={() => {
                  if (!lockedItemId) setItemOpen(true)
                }}
                placeholder="Search by title or SKU"
                disabled={!!lockedItemId}
                autoComplete="off"
              />
            </FormField>
            {itemOpen && !lockedItemId && (
              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-large border border-grey-20 bg-white py-1 shadow-lg">
                {itemLoading ? (
                  <p className="px-3 py-2 text-sm text-grey-40">Searching...</p>
                ) : itemOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-grey-40">
                    No items found.
                  </p>
                ) : (
                  itemOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => pickItem(opt)}
                      className={cn(
                        "flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-grey-10",
                        selectedItem?.id === opt.id && "bg-grey-10"
                      )}
                    >
                      <span className="font-medium text-grey-90">
                        {opt.title ?? opt.sku ?? opt.id}
                      </span>
                      <span className="text-xs text-grey-50">
                        {opt.sku ?? "No SKU"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <FormField label="Location" htmlFor="resv-location">
            <Select
              id="resv-location"
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value)
                setQuantityError(null)
              }}
              disabled={!selectedItem || levelsLoading}
            >
              <option value="">
                {levelsLoading
                  ? "Loading locations..."
                  : selectedItem
                    ? "Select a location"
                    : "Select an item first"}
              </option>
              {(levels || []).map((l) => (
                <option key={l.location_id} value={l.location_id}>
                  {l.location_name || l.location_id}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {selectedItem && !levelsLoading && (levels?.length ?? 0) === 0 && (
          <p className="text-sm text-grey-50">
            This item is not stocked at any location yet. Add a location level
            before reserving.
          </p>
        )}

        {selectedItem && (
          <div className="rounded-base border border-grey-20 bg-grey-5 p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-grey-50">Title</dt>
                <dd className="truncate font-medium text-grey-90">
                  {selectedItem.title ?? selectedItem.sku ?? "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-grey-50">SKU</dt>
                <dd className="font-medium text-grey-90">
                  {selectedItem.sku ?? "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-grey-50">In stock</dt>
                <dd className="font-medium text-grey-90">
                  {level ? (level.stocked_quantity ?? "-") : "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-grey-50">Available</dt>
                <dd className="font-medium text-grey-90">
                  {level && available != null
                    ? available - (qtyNum && qtyNum > 0 ? qtyNum : 0)
                    : "-"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Quantity"
            htmlFor="resv-quantity"
            error={quantityError ?? undefined}
          >
            <Input
              id="resv-quantity"
              type="number"
              min={1}
              max={available ?? undefined}
              step={1}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value)
                setQuantityError(null)
              }}
              placeholder="How much do you want to reserve?"
              disabled={!fieldsUnlocked}
            />
          </FormField>
        </div>

        <FormField label="Description" htmlFor="resv-description" hint="Optional">
          <Textarea
            id="resv-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What type of reservation is this?"
            disabled={!fieldsUnlocked}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !fieldsUnlocked}
            className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded-base bg-grey-10" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ReservationsPageContent() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // URL is the single source of truth for q / filters / offset.
  const qParam = searchParams.get("q") || ""
  const locationParam = searchParams.get("location_id") || ""
  const inventoryItemParam = searchParams.get("inventory_item_id") || ""
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10)
  const offset =
    Number.isFinite(offsetRaw) && offsetRaw > 0
      ? Math.floor(offsetRaw / PAGE_SIZE) * PAGE_SIZE
      : 0

  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [locations, setLocations] = useState<StockLocation[]>([])
  const [filterItemLabel, setFilterItemLabel] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(qParam)
  const selfUrlUpdate = useRef(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReservationRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showMessage(type: "success" | "error", text: string) {
    if (messageTimer.current) clearTimeout(messageTimer.current)
    setMessage({ type, text })
    messageTimer.current = setTimeout(() => setMessage(null), 4000)
  }

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current)
    }
  }, [])

  // ---- URL helpers ----
  function updateParams(
    mutate: (p: URLSearchParams) => void,
    { resetOffset = true }: { resetOffset?: boolean } = {}
  ) {
    const p = new URLSearchParams(searchParams.toString())
    mutate(p)
    if (resetOffset) p.delete("offset")
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // ---- debounced search -> URL ----
  useEffect(() => {
    if (searchInput === qParam) return
    const t = setTimeout(() => {
      selfUrlUpdate.current = true
      updateParams((p) => {
        if (searchInput.trim()) {
          p.set("q", searchInput.trim())
        } else {
          p.delete("q")
        }
      })
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Sync input when the URL changes externally (back/forward, refresh).
  useEffect(() => {
    if (selfUrlUpdate.current) {
      selfUrlUpdate.current = false
      return
    }
    setSearchInput(qParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  // ---- data fetch (server-side pagination; keeps previous rows while fetching) ----
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const run = async () => {
      setFetching(true)
      setError(null)
      try {
        const res = await listReservations(token, {
          q: qParam || undefined,
          offset,
          limit: PAGE_SIZE,
          location_id: locationParam || undefined,
          inventory_item_id: inventoryItemParam || undefined,
        })
        if (!cancelled) {
          setReservations(res.reservations || [])
          setCount(res.count || 0)
          setLoaded(true)
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load reservations"
          )
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams, refreshKey])

  // ---- location filter options ----
  useEffect(() => {
    if (!token) return
    let cancelled = false
    listStockLocations(token)
      .then((res) => {
        if (!cancelled) setLocations(res.stock_locations || [])
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout()
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ---- inventory item filter chip label ----
  useEffect(() => {
    if (!token || !inventoryItemParam) {
      setFilterItemLabel(null)
      return
    }
    let cancelled = false
    getInventoryItem(token, inventoryItemParam)
      .then((res) => {
        if (cancelled) return
        setFilterItemLabel(
          res.item.title ?? res.item.sku ?? inventoryItemParam
        )
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        if (!cancelled) setFilterItemLabel(inventoryItemParam)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, inventoryItemParam])

  // ---- delete ----
  async function confirmDelete() {
    if (!token || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteReservation(token, deleteTarget.id)
      showMessage("success", "Reservation was successfully deleted.")
      setDeleteTarget(null)
      // If we just removed the last row of a page beyond the first, step back.
      if (reservations.length === 1 && offset > 0) {
        updateParams(
          (p) => p.set("offset", String(Math.max(0, offset - PAGE_SIZE))),
          { resetOffset: false }
        )
      } else {
        setRefreshKey((k) => k + 1)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showMessage(
        "error",
        err instanceof Error && err.message
          ? `Failed to delete reservation. ${err.message}`
          : "Failed to delete reservation"
      )
    } finally {
      setDeleting(false)
    }
  }

  function handleCreated(reservation: ReservationRow) {
    setCreateOpen(false)
    showMessage("success", "Reservation was successfully created.")
    if (inventoryItemParam) {
      setRefreshKey((k) => k + 1)
    } else {
      router.push(`/dashboard/reservations/${reservation.id}`)
    }
  }

  const hasActiveFilters =
    !!qParam || !!locationParam || !!inventoryItemParam

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < count

  const createButton = (
    <button
      onClick={() => setCreateOpen(true)}
      className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 transition-colors hover:bg-grey-10"
    >
      <Plus className="h-4 w-4" />
      Create
    </button>
  )

  const showInitialEmptyState = loaded && count === 0 && !hasActiveFilters
  const showFilteredEmptyState = loaded && count === 0 && hasActiveFilters

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Manage the reserved quantity of inventory items."
        action={createButton}
      />

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

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-base border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="shrink-0 rounded-base border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Toolbar: filters left, search right */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Funnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
              <select
                value={locationParam}
                onChange={(e) =>
                  updateParams((p) => {
                    if (e.target.value) {
                      p.set("location_id", e.target.value)
                    } else {
                      p.delete("location_id")
                    }
                  })
                }
                aria-label="Filter by location"
                className="appearance-none rounded-base border border-grey-20 bg-white py-2 pl-9 pr-8 text-sm text-grey-90 focus:border-grey-90 focus:outline-none"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {inventoryItemParam && (
              <span className="inline-flex max-w-xs items-center gap-1.5 rounded-base border border-grey-20 bg-grey-10 py-1.5 pl-3 pr-1.5 text-sm text-grey-70">
                <span className="truncate">
                  Item: {filterItemLabel ?? inventoryItemParam}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateParams((p) => p.delete("inventory_item_id"))
                  }
                  aria-label="Clear inventory item filter"
                  className="rounded-base p-0.5 text-grey-50 hover:bg-grey-20 hover:text-grey-90"
                >
                  <XMark className="h-4 w-4" />
                </button>
              </span>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("")
                  updateParams((p) => {
                    p.delete("q")
                    p.delete("location_id")
                    p.delete("inventory_item_id")
                  })
                }}
                className="inline-flex items-center gap-1 rounded-base px-2 py-2 text-sm font-medium text-grey-60 hover:text-grey-90"
              >
                <XMark className="h-4 w-4" />
                Clear all
              </button>
            )}
          </div>

          <div className="relative sm:w-64">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey-50" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search"
              className="w-full rounded-base border border-grey-20 bg-white py-2 pl-9 pr-3 text-sm text-grey-90 placeholder:text-grey-40 focus:border-grey-90 focus:outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-large border border-grey-20 bg-white shadow-borders-base">
          <div className="overflow-x-auto">
            <table
              className={cn(
                "w-full text-left text-sm transition-opacity",
                fetching && loaded && "opacity-60"
              )}
            >
              <thead className="bg-grey-10 text-grey-70">
                <tr>
                  <th className="px-4 py-3 font-medium">Order / Description</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-10">
                {!loaded && fetching ? (
                  <TableSkeletonRows />
                ) : showInitialEmptyState ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10">
                      <EmptyState
                        icon={CubeSolid}
                        title="No reservations"
                        description="Create a reservation to set aside inventory item quantities."
                        action={createButton}
                        className="border-0 bg-transparent shadow-none"
                      />
                    </td>
                  </tr>
                ) : showFilteredEmptyState ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10">
                      <EmptyState
                        icon={MagnifyingGlass}
                        title="No results"
                        description="Try adjusting the search or filters to find what you are looking for."
                        className="border-0 bg-transparent shadow-none"
                      />
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => {
                    const orderLinked = isOrderLinked(r)
                    return (
                      <tr
                        key={r.id}
                        onClick={() =>
                          router.push(`/dashboard/reservations/${r.id}`)
                        }
                        className="cursor-pointer transition-colors hover:bg-grey-5"
                      >
                        <td className="px-4 py-3">
                          {orderLinked ? (
                            <div className="space-y-1">
                              <OrderReservationBadge
                                displayId={r.order_display_id}
                              />
                              {r.description && (
                                <p className="max-w-[260px] truncate text-xs text-grey-50">
                                  {r.description}
                                </p>
                              )}
                            </div>
                          ) : r.description ? (
                            <span className="block max-w-[260px] truncate text-grey-90">
                              {r.description}
                            </span>
                          ) : (
                            <span className="text-grey-40">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.sku ? (
                            <span className="text-grey-90">{r.sku}</span>
                          ) : (
                            <span className="text-grey-40">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.location_name ? (
                            <span className="text-grey-90">
                              {r.location_name}
                            </span>
                          ) : (
                            <span className="text-grey-40">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-grey-90">
                          {r.quantity}
                        </td>
                        <td className="px-4 py-3 text-grey-90">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div
                            className="flex justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {orderLinked ? (
                              <span
                                className="pr-2 text-xs text-grey-40"
                                title="Order reservations are managed by their order and cannot be edited or deleted."
                              >
                                Managed by order
                              </span>
                            ) : (
                              <ActionMenu
                                items={[
                                  {
                                    label: "Edit",
                                    icon: PencilSquare,
                                    onClick: () =>
                                      router.push(
                                        `/dashboard/reservations/${r.id}?edit=1`
                                      ),
                                  },
                                  {
                                    label: "Delete",
                                    icon: Trash,
                                    destructive: true,
                                    onClick: () => setDeleteTarget(r),
                                  },
                                ]}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {loaded && count > 0 && (
            <div className="flex items-center justify-between border-t border-grey-10 px-4 py-3">
              <p className="text-xs text-grey-50">
                {offset + 1} — {Math.min(offset + PAGE_SIZE, count)} of {count}{" "}
                results
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateParams(
                      (p) => {
                        const next = Math.max(0, offset - PAGE_SIZE)
                        if (next === 0) {
                          p.delete("offset")
                        } else {
                          p.set("offset", String(next))
                        }
                      },
                      { resetOffset: false }
                    )
                  }
                  disabled={!canPrev || fetching}
                  aria-label="Previous page"
                  className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-grey-60">
                  {currentPage} of {totalPages} pages
                </span>
                <button
                  onClick={() =>
                    updateParams(
                      (p) => p.set("offset", String(offset + PAGE_SIZE)),
                      { resetOffset: false }
                    )
                  }
                  disabled={!canNext || fetching}
                  aria-label="Next page"
                  className="rounded-base border border-grey-20 p-1.5 text-grey-70 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        title="Are you sure?"
        size="sm"
      >
        <div className="space-y-6">
          <p className="text-sm text-grey-70">
            You are about to delete a reservation. This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create reservation */}
      <CreateReservationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        token={token}
        lockedItemId={inventoryItemParam || null}
        onError401={logout}
        onCreated={handleCreated}
      />
    </div>
  )
}

function ReservationsPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Manage the reserved quantity of inventory items."
      />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-base bg-grey-10" />
      <div className="h-96 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
    </div>
  )
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<ReservationsPageSkeleton />}>
      <ReservationsPageContent />
    </Suspense>
  )
}
