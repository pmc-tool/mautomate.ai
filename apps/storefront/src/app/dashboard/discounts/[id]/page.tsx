"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Check, ExclamationCircle, ReceiptPercent, Trash } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { ActionMenu } from "@components/merchant-admin/action-menu"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getDiscount,
  updateDiscount,
  deleteDiscount,
  Discount,
  ApiError,
} from "@lib/merchant-admin/api"
import { formatDiscountValue } from "@lib/merchant-admin/utils"

export default function EditDiscountPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [discount, setDiscount] = useState<Discount | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [type, setType] = useState<Discount["type"]>("percentage")
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<Discount["status"]>("active")
  const [usageLimit, setUsageLimit] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")

  useEffect(() => {
    if (!token || !id) return
    setLoading(true)
    setError(null)
    getDiscount(token, id)
      .then((res) => {
        const d = res.discount
        setDiscount(d)
        setCode(d.code)
        setType(d.type)
        setValue(
          d.type === "fixed" ? (Number(d.value) || 0).toFixed(2) : String(d.value)
        )
        setStatus(d.status)
        setUsageLimit(d.usage_limit != null ? String(d.usage_limit) : "")
        setStartsAt(d.starts_at ? d.starts_at.slice(0, 16) : "")
        setExpiresAt(d.expires_at ? d.expires_at.slice(0, 16) : "")
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load discount")
      })
      .finally(() => setLoading(false))
  }, [token, id, logout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !discount) return
    setSaving(true)
    setError(null)
    setMessage(null)

    const rawValue = parseFloat(value || "0")
    const body = {
      code: code.trim(),
      type,
      value: type === "fixed" ? rawValue : type === "free_shipping" ? 0 : Math.round(rawValue),
      status,
      usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
      starts_at: startsAt || null,
      expires_at: expiresAt || null,
    }

    try {
      const res = await updateDiscount(token, discount.id, body)
      setDiscount(res.discount)
      setMessage("Discount saved")
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to save discount")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !discount) return
    if (!confirm("Are you sure you want to delete this discount?")) return
    try {
      await deleteDiscount(token, discount.id)
      router.push("/dashboard/discounts")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete discount")
    }
  }

  const valueLabel = type === "percentage" ? "Percentage off" : type === "fixed" ? "Amount off (USD)" : "Value"
  const showValue = type !== "free_shipping"

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
      </div>
    )
  }

  if (error || !discount) {
    return (
      <div className="space-y-6">
        <PageHeader title="Discount" description="We could not load this discount." />
        <div className="rounded-large border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <ExclamationCircle className="mx-auto mb-2 h-6 w-6" />
          {error || "Discount not found."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/discounts"
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title={discount.code}
          description={`${formatDiscountValue(discount)} • ${discount.status}`}
          action={
            <ActionMenu
              items={[
                {
                  label: "Delete",
                  onClick: handleDelete,
                  icon: Trash,
                  destructive: true,
                },
              ]}
            />
          }
        />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-base border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Discount details" description="Edit the discount configuration.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Code" htmlFor="code" hint="The code customers enter at checkout.">
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SUMMER20"
                required
              />
            </FormField>

            <FormField label="Type" htmlFor="type">
              <Select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as Discount["type"])}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
                <option value="free_shipping">Free shipping</option>
              </Select>
            </FormField>

            {showValue && (
              <FormField label={valueLabel} htmlFor="value">
                <Input
                  id="value"
                  type="number"
                  step={type === "percentage" ? "1" : "0.01"}
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "percentage" ? "20" : "10.00"}
                  required
                />
              </FormField>
            )}

            <FormField label="Status" htmlFor="status">
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Discount["status"])}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>

            <FormField label="Usage limit" htmlFor="usage-limit" hint="Leave empty for unlimited.">
              <Input
                id="usage-limit"
                type="number"
                min="0"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="Unlimited"
              />
            </FormField>

            <FormField label="Starts at" htmlFor="starts-at">
              <Input
                id="starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FormField>

            <FormField label="Ends at" htmlFor="expires-at">
              <Input
                id="expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </FormField>
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/discounts"
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !code.trim()}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ReceiptPercent className="h-4 w-4" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
