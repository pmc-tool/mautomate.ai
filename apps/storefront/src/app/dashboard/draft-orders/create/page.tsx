"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftMini, Plus, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { createDraftOrder, ApiError } from "@lib/merchant-admin/api"

export default function CreateDraftOrderPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [email, setEmail] = useState("")
  const [items, setItems] = useState<{ title: string; quantity: string; unit_price: string }[]>([
    { title: "", quantity: "1", unit_price: "0" },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addItem = () => {
    setItems((prev) => [...prev, { title: "", quantity: "1", unit_price: "0" }])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof typeof items[number], value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const validItems = items
      .filter((i) => i.title.trim() && Number(i.quantity) > 0)
      .map((i) => ({
        title: i.title.trim(),
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price) || 0,
      }))

    if (!validItems.length) {
      setError("Add at least one valid item.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createDraftOrder(token, {
        email: email.trim() || undefined,
        items: validItems,
      })
      router.push("/dashboard/draft-orders")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create draft order")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard/draft-orders")}
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-5 w-5" />
        </button>
        <PageHeader title="Create draft order" description="Add a new draft order." />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Customer">
          <FormField label="Email (optional)" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </FormField>
        </SectionCard>

        <SectionCard
          title="Items"
          description="Add the items for this draft order."
          action={
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 rounded-base border border-grey-20 bg-white px-2.5 py-1.5 text-xs font-medium text-grey-90 hover:bg-grey-10"
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </button>
          }
        >
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-base border border-grey-20 p-4 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <FormField label="Item name" htmlFor={`title-${index}`}>
                    <Input
                      id={`title-${index}`}
                      value={item.title}
                      onChange={(e) => updateItem(index, "title", e.target.value)}
                      placeholder="e.g. T-shirt"
                      required
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-3">
                  <FormField label="Quantity" htmlFor={`quantity-${index}`}>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      required
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Price" htmlFor={`price-${index}`}>
                    <Input
                      id={`price-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                      required
                    />
                  </FormField>
                </div>
                <div className="flex items-end justify-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="rounded p-2 text-grey-50 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/draft-orders")}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create draft order"}
          </button>
        </div>
      </form>
    </div>
  )
}
