"use client"

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  CubeSolid,
  ExclamationCircle,
  PencilSquare,
  Trash,
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
  getReservation,
  updateReservation,
  deleteReservation,
  getInventoryItem,
  ReservationRow,
  ApiError,
} from "../../../../lib/merchant-admin/api"

// ---------------------------------------------------------------------------
// Local structural types (kept loose so they stay compatible with the
// inventory-domain API types without importing them by name).
// ---------------------------------------------------------------------------

type ItemLevel = {
  location_id: string
  location_name: string | null
  stocked_quantity: number | null
  reserved_quantity: number | null
  available_quantity: number | null
}

type ItemInfo = {
  id: string
  title: string | null
  sku: string | null
  levels: ItemLevel[]
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

function Card({
  title,
  action,
  children,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="rounded-large border border-grey-20 bg-white shadow-borders-base">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-grey-10 px-5 py-4">
          {typeof title === "string" ? (
            <h3 className="text-base font-semibold text-grey-90">{title}</h3>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-grey-50">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-grey-90">{value}</dd>
    </div>
  )
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
// Edit reservation modal
// ---------------------------------------------------------------------------

function EditReservationModal({
  open,
  onClose,
  token,
  reservation,
  itemTitle,
  itemSku,
  levels,
  onSaved,
  onError401,
}: {
  open: boolean
  onClose: () => void
  token: string | null
  reservation: ReservationRow
  itemTitle: string | null
  itemSku: string | null
  levels: ItemLevel[]
  onSaved: () => void
  onError401: () => void
}) {
  const [locationId, setLocationId] = useState(reservation.location_id)
  const [quantity, setQuantity] = useState(String(reservation.quantity))
  const [description, setDescription] = useState(reservation.description ?? "")
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset the form to the reservation's values each time the modal opens.
  useEffect(() => {
    if (!open) return
    setLocationId(reservation.location_id)
    setQuantity(String(reservation.quantity))
    setDescription(reservation.description ?? "")
    setQuantityError(null)
    setFormError(null)
    setSaving(false)
  }, [open, reservation])

  // Options: stock locations where the item has levels. Always include the
  // reservation's current location even if the item fetch came back empty.
  const options = useMemo(() => {
    if (levels.some((l) => l.location_id === reservation.location_id)) {
      return levels
    }
    return [
      {
        location_id: reservation.location_id,
        location_name: reservation.location_name,
        stocked_quantity: null,
        reserved_quantity: null,
        available_quantity: null,
      },
      ...levels,
    ]
  }, [levels, reservation])

  const level = useMemo(
    () => levels.find((l) => l.location_id === locationId) || null,
    [levels, locationId]
  )

  const qtyNum = useMemo(() => {
    const trimmed = quantity.trim()
    if (trimmed === "") return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }, [quantity])

  // Live summary, per Medusa: Available = stocked - (reserved - reservation
  // quantity) - entered quantity, for the currently selected location's level.
  const liveAvailable =
    level && level.stocked_quantity != null
      ? (level.stocked_quantity ?? 0) -
        ((level.reserved_quantity ?? 0) - reservation.quantity) -
        (qtyNum && qtyNum > 0 ? qtyNum : 0)
      : null

  const maxQuantity =
    level != null
      ? (levelAvailable(level) ?? 0) + reservation.quantity
      : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || saving) return
    setQuantityError(null)
    setFormError(null)

    if (qtyNum == null || qtyNum < 1) {
      setQuantityError(
        maxQuantity != null
          ? `Minimum quantity is 1 and maximum quantity is ${maxQuantity}`
          : "Minimum quantity is 1"
      )
      return
    }
    if (maxQuantity != null && qtyNum > maxQuantity) {
      setQuantityError(
        `Minimum quantity is 1 and maximum quantity is ${maxQuantity}`
      )
      return
    }

    setSaving(true)
    try {
      await updateReservation(token, reservation.id, {
        location_id: locationId,
        quantity: qtyNum,
        description: description.trim() ? description.trim() : null,
      })
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onError401()
        return
      }
      setFormError(
        err instanceof Error ? err.message : "Failed to update reservation"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose()
      }}
      title="Edit reservation"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-center gap-2 rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ExclamationCircle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        <FormField label="Location" htmlFor="resv-edit-location">
          <Select
            id="resv-edit-location"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setQuantityError(null)
            }}
          >
            {options.map((l) => (
              <option key={l.location_id} value={l.location_id}>
                {l.location_name || l.location_id}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="rounded-base border border-grey-20 bg-grey-5 p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-grey-50">Title</dt>
              <dd className="truncate font-medium text-grey-90">
                {itemTitle ?? itemSku ?? "-"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-grey-50">SKU</dt>
              <dd className="font-medium text-grey-90">{itemSku ?? "-"}</dd>
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
                {liveAvailable ?? "-"}
              </dd>
            </div>
          </dl>
        </div>

        <FormField
          label="Reserve amount"
          htmlFor="resv-edit-quantity"
          error={quantityError ?? undefined}
        >
          <Input
            id="resv-edit-quantity"
            type="number"
            min={0}
            max={maxQuantity}
            step={1}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value)
              setQuantityError(null)
            }}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="resv-edit-description"
          hint="Optional"
        >
          <Textarea
            id="resv-edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What type of reservation is this?"
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ReservationDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [reservation, setReservation] = useState<ReservationRow | null>(null)
  const [item, setItem] = useState<ItemInfo | null>(null)
  const [itemLoading, setItemLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoEditDone = useRef(false)

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

  async function load(withSpinner: boolean) {
    if (!token || !id) return
    if (withSpinner) setLoading(true)
    setError(null)
    try {
      const res = await getReservation(token, id)
      setReservation(res.reservation)
      // The reservation payload does not populate the item's stock levels, so
      // the item is fetched separately for the level rows and the sidebar.
      setItemLoading(true)
      try {
        const itemRes = await getInventoryItem(
          token,
          res.reservation.inventory_item_id
        )
        setItem({
          id: itemRes.item.id,
          title: itemRes.item.title ?? null,
          sku: itemRes.item.sku ?? null,
          levels: (itemRes.item.location_levels || []).map(toLevel),
        })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        // Non-fatal: the general section falls back to the reservation's own
        // denormalized fields and renders placeholders for level numbers.
        setItem(null)
      } finally {
        setItemLoading(false)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(
        err instanceof Error ? err.message : "Failed to load reservation"
      )
    } finally {
      if (withSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  // Open the edit modal when navigated with ?edit=1 (from the list row menu).
  useEffect(() => {
    if (autoEditDone.current || !reservation) return
    if (searchParams.get("edit") && !isOrderLinked(reservation)) {
      setEditOpen(true)
    }
    autoEditDone.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation, searchParams])

  async function confirmDelete() {
    if (!token || !reservation) return
    setDeleting(true)
    try {
      await deleteReservation(token, reservation.id)
      router.push("/dashboard/reservations")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setDeleteOpen(false)
      setDeleting(false)
      showMessage(
        "error",
        err instanceof Error && err.message
          ? `Failed to delete reservation. ${err.message}`
          : "Failed to delete reservation"
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reservation" description="Loading..." />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-16 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
      </div>
    )
  }

  if (error || !reservation) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/reservations")}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to reservations
        </button>
        <PageHeader
          title="Reservation"
          description="We could not load this reservation."
        />
        <EmptyState
          icon={ExclamationCircle}
          title="Reservation not found"
          description={
            error ||
            "This reservation does not exist or you do not have access to it."
          }
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

  const orderLinked = isOrderLinked(reservation)
  const itemName =
    item?.title ??
    reservation.item_title ??
    item?.sku ??
    reservation.sku ??
    reservation.inventory_item_id
  const sku = item?.sku ?? reservation.sku ?? null

  const level =
    item?.levels.find((l) => l.location_id === reservation.location_id) || null

  const totalStocked =
    item?.levels.reduce((sum, l) => sum + (l.stocked_quantity ?? 0), 0) ?? null
  const totalReserved =
    item?.levels.reduce((sum, l) => sum + (l.reserved_quantity ?? 0), 0) ?? null
  const totalAvailable =
    totalStocked != null && totalReserved != null
      ? totalStocked - totalReserved
      : null
  const locationCount = item?.levels.length ?? 0
  const acrossLocations = (value: number | null) =>
    value != null
      ? `${value} across ${locationCount} location${locationCount === 1 ? "" : "s"}`
      : "-"

  const orderHref =
    reservation.order_id != null
      ? `/dashboard/orders/${reservation.order_id}`
      : reservation.order_display_id != null
        ? `/dashboard/orders?q=${encodeURIComponent(String(reservation.order_display_id))}`
        : null

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/reservations")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to reservations
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
            <ExclamationCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* General section */}
          <Card
            title={
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-base font-semibold text-grey-90">
                  Reservation of {itemName}
                </h1>
                {orderLinked && (
                  <OrderReservationBadge
                    displayId={reservation.order_display_id}
                  />
                )}
              </div>
            }
            action={
              orderLinked ? (
                <span
                  className="text-xs text-grey-40"
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
                      onClick: () => setEditOpen(true),
                    },
                    {
                      label: "Delete",
                      icon: Trash,
                      destructive: true,
                      onClick: () => setDeleteOpen(true),
                    },
                  ]}
                />
              )
            }
          >
            <dl className="divide-y divide-grey-10">
              <Row
                label="Item"
                value={
                  <Link
                    href={`/dashboard/inventory/${reservation.inventory_item_id}`}
                    className="text-grey-90 underline decoration-grey-30 underline-offset-2 hover:decoration-grey-90"
                  >
                    {itemName}
                  </Link>
                }
              />
              <Row
                label="SKU"
                value={sku ?? <span className="text-grey-40">-</span>}
              />
              <Row
                label="Location"
                value={
                  reservation.location_name ?? (
                    <span className="text-grey-40">-</span>
                  )
                }
              />
              <Row label="Quantity" value={reservation.quantity} />
              <Row
                label="Description"
                value={
                  reservation.description ? (
                    <span className="break-words">
                      {reservation.description}
                    </span>
                  ) : (
                    <span className="text-grey-40">-</span>
                  )
                }
              />
              {orderLinked && (
                <Row
                  label="Order"
                  value={
                    orderHref ? (
                      <Link
                        href={orderHref}
                        className="text-grey-90 underline decoration-grey-30 underline-offset-2 hover:decoration-grey-90"
                      >
                        {reservation.order_display_id != null
                          ? `#${reservation.order_display_id}`
                          : "View order"}
                      </Link>
                    ) : (
                      <span className="text-grey-40">-</span>
                    )
                  }
                />
              )}
              <Row
                label="In stock at this location"
                value={
                  itemLoading
                    ? "Loading..."
                    : (level?.stocked_quantity ?? (
                        <span className="text-grey-40">-</span>
                      ))
                }
              />
              <Row
                label="Available at this location"
                value={
                  itemLoading
                    ? "Loading..."
                    : (levelAvailable(level) ?? (
                        <span className="text-grey-40">-</span>
                      ))
                }
              />
              <Row
                label="Reserved at this location"
                value={
                  itemLoading
                    ? "Loading..."
                    : (level?.reserved_quantity ?? (
                        <span className="text-grey-40">-</span>
                      ))
                }
              />
              <Row label="Created" value={formatDate(reservation.created_at)} />
            </dl>
          </Card>

          {/* Metadata */}
          {reservation.metadata &&
            Object.keys(reservation.metadata).length > 0 && (
              <Card title="Metadata">
                <dl className="divide-y divide-grey-10">
                  {Object.entries(reservation.metadata).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 py-2 text-sm"
                    >
                      <dt className="text-grey-50">{k}</dt>
                      <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

          {/* JSON */}
          <Card bodyClassName="p-0">
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-grey-70 hover:text-grey-90"
            >
              Raw reservation data (JSON)
              <span className="text-grey-40">{showJson ? "Hide" : "Show"}</span>
            </button>
            {showJson && (
              <pre className="max-h-96 overflow-auto border-t border-grey-10 bg-grey-10 px-5 py-4 text-xs text-grey-70">
                {JSON.stringify(reservation, null, 2)}
              </pre>
            )}
          </Card>
        </div>

        {/* Sidebar: inventory item card */}
        <div className="space-y-6">
          <Card
            title={
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-base bg-grey-10 text-grey-50">
                  <CubeSolid className="h-4 w-4" />
                </div>
                <h3 className="truncate text-base font-semibold text-grey-90">
                  {itemName}
                </h3>
              </div>
            }
          >
            {itemLoading ? (
              <div className="space-y-2">
                <div className="h-4 animate-pulse rounded-base bg-grey-10" />
                <div className="h-4 animate-pulse rounded-base bg-grey-10" />
                <div className="h-4 animate-pulse rounded-base bg-grey-10" />
              </div>
            ) : item ? (
              <>
                <dl className="divide-y divide-grey-10">
                  <Row
                    label="SKU"
                    value={
                      item.sku ?? <span className="text-grey-40">-</span>
                    }
                  />
                  <Row label="In stock" value={acrossLocations(totalStocked)} />
                  <Row
                    label="Reserved"
                    value={acrossLocations(totalReserved)}
                  />
                  <Row
                    label="Available"
                    value={acrossLocations(totalAvailable)}
                  />
                </dl>
                <Link
                  href={`/dashboard/inventory/${item.id}`}
                  className="mt-4 inline-flex items-center rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10"
                >
                  View inventory item
                </Link>
              </>
            ) : (
              <p className="text-sm text-grey-50">
                Could not load the inventory item for this reservation.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <EditReservationModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        token={token}
        reservation={reservation}
        itemTitle={item?.title ?? reservation.item_title ?? null}
        itemSku={sku}
        levels={item?.levels ?? []}
        onSaved={() => {
          setEditOpen(false)
          showMessage("success", "Reservation was successfully updated.")
          load(false)
        }}
        onError401={logout}
      />

      {/* Delete confirmation */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false)
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
              onClick={() => setDeleteOpen(false)}
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
    </div>
  )
}

function ReservationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reservation" description="Loading..." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          <div className="h-16 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
        </div>
        <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
      </div>
    </div>
  )
}

export default function ReservationDetailPage() {
  return (
    <Suspense fallback={<ReservationDetailSkeleton />}>
      <ReservationDetailContent />
    </Suspense>
  )
}
