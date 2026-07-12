"use client"

import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  CubeSolid,
  ExclamationCircle,
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
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  listInventoryItems,
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryLevels,
  listStockLocations,
  InventoryItemRow,
  CreateInventoryItemPayload,
  StockLocation,
  ApiError,
} from "../../../lib/merchant-admin/api"

const PAGE_SIZE = 20

// A broad ISO-3166-1 alpha-2 list; names rendered via Intl.DisplayNames.
const COUNTRY_CODES =
  "us ca gb au nz ie de fr es it nl be pt ch at se no dk fi pl cz sk hu ro bg gr hr si ee lv lt lu is mt cy in bd pk lk np sg my th vn ph id jp kr cn hk tw ae sa qa kw bh om il tr eg za ng ke gh ma dz tn br mx ar cl co pe uy ec ve bo py cr pa gt do jm tt ru ua by kz ge am az".split(
    " "
  )

function countryName(code: string): string {
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "region" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function buildCountryOptions(): { value: string; label: string }[] {
  return COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code) })).sort(
    (a, b) => a.label.localeCompare(b.label)
  )
}

const primaryBtn =
  "inline-flex items-center gap-1.5 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
const secondaryBtn =
  "inline-flex items-center gap-1.5 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:cursor-not-allowed disabled:opacity-50"
const dangerBtn =
  "inline-flex items-center rounded-base bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"

function Placeholder() {
  return <span className="text-grey-40">-</span>
}

function QuantityCell({ value }: { value: number | null | undefined }) {
  const n = Number(value)
  if (!Number.isFinite(n)) return <Placeholder />
  return <span className="tabular-nums text-grey-90">{n}</span>
}

// ---------------------------------------------------------------------------
// Create Inventory Item modal (two-step wizard: Details -> Availability)
// ---------------------------------------------------------------------------

type CreateStep = "details" | "availability"

type CreateFormState = {
  title: string
  sku: string
  description: string
  requires_shipping: boolean
  width: string
  length: string
  height: string
  weight: string
  mid_code: string
  hs_code: string
  origin_country: string
  material: string
}

const EMPTY_CREATE_FORM: CreateFormState = {
  title: "",
  sku: "",
  description: "",
  requires_shipping: true,
  width: "",
  length: "",
  height: "",
  weight: "",
  mid_code: "",
  hs_code: "",
  origin_country: "",
  material: "",
}

const DIM_FIELDS: { key: "width" | "length" | "height" | "weight"; label: string }[] = [
  { key: "width", label: "Width" },
  { key: "length", label: "Length" },
  { key: "height", label: "Height" },
  { key: "weight", label: "Weight" },
]

/**
 * Parses an optional non-negative integer field. Returns undefined for an
 * empty string (field not provided), null when the value is invalid, and the
 * parsed number otherwise.
 */
