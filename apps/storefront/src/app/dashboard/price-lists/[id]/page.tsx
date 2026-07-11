"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getPriceList,
  updatePriceList,
  UpdatePriceListInput,
  ApiError,
} from "@lib/merchant-admin/api"

function cents(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

function toCurrencyInput(amount?: number | null): string {
  if (amount == null) return ""
  return (Number(amount) || 0).toFixed(2)
}

function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditPriceListPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { token, logout } = useMerchantAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<"draft" | "active" | "inactive">("draft")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("usd")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    getPriceList(token, id)
      .then(({ price_list }) => {
        setTitle(price_list.title)
        setDescription(price_list.description || "")
        setStatus(price_list.status)
        setAmount("")
        setCurrency("usd")
        setStartsAt(toDateTimeLocal(price_list.starts_at))
        setExpiresAt(toDateTimeLocal(price_list.expires_at))
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load price list")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !title) return
    setSaving(true)
    setError(null)

    const body: UpdatePriceListInput = {
      title,
      description,
      status,
      starts_at: startsAt || null,
      expires_at: expiresAt || null,
    }
    if (amount) {
      body.prices = [{ amount: cents(amount), currency_code: currency }]
    }

    try {
      await updatePriceList(token, id, body)
      router.push("/dashboard/price-lists")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to update price list")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Edit price list"
      subtitle="Update price list details."
      footer={
        <>
          <RouteModalFooterAction
            variant="secondary"
            onClick={() => router.push("/dashboard/price-lists")}
          >
            Cancel
          </RouteModalFooterAction>
          <RouteModalFooterAction
            type="submit"
            disabled={!title || saving || loading}
            onClick={() => handleSubmit()}
          >
            {saving ? "Saving..." : "Save changes"}
          </RouteModalFooterAction>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-10 animate-pulse rounded-base bg-grey-10" />
            <div className="h-10 animate-pulse rounded-base bg-grey-10" />
          </div>
        ) : (
          <>
            <SectionCard title="General" description="Basic price list information.">
              <div className="space-y-4">
                <FormField label="Title" htmlFor="title">
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Wholesale prices"
                    required
                  />
                </FormField>

                <FormField label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </FormField>

                <FormField label="Status" htmlFor="status">
                  <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Add price" description="Append another override price to the list.">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Amount" htmlFor="amount">
                    <Input
                      id="amount"
                      type="number"
                      min={0}
                      step={0.01}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Leave empty to keep existing prices"
                    />
                  </FormField>

                  <FormField label="Currency" htmlFor="currency">
                    <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="usd">USD</option>
                      <option value="eur">EUR</option>
                      <option value="gbp">GBP</option>
                      <option value="cad">CAD</option>
                    </Select>
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Starts at" htmlFor="starts_at">
                    <Input
                      id="starts_at"
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Expires at" htmlFor="expires_at">
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </SectionCard>
          </>
        )}
      </form>
    </RouteModal>
  )
}
