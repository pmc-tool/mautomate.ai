"use client"

const HIDDEN_META = (k: string) => k === "tenant_id" || k === "is_sample" || k.startsWith("_")

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeftMini,
  PencilSquare,
  Trash,
  Plus,
  ExclamationCircle,
  ArchiveBox,
  MapPin,
  Component,
  ChevronRightMini,
  CircleStack,
} from "@medusajs/icons"
import { SectionCard } from "@components/merchant-admin/section-card"
import { EmptyState } from "@components/merchant-admin/empty-state"
import { Modal } from "@components/merchant-admin/modal"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { StatusBadge } from "@components/merchant-admin/status-badge"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  getInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  updateInventoryLevels,
  deleteInventoryLevel,
  listReservations,
  listStockLocations,
  InventoryItemDetail,
  InventoryLevel,
  StockLocation,
  ApiError,
} from "../../../../lib/merchant-admin/api"

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

function formatLocationAddress(a: StockLocation["address"]): string {
  if (!a) return ""
  return [a.address_1, a.city, a.country_code?.toUpperCase()].filter(Boolean).join(", ")
}

function itemDisplayName(item: InventoryItemDetail): string {
  return item.title || item.sku || "Inventory item"
}

// "{{quantity}} across {{locations}} locations" (dash when quantity undefined).
function acrossLocations(quantity: number | null | undefined, locations: number): string {
  if (quantity === null || quantity === undefined || Number.isNaN(quantity)) return "—"
  return `${quantity} across ${locations} location${locations === 1 ? "" : "s"}`
}

// ---------------------------------------------------------------------------

type EditForm = { title: string; sku: string; requires_shipping: boolean }
type AttrForm = {
  height: string
  width: string
  length: string
  weight: string
  mid_code: string
  material: string
  hs_code: string
  origin_country: string
}
type LevelForm = {
  open: boolean
  locationId: string
  locationName: string
  reserved: number
  stocked: string
}
type MetaRow = { key: string; value: string; disabled: boolean }