function parseOptionalInt(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

function CreateInventoryItemModal({
  open,
  onClose,
  token,
  logout,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  token: string | null
  logout: () => void
  onCreated: (warning: string | null) => void
}) {
  const [step, setStep] = useState<CreateStep>("details")
  const [form, setForm] = useState<CreateFormState>(EMPTY_CREATE_FORM)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [locations, setLocations] = useState<StockLocation[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string | null>(null)

  const countryOptions = useMemo(buildCountryOptions, [])

  // Reset the wizard and load stock locations each time the modal opens.
  useEffect(() => {
    if (!open) return
    setStep("details")
    setForm(EMPTY_CREATE_FORM)
    setQuantities({})
    setErrors({})
    setFormError(null)
    setSaving(false)
    if (!token) return
    let cancelled = false
    const run = async () => {
      setLocationsLoading(true)
      setLocationsError(null)
      try {
        const res = await listStockLocations(token)
        if (!cancelled) setLocations(res.stock_locations || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        if (!cancelled) {
          setLocationsError(
            err instanceof Error ? err.message : "Failed to load stock locations"
          )
        }
      } finally {
        if (!cancelled) setLocationsLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token])

  function setField<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validateDetails(): boolean {
    const next: Record<string, string> = {}
    if (!form.title.trim()) {
      next.title = "Title is required."
    }
    for (const dim of DIM_FIELDS) {
      if (parseOptionalInt(form[dim.key]) === null) {
        next[dim.key] = "Enter a whole number of 0 or more."
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function validateAvailability(): boolean {
    for (const value of Object.values(quantities)) {
      if (parseOptionalInt(value) === null) return false
    }
    return true
  }

  function goToStep(next: CreateStep) {
    if (next === step) return
    if (next === "availability" && !validateDetails()) return
    setStep(next)
  }

  async function handleSave() {
    if (!token || saving) return
    setFormError(null)
    if (!validateDetails()) {
      setStep("details")
      return
    }
    if (!validateAvailability()) {
      setFormError("Enter a whole number of 0 or more in every location quantity.")
      return
    }

    const payload: CreateInventoryItemPayload = {
      title: form.title.trim(),
      requires_shipping: form.requires_shipping,
    }
    if (form.sku.trim()) payload.sku = form.sku.trim()
    if (form.description.trim()) payload.description = form.description.trim()
    if (form.mid_code.trim()) payload.mid_code = form.mid_code.trim()
    if (form.hs_code.trim()) payload.hs_code = form.hs_code.trim()
    if (form.origin_country) payload.origin_country = form.origin_country
    if (form.material.trim()) payload.material = form.material.trim()
    for (const dim of DIM_FIELDS) {
      const parsed = parseOptionalInt(form[dim.key])
      if (typeof parsed === "number") payload[dim.key] = parsed
    }

    setSaving(true)
    let itemId: string
    try {
      const res = await createInventoryItem(token, payload)
      itemId = res.item.id
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
        return
      }
      setFormError(
        err instanceof Error ? err.message : "Failed to create inventory item"
      )
      setSaving(false)
      return
    }

    // The item exists at this point; a level failure should not block closing.
    const updates = Object.entries(quantities)
      .map(([location_id, raw]) => ({ location_id, parsed: parseOptionalInt(raw) }))
      .filter((u): u is { location_id: string; parsed: number } => typeof u.parsed === "number")
      .map((u) => ({ location_id: u.location_id, stocked_quantity: u.parsed }))

    let warning: string | null = null
    if (updates.length > 0) {
      try {
        await updateInventoryLevels(token, itemId, updates)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout()
          return
        }
        warning = `Inventory item was created, but stock levels could not be saved: ${
          err instanceof Error ? err.message : "unknown error"
        }`
      }
    }

    setSaving(false)
    onCreated(warning)
  }

  const stepPill = (target: CreateStep, index: number, label: string) => {
    const active = step === target
    const completed = target === "details" && step === "availability"
    return (
      <button
        type="button"
        onClick={() => goToStep(target)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "border-grey-90 bg-grey-90 text-white"
            : completed
              ? "border-grey-30 bg-grey-10 text-grey-90"
              : "border-grey-20 bg-white text-grey-50 hover:text-grey-90"
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-xs",
            active ? "bg-white text-grey-90" : "bg-grey-20 text-grey-70"
          )}
        >
          {index}
        </span>
        {label}
      </button>
    )
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose()
      }}
      title="Create Inventory Item"
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          {stepPill("details", 1, "Details")}
          <span className="h-px w-6 bg-grey-20" />
          {stepPill("availability", 2, "Availability")}
        </div>

        {formError && (
          <div className="flex items-center gap-2 rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ExclamationCircle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        {step === "details" ? (
          <div className="max-h-[55vh] space-y-6 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Title" error={errors.title} htmlFor="inv-create-title">
                <Input
                  id="inv-create-title"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Title"
                  disabled={saving}
                />
              </FormField>
              <FormField label="SKU" htmlFor="inv-create-sku">
                <Input
                  id="inv-create-sku"
                  value={form.sku}
                  onChange={(e) => setField("sku", e.target.value)}
                  placeholder="sku-123"
                  disabled={saving}
                />
              </FormField>
            </div>

            <FormField label="Description" htmlFor="inv-create-description">
              <Textarea
                id="inv-create-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="The item description"
                disabled={saving}
              />
            </FormField>

            <div className="rounded-base border border-grey-20 p-4">
              <FormToggle
                checked={form.requires_shipping}
                onChange={(v) => setField("requires_shipping", v)}
                label="Requires shipping"
                description="Does the inventory item require shipping?"
              />
            </div>

            <div className="border-t border-grey-10 pt-5">
              <h3 className="mb-4 text-base font-semibold text-grey-90">Attributes</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {DIM_FIELDS.map((dim) => (
                  <FormField
                    key={dim.key}
                    label={dim.label}
                    error={errors[dim.key]}
                    htmlFor={`inv-create-${dim.key}`}
                  >
                    <Input
                      id={`inv-create-${dim.key}`}
                      type="number"
                      min={0}
                      step={1}
                      value={form[dim.key]}
                      onChange={(e) => setField(dim.key, e.target.value)}
                      placeholder="100"
                      disabled={saving}
                    />
                  </FormField>
                ))}
                <FormField label="Mid code" htmlFor="inv-create-mid-code">
                  <Input
                    id="inv-create-mid-code"
                    value={form.mid_code}
                    onChange={(e) => setField("mid_code", e.target.value)}
                    disabled={saving}
                  />
                </FormField>
                <FormField label="HS code" htmlFor="inv-create-hs-code">
                  <Input
                    id="inv-create-hs-code"
                    value={form.hs_code}
                    onChange={(e) => setField("hs_code", e.target.value)}
                    disabled={saving}
                  />
                </FormField>
                <FormField label="Country of origin" htmlFor="inv-create-origin-country">
                  <Select
                    id="inv-create-origin-country"
                    value={form.origin_country}
                    onChange={(e) => setField("origin_country", e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select country</option>
                    {countryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Material" htmlFor="inv-create-material">
                  <Input
                    id="inv-create-material"
                    value={form.material}
                    onChange={(e) => setField("material", e.target.value)}
                    disabled={saving}
                  />
                </FormField>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            <p className="text-sm text-grey-50">
              Set the stocked quantity for this item at each of your locations.
              Locations left empty are not enabled for this item.
            </p>
            {locationsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-base bg-grey-10" />
                ))}
              </div>
            ) : locationsError ? (
              <div className="rounded-base bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {locationsError}
              </div>
            ) : locations.length === 0 ? (
              <div className="rounded-base border border-grey-20 bg-grey-5 px-4 py-6 text-center text-sm text-grey-50">
                No stock locations found. Create a location first to manage
                availability.
              </div>
            ) : (
              <div className="overflow-hidden rounded-base border border-grey-20">
                <table className="w-full text-left text-sm">
                  <thead className="bg-grey-10 text-grey-70">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Locations</th>
                      <th className="w-40 px-4 py-2.5 font-medium">In stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-10">
                    {locations.map((loc) => {
                      const raw = quantities[loc.id] ?? ""
                      const invalid = parseOptionalInt(raw) === null
                      return (
                        <tr key={loc.id}>
                          <td className="px-4 py-2.5 text-grey-90">{loc.name}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={raw}
                              disabled={saving}
                              onChange={(e) =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [loc.id]: e.target.value,
                                }))
                              }
                              placeholder="0"
                              aria-label={`In stock at ${loc.name}`}
                              className={cn(
                                "w-28 rounded-base border bg-white px-2 py-1.5 text-right text-sm text-grey-90 outline-none transition-colors focus:border-grey-50 disabled:cursor-not-allowed disabled:bg-grey-10",
                                invalid ? "border-rose-400" : "border-grey-20"
                              )}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-grey-10 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            Cancel
          </button>
          {step === "details" ? (
            <button
              type="button"
              onClick={() => goToStep("availability")}
              className={primaryBtn}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={primaryBtn}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
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

function InventoryListPageContent() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // URL is the single source of truth for q / offset.
  const qParam = searchParams.get("q") || ""
  const offsetRaw = parseInt(searchParams.get("offset") || "0", 10)
  const offset =
    Number.isFinite(offsetRaw) && offsetRaw > 0
      ? Math.floor(offsetRaw / PAGE_SIZE) * PAGE_SIZE
      : 0

  const [items, setItems] = useState<InventoryItemRow[]>([])
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [searchInput, setSearchInput] = useState(qParam)
  const selfUrlUpdate = useRef(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const headerCbRef = useRef<HTMLInputElement>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemRow | null>(null)
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
        const res = await listInventoryItems(token, {
          q: qParam || undefined,
          offset,
          limit: PAGE_SIZE,
        })
        if (!cancelled) {
          setItems(res.items || [])
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
            err instanceof Error ? err.message : "Failed to load inventory items"
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

  // ---- selection ----
  const pageIds = items.map((i) => i.id)
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = pageIds.some((id) => selected.has(id))

  useEffect(() => {
    if (headerCbRef.current) {
      headerCbRef.current.indeterminate = somePageSelected && !allPageSelected
    }
  }, [somePageSelected, allPageSelected])

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id))
      } else {
        pageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function goBulkEditStock() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    router.push(
      `/dashboard/inventory/stock?inventory_item_ids=${encodeURIComponent(ids.join(","))}`
    )
  }

  // ---- delete ----
  async function confirmDelete() {
    if (!token || !deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deleteInventoryItem(token, deleteTarget.id)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(deleteTarget.id)
        return next
      })
      setDeleteTarget(null)
      showMessage("success", "Inventory item deleted successfully.")
      // If we removed the last row on a page beyond the first, step back a page.
      if (items.length === 1 && offset > 0) {
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
        err instanceof Error ? err.message : "Failed to delete inventory item"
      )
    } finally {
      setDeleting(false)
    }
  }

  // ---- derived ----
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < count
  const hasActiveSearch = !!qParam

  const showInitialEmptyState = loaded && count === 0 && !hasActiveSearch
  const showFilteredEmptyState = loaded && count === 0 && hasActiveSearch

  const createButton = (
    <button type="button" onClick={() => setCreateOpen(true)} className={primaryBtn}>
      <Plus className="h-4 w-4" />
      Create
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage your inventory items"
        action={
          <div className="flex items-center gap-3">
            <Link href="/dashboard/inventory/stock" className={secondaryBtn}>
              <PencilSquare className="h-4 w-4" />
              Edit stock
            </Link>
            {createButton}
          </div>
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
        {/* Toolbar: search */}
        <div className="flex justify-end">
          <div className="relative w-full sm:w-64">
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
                  <th className="w-10 px-4 py-3">
                    <input
                      ref={headerCbRef}
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePage}
                      aria-label="Select all rows on this page"
                      className="h-4 w-4 rounded border-grey-30 text-grey-90 accent-grey-90"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Reserved</th>
                  <th className="px-4 py-3 font-medium">In stock</th>
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
                        title="No inventory items"
                        description="Create an inventory item to start tracking stock."
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
                        description="Try adjusting the search to find what you are looking for."
                        className="border-0 bg-transparent shadow-none"
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                      className="cursor-pointer transition-colors hover:bg-grey-5"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleRow(item.id)}
                          aria-label={`Select ${item.title || item.sku || "item"}`}
                          className="h-4 w-4 rounded border-grey-30 text-grey-90 accent-grey-90"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {item.title ? (
                          <span className="block max-w-[280px] truncate font-medium text-grey-90">
                            {item.title}
                          </span>
                        ) : (
                          <Placeholder />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.sku ? (
                          <span className="block max-w-[200px] truncate text-grey-90">
                            {item.sku}
                          </span>
                        ) : (
                          <Placeholder />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <QuantityCell value={item.reserved_quantity} />
                      </td>
                      <td className="px-4 py-3">
                        <QuantityCell value={item.stocked_quantity} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ActionMenu
                            items={[
                              {
                                label: "Edit",
                                icon: PencilSquare,
                                onClick: () =>
                                  router.push(`/dashboard/inventory/${item.id}`),
                              },
                              {
                                label: "Delete",
                                icon: Trash,
                                destructive: true,
                                onClick: () => setDeleteTarget(item),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
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

      {/* Command bar (bulk selection) */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-full bg-grey-90 px-5 py-2.5 text-sm text-white shadow-lg">
            <span>
              {selected.size} selected
            </span>
            <span className="h-4 w-px bg-grey-60" aria-hidden="true" />
            <button
              type="button"
              onClick={goBulkEditStock}
              className="font-medium hover:text-grey-20"
            >
              Edit stock levels
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
              className="text-grey-40 hover:text-white"
            >
              <XMark className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateInventoryItemModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        token={token}
        logout={logout}
        onCreated={(warning) => {
          setCreateOpen(false)
          if (warning) {
            showMessage("error", warning)
          } else {
            showMessage("success", "Inventory item was successfully created.")
          }
          setRefreshKey((k) => k + 1)
        }}
      />

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
            You are about to delete an inventory item. This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className={secondaryBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className={dangerBtn}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InventoryListPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Manage your inventory items" />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-base bg-grey-10" />
      <div className="h-96 animate-pulse rounded-large border border-grey-20 bg-grey-10" />
    </div>
  )
}

export default function InventoryListPage() {
  return (
    <Suspense fallback={<InventoryListPageSkeleton />}>
      <InventoryListPageContent />
    </Suspense>
  )
}
