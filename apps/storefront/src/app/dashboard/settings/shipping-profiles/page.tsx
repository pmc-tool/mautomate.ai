"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftMini, ShoppingBag, Plus, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { DataTable } from "@components/merchant-admin/data-table"
import { Modal } from "@components/merchant-admin/modal"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  listShippingProfiles,
  createShippingProfile,
  deleteShippingProfile,
  ShippingProfile,
  ApiError,
} from "@lib/merchant-admin/api"

export default function ShippingProfilesPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [items, setItems] = useState<ShippingProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("default")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await listShippingProfiles(token)
      setItems(res.shipping_profiles || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to load shipping profiles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, logout])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !name.trim()) return
    setSaving(true)
    setFormError(null)
    try {
      await createShippingProfile(token, { name: name.trim(), type: type.trim() || "default" })
      setModalOpen(false)
      setName("")
      setType("default")
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create profile")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: ShippingProfile) => {
    if (!token) return
    if (!confirm(`Delete shipping profile "${p.name}"?`)) return
    try {
      await deleteShippingProfile(token, p.id)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete profile")
    }
  }

  const columns = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "type",
      header: "Type",
      render: (p: ShippingProfile) => <span className="text-grey-70">{p.type}</span>,
    },
    {
      key: "default",
      header: "",
      render: (p: ShippingProfile) =>
        p.is_default ? (
          <span className="inline-flex items-center rounded-full bg-grey-10 px-2 py-0.5 text-xs font-medium text-grey-60">Default</span>
        ) : null,
    },
  ]

  const createButton = (
    <button
      onClick={() => setModalOpen(true)}
      className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grey-80"
    >
      <Plus className="h-4 w-4" />
      Create profile
    </button>
  )

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/dashboard/settings/locations")} className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90">
        <ArrowLeftMini className="h-4 w-4" />
        Back to locations
      </button>

      <PageHeader
        title="Shipping profiles"
        description="Groups of products that share shipping requirements. Every store has a default profile."
        action={createButton}
      />

      {error && <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <DataTable<ShippingProfile>
        columns={columns}
        rows={items}
        searchKeys={["name"]}
        sortKeys={[{ key: "name", label: "Name" }]}
        rowActions={(p) =>
          p.is_own && !p.is_default ? (
            <button onClick={() => handleDelete(p)} className="rounded-base p-1.5 text-grey-60 hover:bg-red-50 hover:text-red-600" title="Delete">
              <Trash className="h-4 w-4" />
            </button>
          ) : null
        }
        emptyIcon={ShoppingBag}
        emptyTitle="No shipping profiles"
        emptyDescription="Create a profile to group products with shared shipping needs."
        emptyAction={createButton}
        isLoading={loading}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create shipping profile" description="Group products that ship together." size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <FormField label="Name" htmlFor="sp-name"><Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bulky items" /></FormField>
          <FormField label="Type" htmlFor="sp-type" hint="e.g. default, gift_card, custom"><Input id="sp-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="default" /></FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50">{saving ? "Creating..." : "Create profile"}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
