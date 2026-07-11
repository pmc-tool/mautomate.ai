"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Plus } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listStockLocations,
  createStockLocation,
  StockLocation,
  ApiError,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

type LocationForm = {
  name: string
  address_1: string
  city: string
  country_code: string
  postal_code: string
  province: string
}

const emptyForm: LocationForm = {
  name: "",
  address_1: "",
  city: "",
  country_code: "",
  postal_code: "",
  province: "",
}

function formatAddress(l: StockLocation): string {
  if (!l.address) return "—"
  const parts = [
    l.address.address_1,
    l.address.city,
    l.address.province,
    l.address.postal_code,
    l.address.country_code?.toUpperCase(),
  ].filter(Boolean)
  return parts.length ? parts.join(", ") : "—"
}

function SetBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        on ? "bg-emerald-50 text-emerald-800" : "bg-grey-10 text-grey-50"
      )}
    >
      {label}
    </span>
  )
}

export default function LocationsPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<StockLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<LocationForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadLocations = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listStockLocations(token)
      setItems(res.stock_locations || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load stock locations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  const setField = (key: keyof LocationForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !form.name.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      const address =
        form.address_1.trim() && form.country_code.trim()
          ? {
              address_1: form.address_1.trim(),
              city: form.city.trim() || undefined,
              country_code: form.country_code.trim().toLowerCase(),
              postal_code: form.postal_code.trim() || undefined,
              province: form.province.trim() || undefined,
            }
          : null
      const res = await createStockLocation(token, { name: form.name.trim(), address })
      setModalOpen(false)
      // Drop straight into the new location so shipping can be configured.
      if (res.stock_location?.id) {
        router.push(`/dashboard/settings/locations/${res.stock_location.id}`)
      } else {
        await loadLocations()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setFormError(err instanceof Error ? err.message : "Failed to save location")
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "address",
      header: "Address",
      render: (l: StockLocation) => <span className="text-grey-70">{formatAddress(l)}</span>,
    },
    {
      key: "channels",
      header: "Sales channels",
      render: (l: StockLocation) => {
        const chs = l.sales_channels || []
        if (chs.length === 0) return <span className="text-grey-40">—</span>
        return (
          <span className="text-grey-70">
            {chs
              .slice(0, 2)
              .map((c) => c.name)
              .join(", ")}
            {chs.length > 2 ? ` +${chs.length - 2}` : ""}
          </span>
        )
      },
    },
    {
      key: "fulfillment",
      header: "Fulfillment",
      render: (l: StockLocation) => {
        const types = l.fulfillment_set_types || []
        return (
          <div className="flex gap-1.5">
            <SetBadge label="Shipping" on={types.includes("shipping")} />
            <SetBadge label="Pickup" on={types.includes("pickup")} />
          </div>
        )
      },
    },
  ]

  const createButton = (
    <button
      onClick={openCreate}
      className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
    >
      <Plus className="h-4 w-4" />
      Create location
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations & shipping"
        description="Manage where you stock inventory and the shipping options offered from each location."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/settings/shipping-profiles")}
              className="inline-flex items-center gap-2 rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Shipping profiles
            </button>
            {createButton}
          </div>
        }
      />

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <DataTable<StockLocation>
        columns={columns}
        rows={items}
        searchKeys={["name"]}
        sortKeys={[{ key: "name", label: "Name" }]}
        onRowClick={(l) => router.push(`/dashboard/settings/locations/${l.id}`)}
        emptyIcon={MapPin}
        emptyTitle="No stock locations"
        emptyDescription="Create your first stock location to manage inventory and shipping."
        emptyAction={createButton}
        isLoading={loading}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create location"
        description="A place you stock and ship inventory from."
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <FormField label="Name" htmlFor="location-name">
            <Input
              id="location-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Main warehouse"
            />
          </FormField>
          <FormField label="Address" htmlFor="location-address" hint="Optional">
            <Input
              id="location-address"
              value={form.address_1}
              onChange={(e) => setField("address_1", e.target.value)}
              placeholder="Street address"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="City" htmlFor="location-city">
              <Input id="location-city" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Optional" />
            </FormField>
            <FormField label="Province / state" htmlFor="location-province">
              <Input id="location-province" value={form.province} onChange={(e) => setField("province", e.target.value)} placeholder="Optional" />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Postal code" htmlFor="location-postal">
              <Input id="location-postal" value={form.postal_code} onChange={(e) => setField("postal_code", e.target.value)} placeholder="Optional" />
            </FormField>
            <FormField label="Country code" htmlFor="location-country" hint="2-letter code, required with address">
              <Input id="location-country" value={form.country_code} onChange={(e) => setField("country_code", e.target.value)} placeholder="us" maxLength={2} />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create location"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
