"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftMini } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  createRegion,
  listCountries,
  listCurrencies,
  listPaymentProviders,
  listFulfillmentProviders,
  Currency,
  ApiError,
} from "@lib/merchant-admin/api"

export default function CreateRegionPage() {
  const router = useRouter()
  const { token, logout } = useMerchantAuth()

  const [name, setName] = useState("")
  const [currencyCode, setCurrencyCode] = useState("")
  const [countries, setCountries] = useState<{ iso_2: string; name: string }[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [paymentProviders, setPaymentProviders] = useState<{ id: string; name: string }[]>([])
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [fulfillmentProviders, setFulfillmentProviders] = useState<{ id: string; name: string }[]>([])
  const [selectedFulfillments, setSelectedFulfillments] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    Promise.all([
      listCountries(token),
      listCurrencies(token),
      listPaymentProviders(token),
      listFulfillmentProviders(token),
    ]).then(([c, cur, pp, fp]) => {
      setCountries(c.countries)
      setCurrencies(cur.currencies)
      setPaymentProviders(pp.providers)
      setFulfillmentProviders(fp.providers)
      if (cur.currencies[0]) setCurrencyCode(cur.currencies[0].code)
    })
  }, [token])

  const toggleCountry = (iso2: string) => {
    setSelectedCountries((prev) =>
      prev.includes(iso2) ? prev.filter((c) => c !== iso2) : [...prev, iso2]
    )
  }

  const togglePayment = (id: string) => {
    setSelectedPayments((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const toggleFulfillment = (id: string) => {
    setSelectedFulfillments((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !name.trim() || !currencyCode) return
    setSaving(true)
    setError(null)
    try {
      await createRegion(token, {
        name: name.trim(),
        currency_code: currencyCode,
        countries: selectedCountries,
        payment_providers: selectedPayments,
        fulfillment_providers: selectedFulfillments,
      })
      router.push("/dashboard/settings/regions")
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to create region")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard/settings/regions")}
          className="rounded-base p-2 text-grey-60 hover:bg-grey-10 hover:text-grey-90"
        >
          <ArrowLeftMini className="h-5 w-5" />
        </button>
        <PageHeader title="Create region" description="Add a new region for shipping and taxes." />
      </div>

      {error && (
        <div className="rounded-base border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title="Region details">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. United States"
                required
              />
            </FormField>
            <FormField label="Currency" htmlFor="currency">
              <Select id="currency" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-grey-70">Countries</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {countries.map((c) => (
                <label key={c.iso_2} className="flex items-center gap-2 text-sm text-grey-90">
                  <input
                    type="checkbox"
                    checked={selectedCountries.includes(c.iso_2)}
                    onChange={() => toggleCountry(c.iso_2)}
                    className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-grey-70">Payment providers</label>
              <div className="space-y-2">
                {paymentProviders.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-grey-90">
                    <input
                      type="checkbox"
                      checked={selectedPayments.includes(p.id)}
                      onChange={() => togglePayment(p.id)}
                      className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-grey-70">Fulfillment providers</label>
              <div className="space-y-2">
                {fulfillmentProviders.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-grey-90">
                    <input
                      type="checkbox"
                      checked={selectedFulfillments.includes(p.id)}
                      onChange={() => toggleFulfillment(p.id)}
                      className="h-4 w-4 rounded border-grey-30 text-grey-90 focus:ring-grey-90"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/settings/regions")}
              className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create region"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  )
}
