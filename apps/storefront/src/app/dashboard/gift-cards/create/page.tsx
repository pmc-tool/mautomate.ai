"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { RouteModal, RouteModalFooterAction } from "@components/merchant-admin/route-modal"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createGiftCard,
  CreateGiftCardInput,
  ApiError,
} from "@lib/merchant-admin/api"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Ll}\p{Lo}\p{Lm}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function cents(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

export default function CreateGiftCardPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("draft")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("usd")
  const [sku, setSku] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!handleEdited) setHandle(slugify(value))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!token || !title || !amount) return
    setSaving(true)
    setError(null)

    const body: CreateGiftCardInput = {
      title,
      handle: handle || slugify(title),
      description,
      status,
      prices: [{ amount: cents(amount), currency_code: currency }],
      sku,
      thumbnail: thumbnail || undefined,
    }

    try {
      await createGiftCard(token, body)
      router.push("/dashboard/gift-cards")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create gift card")
    } finally {
      setSaving(false)
    }
  }

  return (
    <RouteModal
      title="Add gift card"
      subtitle="Create a new gift card product."
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
            disabled={!title || !amount || saving}
            onClick={() => handleSubmit()}
          >
            {saving ? "Saving..." : "Add gift card"}
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

        <SectionCard title="Details" description="Basic gift card information.">
          <div className="space-y-4">
            <FormField label="Title" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. $50 Gift Card"
                required
              />
            </FormField>

            <FormField label="Handle" htmlFor="handle" hint="Used in the gift card URL.">
              <Input
                id="handle"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value)
                  setHandleEdited(true)
                }}
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
      </form>
    </RouteModal>
  )
}