function toStr(n: number | null | undefined): string {
  return n === null || n === undefined || Number.isNaN(n) ? "" : String(n)
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export default function InventoryItemDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const id = params.id as string

  const [item, setItem] = useState<InventoryItemDetail | null>(null)
  const [reservationCount, setReservationCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  )
  const [busy, setBusy] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ title: "", sku: "", requires_shipping: true })
  const [editError, setEditError] = useState<string | null>(null)

  const [attrOpen, setAttrOpen] = useState(false)
  const [attrForm, setAttrForm] = useState<AttrForm>({
    height: "",
    width: "",
    length: "",
    weight: "",
    mid_code: "",
    material: "",
    hs_code: "",
    origin_country: "",
  })

  const [manageOpen, setManageOpen] = useState(false)
  const [allLocations, setAllLocations] = useState<StockLocation[]>([])
  const [locSelection, setLocSelection] = useState<Set<string>>(new Set())
  const [locSearch, setLocSearch] = useState("")

  const [levelForm, setLevelForm] = useState<LevelForm>({
    open: false,
    locationId: "",
    locationName: "",
    reserved: 0,
    stocked: "",
  })
  const [levelError, setLevelError] = useState<string | null>(null)

  const [metaOpen, setMetaOpen] = useState(false)
  const [metaRows, setMetaRows] = useState<MetaRow[]>([])

  function showMessage(type: "success" | "error" | "info", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function load(withSpinner: boolean) {
    if (!token || !id) return
    if (withSpinner) setLoading(true)
    setError(null)
    try {
      const [itemRes, resvRes] = await Promise.all([
        getInventoryItem(token, id),
        listReservations(token, { inventory_item_id: id, limit: 1 }).catch(() => null),
      ])
      setItem(itemRes.item)
      setReservationCount(resvRes ? resvRes.count : null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setError(err instanceof Error ? err.message : "Failed to load inventory item")
    } finally {
      if (withSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id])

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string): Promise<boolean> {
    if (!token) return false
    setBusy(key)
    try {
      await fn()
      showMessage("success", okMsg)
      await load(false)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return false
      }
      showMessage("error", err instanceof Error ? err.message : "Action failed")
      return false
    } finally {
      setBusy(null)
    }
  }

  // ---- General: edit item details ----
  function openEdit() {
    if (!item) return
    setEditError(null)
    setEditForm({
      title: item.title || "",
      sku: item.sku || "",
      requires_shipping: item.requires_shipping,
    })
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !item) return
    if (!editForm.sku.trim()) {
      setEditError("SKU is required.")
      return
    }
    const ok = await run(
      "save-edit",
      () =>
        updateInventoryItem(token, item.id, {
          title: editForm.title.trim() || null,
          sku: editForm.sku.trim(),
          requires_shipping: editForm.requires_shipping,
        }),
      "Inventory item updated successfully."
    )
    if (ok) setEditOpen(false)
  }

  async function handleDelete() {
    if (!token || !item) return
    if (
      !confirm(
        `Delete inventory item "${itemDisplayName(item)}"? This action cannot be undone.`
      )
    )
      return
    setBusy("del-item")
    try {
      await deleteInventoryItem(token, item.id)
      router.push("/dashboard/inventory")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      // Backend returns 400 when the item is still linked to a variant.
      showMessage("error", err instanceof Error ? err.message : "Failed to delete inventory item")
      setBusy(null)
    }
  }

  // ---- Attributes ----
  function openAttributes() {
    if (!item) return
    setAttrForm({
      height: toStr(item.height),
      width: toStr(item.width),
      length: toStr(item.length),
      weight: toStr(item.weight),
      mid_code: item.mid_code || "",
      material: item.material || "",
      hs_code: item.hs_code || "",
      origin_country: item.origin_country || "",
    })
    setAttrOpen(true)
  }

  async function saveAttributes(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !item) return
    const ok = await run(
      "save-attr",
      () =>
        updateInventoryItem(token, item.id, {
          height: parseNumberOrNull(attrForm.height),
          width: parseNumberOrNull(attrForm.width),
          length: parseNumberOrNull(attrForm.length),
          weight: parseNumberOrNull(attrForm.weight),
          mid_code: attrForm.mid_code.trim() || null,
          material: attrForm.material.trim() || null,
          hs_code: attrForm.hs_code.trim() || null,
          origin_country: attrForm.origin_country.trim() || null,
        }),
      "Inventory item updated successfully."
    )
    if (ok) setAttrOpen(false)
  }

  // ---- Manage locations ----
  async function openManageLocations() {
    if (!token || !item) return
    setBusy("open-manage")
    try {
      const res = await listStockLocations(token)
      setAllLocations(res.stock_locations || [])
      setLocSelection(new Set(item.location_levels.map((l) => l.location_id)))
      setLocSearch("")
      setManageOpen(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showMessage("error", err instanceof Error ? err.message : "Failed to load locations")
    } finally {
      setBusy(null)
    }
  }

  const filteredLocations = useMemo(() => {
    const term = locSearch.trim().toLowerCase()
    if (!term) return allLocations
    return allLocations.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        formatLocationAddress(l.address).toLowerCase().includes(term)
    )
  }, [allLocations, locSearch])

  function toggleLocation(locationId: string) {
    setLocSelection((prev) => {
      const next = new Set(prev)
      if (next.has(locationId)) next.delete(locationId)
      else next.add(locationId)
      return next
    })
  }

  async function saveManageLocations() {
    if (!token || !item) return
    const existing = new Set(item.location_levels.map((l) => l.location_id))
    const toCreate = Array.from(locSelection).filter((locId) => !existing.has(locId))
    const toDelete = Array.from(existing).filter((locId) => !locSelection.has(locId))

    setBusy("save-manage")
    try {
      if (toCreate.length > 0) {
        await updateInventoryLevels(
          token,
          item.id,
          toCreate.map((location_id) => ({ location_id, stocked_quantity: 0 }))
        )
      }
      // Delete levels one by one; a level with stock/reservations may be blocked
      // server-side, in which case its message is surfaced to the merchant.
      for (const location_id of toDelete) {
        await deleteInventoryLevel(token, item.id, location_id)
      }
      showMessage("success", "Locations updated successfully.")
      await load(false)
      setManageOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      showMessage("error", err instanceof Error ? err.message : "Failed to update locations")
      await load(false)
    } finally {
      setBusy(null)
    }
  }

  // ---- Per-location adjust quantity ----
  function openLevelEdit(level: InventoryLevel) {
    setLevelError(null)
    setLevelForm({
      open: true,
      locationId: level.location_id,
      locationName: level.location_name,
      reserved: level.reserved_quantity,
      stocked: String(level.stocked_quantity),
    })
  }

  async function saveLevel(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !item) return
    const parsed = parseNumberOrNull(levelForm.stocked)
    if (parsed === null || !Number.isInteger(parsed) || parsed < 0) {
      setLevelError("Enter a whole number of 0 or more.")
      return
    }
    if (parsed < levelForm.reserved) {
      setLevelError(
        `Stocked quantity cannot be updated to less than the reserved quantity of ${levelForm.reserved}.`
      )
      return
    }
    const ok = await run(
      "save-level",
      () =>
        updateInventoryLevels(token, item.id, [
          { location_id: levelForm.locationId, stocked_quantity: parsed },
        ]),
      "Inventory level updated successfully."
    )
    if (ok) setLevelForm((f) => ({ ...f, open: false }))
  }

  async function handleDeleteLevel(level: InventoryLevel) {
    if (!token || !item) return
    if (level.reserved_quantity > 0 || level.stocked_quantity > 0) {
      showMessage(
        "info",
        "Set stock and reservations to zero before removing this location."
      )
      return
    }
    if (!confirm("Are you sure? This action cannot be undone.")) return
    await run(
      `del-level-${level.location_id}`,
      () => deleteInventoryLevel(token, item.id, level.location_id),
      "Inventory level deleted successfully."
    )
  }

  // ---- Metadata ----
  function openMetadata() {
    if (!item) return
    const entries = Object.entries(item.metadata || {})
    const rows: MetaRow[] = entries.map(([key, value]) => {
      const isPrimitive =
        value === null ||
        ["string", "number", "boolean"].includes(typeof value)
      return {
        key,
        value: isPrimitive ? (value === null ? "" : String(value)) : JSON.stringify(value),
        disabled: !isPrimitive,
      }
    })
    if (rows.length === 0) rows.push({ key: "", value: "", disabled: false })
    setMetaRows(rows)
    setMetaOpen(true)
  }

  function updateMetaRow(idx: number, patch: Partial<MetaRow>) {
    setMetaRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function addMetaRow() {
    setMetaRows((prev) => [...prev, { key: "", value: "", disabled: false }])
  }

  function removeMetaRow(idx: number) {
    setMetaRows((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveMetadata() {
    if (!token || !item) return
    const metadata: Record<string, unknown> = {}
    // Preserve non-primitive (disabled) rows untouched from the source object.
    for (const row of metaRows) {
      if (row.disabled) {
        metadata[row.key] = (item.metadata || {})[row.key]
        continue
      }
      const key = row.key.trim()
      if (!key) continue
      metadata[key] = row.value
    }
    const ok = await run(
      "save-meta",
      () => updateInventoryItem(token, item.id, { metadata }),
      "Metadata was successfully updated."
    )
    if (ok) setMetaOpen(false)
  }

  const hasDisabledMeta = metaRows.some((r) => r.disabled)

  // ---- Render ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-32 animate-pulse rounded-base bg-grey-10" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-48 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
          <div className="space-y-6">
            <div className="h-32 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
            <div className="h-32 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/inventory")}
          className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-4 w-4" />
          Back to inventory
        </button>
        <EmptyState
          icon={ArchiveBox}
          title="Inventory item not found"
          description={
            error || "This inventory item does not exist or you do not have access to it."
          }
        />
      </div>
    )
  }

  const locationCount = item.location_levels.length
  const availableTotal = item.stocked_quantity - item.reserved_quantity

  const attrRows: { label: string; value: string }[] = [
    { label: "Height", value: toStr(item.height) || "—" },
    { label: "Width", value: toStr(item.width) || "—" },
    { label: "Length", value: toStr(item.length) || "—" },
    { label: "Weight", value: toStr(item.weight) || "—" },
    { label: "MID code", value: item.mid_code || "—" },
    { label: "Material", value: item.material || "—" },
    { label: "HS code", value: item.hs_code || "—" },
    { label: "Country of origin", value: countryName(item.origin_country) },
  ]

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push("/dashboard/inventory")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeftMini className="h-4 w-4" />
        Back to inventory
      </button>

      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-base px-4 py-3 text-sm",
            message.type === "success" && "bg-emerald-50 text-emerald-800",
            message.type === "error" && "bg-rose-50 text-rose-800",
            message.type === "info" && "bg-sky-50 text-sky-800"
          )}
        >
          {message.type === "error" && <ExclamationCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* General */}
          <SectionCard
            title={`${itemDisplayName(item)} Details`}
            icon={ArchiveBox}
            action={
              <ActionMenu
                items={[
                  { label: "Edit", icon: PencilSquare, onClick: openEdit },
                  {
                    label: busy === "del-item" ? "Deleting..." : "Delete",
                    icon: Trash,
                    destructive: true,
                    onClick: handleDelete,
                  },
                ]}
              />
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge
                status={item.requires_shipping ? "Requires shipping" : "Digital"}
              />
            </div>
            <dl className="divide-y divide-grey-10">
              <DetailRow label="SKU" value={item.sku || "—"} />
              <DetailRow
                label="In stock"
                value={acrossLocations(item.stocked_quantity, locationCount)}
              />
              <DetailRow
                label="Reserved"
                value={acrossLocations(item.reserved_quantity, locationCount)}
              />
              <DetailRow
                label="Available"
                value={acrossLocations(availableTotal, locationCount)}
              />
            </dl>
          </SectionCard>

          {/* Attributes */}
          <SectionCard
            title="Attributes"
            icon={Component}
            action={
              <ActionMenu items={[{ label: "Edit", icon: PencilSquare, onClick: openAttributes }]} />
            }
          >
            <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {attrRows.map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between gap-4 border-b border-grey-10 py-2.5 text-sm last:border-0"
                >
                  <dt className="text-grey-50">{row.label}</dt>
                  <dd className="text-right font-medium text-grey-90">{row.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          {/* Locations */}
          <SectionCard
            title="Locations"
            icon={MapPin}
            description="The locations that stock this inventory item."
            action={
              <button
                onClick={openManageLocations}
                disabled={busy === "open-manage"}
                className="inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-3 py-1.5 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
              >
                {busy === "open-manage" ? "Loading..." : "Manage locations"}
              </button>
            }
            className="p-0"
          >
            {item.location_levels.length === 0 ? (
              <div className="px-6 pb-6">
                <div className="rounded-base border border-dashed border-grey-20 p-6 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-grey-40" />
                  <p className="mt-2 text-sm font-medium text-grey-80">No locations yet</p>
                  <p className="mt-0.5 text-sm text-grey-50">
                    Add a location to start tracking stock for this item.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto px-6 pb-6">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-grey-20 text-left text-grey-50">
                      <th className="py-2.5 pr-4 font-medium">Location</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Reserved</th>
                      <th className="py-2.5 pr-4 text-right font-medium">In stock</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Available</th>
                      <th className="w-10 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {item.location_levels.map((level) => (
                      <tr key={level.location_id}>
                        <td className="py-3 pr-4 font-medium text-grey-90">
                          {level.location_name || "—"}
                        </td>
                        <td className="py-3 pr-4 text-right text-grey-70">
                          {level.reserved_quantity}
                        </td>
                        <td className="py-3 pr-4 text-right text-grey-70">
                          {level.stocked_quantity}
                        </td>
                        <td className="py-3 pr-4 text-right text-grey-70">
                          {level.available_quantity}
                        </td>
                        <td className="py-3 text-right">
                          <ActionMenu
                            items={[
                              {
                                label: "Edit",
                                icon: PencilSquare,
                                onClick: () => openLevelEdit(level),
                              },
                              {
                                label: "Delete",
                                icon: Trash,
                                destructive: true,
                                onClick: () => handleDeleteLevel(level),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Variants */}
          <SectionCard title="Associated variants" icon={CircleStack}>
            {item.variants.length === 0 ? (
              <EmptyState
                icon={CircleStack}
                title="No associated variants"
                description="This inventory item is not linked to any product variant."
                className="border-0 p-0 shadow-none"
              />
            ) : (
              <ul className="space-y-2">
                {item.variants.map((variant) => {
                  const linkable = !!variant.product_id
                  const content = (
                    <div className="flex items-center justify-between gap-3 rounded-base border border-grey-20 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-grey-90">
                          {variant.title || "Untitled variant"}
                        </p>
                        {variant.product_title && (
                          <p className="truncate text-xs text-grey-50">
                            {variant.product_title}
                          </p>
                        )}
                      </div>
                      {linkable && <ChevronRightMini className="h-5 w-5 shrink-0 text-grey-40" />}
                    </div>
                  )
                  return linkable ? (
                    <li key={variant.id}>
                      <Link
                        href={`/dashboard/products/${variant.product_id}/variants/${variant.id}`}
                        className="block transition-colors hover:[&>div]:bg-grey-10"
                      >
                        {content}
                      </Link>
                    </li>
                  ) : (
                    <li key={variant.id}>{content}</li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SectionCard title="Reservations">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-grey-90">
                  {reservationCount === null ? "—" : reservationCount}
                </p>
                <p className="mt-0.5 text-sm text-grey-50">
                  {reservationCount === 1 ? "Active reservation" : "Active reservations"}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/reservations?inventory_item_id=${item.id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
            >
              View reservations
              <ChevronRightMini className="h-4 w-4" />
            </Link>
          </SectionCard>

          <SectionCard
            title="Metadata"
            action={
              <button
                onClick={openMetadata}
                className="text-sm font-medium text-grey-60 hover:text-grey-90"
              >
                Edit
              </button>
            }
          >
            {item.metadata &&
            Object.entries(item.metadata).filter(([k]) => !HIDDEN_META(k)).length > 0 ? (
              <dl className="divide-y divide-grey-10">
                {Object.entries(item.metadata)
                  .filter(([k]) => !HIDDEN_META(k))
                  .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-grey-50">{k}</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-grey-90">
                      {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-grey-50">
                {Object.keys(item.metadata || {}).length} keys
              </p>
            )}
          </SectionCard>


        </div>
      </div>

      {/* Edit item details drawer */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit item details"
        description="Update the title, SKU and shipping requirement of this inventory item."
        size="sm"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <FormField label="Title" htmlFor="inv-title" hint="Optional">
            <Input
              id="inv-title"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Winter Jacket"
            />
          </FormField>
          <FormField label="SKU" htmlFor="inv-sku" error={editError || undefined}>
            <Input
              id="inv-sku"
              value={editForm.sku}
              onChange={(e) => {
                setEditError(null)
                setEditForm((f) => ({ ...f, sku: e.target.value }))
              }}
              placeholder="e.g. JACKET-WNT-01"
            />
          </FormField>
          <div className="rounded-base border border-grey-20 p-3">
            <FormToggle
              checked={editForm.requires_shipping}
              onChange={(v) => setEditForm((f) => ({ ...f, requires_shipping: v }))}
              label="Requires shipping"
              description="Physical items that need to be shipped to the customer."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-edit"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-edit" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Attributes drawer */}
      <Modal
        open={attrOpen}
        onClose={() => setAttrOpen(false)}
        title="Edit Attributes"
        description="Physical and customs attributes of this inventory item."
        size="md"
      >
        <form onSubmit={saveAttributes} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Height" htmlFor="attr-height" hint="Optional">
              <Input
                id="attr-height"
                type="number"
                min={0}
                value={attrForm.height}
                onChange={(e) => setAttrForm((f) => ({ ...f, height: e.target.value }))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Width" htmlFor="attr-width" hint="Optional">
              <Input
                id="attr-width"
                type="number"
                min={0}
                value={attrForm.width}
                onChange={(e) => setAttrForm((f) => ({ ...f, width: e.target.value }))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Length" htmlFor="attr-length" hint="Optional">
              <Input
                id="attr-length"
                type="number"
                min={0}
                value={attrForm.length}
                onChange={(e) => setAttrForm((f) => ({ ...f, length: e.target.value }))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Weight" htmlFor="attr-weight" hint="Optional">
              <Input
                id="attr-weight"
                type="number"
                min={0}
                value={attrForm.weight}
                onChange={(e) => setAttrForm((f) => ({ ...f, weight: e.target.value }))}
                placeholder="0"
              />
            </FormField>
          </div>
          <FormField label="MID code" htmlFor="attr-mid" hint="Optional">
            <Input
              id="attr-mid"
              value={attrForm.mid_code}
              onChange={(e) => setAttrForm((f) => ({ ...f, mid_code: e.target.value }))}
            />
          </FormField>
          <FormField label="Material" htmlFor="attr-material" hint="Optional">
            <Input
              id="attr-material"
              value={attrForm.material}
              onChange={(e) => setAttrForm((f) => ({ ...f, material: e.target.value }))}
            />
          </FormField>
          <FormField label="HS code" htmlFor="attr-hs" hint="Optional">
            <Input
              id="attr-hs"
              value={attrForm.hs_code}
              onChange={(e) => setAttrForm((f) => ({ ...f, hs_code: e.target.value }))}
            />
          </FormField>
          <FormField label="Country of origin" htmlFor="attr-country" hint="Optional">
            <CountrySelect
              value={attrForm.origin_country}
              onChange={(code) => setAttrForm((f) => ({ ...f, origin_country: code }))}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAttrOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-attr"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-attr" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage locations drawer */}
      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage locations"
        description="Select locations that stock the item."
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-base border border-grey-20">
            <div className="flex justify-between gap-4 border-b border-grey-10 px-3 py-2 text-sm">
              <span className="text-grey-50">Title</span>
              <span className="font-medium text-grey-90">{item.title || "—"}</span>
            </div>
            <div className="flex justify-between gap-4 px-3 py-2 text-sm">
              <span className="text-grey-50">SKU</span>
              <span className="font-medium text-grey-90">{item.sku || "—"}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-grey-70">Locations</span>
            <span className="text-xs text-grey-50">
              ({locSelection.size} of {allLocations.length} selected)
            </span>
          </div>
          <p className="-mt-2 text-xs text-grey-50">
            Enabling a location creates an inventory level for the item. Disabling one removes
            its level; locations with stock or reservations cannot be removed.
          </p>

          <Input
            placeholder="Search locations..."
            value={locSearch}
            onChange={(e) => setLocSearch(e.target.value)}
          />

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {filteredLocations.length === 0 ? (
              <p className="py-6 text-center text-sm text-grey-50">No locations found</p>
            ) : (
              filteredLocations.map((loc) => {
                const selected = locSelection.has(loc.id)
                const address = formatLocationAddress(loc.address)
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => toggleLocation(loc.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-base border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-grey-90 bg-grey-10"
                        : "border-grey-20 hover:bg-grey-10"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="mt-0.5"
                      aria-label={`Select ${loc.name}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-grey-90">
                        {loc.name}
                      </span>
                      {address && (
                        <span className="block truncate text-xs text-grey-50">{address}</span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setManageOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveManageLocations}
              disabled={busy === "save-manage"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-manage" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Adjust location quantity drawer */}
      <Modal
        open={levelForm.open}
        onClose={() => setLevelForm((f) => ({ ...f, open: false }))}
        title="Manage location quantity"
        description="Adjust the stocked quantity for this location."
        size="sm"
      >
        <form onSubmit={saveLevel} className="space-y-4">
          <div className="rounded-base border border-grey-20 text-sm">
            <SummaryRow label="Title" value={item.title || "—"} border />
            <SummaryRow label="SKU" value={item.sku || "—"} border />
            <SummaryRow label="Location" value={levelForm.locationName || "—"} border />
            <SummaryRow label="Reserved" value={String(levelForm.reserved)} border />
            <SummaryRow
              label="Available"
              value={String((parseNumberOrNull(levelForm.stocked) ?? 0) - levelForm.reserved)}
            />
          </div>
          <FormField label="In stock" htmlFor="level-stocked" error={levelError || undefined}>
            <Input
              id="level-stocked"
              type="number"
              min={0}
              step={1}
              value={levelForm.stocked}
              onChange={(e) => {
                setLevelError(null)
                setLevelForm((f) => ({ ...f, stocked: e.target.value }))
              }}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setLevelForm((f) => ({ ...f, open: false }))}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy === "save-level"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-level" ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Metadata drawer */}
      <Modal
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        title="Edit Metadata"
        description="Edit the metadata for this object."
        size="md"
      >
        <div className="space-y-4">
          {hasDisabledMeta && (
            <div className="rounded-base bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Some rows are disabled because they contain non-primitive data.
            </div>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,1fr,auto] gap-2 text-xs font-medium text-grey-50">
              <span>Key</span>
              <span>Value</span>
              <span className="w-8" />
            </div>
            {metaRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr,1fr,auto] items-center gap-2">
                <Input
                  value={row.key}
                  disabled={row.disabled}
                  onChange={(e) => updateMetaRow(idx, { key: e.target.value })}
                  placeholder="Key"
                  title={
                    row.disabled
                      ? "This row is disabled because it contains non-primitive data."
                      : undefined
                  }
                />
                <Input
                  value={row.value}
                  disabled={row.disabled}
                  onChange={(e) => updateMetaRow(idx, { value: e.target.value })}
                  placeholder="Value"
                />
                <button
                  type="button"
                  onClick={() => removeMetaRow(idx)}
                  disabled={row.disabled}
                  aria-label="Delete row"
                  className="inline-flex h-9 w-8 items-center justify-center rounded-base text-grey-50 hover:bg-grey-10 hover:text-grey-90 disabled:opacity-40"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMetaRow}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-grey-60 hover:text-grey-90"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setMetaOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveMetadata}
              disabled={busy === "save-meta"}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
            >
              {busy === "save-meta" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-grey-50">{label}</dt>
      <dd className="text-right font-medium text-grey-90">{value}</dd>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  border,
}: {
  label: string
  value: string
  border?: boolean
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 px-3 py-2",
        border && "border-b border-grey-10"
      )}
    >
      <span className="text-grey-50">{label}</span>
      <span className="font-medium text-grey-90">{value}</span>
    </div>
  )
}

function CountrySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string) => void
}) {
  const [q, setQ] = useState("")
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return COUNTRY_CODES.filter(
      (c) => !term || c.includes(term) || countryName(c).toLowerCase().includes(term)
    )
  }, [q])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search countries..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-base border border-grey-30 bg-white px-3 py-2 text-sm font-medium text-grey-70 hover:bg-grey-10"
          >
            Clear
          </button>
        )}
      </div>
      {value && (
        <p className="text-xs text-grey-50">
          Selected: <span className="font-medium text-grey-80">{countryName(value)}</span>
        </p>
      )}
      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-base border border-grey-20 p-1">
        {list.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-base px-2 py-1.5 text-left text-sm hover:bg-grey-10",
              value === c && "bg-grey-10"
            )}
          >
            <span className="text-grey-90">{countryName(c)}</span>
            <span className="text-grey-40">{c.toUpperCase()}</span>
          </button>
        ))}
        {list.length === 0 && <p className="px-2 py-2 text-sm text-grey-40">No matches.</p>}
      </div>
    </div>
  )
}
