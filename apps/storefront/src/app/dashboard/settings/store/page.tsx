"use client"

import React, { useEffect, useState } from "react"
import { BuildingStorefront, Check } from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"
import { FormField, Input, Select } from "@components/merchant-admin/form-field"
import { FormToggle } from "@components/merchant-admin/form-toggle"
import { useMerchantAuth } from "@lib/merchant-admin/auth"
import {
  getStoreSettings,
  updateStoreSettings,
  listCurrencies,
  StoreSettings,
  Currency,
  ApiError,
} from "@lib/merchant-admin/api"
import { cn } from "@lib/util/cn"

const locales = [
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "de-DE", name: "German" },
  { code: "fr-FR", name: "French" },
]

export default function StoreSettingsPage() {
  const { token, logout } = useMerchantAuth()

  const [store, setStore] = useState<StoreSettings | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [defaultCurrency, setDefaultCurrency] = useState("")
  const [defaultLocale, setDefaultLocale] = useState("")
  const [supportedCurrencies, setSupportedCurrencies] = useState<StoreSettings["supported_currencies"]>([])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([getStoreSettings(token), listCurrencies(token)])
      .then(([storeRes, curRes]) => {
        setStore(storeRes.store)
        setCurrencies(curRes.currencies)
        setName(storeRes.store.name)
        setDefaultCurrency(storeRes.store.default_currency_code)
        setDefaultLocale(storeRes.store.default_locale)
        setSupportedCurrencies(storeRes.store.supported_currencies)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout()
        setError(err instanceof Error ? err.message : "Failed to load store settings")
      })
      .finally(() => setLoading(false))
  }, [token, logout])

  const toggleCurrency = (code: string) => {
    setSupportedCurrencies((prev) =>
      prev.map((c) => (c.code === code ? { ...c, enabled: !c.enabled } : c))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !store) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await updateStoreSettings(token, {
        name: name.trim(),
        default_currency_code: defaultCurrency,
        default_locale: defaultLocale,
        supported_currencies: supportedCurrencies,
      })
      setStore(res.store)
      setMessage("Store settings saved")
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout()
      setError(err instanceof Error ? err.message : "Failed to save store settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grey-30 border-t-grey-90" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Store settings" description="Manage your store details and currencies." />

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
        <SectionCard
          title="General"
          description="Basic store information."
        >
          <div className="space-y-4">
            <FormField
              label="Store name"
              htmlFor="store-name"
              hint="Shown from your account. Editing here is not persisted yet."
            >
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Default currency" htmlFor="default-currency">
                <Select
                  id="default-currency"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.symbol})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Default locale"
                htmlFor="default-locale"
                hint="Display preference; not persisted yet."
              >
                <Select
                  id="default-locale"
                  value={defaultLocale}
                  onChange={(e) => setDefaultLocale(e.target.value)}
                >
                  {locales.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Supported currencies"
          description="Enable the currencies you want to support."
        >
          <div className="space-y-3">
            {supportedCurrencies.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between rounded-base border border-grey-20 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-grey-90">
                    {c.name} <span className="text-grey-50">({c.symbol})</span>
                  </p>
                  <p className="text-xs uppercase text-grey-50">{c.code}</p>
                </div>
                <FormToggle
                  checked={c.enabled}
                  onChange={() => toggleCurrency(c.code)}
                  label={`Enable ${c.code}`}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              if (store) {
                setName(store.name)
                setDefaultCurrency(store.default_currency_code)
                setDefaultLocale(store.default_locale)
                setSupportedCurrencies(store.supported_currencies)
              }
            }}
            className="rounded-base border border-grey-20 bg-white px-4 py-2 text-sm font-medium text-grey-90 hover:bg-grey-10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-base bg-grey-90 px-4 py-2 text-sm font-medium text-white hover:bg-grey-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
