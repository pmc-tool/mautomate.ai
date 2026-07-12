"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExclamationCircle } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Textarea } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import { cn } from "@lib/util/cn"
import {
  createCampaign,
  listStoreCurrencies,
  ApiError,
} from "../../../../lib/merchant-admin/api"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
}

function currencyName(code: string): string {
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "currency" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

const BUDGET_TYPES: {
  value: "usage" | "spend"
  label: string
  description: string
}[] = [
  {
    value: "usage",
    label: "Usage",
    description: "Set a limit on how many times the promotion can be used.",
  },
  {
    value: "spend",
    label: "Spend",
    description:
      "Set a limit on the total discounted amount of all promotion usages.",
  },
]

export default function CampaignCreatePage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [name, setName] = useState("")
  const [identifier, setIdentifier] = useState("")
  const [identifierEdited, setIdentifierEdited] = useState(false)
  const [description, setDescription] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [budgetType, setBudgetType] = useState<"usage" | "spend">("usage")
  const [limit, setLimit] = useState("")

  const [defaultCurrency, setDefaultCurrency] = useState<string | null>(null)
  const [currencyError, setCurrencyError] = useState<string | null>(null)

  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listStoreCurrencies(token)
      .then((res) => {
        if (!cancelled) setDefaultCurrency(res.default_currency)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        if (!cancelled) {
          setCurrencyError(
            err instanceof Error ? err.message : "Failed to load store currency"
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, logout])

  function handleNameChange(value: string) {
    setName(value)
    if (!identifierEdited) setIdentifier(slugify(value))
  }

  function handleIdentifierChange(value: string) {
    setIdentifier(value)
    // Re-derive from the name again if the merchant clears the field.
    setIdentifierEdited(value !== "")
  }

  function selectBudgetType(type: "usage" | "spend") {
    if (type === budgetType) return
    setBudgetType(type)
    // Changing the budget type resets the limit (matches Medusa admin).
    setLimit("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!token || saving) return
    if (!name.trim() || !identifier.trim()) return

    const trimmedLimit = limit.trim()
    const limitNumber = trimmedLimit === "" ? null : Number(trimmedLimit)
    if (limitNumber != null && (!Number.isFinite(limitNumber) || limitNumber < 0)) {
      setError("Budget limit must be a positive number.")
      return
    }
    if (
      budgetType === "usage" &&
      limitNumber != null &&
      !Number.isInteger(limitNumber)
    ) {
      setError("Usage limit must be a whole number.")
      return
    }
    if (budgetType === "spend" && limitNumber != null && !defaultCurrency) {
      setError("Store currency is not loaded yet. Try again in a moment.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await createCampaign(token, {
        name: name.trim(),
        identifier: identifier.trim(),
        description: description.trim() || undefined,
        starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
        budget:
          limitNumber != null
            ? {
                type: budgetType,
                currency_code:
                  budgetType === "spend" ? defaultCurrency! : undefined,
                limit: limitNumber,
              }
            : undefined,
      })
      router.push(`/dashboard/campaigns/${res.campaign.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create campaign")
      setSaving(false)
    }
  }

  const nameError = submitted && !name.trim() ? "Name is required" : undefined
  const identifierError =
    submitted && !identifier.trim() ? "Identifier is required" : undefined

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      <button
        onClick={() => router.push("/dashboard/campaigns")}
        className="inline-flex items-center gap-1 text-sm font-medium text-grey-60 hover:text-grey-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </button>

      <PageHeader
        title="Create Campaign"
        description="Create a promotional campaign."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ExclamationCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard
          title="Create Campaign"
          description="Create a promotional campaign."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Name" htmlFor="campaign-name" error={nameError}>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Summer sale"
                />
              </FormField>
              <FormField
                label="Identifier"
                htmlFor="campaign-identifier"
                error={identifierError}
                hint="Auto-generated from the name until you edit it."
              >
                <Input
                  id="campaign-identifier"
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="summer-sale"
                />
              </FormField>
            </div>
            <FormField
              label="Description"
              htmlFor="campaign-description"
              hint="Optional"
            >
              <Textarea
                id="campaign-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this campaign about?"
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Start date"
                htmlFor="campaign-starts-at"
                hint="Optional"
              >
                <Input
                  id="campaign-starts-at"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </FormField>
              <FormField
                label="End date"
                htmlFor="campaign-ends-at"
                hint="Optional"
              >
                <Input
                  id="campaign-ends-at"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </FormField>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Campaign Budget"
          description="Create a budget for the campaign."
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-grey-70">Type</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {BUDGET_TYPES.map((opt) => {
                  const disabled = opt.value === "spend" && !defaultCurrency
                  const active = budgetType === opt.value
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-base border p-4 transition-colors",
                        active
                          ? "border-grey-90 bg-grey-5"
                          : "border-grey-20 hover:bg-grey-5",
                        disabled && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <input
                        type="radio"
                        name="budget-type"
                        className="mt-0.5"
                        checked={active}
                        disabled={disabled}
                        onChange={() => selectBudgetType(opt.value)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-grey-90">
                          {opt.label}
                        </span>
                        <span className="mt-0.5 block text-sm text-grey-50">
                          {opt.description}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-grey-50">
                The budget type and currency cannot be changed after the campaign
                is created.
              </p>
              {currencyError && (
                <p className="mt-1 text-xs text-red-600">
                  Could not load the store currency, so a spend budget is
                  unavailable: {currencyError}
                </p>
              )}
            </div>

            {budgetType === "spend" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Currency"
                  htmlFor="campaign-budget-currency"
                  hint="Store default currency. Spend budgets always use it."
                >
                  <Input
                    id="campaign-budget-currency"
                    value={
                      defaultCurrency
                        ? `${defaultCurrency.toUpperCase()} — ${currencyName(defaultCurrency)}`
                        : "Loading..."
                    }
                    disabled
                    readOnly
                  />
                </FormField>
                <FormField
                  label="Limit"
                  htmlFor="campaign-budget-limit"
                  hint="Optional. Leave empty for no limit."
                >
                  <Input
                    id="campaign-budget-limit"
                    type="number"
                    min={0}
                    step="0.01"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="0"
                    disabled={!defaultCurrency}
                  />
                </FormField>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Limit"
                  htmlFor="campaign-budget-limit"
                  hint="Optional. Leave empty for no limit."
                >
                  <Input
                    id="campaign-budget-limit"
                    type="number"
                    min={0}
                    step={1}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="0"
                  />
                </FormField>
              </div>
            )}
          </div>
        </SectionCard>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/campaigns")}
            disabled={saving}
            className="inline-flex items-center rounded-base border border-grey-30 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  )
}
