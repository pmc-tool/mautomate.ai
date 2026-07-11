"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftMini } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { createCustomerGroup, ApiError } from "@lib/merchant-admin/api"

export default function CreateCustomerGroupPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createCustomerGroup(token, { name: name.trim() })
      router.push("/dashboard/customer-groups")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create customer group")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard/customer-groups")}
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-5 w-5" />
        </button>
        <PageHeader
          title="Create customer group"
          description="Add a new customer group."
        />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title="Group details">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP"
              required
            />
          </FormField>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/customer-groups")}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create group"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  )
}
