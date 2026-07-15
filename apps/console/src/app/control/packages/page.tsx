"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowPath,
  Check,
  CubeSolid,
  CurrencyDollar,
  ExclamationCircle,
  PencilSquare,
  Plus,
  Trash,
} from "@medusajs/icons"
import { useControlAuth } from "@/lib/auth"
import {
  createPackage,
  deletePackage,
  getPricing,
  updatePackage,
  updatePricebook,
  type Package,
  type PricebookEntry,
} from "@/lib/api/packages"
import { DataTable, type Column } from "@/components/data-table"
import { EmptyState } from "@/components/empty-state"
import { Modal } from "@/components/modal"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"

function humanizePackage(key: string | null | undefined): string {
  if (!key) return "—"
  return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

type PricebookRow = PricebookEntry & { key: string; label: string }

/** Real names for every metered action — a raw key like `ai_image_basic` is not a product. */
const ACTION_LABELS: Record<string, string> = {
  ai_call_minute: "AI calls (web) — per minute",
  ai_call_phone_minute: "AI calls (phone) — per minute",
  phone_number_month: "Phone number rental — per month",
  sms_segment: "SMS — per segment",
  ai_text: "AI text & chatbot — per action",
  ai_page_edit: "AI page edit — per edit",
  ai_content: "AI content / blog — per piece",
  ai_image: "AI image — per image",
  ai_logo: "AI logo — per logo",
  ai_image_basic: "AI image (basic engine)",
  social_publish: "Social publish (free)",
  email_batch: "Email — per 10 sends",
  email: "Email — per send",
  domain_purchase_usd: "Domain — per $1 of wholesale",
}

function flattenPricebook(
  pb: Record<string, PricebookEntry> | null | undefined
): PricebookRow[] {
  if (!pb) return []
  return Object.entries(pb).map(([key, entry]) => {
    const action = entry?.action ?? key
    return {
      key,
      label: ACTION_LABELS[action] ?? humanizePackage(action),
      action,
      credits: Number(entry?.credits) || 0,
      vendor_cost_usd: Number(entry?.vendor_cost_usd) || 0,
    }
  })
}

function safeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatMoney(value: number | null | undefined): string {
  return `$${safeNumber(value).toFixed(2)}`
}

function formatInt(value: number | null | undefined): string {
  return safeNumber(value).toLocaleString()
}

const emptyForm: PackageForm = {
  key: "",
  name: "",
  price_usd: 0,
  included_credits: 0,
  fixed_infra_usd: 0,
  products_limit: null,
  seats_limit: null,
  domains_limit: null,
  features: [],
  active: true,
  sort: 0,
}

type PackageForm = {
  key: string
  name: string
  price_usd: number
  included_credits: number
  fixed_infra_usd: number
  products_limit: number | null
  seats_limit: number | null
  domains_limit: number | null
  features: string[]
  active: boolean
  sort: number
}

export default function PackagesPage() {
  const { token } = useControlAuth()

  const [packages, setPackages] = useState<Package[]>([])
  const [pricebook, setPricebook] = useState<Record<string, PricebookEntry>>({})
  const [creditUsd, setCreditUsd] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workingKey, setWorkingKey] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | null>(null)
  const [form, setForm] = useState<PackageForm>(emptyForm)
  const [featureDraft, setFeatureDraft] = useState("")

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; pkg: Package | null }>({
    open: false,
    pkg: null,
  })

  const [editedPricebook, setEditedPricebook] = useState<Record<string, Partial<PricebookEntry>>>({})

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getPricing(token)
      setPackages(res.tiers || [])
      setPricebook(res.price_book || {})
      setCreditUsd(res.credit_usd || 0)
      setEditedPricebook({})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingPackage(null)
    setForm(emptyForm)
    setFeatureDraft("")
    setEditorOpen(true)
  }

  const openEdit = (pkg: Package) => {
    setEditingPackage(pkg)
    setForm({
      key: pkg.key,
      name: pkg.name,
      price_usd: safeNumber(pkg.price_usd),
      included_credits: safeNumber(pkg.included_credits),
      fixed_infra_usd: safeNumber(pkg.fixed_infra_usd),
      products_limit: pkg.products_limit ?? null,
      seats_limit: pkg.seats_limit ?? null,
      domains_limit: pkg.domains_limit ?? null,
      features: pkg.features ?? [],
      active: pkg.active ?? true,
      sort: safeNumber(pkg.sort),
    })
    setFeatureDraft("")
    setEditorOpen(true)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return
    if (!form.key.trim() || !form.name.trim()) {
      setError("Package key and name are required")
      return
    }
    setWorkingKey(form.key)
    try {
      const payload = {
        name: form.name.trim(),
        price_usd: form.price_usd,
        included_credits: form.included_credits,
        fixed_infra_usd: form.fixed_infra_usd,
        products_limit: form.products_limit,
        seats_limit: form.seats_limit,
        domains_limit: form.domains_limit,
        features: form.features,
        active: form.active,
        sort: form.sort,
      }
      if (editingPackage) {
        await updatePackage(token, editingPackage.key, payload)
      } else {
        await createPackage(token, {
          key: form.key.trim().toLowerCase().replace(/\s+/g, "_"),
          ...payload,
        })
      }
      await load()
      setEditorOpen(false)
      setForm(emptyForm)
      setFeatureDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save package")
    } finally {
      setWorkingKey(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !deleteModal.pkg) return
    setWorkingKey(deleteModal.pkg.key)
    try {
      await deletePackage(token, deleteModal.pkg.key)
      await load()
      setDeleteModal({ open: false, pkg: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete package")
    } finally {
      setWorkingKey(null)
    }
  }

  const handleUpdatePricebook = async (key: string) => {
    if (!token) return
    const edits = editedPricebook[key]
    const credits = edits?.credits ?? pricebook[key]?.credits ?? 0
    const vendor_cost_usd = edits?.vendor_cost_usd ?? pricebook[key]?.vendor_cost_usd ?? 0
    if (!Number.isFinite(credits) || !Number.isFinite(vendor_cost_usd)) {
      setError("Enter a valid price")
      return
    }
    setWorkingKey(key)
    try {
      await updatePricebook(token, key, credits, vendor_cost_usd)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pricebook")
    } finally {
      setWorkingKey(null)
    }
  }

  const addFeature = () => {
    const feature = featureDraft.trim()
    if (!feature) return
    setForm((f) => ({ ...f, features: [...f.features, feature] }))
    setFeatureDraft("")
  }

  const removeFeature = (index: number) => {
    setForm((f) => ({
      ...f,
      features: f.features.filter((_, i) => i !== index),
    }))
  }

  const pricebookRows = useMemo(() => flattenPricebook(pricebook), [pricebook])

  const pricebookColumns = useMemo<Column<PricebookRow>[]>(
    () => [
      {
        key: "label",
        header: "Action",
        render: (row) => <span className="font-medium text-grey-90">{row.label}</span>,
      },
      {
        key: "margin",
        header: "Margin",
        className: "text-right",
        render: (row) => {
          // What the operator is ABOUT to save, not what is saved — so a bad
          // rate is visible before it ships.
          const credits = editedPricebook[row.key]?.credits ?? row.credits
          const cost =
            editedPricebook[row.key]?.vendor_cost_usd ?? row.vendor_cost_usd
          const revenue = credits * 0.01
          if (!cost || cost <= 0) {
            return <span className="text-xs text-grey-40">—</span>
          }
          const pct = ((revenue - cost) / revenue) * 100
          const mult = revenue / cost
          const loss = revenue <= cost
          const thin = pct < 50
          return (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                loss
                  ? "bg-red-100 text-red-700"
                  : thin
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
              )}
              title={`${mult.toFixed(1)}x vendor cost`}
            >
              {loss ? "LOSS" : `${pct.toFixed(0)}%`}
            </span>
          )
        },
      },
      {
        key: "credits",
        header: "Credits",
        className: "text-right",
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={editedPricebook[row.key]?.credits ?? row.credits}
              onChange={(e) =>
                setEditedPricebook((prev) => ({
                  ...prev,
                  [row.key]: {
                    ...prev[row.key],
                    credits: Number(e.target.value),
                  },
                }))
              }
              className="w-28 rounded-base border border-grey-30 bg-white px-2 py-1.5 text-right text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
          </div>
        ),
      },
      {
        key: "vendor_cost_usd",
        header: "Vendor cost (USD)",
        className: "text-right",
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={editedPricebook[row.key]?.vendor_cost_usd ?? row.vendor_cost_usd}
              onChange={(e) =>
                setEditedPricebook((prev) => ({
                  ...prev,
                  [row.key]: {
                    ...prev[row.key],
                    vendor_cost_usd: Number(e.target.value),
                  },
                }))
              }
              className="w-28 rounded-base border border-grey-30 bg-white px-2 py-1.5 text-right text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
            />
            <button
              onClick={() => handleUpdatePricebook(row.key)}
              disabled={workingKey === row.key}
              className="rounded-base border border-grey-20 bg-white p-1.5 text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
              title="Save pricebook entry"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [editedPricebook, pricebook, workingKey]
  )

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={openCreate}
        className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
      >
        <Plus className="h-4 w-4" />
        Add package
      </button>
      <button
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-base border border-grey-20 bg-white px-3 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30 hover:text-grey-90 disabled:opacity-50"
      >
        <ArrowPath className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages & Pricing"
        description="Manage subscription tiers and per-action credit pricing."
        action={headerActions}
      />

      {error && (
        <div className="rounded-large border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <ExclamationCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-grey-90">Packages</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-large border border-grey-20 bg-grey-10"
              />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <EmptyState
            title="No packages"
            description="Create a package tier to offer to tenant stores."
            action={
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80"
              >
                <Plus className="h-4 w-4" />
                Add package
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <div
                key={pkg.key}
                className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-base bg-grey-10 text-grey-70">
                    <CubeSolid className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(pkg)}
                      className="rounded-base p-1.5 text-grey-50 transition-colors hover:bg-grey-10 hover:text-grey-90"
                      title="Edit package"
                    >
                      <PencilSquare className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteModal({ open: true, pkg })}
                      className="rounded-base p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete package"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-grey-90">{pkg.name}</h3>
                  <StatusBadge status={pkg.active ? "active" : "inactive"} />
                </div>
                <p className="mt-1 text-sm text-grey-50">{humanizePackage(pkg.key)}</p>
                <p className="mt-3 text-2xl font-semibold text-grey-90">
                  {formatMoney(pkg.price_usd)}
                  <span className="text-sm font-normal text-grey-50">/mo</span>
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-grey-50">Included credits</span>
                    <span className="font-medium text-grey-90">
                      {formatInt(pkg.included_credits)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-grey-50">Infra cost</span>
                    <span className="font-medium text-grey-90">
                      {formatMoney(pkg.fixed_infra_usd)}
                    </span>
                  </div>
                  {pkg.products_limit != null && (
                    <div className="flex justify-between">
                      <span className="text-grey-50">Products limit</span>
                      <span className="font-medium text-grey-90">{formatInt(pkg.products_limit)}</span>
                    </div>
                  )}
                  {pkg.seats_limit != null && (
                    <div className="flex justify-between">
                      <span className="text-grey-50">Seats limit</span>
                      <span className="font-medium text-grey-90">{formatInt(pkg.seats_limit)}</span>
                    </div>
                  )}
                  {pkg.domains_limit != null && (
                    <div className="flex justify-between">
                      <span className="text-grey-50">Domains limit</span>
                      <span className="font-medium text-grey-90">{formatInt(pkg.domains_limit)}</span>
                    </div>
                  )}
                </div>
                {pkg.features && pkg.features.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pkg.features.map((feature, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-base border border-grey-20 bg-grey-5 px-2 py-1 text-xs font-medium text-grey-70"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-large border border-grey-20 bg-white p-5 shadow-borders-base">
        <div className="mb-4 flex items-center gap-2">
          <CurrencyDollar className="h-5 w-5 text-grey-50" />
          <h2 className="text-lg font-semibold text-grey-90">Pricebook</h2>
          <span className="ml-auto text-sm text-grey-50">
            Credit USD: ${creditUsd.toFixed(4)}
          </span>
        </div>
        <DataTable
          columns={pricebookColumns}
          rows={pricebookRows}
          searchKeys={["label"]}
          isLoading={loading}
          emptyIcon={CurrencyDollar}
          emptyTitle="No pricebook entries"
          emptyDescription="Action credit prices will appear here once configured."
        />
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingPackage ? "Edit package" : "Create package"}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pkg-key" className="mb-1.5 block text-sm font-medium text-grey-70">
                Key
              </label>
              <input
                id="pkg-key"
                type="text"
                required
                disabled={!!editingPackage}
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="e.g. starter"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20 disabled:bg-grey-10 disabled:text-grey-50"
              />
            </div>
            <div>
              <label htmlFor="pkg-name" className="mb-1.5 block text-sm font-medium text-grey-70">
                Name
              </label>
              <input
                id="pkg-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Starter"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pkg-price" className="mb-1.5 block text-sm font-medium text-grey-70">
                Price USD
              </label>
              <input
                id="pkg-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.price_usd}
                onChange={(e) => setForm((f) => ({ ...f, price_usd: Number(e.target.value) }))}
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label htmlFor="pkg-credits" className="mb-1.5 block text-sm font-medium text-grey-70">
                Included credits
              </label>
              <input
                id="pkg-credits"
                type="number"
                min="0"
                step="1"
                required
                value={form.included_credits}
                onChange={(e) => setForm((f) => ({ ...f, included_credits: Number(e.target.value) }))}
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label htmlFor="pkg-infra" className="mb-1.5 block text-sm font-medium text-grey-70">
                Infra cost USD
              </label>
              <input
                id="pkg-infra"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.fixed_infra_usd}
                onChange={(e) => setForm((f) => ({ ...f, fixed_infra_usd: Number(e.target.value) }))}
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="pkg-products" className="mb-1.5 block text-sm font-medium text-grey-70">
                Products limit
              </label>
              <input
                id="pkg-products"
                type="number"
                min="0"
                step="1"
                value={form.products_limit ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    products_limit: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Unlimited"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label htmlFor="pkg-seats" className="mb-1.5 block text-sm font-medium text-grey-70">
                Seats limit
              </label>
              <input
                id="pkg-seats"
                type="number"
                min="0"
                step="1"
                value={form.seats_limit ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seats_limit: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Unlimited"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label htmlFor="pkg-domains" className="mb-1.5 block text-sm font-medium text-grey-70">
                Domains limit
              </label>
              <input
                id="pkg-domains"
                type="number"
                min="0"
                step="1"
                value={form.domains_limit ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    domains_limit: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Unlimited"
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
            <div>
              <label htmlFor="pkg-sort" className="mb-1.5 block text-sm font-medium text-grey-70">
                Sort order
              </label>
              <input
                id="pkg-sort"
                type="number"
                min="0"
                step="1"
                value={form.sort}
                onChange={(e) => setForm((f) => ({ ...f, sort: Number(e.target.value) }))}
                className="w-full rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
            </div>
          </div>
          <div>
            <label htmlFor="pkg-features" className="mb-1.5 block text-sm font-medium text-grey-70">
              Features
            </label>
            <div className="flex items-center gap-2">
              <input
                id="pkg-features"
                type="text"
                value={featureDraft}
                onChange={(e) => setFeatureDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addFeature()
                  }
                }}
                placeholder="Add a feature and press Enter"
                className="flex-1 rounded-base border border-grey-30 bg-white px-3 py-2.5 text-sm text-grey-90 placeholder:text-grey-40 transition-colors focus:border-grey-90 focus:outline-none focus:ring-2 focus:ring-grey-90/20"
              />
              <button
                type="button"
                onClick={addFeature}
                className="rounded-base border border-grey-20 bg-white px-3 py-2.5 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
              >
                Add
              </button>
            </div>
            {form.features.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.features.map((feature, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-base border border-grey-20 bg-grey-5 px-2 py-1 text-xs font-medium text-grey-70"
                  >
                    {feature}
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      className="text-grey-50 hover:text-red-600"
                      title="Remove feature"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="pkg-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-grey-30 text-grey-90"
            />
            <label htmlFor="pkg-active" className="text-sm font-medium text-grey-70">
              Active
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={workingKey === form.key}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-grey-80 disabled:opacity-50"
            >
              {editingPackage ? "Save changes" : "Create package"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, pkg: null })}
        title="Delete package"
        description={
          deleteModal.pkg
            ? `Delete ${deleteModal.pkg.name}? This cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setDeleteModal({ open: false, pkg: null })}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-70 transition-all hover:bg-grey-10 hover:border-grey-30"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={workingKey === deleteModal.pkg?.key}
            className="rounded-base bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
