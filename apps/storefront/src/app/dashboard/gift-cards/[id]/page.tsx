"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getGiftCard,
  updateGiftCard,
  UpdateGiftCardInput,
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

export default function EditGiftCardPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { token, logout } = useMerchantAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("draft")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("usd")
  const [sku, setSku] = useState("")
  const [thumbnail, setThumbnail] = useState("")

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    getGiftCard(token, id)
      .then(({ gift_card }) => {
        setTitle(gift_card.title)
        setHandle(gift_card.handle)
        setDescription(gift_card.description || "")
        setStatus(gift_card.status)
        setAmount(toCurrencyInput(gift_card.price))
        setCurrency(gift_card.currency_code || "usd")
        setSku(gift_card.sku || "")
        setThumbnail(gift_card.thumbnail || "")
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load gift card")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !title || !amount) return
    setSaving(true)
    setError(null)

    const body: UpdateGiftCardInput = {
      title,
      handle,
      description,
      status,
      prices: [{ amount: cents(amount), currency_code: currency }],
      sku,
      thumbnail: thumbnail || null,
    }

    try {
      await updateGiftCard(token, id, body)
      router.push("/dashboard/gift-cards")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to update gift card")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Edit gift card"
      subtitle="Update gift card product details."
      footer={
        <>
          <RouteModalFooterAction
            variant="secondary"
            onClick={() => router.push("/dashboard/gift-cards")}
          >
            Cancel
          </RouteModalFooterAction>
          <RouteModalFooterAction
            type="submit"
            disabled={!title || !amount || saving || loading}
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
            <SectionCard title="Details" description="Basic gift card information.">
              <div className="space-y-4">
                <FormField label="Title" htmlFor="title">
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. $50 Gift Card"
                    required
                  />
                </FormField>

                <FormField label="Handle" htmlFor="handle">
                  <Input
                    id="handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="50-gift-card"
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
                  <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="proposed">Proposed</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Pricing" description="Set the gift card value.">
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
                      placeholder="50.00"
                      required
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

                <FormField label="SKU" htmlFor="sku">
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Optional SKU"
                  />
                </FormField>

                <FormField label="Thumbnail URL" htmlFor="thumbnail">
                  <Input
                    id="thumbnail"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    placeholder="https://example.com/gift-card.png"
                  />
                </FormField>
              </div>
            </SectionCard>
          </>
        )}
      </form>
    </RouteModal>
  )
}
