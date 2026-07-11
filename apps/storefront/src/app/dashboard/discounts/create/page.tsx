"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ReceiptPercent } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { createDiscount, CreateDiscountInput, ApiError } from "@lib/merchant-admin/api"

export default function CreateDiscountPage() {
  const { token, logout } = useMerchantAuth()
  const router = useRouter()

  const [code, setCode] = useState("")
  const [type, setType] = useState<CreateDiscountInput["type"]>("percentage")
  const [value, setValue] = useState("")
  const [status, setStatus] = useState<CreateDiscountInput["status"]>("active")
  const [usageLimit, setUsageLimit] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setLoading(true)
    setError(null)

    const rawValue = parseFloat(value || "0")
    const body: CreateDiscountInput = {
      code: code.trim(),
      type,
      value: type === "fixed" ? rawValue : type === "free_shipping" ? 0 : Math.round(rawValue),
      status,
      usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
      starts_at: startsAt || null,
      expires_at: expiresAt || null,
    }

    try {
      await createDiscount(token, body)
      router.push("/dashboard/discounts")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create discount")
    } finally {
      setLoading(false)
    }
  }

  const valueLabel = type === "percentage" ? "Percentage off" : type === "fixed" ? "Amount off (USD)" : "Value"
  const showValue = type !== "free_shipping"

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
          title="Create discount"
          description="Add a new percentage, fixed, or free shipping discount."
        />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-large border border-grey-20 bg-white p-6 shadow-borders-base">
          <h2 className="mb-4 text-base font-semibold text-grey-90">Discount details</h2>
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
                onChange={(e) => setType(e.target.value as CreateDiscountInput["type"])}
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
                onChange={(e) => setStatus(e.target.value as CreateDiscountInput["status"])}
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
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/discounts"
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="inline-flex items-center gap-2 rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ReceiptPercent className="h-4 w-4" />
            {loading ? "Creating..." : "Create discount"}
          </button>
        </div>
      </form>
    </div>
  )
}
